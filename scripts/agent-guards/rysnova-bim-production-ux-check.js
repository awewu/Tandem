#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const HTML_PATHS = [
  'apps/consumer-diagnosis/public/rysnova-bim-designer.html',
  'archive/legacy-ui/public/rysnova-bim-designer.html'
];
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

for (const htmlPath of HTML_PATHS) {
  if (!fs.existsSync(path.join(ROOT, htmlPath))) {
    failures.push(`missing legacy Rysnova designer redirect shell: ${htmlPath}`);
    continue;
  }

  const html = read(htmlPath);
  check(html.includes("new URL('/viewer'"), `${htmlPath}: must target the unified 4003 /viewer route`);
  check(html.includes("target.port = '4003'"), `${htmlPath}: must redirect to designer-workbench port 4003`);
  check(html.includes('window.location.replace(redirectUrl)'), `${htmlPath}: must redirect automatically`);
  check(html.includes('projectId'), `${htmlPath}: must preserve project identifiers`);
  check(html.includes('contractId'), `${htmlPath}: must preserve contract identifiers`);
  check(html.includes('opportunityId'), `${htmlPath}: must preserve opportunity identifiers`);
  check(html.includes('artifactId'), `${htmlPath}: must preserve artifact identifiers`);
  check(!/<iframe\b/i.test(html), `${htmlPath}: must not compose the viewer through an iframe`);
  check(!html.includes('/js/three.min.js'), `${htmlPath}: must not load the old 3D runtime`);
  check(!html.includes('new THREE.WebGLRenderer'), `${htmlPath}: must not render the old dark workbench`);
  check(!html.includes('__rysnovaBimRenderProbe'), `${htmlPath}: must not expose the old active render probe`);
}

console.log(`Rysnova BIM Legacy Redirect Check: failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
