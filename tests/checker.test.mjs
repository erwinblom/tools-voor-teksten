import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import JSZip from 'jszip';
import * as core from '../src/core.js';
import * as models from '../src/models.js';

async function ui(overrides={}) {
  const {window,document}=parseHTML('<html><head></head><body><div id="app"></div></body></html>');
  window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','')};
  window.HTMLElement.prototype.close=function(){this.removeAttribute('open')};
  const context=vm.createContext({document,window,console,crypto,File,Blob,URL,setTimeout,clearTimeout,JSZip,...core,...models,...overrides,prompt:()=>null});
  const source=(await readFile(new URL('../src/main.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  vm.runInContext(source,context);
  return {document,window,run:code=>vm.runInContext(code,context),context};
}

test('Checker: stale async PII results cannot redact a changed source', async()=>{
  let finish;
  const app=await ui({detectPersonalData:()=>new Promise(resolve=>{finish=resolve})});
  app.context.sourceFile=new File(['Contact Eva.'],'bron.md');
  await app.run('addFiles([sourceFile])');
  await app.run("openTool('redact')");
  const pending=app.run('scan()');
  assert.equal(app.document.querySelector('#source-text').disabled,true);
  const textarea=app.document.querySelector('#source-text');
  textarea.value='XContact Eva.';
  textarea.dispatchEvent(new app.window.Event('input'));
  finish({entities:[{id:'eva',start:8,end:11,text:'Eva',label:'GIVEN_NAME',confidence:1}]});
  await pending;
  assert.equal(app.run('entities.length'),0);
  assert.equal(app.run('redactedText()'),'XContact Eva.');
  assert.match(app.document.querySelector('#model-progress').textContent,/gewijzigd/);
});

test('Checker: stale span cannot be used by the real UI save preview',async()=>{
  const app=await ui();
  app.run("sourceText='Eva'; entities=[{start:0,end:3,text:'Jan',checked:true}]");
  assert.throws(()=>app.run('redactedText()'),/gewijzigd/);
});

test('Checker: results keep relative paths and disambiguate repeated conversions',async()=>{
  const app=await ui();
  app.run("addOutput('one','Dossier/bron.docx','Naar Markdown');addOutput('two','Dossier/bron.pdf','Naar Markdown')");
  assert.deepEqual(Array.from(app.run('outputs.map(o=>o.name)')),['Dossier/bron.md','Dossier/bron-2.md']);
});

test('Checker: metadata remains inspectable when a scan has no text layer',async()=>{
  const app=await ui({convertFile:async()=>{throw Error('geen uitleesbare tekst')},inspectMetadata:async()=>({rows:[{key:'Author',label:'Auteur',value:'Eva Test',removable:false}],warnings:[]})});
  app.context.sourceFile=new File(['fake PDF bytes'],'scan.pdf');
  await app.run('addFiles([sourceFile])');
  await app.run("openTool('metadata')");
  assert.match(app.document.querySelector('#work-body').textContent,/Eva Test/);
  assert.match(app.document.querySelector('#work-body').textContent,/geen uitleesbare tekst/);
  assert.equal(app.document.querySelector('[data-act="save-metadata"]').disabled,true);
});

test('Checker: incomplete folder selection is explicitly reported at 200 files',async()=>{
  const app=await ui();
  app.context.manyFiles=Array.from({length:201},(_,i)=>new File(['x'],`file-${i}.md`));
  await app.run('addFiles(manyFiles)');
  assert.equal(app.run('files.length'),200);
  assert.match(app.document.querySelector('#status').textContent,/onvolledig/);
});

test('Checker: older async document read cannot replace a newer file',async()=>{
  let finishOld;
  const app=await ui({convertFile:f=>f.name==='oud.md'?new Promise(resolve=>{finishOld=resolve}):Promise.resolve({text:'Nieuw bestand',warnings:[],metadata:[]})});
  app.context.inputFiles=[new File(['oud'],'oud.md'),new File(['nieuw'],'nieuw.md')];
  await app.run('addFiles(inputFiles)');
  const old=app.run("openTool('redact')");
  await app.run('currentIndex=1;openDocument()');
  finishOld({text:'Oud bestand',warnings:[],metadata:[]});
  await old;
  assert.equal(app.run('sourceText'),'Nieuw bestand');
  assert.match(app.document.querySelector('#work-body').textContent,/Nieuw bestand/);
});

test('Checker: switching to conversion invalidates a pending document read',async()=>{
  let finish;
  const app=await ui({convertFile:()=>new Promise(resolve=>{finish=resolve})});
  app.context.sourceFile=new File(['bron'],'bron.md');
  await app.run('addFiles([sourceFile])');
  const old=app.run("openTool('redact')");
  app.document.querySelector('[data-act="close-tool"]').click();
  await app.run("openTool('convert')");
  finish({text:'Oude inhoud',warnings:[],metadata:[]});
  await old;
  assert(app.document.querySelector('[data-act="convert"]'));
  assert.equal(app.document.querySelector('#source-text'),null);
});


test('merge: chosen order and title survive reordering and every source is included',async()=>{
 const app=await ui();app.context.inputFiles=[new File(['# Een\n\nInhoud A.'],'een.md'),new File(['# Twee\n\nInhoud B.'],'twee.md')];
 await app.run('addFiles(inputFiles)');await app.run("openTool('merge')");
 app.document.querySelector('#merge-title').value='Mijn dossier';
 app.document.querySelector('[data-act="merge-down"]').click();
 assert.equal(app.document.querySelector('#merge-title').value,'Mijn dossier');
 await app.run('runMerge()');
 const text=app.run('outputs[0].text');
 assert(text.startsWith('# Mijn dossier'));assert(text.indexOf('Bronbestand: twee.md')<text.indexOf('Bronbestand: een.md'));
 assert(text.includes('Inhoud A.')&&text.includes('Inhoud B.'));
 assert.equal(app.run('outputs.length'),1);assert.equal(app.document.querySelector('#merge-title').disabled,false);
});
test('merge: failed conversion never creates a partial output',async()=>{
 const app=await ui({convertFile:async f=>{if(f.name==='fout.pdf')throw Error('Geen tekstlaag');return {text:'Goed',warnings:[]}}});
 app.context.inputFiles=[new File(['goed'],'goed.txt'),new File(['pdf'],'fout.pdf')];
 await app.run('addFiles(inputFiles)');await app.run("openTool('merge')");await app.run('runMerge()');
 assert.equal(app.run('outputs.length'),0);assert.match(app.document.querySelector('#merge-log').textContent,/fout.pdf/);
 assert.match(app.document.querySelector('#merge-log').textContent,/geen gedeeltelijk bestand/);
});
test('merge: a single selected file cannot start merging',async()=>{
 const app=await ui();app.context.sourceFile=new File(['tekst'],'een.txt');await app.run('addFiles([sourceFile])');await app.run("openTool('merge')");
 assert.equal(app.document.querySelector('[data-act="merge"]').disabled,true);await app.run('runMerge()');assert.equal(app.run('outputs.length'),0);
});

test('model download gates editing until recognition succeeds, and failure keeps editing locked',async()=>{
  let fail=true;
  const app=await ui({detectPersonalData:async()=>{if(fail)throw Error('download onderbroken');return {entities:[]}}});
  app.context.sourceFile=new File(['Contact Eva.'],'bron.txt');
  await app.run('addFiles([sourceFile])');await app.run("openTool('redact')");
  assert.equal(app.document.querySelector('#source-text').hasAttribute('readonly'),true);
  assert.equal(app.document.querySelector('[data-act="manual-selection"]').disabled,true);
  assert.match(app.document.querySelector('.model-gate').textContent,/pas als het model volledig/);
  await app.run('scan()');
  assert.equal(app.document.querySelector('#source-text').readOnly,true);
  assert.match(app.document.querySelector('#model-progress').textContent,/alleen-lezen/);
  fail=false;await app.run('scan()');
  assert.equal(app.document.querySelector('#source-text').hasAttribute('readonly'),false);
  assert.equal(app.document.querySelector('#source-text').readOnly,false);
  assert.equal(app.document.querySelector('[data-act="manual-selection"]').disabled,false);
  assert.match(app.document.querySelector('.model-gate').textContent,/Model klaar/);
});
