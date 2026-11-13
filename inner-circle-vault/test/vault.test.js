import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createMemberSession } from "../src/member-session.js";
import { VAULT_SUBSCRIBERS_KEY } from "../../lib/vault-subscribers.ts";
import worker, { TEMPLATES } from '../src/index.js';
import { parseVaultCatalog, validateVaultItem, VAULT_ACCESS_KEY } from '../../lib/vault-catalog.ts';

const base = 'https://vault.tochukwunkwocha.com';
const subscriber = { version: 1, emails: ["member@example.test"], updatedAt: "2026-11-12T12:00:00Z", updatedBy: "owner@example.test", sourceName: "test.csv" };
const env = { VAULT_PASSCODE: 'monthly-code', R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'test-access', R2_SECRET_ACCESS_KEY: 'test-secret' };
env.VAULT_BUCKET = { async get(key) { return { json: async () => key === VAULT_SUBSCRIBERS_KEY ? subscriber : { version: 1, templates: TEMPLATES.map(item => ({ ...item, published: true })) } }; } };
const cookie = { Cookie: `vault_auth=${await createMemberSession(subscriber.emails[0], env.VAULT_PASSCODE)}` };
const fetchVault = (path, init = {}, bindings = env) => worker.fetch(new Request(base + path, init), { ...bindings, VAULT_BUCKET: { async get(key) { return key === VAULT_SUBSCRIBERS_KEY ? { json: async () => subscriber } : bindings.VAULT_BUCKET?.get(key); } } });
const login = (passcode, headers = {}) => ({ method: 'POST', headers, body: new URLSearchParams({ passcode, email: subscriber.emails[0] }) });

test('login, dashboard, logout, and monthly rotation', async () => {
  const page = await fetchVault('/');
  assert.match(await page.text(), /Monthly access code/);
  assert.equal(page.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  const bad = await fetchVault('/login', login('wrong'));
  assert.equal(bad.status, 401);
  assert.match(await bad.text(), /pinned post/);
  const success = await fetchVault('/login', login('  monthly-code  '));
  assert.equal(success.status, 302);
  assert.equal(success.headers.get('Location'), '/');
  assert.match(success.headers.get('Set-Cookie'), /^vault_auth=[A-Za-z0-9_.-]+; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000$/);
  const dashboard = await fetchVault('/', { headers: cookie });
  const body = await dashboard.text();
  for (const item of TEMPLATES) assert.ok(body.includes(`/download/${item.id}`));
  assert.ok(!body.includes(env.VAULT_PASSCODE));
  const rotated = await fetchVault('/', { headers: cookie }, { ...env, VAULT_PASSCODE: 'new-code' });
  assert.match(await rotated.text(), /Monthly access code/);
  const logout = await fetchVault('/logout', { method: 'POST' });
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
});

test('special characters round-trip safely in the cookie', async () => {
  const bindings = { ...env, VAULT_PASSCODE: 'é; a=b%"' };
  const res = await worker.fetch(new Request(base + '/login', login(bindings.VAULT_PASSCODE)), bindings);
  assert.equal(res.status, 302);
  const page = await fetchVault('/', { headers: { Cookie: res.headers.get('Set-Cookie').split(';')[0] } }, bindings);
  assert.match(await page.text(), /Your member library/);
});

test('download URLs have a valid independent SigV4 signature for every template', async () => {
  const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
  for (const item of TEMPLATES) {
    const res = await fetchVault(`/download/${item.id}`, { headers: cookie });
    assert.equal(res.status, 302);
    const url = new URL(res.headers.get('Location'));
    assert.equal(url.host, `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    assert.equal(url.pathname, `/inner-circle-vault/${item.file}`);
    assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
    assert.equal(url.searchParams.get('response-content-disposition'), `attachment; filename="${item.file}"`);
    const actual = url.searchParams.get('X-Amz-Signature');
    const date = url.searchParams.get('X-Amz-Date');
    url.searchParams.delete('X-Amz-Signature');
    const encode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const query = [...url.searchParams].map(([k, v]) => [encode(k), encode(v)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('&');
    const canonical = `GET\n${url.pathname}\n${query}\nhost:${url.host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))).toString('hex');
    const scope = `${date.slice(0, 8)}/auto/s3/aws4_request`;
    const key = hmac(hmac(hmac(hmac('AWS4' + env.R2_SECRET_ACCESS_KEY, date.slice(0, 8)), 'auto'), 's3'), 'aws4_request');
    assert.equal(hmac(key, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${digest}`).toString('hex'), actual);
  }
});

test('authentication gates all downloads and rejects malformed cookies', async () => {
  for (const headers of [{}, { Cookie: 'vault_auth=wrong' }, { Cookie: 'vault_auth=%xx' }, { Cookie: 'vault_auth=monthly-code; vault_auth=wrong' }]) {
    assert.equal((await fetchVault('/download/reunion-roadmap', { headers })).headers.get('Location'), '/');
  }
  assert.equal((await fetchVault('/download/missing', { headers: cookie })).status, 404);
});

test('missing configuration fails closed without exposing secrets', async () => {
  for (const VAULT_PASSCODE of [undefined, '', ' ']) {
    assert.equal((await fetchVault('/', {}, { ...env, VAULT_PASSCODE })).status, 503);
  }
  const res = await fetchVault('/download/reunion-roadmap', { headers: cookie }, { VAULT_PASSCODE: env.VAULT_PASSCODE, VAULT_BUCKET: env.VAULT_BUCKET });
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('Location'), null);
});

test('method, origin, malformed form, file field, and body limits', async () => {
  assert.equal((await fetchVault('/login')).status, 405);
  assert.equal((await fetchVault('/logout')).status, 405);
  assert.equal((await fetchVault('/download/reunion-roadmap', { method: 'POST', headers: cookie })).status, 405);
  assert.equal((await fetchVault('/unknown')).status, 404);
  assert.equal((await fetchVault('/login', login('monthly-code', { Origin: 'https://evil.example' }))).status, 403);
  assert.equal((await fetchVault('/login', { method: 'POST', body: 'bad' })).status, 415);
  assert.equal((await fetchVault('/login', login('x'.repeat(9000)))).status, 413);
  assert.equal((await fetchVault('/login', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'bad' })).status, 400);
  const form = new FormData();
  form.set('passcode', new File(['monthly-code'], 'code.txt'));
  assert.equal((await fetchVault('/login', { method: 'POST', body: form })).status, 401);
});

test('private catalog controls visibility and downloads, including hiding an existing document', async () => {
  let published = true;
  const bindings = { ...env, VAULT_BUCKET: { async get() { return { async json() { return { version: 1, templates: [{ ...TEMPLATES[0], file: 'documents/12345678-1234-1234-1234-123456789abc/budget.xlsx', published }] }; } }; } } };
  assert.match(await (await fetchVault('/', { headers: cookie }, bindings)).text(), /reunion-roadmap/);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: cookie }, bindings)).status, 302);
  published = false;
  assert.doesNotMatch(await (await fetchVault('/', { headers: cookie }, bindings)).text(), /reunion-roadmap/);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: cookie }, bindings)).status, 404);
  const empty = { ...env, VAULT_BUCKET: { async get() { return null; } } };
  assert.match(await (await fetchVault('/', { headers: cookie }, empty)).text(), /resources are being prepared/);
});

test('catalog corruption fails closed, while unauthenticated requests never read storage', async () => {
  let reads = 0;
  const bindings = { ...env, VAULT_BUCKET: { async get() { reads++; throw new Error('private storage error'); } } };
  assert.equal((await fetchVault('/', {}, bindings)).status, 200);
  assert.equal((await fetchVault('/download/reunion-roadmap', {}, bindings)).status, 302);
  assert.equal(reads, 0);
  assert.equal((await fetchVault('/', { headers: cookie }, bindings)).status, 500);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: cookie }, bindings)).status, 500);
});

test('catalog rejects traversal, executable files, duplicates, and malformed metadata', () => {
  for (const file of ['../secret.pdf', '_vault/catalog.json', 'documents/other/secret.pdf', 'payload.html', 'payload.exe']) {
    assert.throws(() => validateVaultItem({ ...TEMPLATES[0], file }));
  }
  assert.throws(() => validateVaultItem({ ...TEMPLATES[0], id: '../download' }));
  assert.throws(() => validateVaultItem({ ...TEMPLATES[0], title: ' ' }));
  assert.throws(() => parseVaultCatalog({ version: 2, templates: [] }));
  assert.throws(() => parseVaultCatalog({ version: 1, templates: [TEMPLATES[0], TEMPLATES[0]] }));
});

test('Safari null origins require browser same-origin metadata', async () => {
  assert.equal((await fetchVault('/login', login('monthly-code', { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' }))).status, 302);
  for (const site of [undefined, 'cross-site', 'same-site', 'none']) {
    const headers = { Origin: 'null', ...(site ? { 'Sec-Fetch-Site': site } : {}) };
    assert.equal((await fetchVault('/login', login('monthly-code', headers))).status, 403);
  }
  assert.equal((await fetchVault('/login', login('monthly-code', { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'same-origin' }))).status, 403);
});

test('HTTP development cookies are restricted to explicitly configured loopback hosts', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(subscriber);
  try {
  for (const origin of ['http://localhost:8788', 'http://127.0.0.1:8788', 'https://vault.tochukwunkwocha.com', 'http://vault.tochukwunkwocha.com']) {
    const request = new Request(origin + '/login', login('monthly-code'));
    const res = await worker.fetch(request, { ...env, VAULT_LOCAL_PREVIEW: 'true' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('Set-Cookie').includes('; Secure;'), !origin.includes('localhost') && !origin.includes('127.0.0.1'));
  }
  const res = await worker.fetch(new Request('http://localhost:8788/login', login('monthly-code')), env);
  assert.match(res.headers.get('Set-Cookie'), /; Secure;/);
  } finally { globalThis.fetch = originalFetch; }
});

test('member dashboard supports search, categories, sorting, and help without exposing hidden documents', async () => {
  const bindings = { ...env, VAULT_BUCKET: { async get() { return { async json() { return { version: 1, templates: [
    ...TEMPLATES.map(item => ({ ...item, published: true })),
    { ...TEMPLATES[0], id: 'private-draft', title: 'Unpublished secret', published: false },
  ] }; } }; } } };
  const page = async path => (await fetchVault(path, { headers: cookie }, bindings)).text();
  const overview = await page('/');
  assert.match(overview, /Main navigation/);
  assert.match(overview, /Library overview/);
  assert.match(overview, /<strong>3<\/strong>/);
  assert.doesNotMatch(overview, /Unpublished secret/);
  const searched = await page('/?view=library&q=landed');
  assert.match(searched, /href="\/download\/brand-margin-calc"/);
  assert.doesNotMatch(searched, /href="\/download\/reunion-roadmap"/);
  const category = await page('/?view=library&category=' + encodeURIComponent('Work & career'));
  assert.match(category, /href="\/download\/hr-swipe-file"/);
  assert.doesNotMatch(category, /href="\/download\/brand-margin-calc"/);
  const sorted = await page('/?view=library&sort=title');
  assert.ok(sorted.indexOf('href="/download/reunion-roadmap"') < sorted.indexOf('href="/download/brand-margin-calc"'));
  assert.match(await page('/?view=library&q=nonexistent-resource'), /No matching resources/);
  const help = await page('/?view=help');
  assert.match(help, /Help and access/);
  assert.match(help, /Monthly access/);
  assert.doesNotMatch(help, /href="\/download\//);
  assert.match(await page('/?view=library&q=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E'), /&lt;script&gt;/);
});

test('dashboard-managed codes override the bootstrap secret and invalidate previous sessions immediately', async () => {
  let record = { version: 1, code: 'IC-ABCDE-FGHJK-LMNPQ', updatedAt: '2026-11-12T12:00:00Z', updatedBy: 'owner@example.test' };
  const bindings = { ...env, VAULT_MANAGED_ACCESS: 'true', VAULT_BUCKET: { async get(key) {
    return { async json() { return key === VAULT_ACCESS_KEY ? record : { version: 1, templates: [{ ...TEMPLATES[0], published: true }] }; } };
  } } };
  const oldCookie = { Cookie: `vault_auth=${await createMemberSession(subscriber.emails[0], record.code)}` };
  const first = await fetchVault('/login', login(record.code), bindings);
  assert.equal(first.status, 302);
  assert.equal((await fetchVault('/login', login(env.VAULT_PASSCODE), bindings)).status, 401);
  assert.match(await (await fetchVault('/', { headers: oldCookie }, bindings)).text(), /Your member library/);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: oldCookie }, bindings)).status, 302);
  record = { ...record, code: 'IC-RSTUV-WXYZ2-34567' };
  assert.match(await (await fetchVault('/', { headers: oldCookie }, bindings)).text(), /Monthly access code/);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: oldCookie }, bindings)).headers.get('Location'), '/');
  const newCookie = { Cookie: `vault_auth=${await createMemberSession(subscriber.emails[0], record.code)}` };
  assert.match(await (await fetchVault('/', { headers: newCookie }, bindings)).text(), /Your member library/);
  assert.equal((await fetchVault('/login', login(record.code), bindings)).status, 302);
  const publicPage = await (await fetchVault('/', {}, bindings)).text();
  assert.ok(!publicPage.includes(record.code));
  assert.ok(!publicPage.includes(record.updatedBy));
});

test('managed access fails closed for corrupt storage and unavailable storage, and allows initial bootstrap only when no record exists', async () => {
  const bindings = { ...env, VAULT_MANAGED_ACCESS: 'true', VAULT_BUCKET: { async get() { return null; } } };
  assert.equal((await fetchVault('/login', login(env.VAULT_PASSCODE), bindings)).status, 302);
  bindings.VAULT_BUCKET.get = async () => ({ json: async () => ({ version: 1, code: 'invalid' }) });
  assert.equal((await fetchVault('/login', login(env.VAULT_PASSCODE), bindings)).status, 500);
  bindings.VAULT_BUCKET.get = async () => { throw new Error('Storage unavailable'); };
  assert.equal((await fetchVault('/login', login(env.VAULT_PASSCODE), bindings)).status, 500);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: cookie }, bindings)).status, 500);
});
