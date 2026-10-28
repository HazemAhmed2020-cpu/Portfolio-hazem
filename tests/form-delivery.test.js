import test from 'node:test';
import assert from 'node:assert/strict';
import {contactValues,formEndpoint,formPayload,submitHostedContact}from'../shared/form-delivery.js';
const fields={name:'Test visitor',email:'visitor@example.com',opportunity:'Collaboration',message:'This is a synthetic contact form test, not a real inquiry.',website:''};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('The relay has a fixed recipient and forwards only allowed fields',async()=>{
 let request;
 const result=await submitHostedContact('owner@example.com',{...fields,_cc:'not-authorized@example.com',_webhook:'https://example.com/hook',_autoresponse:'Do not send this',recipient:'other@example.com'},{fetchImpl:async(url,options)=>{request={url,options};return response({success:'true'});}});
 assert.equal(result.accepted,true);assert.equal(decodeURIComponent(new URL(request.url).pathname),'/ajax/owner@example.com');
 assert.equal(request.options.method,'POST');assert.equal(request.options.credentials,'omit');
 const body=JSON.parse(request.options.body);
 assert.equal(body.email,fields.email);assert.equal(body._replyto,fields.email);assert.equal(body._template,'table');
 assert.equal(body._subject,'Portfolio inquiry — Collaboration');
 for(const key of ['_cc','_autoresponse','_webhook','_next','_captcha','recipient'])assert.equal(key in body,false);
});

test('Activation-required HTTP 200 is not reported as a sent message',async()=>{
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>response({success:'false',message:'This form needs Activation. We sent an Activate Form email.'})}),error=>error.code==='activation');
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>response({success:false,message:'Rejected'})}),error=>error.code==='rejected');
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>response({success:'false'})}),error=>error.code==='rejected');
});

test('Only explicit acceptance succeeds; HTTP errors, HTML, and network failures do not',async()=>{
 assert.equal((await submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>response({success:true})})).accepted,true);
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>response({success:true},500)}),error=>error.code==='rejected');
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>response({success:false},429)}),error=>error.code==='rate-limit');
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw new Error('HTML challenge');}})}),error=>error.code==='unconfirmed');
 await assert.rejects(submitHostedContact('owner@example.com',fields,{fetchImpl:async()=>{throw new TypeError('Network failure');}}),error=>error.code==='network');
});

test('Timeouts remain unconfirmed and requests are never automatically repeated',async()=>{
 let calls=0;
 await assert.rejects(submitHostedContact('owner@example.com',fields,{timeoutMs:5,fetchImpl:(_url,{signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('Aborted'),{name:'AbortError'})),{once:true}));}}),error=>error.code==='timeout');
 assert.equal(calls,1);
});

test('Invalid fields and honeypot entries are rejected before any email request',()=>{
 assert.equal(contactValues({...fields,name:' Test visitor '}).name,'Test visitor');
 for(const invalid of [{name:''},{email:'invalid'},{opportunity:'Injected subject\r\nBcc: x'},{message:'short'},{website:'bot-entry'}])assert.throws(()=>formPayload({...fields,...invalid}));
 assert.throws(()=>formEndpoint('not an email'));
});
