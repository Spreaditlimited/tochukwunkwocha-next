import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac,randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
process.env.SUREIMPORTS_DOMAIN_SERVICE_SECRET='synthetic-domain-signing-key-'.repeat(3);
process.env.PAYSTACK_SECRET_KEY='sk_live_synthetic_never_sent';
let orders=[],nonces=new Set(),registrations=0,payment=null,registrarUnavailable=true;
const sql=(s)=>s.join('?');
globalThis.__bridgeDb={
 $queryRaw:async(s,...v)=>{
  const q=sql(s);
  if(q.includes('COUNT(*)'))return[{total:BigInt(orders.length)}];
  if(q.includes('WHERE hostname='))return orders.filter(o=>o.hostname===v[0]);
  if(q.includes('OR paymentReference='))return orders.filter(o=>o.id===v[0]||o.paymentReference===v[1]);
  if(q.includes('WHERE id=')&&q.includes('AND partnerId='))return orders.filter(o=>o.id===v[0]&&o.partnerId===v[1]);
  if(q.includes('WHERE partnerId='))return orders.filter(o=>o.partnerId===v[0]);
  throw new Error(`Unhandled test query: ${q}`);
 },
 $executeRaw:async(s,...v)=>{
  const q=sql(s);
  if(q.includes('INSERT INTO domain_platform_nonces')){if(nonces.has(v[0]))throw new Error('Duplicate nonce');nonces.add(v[0]);return 1;}
  if(q.includes('INSERT INTO domain_platform_orders')){orders.push({id:v[0],partnerId:v[1],hostname:v[2],years:v[3],amountMinor:BigInt(v[4]),quoteExpiresAt:v[5],status:'QUOTED',paymentReference:null,registrantCiphertext:null,registrarOrderId:null,expiresAt:null,checkoutUrl:null});return 1;}
  const row=orders.find(o=>v.includes(o.id));if(!row)throw new Error(`Missing row: ${q}`);
  if(q.includes("SET status='CHECKOUT_PENDING'")){if(row.status!=='QUOTED')return 0;Object.assign(row,{status:'CHECKOUT_PENDING',paymentReference:v[0],registrantCiphertext:v[1]});return 1;}
  if(q.includes('SET checkoutUrl=')){row.checkoutUrl=v[0];return 1;}
  if(q.includes("SET status='REGISTERING'")){if(row.status!=='CHECKOUT_PENDING')return 0;row.status='REGISTERING';return 1;}
  if(q.includes("SET status='RECONCILIATION_REQUIRED'")){row.status='RECONCILIATION_REQUIRED';return 1;}
  if(q.includes("SET status='REGISTERED'")){if(!['REGISTERING','RECONCILIATION_REQUIRED'].includes(row.status))return 0;Object.assign(row,{status:'REGISTERED',registrarOrderId:v[0],expiresAt:v[1]});return 1;}
  if(q.includes('SET expiresAt=')){row.expiresAt=v[0];return 1;}
  throw new Error(`Unhandled mutation: ${q}`);
 }
};
globalThis.__bridgeClient={selectedDomainProviderName:()=> 'resellerclub',checkAvailability:async()=>({available:true}),registerDomain:async input=>{registrations++;assert.equal(input.registrantCompany,'Business A Ltd');throw new Error('Synthetic timeout after registrar submission');}};
globalThis.__bridgeRegistrar={getRegistration:async({domainName})=>{if(registrarUnavailable)throw new Error('Still pending');return{domainName,orderId:'registrar-1',active:true,expiresAt:'2027-09-12T00:00:00.000Z',registrantEmail:'owner@example.com'};}};
globalThis.__bridgeInitialize=async input=>{payment={domain:'live',reference:input.reference,currency:'NGN',amountMinor:input.amountMinor,metadata:input.metadata};return{checkoutUrl:'https://checkout.paystack.com/synthetic'};};
globalThis.__bridgeVerify=async()=>payment;
const hooks=registerHooks({resolve(s,c,next){const inline=code=>({url:`data:text/javascript,${encodeURIComponent(code)}`,shortCircuit:true});
 if(s==='server-only')return inline('export{}');
 if(s==='@/lib/prisma')return inline('export const prisma=globalThis.__bridgeDb');
 if(s==='@/lib/admin-settings')return inline('export async function applyAdminSettingsToProcessEnv(){}');
 if(s==='@/lib/payments/domain-checkout')return inline('export const supportedCheckoutDomain=v=>v;export async function buildDomainQuote(){return {totalAmountMinor:500000}}');
 if(s==='@/lib/payments/course-checkout')return inline('export const initializePaystack=globalThis.__bridgeInitialize;export const verifyPaystackTransaction=globalThis.__bridgeVerify;export const siteBaseUrl=()=>"https://service.example.com"');
 if(s==='node:module'&&c.parentURL?.endsWith('/platform-orders.ts'))return inline('export const createRequire=()=>p=>p.includes("domain-client")?globalThis.__bridgeClient:globalThis.__bridgeRegistrar');
 return next(s,c);
}});
const {platformCommand,platformDomainCommand,completePlatformDomainPayment}=await import('../lib/domain/platform-orders.ts');
const {verifyDomainPlatformRequest}=await import('../lib/domain/platform-auth.ts');hooks.deregister();
test('signed service requests reject tampering and replay across instances',async()=>{
 const body=JSON.stringify({action:'list',partnerId:'a'}),timestamp=String(Date.now()),nonce=randomUUID(),path='/api/platform/domains';
 const signature=createHmac('sha256',process.env.SUREIMPORTS_DOMAIN_SERVICE_SECRET).update(`${timestamp}\n${nonce}\nPOST\n${path}\n${body}`).digest('hex');
 const request=new Request(`https://service.example.com${path}`,{method:'POST',headers:{'x-platform-timestamp':timestamp,'x-platform-nonce':nonce,'x-platform-signature':signature}});
 await assert.rejects(verifyDomainPlatformRequest(request,`${body} `),/signature/);
 await verifyDomainPlatformRequest(request,body);
 await assert.rejects(verifyDomainPlatformRequest(request,body),/Duplicate/);
});
test('strict purchase contract rejects client-owned status and missing business registrant',()=>{
 assert.equal(platformCommand.safeParse({action:'quote',partnerId:'a',hostname:'business-a.com',years:1,status:'REGISTERED'}).success,false);
 assert.equal(platformCommand.safeParse({action:'checkout',partnerId:'a',quoteId:'id',acceptedTotalMinor:1,confirmed:true,registrant:{}}).success,false);
});
test('operator-frozen domain orders cannot restart registration',async()=>{
 const item={id:'frozen-domain',partnerId:'frozen-partner',hostname:'frozen-business.com',status:'TRANSFERRED',paymentReference:'not-to-be-verified',amountMinor:1n,quoteExpiresAt:new Date(),expiresAt:null};
 orders.push(item);
 const before=registrations;
 assert.equal((await completePlatformDomainPayment(item.id,item.partnerId)).status,'TRANSFERRED');
 assert.equal(registrations,before);
 orders.splice(orders.indexOf(item),1);
});
test('quotes and payments enforce immutable partner scope, accepted amount and reuse checkout',async()=>{
 const quote=await platformDomainCommand({action:'quote',partnerId:'a',hostname:'business-a.com',years:1});
 await assert.rejects(platformDomainCommand({action:'status',partnerId:'b',orderId:quote.orderId}),/not found/);
 const input={action:'checkout',partnerId:'a',quoteId:quote.quoteId,acceptedTotalMinor:quote.amountMinor,confirmed:true,registrant:{company:'Business A Ltd',fullName:'Business Owner',email:'owner@example.com',address1:'10 Business Street',city:'Lagos',state:'Lagos',postalCode:'100001',phone:'+2348000000000'}};
 await assert.rejects(platformDomainCommand({...input,acceptedTotalMinor:1}),/Quote/);
 const checkout=await platformDomainCommand(input);assert.equal(checkout.status,'CHECKOUT_PENDING');
 assert.equal((await platformDomainCommand(input)).checkoutUrl,checkout.checkoutUrl);
 assert.ok(!JSON.stringify(checkout).includes('Business Owner'));assert.ok(!orders[0].registrantCiphertext.includes('Business Owner'));
});
test('forged payment evidence cannot register; an ambiguous registrar call is never repeated',async()=>{
 const row=orders[0];payment={...payment,currency:'USD'};
 await assert.rejects(completePlatformDomainPayment(row.id,'a'),/reconciliation/);assert.equal(registrations,0);
 payment={...payment,currency:'NGN'};
 const pending=await completePlatformDomainPayment(row.id,'a');assert.equal(pending.status,'RECONCILIATION_REQUIRED');assert.equal(registrations,1);
 await completePlatformDomainPayment(row.id,'a');assert.equal(registrations,1);
 registrarUnavailable=false;const complete=await completePlatformDomainPayment(row.id,'a');assert.equal(complete.status,'REGISTERED');assert.equal(registrations,1);
 await completePlatformDomainPayment(row.id,'a');assert.equal(registrations,1);
});
