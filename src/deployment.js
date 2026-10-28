import {request} from './api';
export const STATIC_DEPLOYMENT=import.meta.env.VITE_PORTFOLIO_MODE==='static';
export async function loadPortfolio(){
 const url=STATIC_DEPLOYMENT?'/portfolio.snapshot.json':'/api/portfolio';
 const data=await request(url,STATIC_DEPLOYMENT?{credentials:'omit',cache:'no-cache'}:{});
 if(!data?.profile||!Array.isArray(data.projects)||!Array.isArray(data.certificates))throw new Error('The portfolio content is missing or invalid. Please try again.');
 return data;
}
