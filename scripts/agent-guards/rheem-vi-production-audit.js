#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const scanRoots = ['public', 'src', 'apps', 'packages', 'frontend'].map((dir) => path.join(root, dir));
const outputPath = path.join(root, 'audit', 'rheem-vi-production-audit.json');

const extensions = new Set([
  '.html',
  '.css',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.svg',
  '.md',
]);

const checks = [
  {
    id: 'old-rheem-red-hex',
    severity: 'high',
    pattern: /#C41230|#c41230/g,
    message: 'Old Rheem red appears. Official-aligned token is #E4002B.',
  },
  {
    id: 'old-rheem-red-rgba',
    severity: 'high',
    pattern: /rgba?\(\s*196\s*,\s*18\s*,\s*48\b/gi,
    message: 'Old Rheem red RGB appears. Use rgba(228, 0, 43, ...).',
  },
  {
    id: 'local-logo-production-risk',
    severity: 'critical',
    pattern: /\/images\/rheem-logo\.svg|public\/images\/rheem-logo\.svg/g,
    message: 'Local Rheem logo path appears. Production use is gated until approved brand package asset is installed.',
  },
  {
    id: 'fake-logo-lockup-language',
    severity: 'critical',
    pattern: /Since 1925|Flame\/Heat|flame mark|fake Chinese lockup/gi,
    message: 'Potential fake Rheem lockup or forbidden logo language appears.',
  },
  {
    id: 'red-pink-gradient',
    severity: 'medium',
    pattern: /#ff6b6b|#E91E63|#e91e63|FF6B8A|ff6b8a/g,
    message: 'Red-pink gradient/accent appears. Verify against Rheem official palette before production.',
  },
];

const contextualChecks = [
  {
    id: 'fake-logo-lockup-language',
    severity: 'critical',
    pattern: /瑞\s*美/gi,
    message: 'Potential fake Rheem Chinese lockup appears near logo/wordmark usage.',
    shouldFlag({ relativePath, snippet }) {
      return (
        /rheem-logo\.svg$/.test(relativePath) ||
        /logo|wordmark|lockup|brand-mark|brand-logo|brand-card|Since 1925/i.test(snippet)
      );
    }
  }
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function excerpt(text, index) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + 140);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

const files = scanRoots.flatMap((dir) => walk(dir));
const findings = [];

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const check of checks) {
    check.pattern.lastIndex = 0;
    let match;
    while ((match = check.pattern.exec(text)) !== null) {
      findings.push({
        id: check.id,
        severity: check.severity,
        message: check.message,
        file: path.relative(root, file),
        line: lineOf(text, match.index),
        match: match[0],
        excerpt: excerpt(text, match.index),
      });
    }
  }

  const relativePath = path.relative(root, file);
  for (const check of contextualChecks) {
    check.pattern.lastIndex = 0;
    let match;
    while ((match = check.pattern.exec(text)) !== null) {
      const snippet = excerpt(text, match.index);
      if (!check.shouldFlag({ relativePath, snippet, text, match })) continue;
      findings.push({
        id: check.id,
        severity: check.severity,
        message: check.message,
        file: relativePath,
        line: lineOf(text, match.index),
        match: match[0],
        excerpt: snippet,
      });
    }
  }
}

const counts = findings.reduce(
  (acc, finding) => {
    acc.total += 1;
    acc.bySeverity[finding.severity] = (acc.bySeverity[finding.severity] || 0) + 1;
    acc.byRule[finding.id] = (acc.byRule[finding.id] || 0) + 1;
    return acc;
  },
  { total: 0, bySeverity: {}, byRule: {} },
);

const report = {
  generatedAt: new Date().toISOString(),
  scope: scanRoots.map((dir) => path.relative(root, dir)).filter(Boolean),
  productionStatus:
    counts.bySeverity.critical || counts.bySeverity.high
      ? 'blocked'
      : counts.total
        ? 'needs-review'
        : 'pass',
  counts,
  topFiles: Object.entries(
    findings.reduce((acc, finding) => {
      acc[finding.file] = (acc[finding.file] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([file, count]) => ({ file, count })),
  findings,
  recommendations: [
    'Import public/css/rheem-official-tokens.css on Rheem-branded surfaces.',
    'Replace #C41230 and rgba(196,18,48,...) with official-aligned #E4002B / rgba(228,0,43,...).',
    'Replace red-pink gradients with official palette roles from public/design-tokens/rheem-official.tokens.json.',
    'Install an approved Rheem logo package asset before production use of /images/rheem-logo.svg.',
    'Run responsive screenshot QA after migrating each route.',
  ],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({ status: report.productionStatus, counts: report.counts, outputPath: path.relative(root, outputPath) }, null, 2));

if (process.argv.includes('--fail-on-blocked') && report.productionStatus === 'blocked') {
  process.exit(1);
}
