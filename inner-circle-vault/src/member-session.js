import { normalizeSubscriberEmail } from '../../lib/vault-subscribers.ts';

const encoder = new TextEncoder();
const encode = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const keyFor = (code) => crypto.subtle.importKey('raw', encoder.encode(code), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
const message = (payload) => encoder.encode(`vault-member-session:v1:${payload}`);

export async function createMemberSession(email, code) {
  const payload = encode(encoder.encode(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + 2592000 })));
  const signature = await crypto.subtle.sign('HMAC', await keyFor(code), message(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function memberSessionEmail(request, code) {
  const cookies = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).filter(part => part.startsWith('vault_auth='));
  if (cookies.length !== 1) return null;
  const token = cookies[0].slice('vault_auth='.length);
  if (token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const [payload, signature] = token.split('.');
    if (!await crypto.subtle.verify('HMAC', await keyFor(code), decode(signature), message(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (!Number.isInteger(data.exp) || data.exp <= Date.now() / 1000 || normalizeSubscriberEmail(data.email) !== data.email) return null;
    return data.email;
  } catch { return null; }
}
