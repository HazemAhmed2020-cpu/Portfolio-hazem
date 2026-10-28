import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {issuerLogo} from '../shared/issuers.js';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3000',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/',{waitUntil:'networkidle'});
 const data=await(await page.request.get('/api/portfolio')).json();
 const confit=data.projects.find(p=>p.id==='confit-ecommerce');
 if(confit.repo!==''||confit.showSource!==false)throw new Error('Hidden source exposed in the public response.');
 const card=page.locator('.project-card').filter({has:page.getByRole('heading',{name:confit.title,exact:true})});
 await expect(card.getByRole('link',{name:'View source',exact:true})).toHaveCount(0);
 await card.getByRole('button',{name:'Read CONFIT E-commerce Platform case study',exact:true}).click();
 await expect(page.locator('dialog[open]').getByRole('link',{name:'View source',exact:true})).toHaveCount(0);
 await expect(page.locator('dialog[open]')).not.toContainText('The public repository is available below.');
 await expect(page.locator('dialog[open]').getByRole('link',{name:"Let's talk about this project"})).toBeVisible();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await expect(page.locator('a[href="https://github.com/OmarAhmed-123/CONFIT_A"]')).toHaveCount(0);
 const zoom=page.locator('.project-card').filter({has:page.getByRole('heading',{name:'ZoomTech. Learn by doing.',exact:true})});
 await expect(zoom.getByRole('link',{name:'View source',exact:true})).toBeVisible();
 await card.screenshot({path:'docs/confit-no-source.png',style:'.site-header,.motion-toggle,.skip-link{visibility:hidden!important}'});
 await page.evaluate(()=>window.scrollTo({top:document.querySelector('#credentials').offsetTop-90,behavior:'instant'}));
 const logos=page.locator('#credentials .issuer-logo');await expect(logos).toHaveCount(data.certificates.slice(0,6).filter(c=>issuerLogo(c.shortIssuer)).length);
 await expect.poll(()=>logos.evaluateAll(imgs=>imgs.every(img=>img.complete&&img.naturalWidth>0&&getComputedStyle(img).objectFit==='contain'))).toBe(true);
 for(const certificate of data.certificates.slice(0,6).filter(c=>issuerLogo(c.shortIssuer))){
  const training=page.locator('.credential-card').filter({has:page.getByRole('heading',{name:certificate.title,exact:true})});
  const expectedLogo=issuerLogo(certificate.shortIssuer);
  await expect(training.locator('.issuer-logo')).toHaveAttribute('src',expectedLogo);
  await training.click();
  await expect(page.locator('dialog[open] .issuer-logo')).toBeVisible();
  await expect(page.locator('dialog[open] .issuer-logo')).toHaveAttribute('src',expectedLogo);
  await expect(page.locator('dialog[open]')).toContainText('certificate document has not been attached');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 }
 for(const certificate of data.certificates.slice(0,6).filter(c=>!issuerLogo(c.shortIssuer))){
  const training=page.locator('.credential-card').filter({has:page.getByRole('heading',{name:certificate.title,exact:true})});
  await expect(training.locator('.issuer-logo')).toHaveCount(0);
  await expect(training.locator('.issuer-mark')).toHaveText(certificate.shortIssuer);
 }
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:document.querySelector('#credentials').offsetTop-90,behavior:'instant'});});
 await page.waitForTimeout(200);
 await page.locator('#credentials').screenshot({path:'docs/training-logos-updated.png',style:'.site-header,.motion-toggle,.skip-link{visibility:hidden!important}'});
 for(const width of [390,320,768]){
  await page.setViewportSize({width,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`Overflow at ${width}px`);
  await expect(logos).toHaveCount(data.certificates.slice(0,6).filter(c=>issuerLogo(c.shortIssuer)).length);
 }
 const portrait=await fs.readFile('public/images/hazem-portrait.webp');
 if(createHash('sha256').update(portrait).digest('hex')!=='6e3f7986868b8e17243689b371ae95a89c3c79ecebe574598f9779075daf336c')throw new Error('Original portrait bytes changed.');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('PASS: supplied MCIT, NTI and ITI marks on all matching training cards and dialogs; other issuers unchanged.');
 console.log('PASS: no CONFIT View source on card, dialog, DOM, or public repo field; ZoomTech link retained.');
 console.log('PASS: 390/320/768px layouts, original portrait checksum, and zero browser errors.');
}finally{await browser.close();}
