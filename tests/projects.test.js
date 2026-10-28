import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {portfolioSchema,projectSchema} from '../server/validation.js';
import {demoHref,demoLabel,projectMode,screenshotCaption,sourceHref,publicProject} from '../shared/projects.js';

const content=portfolioSchema.parse(JSON.parse(fs.readFileSync(new URL('../server/seed.json',import.meta.url),'utf8')));
const find=id=>content.projects.find(p=>p.id===id);

test('The requested applications use the supplied URLs and truthful access labels',()=>{
 const expected={madar:'https://madar-platform-lyart.vercel.app/#/',ctpm:'https://epnu-management.vercel.app/',symplelegal:'https://lawyers-startup.vercel.app/',hazematic:'https://project-architecture-of-l-f.vercel.app/login'};
 for(const [id,url] of Object.entries(expected)){assert.equal(find(id).demo,url);assert.equal(find(id).published,true);assert.equal(demoHref(find(id)),url);}
 for(const id of ['madar','ctpm','hazematic']){assert.equal(projectMode(find(id)),'login');assert.equal(demoLabel(find(id)),'Open sign-in');assert(screenshotCaption(find(id)).includes('SIGN-IN REQUIRED'));}
 assert.equal(projectMode(find('symplelegal')),'demo');assert.equal(demoLabel(find('symplelegal')),'Explore demo');
 assert.equal(find('hazematic').category,'Automation');assert(find('hazematic').description.includes('Facebook'));assert(find('hazematic').description.includes('LinkedIn'));
});

test('The real CONFIT e-commerce repository is separate from the old UI prototype',()=>{
 const shop=find('confit-ecommerce');assert.equal(shop.category,'E-commerce');assert.equal(shop.sourceType,'github');assert.equal(shop.published,true);
 assert.equal(shop.demoMode,'paused');assert.equal(demoHref(shop),'','A paused deployment must not be presented as a working demo.');
 assert.equal(shop.imageKind,'repository');assert(screenshotCaption(shop).includes('PUBLIC REPOSITORY'));
 for(const stack of ['React','TypeScript','Python','FastAPI'])assert(shop.stack.includes(stack));
 if(find('confit'))assert.equal(find('confit').published,false);if(find('ancient-egypt'))assert.equal(find('ancient-egypt').published,false);
 if(find('confit')&&shop.repo)assert.notEqual(find('confit').repo,shop.repo);
});

test('Old backups, original portrait, credentials and isolated ZoomTech preview remain supported',()=>{
 const legacy={...find('zoomtech')};delete legacy.demoMode;delete legacy.imageKind;delete legacy.imageCaption;delete legacy.showSource;
 const parsed=projectSchema.parse(legacy);assert.equal(parsed.imageKind,'capture');assert.equal(parsed.imageCaption,'');assert.equal(parsed.showSource,true);assert.equal(projectMode(parsed),'preview');
 assert.equal(demoHref(parsed),'/demos/zoomtech/index.html');
 assert.equal(content.profile.photo,'/images/hazem-portrait.webp');
 assert.equal(content.certificates.find(c=>c.id==='nti-fullstack').title,'Web Development using MEAN Stack');
 assert(content.profile.intro.includes('learning AI'));
 assert.equal(content.projects.filter(p=>p.published).length,6);
 for(const project of content.projects.filter(p=>p.published)){
  assert(project.details,`${project.id} must retain a readable case study`);
  if(project.id!=='confit-ecommerce')assert(sourceHref(project)||demoHref(project),`${project.id} has no public destination`);
  assert(fs.existsSync(new URL(`../public${project.image}`,import.meta.url)),`${project.id} has no saved cover`);
 }
 assert(!/\bghp_[a-zA-Z0-9]{30,}\b/.test(JSON.stringify(content)),'Access tokens must not be in portfolio content.');
});

test('Public project URLs cannot contain embedded credentials or unsafe protocols',()=>{
 const project=find('madar');
 assert.equal(projectSchema.safeParse({...project,demo:'javascript:alert(1)'}).success,false);
 assert.equal(projectSchema.safeParse({...project,demo:'https://username:password@example.com/'}).success,false);
 assert.equal(projectSchema.safeParse({...project,demo:'/demos/../../private/ADMIN_ACCESS.md'}).success,false);
});


test('Madar now documents the actual signed-in student view without publishing review credentials',()=>{
 const madar=find('madar');
 assert.equal(madar.image,'/images/madar-student-dashboard.webp');
 assert(screenshotCaption(madar).includes('STUDENT WORKSPACE'));
 assert(madar.details.includes('student experience'));
 assert(madar.sourceNote.includes('fresh sign-in'));
 assert(madar.sourceNote.includes('lists were empty'));
 for(const language of ['JavaScript','HTML','CSS'])assert(madar.stack.includes(language));
 assert(!/madar-review-[a-f0-9]+@example\.com/.test(JSON.stringify(content)));
});


test('CONFIT source visibility is hidden publicly while the saved repository is retained',()=>{
 assert.equal(find('confit-ecommerce').showSource,false);
 const confit={...find('confit-ecommerce'),repo:'https://github.com/example/project-source',showSource:false};
 assert.equal(sourceHref(confit),'');
 assert.equal(publicProject(confit).repo,'');
 assert.equal(publicProject(confit).showSource,false);
 assert.equal(publicProject(confit).image,confit.image);
 assert.equal(confit.repo,'https://github.com/example/project-source','Public projection must not mutate saved data.');
 const zoom=find('zoomtech');assert(sourceHref(zoom).includes('/ZoomTech/tree/Basics12'));
 assert.equal(publicProject(zoom).repo,zoom.repo);
});
