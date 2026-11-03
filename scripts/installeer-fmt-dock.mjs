import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const defs=[['Werkplaats','werkplaats',['Werkplaats','FMT Werkplaats']],['Tools voor Teksten','tools-voor-teksten',['Tools voor Teksten','Tool voor Teksten']],['Kladblok','kladblok',['FMT Kladblok','Kladblok']],['Video Editor','video',['FMT Video Editor','FMT Editor','Video Editor']],['Screenshot Editor','screenshot',['FMT Screenshot','FMT Screenshot Editor','Screenshot Editor']]];
const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function matchApp(name){return defs.find(d=>d[2].some(n=>normalize(n)===normalize(name.replace(/\.app$/i,''))))?.[1]??null;}
export function reorderDock(tiles,apps){const targets=new Set(Object.values(apps).map(canonicalPath));const keep=tiles.filter(t=>!matchApp(t['tile-data']?.['file-label']??'')&&!targets.has(canonicalPath(urlPath(t))));const add=defs.map(([name,key])=>({'tile-data':{'file-data':{'_CFURLString':pathToFileURL(apps[key]+path.sep).href,'_CFURLStringType':15},'file-label':name},'tile-type':'file-tile'}));return [...keep.slice(0,1),...add,...keep.slice(1)];}
function run(cmd,args,input){const r=spawnSync(cmd,args,{input,encoding:'utf8'});if(r.status!==0)throw Error(`${path.basename(cmd)}: ${(r.stderr||r.error?.message||'bewerking mislukt').trim()}`);return r.stdout;}
function plist(json){return run('/usr/bin/plutil',['-convert','xml1','-o','-','--','-'],JSON.stringify(json));}
function readPlist(file){return JSON.parse(run('/usr/bin/plutil',['-convert','json','-o','-','--',file]));}
function urlPath(t){try{return fileURLToPath(t['tile-data']['file-data']._CFURLString).replace(/\/$/,'');}catch{return null;}}
function findApps(tiles,home){const found={};for(const t of tiles){const key=matchApp(t['tile-data']?.['file-label']??'');const p=urlPath(t);if(key&&p&&fs.existsSync(path.join(p,'Contents/Info.plist')))found[key]=p;}
 const visit=(dir,depth)=>{if(depth<0||!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const p=path.join(dir,e.name);if(e.name.endsWith('.app')){const k=matchApp(e.name);if(k&&!found[k]&&fs.existsSync(path.join(p,'Contents/Info.plist')))found[k]=p;}else if(e.isDirectory()&&depth>0)visit(p,depth-1);}};
 for(const d of [path.join(home,'Applications'),'/Applications',path.join(home,'Desktop')])visit(d,3);return found;}
function canonicalPath(p){if(!p)return null;try{return fs.realpathSync(p);}catch{return path.resolve(p);}}
function checkAppPaths(app){
 if(fs.lstatSync(app).isSymbolicLink())throw Error('App is een symbolische link: '+app);
 const root=fs.realpathSync(app);
 for(const relative of ['Contents','Contents/Info.plist','Contents/Resources']){const p=path.join(app,relative),stat=fs.lstatSync(p,{throwIfNoEntry:false});if(stat?.isSymbolicLink())throw Error('Symbolische link verhindert betrouwbaar herstel: '+p);if(stat&&!fs.realpathSync(p).startsWith(root+path.sep))throw Error('Pad buiten app: '+p);}
 const info=readPlist(path.join(app,'Contents/Info.plist'));let icon=info.CFBundleIconFile||'FMT-App.icns';if(!path.extname(icon))icon+='.icns';if(path.basename(icon)!==icon)throw Error('Onverwacht icoonpad: '+app);
 const iconPath=path.join(app,'Contents/Resources',icon);if(fs.lstatSync(iconPath,{throwIfNoEntry:false})?.isSymbolicLink())throw Error('Icoon is een symbolische link: '+iconPath);
}
function writeDock(tiles){run('/usr/bin/defaults',['write','com.apple.dock','persistent-apps','-array',...tiles.map(plist)]);}
function main(){if(os.platform()!=='darwin'||os.arch()!=='arm64')throw Error('Dit pakket is voor een Mac met Apple Silicon.');
 const home=os.homedir(),xml=run('/usr/bin/defaults',['export','com.apple.dock','-']);const prefs=JSON.parse(run('/usr/bin/plutil',['-convert','json','-o','-','--','-'],xml));const tiles=prefs['persistent-apps']??[];const apps=findApps(tiles,home);
 const missing=defs.filter(([,k])=>k!=='tools-voor-teksten'&&!apps[k]);if(missing.length)throw Error('Niet gevonden: '+missing.map(d=>d[0]).join(', ')+'. Er is niets gewijzigd. Zet deze bestaande apps in Programma’s of in je Dock en probeer opnieuw.');
 for(const [,key]of defs){const f=path.join(here,'iconen',`fmt-${key}.icns`);if(!fs.existsSync(f))throw Error('Pak de hele ZIP uit; icoon ontbreekt: '+key);}
 for(const app of Object.values(apps))checkAppPaths(app);
 console.log('Gevonden:');for(const [name,key]of defs)console.log(' • '+name+': '+(apps[key]??'nieuwe online snelkoppeling'));
 if(process.argv.includes('--controle')){console.log('Alleen gecontroleerd. Niets gewijzigd.');return;}
 const backup=path.join(home,'Library/Application Support/FMT/Iconen-herstel',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.writeFileSync(path.join(backup,'dock-persistent-apps.json'),JSON.stringify(tiles,null,2));const changed=[];let created=null;
 try{
 for(const [,key]of defs){const app=apps[key];if(app)fs.cpSync(app,path.join(backup,key+'.app'),{recursive:true,verbatimSymlinks:true});}
 for(const [name,key]of defs){let app=apps[key];if(!app){app=path.join(home,'Applications','Tools voor Teksten.app');if(fs.existsSync(app))throw Error('Er bestaat al een andere Tools voor Teksten.app; die wordt niet overschreven.');created=app;fs.mkdirSync(path.join(app,'Contents/MacOS'),{recursive:true});fs.mkdirSync(path.join(app,'Contents/Resources'));fs.writeFileSync(path.join(app,'Contents/MacOS/start'),'#!/bin/sh\nexec /usr/bin/open https://tools-voor-teksten-fmt.erwinblom.chatgpt.site/\n',{mode:0o755});fs.writeFileSync(path.join(app,'Contents/Info.plist'),plist({CFBundleName:name,CFBundleDisplayName:name,CFBundleIdentifier:'nl.fastmovingtargets.toolsvoorteksten.online',CFBundleVersion:'1',CFBundlePackageType:'APPL',CFBundleExecutable:'start',CFBundleIconFile:'FMT-App.icns'}));apps[key]=app;}
 else{changed.push([key,app]);}
 const infoPath=path.join(app,'Contents/Info.plist'),info=readPlist(infoPath);let icon=info.CFBundleIconFile||'FMT-App.icns';if(!path.extname(icon))icon+='.icns';if(path.basename(icon)!==icon)throw Error('Onverwacht icoonpad in '+name);const resources=path.join(app,'Contents/Resources');fs.mkdirSync(resources,{recursive:true});fs.copyFileSync(path.join(here,'iconen',`fmt-${key}.icns`),path.join(resources,icon));if(!info.CFBundleIconFile){info.CFBundleIconFile=icon;fs.writeFileSync(infoPath,plist(info));}
 run('/usr/bin/codesign',['--force','--sign','-','--preserve-metadata=identifier,entitlements,requirements,flags,runtime',app]);run('/usr/bin/codesign',['--verify','--strict',app]);run('/usr/bin/touch',[app]);}
 writeDock(reorderDock(tiles,apps));fs.writeFileSync(path.join(backup,'apps.json'),JSON.stringify(apps,null,2));try{run('/usr/bin/killall',['Dock']);}catch(e){console.warn('Dock is opgeslagen, maar kon niet worden vernieuwd: '+e.message+'. Log uit en opnieuw in om de wijziging te zien.');}console.log('\nKlaar: alle vijf staan in je Dock. Tools voor Teksten opent de online versie.');console.log('Herstelkopie: '+backup);
 }catch(e){const errors=[];for(const [key,app]of changed.reverse()){try{fs.rmSync(app,{recursive:true,force:true});fs.cpSync(path.join(backup,key+'.app'),app,{recursive:true,verbatimSymlinks:true});}catch(r){errors.push(app+': '+r.message);}}if(created)try{fs.rmSync(created,{recursive:true,force:true});}catch(r){errors.push(created+': '+r.message);}try{writeDock(tiles);}catch(r){errors.push('Dock: '+r.message);}throw Error('Installatie afgebroken: '+e.message+'\n'+(errors.length?'Herstel niet volledig gelukt:\n'+errors.join('\n'):'Herstelbewerkingen voor bestaande apps en Dock zijn uitgevoerd.')+'\nHerstelkopie: '+backup);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(e){console.error('\n'+e.message);process.exitCode=1;}}
