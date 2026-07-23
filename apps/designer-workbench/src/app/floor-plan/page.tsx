'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { FloorPlanCanvasProps, FloorPlanData } from '../../../components/FloorPlanCanvas';
import HvacParametricLayer from '../../../components/HvacParametricLayer';
import Model3DPreview from '../../../components/Model3DPreview';
import useCalcOnChange from '../../../hooks/useCalcOnChange';
import {
  modelSources,
  viewerDrafts,
  viewerSummaries,
  type GeneratedHvacModel,
  type ViewerDraft,
  type ViewerModelSource,
  type ViewerSummary,
} from '../../lib/api';

const FloorPlanCanvas = dynamic<FloorPlanCanvasProps>(() => import('../../../components/FloorPlanCanvas'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[400px] border rounded bg-white" />,
});

export default function FloorPlanPage() {
  const [data, setData] = useState<FloorPlanData>({ walls: [], rooms: [], pipes: [] });
  const [projectId, setProjectId] = useState('');
  const [queryLoaded, setQueryLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [calcResult, setCalcResult] = useState<any>(null);
  const [show3D, setShow3D] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [summaryId, setSummaryId] = useState('');
  const [modelSourceId, setModelSourceId] = useState('');
  const [viewerSummary, setViewerSummary] = useState<ViewerSummary | null>(null);
  const [modelSource, setModelSource] = useState<ViewerModelSource | null>(null);
  const [handoffStatus, setHandoffStatus] = useState('No persisted viewer context loaded.');
  const [canvasSeed, setCanvasSeed] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('projectId');
    const nextDraftId = params.get('draftId') ?? '';
    const nextSummaryId = params.get('summaryId') ?? '';
    const nextModelSourceId = params.get('modelSourceId') ?? '';
    if (id) setProjectId(id);
    setDraftId(nextDraftId);
    setSummaryId(nextSummaryId);
    setModelSourceId(nextModelSourceId);
    setQueryLoaded(true);

    if (!nextDraftId) {
      setHandoffStatus('Missing draftId. Open this 2D view from a saved viewer draft.');
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
        setProjectId(id || draft.projectId || draft.designProjectId || draft.bimProjectId || nextDraftId);
        setViewerSummary(summary);
        setModelSource(source);
        setData(floorPlanFromViewerContext(draft, summary));
        setCanvasSeed((value) => value + 1);
        setHandoffStatus(handoffStatusFor(draft, summary, source));
      })
      .catch((err: any) => {
        if (cancelled) return;
        setHandoffStatus(`Persisted viewer context failed to load: ${err?.message ?? err}`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const systems = Array.from(new Set((data.devices ?? []).map((d: any) => d.systemType).filter(Boolean))) as string[];

  useCalcOnChange(
    {
      projectId: projectId || 'unspecified',
      systems,
      floorPlan: data,
      hvac: data.pipes,
      devices: data.devices,
    },
    {
      delayMs: 2000,
      onResult: (r) => setCalcResult(r),
      onError: (e) => console.error('[calc-on-change]', e),
    },
  );

  const save = async () => {
    if (!projectId) {
      setStatus('请先输入 projectId');
      return;
    }
    setStatus('保存中…');
    try {
      const res = await fetch('/api/v2/design/floor-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, floorPlan: data, hvac: data.pipes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('保存成功');
    } catch (err: any) {
      setStatus(`保存失败：${err?.message ?? err}`);
    }
  };

  const load = async () => {
    if (!projectId) {
      setStatus('请先输入 projectId');
      return;
    }
    setStatus('加载中…');
    try {
      const res = await fetch(`/api/v2/design/projects/${projectId}/floor-plan`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json?.data?.floorPlan ?? { walls: [], rooms: [], pipes: [] });
      setStatus('加载成功');
    } catch (err: any) {
      setStatus(`加载失败：${err?.message ?? err}`);
    }
  };

  return (
    <main className="h-screen w-screen flex flex-col p-4 gap-2">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Rysnova Floor Plan · W-BIM-4</h1>
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="projectId"
          className="border rounded px-2 py-1 text-sm"
        />
        <button onClick={save} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          保存
        </button>
        <button onClick={load} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          加载
        </button>
        <button
          onClick={() => setShow3D((s) => !s)}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-200"
        >
          {show3D ? '关闭 3D' : '3D 预览'}
        </button>
        <span className="text-sm text-gray-700">{status}</span>
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
      </div>
      <div className="rounded border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-950">
        <div className="font-semibold">Database context</div>
        <div className="mt-1 grid grid-cols-4 gap-2 break-all">
          <span>draftId: {draftId || 'missing'}</span>
          <span>summaryId: {(viewerSummary?.id ?? summaryId) || 'missing'}</span>
          <span>modelSourceId: {(modelSource?.id ?? modelSourceId) || 'optional'}</span>
          <span>projectId: {projectId || 'unspecified'}</span>
        </div>
        <div className="mt-1 text-cyan-800">{handoffStatus}</div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <div className="flex-1 min-h-0 flex gap-2">
          <div className="flex-1 min-h-0">
            <FloorPlanCanvas key={`floor-plan-${canvasSeed}`} initialData={data} onChange={setData} />
          </div>
          <div className="w-80 flex-shrink-0 flex flex-col gap-2">
          <HvacParametricLayer key={`pipes-${canvasSeed}`} segments={data.pipes ?? []} onChange={(p) => setData({ ...data, pipes: p })} />
            <div className="p-2 bg-gray-50 rounded text-sm">
              <div className="font-semibold">3.6 · 边画边算</div>
              <div className="text-xs text-gray-600">
                {calcResult ? `最新报价: ${JSON.stringify(calcResult?.total ?? calcResult).slice(0, 120)}` : '等待改动触发重算…'}
              </div>
              <div className="mt-1 text-xs">
                <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" />
                信任状态: estimate（需重审后 verified）
              </div>
            </div>
          </div>
        </div>
        {show3D && (
          <div className="h-80 flex-shrink-0 border rounded p-2 bg-white">
            <div className="text-xs text-gray-500 mb-1">3.3 · 3D 可视化占位</div>
            <Model3DPreview data={data} />
          </div>
        )}
      </div>
    </main>
  );
}

function floorPlanFromViewerContext(
  draft: ViewerDraft,
  summary: ViewerSummary | null
): FloorPlanData {
  const building = asRecord(draft.buildingInputs);
  const model = generatedModelFrom(draft.generatedModel);
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
  const walls = [
    { id: 'handoff-wall-north', points: [80, 80, 80 + width, 80], thickness: 20 },
    { id: 'handoff-wall-east', points: [80 + width, 80, 80 + width, 80 + depth], thickness: 20 },
    { id: 'handoff-wall-south', points: [80 + width, 80 + depth, 80, 80 + depth], thickness: 20 },
    { id: 'handoff-wall-west', points: [80, 80 + depth, 80, 80], thickness: 20 },
  ];

  return {
    walls,
    rooms,
    pipes: pipesFromGeneratedModel(model),
    devices: devicesFromSummary(summary),
  };
}

function devicesFromSummary(summary: ViewerSummary | null): FloorPlanData['devices'] {
  const rows = equipmentRows(summary);
  return rows.map((row, index) => ({
    id: String(row.linkedComponentId ?? row.id ?? `handoff-device-${index + 1}`),
    systemType: systemTypeFromSummary(row.systemKey),
    name: String(row.name ?? row.systemKey ?? 'Equipment'),
    x: 140 + index * 110,
    y: 130,
    assetRef: row.linkedComponentId ? String(row.linkedComponentId) : undefined,
  }));
}

function pipesFromGeneratedModel(model: GeneratedHvacModel | null): FloorPlanData['pipes'] {
  return (model?.components ?? [])
    .filter((component) => component.type === 'pipe-route')
    .map((component, index) => {
      const geometry = asRecord(component.geometry);
      const points = Array.isArray(geometry.points) ? geometry.points.map(asRecord) : [];
      const start = points[0] ?? {};
      const end = points[points.length - 1] ?? {};
      return {
        id: component.id || `handoff-pipe-${index + 1}`,
        start: pointFromModel(start),
        end: pointFromModel(end),
        diameterMm: positive(geometry.diameterMm, 32),
        wallThicknessMm: 2.3,
        insulationThicknessMm: 10,
        material: component.systemKey === 'freshAir' ? 'Duct' : 'PPR',
        hasHanger: true,
        hangerSpacingMm: component.systemKey === 'freshAir' ? 1200 : 800,
      };
    });
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

function generatedModelFrom(value: unknown): GeneratedHvacModel | null {
  if (!value || typeof value !== 'object') return null;
  const model = value as GeneratedHvacModel;
  return Array.isArray(model.components) ? model : null;
}

function pointFromModel(point: Record<string, unknown>) {
  return {
    x: 800 + numberValue(point.x, 0) * 80,
    y: 600 + numberValue(point.z, 0) * 80,
    z: numberValue(point.y, 0) * 1000,
  };
}

function systemTypeFromSummary(systemKey: unknown): string {
  if (systemKey === 'cooling') return 'ac';
  if (systemKey === 'heating') return 'heating';
  if (systemKey === 'freshAir') return 'freshAir';
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
