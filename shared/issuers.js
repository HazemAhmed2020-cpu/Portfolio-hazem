// Exact issuer matching: each institute keeps its own supplied brand mark.
const LOGOS=Object.freeze({ITI:'/images/iti-logo.png',NTI:'/images/nti-logo.png',MCIT:'/images/mcit-logo.png',AM:'/images/africa-matters-logo.png'});
export function issuerLogo(shortIssuer=''){
  return LOGOS[shortIssuer.trim().toUpperCase()]||'';
}
