#!/usr/bin/env node
/**
 * 技术内容页生成器（L1 技术事实 → L2 品牌内容 · 宪章 §2 因果链）
 *
 * 为什么存在：
 *   AI 时代最值得被引用的不是营销话术，是**权威技术内容**（E-E-A-T）。
 *   本仓的技术护城河（packages/domain/hvac-kernels，9 域 7,456 行，锚定 GB 50118 /
 *   GB 50736 / GB 50015）此前只服务于后台计算，从未对外内容化——
 *   导致「AI 能找到我们、能读懂结构，却没有权威内容可引」。
 *
 * 铁律（宪章 §5.5.2 事实链隔离）：
 *   页面上的每一个数值**直接从内核读取**，不在本文件硬编码、不由模型生成。
 *   内核改了，页面跟着改；页面与内核永远同源。
 *
 * VI（宪章 §5.5.6-A）：
 *   只用品牌 token 变量（--brand-primary 等），**不写死 hex**。
 *   对外品牌站主色由厂商官方品牌工具包决定（Ruud=#E4002B/PMS 185，不可更改）。
 *
 * 运行：node scripts/geo/gen-tech-content-pages.mjs [--site ruud-cn] [--dry]
 * 之后必须跑：npm run geo:build && npm run guard:geo
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
// --check：不写盘，只校验磁盘上的页面与「当前内核事实」是否同源。
// 用途：防止有人手改 HTML 数值、或内核改了页面没重生成 → 品牌对外发布过期/错误的技术数据。
const CHECK = args.includes('--check');
const wantSite = (() => { const i = args.indexOf('--site'); return i > -1 ? args[i + 1] : null; })();

// ── L1 技术事实：直接从内核读取（唯一真相源）────────────────────────────────
const kernels = require(join(ROOT, 'packages/domain/hvac-kernels'));
const Hydraulic = require(join(ROOT, 'packages/domain/hvac-kernels/hydraulic/HydraulicEngine'));

const NOISE_LIMITS = kernels.noise.GB50118_INDOOR_LIMITS;
const WATER_VELOCITY = Hydraulic.VELOCITY;
const AIR_VELOCITY = Hydraulic.AIR_VELOCITY;

// ── 文案层：运营可编辑（宪章 §5.5.6-B「数值锁死 · 文案可运营」）──────────────
// 该 JSON **结构上不含任何数值字段**：表格数据一律来自内核，文案里的数字只能通过
// {占位符} 由内核值填充。因此运营改文案改不动数值，改错也不会让页面与计算脱节。
const COPY = JSON.parse(readFileSync(join(ROOT, 'content/tech-content.zh-CN.json'), 'utf8'));
const S = COPY.shared;

/** 用内核事实填充文案占位符；未知占位符原样保留并在校验时暴露。 */
function fill(tpl, vars) {
  return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// ── 数值锁的第二道闸：文案里禁止裸写「数字+单位」──────────────────────────
// 背景（实测漏洞）：表格数据结构上锁住了，但运营仍可在自由文案里写
// 「99 dB(A)」这类假数值，与上方表格自相矛盾并对外发布。
// 规则：技术量必须经 {占位符} 由内核填充；文案里不得出现数字紧跟工程单位。
// 国标编号（GB 50118-2010）无单位，不受影响。
const UNIT_AFTER_NUMBER = /\d+(?:\.\d+)?\s*(?:dB\(A\)|dB|m\/s|m³\/h|W\/m²|W\/m2|kW|Pa|℃|次\/h)/;

function assertNoLiteralQuantity(where, text) {
  const raw = String(text);
  // 先剥掉占位符，避免把 {bedroomNight} dB(A) 误判
  const stripped = raw.replace(/\{\w+\}/g, '§');
  const hit = stripped.match(UNIT_AFTER_NUMBER);
  if (hit) {
    throw new Error(
      `文案 ${where} 里出现裸写数值「${hit[0]}」。技术量必须用 {占位符} 由内核填充，`
      + '不得在文案中手写——否则会与限值表自相矛盾并对外发布。'
      + `可用占位符：${Object.keys(KERNEL_VARS).join(', ')}`,
    );
  }
}

const ROOM_LABEL = {
  bedroom: '卧室', livingroom: '起居室（客厅）', study: '书房',
  office: '办公室', meeting: '会议室', ward: '病房', classroom: '教室',
};
const WATER_LABEL = { hot_water: '生活热水管', heating: '采暖供回水管', main: '干管' };
const AIR_LABEL = { main: '主风管', branch: '支风管', terminal: '末端送风口' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 页面装配：文案 ← JSON（运营可编辑）；数值 ← 内核（锁死）─────────────────
// 表格 rows 只由内核构造，JSON 里没有、也无法提供 rows。
const TABLE_BUILDERS = {
  'indoor-noise-limits': () => Object.entries(NOISE_LIMITS).map(([key, v]) => [
    ROOM_LABEL[key] || key, String(v.day), v.night === undefined ? '—' : String(v.night),
  ]),
  'water-velocity': () => Object.entries(WATER_VELOCITY).map(([key, v]) => [
    WATER_LABEL[key] || key, String(v.min), String(v.ideal), String(v.max),
  ]),
  'duct-velocity': () => Object.entries(AIR_VELOCITY).map(([key, v]) => [
    AIR_LABEL[key] || key, String(v.ideal), String(v.max),
  ]),
};

/** 占位符变量表：全部取自内核，运营无法注入或篡改数值。 */
const KERNEL_VARS = {
  roomTypeCount: Object.keys(NOISE_LIMITS).length,
  bedroomNight: NOISE_LIMITS.bedroom?.night,
  bedroomDay: NOISE_LIMITS.bedroom?.day,
  wardNight: NOISE_LIMITS.ward?.night,
  studyDay: NOISE_LIMITS.study?.day,
  hotWaterMin: WATER_VELOCITY.hot_water?.min,
  hotWaterIdeal: WATER_VELOCITY.hot_water?.ideal,
  hotWaterMax: WATER_VELOCITY.hot_water?.max,
  heatingMin: WATER_VELOCITY.heating?.min,
  heatingIdeal: WATER_VELOCITY.heating?.ideal,
  heatingMax: WATER_VELOCITY.heating?.max,
  terminalIdeal: AIR_VELOCITY.terminal?.ideal,
  terminalMax: AIR_VELOCITY.terminal?.max,
  mainIdeal: AIR_VELOCITY.main?.ideal,
  mainMax: AIR_VELOCITY.main?.max,
};

function pages() {
  return Object.entries(COPY.pages).map(([slug, c]) => {
    const build = TABLE_BUILDERS[slug];
    if (!build) throw new Error(`文案定义了页面 ${slug}，但没有对应的内核数据构造器——数值不能由文案提供。`);

    // 数值锁第二道闸：逐个文案字段校验，禁止裸写技术量。
    assertNoLiteralQuantity(`${slug}.lead`, c.lead);
    assertNoLiteralQuantity(`${slug}.descTemplate`, c.descTemplate);
    (c.method || []).forEach((m, i) => assertNoLiteralQuantity(`${slug}.method[${i}]`, m));
    (c.faq || []).forEach((f, i) => {
      assertNoLiteralQuantity(`${slug}.faq[${i}].q`, f.q);
      assertNoLiteralQuantity(`${slug}.faq[${i}].aTemplate`, f.aTemplate);
    });

    return {
      slug,
      title: c.title,
      standard: c.standard,
      desc: fill(c.descTemplate, KERNEL_VARS),
      lead: c.lead,
      table: { head: c.tableHead, rows: build() },
      method: c.method,
      faq: c.faq.map((f) => ({ q: f.q, a: fill(f.aTemplate, KERNEL_VARS) })),
    };
  });
}

// ── 站点设计系统同源提取 ─────────────────────────────────────────────────
// 原则与「数值同源内核」一致：**样式同源站点**。
// 技术页不得另起炉灶写一套视觉——那会让它看起来不属于这个品牌站。
// 从各站首页提取 <style> 与 <header>，站点改版时技术页自动跟随。
function siteShell(site) {
  const home = join(ROOT, site.app, 'public', 'index.html');
  if (!existsSync(home)) return { baseCss: '', header: '' };
  const html = readFileSync(home, 'utf8');
  const baseCss = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const header = (html.match(/<header[\s\S]*?<\/header>/i) || [''])[0];
  return { baseCss, header };
}

/** 技术页专属增补样式（只补站点没有的：正文排版 + 表格 + FAQ）。 */
const TECH_CSS = `
    .tech-main { padding: 40px 0 72px; }
    .tech-body { max-width: 860px; }
    .crumb { font-size: 13px; color: #888; margin-bottom: 20px; }
    .crumb a { color: #888; text-decoration: none; }
    .crumb a:hover { color: var(--brand-primary); }
    .std-badge { display: inline-block; border-left: 3px solid var(--brand-primary); padding: 6px 0 6px 14px; color: #555; font-size: 14px; margin: 14px 0 24px; }
    .tech-lead { font-size: 17px; color: #333; line-height: 1.9; margin-bottom: 8px; }
    .tech-table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--brand-border); border-radius: var(--brand-radius); overflow: hidden; }
    .tech-table caption { text-align: left; font-size: 13px; color: #888; padding: 0 0 10px; caption-side: top; }
    .tech-table th, .tech-table td { padding: 12px 16px; border-top: 1px solid var(--brand-border); text-align: left; font-size: 15px; }
    .tech-table thead th { background: var(--brand-surface); font-weight: 700; border-top: 0; }
    .tech-table tbody th { font-weight: 600; }
    .method-list { padding-left: 22px; }
    .method-list li { margin-bottom: 10px; color: #444; }
    .faq-card h3 { font-size: 16px; margin-bottom: 8px; }
    .faq-card p { color: #555; font-size: 15px; }
    .tech-note { margin-top: 36px; padding: 16px 18px; background: #fff; border: 1px solid var(--brand-border); border-radius: var(--brand-radius); font-size: 14px; color: #666; }
    .tech-index-list { list-style: none; }
    .tech-index-list li { margin-bottom: 14px; }
    .tech-index-list a { font-size: 18px; font-weight: 700; color: var(--brand-primary); text-decoration: none; display: block; margin-bottom: 4px; }
    .tech-index-list span { color: #888; font-size: 13px; }
`;

// ── 模板：只用品牌 token 变量，不写死 hex（宪章 §5.5.6-A）──────────────────
function render(site, page) {
  const crumb = `<nav class="crumb"><a href="/">${esc(S.crumbHome)}</a> / <a href="/tech/">${esc(S.crumbTech)}</a> / <span>${esc(page.title)}</span></nav>`;
  const rows = page.table.rows
    .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`)
    .join('\n          ');
  const faq = page.faq.map((f) => `<div class="card faq-card"><div class="accent-bar"></div><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('\n            ');
  const method = page.method.map((m) => `<li>${esc(m)}</li>`).join('\n            ');
  const { baseCss, header } = siteShell(site);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title)} | ${esc(site.brandName)}</title>
  <meta name="description" content="${esc(page.desc)}">
  <link rel="stylesheet" href="/packages/tokens/${site.slug}.css">
  <style>${baseCss}${TECH_CSS}  </style>
</head>
<body>
${header}
  <section class="hero">
    <div class="container">
      ${crumb}
      <h1>${esc(page.title)}</h1>
      <p>${esc(page.lead)}</p>
      <p class="std-badge">依据：${esc(page.standard)}</p>
    </div>
  </section>

  <section class="section tech-main">
    <div class="container tech-body">
      <h2>${esc(S.sectionTable)}</h2>
      <table class="tech-table">
        <caption>${esc(fill(S.tableCaptionTemplate, { standard: page.standard }))}</caption>
        <thead><tr>${page.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <h2>${esc(S.sectionMethod)}</h2>
      <ol class="method-list">
            ${method}
      </ol>

      <h2>${esc(S.sectionFaq)}</h2>
      <div class="cards">
            ${faq}
      </div>

      <p class="tech-note">${esc(fill(S.disclaimerTemplate, { brandName: site.brandName }))}</p>
    </div>
  </section>

  <footer><div class="container">${esc(site.brandName)} · ${esc(S.footerSuffix)}</div></footer>
</body>
</html>
`;
}

function indexPage(site, list) {
  const items = list.map((p) => `<li><a href="/tech/${p.slug}/">${esc(p.title)}</a><span>${esc(p.standard)}</span></li>`).join('\n            ');
  const { baseCss, header } = siteShell(site);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(COPY.index.title)} | ${esc(site.brandName)}</title>
  <meta name="description" content="${esc(fill(COPY.index.leadTemplate, { brandName: site.brandName }))}">
  <link rel="stylesheet" href="/packages/tokens/${site.slug}.css">
  <style>${baseCss}${TECH_CSS}  </style>
</head>
<body>
${header}
  <section class="hero">
    <div class="container">
      <h1>${esc(COPY.index.title)}</h1>
      <p>${esc(fill(COPY.index.leadTemplate, { brandName: site.brandName }))}</p>
    </div>
  </section>
  <section class="section tech-main">
    <div class="container tech-body">
      <ul class="tech-index-list">
            ${items}
      </ul>
    </div>
  </section>
  <footer><div class="container">${esc(site.brandName)} · ${esc(S.footerSuffix)}</div></footer>
</body>
</html>
`;
}

// ── 站点（从 brand-registry.json 取，不硬编码品牌信息）─────────────────────
const registry = JSON.parse(readFileSync(join(ROOT, 'brand-registry.json'), 'utf8'));
// 只对**静态品牌站**生成：Next 应用（如 public-portal）的页面由应用路由渲染，
// 往其 public/ 塞静态 HTML 会绕过应用外壳与导航，属于制造第二套面。
const isNextApp = (app) => ['next.config.js', 'next.config.mjs', 'next.config.ts']
  .some((f) => existsSync(join(ROOT, app, f)));

const SITES = (registry.brands || [])
  .filter((b) => b.type === 'brand-site')
  .filter((b) => !isNextApp(b.app))
  .filter((b) => !wantSite || b.slug === wantSite)
  .map((b) => ({
    slug: b.slug,
    app: b.app,
    brandName: `${b.name_cn || b.slug}${b.name_en ? ` ${b.name_en}` : ''}`,
    logoText: (b.name_en || b.name_cn || b.slug).split(' ')[0],
  }));

/** 剥离 geo:build 注入块后比较——GEO 层由另一条管线负责，不属本生成器的同源范围。 */
const stripGeo = (html) => html.replace(/[ \t]*<!-- GEO:START -->[\s\S]*?<!-- GEO:END -->\r?\n?/g, '');
const norm = (html) => stripGeo(html).replace(/\r\n/g, '\n').trim();

let written = 0;
const drift = [];
for (const site of SITES) {
  const pubDir = join(ROOT, site.app, 'public');
  if (!existsSync(pubDir)) { console.log(`skip ${site.slug}: 无 public 目录`); continue; }
  const list = pages();
  const targets = [
    ...list.map((page) => ({ file: join(pubDir, 'tech', page.slug, 'index.html'), html: render(site, page), label: `${site.slug}/tech/${page.slug}` })),
    { file: join(pubDir, 'tech', 'index.html'), html: indexPage(site, list), label: `${site.slug}/tech (索引)` },
  ];
  for (const t of targets) {
    if (CHECK) {
      if (!existsSync(t.file)) drift.push(`${t.label}: 页面缺失（未生成）`);
      else if (norm(readFileSync(t.file, 'utf8')) !== norm(t.html)) drift.push(`${t.label}: 与内核事实不同源（页面被手改或内核已变更）`);
      written++;
      continue;
    }
    if (DRY) { console.log(`[dry] ${t.file}`); written++; continue; }
    mkdirSync(dirname(t.file), { recursive: true });
    writeFileSync(t.file, t.html, 'utf8');
    written++;
  }
  if (!CHECK) console.log(`tech-content: [${site.slug}] ${list.length} 页 + 索引页`);
}

if (CHECK) {
  console.log(`Tech Content Fact-Chain Check: 校验 ${written} 页, 漂移 ${drift.length}`);
  for (const d of drift) console.error(`- ${d}`);
  if (drift.length) {
    console.error('  修复：node scripts/geo/gen-tech-content-pages.mjs && npm run geo:build');
    process.exit(1);
  }
} else {
  console.log(`${DRY ? '[dry] ' : ''}共 ${written} 个文件。下一步：npm run geo:build && npm run guard:geo`);
}
