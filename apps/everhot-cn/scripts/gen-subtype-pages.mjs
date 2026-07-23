#!/usr/bin/env node
/**
 * 子类型 SEO 落地页生成器（数据驱动模板）。
 * 用途：从 CONFIG 批量生成商用子类型独立页，套用与住宅子类型页一致的模板
 *       （page-hero + 选购理由卡 + data-catalog 网格 + CTA + footer + GEO/JSON-LD）。
 * 运行：node scripts/gen-subtype-pages.mjs            （生成全部）
 *       node scripts/gen-subtype-pages.mjs --dry      （仅打印将写入的文件，不落盘）
 *
 * 说明：仅生成 CONFIG 中列出的页面（当前=商用核心设备子类型）。住宅 10 页为
 *       历史手写页，不在此生成范围内，避免覆盖其定制文案。
 * 后台化衔接：CONFIG 未来可由 product-catalog / landing-page 内容模型提供。
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.everhot.com.cn';

/** 每页配置：
 *  path      站点相对路径（= 目录）
 *  cat/sys   data-catalog 前两段（commercial:heating-cooling）
 *  series    data-catalog 第三段（按 series 过滤）
 *  crumbCat  面包屑上级名 + 上级页路径
 *  eyebrowEn 眼眉英文尾（大写）
 *  title/desc SEO 标题与描述
 *  h1        主标（可含 <br>）
 *  lead      hero 段落
 *  reasons   3 张选购理由卡 [tag, tagClass, h4, p]
 */
const CONFIG = [
  // ── 商用采暖制冷 ──
  {
    path: 'products/commercial/heating-cooling/air-source-heat-pump',
    cat: 'commercial', sys: 'heating-cooling', series: '风冷热泵',
    parentPath: 'products/commercial/heating-cooling/', parentCn: '商用采暖制冷',
    eyebrowCn: '商用采暖制冷 · 风冷热泵', eyebrowEn: 'COMMERCIAL · AIR-SOURCE HEAT PUMP',
    title: '商用风冷热泵机组 | 一机多用·超低温强热 · 恒热 Everhot',
    desc: '恒热商用风冷热泵机组：制热制冷一体，超低温环境稳定强热，适配写字楼、酒店、产业园集中冷暖，模块化组合、按需扩容。',
    h1: '一机多用<br>超低温也强热', lead: '制热制冷一体，模块化组合按需扩容，超低温环境稳定输出，适配楼宇集中冷暖。',
    reasons: [
      ['高效', '', 'COP 高·全年省', '高能效比运行，过渡季与冬季均保持稳定能效，长期运行成本更低。'],
      ['强热', 'sel-tag-pro', '超低温稳定制热', '低至 -25℃ 仍可靠制热，北方与高寒项目也能稳定供暖。'],
      ['灵活', 'sel-tag-com', '模块化按需扩容', '多台模块并联，按楼宇负荷灵活组合，后期扩容不停机。'],
    ],
  },
  {
    path: 'products/commercial/heating-cooling/modular-chiller',
    cat: 'commercial', sys: 'heating-cooling', series: '模块机组',
    parentPath: 'products/commercial/heating-cooling/', parentCn: '商用采暖制冷',
    eyebrowCn: '商用采暖制冷 · 模块机组', eyebrowEn: 'COMMERCIAL · MODULAR CHILLER',
    title: '商用中央空调（模块机组）| 灵活组合·冗余可靠 · 恒热 Everhot',
    desc: '恒热商用模块式冷（热）水机组：多模块并联、单机故障不停系统，分区分负荷灵活调度，适配大中型楼宇中央空调。',
    h1: '模块并联<br>灵活组合更可靠', lead: '多模块并联运行，单机检修不停系统，按分区负荷智能调度，中大型楼宇的稳妥之选。',
    reasons: [
      ['可靠', '', '单机故障不停系统', '模块冗余设计，单台检修或故障时其余模块继续供冷供热。'],
      ['灵活', 'sel-tag-pro', '按负荷智能调度', '依据实时负荷自动增减投入模块，部分负荷下更节能。'],
      ['省心', 'sel-tag-com', '占地小·安装便捷', '模块化机身便于运输吊装，机房占地更省、施工周期更短。'],
    ],
  },
  {
    path: 'products/commercial/heating-cooling/gas-boiler',
    cat: 'commercial', sys: 'heating-cooling', series: '商用采暖炉',
    parentPath: 'products/commercial/heating-cooling/', parentCn: '商用采暖制冷',
    eyebrowCn: '商用采暖制冷 · 商用采暖炉', eyebrowEn: 'COMMERCIAL · GAS BOILER',
    title: '商用燃气采暖炉 | 大热负荷·冷凝高效 · 恒热 Everhot',
    desc: '恒热商用燃气采暖炉：大热负荷冷凝冷凝技术，热效率高、排放低，适配楼宇集中供暖与工艺热水，多台级联扩展。',
    h1: '大热负荷<br>冷凝高效低排', lead: '冷凝换热高效率，大热负荷稳定输出，多台级联灵活扩展，楼宇集中供暖的可靠热源。',
    reasons: [
      ['高效', '', '冷凝换热·省燃气', '深度回收烟气潜热，热效率显著高于常规炉型，运行更省。'],
      ['大功率', 'sel-tag-pro', '级联扩展大负荷', '多台机组级联组网，覆盖楼宇集中供暖与大流量工艺热水。'],
      ['低排', 'sel-tag-com', '低氮燃烧更环保', '低氮燃烧设计，满足城市环保排放要求，通过项目验收更省心。'],
    ],
  },
  {
    path: 'products/commercial/heating-cooling/fresh-air',
    cat: 'commercial', sys: 'heating-cooling', series: '商用新风',
    parentPath: 'products/commercial/heating-cooling/', parentCn: '商用采暖制冷',
    eyebrowCn: '商用采暖制冷 · 商用新风', eyebrowEn: 'COMMERCIAL · FRESH AIR',
    title: '商用新风机组 | 全热回收·洁净健康 · 恒热 Everhot',
    desc: '恒热商用新风机组：全热回收降低能耗，高效过滤保障洁净空气，适配办公、酒店、学校等人员密集场所的健康通风。',
    h1: '全热回收<br>洁净健康新风', lead: '全热交换回收能量，高效过滤持续送洁净空气，人员密集场所的健康通风方案。',
    reasons: [
      ['节能', '', '全热回收降能耗', '回收排风中的冷热量预处理新风，显著降低新风负荷与能耗。'],
      ['洁净', 'sel-tag-pro', '多级高效过滤', '多级过滤拦截颗粒物与污染物，室内空气品质持续达标。'],
      ['舒适', 'sel-tag-com', '恒氧不失温', '持续引入富氧新风的同时不带来明显温度波动，体感更舒适。'],
    ],
  },
  // ── 商用热水 ──
  {
    path: 'products/commercial/water-heating/high-capacity',
    cat: 'commercial', sys: 'water-heating', series: '大功率商用',
    parentPath: 'products/commercial/water-heating/', parentCn: '商用热水',
    eyebrowCn: '商用热水 · 大功率燃气', eyebrowEn: 'COMMERCIAL · HIGH-CAPACITY',
    title: '大功率商用燃气热水炉 | 大流量·连续供热 · 恒热 Everhot',
    desc: '恒热大功率商用燃气热水炉：大流量连续制热，快速满足酒店、医院、澡堂等高峰用水，多机并联扩展、稳定不断热。',
    h1: '大流量<br>连续稳定供热', lead: '大功率快速制热，高峰不断热，多机并联按需扩展，高强度用水场所的可靠热源。',
    reasons: [
      ['大流量', '', '高峰连续供热', '大功率快速加热，满足酒店、医院、公共浴室等高峰集中用水。'],
      ['稳定', 'sel-tag-pro', '多机并联不断热', '多台并联互为补充，单机检修时系统持续供热不中断。'],
      ['高效', 'sel-tag-com', '冷凝节能·低排', '冷凝换热提升热效率，低氮燃烧满足环保要求，运行更省。'],
    ],
  },
  {
    path: 'products/commercial/water-heating/air-source',
    cat: 'commercial', sys: 'water-heating', series: '商用空气能',
    parentPath: 'products/commercial/water-heating/', parentCn: '商用热水',
    eyebrowCn: '商用热水 · 商用空气能', eyebrowEn: 'COMMERCIAL · AIR-SOURCE',
    title: '商用空气能热水机组 | 超低能耗·一机集中 · 恒热 Everhot',
    desc: '恒热商用空气能热水机组：热泵高效制热能耗仅为电热的三分之一，适配酒店、公寓、工厂集中热水，绿色低碳。',
    h1: '热泵制热<br>能耗仅三分之一', lead: '空气源热泵高效制热，能耗远低于电热与燃气，集中热水的绿色低碳之选。',
    reasons: [
      ['省能', '', '能耗约为电热 1/3', '一份电能搬运多份热量，运行成本大幅低于电热与燃气方案。'],
      ['集中', 'sel-tag-pro', '大水量集中供应', '模块组合满足酒店、公寓、工厂宿舍等大水量集中热水需求。'],
      ['低碳', 'sel-tag-com', '绿色减排达标', '无燃烧、零现场排放，助力项目碳排与能耗指标达标。'],
    ],
  },
  {
    path: 'products/commercial/water-heating/storage-tank',
    cat: 'commercial', sys: 'water-heating', series: '储热水箱',
    parentPath: 'products/commercial/water-heating/', parentCn: '商用热水',
    eyebrowCn: '商用热水 · 大容积储热', eyebrowEn: 'COMMERCIAL · STORAGE TANK',
    title: '大容积储热水箱 | 削峰填谷·保温持久 · 恒热 Everhot',
    desc: '恒热大容积商用储热水箱：削峰填谷平衡高峰用水，高效保温减少热损，搪瓷/不锈钢内胆耐久防腐，配套热源系统。',
    h1: '大容积储热<br>削峰填谷更从容', lead: '大容积蓄热平衡高峰用水，高效保温减少热损，耐久内胆长效防腐，热水系统的稳压之选。',
    reasons: [
      ['储热', '', '削峰填谷稳供水', '低谷蓄热、高峰放热，平抑用水波动，减少热源频繁启停。'],
      ['保温', 'sel-tag-pro', '高效保温减热损', '厚层保温设计，静置热损低，隔夜温降小、更省能。'],
      ['耐久', 'sel-tag-com', '内胆防腐长寿命', '搪瓷/不锈钢内胆耐腐蚀，配套牺牲阳极，使用寿命更长。'],
    ],
  },
  {
    path: 'products/commercial/water-heating/central-station',
    cat: 'commercial', sys: 'water-heating', series: '集中热水站',
    parentPath: 'products/commercial/water-heating/', parentCn: '商用热水',
    eyebrowCn: '商用热水 · 楼宇集中热水站', eyebrowEn: 'COMMERCIAL · CENTRAL STATION',
    title: '楼宇集中热水站 | 整站集成·智能调度 · 恒热 Everhot',
    desc: '恒热楼宇集中热水站：热源+储热+循环+智控整站集成，即开即热恒温恒压，适配酒店公寓与产业园，交付即用。',
    h1: '整站集成<br>即开即热恒温压', lead: '热源、储热、循环与智控整站集成，即开即热、恒温恒压，楼宇集中热水的一站式方案。',
    reasons: [
      ['集成', '', '整站交付即用', '热源+储热+循环+控制系统集成设计，现场安装快、交付即运行。'],
      ['体验', 'sel-tag-pro', '即开即热恒温压', '全程循环+稳压设计，各末端即开即热，水温水压稳定一致。'],
      ['智控', 'sel-tag-com', '远程监测调度', '智能控制平台远程监测与调度，异常预警、运维更省心。'],
    ],
  },
];

const j = (o) => JSON.stringify(o);

function page(c) {
  const url = `${SITE}/${c.path}/`;
  const parentUrl = `${SITE}/${c.parentPath}`;
  const eyebrow = `${c.eyebrowCn} · ${c.eyebrowEn}`;
  const ld1 = j({ '@context': 'https://schema.org', '@type': 'WebPage', name: c.title, url, inLanguage: 'zh-CN', description: c.desc, isPartOf: { '@type': 'WebSite', name: 'Everhot 中国 Everhot China', url: SITE } });
  const ld2 = j({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: c.parentCn, item: parentUrl },
    { '@type': 'ListItem', position: 3, name: c.title.split(' | ')[0], item: url },
  ] });
  const reasonCards = c.reasons.map(([tag, cls, h4, p]) =>
    `    <div class="sel-card"><div class="sel-tag${cls ? ' ' + cls : ''}">${tag}</div><h4>${h4}</h4><p>${p}</p></div>`
  ).join('\n');
  return `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#BF1924">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${c.title}</title>
<meta name="description" content="${c.desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Mulish:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/css/everhot.css">
<!-- GEO:START -->
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Everhot 中国 Everhot China">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="${c.title}">
<meta property="og:description" content="${c.desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/img/hero-poster-desktop.webp">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${c.title}">
<meta name="twitter:description" content="${c.desc}">
<meta name="twitter:image" content="${SITE}/assets/img/hero-poster-desktop.webp">
<script type="application/ld+json">${ld1}</script>
<script type="application/ld+json">${ld2}</script>
<!-- GEO:END -->
</head><body>
<div id="evNavMount"></div>
<section class="page-hero page-hero-red"><div class="container"><div class="eyebrow">${eyebrow}</div><h1>${c.h1}</h1><p>${c.lead}</p></div></section>
<div class="breadcrumb-bar"><div class="container"><a href="/">首页</a> / <a href="/${c.parentPath}">${c.parentCn}</a> / ${c.title.split(' | ')[0]}</div></div>

<section class="section"><div class="container">
  <div class="section-head"><div class="eyebrow">为什么选 · WHY</div><h2>工程级${c.parentCn}子系统</h2></div>
  <div class="selector-grid">
${reasonCards}
  </div>
</div></section>

<section class="section section-alt"><div class="container">
  <div class="section-head"><div class="eyebrow">产品系列 · PRODUCT SERIES</div><h2>恒热${c.title.split(' | ')[0]}机型</h2></div>
  <div class="product-grid" data-catalog="${c.cat}:${c.sys}:${c.series}"></div>
  <div style="text-align:center;margin-top:24px"><a href="/${c.parentPath}" class="btn btn-outline btn-lg">查看全部${c.parentCn}产品 →</a></div>
</div></section>

<section class="section-cta"><div class="container">
  <h2>需要为您的项目选型？</h2><p>恒热工程团队提供负荷核算、方案设计与选型报价</p>
  <div class="cta-actions"><a href="/products/selector/" class="btn btn-light btn-lg">开始智能选型</a><a href="/find-a-pro/" class="btn btn-outline-light btn-lg">联系工程团队</a></div>
</div></section>

<footer class="footer"><div class="container footer-grid">
  <div class="footer-brand"><div class="logo"><span class="logo-en">EVERHOT</span><span class="logo-cn">恒热</span></div><p>百年恒续 · 为爱恒热<br>瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营</p><p class="footer-slogan">EVERHOT FOR EVERLOVE</p></div>
  <div class="footer-col"><strong>商用产品 <span>Commercial</span></strong><a href="/products/commercial/heating-cooling/">商用采暖制冷</a><a href="/products/commercial/water-heating/">商用热水</a><a href="/professionals/commercial/resources/">BIM/CAD 资料库</a><a href="/professionals/commercial/documentation/">技术文档</a></div>
  <div class="footer-col"><strong>支持服务 <span>Support</span></strong><a href="/support/">支持中心</a><a href="/warranty/">保修服务</a><a href="/faqs/">常见问题</a><a href="/contact/">联系我们</a></div>
  <div class="footer-col"><strong>集团品牌 <span>Our Brands</span></strong><a href="/">恒热 Everhot</a><a href="https://www.rheem.com.cn">Rheem 瑞美</a><a href="https://www.ruud.com.cn">Ruud 瑞德</a><a href="https://rhautt.com">瑞合瑞德集团</a></div>
</div><div class="footer-bottom"><div class="container footer-bottom-inner">
  <span>&copy; 2026 Everhot 恒热 · 瑞合瑞德暖通科技集团 · Everhot 为注册商标</span>
  <nav class="footer-legal" aria-label="法律与合规"><a href="/privacy/">隐私政策</a><a href="/privacy/#cookie">Cookie 说明</a><a href="/privacy/#terms">法律声明</a><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">沪ICP备XXXXXXXX号</a></nav>
</div></div></footer>
<script src="/js/nav.js" defer></script>
<script src="/js/products-data.js" defer></script>
<script src="/js/product-images.js" defer></script>
<script src="/js/product-art.js" defer></script>
<script src="/js/catalog.js" defer></script>
</body></html>
`;
}

const dry = process.argv.includes('--dry');
let n = 0;
for (const c of CONFIG) {
  const dir = join(ROOT, 'public', c.path);
  const file = join(dir, 'index.html');
  if (dry) { console.log('[dry]', c.path, '→ data-catalog=' + `${c.cat}:${c.sys}:${c.series}`); continue; }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, page(c), 'utf8');
  console.log('✓', c.path + '/index.html');
  n++;
}
if (!dry) console.log(`\n生成 ${n} 个商用子类型页。`);
