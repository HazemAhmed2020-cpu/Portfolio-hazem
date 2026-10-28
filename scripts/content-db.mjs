import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {portfolioSchema} from '../server/validation.js';
import {publicProject} from '../shared/projects.js';

export const PUBLIC_DB_APPLICATION_ID=0x485A5054; // HZPT: public portfolio content, NOT the private runtime DB.
export const PROFILE_FIELDS={name:'name',fullName:'full_name',role:'role',location:'location',email:'email',phone:'phone',github:'github_url',linkedin:'linkedin_url',resume:'resume_url',photo:'photo_url',available:'available',availability:'availability',heroHeading:'hero_heading',heroSubheading:'hero_subheading',heroAccent:'hero_accent',intro:'intro',about:'about',aboutMore:'about_more'};
export const PROJECT_FIELDS={id:'id',title:'title',shortTitle:'short_title',category:'category',description:'description',details:'details',role:'role',year:'year',repo:'repository_url',showSource:'show_source',demo:'demo_url',image:'image_url',demoMode:'demo_mode',imageKind:'image_kind',imageCaption:'image_caption',artwork:'artwork',sourceType:'source_type',sourceNote:'source_note',featured:'featured',published:'published'};
export const CREDENTIAL_FIELDS={id:'id',title:'title',issuer:'issuer',shortIssuer:'short_issuer',year:'year',type:'training_type',description:'description',file:'document_url',url:'verification_url',published:'published'};
const BOOLEANS=new Set(['available','showSource','featured','published']);
export const PUBLIC_TABLE_COLUMNS={
 profile:['id',...Object.values(PROFILE_FIELDS)],
 skills:['id','section','name','sort_order'],
 education:['id','school','degree','dates','note','sort_order'],
 achievements:['id','text','sort_order'],
 projects:[...Object.values(PROJECT_FIELDS),'sort_order'],
 project_technologies:['id','project_id','name','sort_order'],
 project_highlights:['id','project_id','text','sort_order'],
 credentials:[...Object.values(CREDENTIAL_FIELDS),'sort_order']
};
function columns(fields,hasTextID=false){
 return Object.entries(fields).map(([key,column])=>key==='id'&&hasTextID?`"${column}" TEXT PRIMARY KEY`:`"${column}" ${BOOLEANS.has(key)?`INTEGER NOT NULL CHECK ("${column}" IN (0,1))`:'TEXT NOT NULL'}`).join(',\n');
}
function rowFor(value,fields){return Object.fromEntries(Object.entries(fields).map(([key,column])=>[column,BOOLEANS.has(key)?Number(!!value[key]):String(value[key]??'')]));}
function objectFor(row,fields){return Object.fromEntries(Object.entries(fields).map(([key,column])=>[key,BOOLEANS.has(key)?row[column]===1:row[column]]));}
function insert(db,table,row){const keys=Object.keys(row);db.prepare(`INSERT INTO "${table}" (${keys.map(key=>'"'+key+'"').join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...Object.values(row));}
export function publicContent(content){
 const parsed=portfolioSchema.parse(content);
 return {profile:parsed.profile,projects:parsed.projects.filter(p=>p.published).map(publicProject),certificates:parsed.certificates.filter(c=>c.published)};
}
function rejectCredentialLiterals(content){
 const text=JSON.stringify(content);
 if(/\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|gsk_[A-Za-z0-9_-]{25,}|AIza[A-Za-z0-9_-]{30,})\b/.test(text))throw new Error('Credential-like text was found in the PUBLIC content file. Do not publish secrets.');
}
export function createPublicContentDb(filename,content){
 if(fs.existsSync(filename))throw new Error('The content database already exists. It was not overwritten. Back it up before explicitly replacing it.');
 const safe=publicContent(content);rejectCredentialLiterals(safe);
 fs.mkdirSync(path.dirname(filename),{recursive:true});
 const db=new Database(filename);
 try{
  db.pragma('journal_mode = DELETE');db.pragma('foreign_keys = ON');
  db.pragma(`application_id = ${PUBLIC_DB_APPLICATION_ID}`);db.pragma('user_version = 1');
  db.exec(`
   CREATE TABLE profile(id INTEGER PRIMARY KEY CHECK(id=1),${columns(PROFILE_FIELDS)});
   CREATE TABLE skills(id INTEGER PRIMARY KEY,section TEXT NOT NULL CHECK(section IN ('frontend','backend','tools')),name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE education(id INTEGER PRIMARY KEY,school TEXT NOT NULL,degree TEXT NOT NULL,dates TEXT NOT NULL,note TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE achievements(id INTEGER PRIMARY KEY,text TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE projects(${columns(PROJECT_FIELDS,true)},sort_order INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE project_technologies(id INTEGER PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE project_highlights(id INTEGER PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,text TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE credentials(${columns(CREDENTIAL_FIELDS,true)},sort_order INTEGER NOT NULL DEFAULT 0);
  `);
  db.transaction(()=>{
   insert(db,'profile',{id:1,...rowFor(safe.profile,PROFILE_FIELDS)});
   for(const section of ['frontend','backend','tools'])safe.profile[section].forEach((name,index)=>insert(db,'skills',{section,name,sort_order:index}));
   safe.profile.education.forEach((entry,index)=>insert(db,'education',{...entry,sort_order:index}));
   safe.profile.achievements.forEach((text,index)=>insert(db,'achievements',{text,sort_order:index}));
   safe.projects.forEach((project,index)=>{
    insert(db,'projects',{...rowFor(project,PROJECT_FIELDS),sort_order:index});
    project.stack.forEach((name,i)=>insert(db,'project_technologies',{project_id:project.id,name,sort_order:i}));
    project.highlights.forEach((text,i)=>insert(db,'project_highlights',{project_id:project.id,text,sort_order:i}));
   });
   safe.certificates.forEach((credential,index)=>insert(db,'credentials',{...rowFor(credential,CREDENTIAL_FIELDS),sort_order:index}));
  })();
  db.exec('VACUUM');
 }finally{db.close();}
 return safe;
}
export function readPublicContentDb(filename){
 const db=new Database(filename,{readonly:true,fileMustExist:true});
 try{
  db.pragma('query_only = ON');
  if(db.pragma('application_id',{simple:true})!==PUBLIC_DB_APPLICATION_ID||db.pragma('user_version',{simple:true})!==1)throw new Error('Not the dedicated PUBLIC content database. Never use data/portfolio.sqlite here.');
  if(db.pragma('quick_check',{simple:true})!=='ok')throw new Error('The public content database failed its integrity check.');
  const objects=db.prepare("SELECT name,type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
  if(objects.some(object=>!['table','index'].includes(object.type)))throw new Error('Views and triggers are not allowed in the public content database.');
  const tables=objects.filter(object=>object.type==='table').map(object=>object.name).sort();
  if(JSON.stringify(tables)!==JSON.stringify(Object.keys(PUBLIC_TABLE_COLUMNS).sort()))throw new Error('Unexpected tables in the public content file. It must not contain accounts, sessions, or inboxes.');
  for(const [table,columns]of Object.entries(PUBLIC_TABLE_COLUMNS)){
   const actual=db.prepare(`PRAGMA table_info("${table}")`).all().map(column=>column.name).sort();
   if(JSON.stringify(actual)!==JSON.stringify([...columns].sort()))throw new Error(`Unexpected columns in ${table}; do not store private fields in this public file.`);
  }
  if(db.pragma('foreign_key_check').length)throw new Error('Some project technologies/highlights reference a missing project. Correct them in DB Browser before publishing.');
  const profileRow=db.prepare('SELECT * FROM profile WHERE id=1').get();if(!profileRow)throw new Error('The public profile row (id=1) is required.');
  const profile=objectFor(profileRow,PROFILE_FIELDS);
  const skills=db.prepare('SELECT * FROM skills ORDER BY sort_order,id').all();
  for(const section of ['frontend','backend','tools'])profile[section]=skills.filter(skill=>skill.section===section).map(skill=>skill.name);
  profile.education=db.prepare('SELECT school,degree,dates,note FROM education ORDER BY sort_order,id').all();
  profile.achievements=db.prepare('SELECT text FROM achievements ORDER BY sort_order,id').all().map(row=>row.text);
  const technologies=db.prepare('SELECT * FROM project_technologies ORDER BY sort_order,id').all();
  const highlights=db.prepare('SELECT * FROM project_highlights ORDER BY sort_order,id').all();
  const projects=db.prepare('SELECT * FROM projects ORDER BY sort_order,id').all().map(row=>({...objectFor(row,PROJECT_FIELDS),stack:technologies.filter(t=>t.project_id===row.id).map(t=>t.name),highlights:highlights.filter(h=>h.project_id===row.id).map(h=>h.text)}));
  const certificates=db.prepare('SELECT * FROM credentials ORDER BY sort_order,id').all().map(row=>objectFor(row,CREDENTIAL_FIELDS));
  const parsed=portfolioSchema.parse({profile,projects,certificates});rejectCredentialLiterals(parsed);
  return publicContent(parsed);
 }finally{db.close();}
}
