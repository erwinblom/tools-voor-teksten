import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';

async function fixture(){
 const work=await mkdtemp(join(tmpdir(),'tvt-server-test-'));
 const root=join(work,'app');await mkdir(root);
 await writeFile(join(root,'index.html'),'<h1>Lokale tool</h1>');await writeFile(join(root,'runtime.wasm-gzip.bin'),Buffer.from([1,2,3]));
 await writeFile(join(work,'private.txt'),'Niet uitleveren');await symlink(join(work,'private.txt'),join(root,'escape.txt'));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/local-server.mjs',import.meta.url)),'--root',root,'--no-open'],{stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stderr.on('data',b=>stderr+=b);
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startte niet: '+stderr)),5000);child.stdout.on('data',b=>{stdout+=b;const found=stdout.match(/TOOLS_VOOR_TEKSTEN_URL=(http:\/\/127\.0\.0\.1:\d+\/)/);if(found){clearTimeout(timer);resolve(found[1]);}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Server stopte: '+code+' '+stderr));});});
 return {url,root,work,close:async()=>{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));await rm(work,{recursive:true,force:true});}};
}
function request(url,path='/',method='GET',host){
 const u=new URL(url);return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port:u.port,path,method,headers:{host:host||u.host}},res=>{const body=[];res.on('data',b=>body.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(body)}));});req.on('error',reject);req.end();});
}
test('local download server serves app bytes and opaque WASM without content encoding',async()=>{
 const server=await fixture();try{const index=await request(server.url);assert.equal(index.status,200);assert.equal(index.body.toString(),'<h1>Lokale tool</h1>');const wasm=await request(server.url,'/runtime.wasm-gzip.bin');assert.equal(wasm.headers['content-type'],'application/octet-stream');assert.equal(wasm.headers['content-encoding'],undefined);assert.deepEqual(wasm.body,Buffer.from([1,2,3]));}finally{await server.close();}
});
test('local download server rejects foreign host, uploads, traversal and escaping symlinks',async()=>{
 const server=await fixture();try{assert.equal((await request(server.url,'/','GET','evil.example')).status,403);assert.equal((await request(server.url,'/','POST')).status,405);assert.equal((await request(server.url,'/escape.txt')).status,403);for(const path of ['/%2e%2e/private.txt','/%2e%2e%2fprivate.txt','/../private.txt','/%00','/missing']){const r=await request(server.url,path);assert.notEqual(r.status,200,path);assert(!r.body.includes(Buffer.from('Niet uitleveren')));}}finally{await server.close();}
});
