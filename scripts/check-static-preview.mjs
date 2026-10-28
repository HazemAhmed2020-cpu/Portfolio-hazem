import {chromium,expect}from'@playwright/test';
import fs from 'node:fs/promises';
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],apiRequests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))apiRequests.push(request.url());});
 // This proves the public page does not depend on an Express API being reachable.
 await page.route('**/api/**',route=>route.fulfill({status:404,contentType:'application/json',body:'{"error":"Backend intentionally unavailable in this test"}'}));
 await page.goto('/',{waitUntil:'networkidle'});
 await expect(page.locator('.hero-intro')).toContainText('learning AI');
 await expect(page.locator('.project-card')).toHaveCount(6);
 await expect(page.locator('img[src="/images/hazem-portrait.webp"]')).toBeVisible();
 await expect(page.locator('.studio-link')).toHaveCount(0);
 await expect(page.locator('.contact-form')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Send message',exact:true})).toHaveCount(0);
 const email=page.getByRole('link',{name:/Email me/});await expect(email).toHaveAttribute('href','mailto:hazemsaifallden2040@gmail.com');
 await expect(page.getByRole('link',{name:'Call me',exact:false})).toHaveAttribute('href',/^tel:\+20\d{10}$/);
 await expect(page.locator('#contact')).toContainText('does not collect or store messages');
 await expect(page.locator('#contact')).not.toContainText('Saved securely to my inbox');
 const confit=page.locator('.project-card').filter({has:page.getByRole('heading',{name:'CONFIT. Commerce with character.',exact:true})});
 await expect(confit.getByRole('link',{name:'View source',exact:true})).toHaveCount(0);
 await page.screenshot({path:'docs/vercel-static-desktop.png'});
 await page.locator('#contact').screenshot({path:'docs/vercel-static-contact.png',style:'.site-header,.motion-toggle,.skip-link{visibility:hidden!important}'});
 await page.getByRole('button',{name:/View all 7 credentials/}).click();await expect(page.locator('.credential-card')).toHaveCount(7);
 await expect(page.locator('img[src="/images/africa-matters-logo.png"]')).toBeVisible();
 await page.goto('/admin',{waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Content is managed offline.'})).toBeVisible();await expect(page.locator('input[type="password"]')).toHaveCount(0);
 const health=await(await context.request.get('/api/health')).json();if(health.mode!=='static'||health.studio!==false||health.inbox!==false)throw new Error('Static capabilities are not explicit.');
 const publicData=await(await context.request.get('/api/portfolio')).json();if(publicData.deploymentMode!=='static'||publicData.projects.length!==6)throw new Error('Read-only content route is incorrect.');
 for(const route of ['/private/ADMIN_ACCESS.md','/data/portfolio.sqlite','/content/portfolio-public.sqlite'])if((await context.request.get(route)).status()!==404)throw new Error('A non-public runtime/source path is being served: '+route);
 const demo=await context.request.get('/demos/zoomtech/index.html');const csp=demo.headers()['content-security-policy']||'';if(!csp.includes('sandbox allow-scripts')||csp.includes('allow-same-origin'))throw new Error('ZoomTech isolation is not preserved.');
 await page.goto('/',{waitUntil:'networkidle'});
 for(const width of [390,320,768]){await page.setViewportSize({width,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Overflow at '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/vercel-static-mobile.png'});
 if(apiRequests.length)throw new Error('The static frontend unexpectedly requested backend APIs.');
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('PASS: static public portfolio works even with all /api requests blocked.');
 console.log('PASS: 6 projects, 7 credentials, preserved images/logos/phone, honest email/call contact and offline Studio notice.');
 console.log('PASS: explicit static health, private-file 404s, demo sandbox, 320/390/768px layouts; zero browser errors.');
}finally{await browser.close();}
