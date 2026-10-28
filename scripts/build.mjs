import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath}from'node:url';
import {build}from'vite';
import {readPublicContentDb}from'./content-db.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const forcedStatic=process.argv.includes('--static');
const forcedServer=process.argv.includes('--server');
if(forcedStatic&&forcedServer)throw new Error('Choose either static or server build mode.');
const mode=forcedStatic||(!forcedServer&&(process.env.VERCEL==='1'||process.env.PORTFOLIO_BUILD_MODE==='static'))?'static':'server';
const outputFiles=['portfolio.snapshot.json','deployment-health.json'].map(name=>path.join(root,'public',name));
async function validateLocalAssets(content){
 const values=[content.profile.photo,content.profile.resume,...content.projects.map(p=>p.image),...content.certificates.map(c=>c.file)];
 for(const value of values.filter(Boolean)){
  if(value.startsWith('/media/'))throw new Error('A /media/ upload requires the Node server. For the static site, copy the public file into public/images or public/resume and update its URL in DB Browser.');
  if(value.startsWith('/'))await fs.access(path.join(root,'public',value));
 }
}
try{
 for(const output of outputFiles)await fs.rm(output,{force:true});
 if(mode==='static'){
  const content=readPublicContentDb(path.join(root,'content/portfolio-public.sqlite'));
  await validateLocalAssets(content);
  const builtAt=new Date().toISOString();
  const snapshot={...content,deploymentMode:'static',contactDelivery:'email-link',capabilities:{studio:false,inbox:false,uploads:false},updatedAt:builtAt};
  const health={status:'ok',mode:'static',contentSource:'public-sqlite-build',version:'sqlite-static-v1',studio:false,inbox:false,commit:process.env.VERCEL_GIT_COMMIT_SHA||null,builtAt};
  await fs.writeFile(outputFiles[0],JSON.stringify(snapshot));await fs.writeFile(outputFiles[1],JSON.stringify(health));
 }
 console.log(`Building portfolio in ${mode} mode.`);
 await build({root,define:{'import.meta.env.VITE_PORTFOLIO_MODE':JSON.stringify(mode)}});
}finally{
 // Only dist gets a snapshot. Do not leave stale public snapshots in the server-mode source tree.
 for(const output of outputFiles)await fs.rm(output,{force:true});
}
