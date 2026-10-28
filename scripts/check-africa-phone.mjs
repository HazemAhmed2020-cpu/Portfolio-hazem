import {chromium,expect} from '@playwright/test';
import {phoneHref} from '../shared/contact.js';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:3000',viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/',{waitUntil:'networkidle'});
 const data=await(await page.request.get('/api/portfolio')).json();
 await page.getByRole('button',{name:/View all 7 credentials/}).click();
 const card=page.locator('.credential-card').filter({has:page.getByRole('heading',{name:'Youth Advocacy Program',exact:true})});
 await expect(card.locator('img.issuer-logo')).toHaveAttribute('src','/images/africa-matters-logo.png');
 await card.click();await expect(page.locator('dialog[open] .issuer-logo')).toBeVisible();
 await expect(page.locator('dialog[open] .issuer-logo')).toHaveAttribute('src','/images/africa-matters-logo.png');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:document.querySelector('#credentials').offsetTop-90,behavior:'instant'});});
 await page.locator('#credentials').screenshot({path:'docs/training-africa-matters.png',style:'.site-header,.motion-toggle,.skip-link{visibility:hidden!important}'});
 const phone=page.getByRole('link',{name:'Call Hazem Ahmed',exact:true});
 await expect(phone).toHaveAttribute('href',phoneHref(data.profile.phone));await expect(phone).toContainText(data.profile.phone);
 await phone.scrollIntoViewIfNeeded();await page.waitForTimeout(250);
 await page.locator('#contact').screenshot({path:'docs/contact-phone-updated.png',style:'.site-header,.motion-toggle,.skip-link{visibility:hidden!important}'});
 for(const width of [390,320,768]){
  await page.setViewportSize({width,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error(`Layout overflows at ${width}px`);
  await expect(phone).toHaveAttribute('href',phoneHref(data.profile.phone));
 }
 const confit=data.projects.find(p=>p.id==='confit-ecommerce');if(confit.repo!==''||confit.showSource!==false)throw new Error('CONFIT source visibility changed.');
 const portrait=await fs.readFile('public/images/hazem-portrait.webp');if(createHash('sha256').update(portrait).digest('hex')!=='6e3f7986868b8e17243689b371ae95a89c3c79ecebe574598f9779075daf336c')throw new Error('The original portrait was changed.');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('PASS: Africa Matters card and dialog, real CV phone / tel link, mobile widths, preserved portrait and hidden CONFIT source.');
 console.log('No calls were placed and no messages were sent. Browser errors:',errors.length);
}finally{await browser.close();}
