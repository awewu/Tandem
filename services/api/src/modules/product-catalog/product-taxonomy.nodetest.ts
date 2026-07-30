import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAssetRefs } from './product-taxonomy';

test('sanitizeAssetRefs preserves multiple product manual document refs', () => {
  const refs = sanitizeAssetRefs([
    { role: 'doc', artifactId: 'manual-a', filename: 'manual-a.pdf', mimeType: 'application/pdf', sortOrder: 1 },
    { role: 'doc', artifactId: 'manual-b', filename: 'manual-b.pdf', mimeType: 'application/pdf', sortOrder: 0 },
    { role: 'doc', artifactId: 'manual-a', filename: 'duplicate.pdf', mimeType: 'application/pdf', sortOrder: 2 },
    { role: 'main', artifactId: 'main-old' },
    { role: 'main', artifactId: 'main-new' },
  ]);

  assert.deepEqual(
    refs.filter((ref) => ref.role === 'doc').map((ref) => ref.artifactId),
    ['manual-b', 'manual-a'],
  );
  assert.deepEqual(
    refs.filter((ref) => ref.role === 'main').map((ref) => ref.artifactId),
    ['main-new'],
  );
});
