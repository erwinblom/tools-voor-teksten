import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser as LinkeDOMParser } from 'linkedom';
import { convertFile, inspectMetadata, stripMarkdownMetadata, cleanupText, compareTexts, safeOutputName } from '../src/core.js';
// linkedom does not insert html/body around fragments like a native browser
// DOMParser does. Emulate that standard behavior for Mammoth HTML fragments.
globalThis.DOMParser = class extends LinkeDOMParser {
  parseFromString(source, mime) {
    if (mime === 'text/html' && !/<html[\s>]/i.test(source)) source = '<html><head></head><body>' + source + '</body></html>';
    return super.parseFromString(source, mime);
  }
};

const file = (text, name, type = 'text/plain') => new File([text], name, { type });
test('plain-text import preserves content and safe relative output location', async () => {
  const source = file('# Bron\n\nEén passage.\n', 'bron.txt');
  Object.defineProperty(source, 'webkitRelativePath', { value: 'Beleid/bron.txt' });
  const result = await convertFile(source);
  assert.equal(result.text, '# Bron\n\nEén passage.\n');
  assert.equal(result.name, 'Beleid/bron.md');
  assert.equal(await source.text(), result.text);
});
test('selected YAML fields disappear while other metadata and body survive', async () => {
  const text = '---\ntitle: Beleid\nauthor: Eva\nproject: Gemeente\n---\n# Beleid\n\nTekst.\n';
  const metadata = await inspectMetadata(file(text, 'beleid.md'));
  assert.deepEqual(metadata.rows.map(row => row.key), ['title', 'author', 'project']);
  const output = stripMarkdownMetadata(text, ['author']);
  assert(!output.includes('Eva'));
  assert(output.includes('title: Beleid'));
  assert(output.endsWith('# Beleid\n\nTekst.\n'));
  assert.equal(stripMarkdownMetadata(text, ['title', 'author', 'project']), '# Beleid\n\nTekst.\n');
});
test('invalid metadata cannot be silently removed', () => {
  assert.throws(() => stripMarkdownMetadata('---\na: [\n---\nBody', ['a']), /YAML/);
});
test('cleanup preserves code, paragraphs and Markdown hard line breaks', () => {
  const source = '# Titel \n\nRegel  \nvolgende\t\n\n```python\n  print(" x ")   \n```\n\n    code  \n';
  const expected = '# Titel\n\nRegel  \nvolgende\n\n```python\n  print(" x ")   \n```\n\n    code  \n';
  assert.equal(cleanupText(source), expected);
  assert.equal(cleanupText('`a\u00a0b` en\u00a0woord'), '`a\u00a0b` en woord');
});
test('diff reports additions and removals rather than positional guesses', () => {
  const parts = compareTexts('Een\nTwee\nDrie\n', 'Een\nNieuw\nTwee\nDrie\n');
  assert.equal(parts.filter(part => part.added).map(part => part.value).join(''), 'Nieuw\n');
  assert.equal(parts.filter(part => part.removed).length, 0);
});
test('HTML becomes semantic Markdown without executable or tracking markup', async () => {
  const html = '<html><head><title>Bron</title><meta name="author" content="Eva"></head><body><h1>Besluit</h1><p>Lees <a href="https://example.org/bron">de bron</a>.</p><script>window.pwned=1</script><img src="https://tracker.invalid/pixel" alt="Schema"><p><a href="javascript:alert(1)">Fout</a></p><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></body></html>';
  const result = await convertFile(file(html, 'bron.html', 'text/html'));
  assert(result.text.includes('# Besluit'));
  assert(result.text.includes('[de bron](https://example.org/bron)'));
  assert(result.text.includes('Schema'));
  assert(result.text.includes('| A | B |'));
  assert(!result.text.includes('tracker.invalid'));
  assert(!result.text.includes('javascript:'));
  assert(!result.text.includes('window.pwned'));
  assert(result.metadata.some(row => row.value === 'Eva'));
});
async function wordFixture() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Besluit</w:t></w:r></w:p><w:p><w:r><w:t>Dit is de tekst.</w:t></w:r></w:p></w:body></w:document>');
  zip.file('docProps/core.xml', '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Eva Test</dc:creator><dc:title>Concept</dc:title></cp:coreProperties>');
  zip.file('docProps/app.xml', '<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>Gemeente Voorbeeld</Company></Properties>');
  zip.file('word/comments.xml', '<?xml version="1.0"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="1" w:author="Eva"><w:p><w:r><w:t>Privé notitie</w:t></w:r></w:p></w:comment></w:comments>');
  return new File([await zip.generateAsync({ type: 'uint8array' })], 'beleid.docx');
}
test('real DOCX archive converts body and exposes author, organisation and comments', async () => {
  const source = await wordFixture();
  const original = await source.arrayBuffer();
  const result = await convertFile(source);
  assert(result.text.includes('Besluit'));
  assert(result.text.includes('Dit is de tekst.'));
  assert(!result.text.includes('Privé notitie'));
  assert(result.metadata.some(row => row.value === 'Eva Test' && !row.removable));
  assert(result.metadata.some(row => row.value === 'Gemeente Voorbeeld'));
  assert(result.metadata.some(row => row.key === 'comments'));
  assert.deepEqual(new Uint8Array(await source.arrayBuffer()), new Uint8Array(original));
});
test('reject unsupported and invalid DOCX instead of returning fake Markdown', async () => {
  await assert.rejects(convertFile(file('x', 'foto.png')), /niet ondersteund/);
  await assert.rejects(convertFile(file('x', 'fout.docx')));
});
test('safe names keep structure and cannot traverse directories', () => {
  assert.equal(safeOutputName('../../Beleid/nota.docx'), 'Beleid/nota.md');
  assert.equal(safeOutputName('A\\B\\nota.pdf'), 'A/B/nota.md');
  assert.equal(safeOutputName('a:b?.txt'), 'a_b_.md');
});


test('merge preserves metadata, original titles and code in ordered sections',async()=>{
 const {mergeDocuments}=await import('../src/core.js');
 const first='---\ntitle: Bron A\nauthor: Eva\n---\n# Eigen titel\n\n```js\nconst x = "# origineel";\n```\n';
 const out=mergeDocuments([{path:'Map/a.md',text:first},{path:'b.txt',text:'Tweede bron.\n'}],'Dossier');
 assert(out.startsWith('# Dossier\n'));assert(out.includes('Bronbestand: Map/a.md'));assert(out.includes('```yaml\ntitle: Bron A\nauthor: Eva\n```'));
 assert(out.includes('# Eigen titel'));assert(out.includes('```js\nconst x = "# origineel";\n```'));assert(out.indexOf('Map/a.md')<out.indexOf('b.txt'));
 assert.equal(first,'---\ntitle: Bron A\nauthor: Eva\n---\n# Eigen titel\n\n```js\nconst x = "# origineel";\n```\n');
 assert.throws(()=>mergeDocuments([{path:'leeg',text:''},{path:'b',text:'x'}]),/geen tekst/);
});
