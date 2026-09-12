import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export async function verifyDomainPlatformRequest(request: Request, body: string) {
  const secret = process.env.SUREIMPORTS_DOMAIN_SERVICE_SECRET;
  if (!secret || secret.length < 32) throw new Error('Platform domain service is not configured.');
  const timestamp = request.headers.get('x-platform-timestamp') || '';
  const nonce = request.headers.get('x-platform-nonce') || '';
  const signature = request.headers.get('x-platform-signature') || '';
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000 || !/^[a-f0-9-]{36}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) throw new Error('Invalid platform signature.');
  const path = new URL(request.url).pathname;
  const expected = createHmac('sha256', secret).update(`${timestamp}\n${nonce}\n${request.method}\n${path}\n${body}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Invalid platform signature.');
  // Database uniqueness prevents replay across instances, not just within one process.
  await prisma.$executeRaw`INSERT INTO domain_platform_nonces (nonce, expiresAt) VALUES (${nonce}, ${new Date(Date.now()+600000)})`;
}
