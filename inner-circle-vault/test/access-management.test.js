import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = (await readFile(new URL('../../lib/vault-storage.ts', import.meta.url), 'utf8'))
  .replace('import "server-only"', '')
  .replace('"aws4fetch"', JSON.stringify(import.meta.resolve('aws4fetch')))
  .replace('"@/lib/vault-catalog"', JSON.stringify(new URL('../../lib/vault-catalog.ts', import.meta.url).href))
  .replace('"@/lib/vault-subscribers"', JSON.stringify(new URL('../../lib/vault-subscribers.ts', import.meta.url).href));
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { generateVaultAccessCode, readVaultAccess, activateVaultAccessCode } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('access management generates readable codes and uses atomic private storage writes', async () => {
  const keys = ['VAULT_R2_ACCOUNT_ID', 'VAULT_R2_ACCESS_KEY_ID', 'VAULT_R2_SECRET_ACCESS_KEY'];
  const previous = keys.map(key => process.env[key]);
  process.env.VAULT_R2_ACCOUNT_ID = 'a'.repeat(32);
  process.env.VAULT_R2_ACCESS_KEY_ID = 'test-access';
  process.env.VAULT_R2_SECRET_ACCESS_KEY = 'test-secret';
  const originalFetch = globalThis.fetch;
  let record = null;
  let revision = 0;
  let puts = 0;
  let conflict = false;
  let failRead = false;
  const etag = () => record ? `"revision-${revision}"` : null;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, '/inner-circle-vault/_vault/access.json');
    if (request.method === 'GET') {
      assert.equal(request.cache, 'no-store');
      if (failRead) return new Response('Unavailable', { status: 503 });
      return record ? Response.json(record, { headers: { ETag: etag() } }) : new Response('', { status: 404 });
    }
    assert.equal(request.method, 'PUT');
    const body = await request.text();
    assert.equal(request.headers.get('content-length'), String(Buffer.byteLength(body)));
    if (conflict) { conflict = false; revision++; return new Response('', { status: 412 }); }
    if (record) assert.equal(request.headers.get('if-match'), etag());
    else assert.equal(request.headers.get('if-none-match'), '*');
    record = JSON.parse(body); revision++; puts++;
    return new Response('', { status: 200 });
  };
  try {
    const candidates = Array.from({ length: 64 }, generateVaultAccessCode);
    assert.equal(new Set(candidates).size, 64);
    assert.ok(candidates.every(code => /^IC-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(code)));
    assert.deepEqual(await readVaultAccess(), { record: null, etag: null });
    const first = await activateVaultAccessCode(candidates[0], null, 'owner@example.test');
    assert.equal(first.record.code, candidates[0]);
    assert.equal(first.record.updatedBy, 'owner@example.test');
    assert.ok(Number.isFinite(Date.parse(first.record.updatedAt)));
    const second = await activateVaultAccessCode(candidates[1], first.etag, 'owner@example.test');
    assert.equal(second.record.code, candidates[1]);
    assert.notEqual(second.etag, first.etag);
    await assert.rejects(activateVaultAccessCode(candidates[2], first.etag, 'owner@example.test'), /another window/);
    await assert.rejects(activateVaultAccessCode(candidates[1], second.etag, 'owner@example.test'), /different code/);
    await assert.rejects(activateVaultAccessCode('weak-code', second.etag, 'owner@example.test'), /invalid/);
    conflict = true;
    await assert.rejects(activateVaultAccessCode(candidates[2], second.etag, 'owner@example.test'), /another window/);
    assert.equal((await readVaultAccess()).record.code, candidates[1]);
    assert.equal(puts, 2);
    failRead = true;
    await assert.rejects(readVaultAccess(), /Could not read/);
    await assert.rejects(activateVaultAccessCode(candidates[3], etag(), 'owner@example.test'), /Could not read/);
    assert.equal(puts, 2);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});
