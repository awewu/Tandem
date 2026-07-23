'use client';

import { useEffect, useState } from 'react';
import BomSheet from '../../../components/BomSheet';
import DrawingSheet from '../../../components/DrawingSheet';
import SystemModel, { type Device, type SystemModelData } from '../../../components/SystemModel';
import HvacParametricLayer, { PipeSegment } from '../../../components/HvacParametricLayer';
import dynamic from 'next/dynamic';
import type { FloorPlanCanvasProps, FloorPlanData } from '../../../components/FloorPlanCanvas';
import {
  modelSources,
  quotation,
  viewerDrafts,
  viewerSummaries,
  type GeneratedHvacModel,
  type ViewerDraft,
  type ViewerModelSource,
  type ViewerSummary,
} from '../../lib/api';

const FloorPlanCanvas = dynamic<FloorPlanCanvasProps>(() => import('../../../components/FloorPlanCanvas'), {
  ssr: false,
  loading: () => <div className="min-h-[400px] border rounded bg-white" />,
});

export default function BomPage() {
  const [floorPlan, setFloorPlan] = useState<FloorPlanData>({ walls: [], rooms: [] });
  const [pipes, setPipes] = useState<PipeSegment[]>([]);
  const [systems, setSystems] = useState<SystemModelData>({ devices: [] });
  const [projectId, setProjectId] = useState('demo-project');
  const [priceBands, setPriceBands] = useState<any>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [handoffMode, setHandoffMode] = useState<'bom' | 'quote'>('bom');
  const [draftId, setDraftId] = useState('');
  const [summaryId, setSummaryId] = useState('');
  const [modelSourceId, setModelSourceId] = useState('');
  const [viewerDraft, setViewerDraft] = useState<ViewerDraft | null>(null);
  const [viewerSummary, setViewerSummary] = useState<ViewerSummary | null>(null);
  const [modelSource, setModelSource] = useState<ViewerModelSource | null>(null);
  const [handoffStatus, setHandoffStatus] = useState('No persisted viewer context loaded.');
  const [quoteStatus, setQuoteStatus] = useState('Quote preview has not been generated.');
  const [quoteSummary, setQuoteSummary] = useState<any>(null);
  const [canvasSeed, setCanvasSeed] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get('handoff') === 'quote' ? 'quote' : 'bom';
    const nextDraftId = params.get('draftId') ?? '';
    const nextSummaryId = params.get('summaryId') ?? '';
    const nextModelSourceId = params.get('modelSourceId') ?? '';
    const nextProjectId = params.get('projectId') ?? '';
    setHandoffMode(nextMode);
    setDraftId(nextDraftId);
    setSummaryId(nextSummaryId);
    setModelSourceId(nextModelSourceId);
    if (nextProjectId) setProjectId(nextProjectId);

    if (!nextDraftId) {
      setHandoffStatus('Missing draftId. Open this BOM or quote view from a saved viewer draft.');
      return;
    }

    let cancelled = false;
    setHandoffStatus('Loading persisted viewer draft, summary and model context from v2 APIs...');
    Promise.all([
      viewerDrafts.get(nextDraftId),
      nextSummaryId ? viewerSummaries.get(nextSummaryId) : viewerSummaries.latest(nextDraftId),
      nextModelSourceId ? modelSources.get(nextModelSourceId) : Promise.resolve(null),
    ])
      .then(([draft, summary, source]) => {
        if (cancelled) return;
        const model = generatedModelFrom(draft.generatedModel);
        const nextPipes = pipesFromGeneratedModel(model, summary);
        const nextDevices = devicesFromSummary(summary);
        const nextFloorPlan = floorPlanFromViewerContext(draft, summary);
        setViewerDraft(draft);
        setViewerSummary(summary);
        setModelSource(source);
        setProjectId(nextProjectId || draft.projectId || draft.designProjectId || draft.bimProjectId || nextDraftId);
        setFloorPlan({ ...nextFloorPlan, pipes: nextPipes, devices: placedDevicesFromDevices(nextDevices) });
        setPipes(nextPipes);
        setSystems({ devices: nextDevices });
        setCanvasSeed((value) => value + 1);
        setHandoffStatus(handoffStatusFor(draft, summary, source));
        setQuoteStatus(
          nextMode === 'quote'
            ? 'Quote payload is ready from persisted viewer context.'
            : 'BOM payload is ready from persisted viewer context.'
        );
      })
      .catch((err: any) => {
        if (cancelled) return;
        setHandoffStatus(`Persisted viewer context failed to load: ${err?.message ?? err}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPriceBands = async () => {
    setLoadingPrice(true);
    try {
      const res = await fetch(`/api/v2/design/projects/${projectId}/bom-price`, { credentials: 'include' });
      const json = await res.json();
      setPriceBands(json);
    } catch (err: any) {
      setPriceBands({ error: err.message });
    } finally {
      setLoadingPrice(false);
    }
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch(`/api/v2/design/projects/${projectId}/export-pdf`, { credentials: 'include' });
      if (!res.ok) throw new Error(`导出失败: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOM_${projectId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message ?? 'PDF 导出失败');
    } finally {
      setExportingPdf(false);
    }
  };

  const generateQuotePreview = async () => {
    if (!viewerDraft || !viewerSummary) {
      setQuoteStatus('Missing persisted draft or summary. Save the viewer draft and summary first.');
      return;
    }
    setQuoteStatus('Generating quote preview from persisted viewer context...');
    try {
      const generated = await quotation.generate(
        quotePayloadFromContext(viewerDraft, viewerSummary, systems.devices, pipes)
      );
      setQuoteSummary(generated);
      setQuoteStatus('Quote preview generated from v2 quotation API.');
    } catch (err: any) {
      setQuoteStatus(`Quote preview failed: ${err?.message ?? err}`);
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col p-4 gap-2 overflow-auto">
      <h1 className="text-lg font-semibold">3.5 · 出图与清单</h1>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
        <span className="text-sm text-gray-500">工程图 + BOM</span>
        {draftId && (
          <a
            href={viewerReturnHref(
              draftId,
              viewerSummary?.id ?? summaryId,
              modelSource?.id ?? modelSourceId,
              projectId
            )}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-200"
          >
            Back to viewer
          </a>
        )}
        <button
          onClick={exportPdf}
          disabled={exportingPdf}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-200 print:hidden disabled:opacity-50"
        >
          {exportingPdf ? '生成 PDF…' : '导出 PDF'}
        </button>
        <button
          onClick={fetchPriceBands}
          disabled={loadingPrice}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-200 print:hidden"
        >
          {loadingPrice ? '加载价格…' : '3.5 · 价格带'}
        </button>
        <button
          onClick={generateQuotePreview}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-200 print:hidden"
        >
          Generate quote preview
        </button>
      </div>
      <div className="rounded border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-950">
        <div className="font-semibold">Database context</div>
        <div className="mt-1 grid grid-cols-5 gap-2 break-all">
          <span>mode: {handoffMode}</span>
          <span>draftId: {draftId || 'missing'}</span>
          <span>summaryId: {(viewerSummary?.id ?? summaryId) || 'missing'}</span>
          <span>modelSourceId: {(modelSource?.id ?? modelSourceId) || 'optional'}</span>
          <span>projectId: {projectId || 'unspecified'}</span>
        </div>
        <div className="mt-1 text-cyan-800">{handoffStatus}</div>
        <div className="mt-1 text-cyan-800">{quoteStatus}</div>
      </div>
      {priceBands && (
        <div className="text-sm bg-gray-50 rounded p-2">
          <div className="font-semibold">产品目录价格带</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(priceBands, null, 2)}</pre>
        </div>
      )}
      {handoffMode === 'quote' && (
        <div className="text-sm bg-gray-50 rounded p-2">
          <div className="font-semibold">Quote payload preview</div>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(
              quoteSummary ?? quotePayloadFromContext(viewerDraft, viewerSummary, systems.devices, pipes),
              null,
              2
            )}
          </pre>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-semibold mb-1">工程图</h2>
          <DrawingSheet title="HVAC 平面图" projectId={projectId} floorPlan={floorPlan} scale={3} />
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-1">BOM</h2>
          <BomSheet devices={systems.devices} pipes={pipes} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <h2 className="text-sm font-semibold mb-1">户型</h2>
          <FloorPlanCanvas key={`floor-plan-${canvasSeed}`} initialData={floorPlan} onChange={setFloorPlan} />
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-1">管线</h2>
          <HvacParametricLayer key={`pipes-${canvasSeed}`} segments={pipes} onChange={setPipes} />
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-1">系统</h2>
          <SystemModel data={systems} onChange={setSystems} />
        </div>
      </div>
    </main>
  );
}

function floorPlanFromViewerContext(
  draft: ViewerDraft,
  summary: ViewerSummary | null
): FloorPlanData {
  const building = asRecord(draft.buildingInputs);
  const area = positive(building.area, 180);
  const roomCount = Math.max(1, Math.round(positive(building.roomCount, 6)));
  const width = Math.max(500, Math.round(Math.sqrt(area) * 95));
  const depth = Math.max(360, Math.round((area / Math.max(1, Math.sqrt(area))) * 80));
  const cols = Math.ceil(Math.sqrt(roomCount));
  const rows = Math.ceil(roomCount / cols);
  const roomW = width / cols;
  const roomH = depth / rows;
  const rooms = Array.from({ length: roomCount }, (_, index) => ({
    id: `handoff-room-${index + 1}`,
    x: 80 + (index % cols) * roomW,
    y: 80 + Math.floor(index / cols) * roomH,
    width: Math.max(120, roomW - 8),
    height: Math.max(100, roomH - 8),
    name: `Room ${index + 1}`,
  }));
  return {
    walls: [
      { id: 'handoff-wall-north', points: [80, 80, 80 + width, 80], thickness: 20 },
      { id: 'handoff-wall-east', points: [80 + width, 80, 80 + width, 80 + depth], thickness: 20 },
      { id: 'handoff-wall-south', points: [80 + width, 80 + depth, 80, 80 + depth], thickness: 20 },
      { id: 'handoff-wall-west', points: [80, 80 + depth, 80, 80], thickness: 20 },
    ],
    rooms,
    pipes: pipesFromGeneratedModel(generatedModelFrom(draft.generatedModel), summary),
    devices: placedDevicesFromDevices(devicesFromSummary(summary)),
  };
}

function devicesFromSummary(summary: ViewerSummary | null): Device[] {
  const rows = equipmentRows(summary);
  const modelComponentIds = new Set(
    rows
      .filter((row) => row.source === 'model-component' && row.linkedComponentId)
      .map((row) => String(row.linkedComponentId))
  );
  return rows
    .filter((row) => !modelComponentIds.has(String(row.linkedComponentId ?? '')) || row.source === 'model-component')
    .map((row, index) => {
      const bomMetadata = asRecord(row.bomMetadata);
      const businessMetadata = asRecord(row.businessMetadata);
      const dimensions = asRecord(row.dimensions);
      const quantity = positive(row.quantity ?? bomMetadata.quantity ?? businessMetadata.quantity, 1);
      const unit = stringValue(row.unit ?? bomMetadata.unit ?? businessMetadata.unit, '台');
      const bomSkuHint = stringValue(
        bomMetadata.bomSkuHint ?? businessMetadata.bomSkuHint ?? businessMetadata.modelSku,
        ''
      );
      const productAssetRef = stringValue(bomSkuHint || row.linkedComponentId, '');
      const params: Device['params'] = {
        quantity,
        unit,
        loadKw: positive(row.loadKw, 0),
      };
      const bomCategory = stringValue(bomMetadata.bomCategory ?? businessMetadata.bomCategory, '');
      if (bomCategory) params.bomCategory = bomCategory;
      if (bomSkuHint) params.bomSkuHint = bomSkuHint;
      if (row.linkedComponentId) params.linkedComponentId = String(row.linkedComponentId);
      if (row.linkedModelId) params.linkedModelId = String(row.linkedModelId);
      if (row.linkedModelVersion) params.linkedModelVersion = positive(row.linkedModelVersion, 0);
      if (row.componentVersion) params.componentVersion = positive(row.componentVersion, 0);
      if (row.source) params.source = String(row.source);
      if (dimensions.length) params.lengthM = positive(dimensions.length, 0);
      if (dimensions.width) params.widthM = positive(dimensions.width, 0);
      if (dimensions.height) params.heightM = positive(dimensions.height, 0);
      if (businessMetadata.capacityKw) params.capacityKw = positive(businessMetadata.capacityKw, 0);

      return {
        id: String(row.linkedComponentId ?? row.id ?? `handoff-device-${index + 1}`),
        name: String(row.name ?? row.systemKey ?? 'Equipment'),
        systemType: systemTypeFromSummary(row.systemKey),
        productAssetRef: productAssetRef || undefined,
        bimFamilyId: row.id ? String(row.id) : undefined,
        position: { x: index * 120, y: 0, z: 0 },
        params,
      };
    });
}

function placedDevicesFromDevices(devices: Device[]): FloorPlanData['devices'] {
  return devices.map((device, index) => ({
    id: device.id,
    systemType: device.systemType,
    name: device.name,
    x: 140 + index * 110,
    y: 130,
    assetRef: device.productAssetRef,
  }));
}

function pipesFromGeneratedModel(
  model: GeneratedHvacModel | null,
  summary: ViewerSummary | null
): PipeSegment[] {
  const generated = (model?.components ?? [])
    .filter(
      (component) =>
        component.status !== 'deleted' &&
        (component.type === 'pipe-route' || component.type === 'duct-route')
    )
    .map((component, index) => {
      const geometry = asRecord(component.geometry);
      const dimensions = asRecord(component.dimensions);
      const businessMetadata = asRecord(component.businessMetadata);
      const bomMetadata = asRecord(component.bomMetadata);
      const points = Array.isArray(geometry.points) ? geometry.points.map(asRecord) : [];
      const lengthM = acceptedRouteLengthM(component);
      const start = points[0] ?? {};
      const end = points[points.length - 1] ?? (lengthM ? { x: lengthM, y: 0, z: 0 } : {});
      return {
        id: component.id || `handoff-pipe-${index + 1}`,
        start: pointFromModel(start),
        end: pointFromModel(end),
        acceptedLengthM: lengthM,
        diameterMm: positive(dimensions.diameterMm ?? geometry.diameterMm ?? dimensions.width ?? geometry.width, 32),
        wallThicknessMm: 2.3,
        insulationThicknessMm: positive(
          businessMetadata.insulationMm ?? bomMetadata.insulationMm ?? dimensions.insulationMm,
          10
        ),
        material: stringValue(
          businessMetadata.material ?? bomMetadata.material,
          component.systemKey === 'freshAir' ? 'Duct' : 'PPR'
        ),
        hasHanger: true,
        hangerSpacingMm: component.systemKey === 'freshAir' ? 1200 : 800,
      };
    });
  if (generated.length) return generated;

  const pipeSummary = asRecord(summary?.pipeSummary);
  const routeCount = Math.max(0, Math.round(positive(pipeSummary.routeCount, 0)));
  const totalLengthM = positive(pipeSummary.totalLengthM, 0);
  if (!routeCount || !totalLengthM) return [];
  const lengthMm = Math.max(1000, (totalLengthM * 1000) / routeCount);
  return Array.from({ length: routeCount }, (_, index) => ({
    id: `summary-pipe-${index + 1}`,
    start: { x: 0, y: index * 300, z: 0 },
    end: { x: lengthMm, y: index * 300, z: 0 },
    diameterMm: 32,
    wallThicknessMm: 2.3,
    insulationThicknessMm: 10,
    material: 'PPR',
    hasHanger: true,
    hangerSpacingMm: 800,
  }));
}

function quotePayloadFromContext(
  draft: ViewerDraft | null,
  summary: ViewerSummary | null,
  devices: Device[],
  pipes: PipeSegment[]
) {
  const pipeRoutes = pipeRows(summary);
  return {
    design: {
      draftId: draft?.id ?? null,
      draftVersion: draft?.version ?? null,
      summaryId: summary?.id ?? null,
      projectId: draft?.projectId ?? summary?.projectId ?? null,
      designProjectId: draft?.designProjectId ?? summary?.designProjectId ?? null,
      bimProjectId: draft?.bimProjectId ?? summary?.bimProjectId ?? null,
      projectInputs: draft?.projectInputs ?? {},
      buildingInputs: draft?.buildingInputs ?? {},
      calculationSummary: summary?.calculationSummary ?? {},
    },
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      systemType: device.systemType,
      quantity: positive(device.params?.quantity, 1),
      unit: stringValue(device.params?.unit, '台'),
      assetRef: device.productAssetRef ?? null,
      loadKw: positive(device.params?.loadKw, 0),
      componentRef: stringValue(device.params?.linkedComponentId, device.id),
      bomCategory: stringValue(device.params?.bomCategory, ''),
      bomSkuHint: stringValue(device.params?.bomSkuHint, ''),
      source: stringValue(device.params?.source, 'summary'),
    })),
    services: {
      source: 'viewer-database-handoff',
      summaryId: summary?.id ?? null,
      equipmentSummary: summary?.equipmentSummary ?? {},
      calculationSummary: summary?.calculationSummary ?? {},
      pipeSummary: summary?.pipeSummary ?? {},
      pipeCount: pipes.length,
      componentBomRollup: equipmentRows(summary).map((row) => ({
        id: row.id ?? null,
        name: row.name ?? null,
        componentRef: row.linkedComponentId ?? null,
        modelRef: row.linkedModelId ?? null,
        modelVersion: row.linkedModelVersion ?? null,
        source: row.source ?? 'summary',
        quantity: positive(row.quantity, 1),
        unit: stringValue(row.unit, '台'),
        dimensions: asRecord(row.dimensions),
        bomMetadata: asRecord(row.bomMetadata),
        businessMetadata: asRecord(row.businessMetadata),
      })),
      componentPipeRollup: pipeRoutes.map((route) => ({
        id: route.id ?? null,
        name: route.name ?? null,
        componentRef: route.linkedComponentId ?? null,
        systemKey: route.systemKey ?? null,
        type: route.type ?? null,
        lengthM: positive(route.lengthM, 0),
        material: stringValue(route.material, ''),
        diameterMm: positive(route.diameterMm, 0),
        insulationMm: positive(route.insulationMm, 0),
        bomMetadata: asRecord(route.bomMetadata),
        businessMetadata: asRecord(route.businessMetadata),
      })),
    },
  };
}

function handoffStatusFor(
  draft: ViewerDraft,
  summary: ViewerSummary | null,
  source: ViewerModelSource | null
): string {
  const staleSummary =
    summary?.draftVersion && draft.version && Number(summary.draftVersion) < Number(draft.version);
  const parts = [
    `Loaded draft v${draft.version}`,
    summary ? `summary ${summary.trustStatus}` : 'summary missing',
    source ? `model source ${source.loadStatus}/${source.recordStatus}` : 'model source optional',
  ];
  if (staleSummary) parts.push('summary may be stale against the current draft version');
  return parts.join(' / ');
}

function equipmentRows(summary: ViewerSummary | null): Array<Record<string, any>> {
  const value = asRecord(summary?.equipmentSummary).rows;
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function pipeRows(summary: ViewerSummary | null): Array<Record<string, any>> {
  const value = asRecord(summary?.pipeSummary).routes;
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function acceptedRouteLengthM(component: Record<string, any>): number {
  const route = asRecord(component.route);
  const geometry = asRecord(component.geometry);
  const dimensions = asRecord(component.dimensions);
  const businessMetadata = asRecord(component.businessMetadata);
  const bomMetadata = asRecord(component.bomMetadata);
  const geometryLength = routeLengthFromPoints(geometry.points);
  if (geometryLength > 0) return geometryLength;
  const routePoints = Array.isArray(route.points) ? route.points : null;
  const routePointLength = routePoints ? routeLengthFromPoints(routePoints) : 0;
  if (routePointLength > 0) return routePointLength;
  return positive(
    asRecord(route.summary).totalLengthM ??
      bomMetadata.estimatedLengthM ??
      dimensions.estimatedLengthM ??
      businessMetadata.estimatedLengthM,
    0
  );
}

function routeLengthFromPoints(value: unknown): number {
  if (!Array.isArray(value) || value.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < value.length; index += 1) {
    const a = asRecord(value[index - 1]);
    const b = asRecord(value[index]);
    total += Math.hypot(
      numberValue(b.x, 0) - numberValue(a.x, 0),
      numberValue(b.y, 0) - numberValue(a.y, 0),
      numberValue(b.z, 0) - numberValue(a.z, 0)
    );
  }
  return Number(total.toFixed(2));
}

function generatedModelFrom(value: unknown): GeneratedHvacModel | null {
  if (!value || typeof value !== 'object') return null;
  const model = value as GeneratedHvacModel;
  return Array.isArray(model.components) ? model : null;
}

function pointFromModel(point: Record<string, unknown>) {
  return {
    x: numberValue(point.x, 0) * 1000,
    y: numberValue(point.z, 0) * 1000,
    z: numberValue(point.y, 0) * 1000,
  };
}

function systemTypeFromSummary(systemKey: unknown): Device['systemType'] {
  if (systemKey === 'cooling') return 'ac';
  if (systemKey === 'heating') return 'heating';
  if (systemKey === 'freshAir') return 'freshAir';
  if (systemKey === 'water') return 'water';
  if (systemKey === 'smartControl') return 'electric';
  return 'freshAir';
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function viewerReturnHref(
  draftId: string,
  summaryId: string,
  modelSourceId: string,
  projectId: string
): string {
  const q = new URLSearchParams();
  q.set('draftId', draftId);
  if (summaryId) q.set('summaryId', summaryId);
  if (modelSourceId) q.set('modelSourceId', modelSourceId);
  if (projectId) q.set('projectId', projectId);
  return `/viewer?${q.toString()}`;
}

function stringValue(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}
