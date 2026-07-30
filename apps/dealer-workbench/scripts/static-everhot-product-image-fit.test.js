const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssPath = path.join(__dirname, '..', '..', 'everhot-cn', 'public', 'css', 'everhot.css');
const source = fs.readFileSync(cssPath, 'utf8');

test('Everhot product images keep a 4:3 frame without distortion', () => {
  assert.match(source, /\.product-card \.pc-media \{[^}]*aspect-ratio:\s*4\/3;/);
  assert.match(source, /\.product-card \.pc-media img \{[^}]*object-fit:\s*contain;/);
  assert.match(source, /\.pd-hero-media \{[^}]*aspect-ratio:\s*4\/3;/);
  assert.match(source, /\.pd-hero-media img \{[^}]*object-fit:\s*contain;/);

  assert.doesNotMatch(source, /\.product-card \.pc-media img \{[^}]*object-fit:\s*cover;/);
  assert.doesNotMatch(source, /\.pd-hero-media img \{[^}]*object-fit:\s*cover;/);
});
