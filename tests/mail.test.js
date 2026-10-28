import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';

test('Gmail forwarding is protected, encrypted, persistent, and explicit when not configured',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hazem-mail-test-'));
 const deliveries=[];let fail=false,verifications=0;
 const factory=options=>({
   async verify(){assert.equal(options.host,'smtp.gmail.com');assert.equal(options.secure,true);assert.equal(options.port,465);verifications++;},
   async sendMail(message){if(fail)throw Object.assign(new Error('Do not expose provider details'),{code:'EAUTH'});deliveries.push(message);return {accepted:[message.to],messageId:'mock-only'};},
   close(){}
 });
 let instance=createApp({dataDir:dir,initialPassword:'Test-Only-Studio-Password-42',mailOptions:{transportFactory:factory,automatic:false,env:{}}});
 let server=instance.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 let base=`http://127.0.0.1:${server.address().port}`;
 async function get(url,options={}){const response=await fetch(base+url,options);const body=await response.json();return {response,body};}
 let headers;
 async function login(){const {response,body}=await get('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'hazem',password:'Test-Only-Studio-Password-42'})});assert.equal(response.status,200);headers={'Content-Type':'application/json',Cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':body.csrf};}
 async function stop(){await instance.mailer.stop();await new Promise(resolve=>server.close(resolve));instance.db.close();}
 try{
  assert.equal((await get('/api/admin/mail')).response.status,401);
  await login();
  let status=(await get('/api/admin/mail',{headers})).body;
  assert.equal(status.configured,false);
  assert.equal((await get('/api/admin/mail/test',{method:'POST',headers})).response.status,400);
  const contact={name:'Integration test',email:'sender@example.com',opportunity:'Full-time role',message:'A test message with <script>markup</script> that must be escaped.',website:''};
  let r=await get('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(contact)});
  assert.equal(r.response.status,201);assert.equal(r.body.delivery,'stored_in_studio');assert.equal(deliveries.length,0);
  const payload={username:'mail-test@example.com',appPassword:'abcd abcd abcd abcd'};
  r=await get('/api/admin/mail',{method:'PUT',headers:{'Content-Type':'application/json',Cookie:headers.Cookie},body:JSON.stringify(payload)});assert.equal(r.response.status,403);
  r=await get('/api/admin/mail',{method:'PUT',headers,body:JSON.stringify(payload)});assert.equal(r.response.status,200);assert.equal(r.body.configured,true);assert.equal(verifications,1);
  const serialized=JSON.stringify(r.body);assert(!serialized.includes('abcd'));assert(!serialized.includes('appPassword'));
  const encrypted=fs.readFileSync(path.join(dir,'private','gmail.enc.json'),'utf8');assert(!encrypted.includes('abcd'));assert(!encrypted.includes('mail-test@example.com'));
  assert.equal(fs.statSync(path.join(dir,'private','gmail.key')).mode&0o777,0o600);
  assert.equal((await fetch(base+'/data/private/gmail.key')).status,404);
  await instance.mailer.flush();
  assert.equal(deliveries.length,1);assert.equal(deliveries[0].replyTo.address,'sender@example.com');assert.equal(deliveries[0].from.address,'mail-test@example.com');
  assert(!deliveries[0].html.includes('<script>'));assert(deliveries[0].html.includes('&lt;script&gt;'));
  let messages=(await get('/api/admin/messages',{headers})).body.messages;assert.equal(messages[0].email_status,'sent');assert(messages[0].email_sent_at);
  const backup=(await get('/api/admin/export',{headers})).body;assert(!JSON.stringify(backup).includes('abcd'));assert(!JSON.stringify(backup).includes('mail-test@example.com'));
  fail=true;
  r=await get('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...contact,name:'Retry check'})});assert.equal(r.body.delivery,'email_queued');
  await instance.mailer.flush();messages=(await get('/api/admin/messages',{headers})).body.messages;
  const failed=messages.find(x=>x.name==='Retry check');assert.equal(failed.email_status,'failed');assert.equal(failed.email_attempts,1);assert(!failed.email_error.includes('provider details'));
  fail=false;instance.mailer.retry();await instance.mailer.flush();
  assert.equal(instance.db.prepare('SELECT email_status FROM messages WHERE id=?').get(failed.id).email_status,'sent');
  const before=deliveries.length;await instance.mailer.flush();assert.equal(deliveries.length,before,'Already forwarded messages must not be sent twice.');
  r=await get('/api/admin/mail/test',{method:'POST',headers});assert.equal(r.response.status,200);assert.equal(deliveries.at(-1).replyTo,undefined);
  await stop();
  instance=createApp({dataDir:dir,initialPassword:'Test-Only-Studio-Password-42',mailOptions:{transportFactory:factory,automatic:false,env:{}}});
  server=instance.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;
  await login();status=(await get('/api/admin/mail',{headers})).body;assert.equal(status.configured,true);assert.equal(status.username,'mail-test@example.com');assert.equal(status.counts.sent,2);
  r=await get('/api/admin/mail',{method:'DELETE',headers});assert.equal(r.response.status,200);assert.equal(r.body.configured,false);
  assert.equal(instance.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,2,'Disconnecting must not delete inquiries.');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
});
