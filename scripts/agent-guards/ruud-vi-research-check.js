#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('./_artifact-gate').requireArtifactOrSkip('docs/_archive/RUUD-VI-RESEARCH.md', {
  guard: 'guard:ruud-vi', reason: 'docs/_archive VI 研究文档 git 历史 0 次、从未入库；Ruud 站 VI 由 guard:rheem-vi-production 体系覆盖',
});
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

const REQUIRED_FILES = [
  'docs/_archive/RUUD-COM-FULLSITE-VI-AUDIT.md',
  'docs/_archive/RUUD-VI-RESEARCH.md',
  'docs/_archive/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md'
];

// ============================================================
// OFFICIAL RUUD VI/SI STANDARD LOCK (Brand Toolkit RHM5839A)
// Source of truth: docs/brand-standards/RUUD-OFFICIAL-VI-SI-STANDARD.md
// Locked archive: docs/brand-standards/assets/RUUD-Brand-Toolkit-RHM5839A-2024-R3b.pdf
// ============================================================
const OFFICIAL_STANDARD_MD = 'docs/brand-standards/RUUD-OFFICIAL-VI-SI-STANDARD.md';
const OFFICIAL_STANDARD_PDF = 'docs/brand-standards/assets/RUUD-Brand-Toolkit-RHM5839A-2024-R3b.pdf';
const OFFICIAL_PDF_SHA256 = '3af01cf0db845c9275cfe910d3ad0eee48802cedabe16cc6ec155dea9181c87a';

// Official hex values that MUST appear in the standard doc.
const OFFICIAL_HEX = ['#E4002B', '#76232F', '#F26729', '#FFD200'];

// Ruud-scoped implementation files that must carry the official dark red
// and must NOT carry any of the historically-wrong dark-red values.
const RUUD_IMPL_FILES = [
  'packages/tokens/ruud-cn.css',
  'public/ruud-brand.css',
  'public/dual-brand.css',
  'public/images/ruud-logo.svg'
];
const FORBIDDEN_DARK_RED = ['#A50016', '#B80023', '#9A001C'];
const OFFICIAL_DARK_RED = '#76232F';

const REQUIRED_URLS = [
  'https://www.ruud.com/sitemap/',
  'https://www.ruud.com/',
  'https://www.ruud.com/products/',
  'https://www.ruud.com/products/water-heaters/',
  'https://www.ruud.com/products/hvac/',
  'https://www.ruud.com/products/commercial/',
  'https://www.ruud.com/commercial-resource-center/',
  'https://www.ruud.com/econet/',
  'https://www.ruud.com/product/ruud-thermostats-econet-control-center/',
  'https://www.ruud.com/product/ruud-heat-pumps-value-series-single-stage/',
  'https://www.ruud.com/econetconnect/',
  'https://www.ruud.com/find-a-pro/',
  'https://www.ruud.com/find-a-contractor/',
  'https://www.ruud.com/warranty/',
  'https://www.ruud.com/verify/',
  'https://www.ruud.com/homeowners/',
  'https://www.ruud.com/mobile/',
  'https://www.ruud.com/sustainability/'
];

const REQUIRED_TAXONOMY = [
  'Water Heating',
  'Heating and Cooling',
  'HVAC',
  'Commercial Products',
  'Commercial Resource Center',
  'Homeowners Resource Center',
  'Find a Pro',
  'Find a Contractor',
  'Warranty',
  'EcoNet',
  'Mobile Apps',
  'BIM/CAD',
  'CertiSpec',
  'EZ-Spec',
  '48-Hour Delivery',
  'Product Documents',
  'Parts',
  'Register Your Product'
];

const REQUIRED_RHAUTT_TRANSLATIONS = [
  'central hot water',
  'all-air/AC/fresh air',
  'water treatment',
  'smart control',
  'lifecycle service',
  'Specs/Docs',
  'Warranty/Service',
  'Financing/Quote',
  'Lifecycle/IoT',
  'automated installation',
  'maintenance alerts',
  'remote control',
  'dealer',
  'designer',
  'business console'
];

const failures = [];

for (const file of REQUIRED_FILES) {
  if (!exists(file)) failures.push(`missing required Ruud VI file: ${file}`);
}

if (exists('docs/_archive/RUUD-COM-FULLSITE-VI-AUDIT.md')) {
  const audit = read('docs/_archive/RUUD-COM-FULLSITE-VI-AUDIT.md');
  for (const url of REQUIRED_URLS) {
    if (!audit.includes(url)) failures.push(`Ruud full-site audit missing URL evidence: ${url}`);
  }
  for (const token of REQUIRED_TAXONOMY) {
    if (!audit.toLowerCase().includes(token.toLowerCase())) {
      failures.push(`Ruud full-site audit missing taxonomy token: ${token}`);
    }
  }
  for (const token of REQUIRED_RHAUTT_TRANSLATIONS) {
    if (!audit.toLowerCase().includes(token.toLowerCase())) {
      failures.push(`Ruud full-site audit missing Rhautt translation token: ${token}`);
    }
  }
  if (!audit.includes('Evidence Limitation')) {
    failures.push('Ruud full-site audit must keep screenshot/CSS evidence limitation visible');
  }
}

if (exists('docs/_archive/RUUD-VI-RESEARCH.md')) {
  const research = read('docs/_archive/RUUD-VI-RESEARCH.md');
  if (!research.includes('docs/_archive/RUUD-COM-FULLSITE-VI-AUDIT.md')) {
    failures.push('Ruud VI research must reference the full-site audit');
  }
}

if (exists('docs/_archive/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md')) {
  const vi = read('docs/_archive/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md');
  if (!vi.includes('docs/_archive/RUUD-COM-FULLSITE-VI-AUDIT.md')) {
    failures.push('UI/VI architecture must reference the Ruud full-site audit');
  }
  for (const token of ['Product-family first', 'Professional resource first', 'Owner lifecycle first']) {
    if (!vi.includes(token)) failures.push(`UI/VI architecture missing derived rule: ${token}`);
  }
}

// ---- Official standard lock checks ----
if (!exists(OFFICIAL_STANDARD_MD)) {
  failures.push(`missing official Ruud VI/SI standard: ${OFFICIAL_STANDARD_MD}`);
} else {
  const std = read(OFFICIAL_STANDARD_MD);
  for (const hex of OFFICIAL_HEX) {
    if (!std.toUpperCase().includes(hex)) {
      failures.push(`official Ruud standard missing required hex: ${hex}`);
    }
  }
  if (!std.includes(OFFICIAL_PDF_SHA256)) {
    failures.push('official Ruud standard must record the archived PDF SHA256');
  }
  if (!std.includes('PMS 188')) {
    failures.push('official Ruud standard must document DARK RED = PMS 188 C (#76232F)');
  }
}

if (!exists(OFFICIAL_STANDARD_PDF)) {
  failures.push(`missing locked Ruud brand toolkit PDF: ${OFFICIAL_STANDARD_PDF}`);
} else {
  const buf = fs.readFileSync(path.join(ROOT, OFFICIAL_STANDARD_PDF));
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  if (sha !== OFFICIAL_PDF_SHA256) {
    failures.push(`Ruud brand toolkit PDF SHA256 mismatch (locked). expected ${OFFICIAL_PDF_SHA256}, got ${sha}`);
  }
}

// ---- Implementation hex conformance ----
for (const file of RUUD_IMPL_FILES) {
  if (!exists(file)) {
    failures.push(`missing Ruud implementation file: ${file}`);
    continue;
  }
  const content = read(file).toUpperCase();
  for (const bad of FORBIDDEN_DARK_RED) {
    if (content.includes(bad)) {
      failures.push(`${file} uses forbidden non-official Ruud dark red ${bad}; official is ${OFFICIAL_DARK_RED} (PMS 188 C)`);
    }
  }
  if (!content.includes(OFFICIAL_DARK_RED)) {
    failures.push(`${file} must use official Ruud dark red ${OFFICIAL_DARK_RED} (PMS 188 C)`);
  }
}

console.log(`Ruud VI Research Check: files = ${REQUIRED_FILES.length}, URLs = ${REQUIRED_URLS.length}, failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
