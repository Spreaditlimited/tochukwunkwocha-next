// Explicit integration check: creates and cleans up one disposable TXT object and
// one catalog entry. Never deletes pre-existing documents or rewrites their data.
// Run from repo root: node --env-file=.env.local scripts/smoke-inner-circle-vault.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { AwsClient } from 'aws4fetch';
import { createMemberSession } from "../inner-circle-vault/src/member-session.js";
import worker from '../inner-circle-vault/src/index.js';
process.on('uncaughtException', error => { console.error('Vault verification failed:', error.message); process.exitCode = 1; });

const source = (await readFile(new URL('../lib/vault-storage.ts', import.meta.url), 'utf8'))
  .replace('import "server-only"', '')
  .replace('"aws4fetch"', JSON.stringify(import.meta.resolve('aws4fetch')))
  .replace('"@/lib/vault-catalog"', JSON.stringify(new URL('../lib/vault-catalog.ts', import.meta.url).href))
  .replace('"@/lib/vault-subscribers"', JSON.stringify(new URL('../lib/vault-subscribers.ts', import.meta.url).href));
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { prepareVaultUpload, readVaultSubscribers, readVaultAccess, readVaultCatalog, saveVaultDocument } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const vars = Object.fromEntries((await readFile(new URL('../inner-circle-vault/.dev.vars', import.meta.url), 'utf8')).trim().split('\n').filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), JSON.parse(line.slice(index + 1))]; }));
const admin = new AwsClient({ accessKeyId: process.env.VAULT_R2_ACCESS_KEY_ID, secretAccessKey: process.env.VAULT_R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto', retries: 0 });
const effectivePasscode = (await readVaultAccess()).record?.code || vars.VAULT_PASSCODE;
const memberEmail = (await readVaultSubscribers()).record?.emails[0];
if (!memberEmail) throw new Error("Upload a subscriber list in /internal/vault before verifying member downloads.");
const memberToken = await createMemberSession(memberEmail, effectivePasscode);
const reader = new AwsClient({ accessKeyId: vars.R2_ACCESS_KEY_ID, secretAccessKey: vars.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto', retries: 0 });
const endpoint = `https://${vars.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/inner-circle-vault/`;
const id = `verification-${randomUUID()}`;
const content = 'Disposable Inner Circle Vault integration verification.\n';
const uploaded = await prepareVaultUpload('vault-verification.txt', Buffer.byteLength(content));
let objectCreated = false;
try {
  const cors = await fetch(endpoint + uploaded.key, { method: 'OPTIONS', headers: { Origin: 'https://www.tochukwunkwocha.com', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type,if-none-match' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), 'https://www.tochukwunkwocha.com');
  const put = await fetch(uploaded.url, { method: 'PUT', headers: uploaded.headers, body: content });
  assert.ok(put.ok, `Signed upload failed (${put.status})`);
  objectCreated = true;
  const item = { id, title: 'Disposable verification document', desc: 'Temporary integration test; removed automatically.', category: 'Verification', file: uploaded.key, published: false };
  let current = await readVaultCatalog();
  await saveVaultDocument(item, current.etag, '');
  current = await readVaultCatalog();
  await assert.rejects(saveVaultDocument(item, current.etag, ''), /already used/);
  await assert.rejects(saveVaultDocument(item, 'stale-etag', id), /another window/);
  const bindings = { ...vars, VAULT_MANAGED_ACCESS: 'true', VAULT_BUCKET: { async get(key) { const res = await reader.fetch(endpoint + key); if (res.status === 404) return null; if (!res.ok) throw new Error('Catalog read failed'); return { json: () => res.json() }; } } };
  const request = path => worker.fetch(new Request('https://vault.tochukwunkwocha.com' + path, { headers: { Cookie: `vault_auth=${memberToken}` } }), bindings);
  assert.equal((await request('/download/' + id)).status, 404);
  await saveVaultDocument({ ...item, published: true }, current.etag, id);
  assert.ok((await (await request('/')).text()).includes(item.title));
  const redirect = await request('/download/' + id);
  assert.equal(redirect.status, 302);
  const download = await fetch(redirect.headers.get('location'));
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal(await download.text(), content);
  assert.ok([400, 401, 403].includes((await fetch(endpoint + uploaded.key)).status), 'Unsigned downloads must be rejected');
  const denied = await reader.fetch(endpoint + uploaded.key, { method: 'PUT', body: content });
  assert.equal(denied.status, 403, 'Download credentials must not write');
  console.log('Live R2 verification passed: browser CORS, signed upload, catalog saves/conflicts, draft protection, member catalog, signed attachment download, private bucket, read-only credential.');
} finally {
  const current = await readVaultCatalog();
  if (current.catalog.templates.some(item => item.id === id)) {
    const res = await admin.fetch(endpoint + '_vault/catalog.json', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': current.etag }, body: JSON.stringify({ version: 1, templates: current.catalog.templates.filter(item => item.id !== id) }) });
    assert.ok(res.ok, 'Could not remove disposable catalog entry; review storage.');
  }
  if (objectCreated) assert.ok((await admin.fetch(endpoint + uploaded.key, { method: 'DELETE' })).ok, 'Could not remove disposable object.');
  console.log('Disposable verification document cleaned up.');
}
