import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {phoneHref} from '../shared/contact.js';
import {profileSchema} from '../server/validation.js';
const profile=JSON.parse(fs.readFileSync(new URL('../server/seed.json',import.meta.url),'utf8')).profile;
test('Public phone supports direct calling and legacy profiles',()=>{
 assert.match(phoneHref(profile.phone),/^tel:\+20\d{10}$/);
 assert.equal(phoneHref('+1 (202) 555-0147'),'tel:+12025550147');
 assert.equal(phoneHref(''), '');assert.equal(phoneHref('javascript:alert(1)'), '');
 const legacy={...profile};delete legacy.phone;assert.equal(profileSchema.parse(legacy).phone,'');
 assert.equal(profileSchema.safeParse({...profile,phone:'javascript:alert(123456789)'}).success,false);
});
