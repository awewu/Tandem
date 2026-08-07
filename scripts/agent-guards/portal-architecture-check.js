#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('./_artifact-gate').requireArtifactOrSkip('docs/_archive/PROJECT-CHARTER-AND-PRD.md', {
  guard: 'guard:portal-architecture', reason: 'docs/_archive 基线文档 git 历史 0 次、从未入库；需改为校验现役 docs/ 基线',
});

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function visibleText(source) {
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

const failures = [];

const REQUIRED_FILES = [
  'docs/_archive/PROJECT-CHARTER-AND-PRD.md',
  'PRD-CURRENT.md',
  'PRODUCT-SCOPE.md',
  'docs/_archive/PRODUCT-PORTAL-ARCHITECTURE.md',
  'archive/legacy-ui/public/index-ready.html',
  'archive/legacy-ui/public/index.html',
  'archive/legacy-ui/public/pain-diagnosis.html',
  'archive/legacy-ui/public/customer-view.html',
  'archive/legacy-ui/public/business-console.html',
  'server-production.js',
  'server/modules/productionMiddleware.js'
];

for (const file of REQUIRED_FILES) {
  if (!exists(file)) failures.push(`missing portal architecture file: ${file}`);
}

const architecture = exists('docs/_archive/PRODUCT-PORTAL-ARCHITECTURE.md')
  ? read('docs/_archive/PRODUCT-PORTAL-ARCHITECTURE.md')
  : '';

const charter = exists('docs/_archive/PROJECT-CHARTER-AND-PRD.md')
  ? read('docs/_archive/PROJECT-CHARTER-AND-PRD.md')
  : '';
const prd = exists('PRD-CURRENT.md') ? read('PRD-CURRENT.md') : '';
const scope = exists('PRODUCT-SCOPE.md') ? read('PRODUCT-SCOPE.md') : '';

for (const [file, source] of [
  ['docs/_archive/PROJECT-CHARTER-AND-PRD.md', charter],
  ['PRD-CURRENT.md', prd],
  ['PRODUCT-SCOPE.md', scope],
  ['docs/_archive/PRODUCT-PORTAL-ARCHITECTURE.md', architecture]
]) {
  if (/\bRenova\b/.test(source)) {
    failures.push(`${file}: contains unauthorized English name "Rysnova" for 瑞诺瓦`);
  }
  for (const forbidden of [
    'Rhautt Comfort = 数字化软件生产主干',
    'Rhautt Comfort is the digital product trunk',
    '数字化软件主干'
  ]) {
    if (source.includes(forbidden)) {
      failures.push(`${file}: contains obsolete product/software naming token: ${forbidden}`);
    }
  }
}

for (const token of [
  'Rhautt / 瑞合瑞德是暖通科技集团',
  '瑞诺瓦是瑞合瑞德旗下 C 端舒适家系统品牌',
  'Rheem / Ruud / Everhot',
  'Rhautt Comfort 是瑞合瑞德暖通科技集团的英文表述',
  'Rhautt Nexus / 瑞合数智枢纽',
  'Rysnova 是公司技术支持赋能软件 / BIM 深化软件',
  '不能擅自添加未确认英文名'
]) {
  if (!charter.includes(token)) failures.push(`project charter missing token: ${token}`);
}

for (const token of [
  '官网和瑞诺瓦问诊保持 C 端逻辑',
  'React/Vite：`src/` 是候选服务面',
  '生产上线必须 MongoDB fail-fast'
]) {
  if (!prd.includes(token)) failures.push(`PRD-CURRENT.md missing production trunk token: ${token}`);
}

for (const token of [
  'Rhautt Comfort / 瑞合瑞德暖通科技集团 = 集团英文/中文表述',
  '瑞诺瓦 = 瑞合瑞德旗下 C 端舒适家系统品牌',
  'Rheem / Ruud / Everhot = 设备品牌',
  'Rhautt Nexus / 瑞合数智枢纽 = 瑞合瑞德暖通科技集团营销体系系统软件平台，承载官网、问诊、客户门户、工作台、Rysnova、设备品牌独立站和后端数据底座',
  '“生产主干”只表示准备上线'
]) {
  if (!scope.includes(token)) failures.push(`PRODUCT-SCOPE.md missing product-scope token: ${token}`);
}

for (const token of [
  'Rhautt / 瑞合瑞德 is an HVAC technology group',
  '瑞诺瓦 is the C-end system brand',
  'Rheem / Ruud / Everhot are equipment brands',
  'Rhautt Comfort is the English expression for 瑞合瑞德暖通科技集团',
  'Rhautt Nexus / 瑞合数智枢纽',
  '瑞诺瓦 AI diagnosis',
  'Customer project portal',
  'Employee portal',
  'Business console',
  'Rysnova technical support / BIM',
  'Shared backend foundation'
]) {
  if (!architecture.includes(token)) failures.push(`portal architecture doc missing token: ${token}`);
}

if (exists('archive/legacy-ui/public/index-ready.html')) {
  const html = read('archive/legacy-ui/public/index-ready.html');
  const text = visibleText(html);

  if (/\bRenova\b/.test(text)) {
    failures.push('archive/legacy-ui/public/index-ready.html: visible homepage text contains unauthorized English name "Rysnova" for 瑞诺瓦');
  }

  for (const token of ['瑞合瑞德', '暖通科技集团', '瑞诺瓦', 'Rheem', 'Ruud', 'Everhot']) {
    if (!text.includes(token)) failures.push(`archive/legacy-ui/public/index-ready.html: homepage missing brand hierarchy token: ${token}`);
  }

  for (const href of ['/login.html']) {
    if (!html.includes(`href="${href}"`)) failures.push(`archive/legacy-ui/public/index-ready.html: homepage missing separated entry link ${href}`);
  }

  for (const href of ['https://www.rheem.com', 'https://www.ruud.com']) {
    if (!html.includes(href)) failures.push(`archive/legacy-ui/public/index-ready.html: homepage missing independent equipment brand link ${href}`);
  }

  if (!/https?:\/\/[^"']*everhot/i.test(html)) {
    failures.push('archive/legacy-ui/public/index-ready.html: homepage missing independent Everhot equipment brand link');
  }

  const forbidden = /(Comfort Home Operating System|Operating System|指挥台|售前、设计、报价与交付指挥台|Production Surface|Front Office|AI HVAC Design Platform)/i;
  if (forbidden.test(text)) {
    failures.push('archive/legacy-ui/public/index-ready.html: homepage still reads like an internal operations shell instead of group portal');
  }
}

if (exists('archive/legacy-ui/public/index.html')) {
  const legacy = read('archive/legacy-ui/public/index.html');
  if (/href=["']\/(?:quick-lock|solution-matching|quotation-pro|technical-drawings|solution-view|admin-dashboard)\.html/.test(legacy)) {
    failures.push('archive/legacy-ui/public/index.html: legacy compat page still links to non-active legacy product surfaces');
  }
}

if (exists('archive/legacy-ui/public/pain-diagnosis.html')) {
  const diagnosis = read('archive/legacy-ui/public/pain-diagnosis.html');
  const diagnosisText = visibleText(diagnosis);
  if (/\bRenova\b/.test(diagnosisText)) {
    failures.push('archive/legacy-ui/public/pain-diagnosis.html: visible diagnosis text contains unauthorized English name "Rysnova" for 瑞诺瓦');
  }
  if (!diagnosisText.includes('瑞诺瓦 AI 问诊')) {
    failures.push('archive/legacy-ui/public/pain-diagnosis.html: 瑞诺瓦 AI diagnosis must be clearly named as independent C-end system');
  }
  if (/quote-view\.html/.test(diagnosis)) {
    failures.push('archive/legacy-ui/public/pain-diagnosis.html: 瑞诺瓦 AI diagnosis shares to missing quote-view.html');
  }
}

if (exists('server-production.js')) {
  const server = read('server-production.js');
  const factory = exists('server/modules/productionAppFactory.js')
    ? read('server/modules/productionAppFactory.js')
    : '';
  if (!/app\.get\('\/'[\s\S]*index-ready\.html/.test(`${server}\n${factory}`)) {
    failures.push('production app composition: root must serve archive/legacy-ui/public/index-ready.html');
  }
}

if (exists('server/modules/productionMiddleware.js')) {
  const middleware = read('server/modules/productionMiddleware.js');
  if (!/express\.static\(publicDir,\s*\{\s*index:\s*false\s*\}\)/.test(middleware)) {
    failures.push('productionMiddleware.js: static middleware must not let archive/legacy-ui/public/index.html steal /');
  }
}

console.log(`Portal Architecture Check: files = ${REQUIRED_FILES.length}, failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
