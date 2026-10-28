import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath}from'node:url';
import {createPublicContentDb}from'./content-db.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const filename=path.join(root,'content/portfolio-public.sqlite');
const content=JSON.parse(fs.readFileSync(path.join(root,'server/seed.json'),'utf8'));
const safe=createPublicContentDb(filename,content);
console.log(`Created content/portfolio-public.sqlite with ${safe.projects.length} public projects and ${safe.certificates.length} credentials. No admin, inbox, session, or mail-secret data was copied.`);
