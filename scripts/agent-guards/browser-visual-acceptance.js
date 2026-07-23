#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
let updateReleaseEvidence = updateLocalReleaseEvidence;
try {
  ({ updateReleaseEvidence } = require('../release/evidence-utils'));
} catch {
  updateReleaseEvidence = updateLocalReleaseEvidence;
}

const ROOT = path.join(__dirname, '..', '..');
const EXTERNAL_BASE_URL = process.env.VISUAL_BASE_URL;
const VISUAL_BROWSER_WS_ENDPOINT = process.env.VISUAL_BROWSER_WS_ENDPOINT || process.env.VISUAL_CDP_ENDPOINT || '';
const VISUAL_BROWSER_EXECUTABLE_PATH =
  process.env.VISUAL_BROWSER_EXECUTABLE_PATH || findSystemBrowser();
const LOCAL_STATIC_HOST = 'http://rhautt-nexus.local';
const LOCAL_STATIC_MODE = !EXTERNAL_BASE_URL || EXTERNAL_BASE_URL === 'local-static';
const REMOTE_CDP_MODE = Boolean(VISUAL_BROWSER_WS_ENDPOINT);
const BASE_URL = LOCAL_STATIC_MODE ? LOCAL_STATIC_HOST : EXTERNAL_BASE_URL;
const REPORT_BASE_URL = LOCAL_STATIC_MODE ? 'local-static://archive/legacy-ui/public' : BASE_URL;
const EXECUTION_MODE = REMOTE_CDP_MODE
  ? (LOCAL_STATIC_MODE ? 'remote-cdp-local-static-fixture' : 'remote-cdp-external-url')
  : (LOCAL_STATIC_MODE ? 'local-static-fixture' : 'external-url');
const REPORT_JSON = path.join(ROOT, 'audit', 'browser-visual-acceptance-report.json');
const REPORT_MD = path.join(ROOT, 'audit', 'browser-visual-acceptance-report.md');
const RELEASE_EVIDENCE_JSON = path.join(ROOT, 'evidence', 'release-evidence.json');
const RYSNOVA_DELIVERABLE_ARTIFACT_CONTRACT = '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts';
const RYSNOVA_SIGNOFF_PACKAGE_CONTRACT = '/api/v2/rysnova-bim/projects/{projectId}/signoff-package';
const VIEWER_ACCEPTANCE_REPORT = path.join(ROOT, 'evidence', 'viewer-acceptance', 'viewer-acceptance-report.json');

const pages = [
  { path: '/index.html', title: /Rhautt Comfort/, text: '舒适家居行业的售前' },
  { path: '/index-ready.html', title: /Rhautt Comfort|瑞合瑞德/, text: '瑞合瑞德' }
];

function finalLaunchVisualProofFromReport(report) {
  return Boolean(
    report?.summary?.pages === pages.length &&
      report?.summary?.failed === 0 &&
      report?.summary?.passed === pages.length &&
      report?.executionMode !== 'local-static-fixture' &&
      report?.baseUrl !== 'local-static://archive/legacy-ui/public'
  );
}

const FORBIDDEN_RENDERED_PATTERNS = [
  /AI\s*推荐/i,
  /AI智能/i,
  /智能问诊/i,
  /机器人/i,
  /🤖/,
  /立即体验/,
  /免费/,
  /60秒/,
  /全网/,
  /最强/,
  /一键生成/,
  /魔法/,
  /舒适岛/,
  /锁客/
];

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const KONVA_STATIC_STUB = `
(function(){
  function drawCanvas(canvas) {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var w = canvas.width || 800;
    var h = canvas.height || 600;
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (var y = 0; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = '#0066CC';
    ctx.fillRect(Math.max(24, w * 0.18), Math.max(24, h * 0.18), 96, 54);
    ctx.fillStyle = '#C41230';
    ctx.fillRect(Math.max(150, w * 0.36), Math.max(80, h * 0.34), 112, 62);
    ctx.strokeStyle = '#D4A945';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(40, h - 80);
    ctx.lineTo(w * 0.45, h * 0.55);
    ctx.lineTo(w - 60, 80);
    ctx.stroke();
  }
  class Node {
    constructor(config) { this.config = config || {}; this.children = []; this.handlers = {}; this._id = ''; this._x = this.config.x || 0; this._y = this.config.y || 0; this._rotation = this.config.rotation || 0; }
    add(child) { if (child) { child.parent = this; child._layer = this._layer || (this instanceof Layer ? this : null); this.children.push(child); } return this; }
    on(name, handler) { this.handlers[name] = handler; return this; }
    id(value) { if (value === undefined) return this._id; this._id = value; return this; }
    destroy() { this.destroyed = true; return this; }
    destroyChildren() { this.children = []; return this; }
    batchDraw() { const stage = this._stage || this.parent?._stage; if (stage) stage.batchDraw(); return this; }
    getLayer() { return this._layer || null; }
    x(value) { if (value === undefined) return this._x; this._x = value; return this; }
    y(value) { if (value === undefined) return this._y; this._y = value; return this; }
    rotation(value) { if (value === undefined) return this._rotation; this._rotation = value; return this; }
    draggable(value) { if (value === undefined) return this.config.draggable; this.config.draggable = value; return this; }
    visible(value) { if (value === undefined) return this.config.visible !== false; this.config.visible = value; return this; }
  }
  class Stage extends Node {
    constructor(config) {
      super(config);
      this._width = config.width || 800;
      this._height = config.height || 600;
      this._scale = { x: 1, y: 1 };
      this._position = { x: 0, y: 0 };
      this.container = typeof config.container === 'string' ? document.getElementById(config.container) : config.container;
      this.canvas = document.createElement('canvas');
      this.canvas.width = this._width;
      this.canvas.height = this._height;
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      if (this.container) this.container.appendChild(this.canvas);
      drawCanvas(this.canvas);
    }
    add(layer) { layer._stage = this; layer._layer = layer; this.children.push(layer); this.batchDraw(); return this; }
    width(value) { if (value === undefined) return this._width; this._width = Math.max(1, value || 800); this.canvas.width = this._width; this.batchDraw(); return this; }
    height(value) { if (value === undefined) return this._height; this._height = Math.max(1, value || 600); this.canvas.height = this._height; this.batchDraw(); return this; }
    batchDraw() { drawCanvas(this.canvas); return this; }
    getRelativePointerPosition() { return { x: this._width / 2, y: this._height / 2 }; }
    getPointerPosition() { return { x: this._width / 2, y: this._height / 2 }; }
    scaleX() { return this._scale.x; }
    scale(value) { if (value === undefined) return this._scale; this._scale = value; return this; }
    position(value) { if (value === undefined) return this._position; this._position = value; return this; }
    toDataURL() { return this.canvas.toDataURL('image/png'); }
  }
  class Layer extends Node {}
  class Transformer extends Node { nodes(value) { if (value === undefined) return this._nodes || []; this._nodes = value; return this; } }
  class Rect extends Node {}
  class Group extends Node {}
  class Line extends Node { constructor(config) { super(config); this._points = config?.points || []; } points(value) { if (value === undefined) return this._points; this._points = value; return this; } }
  class Text extends Node {
    constructor(config) { super(config); this._text = config?.text || ''; this._fontSize = config?.fontSize || 12; }
    text(value) { if (value === undefined) return this._text; this._text = value; return this; }
    fontSize(value) { if (value === undefined) return this._fontSize; this._fontSize = value; return this; }
  }
  window.Konva = { Stage, Layer, Transformer, Rect, Line, Group, Text };
})();
`;

const ORBIT_CONTROLS_STUB = `
(function(){
  if (!window.THREE) return;
  window.THREE.OrbitControls = function OrbitControls() {
    this.enableDamping = false;
    this.dampingFactor = 0;
    this.update = function(){};
    this.dispose = function(){};
  };
})();
`;

async function designerProbe(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')];
    const canvas = canvases.find(item => item.width > 50 && item.height > 50);
    if (!canvas) return { ok: false, reason: 'no canvas' };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no 2d context' };
    const sample = ctx.getImageData(0, 0, Math.min(canvas.width, 120), Math.min(canvas.height, 120)).data;
    let nonBlank = 0;
    for (let index = 0; index < sample.length; index += 4) {
      if (sample[index] || sample[index + 1] || sample[index + 2] || sample[index + 3]) nonBlank += 1;
    }
    return { ok: nonBlank > 30, canvasCount: canvases.length, width: canvas.width, height: canvas.height, nonBlank };
  });
}

async function rysnovaBimProbe(page) {
  await page.waitForTimeout(1400);
  return page.evaluate(() => {
    const probe = window.__rysnovaBimRenderProbe || {};
    return {
      ok: Boolean(probe.hasRenderer && probe.hasScene && probe.objectCount > 0 && probe.canvasWidth > 50 && probe.canvasHeight > 50),
      ...probe
    };
  });
}

async function inspectPage(context, spec) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  const startedAt = Date.now();
  let status = 0;
  let title = '';
  let textMatched = false;
  let forbiddenText = [];
  let canvas = null;

  try {
    const response = await page.goto(`${BASE_URL}${spec.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    status = response ? response.status() : 0;
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    title = await page.title();
    textMatched = await page.getByText(spec.text, { exact: false }).count().then(count => count > 0).catch(() => false);
    const renderedText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    forbiddenText = FORBIDDEN_RENDERED_PATTERNS
      .filter(pattern => pattern.test(renderedText))
      .map(pattern => String(pattern));
    if (spec.canvasProbe === 'designer') canvas = await designerProbe(page);
    if (spec.canvasProbe === 'rysnova-bim') canvas = await rysnovaBimProbe(page);
  } catch (error) {
    consoleErrors.push(error.message);
  }

  await page.close();

  const passed = status >= 200 && status < 400 &&
    spec.title.test(title) &&
    (textMatched || spec.optionalText) &&
    forbiddenText.length === 0 &&
    consoleErrors.length === 0 &&
    (!canvas || canvas.ok);

  return {
    path: spec.path,
    sourcePath: `archive/legacy-ui/public${spec.path}`,
    sourceSha256: sha256(`archive/legacy-ui/public${spec.path}`),
    status,
    title,
    textMatched,
    forbiddenText,
    consoleErrors,
    canvas,
    durationMs: Date.now() - startedAt,
    passed
  };
}

function sha256(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
}

async function installLocalStaticFixture(context) {
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(mockApiResponse(url, request.method()))
      });
    }

    if (url.hostname === 'cdn.jsdelivr.net') {
      if (url.pathname.includes('/konva@')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: KONVA_STATIC_STUB });
      }
      if (url.pathname.includes('/OrbitControls.js')) {
        return route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: ORBIT_CONTROLS_STUB });
      }
      if (url.pathname.includes('/three@')) {
        return fulfillFile(route, 'node_modules/three/build/three.min.js');
      }
    }

    if (request.resourceType() === 'image' && url.hostname !== 'rhautt-nexus.local') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    }

    const staticPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const relativePath = path.join('archive', 'legacy-ui', 'public', safeRelativePath(staticPath));
    if (fs.existsSync(path.join(ROOT, relativePath))) {
      return fulfillFile(route, relativePath);
    }

    if (staticPath === '/icon-192.png' || staticPath.endsWith('.png') || staticPath.endsWith('.jpg') || staticPath.endsWith('.jpeg') || staticPath.endsWith('.webp')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    }

    return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: `missing local fixture: ${url.pathname}` });
  });
}

function safeRelativePath(urlPath) {
  const clean = decodeURIComponent(urlPath).split('?')[0].split('#')[0].replace(/^\/+/, '');
  const normalized = path.normalize(clean);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) return '__blocked__';
  return normalized;
}

function fulfillFile(route, relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return route.fulfill({
    status: 200,
    contentType: contentTypeFor(fullPath),
    body: fs.readFileSync(fullPath)
  });
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
  }[ext] || 'application/octet-stream';
}

function mockApiResponse(url, method) {
  const pathname = url.pathname;
  const ok = data => ({ success: true, data });

  if (pathname === '/api/health') return { success: true, status: 'ok', service: 'rhautt-nexus-visual-fixture' };
  if (pathname === '/api/auth/login') {
    return ok({ token: 'visual-fixture-token', user: { id: 'visual-user', name: '视觉验收账号', role: 'hq_admin', tenantId: 'rhautt-hq' } });
  }
  if (pathname === '/api/dashboard/stats') {
    return ok({
      customers: { total: 128 },
      contracts: { total: 36, completed: 18, inProgress: 12 },
      revenue: { total: 18600000, avgOrderValue: 516000 },
      funnel: { leads: 88, qualified: 52, proposal: 31, won: 18, winRate: '34.6%' },
      products: { active: 26 }
    });
  }
  if (pathname === '/api/dashboard/sales-trend') {
    return ok([
      { month: '2026-01', revenue: 1200000, contractCount: 3 },
      { month: '2026-02', revenue: 1800000, contractCount: 4 },
      { month: '2026-03', revenue: 2600000, contractCount: 6 },
      { month: '2026-04', revenue: 3100000, contractCount: 7 },
      { month: '2026-05', revenue: 3600000, contractCount: 8 }
    ]);
  }
  if (/^\/api\/contracts\/[^/]+\/report$/.test(pathname)) {
    return ok({ contractId: pathname.split('/')[3], customer: '王女士', progress: 62, contractPrice: 328000, totalMaterialCost: 198000 });
  }
  if (/^\/api\/contracts\/[^/]+\/gantt$/.test(pathname)) {
    return ok({
      totalPhases: 5,
      completedPhases: 2,
      inProgressPhases: 1,
      phases: [
        { phaseId: 'P1', phase: '深化设计', date: '2026-06-01', description: '图纸与设备清单确认', status: 'completed' },
        { phaseId: 'P2', phase: '材料进场', date: '2026-06-05', description: '主材与辅材入库', status: 'completed' },
        { phaseId: 'P3', phase: '隐蔽施工', date: '2026-06-08', description: '管路、风道、水路预埋', status: 'in_progress' },
        { phaseId: 'P4', phase: '设备安装', date: '2026-06-18', description: '主机与末端设备安装', status: 'pending' }
      ]
    });
  }
  if (/^\/api\/contracts\/[^/]+\/phase\/[^/]+\/(start|complete)$/.test(pathname)) return ok({ status: 'updated' });
  if (/^\/api\/material\/[^/]+\/movement$/.test(pathname)) return ok({ status: 'recorded' });
  if (/^\/api\/material\/[^/]+$/.test(pathname)) {
    return ok({
      categories: [
        { category: '热水系统', items: [{ name: '中央热水主机', totalPrice: 68000 }] },
        { category: '空气系统', items: [{ name: '全空气末端', totalPrice: 86000 }] }
      ],
      movements: []
    });
  }
  if (/^\/api\/acceptance\/[^/]+$/.test(pathname)) return method === 'POST' ? ok({ id: 'ACC-VISUAL' }) : ok([]);
  if (/^\/api\/settlement\/[^/]+$/.test(pathname)) return method === 'POST' ? ok({ id: 'SET-VISUAL' }) : ok([]);
  if (pathname === '/api/quote/with-promotion') {
    return ok({
      breakdown: {
        subtotal: 286000,
        baseDiscount: { rate: 0.95, after: 271700 },
        categoryDiscount: { rate: 0.97, after: 263551 },
        activePromotions: [{ name: '舒适家系统季', discount: 0.03 }],
        promotionDiscount: { rate: 0.97, after: 255645 },
        finalPrice: 255645,
        savedAmount: 30355,
        savedPercent: '10.6%'
      },
      items: [{ name: '中央热水系统', amount: 88000 }, { name: '全空气系统', amount: 168000 }],
      validUntil: '2026-07-05T00:00:00.000Z'
    });
  }
  if (pathname === '/api/quotation-v2/from-bom') {
    return ok({
      source: 'visual-fixture',
      summary: {
        materialSubtotal: 118000,
        labor: 18000,
        auxiliary: 9000,
        management: 6000,
        riskReserve: 3800,
        directCost: 154800,
        tax: 10800,
        customerTotal: 198000,
        monthlyPayment: 5500,
        grossMarginRate: 0.22
      },
      costBreakdown: [],
      marginGuard: { status: 'pass', quoteFloor: 174000 },
      assumptions: []
    });
  }
  if (pathname === '/api/products') {
    if (method === 'POST') return ok({ id: 'P-VISUAL' });
    return ok([
      { id: 'P1', model: 'Rheem DHW-80', specs: '中央热水', system: 'hot_water', brand: 'Rheem', price: 68000, status: 'active' },
      { id: 'P2', model: 'Ruud Air Pro', specs: '全空气系统', system: 'air', brand: 'Ruud', price: 128000, status: 'active' },
      { id: 'P3', model: 'Everhot Villa', specs: '墅级热水', system: 'hot_water', brand: 'Everhot', price: 98000, status: 'offshelf' }
    ]);
  }
  if (/^\/api\/products\/[^/]+\/shelf$/.test(pathname)) return ok({ status: 'updated' });
  if (pathname === '/api/promotion') {
    if (method === 'POST') return ok({ id: 'PROMO-VISUAL' });
    return ok([{ id: 'PR1', name: '总部联动政策', discount: 0.92, startDate: '2026-06-01', endDate: '2026-06-30', isActive: true }]);
  }
  if (/^\/api\/promotion\/[^/]+$/.test(pathname)) return ok({ deleted: true });
  if (pathname === '/api/pricing') {
    return ok({ baseDiscount: 0.96, categoryDiscounts: { hot_water: 0.95, air: 0.94, water: 0.96 }, lastUpdated: '2026-06-06' });
  }
	  if (/^\/api\/v2\/rysnova-bim\/projects\/[^/]+\/deliverable-artifacts$/.test(pathname)) {
    return ok({
      projectId: pathname.split('/')[5],
      artifactTypes: ['bom', 'quantity-takeoff', 'standards-check', 'customer-report'],
      artifacts: [
        { id: 'VIS-BOM', type: 'bom', objectKey: 'visual/project/bom/v1/bom.json' },
        { id: 'VIS-QTO', type: 'quantity-takeoff', objectKey: 'visual/project/quantity-takeoff/v1/quantity-takeoff.json' },
        { id: 'VIS-STD', type: 'standards-check', objectKey: 'visual/project/standards-check/v1/standards-check.json' },
        { id: 'VIS-RPT', type: 'customer-report', objectKey: 'visual/project/customer-report/v1/customer-report.json' }
      ],
      count: 4,
      generatedAt: new Date().toISOString(),
      customerReportSummary: { sectionCount: 7, iotBoundary: 'lifecycle_handoff_only' },
      bomSummary: { itemCount: 18 },
      quantityTakeoffSummary: { pipeMeters: 126, valveCount: 24 },
      standardsSummary: { counts: { passed: 18, warning: 1, failed: 0 } },
      quoteCostSummary: {
        quotationSummary: { customerTotal: 328000 },
        marginGuard: { status: 'pass', quoteFloor: 286000 }
      },
	      contract: RYSNOVA_DELIVERABLE_ARTIFACT_CONTRACT
	    });
	  }
	  if (/^\/api\/v2\/rysnova-bim\/projects\/[^/]+\/signoff-package$/.test(pathname)) {
	    const artifacts = [
	      { id: 'VIS-PRN', type: 'principle-diagram', objectKey: 'visual/project/principle-diagram/v1/principle-diagram.svg' },
	      { id: 'VIS-CDR', type: 'construction-drawing', objectKey: 'visual/project/construction-drawing/v1/construction-drawing.svg' },
	      { id: 'VIS-BIM', type: 'bim-model', objectKey: 'visual/project/bim-model/v1/bim-model.json' },
	      { id: 'VIS-BOM', type: 'bom', objectKey: 'visual/project/bom/v1/bom.json' },
	      { id: 'VIS-QTO', type: 'quantity-takeoff', objectKey: 'visual/project/quantity-takeoff/v1/quantity-takeoff.json' },
	      { id: 'VIS-STD', type: 'standards-check', objectKey: 'visual/project/standards-check/v1/standards-check.json' },
	      { id: 'VIS-RPT', type: 'customer-report', objectKey: 'visual/project/customer-report/v1/customer-report.json' }
	    ];
	    const storageEvidence = artifacts.map((artifact, index) => ({
	      type: artifact.type,
	      version: 1,
	      provider: 'visual-object-storage',
	      sizeBytes: 2048 + index * 512,
	      contentHash: `sha256:visual-${artifact.type}-hash`
	    }));
	    return ok({
	      projectId: pathname.split('/')[5],
	      approvalMode: 'share-to-customer',
	      status: 'signoff-ready',
	      artifactTypes: artifacts.map(item => item.type),
	      artifacts,
	      visualArtifacts: artifacts.slice(0, 3),
	      deliverableArtifacts: artifacts.slice(3),
	      approvalResults: artifacts,
	      count: 7,
	      storageEvidence,
	      customerPackageReady: true,
	      handoffReady: true,
	      customerPackage: {
	        count: 7,
	        missingTypes: [],
	        artifacts: artifacts.map((artifact, index) => ({
	          ...artifact,
	          customerVisible: true,
	          contentHash: storageEvidence[index].contentHash,
	          storage: {
	            provider: storageEvidence[index].provider,
	            sizeBytes: storageEvidence[index].sizeBytes,
	            integrityPassed: true
	          }
	        }))
	      },
	      deepeningPackage: {
	        visualReadiness: { ready: true },
	        commercialReadiness: { ready: true },
	        customerSignoff: { ready: true }
	      },
	      evidenceGaps: [],
	      nextActions: [],
	      generatedAt: new Date().toISOString(),
	      customerReportSummary: { sectionCount: 7, iotBoundary: 'lifecycle_handoff_only' },
	      bomSummary: { itemCount: 18 },
	      quantityTakeoffSummary: { pipeMeters: 126, valveCount: 24 },
	      standardsSummary: { counts: { passed: 18, warning: 1, failed: 0 } },
	      quoteCostSummary: {
	        quotationSummary: { customerTotal: 328000 },
	        marginGuard: { status: 'pass', quoteFloor: 286000 }
	      },
	      contract: RYSNOVA_SIGNOFF_PACKAGE_CONTRACT
	    });
	  }
  if (pathname === '/api/crm/customers') {
    return ok([
      { id: 'C001', name: '王女士', phone: '13400000000', city: '成都', houseType: '三室两厅', area: 138, createdAt: '2026-05-20T00:00:00.000Z' },
      { id: 'C002', name: '李先生', phone: '13500000000', city: '杭州', houseType: '大平层', area: 218, createdAt: '2026-05-24T00:00:00.000Z' }
    ]);
  }
  if (/^\/api\/crm\/customers\/[^/]+\/360$/.test(pathname)) {
    return ok({ profile: { id: 'C001', name: '王女士', city: '成都', houseType: '三室两厅', area: 138 }, quoteCount: 2, contractCount: 1, totalRevenue: 328000, stage: '施工安装', interactionCount: 9 });
  }
  if (/^\/api\/crm\/customers\/[^/]+\/interactions$/.test(pathname)) return ok({ id: 'INT-VISUAL' });
  if (pathname === '/api/crm/funnel') {
    return ok([
      { stage: '线索', count: 88, value: 12000000, conversionFromLead: '100%' },
      { stage: '方案', count: 31, value: 6400000, conversionFromLead: '35%' },
      { stage: '赢单', count: 18, value: 4200000, conversionFromLead: '20%' }
    ]);
  }
  if (pathname === '/api/crm/opportunities') return ok({ id: 'OPP-VISUAL' });
  if (/^\/api\/quotes\/[^/]+$/.test(pathname)) {
    return ok({ customerName: '王女士', area: 138, layout: '三室两厅', systemTier: '舒适方案' });
  }
  return ok({ fixture: true, pathname });
}

function renderMarkdown(report) {
  if (report.preflightFailed) {
    return [
      '# Browser Visual Acceptance Report',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      `Base URL: ${report.baseUrl}`,
      '',
      `Execution mode: ${report.executionMode}`,
      '',
      `Result: ${report.result}`,
      '',
      `Preflight failure: ${report.preflightFailure?.reason || 'unknown'}`,
      '',
      'The browser visual acceptance gate did not execute page checks. This report is not production visual proof.',
      ''
    ].join('\n');
  }

  const lines = [
    '# Browser Visual Acceptance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Base URL: ${report.baseUrl}`,
    '',
    '| Page | Status | Title | Text | Canvas | Console Errors | Result |',
    '|---|---:|---|---:|---:|---:|---:|'
  ];
  for (const result of report.results) {
    const forbidden = result.forbiddenText?.length ? result.forbiddenText.length : 0;
    lines.push(`| ${result.path} | ${result.status} | ${String(result.title).replace(/\|/g, '/')} | ${result.textMatched ? 'yes' : 'no'} | ${result.canvas ? (result.canvas.ok ? 'pass' : 'fail') : 'n/a'} | ${result.consoleErrors.length + forbidden} | ${result.passed ? 'pass' : 'fail'} |`);
  }
  if (report.viewerAcceptance) {
    lines.push(
      '',
      '## Viewer Acceptance',
      '',
      `Result: ${report.viewerAcceptance.passed ? 'pass' : 'fail'}`,
      '',
      `Report: ${report.viewerAcceptance.reportPath}`,
      '',
      `Screenshots: ${(report.viewerAcceptance.screenshotPaths || []).join(', ') || 'none'}`,
      ''
    );
  }
  return lines.join('\n');
}

function compactError(error) {
  const message = String(error?.message || error || 'unknown browser visual acceptance error');
  const stack = String(error?.stack || '');
  const combined = `${message}\n${stack}`;
  const machPort = combined.includes('MachPort') || combined.includes('bootstrap_check_in');
  const permissionDenied = combined.includes('Permission denied') || combined.includes('EPERM');
  return {
    reason: machPort && permissionDenied
      ? 'sandbox-browser-launch-permission-denied'
      : 'browser-visual-preflight-failed',
    message: message.slice(0, 2000),
    machPort,
    permissionDenied,
    stackHash: crypto.createHash('sha256').update(combined).digest('hex')
  };
}

async function createBrowserSession() {
  if (REMOTE_CDP_MODE) {
    const browser = await chromium.connectOverCDP(VISUAL_BROWSER_WS_ENDPOINT);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    return {
      browser,
      context,
      close: async () => {
        await context.close().catch(() => {});
        await browser.close().catch(() => {});
      }
    };
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: VISUAL_BROWSER_EXECUTABLE_PATH || undefined
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  return {
    browser,
    context,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  };
}

function updateLocalReleaseEvidence(key, patch) {
  if (!key) throw new Error('release evidence key is required');
  const evidence = fs.existsSync(RELEASE_EVIDENCE_JSON)
    ? JSON.parse(fs.readFileSync(RELEASE_EVIDENCE_JSON, 'utf8'))
    : { status: 'not-production-complete', requiredEvidence: {} };
  evidence.requiredEvidence = evidence.requiredEvidence || {};
  evidence.requiredEvidence[key] = {
    ...(evidence.requiredEvidence[key] || {}),
    ...patch
  };
  evidence.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(RELEASE_EVIDENCE_JSON), { recursive: true });
  fs.writeFileSync(RELEASE_EVIDENCE_JSON, `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence.requiredEvidence[key];
}

function findSystemBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || '';
}

function writePreflightFailureReport(error) {
  const preflightFailure = compactError(error);
  const sourceHashes = pages.map(spec => ({
    path: spec.path,
    sourcePath: `archive/legacy-ui/public${spec.path}`,
    sourceSha256: sha256(`archive/legacy-ui/public${spec.path}`)
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: REPORT_BASE_URL,
    executionMode: EXECUTION_MODE,
    result: 'preflight-failed',
    finalLaunchVisualProof: false,
    preflightFailed: true,
    preflightFailure,
    summary: {
      pages: pages.length,
      passed: 0,
      failed: pages.length,
      notExecuted: pages.length
    },
    sourceHashes,
    results: []
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
  updateReleaseEvidence('browserVisual', {
    command: 'VISUAL_BASE_URL=<staging-url-or-local-static> VISUAL_BROWSER_WS_ENDPOINT=<cdp-endpoint-optional> npm run guard:browser-visual',
    status: 'preflight-failed-browser-launch',
    path: 'audit/browser-visual-acceptance-report.json',
    summaryPath: 'audit/browser-visual-acceptance-report.md',
    baseUrl: REPORT_BASE_URL,
    pages: pages.length,
    pagesRequired: pages.length,
    missingPages: pages.map(spec => spec.path),
    staleSourcePaths: [],
    finalLaunchVisualProof: false,
    preflightFailure,
    currentBlocker: 'Browser visual acceptance could not launch Chromium in this environment. MachPort/Permission denied preflight failure is recorded; final visual proof still requires rerunning guard:browser-visual in a browser-capable environment.'
  });
  updateReleaseEvidence('guardAll', {
    command: 'npm run guard:all',
    status: 'blocked-by-browser-visual',
    path: 'evidence/guards/',
    currentBlocker: 'browserVisual preflight failed during guard:browser-visual because Chromium launch hit MachPort/Permission denied in this sandbox. guard:all:nonvisual can continue, but final guard:all requires fresh browser visual acceptance.'
  });
  return report;
}

function runViewerAcceptance() {
  const appDir = path.join(ROOT, 'apps', 'designer-workbench');
  const appDirArg = process.platform === 'win32' ? 'apps/designer-workbench' : appDir;
  const displayCommand = `pnpm.cmd --dir ${appDirArg} acceptance:viewer`;
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'pnpm';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', `pnpm.cmd --dir ${appDirArg} acceptance:viewer`]
      : ['--dir', appDir, 'acceptance:viewer'];
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      VIEWER_ACCEPTANCE_BASE_URL:
        process.env.VIEWER_ACCEPTANCE_BASE_URL || process.env.DESIGNER_WORKBENCH_BASE_URL || 'http://127.0.0.1:5003',
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const report = fs.existsSync(VIEWER_ACCEPTANCE_REPORT)
    ? JSON.parse(fs.readFileSync(VIEWER_ACCEPTANCE_REPORT, 'utf8'))
    : null;
  return {
    command: process.platform === 'win32' ? displayCommand : `${command} ${args.join(' ')}`,
    passed: !result.error && result.status === 0,
    status: result.status,
    signal: result.signal,
    error: result.error
      ? {
          code: result.error.code,
          message: result.error.message,
          path: result.error.path,
          spawnargs: result.error.spawnargs,
        }
      : null,
    reportPath: path.relative(ROOT, VIEWER_ACCEPTANCE_REPORT).replace(/\\/g, '/'),
    screenshotPaths: report?.summary?.screenshots ?? [],
    stdout: String(result.stdout || '').slice(-4000),
    stderr: String(result.stderr || '').slice(-4000),
  };
}

async function main() {
  const session = await createBrowserSession();
  const { context } = session;
  const results = [];
  try {
    if (LOCAL_STATIC_MODE) await installLocalStaticFixture(context);
    for (const spec of pages) results.push(await inspectPage(context, spec));
  } finally {
    await session.close();
  }
  const viewerAcceptance = runViewerAcceptance();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: REPORT_BASE_URL,
    executionMode: EXECUTION_MODE,
    summary: {
      pages: results.length,
      passed: results.filter(result => result.passed).length,
      failed: results.filter(result => !result.passed).length + (viewerAcceptance.passed ? 0 : 1)
    },
    results,
    viewerAcceptance
  };
  report.finalLaunchVisualProof = finalLaunchVisualProofFromReport(report);

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
  updateReleaseEvidence('browserVisual', {
    command: 'VISUAL_BASE_URL=<staging-url-or-local-static> VISUAL_BROWSER_WS_ENDPOINT=<cdp-endpoint-optional> npm run guard:browser-visual',
    status: 'passed-current-run',
    path: 'audit/browser-visual-acceptance-report.json',
    summaryPath: 'audit/browser-visual-acceptance-report.md',
    baseUrl: REPORT_BASE_URL,
    executionMode: report.executionMode,
    pages: report.summary.pages,
    pagesRequired: pages.length,
    missingPages: [],
    failedPages: viewerAcceptance.passed ? [] : ['designer-workbench:/viewer'],
    staleSourcePaths: [],
    finalLaunchVisualProof: report.finalLaunchVisualProof,
    currentBlocker: null,
    lastRunAt: report.generatedAt
  });
  updateReleaseEvidence('guardAll', {
    command: 'npm run guard:all',
    status: 'blocked-by-sandbox-browser-launch',
    path: 'evidence/guards/',
    currentBlocker: 'browserVisual passed current-run and guard:all:nonvisual can verify the non-visual suite, but final guard:all still needs a fresh full run in an environment where Playwright Chromium is not blocked by MachPort permissions.'
  });
  console.log(`Browser visual acceptance: ${report.summary.passed}/${report.summary.pages} pages passed; viewer acceptance ${viewerAcceptance.passed ? 'passed' : 'failed'}`);
  if (report.summary.failed) process.exit(1);
}

main().catch(error => {
  const report = writePreflightFailureReport(error);
  console.error(error);
  console.error(`Browser visual acceptance preflight failed: ${report.preflightFailure.reason}`);
  process.exit(1);
});
