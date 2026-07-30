const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..', '..');
const service = fs.readFileSync(
  path.join(root, 'services', 'api', 'src', 'modules', 'brand-registry', 'site-inquiry.service.ts'),
  'utf8'
);

test('site inquiry API filters by submitted date range', () => {
  assert.match(service, /function dateBoundary\(value: unknown, endOfDay = false\): Date \| null/);
  assert.match(service, /query\.submittedFrom \|\| query\.dateFrom \|\| query\.from/);
  assert.match(service, /query\.submittedTo \|\| query\.dateTo \|\| query\.to, true/);
  assert.match(service, /inquiry\.createdAt >= :submittedFrom/);
  assert.match(service, /inquiry\.createdAt <= :submittedTo/);
  assert.match(service, /\+08:00/);
});
