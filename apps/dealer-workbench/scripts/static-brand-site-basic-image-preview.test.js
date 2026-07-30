const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const shellPath = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'comfort',
  '[[...section]]',
  'BrandSiteConsoleShell.tsx'
);
const globalsPath = path.join(__dirname, '..', 'src', 'app', 'globals.css');

const shell = fs.readFileSync(shellPath, 'utf8');
const globals = fs.readFileSync(globalsPath, 'utf8');

test('brand site basic image fields explain usage and show recoverable previews', () => {
  assert.match(shell, /function BasicInfoImagePreview\(/);
  assert.match(shell, /basicInfoImagePurpose\(fieldKey\)/);
  assert.match(shell, /fieldKey === 'seo\.defaultOgImage'/);
  assert.match(shell, /fieldKey === 'seo\.defaultTwitterImage'/);
  assert.match(shell, /fieldKey === 'seo\.organizationLogo'/);
  assert.match(shell, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(shell, /图片无法访问/);
  assert.match(shell, /site-basic-share-preview/);
  assert.match(shell, /打开原图/);
  assert.match(shell, /复制链接/);
});

test('workbench secondary navigation stays inside the viewport with internal scrolling', () => {
  assert.match(globals, /html\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(globals, /body\s*\{[^}]*overflow:\s*hidden;/);
  assert.match(globals, /\.content\s*\{[^}]*height:\s*calc\(100dvh - 48px\);/);
  assert.match(globals, /\.content\s*\{[^}]*overflow-y:\s*auto;/);
  assert.match(globals, /\.workbench-subnav\s*\{[^}]*height:\s*calc\(100vh - 48px\);/);
  assert.match(globals, /\.workbench-subnav\s*\{[^}]*overflow-y:\s*hidden;/);
  assert.match(globals, /\.workbench-subnav-expanded\s*\{[^}]*display:\s*flex;/);
  assert.match(globals, /\.workbench-subnav-list\s*\{[^}]*overflow-y:\s*auto;/);
});

test('site basic fields do not stretch into blank blocks beside image previews', () => {
  assert.match(shell, /\.site-basic-grid\s*\{[^}]*align-items:\s*start;/);
  assert.match(shell, /\.site-basic-field\s*\{[^}]*align-self:\s*start;/);
});

test('brand site legal settings omit deprecated footer policy link fields', () => {
  const groups = shell.slice(
    shell.indexOf('const BASIC_INFO_FIELD_GROUPS'),
    shell.indexOf('const BASIC_INFO_TABLES')
  );
  assert.doesNotMatch(groups, /privacyPolicyHref/);
  assert.doesNotMatch(groups, /cookiePolicyHref/);
  assert.doesNotMatch(groups, /legalStatementHref/);
});
