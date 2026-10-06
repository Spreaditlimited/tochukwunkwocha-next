import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { askCutoverRedirects, migratedAskQuestions } from '../lib/ask-cutover.mjs';

test('all migrated IDs exactly match the migration algorithm and retain answer intent', () => {
  assert.equal(migratedAskQuestions.length, 17);
  assert.equal(askCutoverRedirects.length, 36);
  assert.equal(new Set(askCutoverRedirects.map(r => r.source)).size, 36);
  for (const [oldId, newId] of migratedAskQuestions) {
    assert.equal(newId, 'q_' + createHash('sha256').update(`tochukwunkwocha.com:ask:q:${oldId}`).digest('hex').slice(0,28));
    for (const suffix of ['', '/answer']) {
      const rule = askCutoverRedirects.find(r => r.source === `/ask/${oldId}${suffix}`);
      assert.equal(rule.destination, `https://unsaidbox.com/q/${newId}${suffix}`);
      assert.equal(rule.permanent, false);
    }
  }
});
test('cutover is restricted to anonymous pages, never POST APIs or other site features', () => {
  assert.ok(askCutoverRedirects.every(r => r.source === '/ask' || r.source.startsWith('/ask/')));
  assert.equal(askCutoverRedirects.find(r => r.source === '/ask/question').destination, 'https://unsaidbox.com/u/tochukwu/ask');
  const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  assert.match(config, /\.\.\.askCutoverRedirects/);
  const route = readFileSync(new URL('../app/api/ask/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /submitAsk|consumeAskRateLimit|prisma|request\.json|fetch\(/);
});
