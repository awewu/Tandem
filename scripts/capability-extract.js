#!/usr/bin/env node
/**
 * 能力提取 (Capability Extraction)
 * 以代码为真相，提取每个引擎/服务的类与方法、每个路由的 HTTP 端点。
 * 目的：解耦重组前，先看清"代码到底做了什么功能"，不靠文件名猜。
 * 仅用 Node 内置模块。输出 JSON + Markdown 到 audit/。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'audit');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT_JSON = path.join(OUT_DIR, 'capability-extract.json');
const OUT_MD = path.join(OUT_DIR, 'capability-extract.md');

function listJs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => path.join(dir, f));
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

// 提取类名
function extractClasses(src) {
  const out = [];
  const re = /(?:^|\n)\s*(?:export\s+)?class\s+([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

// 提取方法名(类内方法/对象方法)，排除控制流关键字
const STOP = new Set(['if', 'for', 'while', 'switch', 'catch', 'constructor', 'return', 'function', 'super', 'await', 'typeof', 'new']);
function extractMethods(src) {
  const out = new Set();
  // 形如:  methodName( 或 async methodName(
  const re = /(?:^|\n)\s*(?:async\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (!STOP.has(name)) out.add(name);
  }
  return [...out];
}

// 提取 HTTP 端点
function extractEndpoints(src) {
  const out = [];
  const re = /\b(?:router|app)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = re.exec(src))) out.push(`${m[1].toUpperCase()} ${m[2]}`);
  return out;
}

function main() {
  const engineDirs = [path.join(ROOT, 'server', 'core'), path.join(ROOT, 'server', 'engines')];
  const routeDir = path.join(ROOT, 'server', 'routes');

  const engines = [];
  for (const dir of engineDirs) {
    for (const file of listJs(dir)) {
      const src = read(file);
      const methods = extractMethods(src);
      engines.push({
        file: path.relative(ROOT, file),
        name: path.basename(file, '.js'),
        classes: extractClasses(src),
        methodCount: methods.length,
        methods,
        loc: src.split('\n').length,
      });
    }
  }

  const routes = [];
  let endpointTotal = 0;
  for (const file of listJs(routeDir)) {
    const src = read(file);
    const eps = extractEndpoints(src);
    endpointTotal += eps.length;
    routes.push({
      file: path.relative(ROOT, file),
      name: path.basename(file, '.js'),
      endpointCount: eps.length,
      endpoints: eps,
      loc: src.split('\n').length,
    });
  }

  const totalMethods = engines.reduce((a, e) => a + e.methodCount, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    purpose: '能力提取：以代码为真相，列出引擎方法与路由端点，作为解耦重组的事实基础',
    summary: {
      engineFiles: engines.length,
      totalEngineMethods: totalMethods,
      routeFiles: routes.length,
      totalEndpoints: endpointTotal,
    },
    engines: engines.sort((a, b) => b.methodCount - a.methodCount),
    routes: routes.sort((a, b) => b.endpointCount - a.endpointCount),
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

  const lines = [];
  lines.push('# 能力提取报告');
  lines.push('');
  lines.push(`> 生成时间：${report.generatedAt}`);
  lines.push('> 目的：以代码为真相，列出每个引擎的方法与每个路由的端点，作为解耦重组的事实基础。');
  lines.push('');
  lines.push('## 概览');
  lines.push('');
  lines.push(`- 引擎/服务文件：${report.summary.engineFiles}`);
  lines.push(`- 引擎方法总数：${report.summary.totalEngineMethods}`);
  lines.push(`- 路由文件：${report.summary.routeFiles}`);
  lines.push(`- HTTP 端点总数：${report.summary.totalEndpoints}`);
  lines.push('');
  lines.push('## 引擎能力（按方法数降序）');
  lines.push('');
  for (const e of report.engines) {
    lines.push(`### ${e.name} (${e.methodCount} 方法, ${e.loc} 行)`);
    lines.push(`文件：${e.file}`);
    if (e.classes.length) lines.push(`类：${e.classes.join(', ')}`);
    lines.push('方法：' + (e.methods.length ? e.methods.join(', ') : '(无显式方法)'));
    lines.push('');
  }
  lines.push('## 路由端点（按端点数降序）');
  lines.push('');
  for (const r of report.routes) {
    lines.push(`### ${r.name} (${r.endpointCount} 端点)`);
    lines.push(`文件：${r.file}`);
    for (const ep of r.endpoints) lines.push(`- ${ep}`);
    lines.push('');
  }
  fs.writeFileSync(OUT_MD, lines.join('\n'));

  console.log('能力提取完成。');
  console.log(`引擎 ${report.summary.engineFiles} 文件 / ${report.summary.totalEngineMethods} 方法；路由 ${report.summary.routeFiles} 文件 / ${report.summary.totalEndpoints} 端点`);
  console.log(`报告：${path.relative(ROOT, OUT_JSON)} , ${path.relative(ROOT, OUT_MD)}`);
}

main();
