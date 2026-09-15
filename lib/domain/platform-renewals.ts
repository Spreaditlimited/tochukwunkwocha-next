import 'server-only';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { applyAdminSettingsToProcessEnv } from '@/lib/admin-settings';
import { buildDomainQuote } from '@/lib/payments/domain-checkout';
import { initializePaystack,initializeStripe,retrieveStripeSession,verifyPaystackTransaction,siteBaseUrl } from '@/lib/payments/course-checkout';
import { buildPlatformDomainQuote } from './platform-pricing';
const require=createRequire(import.meta.url);
type Registration={orderId:string;active:boolean;expiresAt:string};
const registrar=require('./providers/resellerclub.js') as {getRegistration:(i:{domainName:string})=>Promise<Registration>;renewRegistration:(i:{domainName:string;years:number;expectedExpiry:string})=>Promise<Registration>;getRegistrationPrice:(i:{domainName:string;years:number;operation:string})=>Promise<{amountMinor:number;currency:string}>};
const client=require('../domain-client.cjs') as {selectedDomainProviderName:()=>string};
export const renewalCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('renew-quote'),country:z.enum(['NG','GB']).default('NG'),partnerId:z.string().min(1).max(191),orderId:z.string().max(80),years:z.number().int().min(1).max(5)}).strict(),
 z.object({action:z.literal('renew-checkout'),country:z.enum(['NG','GB']).default('NG'),partnerId:z.string().min(1).max(191),renewalId:z.string().max(80),acceptedTotalMinor:z.number().int().positive(),email:z.string().email().max(191),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('renew-status'),partnerId:z.string().min(1).max(191),renewalId:z.string().max(80)}).strict(),
 z.object({action:z.literal('renew-list'),partnerId:z.string().min(1).max(191)}).strict(),
]);
type Row={country:string;currency:string;paymentProvider:string;id:string;partnerId:string;domainOrderId:string;hostname:string;registrarOrderId:string;expectedExpiry:Date;confirmedExpiry:Date|null;years:number;amountMinor:bigint;quoteExpiresAt:Date;status:string;paymentReference:string|null;checkoutUrl:string|null};
function dto(r:Row){return {renewalId:r.id,orderId:r.domainOrderId,hostname:r.hostname,years:r.years,amountMinor:Number(r.amountMinor),currency:r.currency||'NGN',status:r.status,checkoutUrl:r.checkoutUrl,expiresAt:r.confirmedExpiry?.toISOString()||null};}
async function owned(partnerId:string,id:string){const [r]=await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_renewals WHERE id=${id} AND partnerId=${partnerId}`;if(!r)throw new Error('Renewal not found.');return r;}
async function configured(){await applyAdminSettingsToProcessEnv();if(client.selectedDomainProviderName()!=='resellerclub')throw new Error('Registrar renewal confirmation is not configured.');}
export async function confirmedRenewalQuote(hostname:string,years:number) {
 await configured();
 return buildDomainQuote(hostname,years,'NG',await registrar.getRegistrationPrice({domainName:hostname,years,operation:'renew'}));
}
export async function platformRenewalCommand(input:z.infer<typeof renewalCommand>){
 input=renewalCommand.parse(input);
 await configured();
 if(input.action==='renew-list'){const rows=await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_renewals WHERE partnerId=${input.partnerId} ORDER BY createdAt DESC LIMIT 30`;return {renewals:rows.map(dto)};}
 if(input.action==='renew-quote'){
  const [domain]=await prisma.$queryRaw<{id:string;hostname:string;registrarOrderId:string}[]>`SELECT id,hostname,registrarOrderId FROM domain_platform_orders WHERE id=${input.orderId} AND partnerId=${input.partnerId} AND status='REGISTERED'`;
  if(!domain)throw new Error('Registered domain not found.');
  const current=await registrar.getRegistration({domainName:domain.hostname});
  if(!current.active||current.orderId!==domain.registrarOrderId||new Date(current.expiresAt)<=new Date())throw new Error('This domain needs registrar review before renewal.');
  const expiry=new Date(current.expiresAt);
  const [existing]=await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_renewals WHERE domainOrderId=${domain.id} AND expectedExpiry=${expiry}`;
  if(existing&&existing.status!=='QUOTED')return dto(existing);
  const quote=await buildPlatformDomainQuote(domain.hostname,input.years,input.country,'renew'),id=existing?.id||`SPR_${randomUUID()}`,until=new Date(Date.now()+900000);
  if(existing)await prisma.$executeRaw`UPDATE domain_platform_renewals SET country=${input.country},currency=${quote.currency},paymentProvider=${quote.provider},pricingJson=${JSON.stringify(quote)},amountMinor=${quote.totalAmountMinor},years=${input.years},quoteExpiresAt=${until},updatedAt=NOW(3) WHERE id=${id} AND status='QUOTED'`;
  else await prisma.$executeRaw`INSERT INTO domain_platform_renewals(id,partnerId,domainOrderId,hostname,registrarOrderId,expectedExpiry,years,amountMinor,quoteExpiresAt,country,currency,paymentProvider,pricingJson) VALUES(${id},${input.partnerId},${domain.id},${domain.hostname},${current.orderId},${expiry},${input.years},${quote.totalAmountMinor},${until},${input.country},${quote.currency},${quote.provider},${JSON.stringify(quote)})`;
  return dto(await owned(input.partnerId,id));
 }
 const row=await owned(input.partnerId,input.renewalId);
 if(input.action==='renew-status')return completePlatformRenewal(row.id,input.partnerId);
 if ((row.country||'NG') !== input.country) throw new Error('This quote uses a different billing country. Request a fresh quote.');
 if(row.checkoutUrl)return dto(row);
 if(row.status!=='QUOTED'||row.quoteExpiresAt<=new Date()||Number(row.amountMinor)!==input.acceptedTotalMinor)throw new Error('Renewal quote expired or checkout is already in progress. Check status before trying again.');
 if(row.paymentProvider!=='stripe'&&!(process.env.PAYSTACK_SECRET_KEY||'').startsWith('sk_live_'))throw new Error('Live renewal checkout is unavailable.');
 const current=await registrar.getRegistration({domainName:row.hostname});if(current.orderId!==row.registrarOrderId||current.expiresAt!==row.expectedExpiry.toISOString())throw new Error('Registrar expiry changed. Request a fresh quote.');
 if(row.paymentProvider==='stripe'&&!(process.env.STRIPE_SECRET_KEY||'').startsWith('sk_live_'))throw new Error('Card checkout is temporarily unavailable.');
 const ref=`SPR_${randomUUID().replaceAll('-','')}`;
 const changed=await prisma.$executeRaw`UPDATE domain_platform_renewals SET status='CHECKOUT_PENDING',paymentReference=${ref},updatedAt=NOW(3) WHERE id=${row.id} AND status='QUOTED' AND amountMinor=${input.acceptedTotalMinor} AND quoteExpiresAt>NOW(3)`;
 if(!changed)throw new Error('Checkout is already being created. Check status.');
 const checkout=row.paymentProvider==='stripe'?await initializeStripe({email:input.email,amountMinor:Number(row.amountMinor),currency:row.currency,courseName:row.hostname+' domain renewal',orderUuid:row.id,courseSlug:'sureimports-domain',idempotencyKey:row.id,metadata:{payment_scope:'sureimports_domain_renewal',platformRenewalId:row.id},successUrl:siteBaseUrl()+'/api/platform/domains/return',cancelUrl:'https://partner.sureimports.com/partners/dashboard#storefront'}):await initializePaystack({email:input.email,amountMinor:Number(row.amountMinor),currency:'NGN',reference:ref,metadata:{payment_scope:'sureimports_domain_renewal',platformRenewalId:row.id},callbackUrl:`${siteBaseUrl()}/api/platform/domains/return`});
 await prisma.$executeRaw`UPDATE domain_platform_renewals SET paymentReference=${checkout.providerReference||ref},checkoutUrl=${checkout.checkoutUrl},updatedAt=NOW(3) WHERE id=${row.id}`;
 return dto(await owned(input.partnerId,row.id));
}
export async function completePlatformRenewal(id:string,partnerId?:string,legacyCheckoutUuid?:string){
 await configured();const [row]=partnerId?[await owned(partnerId,id)]:await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_renewals WHERE id=${id} OR paymentReference=${id} LIMIT 1`;
 if(!row)throw new Error('Renewal not found.');if(row.status==='RENEWED'||!row.paymentReference)return dto(row);
 if(!['CHECKOUT_PENDING','RENEWING','RECONCILIATION_REQUIRED'].includes(row.status))return dto(row);
 const payment=row.paymentProvider==='stripe'?await retrieveStripeSession(row.paymentReference).then(p=>({...p,reference:p.id,domain:p.livemode?'live':'test'})):await verifyPaystackTransaction(row.paymentReference);
 const metadataMatches=legacyCheckoutUuid?row.id===`legacy:${legacyCheckoutUuid}`&&row.partnerId.startsWith('legacy-student:')&&payment.metadata?.domain_renewal_uuid===legacyCheckoutUuid&&payment.metadata?.payment_scope==='domain_renewal':payment.metadata?.platformRenewalId===row.id&&payment.metadata?.payment_scope==='sureimports_domain_renewal';
 if(payment.domain!=='live'||payment.reference!==row.paymentReference||payment.amountMinor!==Number(row.amountMinor)||payment.currency!==(row.currency||'NGN')||!metadataMatches)throw new Error('Renewal payment requires reconciliation.');
 const current=await registrar.getRegistration({domainName:row.hostname});
 if(current.orderId!==row.registrarOrderId)throw new Error('Registrar ownership changed. Manual review required.');
 if(row.status==='CHECKOUT_PENDING'){
  if(current.expiresAt!==row.expectedExpiry.toISOString())throw new Error('Registrar expiry changed before this renewal. Reconcile this payment manually.');
  const claim=await prisma.$executeRaw`UPDATE domain_platform_renewals SET status='RENEWING',updatedAt=NOW(3) WHERE id=${row.id} AND status='CHECKOUT_PENDING'`;
  if(claim){try{await registrar.renewRegistration({domainName:row.hostname,years:row.years,expectedExpiry:row.expectedExpiry.toISOString()});}catch{await prisma.$executeRaw`UPDATE domain_platform_renewals SET status='RECONCILIATION_REQUIRED',updatedAt=NOW(3) WHERE id=${row.id} AND status='RENEWING'`;}}
 }
 const after=await registrar.getRegistration({domainName:row.hostname});const target=new Date(row.expectedExpiry);target.setUTCFullYear(target.getUTCFullYear()+row.years);
 if(after.active&&after.orderId===row.registrarOrderId&&new Date(after.expiresAt)>=target){
  const expiry=new Date(after.expiresAt);
  await prisma.$transaction(async tx=>{const updated=await tx.$executeRaw`UPDATE domain_platform_renewals SET status='RENEWED',confirmedExpiry=${expiry},updatedAt=NOW(3) WHERE id=${row.id} AND status IN ('RENEWING','RECONCILIATION_REQUIRED')`;if(updated)await tx.$executeRaw`UPDATE domain_platform_orders SET expiresAt=${expiry},updatedAt=NOW(3) WHERE id=${row.domainOrderId} AND partnerId=${row.partnerId}`;});
 }
 // An ambiguous registrar call is only inspected on retry, never repeated.
 return dto(await owned(row.partnerId,row.id));
}
