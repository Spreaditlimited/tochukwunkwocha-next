import 'server-only';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const registrar=require('./providers/resellerclub.js') as {getPlatformFundingBalance:()=>Promise<{currency:string;amountMinor:number}>;getPlatformCostPrice:(input:{domainName:string;years:number;operation:string})=>Promise<{currency:string;amountMinor:number}>};
export async function assertPlatformDomainFunding(hostname:string,years:number,operation:'register'|'renew') {
 try {
  const [balance,cost]=await Promise.all([registrar.getPlatformFundingBalance(),registrar.getPlatformCostPrice({domainName:hostname,years,operation})]);
  if(!['USD','GBP','NGN'].includes(balance.currency)||!Number.isSafeInteger(balance.amountMinor)||balance.amountMinor<0)throw new Error('Unverified balance');
  const requiredMinor=cost.amountMinor;
  if(cost.currency!==balance.currency||!Number.isSafeInteger(requiredMinor)||requiredMinor<=0||balance.amountMinor<requiredMinor)throw new Error('Insufficient registrar funds');
  return {currency:balance.currency,requiredMinor};
 } catch {
  throw new Error('Domain registration or renewal is temporarily unavailable. Please contact support. If you have already paid, your payment remains recorded; do not pay again.');
 }
}
