import 'server-only';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { buildDomainQuote, supportedCheckoutDomain } from '@/lib/payments/domain-checkout';
import { initializePaystack, verifyPaystackTransaction, siteBaseUrl } from '@/lib/payments/course-checkout';
import { applyAdminSettingsToProcessEnv } from '@/lib/admin-settings';

const require = createRequire(import.meta.url);
type Registration = {domainName:string;orderId:string;active:boolean;expiresAt:string;registrantEmail:string};
const registrar = require('./providers/resellerclub.js') as { getRegistration:(input:{domainName:string})=>Promise<Registration>;addPlatformDnsRecord:(input:{domainName:string;host:string;type:string;value:string})=>Promise<unknown> };
const client = require('../domain-client.cjs') as {selectedDomainProviderName:()=>string;checkAvailability:(input:unknown)=>Promise<{available:boolean}>;registerDomain:(input:unknown)=>Promise<{success:boolean;orderId:string}>};
type Row={id:string;partnerId:string;hostname:string;years:number;amountMinor:bigint;quoteExpiresAt:Date;status:string;paymentReference:string|null;checkoutUrl:string|null;registrantCiphertext:string|null;registrarOrderId:string|null;expiresAt:Date|null};
const profile=z.object({company:z.string().min(2).max(120),fullName:z.string().min(3).max(180),email:z.string().email().max(190),address1:z.string().min(5).max(240),city:z.string().min(2).max(120),state:z.string().min(2).max(120),postalCode:z.string().min(3).max(40),phone:z.string().regex(/^\+234\d{10}$/)}).strict();
export const platformCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('quote'),partnerId:z.string().min(1).max(191),hostname:z.string().max(191),years:z.number().int().min(1).max(5)}).strict(),
 z.object({action:z.literal('checkout'),partnerId:z.string().min(1).max(191),quoteId:z.string().max(80),acceptedTotalMinor:z.number().int().positive(),registrant:profile,confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('status'),partnerId:z.string().min(1).max(191),orderId:z.string().max(80)}).strict(),
 z.object({action:z.literal('list'),partnerId:z.string().min(1).max(191)}).strict(),
 z.object({action:z.literal('dns'),partnerId:z.string().min(1).max(191),orderId:z.string().max(80),records:z.array(z.object({host:z.string().max(191),type:z.enum(['TXT','A','CNAME']),value:z.string().min(1).max(500)}).strict()).min(1).max(12)}).strict(),
]);
function key(){const secret=process.env.SUREIMPORTS_DOMAIN_SERVICE_SECRET;if(!secret||secret.length<32)throw new Error('Platform service unavailable.');return createHash('sha256').update(`domain-registrant-v1:${secret}`).digest();}
function seal(data:unknown,id:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);c.setAAD(Buffer.from(id));const body=Buffer.concat([c.update(JSON.stringify(data)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]).toString('base64');}
function unseal(value:string,id:string){const b=Buffer.from(value,'base64'),c=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));c.setAAD(Buffer.from(id));c.setAuthTag(b.subarray(12,28));return profile.parse(JSON.parse(Buffer.concat([c.update(b.subarray(28)),c.final()]).toString()));}
function result(row:Row){return {orderId:row.id,quoteId:row.id,hostname:row.hostname,amountMinor:Number(row.amountMinor),currency:'NGN',status:row.status,checkoutUrl:row.checkoutUrl,expiresAt:row.expiresAt?.toISOString()||null,quoteExpiresAt:row.quoteExpiresAt.toISOString()};}
async function owned(partnerId:string,id:string){const [row]=await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_orders WHERE id=${id} AND partnerId=${partnerId}`;if(!row)throw new Error('Domain order not found.');return row;}
async function configured(){await applyAdminSettingsToProcessEnv();if(client.selectedDomainProviderName()!=='resellerclub')throw new Error('Platform registration requires the ResellerClub adapter with registration confirmation support.');}
export async function platformDomainCommand(input:z.infer<typeof platformCommand>){
 await configured();
 if(input.action==='list'){const rows=await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_orders WHERE partnerId=${input.partnerId} ORDER BY createdAt DESC LIMIT 30`;return {orders:rows.map(result)};}
 if(input.action==='quote'){
  const hostname=supportedCheckoutDomain(input.hostname);
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:com|net|org|co|io)$/.test(hostname))throw new Error('Choose a supported .com, .net, .org, .co or .io domain.');
  const [existing]=await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_orders WHERE hostname=${hostname}`;
  if(existing){if(existing.partnerId!==input.partnerId)throw new Error('This domain is reserved by another business.');if(existing.status!=='QUOTED')return result(existing);}
  const [count]=await prisma.$queryRaw<{total:bigint}[]>`SELECT COUNT(*) AS total FROM domain_platform_orders WHERE partnerId=${input.partnerId} AND createdAt>DATE_SUB(NOW(),INTERVAL 1 DAY)`;
  if(Number(count.total)>=10&&!existing)throw new Error('Domain quote limit reached. Please try again tomorrow.');
  if(!(await client.checkAvailability({domainName:hostname,strict:true})).available)throw new Error('This domain is not available.');
  const quote=await buildDomainQuote(hostname,input.years,'NG');
  const amount=quote.totalAmountMinor,expiry=new Date(Date.now()+900000),id=existing?.id||`SPD_${randomUUID()}`;
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Invalid domain quote.');
  if(existing)await prisma.$executeRaw`UPDATE domain_platform_orders SET amountMinor=${amount}, years=${input.years}, quoteExpiresAt=${expiry}, updatedAt=NOW(3) WHERE id=${id} AND status='QUOTED'`;
  else await prisma.$executeRaw`INSERT INTO domain_platform_orders(id,partnerId,hostname,years,amountMinor,quoteExpiresAt) VALUES(${id},${input.partnerId},${hostname},${input.years},${amount},${expiry})`;
  return result(await owned(input.partnerId,id));
 }
 const row=await owned(input.partnerId,input.action==='checkout'?input.quoteId:input.orderId);
 if(input.action==='dns'){
  if(row.status!=='REGISTERED')throw new Error('Registration must be confirmed before DNS changes.');
  const confirmation=await registrar.getRegistration({domainName:row.hostname});
  if(!confirmation.active||confirmation.orderId!==row.registrarOrderId||new Date(confirmation.expiresAt)<=new Date())throw new Error('Registrar ownership or expiry requires review.');
  for(const record of input.records){
   if(record.type==='TXT'&&!/^_(?:sureimports|vercel)(?:\.[a-z0-9-]+)*$/.test(record.host))throw new Error('Only platform ownership TXT records are allowed.');
   if(record.type!=='TXT'&&record.host!=='')throw new Error('Platform hosting records must target the purchased domain.');
   if(record.type==='CNAME'&&!/^[a-z0-9.-]+\.vercel-dns(?:-\d+)?\.com\.?$/.test(record.value))throw new Error('Unexpected hosting target.');
   if(record.type==='A'&&!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(record.value))throw new Error('Invalid IPv4 record.');
  }
  // Inputs come only from the signed Sure Imports service, never a public DNS editor.
  for(const record of input.records)await registrar.addPlatformDnsRecord({domainName:row.hostname,...record});
  return {status:'DNS_SUBMITTED',hostname:row.hostname};
 }
 if(input.action==='status')return completePlatformDomainPayment(row.id,input.partnerId);
 if(row.checkoutUrl)return result(row);
 if(row.status!=='QUOTED')throw new Error('This checkout is already being processed. Check its status; do not create another payment.');
 if(row.quoteExpiresAt<new Date()||Number(row.amountMinor)!==input.acceptedTotalMinor)throw new Error('Quote expired or changed. Check the price again.');
 if(!(process.env.PAYSTACK_SECRET_KEY||'').startsWith('sk_live_'))throw new Error('Live domain checkout is not configured.');
 const reference=`SPD_${randomUUID().replaceAll('-','')}`;
 const changed=await prisma.$executeRaw`UPDATE domain_platform_orders SET status='CHECKOUT_PENDING',paymentReference=${reference},registrantCiphertext=${seal(input.registrant,row.id)},updatedAt=NOW(3) WHERE id=${row.id} AND status='QUOTED' AND quoteExpiresAt>NOW(3) AND amountMinor=${input.acceptedTotalMinor}`;
 if(!changed)throw new Error('Checkout changed. Reload domain orders.');
 const payment=await initializePaystack({email:input.registrant.email,amountMinor:Number(row.amountMinor),currency:'NGN',reference,metadata:{payment_scope:'sureimports_domain',platformOrderId:row.id},callbackUrl:`${siteBaseUrl()}/api/platform/domains/return`});
 await prisma.$executeRaw`UPDATE domain_platform_orders SET checkoutUrl=${payment.checkoutUrl},updatedAt=NOW(3) WHERE id=${row.id}`;
 return result(await owned(input.partnerId,row.id));
}
export async function completePlatformDomainPayment(id:string,partnerId?:string){
 await configured();
 const [row]=partnerId?[await owned(partnerId,id)]:await prisma.$queryRaw<Row[]>`SELECT * FROM domain_platform_orders WHERE id=${id} OR paymentReference=${id} LIMIT 1`;
 if(!row)throw new Error('Domain order not found.');
 if(!['QUOTED','CHECKOUT_PENDING','REGISTERING','RECONCILIATION_REQUIRED','REGISTERED'].includes(row.status))return result(row);
 if(row.status==='REGISTERED') {
  const registration=await registrar.getRegistration({domainName:row.hostname});
  if(registration.orderId!==row.registrarOrderId)throw new Error('Registrar ownership requires review.');
  await prisma.$executeRaw`UPDATE domain_platform_orders SET expiresAt=${new Date(registration.expiresAt)},updatedAt=NOW(3) WHERE id=${row.id}`;
  return {...result(await owned(row.partnerId,row.id)),registrarActive:registration.active};
 }
 if(!row.paymentReference)return result(row);
 const payment=await verifyPaystackTransaction(row.paymentReference);
 if(payment.domain!=='live'||payment.reference!==row.paymentReference||payment.currency!=='NGN'||payment.amountMinor!==Number(row.amountMinor)||payment.metadata?.platformOrderId!==row.id||payment.metadata?.payment_scope!=='sureimports_domain')throw new Error('Domain payment requires reconciliation.');
 const registrant=unseal(row.registrantCiphertext!,row.id);
 const acquired=await prisma.$executeRaw`UPDATE domain_platform_orders SET status='REGISTERING',updatedAt=NOW(3) WHERE id=${row.id} AND status='CHECKOUT_PENDING'`;
 if(acquired){
  try{
   const registration=await client.registerDomain({domainName:row.hostname,years:row.years,fullName:registrant.fullName,registrantCompany:registrant.company,email:registrant.email,registrantAddress1:registrant.address1,registrantCity:registrant.city,registrantState:registrant.state,registrantCountry:'NG',registrantPostalCode:registrant.postalCode,registrantPhone:registrant.phone.slice(4),registrantPhoneCc:'234',strict:true});
   if(!registration.success)throw new Error('Registrar registration needs review.');
   await prisma.$executeRaw`UPDATE domain_platform_orders SET registrarOrderId=${registration.orderId},updatedAt=NOW(3) WHERE id=${row.id}`;
  }catch{await prisma.$executeRaw`UPDATE domain_platform_orders SET status='RECONCILIATION_REQUIRED',updatedAt=NOW(3) WHERE id=${row.id} AND status='REGISTERING'`;}
 }
 // Never repeat registerDomain after a timeout. Reconcile registrar state instead.
 try{
  const confirmation=await registrar.getRegistration({domainName:row.hostname});
  const saved=await owned(row.partnerId,row.id);
  if(saved.registrarOrderId&&saved.registrarOrderId!==confirmation.orderId)throw new Error('Registrar reference needs review.');
  if(!confirmation.active||confirmation.registrantEmail!==registrant.email.toLowerCase())throw new Error('Registrant confirmation pending.');
  await prisma.$executeRaw`UPDATE domain_platform_orders SET status='REGISTERED',registrarOrderId=${confirmation.orderId},expiresAt=${new Date(confirmation.expiresAt)},updatedAt=NOW(3) WHERE id=${row.id} AND status IN ('REGISTERING','RECONCILIATION_REQUIRED')`;
 }catch{/* Pending or uncertain registration stays visible for operator review. */}
 return result(await owned(row.partnerId,row.id));
}
