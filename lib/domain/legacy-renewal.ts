import 'server-only';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { applyAdminSettingsToProcessEnv } from '@/lib/admin-settings';
import { verifyPaystackTransaction } from '@/lib/payments/course-checkout';
import { completePlatformRenewal } from './platform-renewals';
const require=createRequire(import.meta.url);
const registrar=require('./providers/resellerclub.js') as {getRegistration:(i:{domainName:string})=>Promise<{orderId:string;active:boolean;expiresAt:string}>};
const client=require('../domain-client.cjs') as {selectedDomainProviderName:()=>string};
export async function completeLegacyDomainRenewal(reference:string) {
 await applyAdminSettingsToProcessEnv();if(client.selectedDomainProviderName()!=='resellerclub')throw new Error('Registrar renewal confirmation is unavailable.');
 const [checkout]=await prisma.$queryRaw<{renewalUuid:string;accountId:bigint;domainName:string;years:number;status:string;amountMinor:bigint;currency:string}[]>`SELECT renewal_uuid AS renewalUuid,account_id AS accountId,domain_name AS domainName,years,status,payment_amount_minor AS amountMinor,payment_currency AS currency FROM tochukwu_domain_renewal_checkouts WHERE payment_reference=${reference}`;
 if(!checkout)throw new Error('Renewal checkout not found.');
 const payment=await verifyPaystackTransaction(reference);
 if(payment.domain!=='live'||payment.amountMinor!==Number(checkout.amountMinor)||payment.currency!==checkout.currency||payment.metadata?.domain_renewal_uuid!==checkout.renewalUuid)throw new Error('Renewal payment requires reconciliation.');
 const id=`legacy:${checkout.renewalUuid}`,partnerId=`legacy-student:${checkout.accountId}`;
 const [operation]=await prisma.$queryRaw<{id:string}[]>`SELECT id FROM domain_platform_renewals WHERE id=${id}`;
 if(!operation){
  // Old code marked local dates renewed without contacting the registrar. Never silently renew again.
  if(checkout.status==='renewed')throw new Error('Historical renewal needs registrar reconciliation. No further registrar charge was attempted.');
  const [owned]=await prisma.$queryRaw<{id:bigint}[]>`SELECT id FROM user_domains WHERE account_id=${checkout.accountId} AND domain_name=${checkout.domainName} AND LOWER(status)='registered'`;
  if(!owned)throw new Error('Registered domain not found for this account.');
  const current=await registrar.getRegistration({domainName:checkout.domainName});if(!current.active)throw new Error('Registrar domain is not active.');
  const expectedExpiry=new Date(current.expiresAt),domainId=`legacy:${createHash('sha256').update(checkout.domainName).digest('hex')}`;
  await prisma.$executeRaw`INSERT INTO domain_platform_renewals(id,partnerId,domainOrderId,hostname,registrarOrderId,expectedExpiry,years,amountMinor,quoteExpiresAt,status,paymentReference) VALUES(${id},${partnerId},${domainId},${checkout.domainName},${current.orderId},${expectedExpiry},${checkout.years},${checkout.amountMinor},${new Date()},'CHECKOUT_PENDING',${reference}) ON DUPLICATE KEY UPDATE id=id`;
 }
 const result=await completePlatformRenewal(id,partnerId,checkout.renewalUuid);
 if(result.status!=='RENEWED'||!result.expiresAt)throw new Error('Renewal is pending registrar confirmation. Do not pay again.');
 const expiry=new Date(result.expiresAt);
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`UPDATE user_domains SET renewal_due_at=${expiry},last_synced_at=NOW(),updated_at=NOW() WHERE account_id=${checkout.accountId} AND domain_name=${checkout.domainName}`;
  await tx.$executeRaw`UPDATE tochukwu_domain_renewal_checkouts SET status='renewed',payment_paid_at=COALESCE(payment_paid_at,NOW()),notes='Renewal confirmed against registrar expiry.',updated_at=NOW() WHERE renewal_uuid=${checkout.renewalUuid}`;
 });
 return {domainName:checkout.domainName,years:checkout.years,renewalDueAt:expiry};
}
