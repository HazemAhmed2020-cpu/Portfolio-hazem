// Local preview only. Production Vercel serves these files directly from its CDN.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const sandbox=config.headers.find(item=>item.source.startsWith('/demos/zoomtech')).headers;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){json(res,405,{error:'This static deployment does not accept server form submissions or Studio writes.'});return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://preview.local').pathname);}catch{json(res,400,{error:'Invalid path.'});return;}
 if(pathname==='/api/portfolio')pathname='/portfolio.snapshot.json';
 else if(pathname==='/api/health')pathname='/deployment-health.json';
 else if(pathname.startsWith('/api/')){json(res,404,{error:'This API is not enabled in the static portfolio.'});return;}
 else if(pathname==='/'||pathname==='/admin'||pathname.startsWith('/admin/'))pathname='/index.html';
 const file=path.resolve(dist,'.'+pathname);
 if(!file.startsWith(dist+path.sep)){json(res,404,{error:'Not found.'});return;}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){json(res,404,{error:'Not found.'});return;}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 if(pathname.startsWith('/demos/zoomtech/'))for(const header of sandbox)res.setHeader(header.key,header.value);
 res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Length',fs.statSync(file).size);
 if(req.method==='HEAD'){res.end();return;}
 fs.createReadStream(file).pipe(res);
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Static portfolio preview listening on 0.0.0.0:${Number(process.env.PORT||3000)} — no online Studio or inbox.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
