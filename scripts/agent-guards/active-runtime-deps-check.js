#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const ACTIVE_RUNTIME_FILES = [
  'public/designer.html',
  'public/rysnova-bim-designer.html'
];

const REQUIRED_LOCAL_RUNTIME_FILES = [
  'public/js/konva-lite.js',
  'public/js/three.min.js',
  'public/js/orbit-controls-lite.js'
];

const FORBIDDEN_CORE_RUNTIME_PATTERNS = [
  /https:\/\/cdn\.jsdelivr\.net\/npm\/konva/i,
  /https:\/\/cdn\.jsdelivr\.net\/npm\/three/i,
  /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js/i,
  /https:\/\/unpkg\.com\/(?:konva|three)/i
];

const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

for (const file of [...ACTIVE_RUNTIME_FILES, ...REQUIRED_LOCAL_RUNTIME_FILES]) {
  if (!exists(file)) failures.push(`missing active runtime dependency file: ${file}`);
}

for (const file of ACTIVE_RUNTIME_FILES) {
  if (!exists(file)) continue;
  const source = read(file);
  for (const pattern of FORBIDDEN_CORE_RUNTIME_PATTERNS) {
    if (pattern.test(source)) failures.push(`${file}: active engineering surface depends on external core runtime ${pattern}`);
  }
}

if (exists('public/designer.html')) {
  const designer = read('public/designer.html');
  if (!designer.includes('/js/konva-lite.js')) {
    failures.push('public/designer.html: missing local Konva runtime /js/konva-lite.js');
  }
  if (!designer.includes('new Konva.Stage')) {
    failures.push('public/designer.html: missing Konva stage construction');
  }
}

if (exists('public/rysnova-bim-designer.html')) {
  const rysnovaBim = read('public/rysnova-bim-designer.html');
  for (const token of ['/js/three.min.js', '/js/orbit-controls-lite.js', 'THREE.WebGLRenderer', '__rysnovaBimRenderProbe']) {
    if (!rysnovaBim.includes(token)) failures.push(`public/rysnova-bim-designer.html: missing local 3D runtime token ${token}`);
  }
}

if (exists('public/js/konva-lite.js')) {
  const konvaLite = read('public/js/konva-lite.js');
  for (const token of ['window.Konva', 'class Stage', 'class Layer', 'class Line', 'toDataURL', '__rhauttKonvaRuntime']) {
    if (!konvaLite.includes(token)) failures.push(`public/js/konva-lite.js missing token: ${token}`);
  }
}

if (exists('public/js/orbit-controls-lite.js')) {
  const orbitLite = read('public/js/orbit-controls-lite.js');
  for (const token of ['window.THREE.OrbitControls', 'camera.lookAt', '__rhauttOrbitControlsRuntime']) {
    if (!orbitLite.includes(token)) failures.push(`public/js/orbit-controls-lite.js missing token: ${token}`);
  }
}

console.log(`Active Runtime Dependencies Check: runtime surfaces = ${ACTIVE_RUNTIME_FILES.length}, local runtime files = ${REQUIRED_LOCAL_RUNTIME_FILES.length}, failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
