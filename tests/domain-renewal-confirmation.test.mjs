import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
let calls=0,expiry='2027-09-12T00:00:00.000Z',registrarId='registrar-a';
let row={id:'renewal-a',partnerId:'partner-a',domainOrderId:'order-a',hostname:'business-a.com',registrarOrderId:'registrar-a',expectedExpiry:new Date(expiry),confirmedExpiry:null,years:1,amountMinor:500000n,quoteExpiresAt:new Date(),status:'CHECKOUT_PENDING',paymentReference:'payment-a',checkoutUrl:null};
let payment={domain:'live',reference:'payment-a',amountMinor:500000,currency:'NGN',metadata:{payment_scope:'sureimports_domain_renewal',platformRenewalId:row.id}};
globalThis.__renewDb={
 $queryRaw:async(s,...v)=>v[0]===row.id&&v[1]===row.partnerId?[row]:[],
 $executeRaw:async(s,...v)=>{const q=s.join('?');if(q.includes('UPDATE domain_platform_orders'))return 1;if(q.includes("SET status='RENEWING'")){if(row.status!=='CHECKOUT_PENDING')return 0;row.status='RENEWING';return 1;}if(q.includes("SET status='RECONCILIATION_REQUIRED'")){row.status='RECONCILIATION_REQUIRED';return 1;}if(q.includes("SET status='RENEWED'")){if(!['RENEWING','RECONCILIATION_REQUIRED'].includes(row.status))return 0;row.status='RENEWED';row.confirmedExpiry=v[0];return 1;}throw new Error(q);}
};globalThis.__renewDb.$transaction=fn=>fn(globalThis.__renewDb);
globalThis.__renewRegistrar={getRegistration:async()=>({orderId:registrarId,active:true,expiresAt:expiry}),renewRegistration:async()=>{calls++;throw new Error('Synthetic ambiguous response');}};
globalThis.__renewPayment=()=>payment;
const hook=registerHooks({resolve(s,c,next){const inline=code=>({url:`data:text/javascript,${encodeURIComponent(code)}`,shortCircuit:true});
 if(s==='./platform-pricing')return inline('export async function buildPlatformDomainQuote(){}');
 if(s==='server-only')return inline('export{}');
 if(s==='@/lib/prisma')return inline('export const prisma=globalThis.__renewDb');
 if(s==='@/lib/admin-settings')return inline('export async function applyAdminSettingsToProcessEnv(){}');
 if(s==='@/lib/payments/domain-checkout')return inline('export async function buildDomainQuote(){}');
 if(s==='@/lib/payments/course-checkout')return inline('export async function initializeStripe(){};export async function retrieveStripeSession(){return globalThis.__renewPayment()};export async function initializePaystack(){};export async function verifyPaystackTransaction(){return globalThis.__renewPayment()};export const siteBaseUrl=()=>"https://service.example.com"');
 if(s==='node:module'&&c.parentURL?.endsWith('/platform-renewals.ts'))return inline('export const createRequire=()=>p=>p.includes("domain-client")?{selectedDomainProviderName:()=>"resellerclub"}:globalThis.__renewRegistrar');
 return next(s,c);
}});
const {completePlatformRenewal}=await import('../lib/domain/platform-renewals.ts');hook.deregister();
test('operator-frozen renewals do not contact the payment or registrar providers',async()=>{
 const previous=row.status;row.status='TRANSFERRED';
 assert.equal((await completePlatformRenewal(row.id,row.partnerId)).status,'TRANSFERRED');
 assert.equal(calls,0);row.status=previous;
});
test('wrong owner, amount or registrar reference cannot trigger renewal',async()=>{
 await assert.rejects(completePlatformRenewal(row.id,'partner-b'),/not found/);
 payment={...payment,amountMinor:1};await assert.rejects(completePlatformRenewal(row.id,row.partnerId),/reconciliation/);payment={...payment,amountMinor:500000};
 registrarId='other-registrar';await assert.rejects(completePlatformRenewal(row.id,row.partnerId),/ownership/);registrarId='registrar-a';assert.equal(calls,0);
});
test('payment alone never marks renewed; uncertain retries inspect expiry without another registrar charge',async()=>{
 const pending=await completePlatformRenewal(row.id,row.partnerId);assert.equal(pending.status,'RECONCILIATION_REQUIRED');assert.equal(pending.expiresAt,null);assert.equal(calls,1);
 await completePlatformRenewal(row.id,row.partnerId);assert.equal(calls,1);
 expiry='2028-09-12T00:00:00.000Z';const confirmed=await completePlatformRenewal(row.id,row.partnerId);assert.equal(confirmed.status,'RENEWED');assert.equal(confirmed.expiresAt,expiry);assert.equal(calls,1);
 await completePlatformRenewal(row.id,row.partnerId);assert.equal(calls,1);
});
