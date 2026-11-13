import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import worker, { TEMPLATES } from '../src/index.js';
import { createMemberSession } from '../src/member-session.js';
import { parseSubscriberCsv, parseVaultSubscribers, VAULT_SUBSCRIBERS_KEY } from '../../lib/vault-subscribers.ts';

const base = 'https://vault.tochukwunkwocha.com';
const initial = { version: 1, emails: ['member@example.test', 'other@example.test'], updatedAt: '2026-11-12T12:00:00Z', updatedBy: 'owner@example.test', sourceName: 'subscribers.csv' };

test('Facebook CSV parser handles BOM, quotes, CRLF, case, duplicates, and empty exports; rejects partial/malformed imports', () => {
  assert.deepEqual(parseSubscriberCsv('\uFEFF"Email address"\r\n"Member@Example.test"\r\n member@example.test \r\n\r\n'), { emails: ['member@example.test'], duplicates: 1 });
  assert.deepEqual(parseSubscriberCsv('Name,Email address\n"Member, One",member@example.test\n'), { emails: ['member@example.test'], duplicates: 0 });
  assert.deepEqual(parseSubscriberCsv('Email address\n'), { emails: [], duplicates: 0 });
  for (const csv of ['', 'email\na@example.test', 'Email address\nnot-an-email', 'Email address\nvalid@example.test\ninvalid', 'Email address\n"unfinished', 'Email address\n"a"junk', 'Email address\na@example.test,extra', 'Email address,Email address\na@example.test,b@example.test']) assert.throws(() => parseSubscriberCsv(csv));
  assert.throws(() => parseSubscriberCsv('Email address\n' + 'a'.repeat(2 * 1024 * 1024)));
  assert.throws(() => parseVaultSubscribers({ ...initial, emails: ['Bad@Example.test'] }));
  assert.throws(() => parseVaultSubscribers({ ...initial, emails: ['a@example.test', 'a@example.test'] }));
});

test('email and code are both required; signed sessions reject tampering and removals immediately', async () => {
  let record = structuredClone(initial);
  let fail = false;
  const env = { VAULT_PASSCODE: 'test-monthly-code', R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test', VAULT_BUCKET: { async get(key) {
    if (key === VAULT_SUBSCRIBERS_KEY) { if (fail) throw new Error('Unavailable'); return record ? { json: async () => record } : null; }
    return { json: async () => ({ version: 1, templates: TEMPLATES.map(item => ({ ...item, published: true })) }) };
  } } };
  const fetchVault = (path, init = {}) => worker.fetch(new Request(base + path, init), env);
  const login = (email, passcode = env.VAULT_PASSCODE) => fetchVault('/login', { method: 'POST', body: new URLSearchParams({ email, passcode }) });
  const success = await login(' MEMBER@EXAMPLE.TEST ');
  assert.equal(success.status, 302);
  const cookie = success.headers.get('Set-Cookie').split(';')[0];
  assert.ok(!cookie.includes(env.VAULT_PASSCODE));
  const authed = path => fetchVault(path, { headers: { Cookie: cookie } });
  assert.match(await (await authed('/')).text(), /Your member library/);
  assert.equal((await authed('/download/reunion-roadmap')).status, 302);
  for (const email of ['', 'not-an-email', 'unlisted@example.test']) assert.equal((await login(email)).status, 401);
  assert.equal((await login('member@example.test', 'wrong')).status, 401);
  assert.match(await (await fetchVault('/')).text(), /email address tied to your Facebook account/);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: { Cookie: cookie + '; ' + cookie } })).headers.get('Location'), '/');
  const otherToken = await createMemberSession('unlisted@example.test', env.VAULT_PASSCODE);
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: { Cookie: 'vault_auth=' + otherToken } })).headers.get('Location'), '/');
  const parts = cookie.split('=')[1].split('.');
  parts[0] = Buffer.from(JSON.stringify({ email: 'other@example.test', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: { Cookie: 'vault_auth=' + parts.join('.') } })).headers.get('Location'), '/');
  const clock = Date.now;
  Date.now = () => clock() - 31 * 86400000;
  let expired;
  try { expired = await createMemberSession('member@example.test', env.VAULT_PASSCODE); } finally { Date.now = clock; }
  assert.equal((await fetchVault('/download/reunion-roadmap', { headers: { Cookie: 'vault_auth=' + expired } })).headers.get('Location'), '/');
  record = { ...record, emails: ['other@example.test'] };
  assert.equal((await authed('/download/reunion-roadmap')).headers.get('Location'), '/');
  assert.match(await (await authed('/')).text(), /Monthly access code/);
  assert.equal((await login('member@example.test')).status, 401);
  record = null;
  assert.equal((await login('other@example.test')).status, 401);
  record = { invalid: true };
  assert.equal((await login('other@example.test')).status, 500);
  fail = true;
  assert.equal((await authed('/download/reunion-roadmap')).status, 500);
  // Public landing still works during a subscriber-storage outage.
  assert.equal((await fetchVault('/')).status, 200);
});

test('subscriber imports replace atomically, preserve previous data on invalid imports and conflicts, and allow explicit empty lists', async () => {
  const source = (await readFile(new URL('../../lib/vault-storage.ts', import.meta.url), 'utf8')).replace('import "server-only"', '')
    .replace('"aws4fetch"', JSON.stringify(import.meta.resolve('aws4fetch')))
    .replace('"@/lib/vault-catalog"', JSON.stringify(new URL('../../lib/vault-catalog.ts', import.meta.url).href))
    .replace('"@/lib/vault-subscribers"', JSON.stringify(new URL('../../lib/vault-subscribers.ts', import.meta.url).href));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { readVaultSubscribers, replaceVaultSubscribers } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const oldFetch = globalThis.fetch;
  const keys = ['VAULT_R2_ACCOUNT_ID', 'VAULT_R2_ACCESS_KEY_ID', 'VAULT_R2_SECRET_ACCESS_KEY'];
  const oldEnv = keys.map(key => process.env[key]);
  keys.forEach((key, index) => { process.env[key] = index ? 'test' : 'a'.repeat(32); });
  let record = null, revision = 0, conflict = false, failRead = false;
  const etag = () => record ? `"revision-${revision}"` : null;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.equal(new URL(req.url).pathname, '/inner-circle-vault/' + VAULT_SUBSCRIBERS_KEY);
    if (req.method === 'GET') {
      assert.equal(req.cache, 'no-store');
      if (failRead) return new Response('', { status: 503 });
      return record ? Response.json(record, { headers: { ETag: etag() } }) : new Response('', { status: 404 });
    }
    assert.equal(req.method, 'PUT');
    assert.equal(req.headers.get(record ? 'if-match' : 'if-none-match'), record ? etag() : '*');
    if (conflict) return new Response('', { status: 412 });
    const text = await req.text();
    assert.equal(req.headers.get('content-length'), String(Buffer.byteLength(text)));
    record = JSON.parse(text); revision++;
    return new Response('', { status: 200 });
  };
  try {
    assert.deepEqual(await readVaultSubscribers(), { record: null, etag: null });
    const first = await replaceVaultSubscribers('Email address\nmember@example.test\nother@example.test', 'first.csv', null, 'owner@example.test');
    assert.equal(first.record.emails.length, 2);
    await assert.rejects(replaceVaultSubscribers('Email address\ninvalid', 'bad.csv', first.etag, 'owner@example.test'));
    await assert.rejects(replaceVaultSubscribers('Email address\na@example.test', 'stale.csv', null, 'owner@example.test'), /another window/);
    conflict = true;
    await assert.rejects(replaceVaultSubscribers('Email address\na@example.test', 'conflict.csv', first.etag, 'owner@example.test'), /another window/);
    conflict = false;
    assert.deepEqual((await readVaultSubscribers()).record.emails, first.record.emails);
    const second = await replaceVaultSubscribers('Email address\nother@example.test', 'second.csv', first.etag, 'owner@example.test');
    assert.deepEqual(second.record.emails, ['other@example.test']);
    const empty = await replaceVaultSubscribers('Email address\n', 'empty.csv', second.etag, 'owner@example.test');
    assert.deepEqual(empty.record.emails, []);
    failRead = true;
    await assert.rejects(replaceVaultSubscribers('Email address\na@example.test', 'fail.csv', empty.etag, 'owner@example.test'), /Could not read/);
    assert.equal(revision, 3);
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, index) => { if (oldEnv[index] === undefined) delete process.env[key]; else process.env[key] = oldEnv[index]; });
  }
});

test('subscriber API requires an owner session, dashboard permission, and a matching browser origin', async () => {
  const asModule = value => 'data:text/javascript;base64,' + Buffer.from(value).toString('base64');
  const auth = asModule('export async function getAdminSession() { return globalThis.vaultTestSession }; export function canAccessDashboardPath(session) { return session.allowed }');
  const storage = asModule('export async function readVaultSubscribers() { globalThis.vaultTestReads++; return { record: null, etag: null } }; export async function replaceVaultSubscribers() { globalThis.vaultTestWrites++; return { record: null, etag: null } }; export const activateVaultAccessCode = () => {}; export const generateVaultAccessCode = () => {}; export const prepareVaultUpload = () => {}; export const readVaultAccess = () => {}; export const readVaultCatalog = () => {}; export const saveVaultDocument = () => {};');
  const source = (await readFile(new URL('../../app/api/internal/vault/route.ts', import.meta.url), 'utf8'))
    .replace('"next/server"', JSON.stringify(asModule('export const NextResponse = { json: (body, init) => Response.json(body, init) }')))
    .replace('"@/lib/auth"', JSON.stringify(auth))
    .replace('"@/lib/vault-storage"', JSON.stringify(storage))
    .replace('"@/lib/vault-subscribers"', JSON.stringify(new URL('../../lib/vault-subscribers.ts', import.meta.url).href));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { POST } = await import(asModule(js));
  const request = (action, headers = {}) => POST(new Request('http://localhost:3000/api/internal/vault', { method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'localhost:3000', Origin: 'http://localhost:3000', ...headers }, body: JSON.stringify({ action, csv: 'Email address\nmember@example.test', filename: 'test.csv', etag: null }) }));
  globalThis.vaultTestReads = 0; globalThis.vaultTestWrites = 0;
  try {
    globalThis.vaultTestSession = null;
    assert.equal((await request('subscribers-replace')).status, 401);
    globalThis.vaultTestSession = { isOwner: true, allowed: false };
    assert.equal((await request('subscribers-replace')).status, 403);
    globalThis.vaultTestSession = { isOwner: false, allowed: true };
    for (const action of ['subscribers-replace', 'subscribers-reload']) assert.equal((await request(action)).status, 403);
    globalThis.vaultTestSession = { isOwner: true, allowed: true, email: 'owner@example.test' };
    assert.equal((await request('subscribers-replace', { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request('subscribers-replace', { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal(globalThis.vaultTestWrites, 0);
    assert.equal(globalThis.vaultTestReads, 0);
    const read = await request('subscribers-reload');
    assert.equal(read.status, 200);
    assert.equal(read.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await request('subscribers-replace')).status, 200);
    assert.equal(globalThis.vaultTestReads, 1);
    assert.equal(globalThis.vaultTestWrites, 1);
  } finally { delete globalThis.vaultTestSession; delete globalThis.vaultTestReads; delete globalThis.vaultTestWrites; }
});
