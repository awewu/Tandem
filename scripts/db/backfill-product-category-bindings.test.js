const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadAliases,
  parseArgs,
} = require('./backfill-product-category-bindings');

test('product category backfill defaults to dry-run and requires explicit apply', () => {
  assert.deepEqual(parseArgs([]), {
    apply: false,
    json: false,
    help: false,
    brand: null,
    tenant: null,
    aliases: null,
  });
  assert.equal(parseArgs(['--apply']).apply, true);
  assert.equal(parseArgs(['--brand= Everhot ']).brand, 'everhot');
  assert.equal(parseArgs(['--tenant=tenant-1']).tenant, 'tenant-1');
  assert.throws(() => parseArgs(['--write']), /Unknown argument/);
});

test('product category backfill loads configured alias matches from JSON', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'product-category-backfill-'));
  const file = path.join(dir, 'aliases.json');
  fs.writeFileSync(file, JSON.stringify([
    { brandCode: 'Everhot', legacyValue: 'dhw', categoryId: 'cat-1' },
    { brandCode: '', legacyValue: 'ignored', categoryId: 'cat-2' },
  ]));

  assert.deepEqual(loadAliases(file), [
    { brandCode: 'everhot', legacyValue: 'dhw', categoryId: 'cat-1' },
  ]);
});
