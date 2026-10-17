import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultRoot=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url))); 

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function createPreviewServer(directory=defaultRoot) {
const root=path.resolve(directory);
return http.createServer(async(req,res)=>{
 try {
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  // Serve both root and the actual GitHub Pages prefix for compatibility checks.
  if(pathname==='/notes-58c0'){res.writeHead(302,{Location:'/notes-58c0/'});res.end();return;}
  if(pathname.startsWith('/notes-58c0/')) pathname=pathname.slice('/notes-58c0'.length);
  let target=path.resolve(root,'.'+pathname);
  if(target!==root && !target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if((await stat(target)).isDirectory()) target=path.join(target,'index.html');
  const body=await readFile(target);
  res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT||4173);
 createPreviewServer().listen(port,'127.0.0.1',()=>console.log(`Preview: http://localhost:${port}/notes-58c0/`));
}
