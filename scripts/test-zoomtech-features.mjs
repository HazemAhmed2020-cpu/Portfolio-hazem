import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 const aiRequests=[];page.on('request',req=>{if(/generativelanguage|ai-disabled|api\.openai/.test(req.url()))aiRequests.push(req.url());});
 await page.goto('http://127.0.0.1:3000/demos/zoomtech/index.html',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'مترجم بايثون',exact:true}).click();
 console.log('PYTHON CONTROLS',await page.getByRole('button').allTextContents());
 await page.locator('textarea').first().fill('print("portfolio-preview-ok")');
 const run=page.getByRole('button',{name:/تشغيل/}).first();
 await run.click();
 try{await page.getByText('portfolio-preview-ok',{exact:true}).waitFor({timeout:45000});console.log('PASS: actual Python execution in Pyodide.');}
 catch(error){console.log('PYTHON OUTPUT',(await page.locator('body').innerText()).slice(-2000));throw error;}
 await page.getByRole('button',{name:'الاختبار',exact:true}).click();
 console.log('QUIZ HEADING',(await page.locator('h1,h2,h3').allTextContents()).slice(-4));
 await expect(page.getByRole('heading',{name:/input\(\)/})).toBeVisible();
 await page.getByRole('button',{name:'نصًا (String)',exact:true}).click();
 await expect(page.locator('body')).toContainText(/النتيجة:\s*1\s*\//);
 await page.getByRole('button',{name:'افتح المحادثة'}).click();
 await page.getByRole('button',{name:'ما هي القوائم؟',exact:true}).click();
 await page.waitForTimeout(500);
 await expect(page.locator('body')).toContainText('🔹');
 const body=await page.locator('body').innerText();
 console.log('CHAT FALLBACK',body.slice(-1400));
 if(aiRequests.length)throw new Error('An AI network request was attempted.');
 console.log('PASS: lesson/quiz navigation, local chat fallback, zero live AI requests.');
}finally{await browser.close();}
