// Import the six approved branded member resources. No document bytes or secrets
// are copied into Git. Defaults to a read-only plan; --apply uploads/publishes.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { AwsClient } from 'aws4fetch';
import { createMemberSession } from "../inner-circle-vault/src/member-session.js";
import worker from '../inner-circle-vault/src/index.js';
import { parseVaultCatalog } from '../lib/vault-catalog.ts';

process.on('uncaughtException', error => { console.error('Vault import failed:', error.message); process.exitCode = 1; });
const args = process.argv.slice(2);
const folderIndex = args.indexOf('--source-dir');
if (folderIndex < 0 || !args[folderIndex + 1]) throw new Error('Provide --source-dir with the approved branded documents folder.');
const folder = path.resolve(args[folderIndex + 1]);
const apply = args.includes('--apply');
const definitions = [
  { id: 'hr-swipe-file', filename: 'UK_Workplace_HR_Swipe_File_Branded.pdf', legacy: 'uk-hr-paper-trail-templates.pdf', title: 'UK Workplace Documentation & HR Protection Swipe File', desc: 'A practical PDF playbook for documenting workplace incidents, creating a clear email trail, and planning an appropriate response.', category: 'Work & career' },
  { id: 'relocation-anti-scam-audit', filename: 'UK_Relocation_Anti_Scam_Audit_Branded.pdf', title: '2026–2027 UK Relocation Readiness & Anti-Scam Audit', desc: 'Check an opportunity, understand the route, estimate relocation costs, and assess your readiness before committing money or making the move.', category: 'UK relocation' },
  { id: 'brand-margin-guide', filename: 'UK_Private_Label_Margin_Guide_Branded.pdf', title: 'UK Private-Label Product & Landed Margin Guide', desc: 'A step-by-step PDF guide from product idea to costed order, sales test, and reorder decision. Use with the companion Excel calculator in Business & importing.', category: 'Business & importing' },
  { id: 'brand-margin-calc', filename: 'UK_Brand_Margin_Calculator_Branded.xlsx', legacy: 'uk-brand-margin-calculator.xlsx', title: 'UK Private-Label Product & Landed Margin Calculator', desc: 'Editable Excel workbook for unit economics, landed margins, product costs, and launch budgeting. Companion to the UK Private-Label Product & Landed Margin Guide.', category: 'Business & importing' },
  { id: 'family-reunification-planner', filename: 'UK_Family_Reunification_Planner_Branded.pdf', title: '12-to-18 Month UK Family Reunification & Visa Cost Planner', desc: 'Plan and prepare for your partner and children to join you in the UK. Use with the companion Excel budget tracker in Family & planning.', category: 'Family & planning' },
  { id: 'reunion-roadmap', filename: 'UK_Family_Reunion_Budget_Branded.xlsx', legacy: '12-month-reunion-budget.xlsx', title: '12-to-18 Month Family Reunification & Budget Tracker', desc: 'Editable Excel workbook with a visa and budget calculator, 18-month action roadmap, reference rates, and monthly savings plan. Companion to the UK Family Reunification Planner.', category: 'Family & planning' },
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = (await readFile(new URL('../lib/vault-storage.ts', import.meta.url), 'utf8'))
  .replace('import "server-only"', '')
  .replace('"aws4fetch"', JSON.stringify(import.meta.resolve('aws4fetch')))
  .replace('"@/lib/vault-catalog"', JSON.stringify(new URL('../lib/vault-catalog.ts', import.meta.url).href))
  .replace('"@/lib/vault-subscribers"', JSON.stringify(new URL('../lib/vault-subscribers.ts', import.meta.url).href));
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { readVaultSubscribers, readVaultAccess, readVaultCatalog, prepareVaultUpload } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const client = new AwsClient({ accessKeyId: process.env.VAULT_R2_ACCESS_KEY_ID, secretAccessKey: process.env.VAULT_R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto', retries: 0 });
const endpoint = `https://${process.env.VAULT_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/inner-circle-vault/`;
const objectUrl = key => endpoint + key.split('/').map(encodeURIComponent).join('/');
const initial = await readVaultCatalog();
const plan = [];
for (const def of definitions) {
  const bytes = await readFile(path.join(folder, def.filename));
  assert.ok(bytes.length > 0 && bytes.length <= 100 * 1024 * 1024, 'Unsupported source file size');
  const previous = initial.catalog.templates.find(item => item.id === def.id);
  if (previous && ![def.filename, def.legacy].includes(path.posix.basename(previous.file))) throw new Error(`Existing document ID ${def.id} belongs to a different file; preserving it.`);
  plan.push({ ...def, bytes, sha256: hash(bytes), previous });
}
console.log(JSON.stringify({ mode: apply ? 'upload-and-publish' : 'read-only-plan', existingDocuments: initial.catalog.templates.length, ignored: 'Inner_Circle_Accuracy_Review_2026-11-12.pdf', documents: plan.map(({ id, filename, category, bytes, previous }) => ({ id, filename, category, bytes: bytes.length, action: previous ? 'verify-or-update' : 'add' })) }, null, 2));
if (!apply) process.exit(0);

const vars = Object.fromEntries((await readFile(new URL('../inner-circle-vault/.dev.vars', import.meta.url), 'utf8')).trim().split('\n').filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), JSON.parse(line.slice(index + 1))]; }));
const effectivePasscode = (await readVaultAccess()).record?.code || vars.VAULT_PASSCODE;
const memberEmail = (await readVaultSubscribers()).record?.emails[0];
if (!memberEmail) throw new Error("Upload a subscriber list in /internal/vault before verifying member downloads.");
const memberToken = await createMemberSession(memberEmail, effectivePasscode);


const reportPath = new URL('../inner-circle-vault/.wrangler/branded-import-report.json', import.meta.url);
await mkdir(new URL('../inner-circle-vault/.wrangler/', import.meta.url), { recursive: true });
let savedReport = { uploads: [] };
try { savedReport = JSON.parse(await readFile(reportPath, 'utf8')); } catch {}
const uploads = savedReport.uploads || [];
const entries = [];
for (const item of plan) {
  let key;
  // Reuse byte-identical prior uploads after a partial import or safe rerun.
  const candidates = [item.previous?.file, ...uploads.filter(row => row.id === item.id && row.sha256 === item.sha256).map(row => row.file)].filter(Boolean);
  for (const candidate of candidates) {
    const res = await client.fetch(objectUrl(candidate), { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(30000) });
    if (res.ok && hash(Buffer.from(await res.arrayBuffer())) === item.sha256) { key = candidate; break; }
    if (!res.ok && res.status !== 404) throw new Error(`Could not verify existing object for ${item.id}: ${res.status}`);
  }
  if (!key) {
    const signed = await prepareVaultUpload(item.filename, item.bytes.length);
    const result = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: item.bytes, signal: AbortSignal.timeout(60000) });
    if (!result.ok) throw new Error(`Upload failed for ${item.id}: ${result.status}`);
    key = signed.key;
    uploads.push({ id: item.id, filename: item.filename, file: key, sha256: item.sha256, bytes: item.bytes.length });
    await writeFile(reportPath, JSON.stringify({ uploads }, null, 2), { mode: 0o600 });
  }
  const verified = await client.fetch(objectUrl(key), { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(30000) });
  assert.ok(verified.ok, `Cannot verify ${item.id}`);
  assert.equal(hash(Buffer.from(await verified.arrayBuffer())), item.sha256, `Uploaded bytes differ for ${item.id}`);
  const expectedType = item.filename.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
  assert.equal(verified.headers.get('content-type')?.split(';')[0], expectedType, `Wrong file type for ${item.id}`);
  entries.push({ id: item.id, title: item.title, desc: item.desc, category: item.category, file: key, published: true });
  console.log(`Verified ${item.id}: ${item.bytes.length} bytes, ${expectedType}`);
}
// One conditional write publishes all verified objects together, preserving any
// unrelated entries. Stop if a concurrent admin has changed the catalog.
const current = await readVaultCatalog();
if (current.etag !== initial.etag) throw new Error('The catalog changed during upload. Rerun the import to merge against the latest version.');
const ids = new Set(entries.map(item => item.id));
const merged = parseVaultCatalog({ version: 1, templates: [...current.catalog.templates.filter(item => !ids.has(item.id)), ...entries] });
const body = JSON.stringify(merged);
const result = await client.fetch(objectUrl('_vault/catalog.json'), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)), ...(current.etag ? { 'If-Match': current.etag } : { 'If-None-Match': '*' }) }, body, signal: AbortSignal.timeout(30000) });
if (!result.ok) throw new Error(`Catalog publish failed: ${result.status}; uploaded files remain private.`);

const reader = new AwsClient({ accessKeyId: vars.R2_ACCESS_KEY_ID, secretAccessKey: vars.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto', retries: 0 });
const bindings = { ...vars, VAULT_MANAGED_ACCESS: 'true', VAULT_BUCKET: { async get(key) { const res = await reader.fetch(objectUrl(key)); if (res.status === 404) return null; if (!res.ok) throw new Error('Cannot read published catalog'); return { json: () => res.json() }; } } };
for (const entry of entries) {
  const redirect = await worker.fetch(new Request(`https://vault.tochukwunkwocha.com/download/${entry.id}`, { headers: { Cookie: `vault_auth=${memberToken}` } }), bindings);
  assert.equal(redirect.status, 302, `No member download for ${entry.id}`);
  const download = await fetch(redirect.headers.get('location'), { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(30000) });
  assert.equal(download.status, 200, `Download failed for ${entry.id}`);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal(hash(Buffer.from(await download.arrayBuffer())), plan.find(item => item.id === entry.id).sha256, `Member download differs for ${entry.id}`);
}
const published = await readVaultCatalog();
assert.ok(!published.catalog.templates.some(item => /Accuracy_Review/i.test(item.file)), 'Accuracy review must not be cataloged');
await writeFile(reportPath, JSON.stringify({ uploadedAt: new Date().toISOString(), uploads, published: entries, catalogCount: published.catalog.templates.length, verifiedMemberDownloads: entries.length }, null, 2), { mode: 0o600 });
console.log(`Published ${entries.length} member documents; ${entries.filter(item => item.file.endsWith('.xlsx')).length} Excel workbooks verified through signed downloads. Catalog total: ${published.catalog.templates.length}. Accuracy review excluded.`);
