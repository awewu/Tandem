#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.VIEWER_ACCEPTANCE_BASE_URL || 'http://127.0.0.1:5003';
const BROWSER_EXECUTABLE_PATH =
  process.env.VIEWER_ACCEPTANCE_BROWSER_EXECUTABLE_PATH || findSystemBrowser();
const TWO_FLOOR_RISER_FIXTURE = require('../fixtures/viewer-two-floor-riser.fixture.json');
const TWO_FLOOR_RISER_DRAFT_ID = TWO_FLOOR_RISER_FIXTURE.model.draftId;
const SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID = 'i11-second-to-first-floor-route';
const ROUTE_AUTHORING_SMOKE_ID = 'created-route-smoke-01';
const ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID = 'equipment-2f-indoor';
const ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID = 'equipment-1f-utility';
const EVIDENCE_DIR = path.join(__dirname, '..', '..', '..', 'evidence', 'viewer-acceptance');
const REPORT_JSON = path.join(EVIDENCE_DIR, 'viewer-acceptance-report.json');
const REPORT_MD = path.join(EVIDENCE_DIR, 'viewer-acceptance-report.md');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 980 },
  { name: 'narrow', width: 390, height: 844 },
];
const MOJIBAKE_PATTERN =
  /(?:\u941f|\u9225|\u9365|\u7481|\u93c2|\u6d93|\u7ecb|\u7ee0|\u752f|\u95ab|\u95c2|\u714e|\u6fc2|\u25a1|\ufffd)/;

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: BROWSER_EXECUTABLE_PATH || undefined,
  });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport });
      await installApiMocks(context);
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      await page.addInitScript(() => {
        localStorage.setItem('token', 'viewer-acceptance-token');
      });

      await page.goto(`${BASE_URL}/viewer`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('[data-viewer-shell="unified-dark-three-column"]', {
        timeout: 30000,
      });
      await page.waitForSelector('canvas', { timeout: 30000 });
      await page.waitForTimeout(500);

      const inspection = await inspectViewer(page, viewport.name);
      const fixtureInspection = await inspectTwoFloorRiserFixture(page, viewport);
      const passed =
        consoleErrors.length === 0 &&
        inspection.failures.length === 0 &&
        fixtureInspection.failures.length === 0;
      results.push({
        viewport: viewport.name,
        passed,
        consoleErrors,
        ...inspection,
        fixtureInspection,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    evidenceDir: EVIDENCE_DIR,
    results,
    summary: {
      viewports: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      screenshots: results.flatMap((result) => result.fixtureInspection?.screenshots ?? []),
    },
  };
  writeReport(report);
  const failed = results.filter((result) => !result.passed);
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    console.error(
      `Viewer browser acceptance failed for: ${failed.map((item) => item.viewport).join(', ')}`
    );
    console.error(`Viewer acceptance artifacts: ${REPORT_JSON}`);
    console.error(`Viewer acceptance screenshots: ${report.summary.screenshots.join(', ')}`);
    process.exit(1);
  }
}

async function installApiMocks(context) {
  const acceptanceState = {
    routeComponents: new Map(),
    componentOverrides: new Map(),
  };
  await context.route(`**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        success: true,
        data: draftFromTwoFloorFixture(acceptanceState),
      }),
    })
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/generated-model`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      })
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/components`,
    async (route) => {
      const input = route.request().postDataJSON();
      const requestedName = String(input.name ?? input.displayName ?? '');
      const componentId =
        input.type === 'pipe-route' || input.type === 'duct-route'
          ? requestedName.includes('I11')
            ? SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID
            : ROUTE_AUTHORING_SMOKE_ID
          : `created-component-${acceptanceState.componentOverrides.size + 1}`;
      const endpointRefs = routeEndpointRefsForInput(input.route?.endpointRefs, input.geometry?.points);
      const component = withAcceptedRouteQuantities({
        id: componentId,
        draftId: TWO_FLOOR_RISER_DRAFT_ID,
        modelId: TWO_FLOOR_RISER_FIXTURE.model.id,
        modelSourceId: null,
        sourceTemplateId: input.sourceTemplateId ?? null,
        type: input.type ?? 'pipe-route',
        category: input.category ?? 'route',
        systemKey: input.systemKey ?? 'cooling',
        modelVersion: 2,
        version: 2,
        name: input.name ?? componentId,
        displayName: input.displayName ?? input.name ?? componentId,
        geometry: input.geometry,
        route: input.route ? { ...input.route, endpointRefs } : null,
        dimensions: { ...(input.dimensions ?? {}), estimatedLengthM: input.route?.summary?.totalLengthM ?? 0 },
        position: input.position ?? {},
        rotation: input.rotation ?? { x: 0, y: 0, z: 0 },
        visibility: input.visibility ?? 'visible',
        locked: false,
        floor: input.floor ?? 1,
        elevation: input.elevation ?? input.geometry?.points?.[0]?.y ?? 0.95,
        installHeight: input.installHeight ?? input.geometry?.points?.[0]?.y ?? 0.95,
        businessMetadata: { ...(input.businessMetadata ?? {}), endpointRefs },
        bomMetadata: input.bomMetadata ?? {},
        status: 'active',
      });
      if (component.type === 'pipe-route' || component.type === 'duct-route') {
        acceptanceState.routeComponents.set(component.id, component);
      } else {
        acceptanceState.componentOverrides.set(component.id, component);
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      });
    }
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/components/${ROUTE_AUTHORING_SMOKE_ID}`,
    async (route) => {
      const input = route.request().postDataJSON();
      const current = acceptanceState.routeComponents.get(ROUTE_AUTHORING_SMOKE_ID) || {};
      const routeInput = input.route ?? current.route ?? null;
      const endpointRefs = routeInput
        ? routeEndpointRefsForInput(routeInput.endpointRefs, input.geometry?.points ?? current.geometry?.points)
        : undefined;
      const component = withAcceptedRouteQuantities({
        ...current,
        ...input,
        id: ROUTE_AUTHORING_SMOKE_ID,
        draftId: TWO_FLOOR_RISER_DRAFT_ID,
        modelId: TWO_FLOOR_RISER_FIXTURE.model.id,
        modelVersion: 3,
        version: 3,
        name: ROUTE_AUTHORING_SMOKE_ID,
        displayName: ROUTE_AUTHORING_SMOKE_ID,
        route: routeInput ? { ...routeInput, endpointRefs } : null,
        geometry: input.geometry ?? current.geometry,
        dimensions: input.dimensions ?? current.dimensions ?? {},
        businessMetadata: { ...(input.businessMetadata ?? current.businessMetadata ?? {}), endpointRefs },
        bomMetadata: input.bomMetadata ?? current.bomMetadata ?? {},
        status: 'active',
      });
      acceptanceState.routeComponents.set(component.id, component);
      followAllRouteEndpoints(acceptanceState);
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      });
    }
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/components/${SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID}`,
    async (route) => {
      const input = route.request().postDataJSON();
      const current = acceptanceState.routeComponents.get(SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID) || {};
      const routeInput = input.route ?? current.route ?? null;
      const endpointRefs = routeInput
        ? routeEndpointRefsForInput(routeInput.endpointRefs, input.geometry?.points ?? current.geometry?.points)
        : undefined;
      const component = withAcceptedRouteQuantities({
        ...current,
        ...input,
        id: SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
        draftId: TWO_FLOOR_RISER_DRAFT_ID,
        modelId: TWO_FLOOR_RISER_FIXTURE.model.id,
        modelVersion: 3,
        version: 3,
        name: SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
        displayName: SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
        route: routeInput ? { ...routeInput, endpointRefs } : null,
        geometry: input.geometry ?? current.geometry,
        dimensions: input.dimensions ?? current.dimensions ?? {},
        businessMetadata: { ...(input.businessMetadata ?? current.businessMetadata ?? {}), endpointRefs },
        bomMetadata: input.bomMetadata ?? current.bomMetadata ?? {},
        status: 'active',
      });
      acceptanceState.routeComponents.set(component.id, component);
      followAllRouteEndpoints(acceptanceState);
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      });
    }
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/components/${ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID}`,
    async (route) => {
      const input = route.request().postDataJSON();
      const base = TWO_FLOOR_RISER_FIXTURE.model.components.find(
        (component) => component.id === ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID
      ) || acceptanceState.componentOverrides.get(ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID);
      const component = {
        ...base,
        ...input,
        id: ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID,
        draftId: TWO_FLOOR_RISER_DRAFT_ID,
        modelId: TWO_FLOOR_RISER_FIXTURE.model.id,
        modelVersion: 5,
        version: 5,
        geometry: input.geometry ?? base.geometry,
        position: input.position ?? base.position,
        dimensions: input.dimensions ?? base.dimensions,
        businessMetadata: input.businessMetadata ?? base.businessMetadata,
        bomMetadata: input.bomMetadata ?? base.bomMetadata,
        status: 'active',
      };
      acceptanceState.componentOverrides.set(ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID, component);
      followAllRouteEndpoints(acceptanceState);
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      });
    }
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/components/${ROUTE_AUTHORING_SMOKE_ID}/riser`,
    async (route) => {
      const input = route.request().postDataJSON();
      const current = acceptanceState.routeComponents.get(ROUTE_AUTHORING_SMOKE_ID);
      const sourceFloor = Number(input.sourceFloor ?? current?.floor ?? 2);
      const targetFloor = Number(input.targetFloor ?? 1);
      const installHeight = Number(current?.installHeight ?? current?.businessMetadata?.installHeight ?? 0.95);
      const x = Number(input.point?.x);
      const z = Number(input.point?.z);
      const sourcePoint = { x, y: (sourceFloor - 1) * 3 + installHeight, z };
      const targetPoint = { x, y: (targetFloor - 1) * 3 + installHeight, z };
      const previousPoints = Array.isArray(current?.geometry?.points) ? current.geometry.points : [];
      const points = [...previousPoints, sourcePoint, targetPoint];
      const transition = {
        kind: 'riser',
        fromFloor: sourceFloor,
        toFloor: targetFloor,
        startPointIndex: points.length - 2,
        endPointIndex: points.length - 1,
        sourceFloorId: `floor-${sourceFloor}`,
        targetFloorId: `floor-${targetFloor}`,
        sourceElevation: sourcePoint.y,
        targetElevation: targetPoint.y,
        x,
        z,
        installHeight,
        createdAt: '2026-07-21T00:00:00.000Z',
      };
      const component = withAcceptedRouteQuantities({
        ...current,
        id: ROUTE_AUTHORING_SMOKE_ID,
        draftId: TWO_FLOOR_RISER_DRAFT_ID,
        modelId: TWO_FLOOR_RISER_FIXTURE.model.id,
        modelVersion: 4,
        version: 4,
        floor: targetFloor,
        elevation: targetPoint.y,
        installHeight,
        position: { ...(current?.position ?? {}), ...targetPoint },
        geometry: { ...(current?.geometry ?? {}), kind: 'polyline', points },
        route: {
          ...(current?.route ?? {}),
          points,
          floors: [routeFloorParticipation(1, points), routeFloorParticipation(2, points)],
          crossFloorTransitions: [...(current?.route?.crossFloorTransitions ?? []), transition],
          summary: {
            ...(current?.route?.summary ?? {}),
            pointCount: points.length,
            floorCount: 2,
            transitionCount: (current?.route?.crossFloorTransitions?.length ?? 0) + 1,
          },
        },
        businessMetadata: {
          ...(current?.businessMetadata ?? {}),
          floor: targetFloor,
          elevation: targetPoint.y,
          installHeight,
          lastRiserTransition: transition,
        },
        status: 'active',
      });
      acceptanceState.routeComponents.set(component.id, component);
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      });
    }
  );
  await context.route(
    `**/api/v2/rysnova-bim/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}/components/${SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID}/riser`,
    async (route) => {
      const input = route.request().postDataJSON();
      const current = acceptanceState.routeComponents.get(SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID);
      const sourceFloor = Number(input.sourceFloor ?? current?.floor ?? 2);
      const targetFloor = Number(input.targetFloor ?? 1);
      const installHeight = Number(current?.installHeight ?? current?.businessMetadata?.installHeight ?? 0.95);
      const x = Number(input.point?.x);
      const z = Number(input.point?.z);
      const sourcePoint = { x, y: (sourceFloor - 1) * 3 + installHeight, z };
      const targetPoint = { x, y: (targetFloor - 1) * 3 + installHeight, z };
      const previousPoints = Array.isArray(current?.geometry?.points) ? current.geometry.points : [];
      const points = [...previousPoints, sourcePoint, targetPoint];
      const transition = {
        kind: 'riser',
        fromFloor: sourceFloor,
        toFloor: targetFloor,
        startPointIndex: points.length - 2,
        endPointIndex: points.length - 1,
        sourceFloorId: `floor-${sourceFloor}`,
        targetFloorId: `floor-${targetFloor}`,
        sourceElevation: sourcePoint.y,
        targetElevation: targetPoint.y,
        x,
        z,
        installHeight,
        createdAt: '2026-07-21T00:00:00.000Z',
      };
      const component = withAcceptedRouteQuantities({
        ...current,
        id: SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
        draftId: TWO_FLOOR_RISER_DRAFT_ID,
        modelId: TWO_FLOOR_RISER_FIXTURE.model.id,
        modelVersion: 4,
        version: 4,
        floor: targetFloor,
        elevation: targetPoint.y,
        installHeight,
        position: { ...(current?.position ?? {}), ...targetPoint },
        geometry: { ...(current?.geometry ?? {}), kind: 'polyline', points },
        route: {
          ...(current?.route ?? {}),
          points,
          floors: [routeFloorParticipation(1, points), routeFloorParticipation(2, points)],
          crossFloorTransitions: [...(current?.route?.crossFloorTransitions ?? []), transition],
          summary: {
            ...(current?.route?.summary ?? {}),
            pointCount: points.length,
            floorCount: 2,
            transitionCount: (current?.route?.crossFloorTransitions?.length ?? 0) + 1,
          },
        },
        businessMetadata: {
          ...(current?.businessMetadata ?? {}),
          floor: targetFloor,
          elevation: targetPoint.y,
          installHeight,
          lastRiserTransition: transition,
        },
        status: 'active',
      });
      acceptanceState.routeComponents.set(component.id, component);
      return route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          success: true,
          data: draftFromTwoFloorFixture(acceptanceState),
        }),
      });
    }
  );
  await context.route('**/api/v2/rysnova-bim/viewer-summaries/latest?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ success: true, data: null }),
    })
  );
  await context.route('**/api/v2/rysnova-bim/model-sources?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ success: true, data: { items: [] } }),
    })
  );
  await context.route('**/api/v2/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        success: true,
        data: { id: 'viewer-acceptance-user', name: '验收用户', role: 'designer' },
      }),
    })
  );
  await context.route('**/api/v2/file-artifact?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ success: true, data: { items: [] } }),
    })
  );
  await context.route('**/api/v2/rysnova-bim/**', (route) => {
    if (route.request().url().includes(`/viewer-drafts/${TWO_FLOOR_RISER_DRAFT_ID}`)) {
      return route.fallback();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ success: true, data: { items: [] } }),
    });
  });
  await context.route('**/favicon.ico', (route) =>
    route.fulfill({ status: 204, contentType: 'image/x-icon', body: '' })
  );
}

function draftFromTwoFloorFixture(acceptanceState) {
  const componentOverrides = acceptanceState?.componentOverrides ?? new Map();
  const extraComponents = [
    ...componentOverrides.values(),
    ...(acceptanceState?.routeComponents?.values ? [...acceptanceState.routeComponents.values()] : []),
  ].filter((component) => {
    const fixtureComponent = TWO_FLOOR_RISER_FIXTURE.model.components.find(
      (item) => item.id === component.id
    );
    return !fixtureComponent;
  });
  const generatedModel = {
    ...TWO_FLOOR_RISER_FIXTURE.model,
    components: [
      ...TWO_FLOOR_RISER_FIXTURE.model.components.map(
        (component) =>
          acceptanceState?.routeComponents?.get(component.id) ??
          componentOverrides.get(component.id) ??
          component
      ),
      ...extraComponents,
    ],
  };
  generatedModel.componentSummary = {
    ...generatedModel.componentSummary,
    total: generatedModel.components.length,
    byType: {
      ...generatedModel.componentSummary.byType,
      'pipe-route': generatedModel.components.filter((component) => component.type === 'pipe-route').length,
    },
  };
  return {
    id: TWO_FLOOR_RISER_DRAFT_ID,
    version: 1,
    status: 'draft',
    projectId: TWO_FLOOR_RISER_FIXTURE.model.projectId,
    designProjectId: null,
    bimProjectId: null,
    customerId: null,
    opportunityId: null,
    contractId: null,
    artifactId: null,
    projectInputs: TWO_FLOOR_RISER_FIXTURE.projectInputs,
    buildingInputs: TWO_FLOOR_RISER_FIXTURE.buildingInputs,
    systemInputs: TWO_FLOOR_RISER_FIXTURE.systemInputs,
    generatedModel,
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  };
}

function routeConnectionSmokeEndpointRefs(points = []) {
  const first = points[0] ?? { x: -4, y: 3.45, z: -2 };
  const last = points[points.length - 1] ?? { x: 3.8, y: 0.95, z: 2.7 };
  return {
    from: {
      endpointKey: 'from',
      endpointRole: 'source',
      equipmentId: ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID,
      equipmentRole: 'source',
      attachmentKind: 'anchor',
      attachmentId: 'equipment-anchor:center',
      status: 'connected',
      point: first,
      systemKey: 'cooling',
      routeType: 'pipe-route',
      fallbackReason: 'equipment has no connector metadata; using persisted equipment anchor',
    },
    to: {
      endpointKey: 'to',
      endpointRole: 'target',
      equipmentId: ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID,
      equipmentRole: 'target',
      attachmentKind: 'anchor',
      attachmentId: 'equipment-anchor:center',
      status: 'connected',
      point: last,
      systemKey: 'cooling',
      routeType: 'pipe-route',
      fallbackReason: 'equipment has no connector metadata; using persisted equipment anchor',
    },
  };
}

function routeEndpointRefsForInput(endpointRefs = {}, points = []) {
  const fallback = routeConnectionSmokeEndpointRefs(points);
  return {
    from: endpointRefs.from ?? fallback.from,
    to: endpointRefs.to ?? fallback.to,
  };
}

function withAcceptedRouteQuantities(component) {
  if (component?.type !== 'pipe-route' && component?.type !== 'duct-route') return component;
  const points = Array.isArray(component.route?.points)
    ? component.route.points
    : Array.isArray(component.geometry?.points)
      ? component.geometry.points
      : [];
  const totalLengthM = routeLength(points);
  const floors = routeFloorParticipations(points);
  const first = points[0] ?? {};
  const floor = floorFromPoint(first);
  const elevation = Number(first.y ?? component.elevation ?? 0.95);
  const installHeight = Number((elevation - (floor - 1) * 3).toFixed(2));
  return {
    ...component,
    floor,
    elevation,
    installHeight,
    position: { ...(component.position ?? {}), x: first.x, y: elevation, z: first.z },
    dimensions: { ...(component.dimensions ?? {}), estimatedLengthM: totalLengthM },
    route: component.route
      ? {
          ...component.route,
          points,
          floors,
          summary: {
            ...(component.route.summary ?? {}),
            pointCount: points.length,
            floorCount: floors.length,
            totalLengthM,
          },
        }
      : component.route,
    businessMetadata: {
      ...(component.businessMetadata ?? {}),
      floor,
      elevation,
      installHeight,
      acceptedLengthM: totalLengthM,
      estimatedLengthM: totalLengthM,
    },
    bomMetadata: {
      ...(component.bomMetadata ?? {}),
      quantity: totalLengthM,
      estimatedLengthM: totalLengthM,
      unit: component.bomMetadata?.unit ?? 'm',
    },
  };
}

function routeLength(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1] ?? {};
    const b = points[index] ?? {};
    total += Math.hypot(
      Number(b.x ?? 0) - Number(a.x ?? 0),
      Number(b.y ?? 0) - Number(a.y ?? 0),
      Number(b.z ?? 0) - Number(a.z ?? 0)
    );
  }
  return Number(total.toFixed(2));
}

function followAllRouteEndpoints(acceptanceState) {
  const equipmentById = new Map(
    TWO_FLOOR_RISER_FIXTURE.model.components
      .filter((component) => component.type === 'equipment')
      .map((component) => [
        component.id,
        acceptanceState.componentOverrides.get(component.id) ?? component,
      ])
  );
  for (const component of acceptanceState.componentOverrides.values()) {
    if (component.type === 'equipment') equipmentById.set(component.id, component);
  }
  for (const route of acceptanceState.routeComponents.values()) {
    if (!route?.route?.endpointRefs) continue;
    let nextRoute = route;
    for (const endpointKey of ['from', 'to']) {
      const endpointRef = nextRoute.route.endpointRefs[endpointKey];
      const equipment = endpointRef?.equipmentId ? equipmentById.get(endpointRef.equipmentId) : null;
      if (
        !equipment ||
        (endpointRef.status !== 'connected' &&
          !(endpointRef.attachmentKind === 'anchor' && endpointRef.fallbackReason))
      ) {
        continue;
      }
      nextRoute = routeWithFollowedEndpoint(nextRoute, endpointKey, equipment);
    }
    acceptanceState.routeComponents.set(nextRoute.id, nextRoute);
  }
}

function routeWithFollowedEndpoint(route, endpointKey, equipment) {
  const endpointRef = route.route.endpointRefs[endpointKey];
  const point = smokeComponentAnchor(equipment);
  const points = Array.isArray(route.geometry?.points) ? [...route.geometry.points] : [];
  const pointIndex = endpointKey === 'from' ? 0 : points.length - 1;
  if (points.length < 2 || pointIndex < 0) {
    route.route.endpointRefs[endpointKey] = {
      ...endpointRef,
      status: 'stale',
      staleReason: 'connected-route-geometry-not-editable',
    };
    return route;
  }
  points[pointIndex] = point;
  const endpointRefs = {
    ...(route.route.endpointRefs ?? {}),
    [endpointKey]: { ...endpointRef, point, status: 'connected', staleReason: undefined },
  };
  return withAcceptedRouteQuantities({
    ...route,
    geometry: { ...(route.geometry ?? {}), points },
    route: { ...(route.route ?? {}), points, endpointRefs },
    businessMetadata: { ...(route.businessMetadata ?? {}), endpointRefs },
  });
}

function smokeComponentAnchor(component) {
  const geometry = component?.geometry ?? {};
  const position = component?.position ?? {};
  return {
    x: Number(geometry.x ?? position.x ?? 0),
    y: Number(component?.elevation ?? geometry.y ?? position.y ?? 0),
    z: Number(geometry.z ?? position.z ?? 0),
  };
}

function routeFloorParticipation(floor, points) {
  const min = (floor - 1) * 3;
  const max = floor * 3;
  return {
    floor,
    floorId: `floor-${floor}`,
    pointIndexes: points
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.y >= min && point.y <= max)
      .map(({ index }) => index),
    elevationMin: min,
    elevationMax: max,
  };
}

function routeFloorParticipations(points) {
  const floors = [...new Set((points ?? []).map(floorFromPoint))].sort((left, right) => left - right);
  return floors.map((floor) => routeFloorParticipation(floor, points));
}

function floorFromPoint(point) {
  return Math.max(1, Math.floor(Math.max(0, Number(point?.y ?? 0)) / 3) + 1);
}

async function inspectViewer(page, viewportName) {
  return page.evaluate(
    ({ viewportName, mojibakeSource }) => {
      const failures = [];
      const mojibake = new RegExp(mojibakeSource);
      const shell = document.querySelector('[data-viewer-shell="unified-dark-three-column"]');
      const bodyText = document.body.innerText || '';
      const bodyFont = getComputedStyle(document.body).fontFamily;
      const shellRect = shell?.getBoundingClientRect();
      const grid = shell?.firstElementChild;
      const panels = grid ? [...grid.children].map((item) => item.getBoundingClientRect()) : [];
      const canvas = document.querySelector('canvas');
      const canvasRect = canvas?.getBoundingClientRect();
      const fileInput = [...document.querySelectorAll('input[type="file"]')].find((input) =>
        String(input.getAttribute('accept') || '').includes('.ifc')
      );
      const fileAccept = String(fileInput?.getAttribute('accept') || '');
      const objectTree = document.querySelector('[data-model-object-tree-panel="true"]');
      const fitViewButton = [...document.querySelectorAll('button')].find((button) =>
        /适配视图/.test(button.textContent || '')
      );
      const iframeCount = document.querySelectorAll('iframe').length;
      const documentWidth = document.documentElement.scrollWidth;
      const viewportWidth = window.innerWidth;

      if (!shell) failures.push('missing unified viewer shell');
      if (!shellRect || shellRect.width < 300 || shellRect.height < 500) {
        failures.push('viewer shell has invalid dimensions');
      }
      if (iframeCount !== 0) failures.push('viewer implementation rendered an iframe');
      if (document.documentElement.lang !== 'zh-CN') failures.push('document lang is not zh-CN');
      if (!/(PingFang SC|Microsoft YaHei|Noto Sans CJK|sans-serif)/i.test(bodyFont)) {
        failures.push(`Chinese-capable font stack missing: ${bodyFont}`);
      }
      if (mojibake.test(bodyText))
        failures.push('rendered text contains mojibake or missing-glyph markers');
      if (!canvasRect || canvasRect.width < 220 || canvasRect.height < 220) {
        failures.push('viewer canvas is missing or too small');
      }
      if (canvas && typeof canvas.toDataURL === 'function') {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          if (!dataUrl || dataUrl.length < 2000) failures.push('viewer canvas appears blank');
        } catch (error) {
          failures.push(`viewer canvas could not be sampled: ${error.message}`);
        }
      }
      if (!fileInput) {
        failures.push('local IFC loading boundary is missing file input support');
      }
      if (!fileAccept.includes('.glb') || !fileAccept.includes('.gltf')) {
        failures.push('local GLB loading boundary is missing file input support');
      }
      if (!objectTree) failures.push('model object tree panel is missing');
      if (!fitViewButton) failures.push('imported model fit view control is missing');
      if (viewportName === 'desktop') {
        if (panels.length < 3) failures.push('desktop viewer does not expose three panels');
        if (panelsOverlap(panels)) failures.push('desktop viewer panels overlap');
      }
      if (viewportName === 'narrow' && documentWidth > viewportWidth + 4) {
        failures.push(`narrow viewer overflows horizontally: ${documentWidth} > ${viewportWidth}`);
      }

      return {
        failures,
        title: document.title,
        fontFamily: bodyFont,
        shell: rectSummary(shellRect),
        canvas: rectSummary(canvasRect),
        panelCount: panels.length,
        viewportWidth,
        documentWidth,
        textLength: bodyText.length,
      };

      function panelsOverlap(rects) {
        for (let left = 0; left < rects.length; left += 1) {
          for (let right = left + 1; right < rects.length; right += 1) {
            if (intersectionArea(rects[left], rects[right]) > 8) return true;
          }
        }
        return false;
      }

      function intersectionArea(a, b) {
        const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return width * height;
      }

      function rectSummary(rect) {
        if (!rect) return null;
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }
    },
    { viewportName, mojibakeSource: MOJIBAKE_PATTERN.source }
  );
}

async function inspectTwoFloorRiserFixture(page, viewport) {
  const fixtureFailures = inspectTwoFloorRiserFixtureData(TWO_FLOOR_RISER_FIXTURE);
  await page.goto(`${BASE_URL}/viewer?draftId=${encodeURIComponent(TWO_FLOOR_RISER_DRAFT_ID)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector(
    `[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`,
    {
      state: 'attached',
      timeout: 30000,
    }
  );
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(900);
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const screenshotPath = path.join(EVIDENCE_DIR, `viewer-two-floor-riser-${viewport.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const screenshots = [screenshotPath];
  const canvasProbe = await webglCanvasProbe(page);
  if (!canvasProbe.ok) fixtureFailures.push(canvasProbe.reason);
  const sideElevationProbe = inspectSideElevationRiserVisibility(TWO_FLOOR_RISER_FIXTURE);
  if (!sideElevationProbe.ok) fixtureFailures.push(sideElevationProbe.reason);
  const routeVisualProbe = await inspectRouteVisualSemantics(page);
  if (!routeVisualProbe.ok) fixtureFailures.push(routeVisualProbe.reason);
  const selectionDrivenInspectorProbe = await inspectSelectionDrivenInspectorSmoke(page);
  if (!selectionDrivenInspectorProbe.ok) fixtureFailures.push(selectionDrivenInspectorProbe.reason);
  const cameraControlsProbe = await inspectCameraControlsSmoke(page);
  if (!cameraControlsProbe.ok) fixtureFailures.push(cameraControlsProbe.reason);
  const protectedLockedProbe = await inspectProtectedLockedSmoke(page);
  if (!protectedLockedProbe.ok) fixtureFailures.push(protectedLockedProbe.reason);
  const floorIsolationProbe = await inspectFloorIsolationRiserSmoke(page, viewport);
  screenshots.push(...(floorIsolationProbe.screenshots ?? []));
  if (!floorIsolationProbe.ok) fixtureFailures.push(floorIsolationProbe.reason);
  const secondToFirstFloorE2E = await inspectOptionalSecondToFirstFloorE2E(page);
  if (!secondToFirstFloorE2E.ok) fixtureFailures.push(secondToFirstFloorE2E.reason);
  const routeDraftSmoke = await inspectRouteDraftAuthoringSmoke(page);
  if (!routeDraftSmoke.ok) fixtureFailures.push(routeDraftSmoke.reason);
  const commandHistorySmoke = await inspectCommandHistorySmoke(page);
  if (!commandHistorySmoke.ok) fixtureFailures.push(commandHistorySmoke.reason);

  return {
    fixtureId: TWO_FLOOR_RISER_FIXTURE.id,
    screenshotPath,
    screenshots,
    canvasProbe,
    sideElevationProbe,
    routeVisualProbe,
    selectionDrivenInspectorProbe,
    cameraControlsProbe,
    protectedLockedProbe,
    floorIsolationProbe,
    secondToFirstFloorE2E,
    routeDraftSmoke,
    commandHistorySmoke,
    failures: fixtureFailures,
  };
}

async function inspectFloorIsolationRiserSmoke(page, viewport) {
  await page.goto(`${BASE_URL}/viewer?draftId=${encodeURIComponent(TWO_FLOOR_RISER_DRAFT_ID)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(500);
  const logicalRouteId = 'pipe-logical-two-floor-route';
  const screenshots = [];
  const routeTreeNode = page.locator(`[data-model-object-component-id="${logicalRouteId}"]`).first();
  if ((await routeTreeNode.count()) > 0) await routeTreeNode.click({ timeout: 5000 });
  await clickViewportToolbarButton(page, '04-single-floor');
  await selectActiveFloor(page, 2);
  const secondFloor = await routeFloorSummaryOrNull(page, logicalRouteId, 'single-floor', 2);
  const secondMarkerProbe = await inspectRiserMarkerProjection(page, 'riser-down');
  const secondFloorScreenshot = path.join(
    EVIDENCE_DIR,
    `viewer-two-floor-riser-${viewport.name}-single-floor-2f.png`
  );
  await page.screenshot({ path: secondFloorScreenshot, fullPage: true });
  screenshots.push(secondFloorScreenshot);
  if (
    !secondFloor?.visible ||
    secondFloor.visibleSegmentCount < 2 ||
    !secondFloor.riserMarkers?.some((marker) => marker.direction === 'riser-down') ||
    !secondMarkerProbe.ok
  ) {
    return {
      ok: false,
      reason: secondMarkerProbe.ok
        ? 'second-floor logical route did not show local portions and riser-down marker'
        : secondMarkerProbe.reason,
      componentId: logicalRouteId,
      summary: secondFloor,
      markerProbe: secondMarkerProbe,
      screenshots,
    };
  }

  await page.goto(`${BASE_URL}/viewer?draftId=${encodeURIComponent(TWO_FLOOR_RISER_DRAFT_ID)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(500);
  await clickViewportToolbarButton(page, '04-single-floor');
  const firstFloor = await routeFloorSummaryOrNull(page, logicalRouteId, 'single-floor', 1);
  const firstMarkerProbe = await inspectRiserMarkerProjection(page, 'riser-up');
  const firstFloorScreenshot = path.join(
    EVIDENCE_DIR,
    `viewer-two-floor-riser-${viewport.name}-single-floor-1f.png`
  );
  await page.screenshot({ path: firstFloorScreenshot, fullPage: true });
  screenshots.push(firstFloorScreenshot);
  if (
    !firstFloor?.visible ||
    firstFloor.visibleSegmentCount < 2 ||
    !firstFloor.riserMarkers?.some((marker) => marker.direction === 'riser-up') ||
    !firstMarkerProbe.ok
  ) {
    return {
      ok: false,
      reason: firstMarkerProbe.ok
        ? 'first-floor logical route did not show local portions and riser-up marker'
        : firstMarkerProbe.reason,
      componentId: logicalRouteId,
      summary: firstFloor,
      markerProbe: firstMarkerProbe,
      screenshots,
    };
  }

  await clickViewportToolbarButton(page, '05-all-floors');
  const allFloorScreenshot = path.join(
    EVIDENCE_DIR,
    `viewer-two-floor-riser-${viewport.name}-all-floor-elevation.png`
  );
  await page.screenshot({ path: allFloorScreenshot, fullPage: true });
  screenshots.push(allFloorScreenshot);
  const allFloor = await routeGeometrySummary(page, logicalRouteId);
  const verticalSegment = allFloor?.points?.some((point, index, points) => {
    const previous = points[index - 1];
    return (
      previous &&
      Math.abs(previous.x - point.x) < 0.001 &&
      Math.abs(previous.z - point.z) < 0.001 &&
      Math.abs(previous.y - point.y) > 0.5
    );
  });
  if (!verticalSegment) {
    return {
      ok: false,
      reason: 'all-floor logical route did not preserve the vertical riser segment',
      componentId: logicalRouteId,
      summary: allFloor,
      screenshots,
    };
  }

  return {
    ok: true,
    componentId: logicalRouteId,
    secondFloor,
    firstFloor,
    allFloorPointCount: allFloor.points.length,
    markerProbes: [secondMarkerProbe, firstMarkerProbe],
    screenshots,
  };
}

async function inspectRouteVisualSemantics(page) {
  const routeTreeNode = page.locator('[data-model-object-component-id="pipe-vertical-riser"]').first();
  if ((await routeTreeNode.count()) > 0) await routeTreeNode.click({ timeout: 5000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const geometry = JSON.parse(
      document
        .querySelector('[data-generated-hvac-route-geometry-summary]')
        ?.getAttribute('data-generated-hvac-route-geometry-summary') || '[]'
    );
    const visual = JSON.parse(
      document
        .querySelector('[data-generated-hvac-route-visual-summary]')
        ?.getAttribute('data-generated-hvac-route-visual-summary') || '[]'
    );
    const pipe = visual.find((item) => item.id === 'pipe-vertical-riser');
    const selectedPipe = visual.find((item) => item.id === 'pipe-vertical-riser' && item.selected);
    const logical = geometry.find((item) => item.id === 'pipe-logical-two-floor-route');
    const duct = visual.find((item) => item.id === 'duct-1f-rectangular');
    const pipeGeometry = geometry.find((item) => item.id === 'pipe-vertical-riser');
    const verticalSegment = logical?.points?.some((point, index, points) => {
      const previous = points[index - 1];
      return (
        previous &&
        Math.abs(previous.x - point.x) < 0.001 &&
        Math.abs(previous.z - point.z) < 0.001 &&
        Math.abs(previous.y - point.y) > 0.5
      );
    });
    const pipeHasDiameter =
      pipe?.metrics?.kind === 'round-pipe' &&
      pipe.metrics.diameterMm >= 20 &&
      pipe.metrics.radiusM > 0 &&
      pipe.metrics.segmentCount >= 1 &&
      pipeGeometry?.points?.length >= 2;
    const ductHasCrossSection =
      duct?.metrics?.kind === 'rectangular-duct' &&
      duct.metrics.widthM >= 0.3 &&
      duct.metrics.heightM >= 0.18 &&
      duct.metrics.segmentCount >= 2;
    const ok = Boolean(pipeHasDiameter && ductHasCrossSection && verticalSegment && selectedPipe);
    return {
      ok,
      reason: ok
        ? 'route visual semantics passed'
        : 'route visual semantics missing solid pipe diameter, duct cross-section, selected route, or vertical riser',
      pipe,
      duct,
      selectedPipe: Boolean(selectedPipe),
      verticalSegment: Boolean(verticalSegment),
    };
  });
}

async function inspectSelectionDrivenInspectorSmoke(page) {
  const canvas = page.locator('[data-generated-hvac-viewport] canvas').first();
  const box = await canvas.boundingBox();
  if (!box) return { ok: false, reason: 'selection-driven inspector smoke canvas is missing' };
  await page.locator('[data-pipe-edit-mode="select"]').first().click({ timeout: 5000 });
  await dispatchCanvasPointerClick(canvas, { x: box.width * 0.02, y: box.height * 0.02 });
  await page.waitForTimeout(200);

  const noSelection = await page.evaluate(() => {
    const editor = document.querySelector('[data-selected-component-editor="true"]');
    const text = document.body.innerText || '';
    const save = document.querySelector('[data-viewer-save-draft="true"]');
    const reload = document.querySelector('[data-viewer-reload-draft="true"]');
    return {
      hasEditor: Boolean(editor),
      hasRouteFields:
        text.includes('管径') ||
        text.includes('风管宽度') ||
        text.includes('风管高度') ||
        text.includes('端点连接') ||
        text.includes('节点连接'),
      saveVisible: Boolean(save),
      reloadVisible: Boolean(reload),
      reloadDisabled: reload?.hasAttribute('disabled') ?? false,
    };
  });
  if (noSelection.hasEditor || noSelection.hasRouteFields || !noSelection.saveVisible || !noSelection.reloadVisible) {
    return {
      ok: false,
      reason: 'no-selection inspector did not stay minimal with save/reload controls visible',
      noSelection,
    };
  }

  await page
    .locator(`[data-model-object-component-id="${ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID}"]`)
    .first()
    .click({ timeout: 5000 });
  const equipment = await selectedComponentEditorDataset(page);
  if (
    equipment.id !== ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID ||
    equipment.type !== 'equipment' ||
    equipment.hasRouteFields ||
    equipment.hasRawMetadata
  ) {
    return {
      ok: false,
      reason: 'equipment selection exposed route fields or raw metadata',
      equipment,
    };
  }

  await page.locator('[data-model-object-component-id="pipe-vertical-riser"]').first().click({
    timeout: 5000,
  });
  const pipe = await selectedComponentEditorDataset(page);
  if (
    pipe.id !== 'pipe-vertical-riser' ||
    pipe.type !== 'pipe-route' ||
    !pipe.hasPipeFields ||
    pipe.hasDuctSizeFields ||
    pipe.hasRawMetadata
  ) {
    return {
      ok: false,
      reason: 'pipe route selection did not expose the PE2 pipe field set',
      pipe,
    };
  }

  await page.locator('[data-model-object-component-id="duct-1f-rectangular"]').first().click({
    timeout: 5000,
  });
  const duct = await selectedComponentEditorDataset(page);
  const controls = await saveReloadControlState(page);
  const ok =
    duct.id === 'duct-1f-rectangular' &&
    duct.type === 'duct-route' &&
    duct.hasDuctSizeFields &&
    !duct.hasPipeDiameter &&
    duct.hasRouteConnectionFields &&
    !duct.hasRawMetadata &&
    controls.saveVisible &&
    controls.reloadVisible;
  return {
    ok,
    reason: ok
      ? 'selection-driven inspector smoke passed'
      : 'duct route selection or save/reload controls failed PE2 expectations',
    noSelection,
    equipment,
    pipe,
    duct,
    controls,
  };
}

async function inspectCameraControlsSmoke(page) {
  const canvas = page.locator('[data-generated-hvac-viewport] canvas').first();
  const box = await canvas.boundingBox();
  if (!box) return { ok: false, reason: 'camera controls smoke canvas is missing' };
  await dispatchCanvasPointerDrag(
    canvas,
    { x: box.width * 0.52, y: box.height * 0.48 },
    { x: box.width * 0.64, y: box.height * 0.42 },
    { button: 2 }
  );
  await dispatchCanvasPointerDrag(
    canvas,
    { x: box.width * 0.48, y: box.height * 0.54 },
    { x: box.width * 0.58, y: box.height * 0.6 },
    { button: 1 }
  );
  await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -180,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      })
    );
    element.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      })
    );
    element.dispatchEvent(
      new PointerEvent('pointercancel', {
        bubbles: true,
        cancelable: true,
        pointerId: 9,
        pointerType: 'mouse',
      })
    );
    element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });
  const movementState = await canvas.evaluate((element) => ({
    orbitEvents: element.dataset.orbitEvents,
    panEvents: element.dataset.panEvents,
    zoomEvents: element.dataset.zoomEvents,
    fitViewEvents: element.dataset.fitViewEvents,
    cameraControlsEnabled: element.dataset.cameraControlsEnabled,
    cameraControlsRestored: element.dataset.cameraControlsRestored,
    interactionState: element.dataset.interactionState,
  }));
  await page.locator('[data-pipe-edit-mode="draw-pipe"]').first().click({ timeout: 5000 });
  await dispatchCanvasPointerClick(canvas, { x: box.width * 0.35, y: box.height * 0.7 });
  await page.getByText('Cancel route').click({ timeout: 5000 });
  await page.locator('[data-pipe-edit-mode="select"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(300);
  const cancelState = await page.evaluate(() => {
    const element = document.querySelector('[data-generated-hvac-viewport] canvas');
    return {
      orbitEvents: element?.dataset.orbitEvents,
      panEvents: element?.dataset.panEvents,
      zoomEvents: element?.dataset.zoomEvents,
      fitViewEvents: element?.dataset.fitViewEvents,
      cameraControlsEnabled: element?.dataset.cameraControlsEnabled,
      cameraControlsRestored: element?.dataset.cameraControlsRestored,
      interactionState: element?.dataset.interactionState,
    };
  });
  const state = { ...movementState, cancelState };
  const ok =
    Number(state.orbitEvents ?? 0) > 0 &&
    Number(state.panEvents ?? 0) > 0 &&
    Number(state.zoomEvents ?? 0) > 0 &&
    Number(state.fitViewEvents ?? 0) > 0 &&
    state.cameraControlsEnabled === 'true' &&
    Boolean(state.cameraControlsRestored);
  return {
    ok,
    reason: ok
      ? 'camera controls smoke passed'
      : 'orbit/pan/zoom/fit-view or camera recovery did not leave controls enabled',
    state: {
      orbitEvents: state.orbitEvents,
      panEvents: state.panEvents,
      zoomEvents: state.zoomEvents,
      fitViewEvents: state.fitViewEvents,
      cameraControlsEnabled: state.cameraControlsEnabled,
      cameraControlsRestored: state.cameraControlsRestored,
    },
  };
}

async function inspectProtectedLockedSmoke(page) {
  const lockedRouteId = 'pipe-locked-service-route';
  await clickViewportToolbarButton(page, '05-all-floors');
  await page.locator(`[data-model-object-component-id="${lockedRouteId}"]`).first().click({
    timeout: 5000,
  });
  await page.locator('[data-pipe-edit-mode="edit-pipe"]').first().click({ timeout: 5000 });
  const before = await routeGeometrySummary(page, lockedRouteId);
  const canvas = page.locator('[data-generated-hvac-viewport] canvas').first();
  const points = await waitSelectedRoutePoints2d(page);
  if (points[1]) {
    await dispatchCanvasPointerDrag(canvas, points[1], { x: points[1].x + 36, y: points[1].y - 24 });
  }
  const after = await routeGeometrySummary(page, lockedRouteId);
  await page.locator('[data-model-object-component-id="ifc-protected-equipment"]').first().click({
    timeout: 5000,
  });
  const editorLocked = await page.evaluate(() => {
    const editor = document.querySelector('[data-selected-component-editor="true"]');
    return {
      disabledControls: editor ? editor.querySelectorAll('input:disabled,button:disabled').length : 0,
      totalControls: editor ? editor.querySelectorAll('input,button').length : 0,
    };
  });
  const sameGeometry = JSON.stringify(before?.points ?? []) === JSON.stringify(after?.points ?? []);
  const ok = Boolean(sameGeometry && editorLocked.totalControls > 0 && editorLocked.disabledControls > 0);
  return {
    ok,
    reason: ok
      ? 'protected and locked smoke passed'
      : 'locked route or IFC/GLB source geometry accepted an edit',
    lockedRouteId,
    sameGeometry,
    editorLocked,
  };
}

async function clickViewportToolbarButton(page, order) {
  await page.locator(`[data-viewer-toolbar-order="${order}"]`).click({ timeout: 5000 });
}

async function inspectRiserMarkerProjection(page, direction) {
  return page.evaluate((direction) => {
    const canvas = document.querySelector('[data-generated-hvac-viewport] canvas');
    const markers = JSON.parse(canvas?.dataset.riserMarkers2d || '[]');
    const routePoints = JSON.parse(canvas?.dataset.selectedRoutePoints2d || '[]');
    const segmentHandles = JSON.parse(canvas?.dataset.selectedRouteSegmentMidpoints2d || '[]');
    const marker = markers.find((item) => item.direction === direction);
    const width = canvas?.clientWidth ?? 0;
    const height = canvas?.clientHeight ?? 0;
    const markerPoint = marker?.screen;
    const inside =
      markerPoint &&
      markerPoint.x >= 16 &&
      markerPoint.y >= 16 &&
      markerPoint.x <= width - 16 &&
      markerPoint.y <= height - 16;
    const handleClearance = Math.min(
      999,
      ...routePoints.concat(segmentHandles).map((point) =>
        Math.hypot(Number(point.x) - Number(markerPoint?.x), Number(point.y) - Number(markerPoint?.y))
      )
    );
    const ok = Boolean(marker && inside && handleClearance >= 10);
    return {
      ok,
      reason: ok
        ? `${direction} marker projection passed`
        : `${direction} marker is missing, off canvas, or overlapping route handles`,
      marker,
      markerCount: markers.length,
      handleClearance,
      canvas: { width, height },
    };
  }, direction);
}

async function inspectOptionalSecondToFirstFloorE2E(page) {
  try {
    return await inspectSecondToFirstFloorE2E(page);
  } catch (error) {
    return {
      ok: false,
      blocking: false,
      reason: `optional I11 second-to-first-floor probe did not complete: ${error.message}`,
      diagnostics: await i11Diagnostics(page),
    };
  }
}

async function i11Diagnostics(page) {
  return page.evaluate((routeId) => {
    const viewport = document.querySelector('[data-generated-hvac-viewport]');
    const canvas = document.querySelector('[data-generated-hvac-viewport] canvas');
    const routePoints = JSON.parse(canvas?.dataset.routePoints2d || '[]');
    const geometry = JSON.parse(
      viewport?.getAttribute('data-generated-hvac-route-geometry-summary') || '[]'
    );
    return {
      editMode: viewport?.getAttribute('data-generated-hvac-edit-mode') ?? null,
      floorViewMode: viewport?.getAttribute('data-generated-hvac-floor-view-mode') ?? null,
      activeFloor: viewport?.getAttribute('data-generated-hvac-active-floor') ?? null,
      componentIds: viewport?.getAttribute('data-generated-hvac-component-ids') ?? null,
      routeDraftControls: document
        .querySelector('[data-route-draft-controls]')
        ?.getAttribute('data-route-draft-point-count') ?? null,
      routeDraftPointCount: canvas?.dataset.routeDraftPointCount ?? null,
      routeDraftLastPoint: canvas?.dataset.routeDraftLastPoint ?? null,
      routeSnapStatus: canvas?.dataset.routeSnapStatus ?? null,
      routeSnapEquipmentId: canvas?.dataset.routeSnapEquipmentId ?? null,
      routePointIds: routePoints.map((route) => ({
        id: route.id,
        pointCount: route.points?.length ?? 0,
      })),
      i11Geometry: geometry.find((route) => route.id === routeId) ?? null,
      bodyStatus: document.body.innerText.slice(0, 1600),
    };
  }, SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID);
}

async function inspectSecondToFirstFloorE2E(page) {
  await page.goto(`${BASE_URL}/viewer?draftId=${encodeURIComponent(TWO_FLOOR_RISER_DRAFT_ID)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(500);
  const canvas = page.locator('[data-generated-hvac-viewport] canvas').first();

  const placementClamp = await moveTargetEquipmentOutOfRangeAndAssertClamp(page, canvas);
  if (!placementClamp.ok) return placementClamp;

  await clickViewportToolbarButton(page, '05-all-floors');
  await page
    .locator(`[data-model-object-component-id="${ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID}"]`)
    .first()
    .click({ timeout: 5000 });
  const selectedEquipment = await selectedComponentEditorDataset(page);
  const selectedEquipmentId = selectedEquipment.id;
  if (selectedEquipmentId !== ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID) {
    return {
      ok: false,
      reason: 'I11 could not select the second-floor equipment before route authoring',
      selectedEquipmentId,
    };
  }

  await page
    .locator('[data-model-object-component-id="pipe-2f-horizontal"]')
    .first()
    .click({ timeout: 5000 });
  await page.locator('[data-route-name-input="true"]').fill('I11 second-to-first floor route');
  await selectActiveFloor(page, 2);
  await page.locator('[data-pipe-edit-mode="draw-pipe"]').first().click({ timeout: 5000 });
  await page.waitForSelector('[data-route-draft-controls="true"]', { timeout: 5000 });
  const sourceAnchor = await componentAnchor2d(page, ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID);
  const secondFloorGuidePoints = await waitSelectedRoutePoints2d(page);
  const secondFloorClicks = [
    sourceAnchor?.routeDraftScreen ?? sourceAnchor?.screen,
    secondFloorGuidePoints[1],
    secondFloorGuidePoints[2],
  ].filter(Boolean);
  if (!sourceAnchor || secondFloorClicks.length < 3) {
    return {
      ok: false,
      reason: `I11 guide route exposed too few second-floor projected points: ${secondFloorClicks.length}`,
      pointCount: secondFloorClicks.length,
      secondFloorGuidePoints,
    };
  }
  for (const point of secondFloorClicks) {
    await dispatchCanvasPointerClick(canvas, point);
    await page.waitForTimeout(120);
  }
  const beforeUndoCount = await routeDraftPointCount(page);
  await page.getByText('Undo point').click();
  await dispatchCanvasPointerClick(canvas, secondFloorClicks[2]);
  await page.getByText('Finish route').click();
  await page.waitForFunction(
    (id) =>
      document
        .querySelector('[data-generated-hvac-component-ids]')
        ?.getAttribute('data-generated-hvac-component-ids')
        ?.includes(id),
    SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
    { timeout: 8000 }
  );

  await page
    .locator(`[data-model-object-component-id="${SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID}"]`)
    .first()
    .click({ timeout: 5000 });
  await selectActiveFloor(page, 2);
  await page.locator('[data-pipe-edit-mode="add-riser"]').first().click({ timeout: 5000 });
  const createdRoutePoints = await waitSelectedRoutePoints2d(page);
  const riserPoint = createdRoutePoints[createdRoutePoints.length - 1];
  if (!riserPoint) {
    return {
      ok: false,
      reason: 'I11 could not project the created route riser point',
      createdRoutePoints,
    };
  }
  await dispatchCanvasPointerClick(canvas, riserPoint);
  await page.waitForSelector('[data-route-riser-confirm="true"]', { timeout: 5000 });
  await page.locator('[data-route-riser-confirm="true"] select').selectOption('1');
  await page.getByText('Confirm riser').click();
  await page.waitForSelector('[data-route-draft-controls="true"]', { timeout: 8000 });
  const targetAnchor = await componentAnchor2d(page, ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID);
  if (!targetAnchor) {
    return { ok: false, reason: 'I11 could not find target equipment anchor after riser' };
  }
  await dispatchCanvasPointerClick(canvas, targetAnchor.routeDraftScreen ?? targetAnchor.screen);
  await page.getByText('Finish route').click();
  await page.waitForFunction(
    (id) => {
      const routes = JSON.parse(
        document
          .querySelector('[data-generated-hvac-route-geometry-summary]')
          ?.getAttribute('data-generated-hvac-route-geometry-summary') || '[]'
      );
      const route = routes.find((item) => item.id === id);
      return Boolean(route?.points?.length >= 6 && route?.crossFloorTransitions?.length === 1);
    },
    SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
    { timeout: 8000 }
  );

  const beforeReload = await routeAcceptanceSnapshot(page, SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID);
  const beforeValidation = validateSecondToFirstFloorRouteSnapshot(beforeReload);
  if (!beforeValidation.ok) return beforeValidation;

  await page.locator('[data-viewer-save-draft="true"]').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  const afterReload = await routeAcceptanceSnapshot(page, SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID);
  const afterValidation = validateSecondToFirstFloorRouteSnapshot(afterReload);
  if (!afterValidation.ok) return afterValidation;

  const beforeComparable = comparableRouteSnapshot(beforeReload);
  const afterComparable = comparableRouteSnapshot(afterReload);
  const unchanged = JSON.stringify(beforeComparable) === JSON.stringify(afterComparable);
  return {
    ok: unchanged,
    reason: unchanged
      ? 'I11 second-to-first-floor browser E2E passed'
      : 'I11 route changed after save/reload',
    componentId: SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
    beforeUndoCount,
    placementClamp,
    beforeReload: beforeComparable,
    afterReload: afterComparable,
  };
}

async function moveTargetEquipmentOutOfRangeAndAssertClamp(page, canvas) {
  await page.locator('[data-pipe-edit-mode="move-component"]').first().click({ timeout: 5000 });
  const target = await componentAnchor2d(page, ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID);
  if (!target) {
    return { ok: false, reason: 'I11 placement clamp could not find target equipment anchor' };
  }
  const beforeAnchor = target.anchor;
  const box = await canvas.boundingBox();
  if (!box) return { ok: false, reason: 'I11 placement clamp canvas is missing' };
  await dispatchCanvasPointerDrag(canvas, target.screen, {
    x: box.width + 360,
    y: box.height + 220,
  });
  await page.waitForTimeout(800);
  return page.evaluate(({ equipmentId, beforeAnchor }) => {
    const canvas = document.querySelector('[data-generated-hvac-viewport] canvas');
    const anchors = JSON.parse(canvas?.dataset.componentAnchors2d || '[]');
    const target = anchors.find((item) => item.id === equipmentId);
    const bounds = String(canvas?.dataset.placementBounds || '')
      .split(',')
      .map((value) => Number(value));
    const raw = String(canvas?.dataset.lastRawPlacementPoint || '')
      .split(',')
      .map((value) => Number(value));
    const constrained = String(canvas?.dataset.lastConstrainedPlacementPoint || '')
      .split(',')
      .map((value) => Number(value));
    const [minX, maxX, minZ, maxZ] = bounds;
    const anchorMoved =
      target &&
      (Math.abs(target.anchor.x - beforeAnchor.x) > 0.001 ||
        Math.abs(target.anchor.z - beforeAnchor.z) > 0.001);
    const onPlacementBoundary =
      target &&
      (Math.abs(target.anchor.x - minX) <= 0.001 ||
        Math.abs(target.anchor.x - maxX) <= 0.001 ||
        Math.abs(target.anchor.z - minZ) <= 0.001 ||
        Math.abs(target.anchor.z - maxZ) <= 0.001);
    const clamped =
      target &&
      Number.isFinite(minX) &&
      Number.isFinite(maxX) &&
      Number.isFinite(minZ) &&
      Number.isFinite(maxZ) &&
      anchorMoved &&
      onPlacementBoundary &&
      target.anchor.x >= minX - 0.001 &&
      target.anchor.x <= maxX + 0.001 &&
      target.anchor.z >= minZ - 0.001 &&
      target.anchor.z <= maxZ + 0.001;
    return {
      ok: Boolean(clamped),
      reason: 'I11 out-of-range equipment drag was not clamped to placement bounds',
      equipmentId,
      bounds,
      raw,
      constrained,
      beforeAnchor,
      anchor: target?.anchor,
      placementCandidate: canvas?.dataset.placementCandidate,
      placementConstraintState: canvas?.dataset.placementConstraintState,
    };
  }, { equipmentId: ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID, beforeAnchor });
}

async function routeAcceptanceSnapshot(page, routeId) {
  await page
    .locator(`[data-model-object-component-id="${routeId}"]`)
    .first()
    .click({ timeout: 5000 });
  const selected = await selectedComponentEditorDataset(page);
  const route = await routeGeometrySummary(page, routeId);
  const acceptedLength = Number(route?.acceptedLengthM ?? routeLength(route?.points ?? []));
  const bomQuantity = Number(route?.bomQuantity ?? acceptedLength);

  await page
    .locator(`[data-model-object-component-id="${ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID}"]`)
    .first()
    .click({ timeout: 5000 });
  await clickViewportToolbarButton(page, '04-single-floor');
  await selectActiveFloor(page, 2);
  const secondFloor = await routeFloorSummaryOrNull(page, routeId, 'single-floor', 2);
  await selectActiveFloor(page, 1);
  const firstFloor = await routeFloorSummaryOrNull(page, routeId, 'single-floor', 1);
  await clickViewportToolbarButton(page, '05-all-floors');
  const allFloor = await routeGeometrySummary(page, routeId);

  return {
    selectedId: selected.id,
    route,
    firstFloor,
    secondFloor,
    allFloor,
    details: {
      acceptedLength,
      bomQuantity,
      pipeSummaryTotal: Number(route?.routeSummary?.totalLengthM ?? acceptedLength),
    },
  };
}

function validateSecondToFirstFloorRouteSnapshot(snapshot) {
  const route = snapshot.route;
  const points = route?.points ?? [];
  const transitions = route?.crossFloorTransitions ?? [];
  const transition = transitions[0];
  const endpointRefs = route?.endpointRefs ?? {};
  const verticalSegment =
    points.some((point, index) => {
      const previous = points[index - 1];
      return (
        previous &&
        Math.abs(previous.x - point.x) < 0.001 &&
        Math.abs(previous.z - point.z) < 0.001 &&
        Math.abs(previous.y - point.y) > 0.5
      );
    }) &&
    transition &&
    Math.abs(Number(transition.x) - Number(points[transition.startPointIndex]?.x)) < 0.001 &&
    Math.abs(Number(transition.z) - Number(points[transition.startPointIndex]?.z)) < 0.001;
  const lengthConsistent =
    Math.abs(Number(route?.acceptedLengthM ?? 0) - snapshot.details.acceptedLength) <= 0.01 &&
    Math.abs(Number(route?.bomQuantity ?? 0) - snapshot.details.bomQuantity) <= 0.01 &&
    snapshot.details.pipeSummaryTotal + 0.01 >= snapshot.details.acceptedLength;
  const endpointsConnected =
    endpointRefs.from?.equipmentId === ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID &&
    endpointRefs.to?.equipmentId === ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID &&
    endpointRefs.from?.status === 'connected' &&
    endpointRefs.to?.status === 'connected' &&
    endpointRefs.from?.fallbackReason &&
    endpointRefs.to?.fallbackReason;
  const floorMarkers =
    snapshot.secondFloor?.visible &&
    snapshot.firstFloor?.visible &&
    snapshot.secondFloor.riserMarkers?.some((marker) => marker.direction === 'riser-down') &&
    snapshot.firstFloor.riserMarkers?.some((marker) => marker.direction === 'riser-up');
  const ok =
    snapshot.selectedId === SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID &&
    route?.id === SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID &&
    points.length >= 6 &&
    transitions.length === 1 &&
    route.routeSummary?.pointCount === points.length &&
    route.routeSummary?.transitionCount === 1 &&
    verticalSegment &&
    endpointsConnected &&
    floorMarkers &&
    lengthConsistent;
  return {
    ok,
    reason: 'I11 route snapshot failed logical route/geometry/endpoint/summary/BOM assertions',
    componentId: SECOND_TO_FIRST_FLOOR_E2E_ROUTE_ID,
    pointCount: points.length,
    transitions,
    endpointRefs,
    details: snapshot.details,
    firstFloor: snapshot.firstFloor,
    secondFloor: snapshot.secondFloor,
  };
}

function comparableRouteSnapshot(snapshot) {
  const route = snapshot.route;
  return {
    id: route?.id,
    points: roundPoints(route?.points ?? []),
    transitions: (route?.crossFloorTransitions ?? []).map((transition) => ({
      kind: transition.kind,
      fromFloor: transition.fromFloor,
      toFloor: transition.toFloor,
      startPointIndex: transition.startPointIndex,
      endPointIndex: transition.endPointIndex,
      x: roundNumber(transition.x),
      z: roundNumber(transition.z),
    })),
    endpointRefs: {
      from: endpointComparable(route?.endpointRefs?.from),
      to: endpointComparable(route?.endpointRefs?.to),
    },
    acceptedLengthM: roundNumber(route?.acceptedLengthM),
    bomQuantity: roundNumber(route?.bomQuantity),
    detailLength: roundNumber(snapshot.details.acceptedLength),
    detailBomQuantity: roundNumber(snapshot.details.bomQuantity),
    firstFloorMarkers: snapshot.firstFloor?.riserMarkers?.map((marker) => marker.direction) ?? [],
    secondFloorMarkers: snapshot.secondFloor?.riserMarkers?.map((marker) => marker.direction) ?? [],
    allFloorPointCount: snapshot.allFloor?.points?.length ?? 0,
  };
}

function endpointComparable(endpoint) {
  if (!endpoint) return null;
  return {
    equipmentId: endpoint.equipmentId,
    attachmentKind: endpoint.attachmentKind,
    attachmentId: endpoint.attachmentId,
    status: endpoint.status,
    fallbackReason: endpoint.fallbackReason ?? '',
    point: endpoint.point ? roundPoints([endpoint.point])[0] : null,
  };
}

function roundPoints(points) {
  return points.map((point) => ({
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    z: roundNumber(point.z),
  }));
}

function roundNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

async function selectedComponentEditorDataset(page) {
  return page.evaluate(() => {
    const editor = document.querySelector('[data-selected-component-editor="true"]');
    const text = editor?.textContent || '';
    return {
      id: editor?.getAttribute('data-selected-component-id') ?? '',
      type: editor?.getAttribute('data-selected-component-type') ?? '',
      hasPipeFields:
        text.includes('管线名称') &&
        text.includes('管线系统') &&
        text.includes('管径') &&
        text.includes('计算长度') &&
        text.includes('弯曲半径') &&
        text.includes('端点连接') &&
        text.includes('节点连接'),
      hasDuctSizeFields: text.includes('风管宽度') && text.includes('风管高度'),
      hasPipeDiameter: text.includes('管径'),
      hasRouteConnectionFields: text.includes('端点连接') && text.includes('节点连接'),
      hasRouteFields:
        text.includes('管径') ||
        text.includes('风管宽度') ||
        text.includes('风管高度') ||
        text.includes('端点连接') ||
        text.includes('节点连接'),
      hasRawMetadata:
        text.includes('BOM分类') ||
        text.includes('SKU提示') ||
        text.includes('型号/SKU') ||
        text.includes('草稿ID') ||
        text.includes('当前选中构件'),
    };
  });
}

async function saveReloadControlState(page) {
  return page.evaluate(() => {
    const save = document.querySelector('[data-viewer-save-draft="true"]');
    const reload = document.querySelector('[data-viewer-reload-draft="true"]');
    return {
      saveVisible: Boolean(save),
      reloadVisible: Boolean(reload),
      saveDisabled: save?.hasAttribute('disabled') ?? false,
      reloadDisabled: reload?.hasAttribute('disabled') ?? false,
      dirtyState:
        document.querySelector('[data-viewer-dirty-state]')?.getAttribute('data-viewer-dirty-state') ??
        '',
    };
  });
}

async function routeDraftPointCount(page) {
  return page.evaluate(() =>
    Number(document.querySelector('[data-route-draft-controls]')?.getAttribute('data-route-draft-point-count') ?? 0)
  );
}

async function componentAnchor2d(page, componentId) {
  return page
    .waitForFunction(
      (componentId) => {
        const raw = document.querySelector('[data-generated-hvac-viewport] canvas')?.dataset
          .componentAnchors2d;
        if (!raw) return null;
        return JSON.parse(raw).find((item) => item.id === componentId) ?? null;
      },
      componentId,
      { timeout: 8000 }
    )
    .then((handle) => handle.jsonValue());
}

async function inspectRouteDraftAuthoringSmoke(page) {
  await page.goto(`${BASE_URL}/viewer?draftId=${encodeURIComponent(TWO_FLOOR_RISER_DRAFT_ID)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(500);
  const canvas = page.locator('[data-generated-hvac-viewport] canvas').first();
  await selectActiveFloor(page, 2);
  const drawMode = page.locator('[data-pipe-edit-mode="draw-pipe"]').first();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-pipe-edit-mode="draw-pipe"]');
    return button && !button.disabled;
  }, null, { timeout: 10000 });
  await drawMode.click({ timeout: 5000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-generated-hvac-viewport]')
        ?.getAttribute('data-generated-hvac-edit-mode') === 'draw-pipe',
    null,
    { timeout: 5000 }
  );
  await page.waitForSelector('[data-route-draft-controls="true"]', { timeout: 5000 });
  await page.waitForTimeout(500);
  const box = await canvas.boundingBox();
  if (!box) return { ok: false, reason: 'route authoring smoke canvas is missing' };
  const clicks = [
    { x: box.width * 0.42, y: box.height * 0.76 },
    { x: box.width * 0.56, y: box.height * 0.76 },
    { x: box.width * 0.56, y: box.height * 0.66 },
    { x: box.width * 0.68, y: box.height * 0.66 },
  ];
  for (const point of clicks) {
    await dispatchCanvasPointerClick(canvas, point);
    await page.waitForTimeout(120);
  }
  const routeDraftPointCount = await page.evaluate(() =>
    Number(document.querySelector('[data-generated-hvac-viewport] canvas')?.dataset.routeDraftPointCount ?? 0)
  );
  if (routeDraftPointCount < 4) {
    return {
      ok: false,
      reason: `route draft smoke produced too few points: ${routeDraftPointCount}`,
    };
  }
  await page.getByText('Undo point').click();
  await dispatchCanvasPointerClick(canvas, clicks[3]);
  await page.getByText('Finish route').click();
  try {
    await page.waitForFunction(
      (id) =>
        document
          .querySelector('[data-generated-hvac-component-ids]')
          ?.getAttribute('data-generated-hvac-component-ids')
          ?.includes(id),
      ROUTE_AUTHORING_SMOKE_ID,
      { timeout: 8000 }
    );
  } catch {
    return {
      ok: false,
      reason: 'route refresh did not preserve smoke-created route',
      diagnostics: await page.evaluate((id) => {
        const viewport = document.querySelector('[data-generated-hvac-viewport]');
        const canvas = document.querySelector('[data-generated-hvac-viewport] canvas');
        const draftControls = document.querySelector('[data-route-draft-controls="true"]');
        return {
          expectedId: id,
          componentIds: document
            .querySelector('[data-generated-hvac-component-ids]')
            ?.getAttribute('data-generated-hvac-component-ids'),
          routeDraftPointCount: canvas?.dataset.routeDraftPointCount,
          routeDraftLastPoint: canvas?.dataset.routeDraftLastPoint,
          routeSnapStatus: canvas?.dataset.routeSnapStatus,
          draftControlPointCount: draftControls?.getAttribute('data-route-draft-point-count'),
          editMode: viewport?.getAttribute('data-generated-hvac-edit-mode'),
          bodyStatus: document.body.innerText.slice(0, 2000),
        };
      }, ROUTE_AUTHORING_SMOKE_ID),
    };
  }
  await page.locator('[data-pipe-edit-mode="edit-pipe"]').first().click({ timeout: 5000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-generated-hvac-viewport]')
        ?.getAttribute('data-generated-hvac-edit-mode') === 'edit-pipe',
    null,
    { timeout: 5000 }
  );
  const moved = await moveSelectedRoutePointSmoke(page, canvas);
  if (!moved.ok) return moved;
  const inserted = await insertSelectedRoutePointSmoke(page, canvas);
  if (!inserted.ok) return inserted;
  const deleted = await deleteSelectedIntermediateRoutePointSmoke(page, canvas);
  if (!deleted.ok) return deleted;
  const expectedPointCount = deleted.pointCount;
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  const persisted = await page.evaluate((id) => {
    const ids = document
      .querySelector('[data-generated-hvac-component-ids]')
      ?.getAttribute('data-generated-hvac-component-ids');
    return Boolean(ids?.includes(id));
  }, ROUTE_AUTHORING_SMOKE_ID);
  const persistedGeometry = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  if (!persistedGeometry || persistedGeometry.points.length !== expectedPointCount) {
    return {
      ok: false,
      reason: 'route edit smoke geometry was not preserved after refresh',
      componentId: ROUTE_AUTHORING_SMOKE_ID,
      expectedPointCount,
      actualPointCount: persistedGeometry?.points.length ?? 0,
    };
  }
  const connectionSmoke = await inspectRouteConnectionSmoke(page, expectedPointCount);
  if (!connectionSmoke.ok) return connectionSmoke;
  const riserSmoke = await addManualRiserContinuationSmoke(page, canvas);
  if (!riserSmoke.ok) return riserSmoke;
  const quantitySmoke = await inspectAcceptedRouteQuantitySmoke(page);
  if (!quantitySmoke.ok) return quantitySmoke;
  return {
    ok: persisted,
    reason: 'route refresh did not preserve smoke-created route',
    componentId: ROUTE_AUTHORING_SMOKE_ID,
    pointCount: riserSmoke.pointCount,
    connectionSmoke,
    riserSmoke,
    quantitySmoke,
  };
}

async function inspectAcceptedRouteQuantitySmoke(page) {
  const route = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  if (!route?.points?.length) {
    return { ok: false, reason: 'accepted quantity smoke could not read route geometry' };
  }
  const routeTreeNode = page
    .locator(`[data-model-object-component-id="${ROUTE_AUTHORING_SMOKE_ID}"]`)
    .first();
  if ((await routeTreeNode.count()) > 0) {
    await routeTreeNode.click({ timeout: 5000 });
  }
  const acceptedLengthM = routeLength(route.points);
  const selected = await selectedComponentEditorDataset(page);
  const detailLength = Number(route.acceptedLengthM ?? acceptedLengthM);
  const bomQuantity = Number(route.bomQuantity ?? acceptedLengthM);
  const summaryTotal = Number(route.routeSummary?.totalLengthM ?? acceptedLengthM);
  const same =
    selected.id === ROUTE_AUTHORING_SMOKE_ID &&
    Math.abs(detailLength - acceptedLengthM) <= 0.01 &&
    Math.abs(bomQuantity - acceptedLengthM) <= 0.01 &&
    summaryTotal + 0.01 >= acceptedLengthM;
  return {
    ok: same,
    reason: same ? 'accepted route quantity smoke passed' : 'accepted route details and summary length diverged',
    componentId: ROUTE_AUTHORING_SMOKE_ID,
    acceptedLengthM,
    detailLength,
    bomQuantity,
    summaryTotal,
    selected,
  };
}

async function routeComparableSnapshot(page, routeId) {
  const route = await routeGeometrySummary(page, routeId);
  if (!route) return null;
  return {
    id: route.id,
    points: roundPoints(route.points ?? []),
    transitions: (route.crossFloorTransitions ?? []).map((transition) => ({
      kind: transition.kind,
      fromFloor: transition.fromFloor,
      toFloor: transition.toFloor,
      x: roundNumber(transition.x),
      z: roundNumber(transition.z),
    })),
    endpointRefs: {
      from: endpointComparable(route.endpointRefs?.from),
      to: endpointComparable(route.endpointRefs?.to),
    },
    acceptedLengthM: roundNumber(route.acceptedLengthM),
    bomQuantity: roundNumber(route.bomQuantity),
    routeSummary: route.routeSummary,
  };
}

async function inspectCommandHistorySmoke(page) {
  const beforeUndo = await routeComparableSnapshot(page, ROUTE_AUTHORING_SMOKE_ID);
  if (!beforeUndo?.points?.length) {
    return { ok: false, reason: 'command history smoke could not read created route before undo' };
  }
  const undo = page.locator('[data-viewer-history-undo="true"]').first();
  const redo = page.locator('[data-viewer-history-redo="true"]').first();
  const save = page.locator('[data-viewer-save-draft="true"]').first();
  if (!(await undo.isEnabled()) || !(await save.isEnabled())) {
    return { ok: false, reason: 'command history undo/save controls were not enabled after route create' };
  }
  await undo.click({ timeout: 5000 });
  await page.waitForFunction(
    (id) => {
      const raw = document
        .querySelector('[data-generated-hvac-route-geometry-summary]')
        ?.getAttribute('data-generated-hvac-route-geometry-summary');
      const routes = raw ? JSON.parse(raw) : [];
      return !routes.find((route) => route.id === id);
    },
    ROUTE_AUTHORING_SMOKE_ID,
    { timeout: 5000 }
  );
  const saveEnabledAfterUndo = await save.isEnabled();
  if (!(await redo.isEnabled()) || !saveEnabledAfterUndo) {
    return { ok: false, reason: 'command history redo/save controls were not enabled after undo' };
  }
  await redo.click({ timeout: 5000 });
  await page.waitForFunction(
    (id) => {
      const raw = document
        .querySelector('[data-generated-hvac-route-geometry-summary]')
        ?.getAttribute('data-generated-hvac-route-geometry-summary');
      const routes = raw ? JSON.parse(raw) : [];
      return Boolean(routes.find((route) => route.id === id));
    },
    ROUTE_AUTHORING_SMOKE_ID,
    { timeout: 5000 }
  );
  const afterRedo = await routeComparableSnapshot(page, ROUTE_AUTHORING_SMOKE_ID);
  const same = JSON.stringify(afterRedo) === JSON.stringify(beforeUndo);
  return {
    ok: same,
    reason: same
      ? 'command history create undo redo smoke passed'
      : 'command history redo did not restore the accepted route snapshot',
    beforeUndo,
    afterRedo,
    saveEnabledAfterUndo,
  };
}

async function inspectRouteConnectionSmoke(page, expectedPointCount) {
  const before = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  if (
    before?.routeConnectionStatus !== 'connected' ||
    before?.endpointRefs?.from?.equipmentId !== ROUTE_CONNECTION_SMOKE_SOURCE_EQUIPMENT_ID ||
    before?.endpointRefs?.to?.equipmentId !== ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID
  ) {
    return {
      ok: false,
      reason: 'route connection smoke did not preserve endpoint refs after refresh',
      componentId: ROUTE_AUTHORING_SMOKE_ID,
      routeConnectionStatus: before?.routeConnectionStatus,
      endpointRefs: before?.endpointRefs,
    };
  }

  await page.evaluate(
    async ({ draftId, equipmentId }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(draftId)}/components/${encodeURIComponent(equipmentId)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            type: 'equipment',
            systemKey: 'cooling',
            name: '1F utility outdoor unit moved',
            displayName: '1F utility outdoor unit moved',
            elevation: 0.95,
            installHeight: 0.95,
            floor: 1,
            dimensions: { width: 1.8, height: 1.2, depth: 0.9, length: 1.8 },
            position: { x: 4.6, y: 0.95, z: 3.1 },
            geometry: { kind: 'box', x: 4.6, y: 0.95, z: 3.1, width: 1.8, height: 1.2, depth: 0.9 },
            businessMetadata: { floor: 1, installHeight: 0.95, capacityKw: 11.2 },
            bomMetadata: { bomMappable: true, bomCategory: 'hvac-equipment', bomSkuHint: 'VRF_OUTDOOR', quantity: 1, unit: 'set' },
          }),
        }
      );
      if (!response.ok) throw new Error(`route connection equipment move failed: ${response.status}`);
    },
    {
      draftId: TWO_FLOOR_RISER_DRAFT_ID,
      equipmentId: ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID,
    }
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  const after = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  const last = after?.points?.[after.points.length - 1];
  const followed =
    last &&
    Math.abs(last.x - 4.6) < 0.001 &&
    Math.abs(last.y - 0.95) < 0.001 &&
    Math.abs(last.z - 3.1) < 0.001;
  if (
    after?.id !== ROUTE_AUTHORING_SMOKE_ID ||
    after?.points?.length !== expectedPointCount ||
    after?.routeConnectionStatus !== 'connected' ||
    after?.endpointRefs?.to?.status !== 'connected' ||
    !followed
  ) {
    return {
      ok: false,
      reason: 'route connection smoke did not follow moved equipment endpoint after refresh',
      componentId: ROUTE_AUTHORING_SMOKE_ID,
      expectedPointCount,
      routeConnectionStatus: after?.routeConnectionStatus,
      endpointRefs: after?.endpointRefs,
      lastPoint: last,
    };
  }
  return {
    ok: true,
    componentId: ROUTE_AUTHORING_SMOKE_ID,
    movedEquipmentId: ROUTE_CONNECTION_SMOKE_TARGET_EQUIPMENT_ID,
    routeConnectionStatus: after.routeConnectionStatus,
    pointCount: after.points.length,
  };
}

async function addManualRiserContinuationSmoke(page, canvas) {
  const routeTreeNode = page
    .locator(`[data-model-object-component-id="${ROUTE_AUTHORING_SMOKE_ID}"]`)
    .first();
  if ((await routeTreeNode.count()) > 0) {
    await routeTreeNode.click({ timeout: 5000 });
  } else {
    const route = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
    if (!route) return { ok: false, reason: 'manual riser smoke route was not created before continuation' };
  }
  await selectActiveFloor(page, 2);
  await page.locator('[data-pipe-edit-mode="add-riser"]').first().click({ timeout: 5000 });
  const box = await canvas.boundingBox();
  if (!box) return { ok: false, reason: 'manual riser smoke canvas is missing' };
  await dispatchCanvasPointerClick(canvas, { x: box.width * 0.62, y: box.height * 0.68 });
  await page.waitForSelector('[data-route-riser-confirm="true"]', { timeout: 5000 });
  await page.locator('[data-route-riser-confirm="true"] select').selectOption('1');
  await page.getByText('Confirm riser').click();
  await page.waitForSelector('[data-route-draft-controls="true"]', { timeout: 8000 });
  await dispatchCanvasPointerClick(canvas, { x: box.width * 0.72, y: box.height * 0.72 });
  await page.getByText('Finish route').click();
  await page.waitForFunction(
    (id) => {
      const geometry = JSON.parse(
        document
          .querySelector('[data-generated-hvac-route-geometry-summary]')
          ?.getAttribute('data-generated-hvac-route-geometry-summary') || '[]'
      );
      const route = geometry.find((item) => item.id === id);
      return Boolean(
        route &&
          route.points?.some((point, index, points) => {
            const previous = points[index - 1];
            return previous && Math.abs(previous.x - point.x) < 0.001 && Math.abs(previous.z - point.z) < 0.001 && Math.abs(previous.y - point.y) > 0.5;
          })
      );
    },
    ROUTE_AUTHORING_SMOKE_ID,
    { timeout: 8000 }
  );
  const persistedGeometry = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  const verticalSegment = persistedGeometry?.points?.some((point, index, points) => {
    const previous = points[index - 1];
    return previous && Math.abs(previous.x - point.x) < 0.001 && Math.abs(previous.z - point.z) < 0.001 && Math.abs(previous.y - point.y) > 0.5;
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(`[data-generated-hvac-viewport="${TWO_FLOOR_RISER_FIXTURE.model.id}"]`, {
    state: 'attached',
    timeout: 30000,
  });
  const refreshedGeometry = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  const refreshedVerticalSegment = refreshedGeometry?.points?.some((point, index, points) => {
    const previous = points[index - 1];
    return previous && Math.abs(previous.x - point.x) < 0.001 && Math.abs(previous.z - point.z) < 0.001 && Math.abs(previous.y - point.y) > 0.5;
  });
  return {
    ok: Boolean(verticalSegment && refreshedGeometry?.id === ROUTE_AUTHORING_SMOKE_ID && refreshedVerticalSegment),
    reason: 'manual riser continuation did not preserve a constant x/z vertical segment on the same route',
    componentId: ROUTE_AUTHORING_SMOKE_ID,
    pointCount: refreshedGeometry?.points?.length ?? persistedGeometry?.points?.length ?? 0,
  };
}

async function moveSelectedRoutePointSmoke(page, canvas) {
  const points = await waitSelectedRoutePoints2d(page);
  const target = points[Math.min(2, points.length - 2)];
  if (!target) return { ok: false, reason: 'route edit smoke has no intermediate point to move' };
  await dispatchCanvasPointerDrag(canvas, target, { x: target.x + 28, y: target.y - 22 });
  await page.waitForTimeout(800);
  const geometry = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  return {
    ok: Boolean(geometry && geometry.points.length >= 4),
    reason: 'route edit smoke failed to move selected intermediate point',
    pointCount: geometry?.points.length ?? 0,
  };
}

async function insertSelectedRoutePointSmoke(page, canvas) {
  const segments = await waitSelectedRouteSegmentMidpoints2d(page);
  const points = await waitSelectedRoutePoints2d(page);
  const box = await canvas.boundingBox();
  const candidates = segments
    .filter((segment) => !box || (segment.x >= 0 && segment.x <= box.width && segment.y >= 0 && segment.y <= box.height))
    .map((segment) => ({
      ...segment,
      pointClearance: Math.min(
        ...points.map((point) => Math.hypot(point.x - segment.x, point.y - segment.y))
      ),
    }))
    .sort((left, right) => right.pointClearance - left.pointClearance);
  const target = candidates[0] ?? segments[0];
  if (!target) return { ok: false, reason: 'route edit smoke has no segment handle to insert point' };
  const before = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  await dispatchCanvasPointerClick(canvas, target);
  await page.waitForTimeout(800);
  const after = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  const diagnostics = await page.evaluate(() => {
    const canvas = document.querySelector('[data-generated-hvac-viewport] canvas');
    return {
      generatedCanvasCount: document.querySelectorAll('[data-generated-hvac-viewport] canvas').length,
      routeInsertedPointIndex: canvas?.dataset.routeInsertedPointIndex,
      selectedRouteSegmentMidpoints2d: canvas?.dataset.selectedRouteSegmentMidpoints2d,
    };
  });
  return {
    ok: Boolean(before && after && after.points.length > before.points.length),
    reason: 'route edit smoke failed to insert a point on selected segment',
    beforePointCount: before?.points.length ?? 0,
    pointCount: after?.points.length ?? 0,
    diagnostics,
  };
}

async function deleteSelectedIntermediateRoutePointSmoke(page, canvas) {
  await page.locator('[data-pipe-edit-mode="delete"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(300);
  const points = await waitSelectedRoutePoints2d(page);
  const target = points[1];
  if (!target) return { ok: false, reason: 'route edit smoke has no intermediate point to delete' };
  const before = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  await dispatchCanvasPointerClick(canvas, target);
  await page.waitForTimeout(800);
  const after = await routeGeometrySummary(page, ROUTE_AUTHORING_SMOKE_ID);
  return {
    ok: Boolean(before && after && after.points.length === before.points.length - 1 && after.points.length >= 2),
    reason: 'route edit smoke failed to delete an intermediate point',
    pointCount: after?.points.length ?? 0,
  };
}

async function waitSelectedRoutePoints2d(page) {
  return page.waitForFunction(() => {
    const raw = document.querySelector('[data-generated-hvac-viewport] canvas')?.dataset.selectedRoutePoints2d;
    if (!raw) return null;
    const points = JSON.parse(raw);
    return points.length >= 2 ? points : null;
  }, null, { timeout: 8000 }).then((handle) => handle.jsonValue());
}

async function waitSelectedRouteSegmentMidpoints2d(page) {
  return page.waitForFunction(() => {
    const raw = document.querySelector('[data-generated-hvac-viewport] canvas')?.dataset.selectedRouteSegmentMidpoints2d;
    if (!raw) return null;
    const points = JSON.parse(raw);
    return points.length >= 1 ? points : null;
  }, null, { timeout: 8000 }).then((handle) => handle.jsonValue());
}

async function routeGeometrySummary(page, id) {
  return page.evaluate((id) => {
    const raw = document
      .querySelector('[data-generated-hvac-route-geometry-summary]')
      ?.getAttribute('data-generated-hvac-route-geometry-summary');
    const routes = raw ? JSON.parse(raw) : [];
    return routes.find((route) => route.id === id) ?? null;
  }, id);
}

async function selectActiveFloor(page, floor) {
  const value = String(floor);
  await page.locator('[data-active-route-floor-select="true"]').selectOption(value, {
    timeout: 5000,
  });
  await page.evaluate((value) => {
    const select = document.querySelector('[data-active-route-floor-select="true"]');
    if (!(select instanceof HTMLSelectElement)) return;
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForFunction(
    (value) =>
      document
        .querySelector('[data-generated-hvac-viewport]')
        ?.getAttribute('data-generated-hvac-active-floor') === value,
    value,
    { timeout: 5000 }
  );
}

async function routeFloorSummary(page, id, expectedMode, expectedFloor) {
  await page.waitForFunction(
    ({ id, expectedMode, expectedFloor }) => {
      const viewport = document.querySelector('[data-generated-hvac-viewport]');
      const raw = viewport?.getAttribute('data-generated-hvac-floor-route-summary');
      if (
        viewport?.getAttribute('data-generated-hvac-floor-view-mode') !== expectedMode ||
        Number(viewport?.getAttribute('data-generated-hvac-active-floor')) !== expectedFloor ||
        !raw
      ) {
        return false;
      }
      const routes = JSON.parse(raw);
      return Boolean(routes.find((route) => route.id === id));
    },
    { id, expectedMode, expectedFloor },
    { timeout: 5000 }
  );
  return page.evaluate((id) => {
    const raw = document
      .querySelector('[data-generated-hvac-floor-route-summary]')
      ?.getAttribute('data-generated-hvac-floor-route-summary');
    const routes = raw ? JSON.parse(raw) : [];
    return routes.find((route) => route.id === id) ?? null;
  }, id);
}

async function routeFloorSummaryOrNull(page, id, expectedMode, expectedFloor) {
  try {
    return await routeFloorSummary(page, id, expectedMode, expectedFloor);
  } catch {
    return page.evaluate((id) => {
      const viewport = document.querySelector('[data-generated-hvac-viewport]');
      const raw = viewport?.getAttribute('data-generated-hvac-floor-route-summary');
      const routes = raw ? JSON.parse(raw) : [];
      return {
        id,
        missing: true,
        floorViewMode: viewport?.getAttribute('data-generated-hvac-floor-view-mode') ?? null,
        activeFloor: Number(viewport?.getAttribute('data-generated-hvac-active-floor') ?? 0),
        availableRouteIds: routes.map((route) => route.id),
      };
    }, id);
  }
}

async function dispatchCanvasPointerClick(canvas, point) {
  await canvas.evaluate(
    (element, point) => {
      const rect = element.getBoundingClientRect();
      const eventInit = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      };
      element.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, buttons: 1 }));
      element.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, buttons: 0 }));
    },
    point
  );
}

async function dispatchCanvasPointerDrag(canvas, from, to, options = {}) {
  await canvas.evaluate(
    (element, input) => {
      const rect = element.getBoundingClientRect();
      const button = Number(input.options?.button ?? 0);
      const buttons = Number(
        input.options?.buttons ?? (button === 2 ? 2 : button === 1 ? 4 : 1)
      );
      const init = (point, buttons) => ({
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button,
        buttons,
        shiftKey: Boolean(input.options?.shiftKey),
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      });
      element.dispatchEvent(new PointerEvent('pointerdown', init(input.from, buttons)));
      element.dispatchEvent(new PointerEvent('pointermove', init(input.to, buttons)));
      element.dispatchEvent(new PointerEvent('pointerup', init(input.to, 0)));
    },
    { from, to, options }
  );
}

function inspectTwoFloorRiserFixtureData(fixture) {
  const failures = [];
  const components = fixture.model.components;
  const byId = new Map(components.map((component) => [component.id, component]));
  for (const id of fixture.acceptancePath) {
    if (!byId.has(id)) failures.push(`fixture acceptance path is missing ${id}`);
  }
  const [equipment2f, pipe2f, riser, pipe1f, equipment1f] = fixture.acceptancePath.map((id) =>
    byId.get(id)
  );
  if (equipment2f?.type !== 'equipment' || equipment2f.floor !== 2) {
    failures.push('fixture does not start at second-floor equipment');
  }
  if (pipe2f?.type !== 'pipe-route' || pipe2f.floor !== 2) {
    failures.push('fixture second segment is not a second-floor horizontal pipe');
  }
  if (!isVerticalRoute(riser, fixture.expectedVerticalSegment.minDeltaM)) {
    failures.push('fixture vertical riser does not span the expected floor delta');
  }
  if (pipe1f?.type !== 'pipe-route' || pipe1f.floor !== 1) {
    failures.push('fixture fourth segment is not a first-floor horizontal pipe');
  }
  if (equipment1f?.type !== 'equipment' || equipment1f.floor !== 1) {
    failures.push('fixture does not end at first-floor equipment');
  }
  if (!components.some((component) => component.locked)) {
    failures.push('fixture does not preserve a locked component sample');
  }
  return failures;
}

function isVerticalRoute(component, minDeltaM) {
  const points = component?.geometry?.points;
  if (!Array.isArray(points) || points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = Math.abs(Number(first.x) - Number(last.x));
  const dz = Math.abs(Number(first.z) - Number(last.z));
  const dy = Math.abs(Number(first.y) - Number(last.y));
  return component.type === 'pipe-route' && dx < 0.05 && dz < 0.05 && dy >= minDeltaM;
}

function inspectSideElevationRiserVisibility(fixture) {
  const riser = fixture.model.components.find(
    (component) => component.id === fixture.expectedVerticalSegment.componentId
  );
  const points = riser?.geometry?.points;
  if (!Array.isArray(points) || points.length < 2) {
    return { ok: false, reason: 'side/elevation riser check has no route points' };
  }
  const first = points[0];
  const last = points[points.length - 1];
  const verticalDelta = Math.abs(Number(first.y) - Number(last.y));
  const horizontalDrift = Math.hypot(
    Number(first.x) - Number(last.x),
    Number(first.z) - Number(last.z)
  );
  const projectedElevationPixels = verticalDelta * 80;
  return {
    ok: verticalDelta >= fixture.expectedVerticalSegment.minDeltaM && horizontalDrift < 0.05,
    reason: 'side/elevation riser projection is below visibility threshold',
    checkEntry: 'side-elevation-vertical-riser-projection',
    verticalDelta,
    horizontalDrift,
    projectedElevationPixels,
  };
}

async function webglCanvasProbe(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { ok: false, reason: 'generated fixture canvas is missing' };
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { ok: false, reason: 'generated fixture canvas has no WebGL context' };
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width < 220 || height < 220) {
      return { ok: false, reason: 'generated fixture WebGL canvas is too small', width, height };
    }
    const sampleWidth = Math.min(width, 96);
    const sampleHeight = Math.min(height, 96);
    const pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    gl.readPixels(
      Math.max(0, Math.floor((width - sampleWidth) / 2)),
      Math.max(0, Math.floor((height - sampleHeight) / 2)),
      sampleWidth,
      sampleHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    );
    const readPixelsNonBackground = countNonBackgroundPixels(pixels);
    const drawImageNonBackground = sampleCanvasByDrawImage(canvas, sampleWidth, sampleHeight);
    const nonBackground = Math.max(readPixelsNonBackground, drawImageNonBackground);
    return {
      ok: nonBackground > 120,
      reason: `generated fixture WebGL canvas has too few non-background pixels: ${nonBackground}`,
      width,
      height,
      sampleWidth,
      sampleHeight,
      readPixelsNonBackground,
      drawImageNonBackground,
      nonBackground,
    };

    function sampleCanvasByDrawImage(source, targetWidth, targetHeight) {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = targetWidth;
      sampleCanvas.height = targetHeight;
      const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;
      ctx.drawImage(
        source,
        Math.max(0, Math.floor((source.width - targetWidth) / 2)),
        Math.max(0, Math.floor((source.height - targetHeight) / 2)),
        targetWidth,
        targetHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );
      return countNonBackgroundPixels(ctx.getImageData(0, 0, targetWidth, targetHeight).data);
    }

    function countNonBackgroundPixels(data) {
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];
        if (a > 0 && (Math.abs(r - 248) > 18 || Math.abs(g - 250) > 18 || Math.abs(b - 252) > 18)) {
          count += 1;
        }
      }
      return count;
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function writeReport(report) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
}

function renderMarkdown(report) {
  const lines = [
    '# Viewer Acceptance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Base URL: ${report.baseUrl}`,
    '',
    `Evidence dir: ${report.evidenceDir}`,
    '',
    '| Viewport | Result | Failures | Screenshots |',
    '|---|---:|---|---|',
  ];
  for (const result of report.results) {
    const failures = [
      ...(result.consoleErrors ?? []),
      ...(result.failures ?? []),
      ...(result.fixtureInspection?.failures ?? []),
    ];
    const screenshots = result.fixtureInspection?.screenshots ?? [];
    lines.push(
      `| ${result.viewport} | ${result.passed ? 'pass' : 'fail'} | ${
        failures.length ? failures.join('<br>') : 'none'
      } | ${screenshots.join('<br>')} |`
    );
  }
  lines.push('', `JSON: ${REPORT_JSON}`, '');
  return lines.join('\n');
}

function findSystemBrowser() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}
