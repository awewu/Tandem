#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('./_artifact-gate').requireArtifactOrSkip('archive/legacy-ui/public/index-ready.html', {
  guard: 'guard:ui-vi', reason: '遗留 UI 已归档移除，archive/ 在 .gitignore；现役界面 VI 由 guard:rheem-vi-production 守护',
});

const ROOT = path.join(__dirname, '..', '..');

const SURFACES = [
  { file: 'archive/legacy-ui/public/index-ready.html', type: 'consumer', required: ['瑞合瑞德', '瑞诺瓦', 'Rheem', 'Ruud', 'Everhot'] },
  { file: 'archive/legacy-ui/public/pain-diagnosis.html', type: 'consumer', required: ['瑞诺瓦 AI 问诊', '舒适家系统方案'] },
  { file: 'archive/legacy-ui/public/customer-view.html', type: 'customer-portal', required: ['客户服务门户'] },
  { file: 'archive/legacy-ui/public/business-console.html', type: 'enterprise', required: ['业务工作台'] },
  { file: 'archive/legacy-ui/public/index.html', type: 'legacy-compat', required: ['登录系统', '/pain-diagnosis.html'] }
];

const PRODUCTION_SHARED_FILES = [];

const failures = [];
const warnings = [];
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const UNSUPPORTED_BRAND_PATTERN = /data-brand=["'](?!rheem|ruud|rysnova|hengRe)[^"']+["']/;
const AI_FLAVOR_PATTERN = /(超PRD|全网|最强|顶级|魔法|AI智能|智能匹配|Demo Accounts)/i;
const ENTERPRISE_BLOCK_PATTERN = /(默认演示|测试账号|进入体验|立即体验|AI智能|智能问诊|AI\s*推荐|机器人|🤖|魔法|神器|锁客|拉满|老破小逆袭)/i;
const LEGACY_INTERNAL_SHELL_PATTERN = /(Comfort Home Operating System|售前、设计、报价与交付指挥台|Production Surface|Front Office|AI HVAC Design Platform)/i;
const LEGACY_SURFACE_LINK_PATTERN = /href=["']\/(?:quick-lock|solution-matching|quotation-pro|technical-drawings|solution-view|admin-dashboard|store-admin|hq-admin|sales|technical-support)\.html/;
const LEGACY_CONSUMER_NAME_PATTERN = /(瑞德宜居家|瑞美五恒|瑞诺瓦舒适家居设计平台)/;

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function stripSource(source) {
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function ensureBaseSurface(surface, html) {
  if (!html.includes('/css/rhautt-comfort-tokens.css')) {
    failures.push(`${surface.file}: missing rhautt-comfort token stylesheet`);
  }

  const bodyMatch = html.match(/<body\b[^>]*>/i);
  if (!bodyMatch) {
    failures.push(`${surface.file}: missing body tag`);
    return;
  }

  const body = bodyMatch[0];
  if (!/class=["'][^"']*\brc-scope\b/.test(body)) {
    failures.push(`${surface.file}: body missing rc-scope class`);
  }
  if (!/data-brand=["'](rheem|ruud|rysnova|hengRe)["']/.test(body) || UNSUPPORTED_BRAND_PATTERN.test(body)) {
    failures.push(`${surface.file}: body missing supported data-brand`);
  }
}

function ensureConsumerSurface(surface, html, visibleText) {
  for (const token of surface.required) {
    if (!html.includes(token) && !visibleText.includes(token)) {
      failures.push(`${surface.file}: consumer surface missing required token: ${token}`);
    }
  }

  if (LEGACY_INTERNAL_SHELL_PATTERN.test(visibleText)) {
    failures.push(`${surface.file}: consumer surface reads like an internal operations shell`);
  }
  if (LEGACY_CONSUMER_NAME_PATTERN.test(visibleText)) {
    failures.push(`${surface.file}: consumer surface contains stale brand/product naming`);
  }

  const emojiCount = (visibleText.match(EMOJI_PATTERN) || []).length;
  if (emojiCount > 120) {
    warnings.push(`${surface.file}: high emoji density (${emojiCount}); keep C-end UI polished`);
  }
}

function ensureEnterpriseSurface(surface, html, visibleText) {
  for (const token of surface.required) {
    if (!html.includes(token) && !visibleText.includes(token)) {
      failures.push(`${surface.file}: enterprise surface missing required token: ${token}`);
    }
  }

  const hasOperationalStyles = html.includes('/css/rhautt-operational-surfaces.css') ||
    html.includes('/css/rhautt-production-workbench.css');
  if (!hasOperationalStyles) {
    failures.push(`${surface.file}: enterprise surface missing operational surface stylesheet`);
  }
  if (ENTERPRISE_BLOCK_PATTERN.test(visibleText)) {
    failures.push(`${surface.file}: enterprise surface contains demo/consumer wording`);
  }
  if (LEGACY_SURFACE_LINK_PATTERN.test(html)) {
    failures.push(`${surface.file}: enterprise surface links to legacy/prototype page`);
  }
}

function ensureLegacyCompat(surface, html, visibleText) {
  if (LEGACY_SURFACE_LINK_PATTERN.test(html)) {
    failures.push(`${surface.file}: legacy compat page links to non-active production surfaces`);
  }
  if (LEGACY_INTERNAL_SHELL_PATTERN.test(visibleText)) {
    warnings.push(`${surface.file}: legacy compat page still carries old shell language; keep out of default navigation`);
  }
}

for (const surface of SURFACES) {
  const html = read(surface.file);
  const visibleText = stripSource(html);
  ensureBaseSurface(surface, html);

  if (AI_FLAVOR_PATTERN.test(visibleText) && surface.type !== 'consumer') {
    warnings.push(`${surface.file}: contains AI/demo flavor wording; keep language specific`);
  }

  if (surface.type === 'consumer' || surface.type === 'customer-portal') {
    ensureConsumerSurface(surface, html, visibleText);
  } else if (surface.type === 'enterprise') {
    ensureEnterpriseSurface(surface, html, visibleText);
  } else if (surface.type === 'legacy-compat') {
    ensureLegacyCompat(surface, html, visibleText);
  }
}

for (const file of PRODUCTION_SHARED_FILES) {
  const source = read(file);
  if (/ai-consultation\.html/.test(source)) {
    failures.push(`${file}: production shared UI references legacy consultation entry`);
  }
  if (LEGACY_SURFACE_LINK_PATTERN.test(source)) {
    failures.push(`${file}: production shared UI references legacy/prototype page`);
  }
}

console.log(`UI/VI Check: surfaces = ${SURFACES.length}, shared files = ${PRODUCTION_SHARED_FILES.length}, failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
