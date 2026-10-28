import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function safeMailError(error){
  if(error?.code==='EAUTH')return 'Gmail rejected the credentials. Use a valid App Password, not your account password.';
  if(['ETIMEDOUT','ECONNECTION','ESOCKET','ECONNREFUSED','EDNS'].includes(error?.code))return 'The server could not reach Gmail SMTP. Check outbound port 465 and try again.';
  return 'Email forwarding failed. The original message is still safe in the Studio inbox.';
}

export function createMailEngine({db,dataDir,getProfile,transportFactory=options=>nodemailer.createTransport(options),env=process.env,automatic=true}){
  const columns=new Set(db.prepare('PRAGMA table_info(messages)').all().map(c=>c.name));
  const additions={email_status:"TEXT NOT NULL DEFAULT 'not_configured'",email_attempts:'INTEGER NOT NULL DEFAULT 0',email_error:"TEXT NOT NULL DEFAULT ''",email_sent_at:'TEXT',email_next_attempt:'INTEGER NOT NULL DEFAULT 0'};
  for(const [name,type] of Object.entries(additions))if(!columns.has(name))db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`);
  db.prepare("UPDATE messages SET email_status='pending' WHERE email_status='sending'").run();
  const secretDir=path.join(dataDir,'private');
  const configPath=path.join(secretDir,'gmail.enc.json');
  const keyPath=path.join(secretDir,'gmail.key');
  let disposed=false,running=null,timer=null,startTimer=null;
  const managed=()=>Boolean(env.GMAIL_USER&&env.GMAIL_APP_PASSWORD);
  function key(create=false){
    if(!fs.existsSync(keyPath)){
      if(!create)throw new Error('Email key is missing.');
      fs.mkdirSync(secretDir,{recursive:true,mode:0o700});
      fs.writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});
    }
    return fs.readFileSync(keyPath);
  }
  function readAuth(){
    if(managed())return {username:env.GMAIL_USER.trim(),password:env.GMAIL_APP_PASSWORD.replace(/\s/g,''),verifiedAt:null,source:'environment'};
    if(!fs.existsSync(configPath))return null;
    const stored=JSON.parse(fs.readFileSync(configPath,'utf8'));
    const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(stored.iv,'base64'));
    decipher.setAuthTag(Buffer.from(stored.tag,'base64'));
    return {...JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.data,'base64')),decipher.final()]).toString('utf8')),source:'studio'};
  }
  function writeAuth(auth){
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(true),iv);
    const data=Buffer.concat([cipher.update(JSON.stringify(auth),'utf8'),cipher.final()]);
    const stored={version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
    const temporary=configPath+'.tmp-'+randomBytes(6).toString('hex');
    fs.writeFileSync(temporary,JSON.stringify(stored),{mode:0o600,flag:'wx'});fs.renameSync(temporary,configPath);
  }
  function configured(){try{return Boolean(readAuth());}catch{return false;}}
  function status(){
    let auth=null,error='';try{auth=readAuth();}catch{error='The saved email configuration cannot be opened. Reconnect Gmail.';}
    const profile=getProfile();
    const counts=db.prepare('SELECT email_status AS status,COUNT(*) AS count FROM messages GROUP BY email_status').all();
    return {configured:Boolean(auth),managedByEnvironment:managed(),username:auth?.username||'',recipient:env.CONTACT_TO||profile.email,verifiedAt:auth?.verifiedAt||null,error,counts:Object.fromEntries(counts.map(row=>[row.status,row.count]))};
  }
  function transport(auth){
    return transportFactory({host:'smtp.gmail.com',port:465,secure:true,auth:{user:auth.username,pass:auth.password},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000,tls:{minVersion:'TLSv1.2'},logger:false,debug:false});
  }
  async function configure(username,password){
    if(managed())throw Object.assign(new Error('Gmail is managed by hosting environment variables. Update those variables instead.'),{publicMessage:true});
    const auth={username:username.trim(),password:password.replace(/\s/g,''),verifiedAt:new Date().toISOString()};
    const client=transport(auth);
    try{await client.verify();}finally{client.close?.();}
    writeAuth(auth);
    return status();
  }
  function disconnect(){
    if(managed())throw Object.assign(new Error('Remove the Gmail environment variables on your host to disconnect this account.'),{publicMessage:true});
    if(fs.existsSync(configPath))fs.unlinkSync(configPath);
    return status();
  }
  async function send(message,test=false){
    const auth=readAuth();if(!auth)throw Object.assign(new Error('Connect Gmail before sending email.'),{publicMessage:true});
    const profile=getProfile(),to=env.CONTACT_TO||profile.email;
    const subject=test?'Portfolio email connection test':`[Portfolio] ${message.opportunity} — ${message.name.replace(/[\r\n]/g,' ').slice(0,100)}`;
    const text=test?`Your portfolio can submit email to Gmail.\n\nNew contact inquiries will also remain in your Studio inbox.\nRecipient: ${to}\nTime: ${new Date().toISOString()}\n\nIf you see this in spam, mark it as not spam.`:`New portfolio inquiry\n\nName: ${message.name}\nEmail: ${message.email}\nOpportunity: ${message.opportunity}\nReceived: ${message.created_at}\n\n${message.message}\n\nMessage ID: ${message.id}\nReply to this email to contact the sender. A copy is stored in your Portfolio Studio inbox.`;
    const client=transport(auth);
    try{
      const info=await client.sendMail({from:{name:`${profile.name} · Portfolio`,address:auth.username},to,...(!test?{replyTo:{name:message.name,address:message.email}}:{}),subject,text,html:`<div style="font-family:Arial,sans-serif;background:#f4f6fc;padding:30px;color:#263a5c"><div style="max-width:620px;margin:auto;background:white;border:1px solid #dce4f3;border-radius:10px;padding:28px"><div style="color:#5672d6;font-weight:bold;font-size:22px">${escapeHTML(profile.name)} · Portfolio</div><h2 style="font-size:18px;margin-top:28px">${escapeHTML(subject)}</h2><div style="white-space:pre-wrap;font-size:14px;line-height:1.8">${escapeHTML(text)}</div></div></div>`,...(!test?{headers:{'X-Portfolio-Message-ID':message.id}}:{}),disableFileAccess:true,disableUrlAccess:true});
      if(!info.accepted?.length)throw new Error('Recipient was not accepted.');
      return info;
    }finally{client.close?.();}
  }
  async function drain(){
    if(disposed||!configured())return;
    db.prepare("UPDATE messages SET email_status='pending' WHERE email_status='not_configured'").run();
    for(let processed=0;processed<20&&!disposed;processed++){
      if(!configured())break;
      const message=db.prepare("SELECT * FROM messages WHERE email_status IN ('pending','failed') AND email_attempts<5 AND email_next_attempt<=? ORDER BY created_at ASC LIMIT 1").get(Date.now());
      if(!message)break;
      db.prepare("UPDATE messages SET email_status='sending',email_attempts=email_attempts+1 WHERE id=?").run(message.id);
      try{
        await send(message);
        db.prepare("UPDATE messages SET email_status='sent',email_error='',email_sent_at=?,email_next_attempt=0 WHERE id=?").run(new Date().toISOString(),message.id);
      }catch(error){
        const delay=Math.min(60*60*1000,60000*2**message.email_attempts);
        db.prepare("UPDATE messages SET email_status='failed',email_error=?,email_next_attempt=? WHERE id=?").run(safeMailError(error),Date.now()+delay,message.id);
      }
    }
  }
  function flush(){
    if(disposed)return Promise.resolve();
    if(running)return running;
    running=drain().catch(()=>{}).finally(()=>{running=null;});
    return running;
  }
  function retry(){
    if(!configured())throw Object.assign(new Error('Connect Gmail first. No messages have been lost.'),{publicMessage:true});
    db.prepare("UPDATE messages SET email_status='pending',email_attempts=0,email_next_attempt=0,email_error='' WHERE email_status IN ('not_configured','failed','pending')").run();
    void flush();
  }
  if(automatic){timer=setInterval(()=>void flush(),60000);timer.unref();startTimer=setTimeout(()=>void flush(),1000);startTimer.unref();}
  return {configured,status,configure,disconnect,flush,retry,sendTest:()=>send(null,true),async stop(){disposed=true;clearInterval(timer);clearTimeout(startTimer);if(running)await running;}};
}
