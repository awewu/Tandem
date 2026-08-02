#!/usr/bin/env node
/**
 * 反向能力审计 (Reverse Capability Audit)
 * 以代码为真相，反查后端实现的能力，标出 PRD/宪章未记录或无 owner 归属的部分。
 * 目的：重构前确保"代码里做了但 PRD 没写"的功能不被误删。
 * 仅用 Node 内置模块。输出 JSON + Markdown 到 audit/。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'audit');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_JSON = path.join(OUT_DIR, 'reverse-capability-audit-report.json');
const OUT_MD = path.join(OUT_DIR, 'reverse-capability-audit-report.md');

// 宪章/契约里声明的后端领域模块 (PROJECT-CHARTER.md 第 5.2 节)
const CHARTER_MODULES = [
  'auth', 'tenant', 'crm', 'diagnosis', 'product-catalog', 'quote',
  'delivery', 'lifecycle', 'analytics', 'governance',
  'file-artifact', 'notification', 'workflow',
];

// 把引擎/路由名归类到宪章模块的启发式关键词映射
const DOMAIN_KEYWORDS = {
  auth: ['auth', 'role', 'login', 'session', 'security', 'encryption', 'mask'],
  tenant: ['tenant', 'dealer', 'store'],
  crm: ['crm', 'customer', 'opportunity', 'lead', 'sales', 'interaction', 'journey', 'fission', 'channel', 'marketing'],
  diagnosis: ['diagnosis', 'painpoint', 'pain', 'consultant', 'llm', 'rag', 'aimatching', 'matching', 'smartbrain', 'voice'],
  'product-catalog': ['product', 'material', 'device', 'selection', 'housetype', 'library', 'standards', 'climate', 'cities'],
  quote: ['quote', 'quotation', 'price', 'pricing', 'tax', 'currency', 'promotion', 'value', 'package', 'commercial'],
  delivery: ['construction', 'workorder', 'fieldservice', 'delivery', 'site', 'task'],
  lifecycle: ['lifecycle', 'iot', 'econet', 'digitaltwin', 'mqtt', 'device', 'monitoring', 'heartbeat', 'predictive'],
  analytics: ['analytics', 'report', 'industryplatform', 'performance', 'energy', 'carbon'],
  governance: ['governance', 'audit', 'selfcheck', 'evolution', 'feedback', 'deployment', 'backup', 'cache', 'observability'],
  'file-artifact': ['export', 'ppt', 'template', 'pdf', 'artifact', 'storage'],
  notification: ['notification', 'webhook', 'notify'],
  workflow: ['workflow', 'orchestrat', 'outbox', 'closedloop', 'enterpriseloop', 'coordination', 'agent', 'smartrouting', 'routing'],
};

function listFiles(dir, ext = '.js') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => path.join(dir, f));
}

function classify(name) {
  const low = name.toLowerCase();
  const hits = [];
  for (const [mod, kws] of Object.entries(DOMAIN_KEYWORDS)) {
    if (kws.some((kw) => low.includes(kw))) hits.push(mod);
  }
  return hits;
}

// 是否被任何地方 require/import 引用 (粗略：在 server/ 下 grep 文件基名)
function buildReferenceIndex() {
  const refs = new Set();
  const scanDirs = ['server', 'services'];
  const stack = scanDirs.map((d) => path.join(ROOT, d));
  const text = [];
  while (stack.length) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    const stat = fs.statSync(cur);
    if (stat.isDirectory()) {
      for (const e of fs.readdirSync(cur)) {
        if (e === 'node_modules') continue;
        stack.push(path.join(cur, e));
      }
    } else if (cur.endsWith('.js') || cur.endsWith('.ts')) {
      try { text.push(fs.readFileSync(cur, 'utf8')); } catch (_) {}
    }
  }
  const blob = text.join('\n');
  return { blob };
}

function isReferenced(baseName, refIndex, selfPath) {
  // 统计 require/import 中出现该基名(不含扩展)的次数，排除自身定义
  const stem = baseName.replace(/\.(js|ts)$/, '');
  const re = new RegExp(`['"\\/]${stem}['"\\.]`, 'g');
  const matches = refIndex.blob.match(re);
  return matches ? matches.length : 0;
}

function main() {
  const refIndex = buildReferenceIndex();

  const sources = [
    { group: 'core-engine', dir: path.join(ROOT, 'server', 'core') },
    { group: 'engine', dir: path.join(ROOT, 'server', 'engines') },
    { group: 'route', dir: path.join(ROOT, 'server', 'routes') },
    { group: 'model', dir: path.join(ROOT, 'server', 'models') },
  ];

  const items = [];
  for (const src of sources) {
    for (const file of listFiles(src.dir)) {
      const base = path.basename(file);
      const domains = classify(base);
      const refCount = isReferenced(base, refIndex, file);
      let size = 0;
      try { size = fs.statSync(file).size; } catch (_) {}
      items.push({
        group: src.group,
        file: path.relative(ROOT, file),
        name: base,
        mappedDomains: domains,
        ownerStatus: domains.length === 0 ? 'UNMAPPED' : (domains.length > 1 ? 'AMBIGUOUS' : 'MAPPED'),
        referencedCount: refCount,
        likelyDead: refCount <= 1, // 只出现在自身定义处
        sizeBytes: size,
      });
    }
  }

  const summary = {
    total: items.length,
    byGroup: {},
    unmapped: items.filter((i) => i.ownerStatus === 'UNMAPPED'),
    ambiguous: items.filter((i) => i.ownerStatus === 'AMBIGUOUS'),
    likelyDead: items.filter((i) => i.likelyDead),
  };
  for (const i of items) {
    summary.byGroup[i.group] = (summary.byGroup[i.group] || 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    purpose: '反向能力审计：以代码为真相，标出宪章未归属或疑似死代码的后端能力',
    charterModules: CHARTER_MODULES,
    summary: {
      total: summary.total,
      byGroup: summary.byGroup,
      unmappedCount: summary.unmapped.length,
      ambiguousCount: summary.ambiguous.length,
      likelyDeadCount: summary.likelyDead.length,
    },
    items,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  // Markdown
  const lines = [];
  lines.push('# 反向能力审计报告');
  lines.push('');
  lines.push(`> 生成时间：${report.generatedAt}`);
  lines.push('> 目的：以代码为真相，反查 PRD/宪章未记录或无 owner 归属的后端能力，重构前防止误删。');
  lines.push('');
  lines.push('## 概览');
  lines.push('');
  lines.push(`- 扫描资产总数：${summary.total}`);
  for (const [g, n] of Object.entries(summary.byGroup)) lines.push(`  - ${g}: ${n}`);
  lines.push(`- 无宪章模块归属 (UNMAPPED)：${summary.unmapped.length}`);
  lines.push(`- 归属模糊 (AMBIGUOUS，命中多个模块需人工裁定)：${summary.ambiguous.length}`);
  lines.push(`- 疑似死代码 (引用<=1，需人工确认)：${summary.likelyDead.length}`);
  lines.push('');
  lines.push('## 无归属资产 (优先人工裁定)');
  lines.push('');
  if (summary.unmapped.length === 0) {
    lines.push('无。');
  } else {
    lines.push('| 文件 | 组 | 引用数 | 疑似死代码 |');
    lines.push('|---|---|---:|---|');
    for (const i of summary.unmapped) {
      lines.push(`| ${i.file} | ${i.group} | ${i.referencedCount} | ${i.likelyDead ? 'YES' : ''} |`);
    }
  }
  lines.push('');
  lines.push('## 疑似死代码 (引用<=1)');
  lines.push('');
  if (summary.likelyDead.length === 0) {
    lines.push('无。');
  } else {
    lines.push('| 文件 | 组 | 映射域 | 引用数 |');
    lines.push('|---|---|---|---:|');
    for (const i of summary.likelyDead) {
      lines.push(`| ${i.file} | ${i.group} | ${i.mappedDomains.join(', ') || '-'} | ${i.referencedCount} |`);
    }
  }
  lines.push('');
  lines.push('## 全量资产 -> 宪章模块映射');
  lines.push('');
  lines.push('| 文件 | 组 | 映射宪章模块 | 状态 | 引用数 |');
  lines.push('|---|---|---|---|---:|');
  for (const i of items.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))) {
    lines.push(`| ${i.file} | ${i.group} | ${i.mappedDomains.join(', ') || '(无)'} | ${i.ownerStatus} | ${i.referencedCount} |`);
  }
  lines.push('');
  fs.writeFileSync(OUT_MD, lines.join('\n'));

  console.log('反向能力审计完成。');
  console.log(`总资产 ${summary.total}：`, summary.byGroup);
  console.log(`UNMAPPED ${summary.unmapped.length} | AMBIGUOUS ${summary.ambiguous.length} | likelyDead ${summary.likelyDead.length}`);
  console.log(`报告：${path.relative(ROOT, OUT_JSON)} , ${path.relative(ROOT, OUT_MD)}`);
}

main();
