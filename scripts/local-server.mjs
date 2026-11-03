#!/usr/bin/env node
// Read-only static server for the portable download. User documents never reach it.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {dirname,resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const args=process.argv.slice(2);
const rootFlag=args.indexOf('--root');
const root=await realpath(rootFlag>=0?resolve(args[rootFlag+1]):resolve(dirname(fileURLToPath(import.meta.url)),'../app'));
const indexInfo=await stat(resolve(root,'index.html'));
if(!indexInfo.isFile())throw new Error('De appmap bevat geen index.html. Pak het hele downloadpakket opnieuw uit.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.wasm':'application/wasm','.bin':'application/octet-stream','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.webmanifest':'application/manifest+json'};
function reply(res,status,text){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(text);}
let port;
const server=createServer(async(req,res)=>{
  if(req.headers.host!==`127.0.0.1:${port}`){reply(res,403,'Alleen lokale toegang is toegestaan.');return;}
  if(!['GET','HEAD'].includes(req.method)){reply(res,405,'Deze appserver leest alleen appbestanden.');return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname.includes('\0')||pathname.includes('\\')){reply(res,400,'Ongeldig pad.');return;}
    const requested=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(requested!==root&&!requested.startsWith(root+sep)){reply(res,403,'Buiten de appmap.');return;}
    const actual=await realpath(requested);
    if(actual!==root&&!actual.startsWith(root+sep)){reply(res,403,'Buiten de appmap.');return;}
    const info=await stat(actual);
    if(!info.isFile()){reply(res,404,'Appbestand niet gevonden.');return;}
    res.writeHead(200,{'Content-Type':types[extname(actual).toLowerCase()]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(actual);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch(error){reply(res,error instanceof URIError?400:404,'Appbestand niet gevonden.');}
});
server.on('error',error=>{console.error('Tools voor Teksten kon niet starten:',error.message);process.exitCode=1;});
server.listen(0,'127.0.0.1',()=>{
  port=server.address().port;
  const url=`http://127.0.0.1:${port}/`;
  console.log(`TOOLS_VOOR_TEKSTEN_URL=${url}`);
  console.log('\nTools voor Teksten draait lokaal op je Mac.');
  console.log('Laat dit Terminal-venster open zolang je de tool gebruikt.');
  console.log('Stoppen: download eerst je resultaten en druk hier op Ctrl+C.\n');
  if(!args.includes('--no-open')){
    const opener=spawn('/usr/bin/open',[url],{stdio:'ignore'});
    opener.on('error',()=>console.log('Open dit adres zelf in je browser:',url));
  }
});
function stop(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),2000).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
