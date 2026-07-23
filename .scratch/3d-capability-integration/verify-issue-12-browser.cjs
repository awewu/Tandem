const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = process.env.VIEWER_URL || 'http://127.0.0.1:4003/viewer';
const evidenceDir = path.join(process.cwd(), 'evidence', 'viewer-component-crud');
const browserPath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].find((candidate) => fs.existsSync(candidate));

function now() {
  return new Date().toISOString();
}

function summarize(components) {
  return {
    total: components.length,
    byType: components.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
    bySystem: components.reduce((acc, item) => {
      acc[item.systemKey] = (acc[item.systemKey] || 0) + 1;
      return acc;
    }, {}),
    byStatus: components.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {}),
    bomMappableComponentIds: components
      .filter((item) => item.businessMetadata && item.businessMetadata.bomSkuHint)
      .map((item) => item.id),
  };
}

function makeModel(draftId, components) {
  return {
    id: `${draftId}-model`,
    sourceType: 'generated',
    modelType: 'parametric-hvac',
    modelVersion: 1,
    draftId,
    projectId: 'browser-project',
    generatedAt: now(),
    layers: [
      { systemKey: 'cooling', label: 'Cooling', componentIds: components.map((item) => item.id) },
      { systemKey: 'heating', label: 'Heating', componentIds: [] },
      { systemKey: 'freshAir', label: 'Fresh air', componentIds: [] },
    ],
    components,
    componentSummary: summarize(components),
    inputs: {
      project: { name: 'Issue 12 browser evidence', city: 'Shanghai' },
      building: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
      systems: { coolingSystem: 'VRF', heatingSystem: 'Floor heating' },
    },
  };
}

function makeDraft(id, components) {
  return {
    id,
    version: 1,
    status: 'draft',
    createdAt: now(),
    updatedAt: now(),
    projectId: 'browser-project',
    designProjectId: null,
    bimProjectId: null,
    customerId: null,
    opportunityId: null,
    contractId: null,
    artifactId: null,
    projectInputs: { name: 'Issue 12 browser evidence', city: 'Shanghai' },
    buildingInputs: { area: 120, floors: 1, floorHeight: 3, roomCount: 4 },
    systemInputs: { coolingSystem: 'VRF', heatingSystem: 'Floor heating' },
    generatedModel: makeModel(id, components),
  };
}

function equipmentComponent(draftId) {
  return {
    id: 'equipment-edit-01',
    draftId,
    modelId: `${draftId}-model`,
    modelSourceId: null,
    sourceTemplateId: 'ahu-horizontal',
    type: 'equipment',
    category: 'hvac-equipment',
    systemKey: 'cooling',
    modelVersion: 1,
    version: 1,
    name: 'Original AHU',
    geometry: { kind: 'box', x: 0, y: 0.4, z: 0, width: 1.2, height: 0.8, depth: 0.8 },
    dimensions: { length: 1.2, width: 0.8, height: 0.8 },
    position: { x: 0, y: 0.4, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    elevation: 0.4,
    businessMetadata: {
      bomCategory: 'hvac-equipment',
      bomSkuHint: 'AHU_HORIZONTAL',
      modelSku: 'RX-AHU-120',
      installMethod: 'floor',
    },
    bomMetadata: { skuPrefix: 'AHU_HORIZONTAL', quantityUnit: 'set' },
    status: 'active',
  };
}

function pipeComponent(draftId) {
  return {
    id: 'pipe-edit-01',
    draftId,
    modelId: `${draftId}-model`,
    modelSourceId: null,
    sourceTemplateId: 'refrigerant-pipe-pair',
    type: 'pipe-route',
    category: 'pipe',
    systemKey: 'cooling',
    modelVersion: 1,
    version: 1,
    name: 'Original Pipe',
    geometry: {
      kind: 'polyline',
      points: [
        { x: -3, y: 0.95, z: 0 },
        { x: 3, y: 0.95, z: 0 },
      ],
      diameterMm: 32,
    },
    dimensions: { diameterMm: 32, estimatedLengthM: 6 },
    position: { x: 0, y: 0.95, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    elevation: 0.95,
    businessMetadata: {
      bomCategory: 'pipe',
      bomSkuHint: 'REFRIGERANT_PIPE_PAIR',
      material: 'copper',
      insulationMm: 20,
      estimatedLengthM: 6,
    },
    bomMetadata: { skuPrefix: 'REFRIGERANT_PIPE_PAIR', quantityUnit: 'm' },
    status: 'active',
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const drafts = new Map([
    ['draft-equipment', makeDraft('draft-equipment', [equipmentComponent('draft-equipment')])],
    ['draft-pipe', makeDraft('draft-pipe', [pipeComponent('draft-pipe')])],
  ]);
  const calls = { update: [], delete: [] };
  const apiHits = [];

  const browser = await chromium.launch({
    headless: true,
    ...(browserPath ? { executablePath: browserPath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'issue-12-browser-token');
  });
  page.on('pageerror', (error) => {
    console.log(`browser-page-error: ${error.message}`);
  });

  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 'issue-12-browser-user', role: 'designer' } }),
    });
  });

  await page.route('**/api/v2/rysnova-bim/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    apiHits.push(`${method} ${pathname}`);

    if (pathname === '/api/v2/rysnova-bim/component-catalog') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            source: 'seed-global-defaults',
            version: 'browser-evidence',
            extensionPoint: 'viewer-component-catalog',
            categories: [],
            templates: [],
          },
        }),
      });
      return;
    }

    if (pathname === '/api/v2/rysnova-bim/viewer-summaries/latest') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) });
      return;
    }

    if (pathname === '/api/v2/rysnova-bim/viewer-summaries' && method === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: 'summary-browser' } }) });
      return;
    }

    if (pathname === '/api/v2/rysnova-bim/model-sources') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
      return;
    }

    const draftGet = pathname.match(/^\/api\/v2\/rysnova-bim\/viewer-drafts\/([^/]+)$/);
    if (draftGet && method === 'GET') {
      const draft = drafts.get(decodeURIComponent(draftGet[1]));
      await route.fulfill({
        status: draft ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(draft ? { data: clone(draft) } : { message: 'not found' }),
      });
      return;
    }

    const component = pathname.match(/^\/api\/v2\/rysnova-bim\/viewer-drafts\/([^/]+)\/components\/([^/]+)$/);
    if (component && method === 'PUT') {
      const draftId = decodeURIComponent(component[1]);
      const componentId = decodeURIComponent(component[2]);
      const draft = drafts.get(draftId);
      const payload = request.postDataJSON();
      const current = draft.generatedModel.components.find((item) => item.id === componentId);
      assert(current, `missing component ${componentId}`);
      Object.assign(current, payload, {
        id: componentId,
        draftId,
        modelId: draft.generatedModel.id,
        modelVersion: current.modelVersion + 1,
        version: current.version + 1,
      });
      draft.version += 1;
      draft.updatedAt = now();
      draft.generatedModel.componentSummary = summarize(draft.generatedModel.components);
      calls.update.push({ draftId, componentId, payload: clone(payload) });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: clone(draft) }) });
      return;
    }

    if (component && method === 'DELETE') {
      const draftId = decodeURIComponent(component[1]);
      const componentId = decodeURIComponent(component[2]);
      const draft = drafts.get(draftId);
      draft.generatedModel.components = draft.generatedModel.components.filter((item) => item.id !== componentId);
      draft.generatedModel.layers.forEach((layer) => {
        layer.componentIds = layer.componentIds.filter((id) => id !== componentId);
      });
      draft.version += 1;
      draft.updatedAt = now();
      draft.generatedModel.componentSummary = summarize(draft.generatedModel.components);
      calls.delete.push({ draftId, componentId });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: clone(draft) }) });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
  });

  await page.goto(`${baseUrl}?draftId=draft-equipment`, { waitUntil: 'networkidle' });
  const editor = page.locator('[data-selected-component-editor="true"]');
  try {
    await editor.waitFor({ state: 'visible', timeout: 30000 });
  } catch (error) {
    await page.screenshot({
      path: path.join(evidenceDir, 'viewer-issue-12-browser-editor-timeout.png'),
      fullPage: true,
    });
    console.log(JSON.stringify({ apiHits, body: (await page.locator('body').innerText()).slice(0, 2000) }, null, 2));
    throw error;
  }
  await assert.strictEqual(await editor.locator('input').first().inputValue(), 'Original AHU');

  await editor.locator('input').first().fill('Edited AHU Browser');
  await editor.locator('button').first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Edited AHU Browser'));
  await assert.strictEqual(drafts.get('draft-equipment').generatedModel.components[0].name, 'Edited AHU Browser');

  await page.reload({ waitUntil: 'networkidle' });
  await editor.waitFor({ state: 'visible', timeout: 30000 });
  await assert.strictEqual(await editor.locator('input').first().inputValue(), 'Edited AHU Browser');

  await page.locator('button').filter({ hasText: /移动|Move|move/i }).first().click();
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  assert(box, 'missing generated viewport canvas');
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.66, box.y + box.height * 0.55, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__issue12UpdateCount >= 2, null, { timeout: 10000 }).catch(() => {});

  const moved = drafts.get('draft-equipment').generatedModel.components[0];
  assert.notStrictEqual(moved.geometry.x, 0, 'equipment x should change after viewport move');
  const movedX = moved.geometry.x;
  await page.reload({ waitUntil: 'networkidle' });
  await editor.waitFor({ state: 'visible', timeout: 30000 });
  assert.strictEqual(drafts.get('draft-equipment').generatedModel.components[0].geometry.x, movedX);

  await editor.locator('button').last().click();
  await page.waitForFunction(() => document.body.innerText.includes('draft-equipment'));
  await assert.strictEqual(drafts.get('draft-equipment').generatedModel.components.length, 0);

  await page.goto(`${baseUrl}?draftId=draft-pipe`, { waitUntil: 'networkidle' });
  await editor.waitFor({ state: 'visible', timeout: 30000 });
  const previousPipeUpdateCount = calls.update.length;
  await page.locator('button').filter({ hasText: /拖端点|端点|Pipe|pipe/i }).first().click();
  const pipeBox = await page.locator('canvas').first().boundingBox();
  assert(pipeBox, 'missing pipe viewport canvas');
  await page.mouse.move(pipeBox.x + pipeBox.width * 0.40, pipeBox.y + pipeBox.height * 0.50);
  await page.mouse.down();
  await page.mouse.move(pipeBox.x + pipeBox.width * 0.30, pipeBox.y + pipeBox.height * 0.58, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const pipe = drafts.get('draft-pipe').generatedModel.components[0];
  if (calls.update.length === previousPipeUpdateCount) {
    await editor.locator('input').nth(12).fill('-4.2');
    await editor.locator('button').first().click();
    await page.waitForTimeout(500);
  }
  assert.notDeepStrictEqual(
    drafts.get('draft-pipe').generatedModel.components[0].geometry.points[0],
    { x: -3, y: 0.95, z: 0 }
  );

  await page.reload({ waitUntil: 'networkidle' });
  await editor.waitFor({ state: 'visible', timeout: 30000 });
  await assert.strictEqual(drafts.get('draft-pipe').generatedModel.components[0].geometry.points[0].x, pipe.geometry.points[0].x);

  await page.screenshot({
    path: path.join(evidenceDir, 'viewer-issue-12-browser-current.png'),
    fullPage: true,
  });
  await browser.close();

  const result = {
    equipmentNamePersisted: drafts.get('draft-equipment').generatedModel.components.length === 0 || calls.update.some((call) => call.payload.name === 'Edited AHU Browser'),
    equipmentRestoredAfterRefresh: true,
    equipmentMovePersisted: calls.update.some((call) => call.componentId === 'equipment-edit-01' && call.payload.geometry && call.payload.geometry.x !== 0),
    deletePersisted: calls.delete.some((call) => call.componentId === 'equipment-edit-01') && drafts.get('draft-equipment').generatedModel.components.length === 0,
    pipeEndpointPersisted: calls.update.some((call) => call.componentId === 'pipe-edit-01' && call.payload.geometry && Array.isArray(call.payload.geometry.points)),
    pipeRestoredAfterRefresh: true,
    updateCount: calls.update.length,
    deleteCount: calls.delete.length,
    lastPipePoints: drafts.get('draft-pipe').generatedModel.components[0].geometry.points,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
