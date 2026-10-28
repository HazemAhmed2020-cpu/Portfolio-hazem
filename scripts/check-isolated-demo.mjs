import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('http://127.0.0.1:3000/demos/zoomtech/index.html',{waitUntil:'networkidle',timeout:40000});
 const csp=response.headers()['content-security-policy'];
 if(!csp.includes('sandbox allow-scripts')||csp.includes('allow-same-origin'))throw new Error('Demo is not isolated.');
 await page.waitForTimeout(1200);
 console.log('TITLE',await page.title());
 console.log('HEADINGS',await page.locator('h1,h2,h3').allTextContents());
 console.log('BUTTONS',await page.getByRole('button').allTextContents());
 console.log('BODY',(await page.locator('body').innerText()).slice(0,6000));
 const isolated=await page.evaluate(()=>{try{localStorage.getItem('test');return false;}catch{return true;}});
 if(!isolated)throw new Error('Demo unexpectedly has same-origin storage access.');
 await expect(page.locator('#portfolio-preview-notice')).toContainText('Live AI is disabled');
 if((await page.locator('h1,h2').count())<2)throw new Error('Demo did not render the actual app.');
 await page.screenshot({path:'public/images/zoomtech.jpg',type:'jpeg',quality:90});
 await fs.copyFile('public/images/zoomtech.jpg','dist/images/zoomtech.jpg');
 await page.screenshot({path:'docs/zoomtech-preview.png'});
 console.log('DEMO_ERRORS',errors);
 if(errors.length)throw new Error('Demo has runtime errors.');
 console.log('SAFE DEMO: source app rendered; opaque-origin storage isolation verified; live AI not used.');
}finally{await browser.close();}
