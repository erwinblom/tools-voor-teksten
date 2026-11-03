// Real input documents, bundled with the app; no document is fetched externally.
export const exampleDocuments = [
 {name:'Interview.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',url:new URL('../examples/Interview.docx',import.meta.url).href},
 {name:'Beleidsnotitie.pdf',type:'application/pdf',url:new URL('../examples/Beleidsnotitie.pdf',import.meta.url).href},
 {name:'Informatiepagina.html',type:'text/html',url:new URL('../examples/Informatiepagina.html',import.meta.url).href},
 {name:'Voorstel.txt',type:'text/plain',url:new URL('../examples/Voorstel.txt',import.meta.url).href},
 {name:'Voorstel-herzien.txt',type:'text/plain',url:new URL('../examples/Voorstel-herzien.txt',import.meta.url).href},
];
export async function getExampleFiles(){
 return Promise.all(exampleDocuments.map(async ({name,type,url})=>{
  const response=await fetch(url);
  if(!response.ok)throw Error('Het voorbeeld '+name+' kon niet worden geladen.');
  return new File([await response.arrayBuffer()],name,{type,lastModified:0});
 }));
}
