// Telephone destinations are derived only from a validated phone string.
export function phoneHref(value=''){
 const text=String(value||'').trim();
 if(!/^\+?[0-9 ()-]+$/.test(text))return '';
 const digits=text.replace(/\D/g,'');
 if(digits.length<7||digits.length>15)return '';
 return 'tel:'+(text.startsWith('+')?'+':'')+digits;
}
