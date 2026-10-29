import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {createPublicContentDb,readPublicContentDb,publicContent,PUBLIC_DB_APPLICATION_ID,PUBLIC_TABLE_COLUMNS}from'../scripts/content-db.mjs';
const seed=JSON.parse(fs.readFileSync(new URL('../server/seed.json',import.meta.url),'utf8'));
function fixture(callback){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-public-content-'));try{return callback(path.join(dir,'public.sqlite'));}finally{fs.rmSync(dir,{recursive:true,force:true});}}

test('DB Browser content has public tables only and round-trips the portfolio',()=>fixture(file=>{
 const input=structuredClone(seed);input.projects.push({...input.projects[0],id:'private-draft-test',published:false,title:'Internal draft not for the public file'});
 const safe=createPublicContentDb(file,input);const read=readPublicContentDb(file);
 assert.deepEqual(read,safe);assert.deepEqual(read,publicContent(input));
 assert(!read.projects.some(p=>p.id==='private-draft-test'));
 assert.equal(read.projects.find(p=>p.id==='confit-ecommerce').repo,'');
 const db=new Database(file,{readonly:true});
 assert.equal(db.pragma('application_id',{simple:true}),PUBLIC_DB_APPLICATION_ID);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).sort();
 assert.deepEqual(tables,Object.keys(PUBLIC_TABLE_COLUMNS).sort());
 assert.equal(db.prepare('SELECT repository_url FROM projects WHERE id=?').get('confit-ecommerce').repository_url,'');
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM projects').get().n,6);db.close();
}));

test('Offline SQLite edits are reflected on the next static build',()=>fixture(file=>{
 createPublicContentDb(file,seed);const db=new Database(file);
 db.prepare('UPDATE profile SET phone=?,intro=? WHERE id=1').run('+1 (202) 555-0147','An edited public introduction.');
 db.prepare('UPDATE projects SET published=0 WHERE id=?').run('zoomtech');db.close();
 const content=readPublicContentDb(file);assert.equal(content.profile.intro,'An edited public introduction.');assert.equal(content.profile.phone,'+1 (202) 555-0147');assert.equal(content.projects.length,5);
 assert.throws(()=>createPublicContentDb(file,seed),/not overwritten/);
}));

test('Private runtime databases cannot be mistaken for the public content file',()=>fixture(file=>{
 const db=new Database(file);db.exec('CREATE TABLE admin(password_hash TEXT); CREATE TABLE messages(message TEXT)');db.close();
 assert.throws(()=>readPublicContentDb(file),/Not the dedicated PUBLIC content database/);
}));

test('Extra private tables and credential-like literals are rejected',()=>fixture(file=>{
 createPublicContentDb(file,seed);let db=new Database(file);db.exec('CREATE TABLE sessions(token TEXT)');db.close();
 assert.throws(()=>readPublicContentDb(file),/Unexpected tables/);
 db=new Database(file);db.exec('DROP TABLE sessions');db.prepare('UPDATE profile SET intro=? WHERE id=1').run('ghp_'+'A'.repeat(36));db.close();
 assert.throws(()=>readPublicContentDb(file),/Credential-like text/);
}));

test('The committed content file and Vercel configuration are explicitly static',()=>{
 const content=readPublicContentDb(new URL('../content/portfolio-public.sqlite',import.meta.url).pathname);
 assert.equal(content.projects.length,9);assert.equal(content.certificates.length,7);assert.equal(content.profile.photo,'/images/hazem-portrait.webp');assert(content.profile.phone);
 const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.framework,'vite');assert.equal(config.buildCommand,'npm run build:static');assert.equal(config.outputDirectory,'dist');
 const zoom=config.headers.find(item=>item.source.startsWith('/demos/zoomtech')).headers.find(header=>header.key==='Content-Security-Policy').value;
 assert(zoom.includes('sandbox allow-scripts'));assert(!zoom.includes('allow-same-origin'));
 assert(config.rewrites.some(route=>route.source==='/api/portfolio'&&route.destination==='/portfolio.snapshot.json'));
 assert(!config.rewrites.some(route=>route.source==='/api/contact'),'A static contact submission must not be rewritten to a fake success.');
});
