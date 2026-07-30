const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..', '..');
const shell = fs.readFileSync(
  path.join(root, 'apps', 'dealer-workbench', 'src', 'app', 'comfort', '[[...section]]', 'BrandSiteConsoleShell.tsx'),
  'utf8'
);

test('site inquiry table centers content and balances column widths', () => {
  assert.match(shell, /\.site-inquiry-table th,\s*\.site-inquiry-table td \{\s*vertical-align: middle;/);
  assert.match(shell, /\.site-inquiry-table th,\s*\.site-inquiry-table td \{[\s\S]*?text-align: center;/);
  assert.match(shell, /\.site-inquiry-table th:nth-child\(1\),\s*\.site-inquiry-table td:nth-child\(1\) \{[\s\S]*?width: 16%;/);
  assert.match(shell, /\.site-inquiry-table th:nth-child\(3\),\s*\.site-inquiry-table td:nth-child\(3\) \{[\s\S]*?width: 10%;/);
  assert.match(shell, /\.site-inquiry-table th:nth-child\(5\),\s*\.site-inquiry-table td:nth-child\(5\) \{[\s\S]*?width: 26%;/);
});
