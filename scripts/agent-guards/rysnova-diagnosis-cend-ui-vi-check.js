#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TARGET = 'archive/legacy-ui/public/pain-diagnosis.html';
const REPORT_JSON = 'audit/rysnova-diagnosis-cend-ui-vi-report.json';
const REPORT_MD = 'audit/rysnova-diagnosis-cend-ui-vi-report.md';

const reportOnly = process.argv.includes('--report');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function stripSource(source) {
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function textOnly(source) {
  return stripSource(source)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTagText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? textOnly(match[1]) : '';
}

function classBlock(html, className) {
  const match = html.match(new RegExp(`<([a-z0-9-]+)\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][\\s\\S]*?<\\/\\1>`, 'i'));
  return match ? match[0] : '';
}

function idBlock(html, id) {
  const match = html.match(new RegExp(`<([a-z0-9-]+)\\b[^>]*id=["']${id}["'][\\s\\S]*?<\\/\\1>`, 'i'));
  return match ? match[0] : '';
}

function between(html, startNeedle, endNeedle) {
  const start = html.indexOf(startNeedle);
  if (start === -1) return '';
  const end = html.indexOf(endNeedle, start + startNeedle.length);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

const checks = [];

function check(id, severity, passed, message, evidence = '') {
  checks.push({
    id,
    severity,
    status: passed ? 'pass' : 'fail',
    message,
    evidence
  });
}

function includesAny(source, tokens) {
  return tokens.some(token => source.includes(token));
}

function main() {
  if (!exists(TARGET)) {
    check('target-exists', 'blocker', false, `${TARGET} is missing`);
    finish();
    return;
  }

  const html = read(TARGET);
  const visibleText = textOnly(html);
  const h1 = firstTagText(html, 'h1');
  const bodyTag = html.match(/<body\b[^>]*>/i)?.[0] || '';
  const topbar = classBlock(html, 'diag-topbar');
  const topbarText = textOnly(topbar);
  const hero = between(html, '<div class="header"', '<div class="step-indicator"');
  const heroText = textOnly(hero || classBlock(html, 'header'));
  const nav = classBlock(html, 'diag-nav');
  const step1Text = textOnly(idBlock(html, 'step1'));
  const step2Text = textOnly(idBlock(html, 'step2'));
  const step3Text = textOnly(idBlock(html, 'step3'));
  const step4Text = textOnly(idBlock(html, 'step4'));
  const resultText = `${step3Text} ${step4Text}`;
  const painTagCount = (html.match(/\bdata-id=["']tag_/g) || []).length;

  check(
    'brand-name-no-rysnova',
    'blocker',
    !/\bRenova\b/.test(visibleText),
    '瑞诺瓦 C-end surface must not invent or expose the unauthorized English name "Rysnova".'
  );

  check(
    'brand-namespace-no-rysnova-source',
    'blocker',
    !/\brenova\b|Rysnova/.test(html),
    '瑞诺瓦 C-end page source, DOM, CSS variables, storage keys, and metadata must not use the unauthorized "rysnova" namespace.',
    (html.match(/.{0,40}\b(?:rysnova|Rysnova)\b.{0,40}/)?.[0] || '').trim()
  );

  check(
    'rhautt-comfort-weak-backing',
    'blocker',
    visibleText.includes('Powered by Rhautt Comfort'),
    'Rhautt Comfort must appear only as weak powered-by backing.',
    'Expected visible token: Powered by Rhautt Comfort'
  );

  check(
    'nexus-not-in-cend-visual',
    'blocker',
    !/瑞诺瓦AI舒适家|瑞诺瓦AI舒适家/.test(visibleText),
    '瑞诺瓦AI舒适家 is the software platform name and must not enter the 瑞诺瓦 C-end main visual.'
  );

  check(
    'comfort-not-software-product-name',
    'blocker',
    !/Rhautt Comfort\s*(软件|平台|主干|系统)/i.test(visibleText),
    'Rhautt Comfort must not be presented as the 瑞诺瓦 product or software name.'
  );

  check(
    'hero-cend-title',
    'blocker',
    /给家做一次舒适系统体检|家庭舒适系统体检|舒适系统体检/.test(`${h1} ${heroText}`),
    'Hero must lead with a C-end home comfort checkup proposition, not an AI tool title.',
    `Current h1: ${h1 || '(missing)'}`
  );

  check(
    'hero-not-ai-tool-title',
    'blocker',
    h1 !== '瑞诺瓦 AI 问诊',
    'Hero h1 must not be the bare product/tool label "瑞诺瓦 AI 问诊".',
    `Current h1: ${h1 || '(missing)'}`
  );

  check(
    'hero-not-internal-operator-copy',
    'blocker',
    !/(销售顾问|经销商团队|标准化需求采集|系统包匹配|设备配置|IoT 生命周期交接)/.test(heroText),
    'Hero copy must not read like a sales/designer/dealer internal operating workflow.',
    heroText.slice(0, 220)
  );

  check(
    'topnav-cend-only',
    'blocker',
    !/designer\.html|rysnova-bim-designer\.html|业务控制台|员工后台|BIM/.test(nav),
    'C-end top navigation must not directly expose designer workbench, Rysnova BIM, business console, or employee backend.',
    topbarText
  );

  check(
    'consumer-shell-not-workbench',
    'blocker',
    !/\brc-workbench\b/.test(bodyTag),
    '瑞诺瓦问诊 must use an independent consumer module shell, not the workbench shell class.',
    bodyTag
  );

  check(
    'primary-cta-start',
    'blocker',
    visibleText.includes('开始问诊'),
    'First screen must provide a clear C-end primary CTA: 开始问诊.'
  );

  check(
    'secondary-cta-example',
    'blocker',
    visibleText.includes('查看方案示例'),
    'First screen must provide a low-friction secondary CTA: 查看方案示例.'
  );

  check(
    'consultative-step-language',
    'blocker',
    ['先了解你的家', '说说哪里不舒服', '选择你想改善的系统', '确认预算和偏好', '查看初步方案']
      .every(token => visibleText.includes(token)),
    'Questionnaire steps must use consultative C-end language instead of internal file/quote workflow language.'
  );

  check(
    'pain-granularity-progressive',
    'blocker',
    painTagCount <= 24 || /继续补充细节|更多问题|展开更多/.test(visibleText),
    'Pain questions must be progressive; a large static wall of tags is not acceptable for C-end users.',
    `Current tag count: ${painTagCount}`
  );

  check(
    'equipment-brands-not-pain-tags',
    'blocker',
    !/(温度体感需求|热水用水需求|湿度\/空气需求|水质健康需求)[\s\S]{0,120}(Rheem|Ruud|RUUD)/.test(stripSource(html)),
    'Rheem/Ruud/Everhot should appear in scheme/product configuration, not as pain-question brand badges.'
  );

  check(
    'three-tier-schemes',
    'blocker',
    includesAny(visibleText, ['基础舒适方案', '基础方案']) &&
      includesAny(visibleText, ['均衡推荐方案', '舒适方案']) &&
      includesAny(visibleText, ['高阶全生命周期方案', '尊享方案']),
    'Result must preserve three-tier scheme comparison.'
  );

  check(
    'budget-monthly-roi',
    'blocker',
    /月供|分期/.test(resultText) && /ROI|长期价值|年节能|节能预估/.test(resultText),
    'Result must preserve budget/monthly payment/ROI or long-term value expression.'
  );

  check(
    'visual-package-three-images',
    'blocker',
    ['visualPackages', 'principleDiagram', 'layout2d', 'scene3d'].every(token => html.includes(token)) ||
      ['设计原理图', '2D 布局图', '3D 示意图'].every(token => visibleText.includes(token)),
    'Result/report flow must preserve design principle diagram, 2D layout, and 3D scene outputs.'
  );

  check(
    'public-diagnosis-api-retained',
    'blocker',
    html.includes('/api/v2/diagnosis/public/complete'),
    'UI refactor must keep the v2 public diagnosis completion API.'
  );

  check(
    'recommendation-api-retained',
    'blocker',
    html.includes('/api/ai-consultant/recommend'),
    'UI refactor must keep the recommendation API or an approved replacement contract.'
  );

  check(
    'report-actions-cend',
    'blocker',
    ['预约设计师深化方案', '保存并生成客户报告', '分享给家人'].every(token => resultText.includes(token)),
    'Result page CTAs must be C-end report actions: appointment, save report, share with family.'
  );

  check(
    'step1-cend-data-language',
    'blocker',
    /(城市|装修阶段|常住人数)/.test(step1Text) && !/档案录入/.test(step1Text),
    'Step 1 must collect home context in C-end language, not internal dossier-entry language.',
    step1Text.slice(0, 180)
  );

  check(
    'step2-cend-pain-language',
    'blocker',
    /(哪里不舒服|热水等待|水温不稳|房间冷|空气闷|有异味|水垢|智能控制)/.test(step2Text) && !/风险问诊/.test(step2Text),
    'Step 2 must start from household comfort problems, not professional risk-questionnaire wording.',
    step2Text.slice(0, 180)
  );

  check(
    'confirmation-doc-present',
    'advisory',
    exists('docs/_archive/RYSNOVA-AI-DIAGNOSIS-C-END-UI-VI-ARCHITECTURE.md') &&
      [
        '当前页面错因复盘',
        '独立上线',
        'Powered by Rhautt Comfort',
        'moduleNamespace',
        'dataNamespace',
        '不改 `archive/legacy-ui/public/pain-diagnosis.html`'
      ].every(token => read('docs/_archive/RYSNOVA-AI-DIAGNOSIS-C-END-UI-VI-ARCHITECTURE.md').includes(token)),
    'The C-end UI/VI confirmation document must remain as the implementation contract.'
  );

  finish();
}

function finish() {
  const failures = checks.filter(item => item.status === 'fail' && item.severity === 'blocker');
  const advisories = checks.filter(item => item.status === 'fail' && item.severity !== 'blocker');
  const report = {
    target: TARGET,
    generatedAt: new Date().toISOString(),
    pass: failures.length === 0,
    summary: {
      total: checks.length,
      passed: checks.filter(item => item.status === 'pass').length,
      blockerFailures: failures.length,
      advisoryFailures: advisories.length
    },
    checks
  };

  if (reportOnly) {
    const jsonPath = path.join(ROOT, REPORT_JSON);
    const mdPath = path.join(ROOT, REPORT_MD);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(mdPath, renderMarkdown(report));
  }

  console.log(
    `瑞诺瓦 C-end Diagnosis UI/VI Check: checks = ${report.summary.total}, ` +
    `blocker failures = ${report.summary.blockerFailures}, reportOnly = ${reportOnly}`
  );

  if (failures.length) {
    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.message}${failure.evidence ? ` (${failure.evidence})` : ''}`);
    }
    if (!reportOnly) process.exit(1);
  }

  for (const advisory of advisories) {
    console.warn(`- ${advisory.id}: ${advisory.message}`);
  }
}

function renderMarkdown(report) {
  const lines = [
    '# 瑞诺瓦 AI 问诊 C 端 UI/VI 审计报告',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Target: \`${report.target}\``,
    '',
    `Pass: ${report.pass ? 'yes' : 'no'}`,
    '',
    `Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.blockerFailures} blocker failures.`,
    '',
    '## Blocker Failures',
    ''
  ];

  const blockers = report.checks.filter(item => item.status === 'fail' && item.severity === 'blocker');
  if (!blockers.length) {
    lines.push('- None');
  } else {
    for (const item of blockers) {
      lines.push(`- \`${item.id}\`: ${item.message}`);
      if (item.evidence) lines.push(`  Evidence: ${item.evidence.replace(/\n/g, ' ')}`);
    }
  }

  lines.push('', '## Passed Checks', '');
  for (const item of report.checks.filter(check => check.status === 'pass')) {
    lines.push(`- \`${item.id}\``);
  }

  return `${lines.join('\n')}\n`;
}

main();
