// Public, fixed-recipient form relay. No Gmail password, API secret, CC, webhook,
// autoresponder, or navigation target is accepted from visitor-controlled fields.
export const CONTACT_TOPICS=['Full-time role','Internship','Collaboration','Other'];
export const FORM_PROVIDER='FormSubmit';
export const FORM_PRIVACY_URL='https://formsubmit.co/privacy.pdf';
export class ContactDeliveryError extends Error{
 constructor(code,message){super(message);this.name='ContactDeliveryError';this.code=code;}
}
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function contactValues(values){
 const get=key=>typeof values?.[key]==='string'?values[key].trim():'';
 const name=get('name'),email=get('email'),opportunity=get('opportunity'),message=get('message');
 if(!name||name.length>120||/[\r\n]/.test(name))throw new ContactDeliveryError('validation','Please enter your name (up to 120 characters).');
 if(!emailPattern.test(email)||email.length>200)throw new ContactDeliveryError('validation','Please enter a valid email address so I can reply.');
 if(!CONTACT_TOPICS.includes(opportunity))throw new ContactDeliveryError('validation','Please choose an opportunity type.');
 if(message.length<15||message.length>5000)throw new ContactDeliveryError('validation','Please write a message between 15 and 5,000 characters.');
 if(get('website'))throw new ContactDeliveryError('validation','Please leave the extra website field empty and try again.');
 return {name,email,opportunity,message,website:''};
}
export function formEndpoint(recipient){
 const email=String(recipient||'').trim();
 if(!emailPattern.test(email)||email.length>200)throw new ContactDeliveryError('configuration','The contact email is not configured correctly.');
 return 'https://formsubmit.co/ajax/'+encodeURIComponent(email);
}
export function formPayload(values){
 const clean=contactValues(values);
 return {name:clean.name,email:clean.email,opportunity:clean.opportunity,message:clean.message,_replyto:clean.email,_subject:'Portfolio inquiry — '+clean.opportunity,_template:'table',_honey:''};
}
export async function submitHostedContact(recipient,values,{fetchImpl=globalThis.fetch,timeoutMs=25000}={}){
 const endpoint=formEndpoint(recipient);const payload=formPayload(values);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  let result;try{result=await response.json();}catch{throw new ContactDeliveryError('unconfirmed','The email service returned an unexpected response. Delivery could not be confirmed; your message is still here.');}
  const providerMessage=typeof result?.message==='string'?result.message:'';
  if(/needs? activation|awaiting activation|activate (?:your|the|this) form|activation (?:is|required)|confirm (?:your|the) email|verify (?:your|the) email/i.test(providerMessage))throw new ContactDeliveryError('activation','Email delivery is awaiting the site owner’s one-time activation. Your message has not been confirmed; please use the email address shown on this page for now.');
  if(response.status===429)throw new ContactDeliveryError('rate-limit','The email service is receiving too many requests. Please wait before trying again.');
  const accepted=result?.success===true||result?.success==='true';
  if(!response.ok||!accepted||result?.error)throw new ContactDeliveryError('rejected','The email service could not accept your message. Please try again later, or use the email address shown on this page.');
  return {accepted:true,provider:FORM_PROVIDER};
 }catch(error){
  if(error instanceof ContactDeliveryError)throw error;
  if(error?.name==='AbortError')throw new ContactDeliveryError('timeout','Delivery could not be confirmed before the request timed out. Your message is still here; please wait before trying again.');
  throw new ContactDeliveryError('network','Could not confirm delivery. Check your connection and try again later; your message has not been cleared.');
 }finally{clearTimeout(timeout);}
}
