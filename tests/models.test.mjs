import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntities, applyRedactions } from '../src/models.js';

test('UTF-16 offsets preserve emoji and repeated personal data', () => {
  const text = '📁 Jan mailt Jan.';
  const entities = normalizeEntities(text, [
    { start: 3, end: 6, original: 'Jan', label: 'GIVEN_NAME', confidence: .9 },
    { start: 13, end: 16, original: 'Jan', label: 'GIVEN_NAME', confidence: .9 },
  ]);
  assert.equal(applyRedactions(text, entities, [entities[1].id]), '📁 Jan mailt [AFGESCHERMD].');
  assert.equal(applyRedactions(text, entities, []), text);
  assert.equal(text, '📁 Jan mailt Jan.');
});
test('mismatched or overlapping model detections fail closed', () => {
  assert.throws(() => normalizeEntities('Jan', [{ start: 0, end: 2, original: 'Jan' }]));
  assert.throws(() => normalizeEntities('Jan', [{ start: 0, end: 3, original: 'Jan' }, { start: 1, end: 3, original: 'an' }]));
});
test('stale review cannot replace different text', () => {
  const entities = normalizeEntities('Jan', [{ start: 0, end: 3, original: 'Jan', label: 'GIVEN_NAME' }]);
  assert.throws(() => applyRedactions('Eva', entities));
});

// The UI uses [xxx]; plain frontmatter values must remain strings.
test('mask marker preserves readable frontmatter and inline collections', async () => {
  const {quoteMaskedMetadata,inspectMetadata} = await import('../src/core.js');
  const output = quoteMaskedMetadata('---\nauteur: [xxx] [xxx]\ntags: [beleid, "[xxx]"]\n---\nContact [xxx].\n');
  const result = await inspectMetadata(new File([output], 'kopie.md'));
  assert.equal(result.rows.find(r => r.key === 'auteur').value, '[xxx] [xxx]');
  assert.equal(result.rows.find(r => r.key === 'tags').value, '["beleid","[xxx]"]');
  assert(output.endsWith('Contact [xxx].\n'));
});
