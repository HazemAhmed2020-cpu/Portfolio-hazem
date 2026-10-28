import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {issuerLogo} from '../shared/issuers.js';
const seed=JSON.parse(fs.readFileSync(new URL('../server/seed.json',import.meta.url),'utf8'));
test('The supplied ITI logo is used only for ITI, without replacing certificate documents',()=>{
 const iti=seed.certificates.filter(c=>c.shortIssuer.trim().toUpperCase()==='ITI');
 assert.deepEqual(iti.map(c=>c.id).sort(),['iti-python','iti-react']);
 for(const item of iti){assert.equal(issuerLogo(item.shortIssuer),'/images/iti-logo.png');assert.equal(item.file,'');}
 assert.equal(issuerLogo(' iti '),'/images/iti-logo.png');
 for(const issuer of ['U',''])assert.equal(issuerLogo(issuer),'');
 const asset=fs.readFileSync(new URL('../public/images/iti-logo.png',import.meta.url));
 assert.equal(asset.subarray(1,4).toString(),'PNG');
});


test('The supplied NTI logo is assigned to the MEAN and UI/UX training entries only',()=>{
 const nti=seed.certificates.filter(c=>c.shortIssuer.trim().toUpperCase()==='NTI');
 assert.deepEqual(nti.map(c=>c.id).sort(),['nti-fullstack','nti-uiux']);
 for(const item of nti){assert.equal(issuerLogo(item.shortIssuer),'/images/nti-logo.png');assert.equal(item.file,'');}
 assert.equal(issuerLogo(' nTi '),'/images/nti-logo.png');
 assert.notEqual(issuerLogo('NTI'),issuerLogo('ITI'));
 const png=fs.readFileSync(new URL('../public/images/nti-logo.png',import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),400);assert.equal(png.readUInt32BE(20),400);
});


test('The supplied MCIT wordmark replaces only the Advanced C++ provider badge',()=>{
 const courses=seed.certificates.filter(c=>c.shortIssuer.trim().toUpperCase()==='MCIT');
 assert.deepEqual(courses.map(c=>c.id),['mcit-cpp']);
 assert.equal(courses[0].title,'Advanced C++');assert.equal(courses[0].file,'');
 assert.equal(issuerLogo(' MCIT '),'/images/mcit-logo.png');
 assert.equal(issuerLogo('mcit'),'/images/mcit-logo.png');
 assert.equal(issuerLogo('ITI'),'/images/iti-logo.png');assert.equal(issuerLogo('NTI'),'/images/nti-logo.png');
 const png=fs.readFileSync(new URL('../public/images/mcit-logo.png',import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert(png.readUInt32BE(16)>png.readUInt32BE(20),'MCIT must retain its horizontal proportions.');
});


test('Africa Matters uses the supplied mark on the Youth Advocacy Program',()=>{
 const certificate=seed.certificates.find(c=>c.id==='africa-matters');
 assert.equal(certificate.shortIssuer,'AM');assert.equal(certificate.title,'Youth Advocacy Program');
 assert.equal(issuerLogo('AM'),'/images/africa-matters-logo.png');assert.equal(certificate.file,'');
 const png=fs.readFileSync(new URL('../public/images/africa-matters-logo.png',import.meta.url));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),png.readUInt32BE(20));
});
