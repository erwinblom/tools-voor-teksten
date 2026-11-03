import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest={name:'Tools voor Teksten',short_name:'Teksttools',start_url:'./',display:'standalone',background_color:'#ffffff',theme_color:'#ffffff',icons:[{src:'app-icon-192.png',sizes:'192x192',type:'image/png'},{src:'app-icon-512.png',sizes:'512x512',type:'image/png'}]};
for(const dir of ['public','public-web']){
 await mkdir(join(root,dir),{recursive:true});
 for(const name of ['app-icon.svg','app-icon-32.png','app-icon-192.png','app-icon-512.png'])await copyFile(join(root,'assets',name),join(root,dir,name));
 await writeFile(join(root,dir,'app.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
}
