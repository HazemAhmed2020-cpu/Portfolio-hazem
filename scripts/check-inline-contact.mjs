import {chromium,expect}from'@playwright/test';
const origin=process.env.PREVIEW_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],requests=[];let popups=0,mode='activation',release;
 page.on('pageerror',error=>errors.push(error.message));page.on('popup',()=>popups++);
 const cors={'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, accept'};
 await page.route('https://formsubmit.co/**',async route=>{
  const request=route.request();
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(request.method()!=='POST')return route.abort();
  requests.push({url:request.url(),body:request.postDataJSON()});
  if(mode==='network')return route.abort('failed');
  if(mode==='hold')await new Promise(resolve=>release=resolve);
  const body=mode==='activation'?{success:'false',message:'This form needs Activation.'}:mode==='rejected'?{success:false,message:'Unable to accept the request'}:{success:'true',message:'The form was submitted successfully.'};
  return route.fulfill({status:mode==='rejected'?503:200,contentType:'application/json',headers:cors,body:JSON.stringify(body)});
 });
 await page.goto('/#contact',{waitUntil:'networkidle'});
 await expect(page.locator('.contact-form')).toBeVisible();
 await expect(page.getByRole('link',{name:'Email me',exact:true})).toHaveCount(0);
 await page.evaluate(()=>{document.activeElement?.blur();});
 await page.locator('#contact').screenshot({path:'docs/inline-contact-form.png',style:'.site-header,.skip-link,.motion-toggle{visibility:hidden!important}'});
 const values={name:'Test visitor',email:'visitor@example.com',message:'This is a synthetic browser test. No real email should be sent.'};
 await page.getByLabel('Your name',{exact:true}).fill(values.name);
 await page.getByLabel('Email address',{exact:true}).fill(values.email);
 await page.locator('select[name="opportunity"]').selectOption('Other');
 await page.locator('textarea[name="message"]').fill(values.message);
 const originalURL=page.url();
 await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('one-time activation');
 await expect(page.locator('.contact-success')).toHaveCount(0);
 await expect(page.locator('textarea[name="message"]')).toHaveValue(values.message);
 mode='rejected';await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('could not accept');await expect(page.getByLabel('Your name',{exact:true})).toHaveValue(values.name);
 mode='network';await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Could not confirm delivery');await expect(page.locator('textarea[name="message"]')).toHaveValue(values.message);
 mode='hold';await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('button',{name:/Sending/})).toBeDisabled();
 await expect(page.getByLabel('Your name',{exact:true})).toBeDisabled();
 await expect.poll(()=>typeof release).toBe('function');
 const before=requests.length;
 await page.locator('.contact-form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 await page.waitForTimeout(50);if(requests.length!==before)throw new Error('A duplicate submission was sent.');
 release();await expect(page.getByRole('heading',{name:'Thanks for your message.',exact:true})).toBeVisible();
 await expect(page.locator('.contact-success')).toContainText('submitted for delivery');
 if(page.url()!==originalURL||popups!==0)throw new Error('Submitting navigated away or opened a new window.');
 for(const request of requests){
  if(decodeURIComponent(new URL(request.url).pathname)!=='/ajax/hazemsaifallden2040@gmail.com')throw new Error('Wrong recipient endpoint.');
  if(request.body.email!==values.email||request.body._replyto!==values.email)throw new Error('Reply-to email was lost.');
  for(const key of ['_cc','_next','_webhook','_autoresponse','_captcha'])if(key in request.body)throw new Error('Unexpected relay option: '+key);
 }
 await page.getByRole('button',{name:'Send another message',exact:false}).click();
 await expect(page.getByLabel('Your name',{exact:true})).toHaveValue('');
 for(const width of [390,320,768]){await page.setViewportSize({width,height:844});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Horizontal overflow at '+width);}
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('PASS: in-page success, activation/rejection/network errors, preserved drafts, disabled sending, duplicate guard, and no navigation/popups.');
 console.log('PASS: fixed recipient, safe relay payload, responsive layout, zero runtime errors.');
 console.log('All delivery requests were intercepted. No real email was sent by this test.');
}finally{await browser.close();}
