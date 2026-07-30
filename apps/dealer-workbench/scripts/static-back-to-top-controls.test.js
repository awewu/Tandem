const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..', '..');
const shell = fs.readFileSync(
  path.join(root, 'apps', 'dealer-workbench', 'src', 'app', 'comfort', '[[...section]]', 'BrandSiteConsoleShell.tsx'),
  'utf8'
);
const everhotNav = fs.readFileSync(path.join(root, 'apps', 'everhot-cn', 'public', 'js', 'nav.js'), 'utf8');
const everhotCss = fs.readFileSync(path.join(root, 'apps', 'everhot-cn', 'public', 'css', 'everhot.css'), 'utf8');

test('brand console has a fixed icon button that returns to page top', () => {
  assert.match(shell, /const backTopButtonRef = useRef<HTMLButtonElement \| null>\(null\);/);
  assert.match(shell, /ref=\{backTopButtonRef\}/);
  assert.match(shell, /className="brand-console-backtop"/);
  assert.match(shell, /aria-hidden="true"/);
  assert.match(shell, /tabIndex=\{-1\}/);
  assert.match(shell, /button\.classList\.toggle\('is-visible', isVisible\)/);
  assert.match(shell, /button\.setAttribute\('aria-hidden', isVisible \? 'false' : 'true'\)/);
  assert.match(shell, /button\.tabIndex = isVisible \? 0 : -1/);
  assert.match(shell, /dangerouslySetInnerHTML=\{\{/);
  assert.match(shell, /button\.dataset\.bound === 'true'/);
  assert.match(shell, /button\.classList\.toggle\('is-visible', visible\)/);
  assert.match(shell, /button\.addEventListener\('click', backTop\)/);
  assert.match(shell, /document\.addEventListener\('scroll', updateBackTopVisibility, \{ passive: true, capture: true \}\)/);
  assert.match(shell, /window\.setInterval\(updateBackTopVisibility, 160\)/);
  assert.match(shell, /window\.clearInterval\(visibilityTimer\)/);
  assert.ok(shell.includes("document.querySelector('.content')"));
  assert.match(shell, /aria-label="回到顶部"/);
  assert.match(shell, /function scrollBrandConsoleToTop\(\)/);
  assert.ok(shell.includes("document.querySelector('.app-main')"));
  assert.match(shell, /target\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
  assert.match(shell, /<ArrowUpCircle size=\{18\} \/>/);
  assert.match(shell, /\.brand-console-backtop \{/);
  assert.match(shell, /position: fixed;/);
  assert.match(shell, /opacity: 0;/);
  assert.match(shell, /visibility: hidden;/);
  assert.match(shell, /pointer-events: none;/);
  assert.match(shell, /\.brand-console-backtop\.is-visible \{/);
  assert.match(shell, /pointer-events: auto;/);
});

test('Everhot public site mounts a reusable back-to-top control', () => {
  assert.match(everhotNav, /className='ev-backtop'/);
  assert.match(everhotNav, /aria-label','回到顶部'/);
  assert.match(everhotNav, /window\.scrollTo\(\{top:0,behavior:'smooth'\}\)/);
  assert.match(everhotNav, /window\.scrollY>360/);
  assert.match(everhotCss, /\.ev-backtop \{/);
  assert.match(everhotCss, /bottom: calc\(clamp\(14px,2vw,24px\) \+ 60px\);/);
  assert.match(everhotCss, /background: var\(--baseplate-bg\);/);
  assert.match(everhotCss, /\.ev-backtop\.is-visible \{/);
});
