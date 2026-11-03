import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import mammoth from 'mammoth/mammoth.browser.js';
import JSZip from 'jszip';
import { diffLines } from 'diff';
import { parseDocument } from 'yaml';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const EXTENSIONS = new Set(['md', 'markdown', 'txt', 'html', 'htm', 'docx', 'pdf']);
const extension = name => String(name).split('.').pop().toLowerCase();
const sourceName = file => file.webkitRelativePath || file.name || 'document';
const stringifyValue = value => typeof value === 'string' ? value : JSON.stringify(value);
function parser() {
  if (typeof DOMParser === 'undefined') throw new Error('Open deze functie in de browser.');
  return new DOMParser();
}
function xml(text) {
  const doc = parser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Het document bevat onleesbare XML-gegevens.');
  return doc;
}
function descendants(doc, localName) {
  return [...doc.querySelectorAll('*')].filter(node => node.localName === localName || node.nodeName.split(':').pop() === localName);
}
function frontmatter(text) {
  const match = String(text).match(/^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
  if (!match) return null;
  const document = parseDocument(match[1], { uniqueKeys: true, maxAliasCount: 20 });
  if (document.errors.length) throw new Error('De YAML-metadata bevat een fout. Herstel die voordat je metadata verwijdert.');
  const data = document.toJS({ maxAliasCount: 20 });
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('De metadata bovenaan moet uit benoemde velden bestaan.');
  return { document, data, length: match[0].length };
}
async function bytes(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error('Dit bestand is groter dan 50 MB. Kies voor deze eerste versie een kleiner bestand.');
  return file.arrayBuffer();
}
async function pdfDocument(file) {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await bytes(file)), isEvalSupported: false });
  try {
    return { pdf: await task.promise, task };
  } catch (error) {
    // Destroy the loading task even if loading fails; preserve the original error.
    try { await task.destroy(); } catch { /* original loading error remains primary */ }
    throw error;
  }
}
async function releasePdf(task, warnings) {
  // PDFjs 6 removed PDFDocumentProxy.destroy(); the loading task owns teardown.
  // Teardown must never replace a more useful extraction/scan error.
  try { await task.destroy(); }
  catch { warnings.push('De PDF-sessie kon niet volledig worden afgesloten. Herlaad de app voordat je verdergaat.'); }
}
function markdownFromHtml(input) {
  const doc = parser().parseFromString(input, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,template,noscript,svg,link,meta').forEach(node => node.remove());
  // Never fetch embedded or remote media; preserve the meaningful alternative text.
  doc.querySelectorAll('img').forEach(node => node.replaceWith(doc.createTextNode(node.getAttribute('alt') || '[Afbeelding]')));
  doc.querySelectorAll('a').forEach(node => {
    const href = node.getAttribute('href') || '';
    const normalized = href.replace(/[\u0000-\u0020\u007f]/g, '');
    if (/^[a-z][a-z0-9+.-]*:/i.test(normalized) && !/^(https?:|mailto:|tel:)/i.test(normalized)) node.removeAttribute('href');
  });
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  td.use(gfm);
  return td.turndown(doc.body.innerHTML).trim() + '\n';
}
async function docxZip(file) {
  const zip = await JSZip.loadAsync(await bytes(file));
  if (!zip.file('word/document.xml')) throw new Error('Dit bestand is geen geldig Word-document (.docx).');
  const entries = Object.values(zip.files);
  if (entries.length > 5000) throw new Error('Dit Word-document bevat te veel onderdelen voor deze eerste versie.');
  let expanded = 0;
  for (const entry of entries) {
    const length = entry._data?.uncompressedSize || 0;
    if (length > MAX_FILE_BYTES) throw new Error('Een onderdeel van dit document is te groot om veilig te verwerken.');
    expanded += length;
    if (expanded > 100 * 1024 * 1024) throw new Error('Dit Word-document wordt uitgepakt groter dan 100 MB. Kies een kleiner document.');
  }
  return zip;
}
async function readZipText(zip, path) {
  const entry = zip.file(path);
  if (!entry) return null;
  // Avoid decompressing oversized XML parts from untrusted archives.
  if (entry._data?.uncompressedSize > MAX_FILE_BYTES) throw new Error('Een onderdeel van dit document is te groot om veilig te verwerken.');
  return entry.async('string');
}
async function docxMetadata(zip) {
  const rows = [];
  const labels = { title: 'Titel', subject: 'Onderwerp', creator: 'Auteur', lastModifiedBy: 'Laatst gewijzigd door', keywords: 'Trefwoorden', description: 'Beschrijving', created: 'Aangemaakt', modified: 'Gewijzigd', revision: 'Revisie', Company: 'Organisatie', Manager: 'Manager', Application: 'Programma', AppVersion: 'Programmaversie' };
  for (const path of ['docProps/core.xml', 'docProps/app.xml']) {
    const text = await readZipText(zip, path);
    if (!text) continue;
    for (const node of [...xml(text).documentElement.children]) {
      const key = (node.localName || node.nodeName).split(':').pop();
      if (node.textContent.trim()) rows.push({ key: `${path}:${key}`, label: labels[key] || key, value: node.textContent.trim(), removable: false });
    }
  }
  const custom = await readZipText(zip, 'docProps/custom.xml');
  if (custom) for (const node of descendants(xml(custom), 'property')) rows.push({ key: `custom:${node.getAttribute('name')}`, label: `Eigen veld: ${node.getAttribute('name')}`, value: node.textContent, removable: false });
  const comments = await readZipText(zip, 'word/comments.xml');
  if (comments) {
    const nodes = descendants(xml(comments), 'comment');
    if (nodes.length) rows.push({ key: 'comments', label: 'Opmerkingen', value: `${nodes.length} opmerking(en); niet meegenomen in de Markdown-kopie`, removable: false });
  }
  const documentXml = await readZipText(zip, 'word/document.xml');
  if (documentXml) {
    const doc = xml(documentXml);
    const changes = descendants(doc, 'ins').length + descendants(doc, 'del').length;
    if (changes) rows.push({ key: 'trackedChanges', label: 'Bijgehouden wijzigingen', value: `${changes} wijzigingsonderdeel/-delen; controleer de omzetting`, removable: false });
  }
  return rows;
}
export async function inspectMetadata(file) {
  const ext = extension(file.name);
  const warnings = [];
  let rows = [];
  if (['md', 'markdown', 'txt'].includes(ext)) {
    await bytes(file);
    const fm = frontmatter(await file.text());
    if (fm) rows = Object.entries(fm.data).map(([key, value]) => ({ key, label: key, value: stringifyValue(value), removable: true }));
  } else if (ext === 'docx') {
    rows = await docxMetadata(await docxZip(file));
    warnings.push('De oorspronkelijke Word-metadata wordt hier alleen bekeken. Bewaar een Markdown-kopie om de tekst zonder deze documenteigenschappen mee te nemen. Controleer ook de tekst zelf op persoonsgegevens.');
  } else if (ext === 'pdf') {
    const { pdf, task } = await pdfDocument(file);
    try {
      const { info, metadata } = await pdf.getMetadata();
      rows = Object.entries(info || {}).filter(([,value]) => value !== '' && value != null).map(([key,value]) => ({ key, label: key, value: stringifyValue(value), removable: false }));
      if (metadata) for (const [key,value] of Object.entries(metadata.getAll())) rows.push({ key: `xmp:${key}`, label: `XMP: ${key}`, value: stringifyValue(value), removable: false });
      warnings.push('PDF-metadata wordt alleen bekeken. Deze versie maakt geen opgeschoonde PDF en verwijdert geen verborgen tekstlagen uit het origineel.');
    } finally { await releasePdf(task, warnings); }
  } else if (['html', 'htm'].includes(ext)) {
    await bytes(file);
    const doc = parser().parseFromString(await file.text(), 'text/html');
    if (doc.querySelector('title')?.textContent) rows.push({ key: 'title', label: 'Paginatitel', value: doc.querySelector('title').textContent, removable: false });
    rows.push(...[...doc.querySelectorAll('meta[name],meta[property]')].map((node, i) => ({ key: `meta:${i}`, label: node.getAttribute('name') || node.getAttribute('property'), value: node.getAttribute('content') || '', removable: false })));
    warnings.push('HTML-metadata wordt alleen bekeken; bij omzetting worden meta-tags niet meegenomen.');
  } else throw new Error('Metadata controleren werkt in deze versie met Markdown, tekst, HTML, Word (.docx) en PDF.');
  return { rows, warnings };
}
export async function convertFile(file) {
  const ext = extension(file.name);
  if (!EXTENSIONS.has(ext)) throw new Error('Dit bestandstype wordt nog niet ondersteund. Kies .md, .txt, .html, .docx of een PDF met tekst. Audio volgt in een aparte module.');
  const warnings = [];
  let text = '', metadata = [];
  if (['md', 'markdown', 'txt'].includes(ext)) {
    await bytes(file);
    text = await file.text();
    try { metadata = (await inspectMetadata(file)).rows; } catch (error) { warnings.push(error.message); }
  } else if (['html', 'htm'].includes(ext)) {
    await bytes(file);
    text = markdownFromHtml(await file.text());
    metadata = (await inspectMetadata(file)).rows;
    warnings.push('Afbeeldingen zijn vervangen door hun beschrijving. De pagina wordt niet uitgevoerd en externe afbeeldingen worden niet geladen.');
  } else if (ext === 'docx') {
    const zip = await docxZip(file);
    metadata = await docxMetadata(zip);
    const result = await mammoth.convertToHtml({ arrayBuffer: await bytes(file) }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: '', alt: '[Afbeelding uit Word]' })) });
    text = markdownFromHtml(result.value);
    warnings.push(...result.messages.map(message => message.message));
    warnings.push('Controleer tabellen en opmaak. Afbeeldingen en Word-opmerkingen worden niet als losse bestanden meegenomen.');
    if (metadata.some(row => row.key === 'trackedChanges')) warnings.push('Dit document bevat bijgehouden wijzigingen. Controleer het resultaat naast het origineel.');
  } else if (ext === 'pdf') {
    const { pdf, task } = await pdfDocument(file);
    try {
      if (pdf.numPages > 500) throw new Error('Deze PDF heeft meer dan 500 pagina’s. Splits het bestand voor deze eerste versie.');
      const pages = [];
      let emptyPages = 0;
      for (let number = 1; number <= pdf.numPages; number++) {
        const content = await (await pdf.getPage(number)).getTextContent();
        let page = '';
        for (const item of content.items) {
          if (typeof item.str !== 'string') continue;
          page += item.str + (item.hasEOL ? '\n' : ' ');
        }
        if (!page.trim()) emptyPages++;
        pages.push(page.trim());
      }
      if (emptyPages === pdf.numPages) throw new Error('Deze PDF bevat geen uitleesbare tekst. Waarschijnlijk is het een scan. OCR is nog niet beschikbaar; er is geen leeg Markdown-bestand gemaakt.');
      if (emptyPages) warnings.push(`${emptyPages} pagina('s) bevatten geen uitleesbare tekst en ontbreken in de tekstuitvoer. OCR is nog niet beschikbaar.`);
      text = pages.join('\n\n---\n\n') + '\n';
      const { info } = await pdf.getMetadata();
      metadata = Object.entries(info || {}).filter(([,value]) => value !== '' && value != null).map(([key,value]) => ({ key, label: key, value: stringifyValue(value), removable: false }));
      warnings.push('PDF-tekst is uitgelezen. Controleer leesvolgorde, kolommen en tabellen; de oorspronkelijke paginalay-out wordt niet gereconstrueerd.');
    } finally { await releasePdf(task, warnings); }
  }
  return { text, name: safeOutputName(sourceName(file)), warnings: [...new Set(warnings)], metadata };
}
export function stripMarkdownMetadata(text, keys = []) {
  const fm = frontmatter(text);
  if (!fm || !keys.length) return text;
  for (const key of keys) fm.document.delete(key);
  const rest = text.slice(fm.length);
  if (!fm.document.contents?.items?.length) return rest;
  return `---\n${fm.document.toString()}---\n${rest}`;
}
export function cleanupText(text) {
  // Preserve fenced and indented code verbatim, including line endings within code.
  let fenced = null;
  return String(text).split(/(?<=\n)/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenced) {
      if (marker && marker[1][0] === fenced[0] && marker[1].length >= fenced.length && /^ {0,3}(`{3,}|~{3,})[ \t]*(?:\r?\n)?$/.test(line)) fenced = null;
      return line;
    }
    if (marker) { fenced = marker[1]; return line; }
    if (/^(?: {4}|\t)/.test(line)) return line;
    const ending = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
    let body = line.slice(0, line.length - ending.length);
    // Preserve Markdown's two-space hard line break and all leading indentation.
    const hardBreak = / {2,}$/.test(body);
    body = body.replace(/[\t ]+$/, hardBreak ? '  ' : '');
    // Non-breaking spaces are often meaningful inside inline code; leave code spans intact.
    body = body.split(/(`+[^`]*`+)/).map((part,index) => index % 2 ? part : part.replace(/\u00a0/g, ' ')).join('');
    return body + ending;
  }).join('');
}
export function compareTexts(before, after) { return diffLines(String(before), String(after)); }
export function safeOutputName(inputName, suffix = '.md') {
  const safe = String(inputName).replace(/\\/g, '/').split('/').filter(part => part && part !== '.' && part !== '..').map(part => part.replace(/[\u0000-\u001f<>:"|?*]/g, '_').replace(/[. ]+$/, '') || 'document');
  if (!safe.length) safe.push('document');
  safe[safe.length - 1] = safe[safe.length - 1].replace(/\.[^.]+$/, '') + suffix;
  return safe.join('/');
}
export const supportedExtensions = [...EXTENSIONS];

// Quote plain YAML string values after masking so [xxx] stays text, not a YAML list.
export function quoteMaskedMetadata(text, marker = '[xxx]') {
  const match = String(text).match(/^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
  if (!match) return text;
  const yaml = match[1].split('\n').map(line => {
    const pair = line.match(/^(\s*[^:#][^:]*:\s*)(.*)$/);
    if (!pair || !pair[2].includes(marker)) return line;
    const value = pair[2].trim();
    if (!value.startsWith(marker)) return line;
    return pair[1] + JSON.stringify(value);
  }).join('\n');
  const start = match[0].indexOf(match[1]);
  return text.slice(0,start)+yaml+text.slice(start+match[1].length);
}

/** Combine complete converted sources in the requested order, without changing originals. */
export function mergeDocuments(documents, title = 'Samengevoegde documenten') {
  if (!Array.isArray(documents) || documents.length < 2) throw new Error('Kies minimaal twee documenten om samen te voegen.');
  const escapeHeading = value => String(value).replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]<>#|]/g, '\\$&');
  const sections = documents.map(doc => {
    if (typeof doc.text !== 'string' || !doc.text.trim()) throw new Error('Een document bevat geen tekst: ' + doc.path);
    const fm = doc.text.match(/^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
    let body = fm ? doc.text.slice(fm[0].length) : doc.text;
    const heading = body.match(/^ {0,3}# +(.+?)(?: +#+)?[ \t]*$/m)?.[1] || String(doc.path).split('/').pop().replace(/\.[^.]+$/, '');
    // Keep each source's Markdown untouched, including headings and code fences.
    // Metadata becomes a visible quoted block rather than second frontmatter.
    let metadata = '';
    if (fm) {
      const max = Math.max(2,...[...fm[1].matchAll(/`+/g)].map(m=>m[0].length));
      const fence = '`'.repeat(max+1);
      metadata = '**Bronmetadata**\n\n'+fence+'yaml\n'+fm[1]+'\n'+fence+'\n\n';
    }
    return '## '+escapeHeading(heading)+'\n\nBronbestand: '+escapeHeading(doc.path)+'\n\n'+metadata+body.replace(/^\uFEFF/,'').trim()+'\n';
  });
  return '# '+escapeHeading(title.trim() || 'Samengevoegde documenten')+'\n\n'+sections.join('\n---\n\n');
}
