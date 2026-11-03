#!/usr/bin/env node
/** Reproducible inputs, explicit allowlist, official verified runtime, no local settings. */
import {readFile,writeFile,mkdir,rm,cp,chmod,stat,readdir,rename} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run=promisify(execFile);
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const get=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const packageInfo=JSON.parse(await readFile(join(project,'package.json'),'utf8'));
const version=get('--version',packageInfo.version);
if(!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version))throw Error('Ongeldige versie.');
const output=resolve(get('--output',join(project,'outputs')));
const runtimeVersion='v26.13.0';
const runtimeArchive=`node-${runtimeVersion}-darwin-arm64.tar.gz`;
const runtimeSha='d38bd5e5a2ddce6bbb5ce45e46e208337da4d51fffe611e567fd32073d6439f6';
const runtimeUrl=`https://nodejs.org/dist/${runtimeVersion}/${runtimeArchive}`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
await stat(join(project,'dist/index.html'));
for(const required of ['LEESMIJ.md','LICENSE','THIRD_PARTY_NOTICES.md','MERKVOORWAARDEN.md','assets/app-icon.svg','assets/app-icon.png','assets/app-icon.icns','dist/app.webmanifest'])await stat(join(project,required));
await mkdir(output,{recursive:true});
const cache=join(output,'runtime-cache');await mkdir(cache,{recursive:true});
const archived=join(cache,runtimeArchive);
let archive;
try{archive=await readFile(archived);}catch{}
if(!archive||hash(archive)!==runtimeSha){
  console.log('Officiële Mac-runtime downloaden:',runtimeVersion);
  const response=await fetch(runtimeUrl);if(!response.ok)throw Error(`Runtime downloaden: HTTP ${response.status}`);
  archive=Buffer.from(await response.arrayBuffer());
  if(hash(archive)!==runtimeSha)throw Error('Runtime-checksum wijkt af. Download niet gebruikt.');
  await writeFile(archived,archive);
}
const nodeTop=`node-${runtimeVersion}-darwin-arm64`;
const extracted=join(cache,nodeTop);
await rm(extracted,{recursive:true,force:true});
await run('/usr/bin/tar',['-xzf',archived,'-C',cache,`${nodeTop}/bin/node`,`${nodeTop}/LICENSE`]);
const sourceNode=join(extracted,'bin/node');
const {stdout:binaryVersion}=await run(sourceNode,['--version']);
if(binaryVersion.trim()!==runtimeVersion)throw Error('Verkeerde runtimeversie na uitpakken.');
const folderName=`Tools-voor-Teksten-${version}-mac-arm64`;
const staging=join(output,'mac-staging',folderName);
await rm(staging,{recursive:true,force:true});await mkdir(join(staging,'runtime'),{recursive:true});
await cp(join(project,'dist'),join(staging,'app'),{recursive:true});
await cp(sourceNode,join(staging,'runtime/node'));await chmod(join(staging,'runtime/node'),0o755);
await cp(join(extracted,'LICENSE'),join(staging,'runtime/LICENSE-Node.txt'));
await cp(join(project,'scripts/local-server.mjs'),join(staging,'runtime/local-server.mjs'));
await cp(join(project,'scripts/start-mac.command'),join(staging,'Start.command'));await chmod(join(staging,'Start.command'),0o755);
for(const name of ['LEESMIJ.md','LICENSE','THIRD_PARTY_NOTICES.md','MERKVOORWAARDEN.md'])await cp(join(project,name),join(staging,name));
for(const name of ['assets','THIRD_PARTY_LICENSES']){
 try{await cp(join(project,name),join(staging,name),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
}
// Dist is a static build only: none of the personal Sites identity or source checkout is copied.
const manifest=[];
async function inventory(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const rel=prefix+entry.name,full=join(dir,entry.name);
  if(entry.isSymbolicLink())throw Error('Onverwachte symlink in pakket: '+rel);
  if(entry.isDirectory())await inventory(full,rel+'/');
  else{const b=await readFile(full);manifest.push({path:rel,bytes:b.length,sha256:hash(b)});}
 }
}
await inventory(staging);
const forbidden=manifest.filter(x=>/(^|\/)(\.git|\.openai|\.env|node_modules|CHECKER\.md|VERIFICATIE\.json|outputs)(\/|$)/i.test(x.path));
if(forbidden.length)throw Error('Niet voor download bestemde bestanden: '+forbidden.map(x=>x.path).join(', '));
const provenance={version,platform:'darwin-arm64',minimumMacOS:'13.5',runtime:{version:runtimeVersion,url:runtimeUrl,archiveSha256:runtimeSha,binarySha256:hash(await readFile(sourceNode)),license:'runtime/LICENSE-Node.txt'},files:manifest};
await writeFile(join(staging,'PAKKET.json'),JSON.stringify(provenance,null,2)+'\n');
const zip=join(output,`${folderName}.zip`);
await rm(zip,{force:true});
await run('/usr/bin/ditto',['-c','-k','--keepParent','--norsrc','--noextattr',staging,zip],{maxBuffer:1024*1024});
const zipHash=hash(await readFile(zip));
await writeFile(zip+'.sha256',`${zipHash}  ${folderName}.zip\n`);
const result={version,zip,sha256:zipHash,bytes:(await stat(zip)).size,staging,runtimeVersion,minimumMacOS:'13.5',fileCount:manifest.length+1};
await writeFile(join(output,'MAC-PAKKET.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
