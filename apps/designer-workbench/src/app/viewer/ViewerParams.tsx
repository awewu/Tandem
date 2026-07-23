'use client';

import type { DragEvent, FocusEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BimViewer, { BimModelLoadEvent } from '@rhautt/bim-viewer';
import {
  apiFetch,
  modelSources,
  viewerComponentCatalog,
  viewerDrafts,
  viewerSummaries,
  GeneratedHvacComponent,
  GeneratedHvacComponentPayload,
  GeneratedHvacModel,
  LegacyDesigner2dProject,
  ViewerComponentCatalog,
  ViewerComponentCatalogTemplate,
  ViewerDraft,
  ViewerDraftPayload,
  ViewerModelSource,
  ViewerModelSourcePayload,
  ViewerSummary,
} from '../../lib/api';
import GeneratedHvacViewport, {
  GeneratedVisibility,
  PipeEditMode,
  PipePoint,
  ViewerInteractionState,
} from './GeneratedHvacViewport';
import {
  buildLogicalRouteShapeFromDraft,
  componentPayloadFromCatalogTemplate,
  installHeightFromElevation,
  parseTemplateDropId,
  placementElevationFrom,
  routeDraftCanFinish,
} from './viewer-component-placement';
import type { CatalogTemplateDefaultOverrides, RouteEndpointRefs } from './viewer-component-placement';
import type { RouteFloorViewMode } from './viewer-route-geometry';
import { buildViewerDesignSummary, selectViewerSummaryModel } from './viewer-summary';
import {
  clearViewerCommandHistory,
  createViewerCommandHistory,
  markViewerHistoryClean,
  recordViewerCommand,
  redoViewerCommand,
  snapshotViewerEditableState,
  undoViewerCommand,
  viewerHistoryCanRedo,
  viewerHistoryCanUndo,
  viewerHistoryIsDirty,
  viewerHistoryShortcutFromEvent,
  viewerSnapshotsEqual,
} from './viewer-command-history';
import type {
  ViewerCommandKind,
  ViewerEditableSnapshot,
} from './viewer-command-history';

type ProjectInputs = {
  name: string;
  city: string;
  outsidePlacementMarginM?: number;
};

type BuildingInputs = {
  area: number;
  floors: number;
  floorHeight: number;
  roomCount: number;
};

type SystemInputs = {
  coolingSystem: string;
  heatingSystem: string;
};

type SelectOption = { value: string; label: string };

const DEFAULT_PROJECT: ProjectInputs = { name: '上海浦东三居项目', city: '上海' };
const DEFAULT_BUILDING: BuildingInputs = { area: 180, floors: 2, floorHeight: 3, roomCount: 6 };
const DEFAULT_SYSTEMS: SystemInputs = {
  coolingSystem: 'VRF + fresh air',
  heatingSystem: 'Radiant floor heating',
};
const COOLING_OPTIONS: SelectOption[] = [
  { value: 'VRF + fresh air', label: 'VRF多联机 + 新风' },
  { value: 'Air source heat pump', label: '空气源热泵' },
  { value: 'Chilled water fan coil', label: '冷水风机盘管' },
  { value: 'Ducted split system', label: '风管机系统' },
];
const HEATING_OPTIONS: SelectOption[] = [
  { value: 'Radiant floor heating', label: '地暖' },
  { value: 'Radiators', label: '散热器' },
  { value: 'Air source heat pump', label: '空气源热泵' },
  { value: 'No heating', label: '无采暖' },
];
const PIPE_SYSTEM_OPTIONS: SelectOption[] = [
  { value: 'cooling', label: '制冷管线' },
  { value: 'heating', label: '采暖管线' },
  { value: 'freshAir', label: '新风管线' },
  { value: 'water', label: '水/冷凝水管线' },
];
const DEFAULT_VISIBILITY: GeneratedVisibility = {
  cooling: true,
  heating: true,
  freshAir: true,
  pipes: true,
  equipment: true,
};
const DEFAULT_PIPE_EDITOR = {
  systemKey: 'cooling',
  name: '手动制冷管线',
  diameterMm: 32,
  startX: -2,
  startY: 0.95,
  startZ: -2,
  endX: 2,
  endY: 0.95,
  endZ: 2,
  bendRadiusMm: 0,
  estimatedLengthM: 6,
};

type ComponentEditor = {
  name: string;
  systemKey: string;
  status: 'active' | 'deleted';
  visible: boolean;
  locked: boolean;
  floor: number;
  x: number;
  y: number;
  z: number;
  elevation: number;
  installHeight: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  width: number;
  height: number;
  depth: number;
  length: number;
  thickness: number;
  diameterMm: number;
  bendRadiusMm: number;
  estimatedLengthM: number;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  capacityKw: number;
  insulationMm: number;
  bomCategory: string;
  bomSkuHint: string;
  modelSku: string;
  installMethod: string;
  openingDirection: string;
  connectionDirection: string;
  material: string;
  insulationInfo: string;
  wallType: string;
  hostWallId: string;
};

const DEFAULT_COMPONENT_EDITOR: ComponentEditor = {
  name: '',
  systemKey: 'cooling',
  status: 'active',
  visible: true,
  locked: false,
  floor: 1,
  x: 0,
  y: 0,
  z: 0,
  elevation: 0,
  installHeight: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  width: 1,
  height: 1,
  depth: 1,
  length: 1,
  thickness: 0.2,
  diameterMm: 32,
  bendRadiusMm: 0,
  estimatedLengthM: 1,
  startX: 0,
  startY: 0,
  startZ: 0,
  endX: 1,
  endY: 0,
  endZ: 0,
  capacityKw: 0,
  insulationMm: 0,
  bomCategory: '',
  bomSkuHint: '',
  modelSku: '',
  installMethod: '',
  openingDirection: '',
  connectionDirection: '',
  material: '',
  insulationInfo: '',
  wallType: '',
  hostWallId: '',
};

type ToolPaletteMode = 'layout' | 'equipment' | 'pipe' | 'annotation' | 'edit';
type ViewerFloorViewMode = RouteFloorViewMode;

type PendingRiser = {
  componentId: string;
  sourceFloor: number;
  targetFloor: number;
  point: PipePoint;
  installHeight: number;
  sourceElevation: number;
  targetElevation: number;
};

type ModelObjectTreeNode =
  | {
      kind: 'component';
      id: string;
      label: string;
      meta: string;
      component: GeneratedHvacComponent;
      selected: boolean;
      visible: boolean;
      locked: boolean;
    }
  | {
      kind: 'source';
      id: string;
      label: string;
      meta: string;
      source: ViewerModelSource;
      selected: boolean;
    }
  | {
      kind: 'project';
      id: string;
      label: string;
      meta: string;
    };

type ModelObjectTreeGroup = {
  key: string;
  label: string;
  nodes: ModelObjectTreeNode[];
};

const TOOL_PALETTE_MODES: Array<{
  key: ToolPaletteMode;
  label: string;
  icon: string;
  categoryKeys: ViewerComponentCatalog['categories'][number]['key'][];
}> = [
  { key: 'layout', label: '布局', icon: '布', categoryKeys: ['wall', 'door', 'window', 'room-zone'] },
  { key: 'equipment', label: '设备', icon: '设', categoryKeys: ['hvac-equipment'] },
  { key: 'pipe', label: '管路', icon: '管', categoryKeys: ['pipe'] },
  { key: 'annotation', label: '标注', icon: '标', categoryKeys: ['room-zone'] },
  { key: 'edit', label: '编辑', icon: '编', categoryKeys: [] },
];

const COMPONENT_SYSTEM_OPTIONS: SelectOption[] = [
  { value: 'envelope', label: '建筑围护' },
  { value: 'zone', label: '空间分区' },
  { value: 'cooling', label: '制冷' },
  { value: 'heating', label: '采暖' },
  { value: 'freshAir', label: '新风' },
  { value: 'water', label: '水系统' },
  { value: 'smartControl', label: '智能控制' },
];

const COMPONENT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: '启用' },
  { value: 'deleted', label: '标记删除' },
];

function numberValue(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function displayState(state: string) {
  const labels: Record<string, string> = {
    active: '进行中',
    archived: '已归档',
    deleted: '已删除',
    estimate: '估算',
    failed: '失败',
    loading: '载入中',
    passed: '通过',
    pending: '待检查',
    ready: '就绪',
    verified: '已验证',
    warning: '待复核',
  };
  return labels[state] ?? state;
}

function displayModelSource(source?: string | null) {
  const labels: Record<string, string> = {
    artifact: '成果库',
    generated: '参数化生成',
    'local-upload': '本地上传',
    none: '无',
  };
  return labels[source ?? 'none'] ?? String(source);
}

function displayModelType(type?: string | null) {
  const labels: Record<string, string> = {
    generated: '生成模型',
    glb: 'GLB',
    ifc: 'IFC',
    unknown: '未知',
    none: '无',
  };
  return labels[type ?? 'none'] ?? String(type);
}

function displaySystemName(name: string) {
  const options = [...COOLING_OPTIONS, ...HEATING_OPTIONS, { value: 'Fresh air unit', label: '新风主机' }];
  return options.find((item) => item.value === name)?.label ?? name;
}

function displayArtifactName(artifact: any) {
  const name = artifact?.originalName || artifact?.filename || artifact?.name || artifact?.id;
  return name ? `成果模型：${name}` : '成果模型';
}

function displaySystemKey(key: string) {
  const labels: Record<string, string> = {
    cooling: '制冷',
    envelope: '建筑围护',
    freshAir: '新风',
    heating: '采暖',
    smartControl: '智能控制',
    water: '水系统',
    zone: '房间/区域',
  };
  return labels[key] ?? key;
}

function displayComponentType(type: string) {
  const labels: Record<string, string> = {
    'building-outline': '建筑轮廓',
    'duct-route': '风管路由',
    door: '门',
    equipment: '设备',
    'model-object': '模型对象',
    'pipe-route': '管线路由',
    'room-zone': '房间区域',
    wall: '墙体',
    window: '窗',
  };
  return labels[type] ?? type;
}

function displayComplianceLabel(label: string) {
  const labels: Record<string, string> = {
    'Building parameters': '建筑参数',
    'Calculation trust': '计算可信度',
    'Model linkage': '模型联动',
  };
  return labels[label] ?? label;
}

function displayComplianceDetail(detail: string) {
  const details: Record<string, string> = {
    'Area, floors and floor height are present.': '建筑面积、楼层和层高已填写。',
    'Area, floors and floor height are required.': '必须填写建筑面积、楼层和层高。',
    'Project-approved calculation data is attached.': '已关联项目审批计算数据。',
    'Loads are local estimates until approved calculation data is attached.':
      '当前负荷为本地估算，待关联审批计算数据。',
    'Generated or loaded model components are linked.': '已关联生成或载入的模型构件。',
    'No generated or loaded model component summary is available yet.':
      '暂未生成或载入模型构件摘要。',
  };
  return details[detail] ?? detail;
}

export default function ViewerParams() {
  const params = useSearchParams();
  const initialDraftId = params.get('draftId') || undefined;
  const activeModelSourceIdRef = useRef<string | undefined>();
  const selectedFloorAlignedComponentIdRef = useRef<string | null>(null);
  const legacyDesignerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  const [artifactId, setArtifactId] = useState<string | undefined>(
    params.get('artifactId') ?? undefined
  );
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [project, setProject] = useState<ProjectInputs>(DEFAULT_PROJECT);
  const [building, setBuilding] = useState<BuildingInputs>(DEFAULT_BUILDING);
  const [systems, setSystems] = useState<SystemInputs>(DEFAULT_SYSTEMS);
  const [version, setVersion] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<GeneratedHvacModel | null>(null);
  const [commandHistory, setCommandHistory] = useState(() => createViewerCommandHistory());
  const [selectedComponent, setSelectedComponent] = useState<GeneratedHvacComponent | null>(null);
  const [leftPanelMode, setLeftPanelMode] = useState<'parameters' | 'catalog'>('parameters');
  const [componentCatalog, setComponentCatalog] = useState<ViewerComponentCatalog | null>(null);
  const [selectedCatalogTemplate, setSelectedCatalogTemplate] =
    useState<ViewerComponentCatalogTemplate | null>(null);
  const [toolPaletteMode, setToolPaletteMode] = useState<ToolPaletteMode>('layout');
  const [templateDefaultOverrides, setTemplateDefaultOverrides] = useState<
    Record<string, CatalogTemplateDefaultOverrides>
  >({});
  const [activeModelSource, setActiveModelSource] = useState<ViewerModelSource | null>(null);
  const [modelRecords, setModelRecords] = useState<ViewerModelSource[]>([]);
  const [modelName, setModelName] = useState('未命名模型');
  const [includeArchivedModels, setIncludeArchivedModels] = useState(false);
  const [modelObjects, setModelObjects] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);
  const [visibility, setVisibility] = useState<GeneratedVisibility>(DEFAULT_VISIBILITY);
  const [floorViewMode, setFloorViewMode] = useState<ViewerFloorViewMode>('all-floors');
  const [pipeEditMode, setPipeEditMode] = useState<PipeEditMode>('select');
  const [draftRoutePoints, setDraftRoutePoints] = useState<PipePoint[]>([]);
  const [draftRouteEndpointRefs, setDraftRouteEndpointRefs] = useState<RouteEndpointRefs>({});
  const [activeFloor, setActiveFloor] = useState(1);
  const [pendingRiser, setPendingRiser] = useState<PendingRiser | null>(null);
  const [routeContinuationComponentId, setRouteContinuationComponentId] = useState<string | null>(null);
  const [routeContinuationBasePointCount, setRouteContinuationBasePointCount] = useState(0);
  const [pipeEditor, setPipeEditor] = useState(DEFAULT_PIPE_EDITOR);
  const [componentEditor, setComponentEditor] =
    useState<ComponentEditor>(DEFAULT_COMPONENT_EDITOR);
  const [viewerInteractionState, setViewerInteractionState] =
    useState<ViewerInteractionState>('idle');
  const [status, setStatus] = useState('草稿尚未保存');
  const [, setSummaryStatus] = useState('设计摘要尚未入库');
  const [persistedSummary, setPersistedSummary] = useState<ViewerSummary | null>(null);
  const [, setHandoffStatus] = useState('请先保存草稿和设计摘要，再交接到 2D / BOM / 报价。');
  const [, setModelRecordStatus] = useState('尚未载入模型来源');
  const [catalogStatus, setCatalogStatus] = useState('正在载入 3D 构件库');
  const [legacyConversionStatus, setLegacyConversionStatus] =
    useState('可导入 4001/designer.html 导出的 .rh-design.json');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propertyEditBaselineRef = useRef<ViewerEditableSnapshot | null>(null);
  const historyDirtyRef = useRef(false);

  const loadedModelSummary = useMemo(() => {
    if (generatedModel || !modelObjects.length) return null;
    return {
      id: activeModelSource?.id ?? artifactId ?? 'loaded-local-model',
      modelVersion: activeModelSource?.version ?? 1,
      components: modelObjects.map((item) => ({
        id: item.id,
        type: viewerObjectType(item.type, item.name),
        systemKey: viewerObjectSystem(item.name),
        name: item.name,
        businessMetadata: {},
      })),
    };
  }, [activeModelSource, artifactId, generatedModel, modelObjects]);
  const designSummary = useMemo(
    () =>
      buildViewerDesignSummary({
        project,
        building,
        systems,
        draftId,
        generatedModel:
          (generatedModel as unknown as Record<string, unknown> | null) ?? loadedModelSummary,
      }),
    [project, building, systems, draftId, generatedModel, loadedModelSummary]
  );
  const modelBinding = useMemo(
    () => ({
      draftId: draftId ?? null,
      projectId: params.get('projectId'),
      designProjectId: params.get('designProjectId'),
      bimProjectId: params.get('bimProjectId'),
      customerId: params.get('customerId'),
      opportunityId: params.get('opportunityId'),
      contractId: params.get('contractId'),
    }),
    [draftId, params]
  );
  const catalogGroups = useMemo(() => {
    if (!componentCatalog) return [];
    return componentCatalog.categories.map((category) => ({
      ...category,
      templates: componentCatalog.templates.filter((template) => template.category === category.key),
    }));
  }, [componentCatalog]);
  const modelObjectTreeGroups = useMemo(
    () =>
      buildModelObjectTree({
        project,
        draftId,
        generatedModel,
        modelRecords,
        activeModelSource,
        selectedComponentId: selectedComponent?.id,
      }),
    [activeModelSource, draftId, generatedModel, modelRecords, project, selectedComponent?.id]
  );
  const routeDraftPlacement = useMemo(() => {
    const routeTemplate = isRouteTemplate(selectedCatalogTemplate) ? selectedCatalogTemplate : null;
    const overrides = routeTemplate ? (templateDefaultOverrides[routeTemplate.id] ?? {}) : {};
    const floor = numberOr(
      overrides.floor ?? activeFloor ?? selectedComponent?.floor ?? selectedComponent?.businessMetadata?.floor,
      1
    );
    const floorBase = Math.max(0, (Math.max(1, Math.round(floor)) - 1) * building.floorHeight);
    const installHeight =
      overrides.installHeight ??
      (pipeEditor.startY >= floorBase ? roundCoord(pipeEditor.startY - floorBase) : pipeEditor.startY);
    const elevation = placementElevationFrom({
      floor,
      elevation: overrides.elevation,
      installHeight,
      floorHeight: building.floorHeight,
      fallbackElevation: pipeEditor.startY,
    });
    return { floor, elevation };
  }, [
    activeFloor,
    building.floorHeight,
    pipeEditor.startY,
    selectedCatalogTemplate,
    selectedComponent?.businessMetadata,
    selectedComponent?.floor,
    templateDefaultOverrides,
  ]);
  const floorOptions = useMemo(
    () =>
      Array.from({ length: Math.max(1, Math.round(numberOr(building.floors, 1))) }, (_, index) => {
        const floor = index + 1;
        return { value: String(floor), label: `Floor ${floor}` };
      }),
    [building.floors]
  );
  const activeFloorLabel =
    floorOptions.find((option) => option.value === String(activeFloor))?.label ??
    `Floor ${activeFloor}`;
  const activeFloorNumber = Math.max(1, Math.round(numberOr(activeFloor, 1)));
  const hasValidRiserTargetFloor = floorOptions.some(
    (option) => Number(option.value) !== activeFloorNumber
  );
  const canAddRiserFromToolbar = Boolean(
    draftId &&
      generatedModel &&
      selectedComponent &&
      isRouteComponent(selectedComponent) &&
      !selectedComponent.locked &&
      hasValidRiserTargetFloor
  );
  const canDeleteSelectedEditableObject = Boolean(
    generatedModel &&
      selectedComponent &&
      !selectedComponent.locked &&
      (selectedComponent.status ?? 'active') !== 'deleted'
  );
  const changeActiveFloor = useCallback(
    (value: string) => {
      const floor = Math.round(numberOr(value, activeFloor));
      setActiveFloor(floor);
      setPendingRiser(null);
      setDraftRoutePoints([]);
      setDraftRouteEndpointRefs({});
      setRouteContinuationComponentId(null);
      setRouteContinuationBasePointCount(0);
    },
    [activeFloor]
  );

  const updateTemplateDefaultOverride = useCallback(
    (templateId: string, key: string, value: string | number | boolean) => {
      setTemplateDefaultOverrides((current) => ({
        ...current,
        [templateId]: {
          ...(current[templateId] ?? {}),
          [key]: value,
        },
      }));
    },
    []
  );

  const beginPropertyEditing = () => {
    if (!propertyEditBaselineRef.current) {
      propertyEditBaselineRef.current = currentEditableSnapshot();
    }
    setViewerInteractionState('editing-property');
  };

  const clearPropertyEditing = useCallback(() => {
    propertyEditBaselineRef.current = null;
    setViewerInteractionState((current) => (current === 'editing-property' ? 'idle' : current));
  }, []);

  const handlePropertyEditorBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    void saveSelectedComponentProperties();
  };

  const handlePropertyEditorKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    if (event.key === 'Escape') {
      const baseline = propertyEditBaselineRef.current;
      propertyEditBaselineRef.current = null;
      if (baseline) applyEditableSnapshot(baseline);
      if (event.target instanceof HTMLElement) event.target.blur();
      clearPropertyEditing();
      return;
    }
    event.preventDefault();
    if (event.target instanceof HTMLElement) event.target.blur();
    void saveSelectedComponentProperties();
  };

  const refreshModelRecords = useCallback(async () => {
    try {
      const listed = await modelSources.list({
        projectId: modelBinding.projectId ?? undefined,
        draftId: draftId ?? undefined,
        includeArchived: includeArchivedModels,
      });
      setModelRecords(listed.items ?? []);
    } catch (err) {
      setModelRecordStatus(`模型列表读取失败：${(err as Error).message}`);
    }
  }, [draftId, includeArchivedModels, modelBinding.projectId]);

  const selectCatalogTemplate = useCallback((template: ViewerComponentCatalogTemplate) => {
    setSelectedCatalogTemplate(template);
    setStatus(`已选择构件模板：${template.label}`);
    if (template.type === 'pipe-route' || template.type === 'duct-route') {
      setPipeEditor((current) => ({
        ...current,
        systemKey: template.systemKey,
        name: template.label,
        diameterMm: numberOr(template.defaultDimensions.diameterMm, current.diameterMm),
        estimatedLengthM: numberOr(
          template.defaultDimensions.estimatedLengthM,
          current.estimatedLengthM
        ),
      }));
      setPipeEditMode('draw-pipe');
    }
  }, []);

  const beginCatalogTemplateDrag = useCallback(
    (event: DragEvent<HTMLButtonElement>, template: ViewerComponentCatalogTemplate) => {
      selectCatalogTemplate(template);
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(
        'application/x-rysnova-component-template',
        JSON.stringify({
          id: template.id,
          type: template.type,
          systemKey: template.systemKey,
          floor: templateDefaultOverrides[template.id]?.floor,
          elevation: templateDefaultOverrides[template.id]?.elevation,
          installHeight: templateDefaultOverrides[template.id]?.installHeight,
        })
      );
      event.dataTransfer.setData('text/plain', template.id);
      event.dataTransfer.setDragImage(renderTemplateDragPreview(template), 48, 34);
    },
    [selectCatalogTemplate, templateDefaultOverrides]
  );

  const historyCanUndo = viewerHistoryCanUndo(commandHistory);
  const historyCanRedo = viewerHistoryCanRedo(commandHistory);
  const historyDirty = viewerHistoryIsDirty(commandHistory);
  historyDirtyRef.current = historyDirty;
  const currentEditableSnapshot = useCallback(
    () => snapshotViewerEditableState(generatedModel),
    [generatedModel]
  );
  function applyEditableSnapshot(snapshot: ViewerEditableSnapshot) {
    const model = snapshotViewerEditableState(snapshot.generatedModel).generatedModel;
    setGeneratedModel(model);
    setModelObjects(
      model
        ? model.components.map((item) => ({ id: item.id, name: item.name, type: item.type }))
        : []
    );
    setSelectedComponent((current) => {
      if (!model) return null;
      if (current) {
        const refreshed = model.components.find((item) => item.id === current.id);
        if (refreshed) return refreshed;
      }
      return (
        model.components.find((item) => item.type === 'equipment') ?? model.components[0] ?? null
      );
    });
  }
  const clearCommandHistoryAt = useCallback((snapshot: ViewerEditableSnapshot) => {
    setCommandHistory((current) => clearViewerCommandHistory(current, snapshot));
  }, []);
  const markCommandHistoryClean = useCallback(() => {
    setCommandHistory((current) => markViewerHistoryClean(current));
  }, []);
  const recordAcceptedCommand = useCallback(
    (
      kind: ViewerCommandKind,
      label: string,
      before: ViewerEditableSnapshot,
      after: ViewerEditableSnapshot
    ) => {
      setCommandHistory((current) =>
        recordViewerCommand(current, {
          kind,
          label,
          before,
          after,
        })
      );
    },
    []
  );
  const applyAcceptedDraft = useCallback(
    (
      draft: ViewerDraft,
      kind: ViewerCommandKind,
      label: string,
      before: ViewerEditableSnapshot
    ) => {
      const after = snapshotViewerEditableState(modelFrom(draft.generatedModel));
      applyDraft(draft);
      recordAcceptedCommand(kind, label, before, after);
    },
    [recordAcceptedCommand]
  );
  const applyAuthoritativeDraft = useCallback(
    (draft: ViewerDraft) => {
      applyDraft(draft);
      clearCommandHistoryAt(snapshotViewerEditableState(modelFrom(draft.generatedModel)));
      propertyEditBaselineRef.current = null;
    },
    [clearCommandHistoryAt]
  );
  const confirmDiscardUnsavedHistory = useCallback(
    (label: string) => {
      if (!historyDirtyRef.current) return true;
      if (typeof window === 'undefined') return true;
      return window.confirm(`${label} will discard unsaved viewer edits. Continue?`);
    },
    []
  );
  const undoCommandHistory = useCallback(() => {
    if (viewerInteractionState === 'editing-property' || viewerInteractionState === 'dragging-component') {
      return;
    }
    const result = undoViewerCommand(commandHistory);
    if (!result) return;
    propertyEditBaselineRef.current = null;
    setCommandHistory(result.history);
    applyEditableSnapshot(result.snapshot);
    setStatus(`Undo: ${result.entry.label}`);
  }, [applyEditableSnapshot, commandHistory, viewerInteractionState]);
  const redoCommandHistory = useCallback(() => {
    if (viewerInteractionState === 'editing-property' || viewerInteractionState === 'dragging-component') {
      return;
    }
    const result = redoViewerCommand(commandHistory);
    if (!result) return;
    propertyEditBaselineRef.current = null;
    setCommandHistory(result.history);
    applyEditableSnapshot(result.snapshot);
    setStatus(`Redo: ${result.entry.label}`);
  }, [applyEditableSnapshot, commandHistory, viewerInteractionState]);

  const loadDraft = useCallback(async (id: string) => {
    if (!confirmDiscardUnsavedHistory('Reload draft')) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await viewerDrafts.get(id);
      applyAuthoritativeDraft(draft);
      void refreshModelRecords();
      void viewerSummaries
        .latest(draft.id)
        .then((summary) => {
          setPersistedSummary(summary);
          setSummaryStatus(
            summary ? `已载入设计摘要：${displayState(summary.trustStatus)}` : '还没有已保存的设计摘要'
          );
          setHandoffStatus(
            summary
              ? '下游页面会从 v2 API 重新载入这份草稿和摘要。'
              : '请先保存当前设计摘要，再交接到下游页面。'
          );
        })
        .catch(() => {
          setPersistedSummary(null);
          setSummaryStatus('设计摘要未载入');
          setHandoffStatus('设计摘要查询失败；下游缺少负荷/BOM 上下文。');
        });
      setStatus(`已载入草稿 v${draft.version}`);
    } catch (err) {
      setError(componentEditorErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [applyAuthoritativeDraft, confirmDiscardUnsavedHistory, refreshModelRecords]);

  useEffect(() => {
    apiFetch('/api/v2/file-artifact?entityType=bim_project&entityId=approved')
      .then((json) => setArtifacts(json?.items ?? json?.data?.items ?? json?.data ?? []))
      .catch(() => setArtifacts([]));
  }, []);

  useEffect(() => {
    viewerComponentCatalog
      .list()
      .then((catalog) => {
        setComponentCatalog(catalog);
        setCatalogStatus(
          `已载入 ${catalog.categories.length} 类 / ${catalog.templates.length} 个后端构件模板`
        );
      })
      .catch((err) => {
        setComponentCatalog(null);
        setCatalogStatus(`构件库载入失败：${(err as Error).message}`);
      });
  }, []);

  useEffect(() => {
    if (initialDraftId) loadDraft(initialDraftId);
  }, [initialDraftId, loadDraft]);

  useEffect(() => {
    void refreshModelRecords();
  }, [refreshModelRecords]);

  useEffect(() => {
    if (activeModelSource?.name) setModelName(activeModelSource.name);
  }, [activeModelSource]);

  useEffect(() => {
    if (!selectedComponent || !isRouteComponent(selectedComponent)) return;
    const geometry = selectedComponent.geometry ?? {};
    const points = Array.isArray(geometry.points) ? geometry.points : [];
    const first = pointFrom(points[0], {
      x: DEFAULT_PIPE_EDITOR.startX,
      y: DEFAULT_PIPE_EDITOR.startY,
      z: DEFAULT_PIPE_EDITOR.startZ,
    });
    const last = pointFrom(points[points.length - 1], {
      x: DEFAULT_PIPE_EDITOR.endX,
      y: DEFAULT_PIPE_EDITOR.endY,
      z: DEFAULT_PIPE_EDITOR.endZ,
    });
    setPipeEditor({
      systemKey: selectedComponent.systemKey,
      name: selectedComponent.name,
      diameterMm: numberOr(geometry.diameterMm, DEFAULT_PIPE_EDITOR.diameterMm),
      bendRadiusMm: routeBendRadiusMm(selectedComponent),
      startX: first.x,
      startY: first.y,
      startZ: first.z,
      endX: last.x,
      endY: last.y,
      endZ: last.z,
      estimatedLengthM: numberOr(
        selectedComponent.businessMetadata.estimatedLengthM,
        DEFAULT_PIPE_EDITOR.estimatedLengthM
      ),
    });
  }, [selectedComponent]);

  useEffect(() => {
    if (!selectedComponent || !isRouteComponent(selectedComponent)) {
      selectedFloorAlignedComponentIdRef.current = null;
      return;
    }
    if (pendingRiser || routeContinuationComponentId) return;
    if (selectedFloorAlignedComponentIdRef.current === selectedComponent.id) return;
    selectedFloorAlignedComponentIdRef.current = selectedComponent.id;
    setActiveFloor((current) =>
      numberOr(selectedComponent.floor ?? selectedComponent.businessMetadata?.floor, current)
    );
  }, [
    pendingRiser,
    routeContinuationComponentId,
    selectedComponent?.businessMetadata,
    selectedComponent?.floor,
    selectedComponent?.id,
  ]);

  useEffect(() => {
    setComponentEditor(
      selectedComponent ? componentEditorFromComponent(selectedComponent) : DEFAULT_COMPONENT_EDITOR
    );
    clearPropertyEditing();
  }, [clearPropertyEditing, selectedComponent?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = viewerHistoryShortcutFromEvent(event);
      if (!shortcut) return;
      if (shortcut === 'undo' && historyCanUndo) {
        event.preventDefault();
        undoCommandHistory();
      }
      if (shortcut === 'redo' && historyCanRedo) {
        event.preventDefault();
        redoCommandHistory();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [historyCanRedo, historyCanUndo, redoCommandHistory, undoCommandHistory]);

  const saveDraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await persistDraft();
      await persistViewerSummary(saved);
      applyDraft(saved);
      markCommandHistoryClean();
      setStatus(`已保存草稿 v${saved.version}`);
    } catch (err) {
      setError(componentEditorErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const generateModel = async () => {
    if (!confirmDiscardUnsavedHistory('Regenerate model')) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await persistDraft();
      const generated = await viewerDrafts.generateModel(saved.id);
      await persistViewerSummary(generated);
      applyAuthoritativeDraft(generated);
      const model = modelFrom(generated.generatedModel);
      await persistGeneratedModelSource(generated, model);
      setStatus(`已生成暖通模型 v${model?.modelVersion ?? generated.version}`);
      setSelectedComponent(
        model?.components.find((item) => item.type === 'equipment') ?? model?.components[0] ?? null
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearPropertyEditing();
      setBusy(false);
    }
  };

  const openLegacyDesignerImport = () => {
    legacyDesignerFileInputRef.current?.click();
  };

  const importLegacyDesigner2d = async (file: File | undefined) => {
    if (!file) return;
    if (!confirmDiscardUnsavedHistory('Import legacy 2D model')) return;
    setBusy(true);
    setError(null);
    setLegacyConversionStatus(`正在转换 ${file.name}`);
    try {
      const legacyProject = JSON.parse(await file.text()) as LegacyDesigner2dProject;
      const saved = await persistDraft();
      const converted = await viewerDrafts.convertLegacyDesigner2d(saved.id, {
        legacyProject,
        sourceName: file.name,
      });
      applyAuthoritativeDraft(converted);
      await persistViewerSummary(converted);
      const model = modelFrom(converted.generatedModel);
      await persistGeneratedModelSource(converted, model);
      setGeneratedModel(model);
      setSelectedComponent(
        model?.components.find((item) => item.type === 'wall') ?? model?.components[0] ?? null
      );
      setStatus(`已转换 4001 2D 图纸 v${converted.version}`);
      setLegacyConversionStatus(
        `已转换 ${file.name}：${model?.componentSummary.total ?? 0} 个 3D 构件已入库`
      );
    } catch (err) {
      setError((err as Error).message);
      setLegacyConversionStatus(`2D 转 3D 失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
      if (legacyDesignerFileInputRef.current) legacyDesignerFileInputRef.current.value = '';
    }
  };

  const handleModelEvent = useCallback(
    async (event: BimModelLoadEvent) => {
      if (event.phase === 'loading') {
        activeModelSourceIdRef.current = undefined;
        setActiveModelSource(null);
        setModelObjects([]);
        setModelRecordStatus(`正在记录 ${event.modelType.toUpperCase()} 模型来源...`);
      }
      if (event.phase === 'ready') setModelObjects(event.objects ?? []);

      const loadStatus =
        event.phase === 'ready' ? 'ready' : event.phase === 'error' ? 'error' : 'loading';
      const payload: ViewerModelSourcePayload = {
        id:
          event.phase === 'loading' || (event.phase === 'error' && event.modelType === 'unknown')
            ? undefined
            : activeModelSourceIdRef.current,
        ...modelBinding,
        sourceType: event.sourceType,
        modelType: event.modelType,
        name: event.name,
        artifactId:
          event.artifactId ?? (event.sourceType === 'artifact' ? (artifactId ?? null) : null),
        uploadReference: event.uploadReference ?? null,
        loadStatus,
        loadError: event.error ?? null,
        metadata: {
          name: event.name,
          ...(event.metadata ?? {}),
          meshCount: event.meshCount ?? event.metadata?.meshCount ?? 0,
          objectCount:
            event.objectCount ?? event.metadata?.objectCount ?? event.objects?.length ?? 0,
        },
        componentSummary: {
          objects: event.objects ?? [],
          meshCount: event.meshCount ?? 0,
          objectCount: event.objectCount ?? event.objects?.length ?? 0,
        },
      };

      try {
      const saved = await modelSources.save(payload);
        activeModelSourceIdRef.current = saved.id;
        setActiveModelSource(saved);
        setModelName(saved.name ?? event.name);
        setModelRecordStatus(
          `模型来源 ${displayState(saved.loadStatus)} / ${displayModelType(saved.modelType)} v${saved.version}`
        );
        void refreshModelRecords();
      } catch (err) {
        setModelRecordStatus(`模型来源记录失败：${(err as Error).message}`);
      }
    },
    [artifactId, modelBinding, refreshModelRecords]
  );

  const createModelRecord = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await modelSources.save({
        ...modelBinding,
        sourceType: generatedModel ? 'generated' : artifactId ? 'artifact' : 'generated',
        modelType: generatedModel ? 'generated' : artifactId ? 'unknown' : 'generated',
        name: modelName,
        artifactId: artifactId ?? null,
        uploadReference: null,
        loadStatus: 'ready',
        recordStatus: 'active',
        metadata: { name: modelName, createdFrom: 'viewer-crud' },
        componentSummary: {
          objects: modelObjects,
          objectCount: modelObjects.length,
          ...(generatedModel ? { generatedModelSnapshot: generatedModel } : {}),
        },
      });
      activeModelSourceIdRef.current = saved.id;
      setActiveModelSource(saved);
      setModelRecordStatus(`已新建模型 ${saved.name ?? saved.id} v${saved.version}`);
      setHandoffStatus('模型记录已入库；如果数值有变化，请保存设计摘要后再交接下游。');
      await refreshModelRecords();
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`新建模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const openModelRecord = async (id: string) => {
    if (!confirmDiscardUnsavedHistory('Switch model')) return;
    setBusy(true);
    setError(null);
    try {
      const opened = await modelSources.get(id);
      activeModelSourceIdRef.current = opened.id;
      setActiveModelSource(opened);
      setModelName(opened.name ?? '未命名模型');
      const openedGeneratedModel = modelFromModelSource(opened);
      const objects = openedGeneratedModel
        ? openedGeneratedModel.components.map((component) => ({
            id: component.id,
            name: component.name,
            type: component.type,
          }))
        : modelObjectsFrom(opened);
      setModelObjects(objects);
      setGeneratedModel(openedGeneratedModel);
      clearCommandHistoryAt(snapshotViewerEditableState(openedGeneratedModel));
      setSelectedComponent(
        openedGeneratedModel?.components.find((item) => item.type === 'equipment') ??
          openedGeneratedModel?.components[0] ??
          null
      );
      if (opened.artifactId) {
        setArtifactId(opened.artifactId);
      }
      setModelRecordStatus(`已打开模型 ${opened.name ?? opened.id} v${opened.version}`);
      setHandoffStatus('已打开持久化模型记录，可用于下游交接。');
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`打开模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const saveModelRecord = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await modelSources.save({
        id: activeModelSource?.id,
        ...modelBinding,
        sourceType:
          activeModelSource?.sourceType ??
          (generatedModel ? 'generated' : artifactId ? 'artifact' : 'generated'),
        modelType: activeModelSource?.modelType ?? (generatedModel ? 'generated' : 'unknown'),
        name: modelName,
        artifactId: activeModelSource?.artifactId ?? artifactId ?? null,
        uploadReference: activeModelSource?.uploadReference ?? null,
        loadStatus: activeModelSource?.loadStatus ?? 'ready',
        recordStatus: activeModelSource?.recordStatus ?? 'active',
        loadError: activeModelSource?.loadError ?? null,
        metadata: {
          ...(activeModelSource?.metadata ?? {}),
          name: modelName,
          savedFrom: 'viewer-crud',
        },
        componentSummary: {
          ...(activeModelSource?.componentSummary ?? {}),
          objects: modelObjects,
          objectCount: modelObjects.length,
          ...(generatedModel ? { generatedModelSnapshot: generatedModel } : {}),
        },
      });
      activeModelSourceIdRef.current = saved.id;
      setActiveModelSource(saved);
      setModelRecordStatus(`已保存模型 ${saved.name ?? saved.id} v${saved.version}`);
      setHandoffStatus('模型记录已保存，可用于下游交接。');
      await refreshModelRecords();
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`保存模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const duplicateModelRecord = async () => {
    if (!activeModelSource) return;
    setBusy(true);
    setError(null);
    try {
      const duplicated = await modelSources.duplicate(activeModelSource.id, `${modelName} 副本`);
      activeModelSourceIdRef.current = duplicated.id;
      setActiveModelSource(duplicated);
      setModelName(duplicated.name ?? `${modelName} 副本`);
      setModelRecordStatus(`已复制模型 ${duplicated.name ?? duplicated.id}`);
      setHandoffStatus('复制后的模型记录已设为当前记录，可用于下游交接。');
      await refreshModelRecords();
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`复制模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const renameModelRecord = async () => {
    if (!activeModelSource) return;
    setBusy(true);
    setError(null);
    try {
      const renamed = await modelSources.rename(activeModelSource.id, modelName);
      setActiveModelSource(renamed);
      setModelRecordStatus(`已重命名模型 ${renamed.name ?? renamed.id}`);
      await refreshModelRecords();
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`重命名模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const archiveModelRecord = async () => {
    if (!activeModelSource) return;
    setBusy(true);
    setError(null);
    try {
      const archived = await modelSources.archive(activeModelSource.id);
      setActiveModelSource(archived);
      setModelRecordStatus(`已归档模型 ${archived.name ?? archived.id}`);
      setHandoffStatus('已归档模型在审计关联场景下仍可作为交接记录查看。');
      await refreshModelRecords();
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`归档模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteModelRecord = async () => {
    if (!activeModelSource) return;
    setBusy(true);
    setError(null);
    try {
      const deleted = await modelSources.delete(activeModelSource.id);
      setModelRecordStatus(`已删除模型 ${deleted.name ?? deleted.id}`);
      setHandoffStatus('模型记录已删除；下游将只使用草稿和摘要继续交接。');
      setActiveModelSource(null);
      activeModelSourceIdRef.current = undefined;
      await refreshModelRecords();
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`删除模型失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const createPipeRouteComponent = async () => {
    if (!draftId || !generatedModel) {
      setError('请先生成暖通模型，再新增管线构件。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.createComponent(
        draftId,
        pipeRoutePayload(
          undefined,
          draftRoutePoints.length >= 2 ? draftRoutePoints : undefined,
          undefined,
          draftRouteEndpointRefs
        )
      );
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, 'route-create', 'Create route', before);
      setStatus(`已新增管线构件 v${saved.version}`);
      setModelRecordStatus('构件级修改已保存到草稿 generated_model；如需模型库同步，请点击保存模型。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearPropertyEditing();
      setBusy(false);
    }
  };

  const createPipeRouteFromViewport = async (
    points: PipePoint[],
    endpointRefs?: RouteEndpointRefs
  ) => {
    if (!draftId || !generatedModel) {
      setError('请先生成暖通模型，再在 3D 视口中画管。');
      return;
    }
    updatePipeEditorFromPoints(points);
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.createComponent(
        draftId,
        pipeRoutePayload(undefined, points, undefined, endpointRefs)
      );
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, 'route-create', 'Create route', before);
      const model = modelFrom(saved.generatedModel);
      const createdPipe = [...(model?.components ?? [])]
        .reverse()
        .find((item) => isRouteComponent(item));
      if (createdPipe) setSelectedComponent(createdPipe);
      setStatus(`已通过拖拽新增管线构件 v${saved.version}`);
      setModelRecordStatus('构件级拖拽新增已保存到草稿 generated_model；如需模型库同步，请点击保存模型。');
      setDraftRoutePoints([]);
      setDraftRouteEndpointRefs({});
      setPipeEditMode('edit-pipe');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearPropertyEditing();
      setBusy(false);
    }
  };

  const placeCatalogTemplateInViewport = async (templateRef: string, point: PipePoint) => {
    if (!draftId || !generatedModel) {
      setError('请先生成暖通模型，再从构件库拖拽放置。');
      return;
    }
    const templateId = parseTemplateDropId(templateRef);
    const template = componentCatalog?.templates.find((item) => item.id === templateId);
    if (!template) {
      setError(`构件模板不存在：${templateId || 'unknown'}`);
      return;
    }
    setSelectedCatalogTemplate(template);
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const payload = componentPayloadFromCatalogTemplate(
        template,
        point,
        undefined,
        templateDefaultOverrides[template.id] ?? {},
        building.floorHeight
      );
      const saved = await viewerDrafts.createComponent(draftId, payload);
      await persistViewerSummary(saved);
      applyAcceptedDraft(
        saved,
        isRouteTemplate(template) ? 'route-create' : 'component-create',
        isRouteTemplate(template) ? 'Create route' : 'Create component',
        before
      );
      const model = modelFrom(saved.generatedModel);
      const placed = [...(model?.components ?? [])]
        .reverse()
        .find((item) => item.sourceTemplateId === template.id);
      if (placed) setSelectedComponent(placed);
      setPipeEditMode(isRouteTemplate(template) ? 'edit-pipe' : 'move-component');
      setStatus(`已通过拖拽放置构件 ${template.label} / v${saved.version}`);
      setModelRecordStatus('拖拽放置构件已保存到草稿 generated_model；刷新后可从草稿恢复。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateSelectedPipeRouteComponent = async () => {
    if (!draftId || !generatedModel || !selectedComponent || !isRouteComponent(selectedComponent)) {
      setError('请先选中一条管线构件。');
      return;
    }
    if (selectedComponent.locked) {
      setError('构件已锁定，不能编辑管线属性。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.updateComponent(
        draftId,
        selectedComponent.id,
        pipeRoutePayload(selectedComponent.id)
      );
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, 'property-change', 'Update route properties', before);
      setStatus(`已更新管线构件 v${saved.version}`);
      setModelRecordStatus('构件级修改已保存到草稿 generated_model；如需模型库同步，请点击保存模型。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updatePipeRouteFromViewport = async (
    component: GeneratedHvacComponent,
    points: PipePoint[],
    endpointRefs?: RouteEndpointRefs
  ) => {
    if (!draftId || !generatedModel || !isRouteComponent(component)) {
      setError('请先选中一条管线，再拖拽端点。');
      return;
    }
    if (component.locked) {
      setError('构件已锁定，不能拖拽管线端点。');
      return;
    }
    const previousEditor = pipeEditor;
    const geometry = component.geometry ?? {};
    const previousPoints = Array.isArray(geometry.points) ? geometry.points : [];
    const first = pointFrom(points[0] ?? previousPoints[0], {
      x: previousEditor.startX,
      y: previousEditor.startY,
      z: previousEditor.startZ,
    });
    const last = pointFrom(points[points.length - 1] ?? previousPoints[previousPoints.length - 1], {
      x: previousEditor.endX,
      y: previousEditor.endY,
      z: previousEditor.endZ,
    });
    const nextEditor = {
      ...previousEditor,
      systemKey: component.systemKey,
      name: component.name,
      diameterMm: numberOr(geometry.diameterMm, previousEditor.diameterMm),
      startX: first.x,
      startY: first.y,
      startZ: first.z,
      endX: last.x,
      endY: last.y,
      endZ: last.z,
      estimatedLengthM: roundLength(distanceBetweenPoints(first, last)),
    };
    setPipeEditor(nextEditor);
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.updateComponent(
        draftId,
        component.id,
        pipeRoutePayload(component.id, points, nextEditor, endpointRefs)
      );
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, routeMutationKind(component, points), 'Update route geometry', before);
      setStatus(`已通过拖拽更新管线构件 v${saved.version}`);
      setModelRecordStatus('构件级拖拽更新已保存到草稿 generated_model；如需模型库同步，请点击保存模型。');
      setSelectedComponent(
        modelFrom(saved.generatedModel)?.components.find((item) => item.id === component.id) ?? null
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteSelectedComponent = async () => {
    if (!draftId || !generatedModel || !selectedComponent) {
      setError('请先选中要删除的构件。');
      return;
    }
    if (selectedComponent.locked) {
      setError('构件已锁定，不能删除。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const deletedId = selectedComponent.id;
      const saved = await viewerDrafts.deleteComponent(draftId, deletedId);
      await persistViewerSummary(saved);
      applyAcceptedDraft(
        saved,
        isRouteComponent(selectedComponent) ? 'route-delete' : 'component-delete',
        isRouteComponent(selectedComponent) ? 'Delete route' : 'Delete component',
        before
      );
      setStatus(`已删除构件 ${deletedId} / v${saved.version}`);
      setModelRecordStatus('构件级修改已保存到草稿 generated_model；如需模型库同步，请点击保存模型。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const deleteComponentFromViewport = async (component: GeneratedHvacComponent) => {
    setSelectedComponent(component);
    if (!draftId || !generatedModel) {
      setError('请先生成暖通模型，再删除构件。');
      return;
    }
    if (component.locked) {
      setError('构件已锁定，不能通过视图删除。');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.deleteComponent(draftId, component.id);
      await persistViewerSummary(saved);
      applyAcceptedDraft(
        saved,
        isRouteComponent(component) ? 'route-delete' : 'component-delete',
        isRouteComponent(component) ? 'Delete route' : 'Delete component',
        before
      );
      setStatus(`已通过 3D 点击删除构件 ${component.id} / v${saved.version}`);
      setModelRecordStatus('构件级点击删除已保存到草稿 generated_model；如需模型库同步，请点击保存模型。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearPropertyEditing();
      setBusy(false);
    }
  };

  const previewSelectedComponent = (component: GeneratedHvacComponent) => {
    setSelectedComponent(component);
    setGeneratedModel((current) => updateModelComponent(current, component));
  };

  const selectComponentFromViewport = (component: GeneratedHvacComponent) => {
    clearPropertyEditing();
    setSelectedComponent(component);
  };

  const clearViewportSelection = () => {
    clearPropertyEditing();
    setSelectedComponent(null);
  };

  const selectComponentFromTree = (component: GeneratedHvacComponent) => {
    clearPropertyEditing();
    setSelectedComponent(component);
    setPipeEditMode('select');
    setStatus(`已选中图层：${componentBusinessName(component)}`);
  };

  const persistComponentTreePatch = async (
    component: GeneratedHvacComponent,
    patch: GeneratedHvacComponentPayload,
    actionLabel: string
  ) => {
    if (!draftId || !generatedModel) {
      setError('请先生成或载入可编辑模型，再管理构件图层。');
      return;
    }
    setSelectedComponent(component);
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.updateComponent(draftId, component.id, {
        id: component.id,
        ...patch,
      });
      await persistViewerSummary(saved);
      applyAcceptedDraft(
        saved,
        Object.prototype.hasOwnProperty.call(patch, 'visibility')
          ? 'visibility-change'
          : Object.prototype.hasOwnProperty.call(patch, 'locked')
            ? 'lock-change'
            : 'property-change',
        actionLabel,
        before
      );
      const nextComponent =
        modelFrom(saved.generatedModel)?.components.find((item) => item.id === component.id) ?? null;
      setSelectedComponent(nextComponent);
      setStatus(`${actionLabel}：${componentBusinessName(nextComponent ?? component)} / v${saved.version}`);
      setModelRecordStatus('对象树图层状态已保存到草稿 generated_model；刷新后会从草稿恢复。');
    } catch (err) {
      setError((err as Error).message);
      setModelRecordStatus(`对象树图层状态保存失败：${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const toggleComponentVisibilityFromTree = (component: GeneratedHvacComponent) =>
    persistComponentTreePatch(
      component,
      { visibility: component.visibility === 'hidden' ? 'visible' : 'hidden' },
      component.visibility === 'hidden' ? '已显示构件' : '已隐藏构件'
    );

  const toggleComponentLockFromTree = (component: GeneratedHvacComponent) =>
    persistComponentTreePatch(
      component,
      { locked: !component.locked },
      component.locked ? '已解锁构件' : '已锁定构件'
    );

  const updateComponentEditor = (patch: Partial<ComponentEditor>) => {
    if (selectedComponent?.locked) {
      setError('构件已锁定，不能编辑属性或旋转。');
      return;
    }
    if (!propertyEditBaselineRef.current) {
      propertyEditBaselineRef.current = currentEditableSnapshot();
    }
    const nextEditor = mergeComponentEditor(
      componentEditor,
      patch,
      selectedComponent?.type,
      building.floorHeight
    );
    setComponentEditor(nextEditor);
    if (!selectedComponent) return;
    const nextComponent = componentFromEditor(selectedComponent, nextEditor);
    previewSelectedComponent(nextComponent);
    if (isRouteComponent(nextComponent)) {
      setPipeEditor((current) => ({
        ...current,
        systemKey: nextComponent.systemKey,
        name: nextComponent.name,
        diameterMm: nextEditor.diameterMm,
        bendRadiusMm: nextEditor.bendRadiusMm,
        startX: nextEditor.startX,
        startY: nextEditor.startY,
        startZ: nextEditor.startZ,
        endX: nextEditor.endX,
        endY: nextEditor.endY,
        endZ: nextEditor.endZ,
        estimatedLengthM: nextEditor.estimatedLengthM,
      }));
    }
  };

  const rotateSelectedComponentBy = (axis: 'x' | 'y' | 'z', degrees: number) => {
    const key =
      axis === 'x' ? 'rotationX' : axis === 'y' ? 'rotationY' : 'rotationZ';
    updateComponentEditor({
      [key]: normalizeRotation(componentEditor[key] + degrees),
    } as Partial<ComponentEditor>);
    clearPropertyEditing();
  };

  const saveSelectedComponentProperties = async (beforeOverride?: ViewerEditableSnapshot | null) => {
    if (!draftId || !generatedModel || !selectedComponent) {
      setError('请先选中一个构件，再保存属性。');
      return;
    }
    if (selectedComponent.locked) {
      setError('构件已锁定，不能保存属性修改。');
      return;
    }
    const validationError = validateComponentEditor(selectedComponent, componentEditor);
    if (validationError) {
      setError(validationError);
      return;
    }
    const before = beforeOverride ?? propertyEditBaselineRef.current ?? currentEditableSnapshot();
    propertyEditBaselineRef.current = null;
    if (viewerSnapshotsEqual(before, currentEditableSnapshot())) {
      clearPropertyEditing();
      return;
    }
    const nextComponent = componentFromEditor(selectedComponent, componentEditor);
    previewSelectedComponent(nextComponent);
    setBusy(true);
    setError(null);
    try {
      const saved = await viewerDrafts.updateComponent(
        draftId,
        nextComponent.id,
        componentPayloadFromComponent(nextComponent)
      );
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, 'property-change', 'Update component properties', before);
      setSelectedComponent(
        modelFrom(saved.generatedModel)?.components.find((item) => item.id === nextComponent.id) ??
          nextComponent
      );
      setStatus(`已保存构件属性 ${nextComponent.name} / v${saved.version}`);
      setModelRecordStatus('构件级属性修改已保存到草稿 generated_model；刷新后会从草稿恢复。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearPropertyEditing();
      setBusy(false);
    }
  };

  const updateMovedComponentFromViewport = async (
    component: GeneratedHvacComponent,
    point: PipePoint
  ) => {
    if (!draftId || !generatedModel || isRouteComponent(component)) return;
    const before = currentEditableSnapshot();
    const current = generatedModel.components.find((item) => item.id === component.id) ?? component;
    const geometry = { ...(current.geometry ?? {}) };
    const y = numberOr(point.y, numberOr(geometry.y, numberOr(current.position?.y, 0)));
    const floor = numberOr(current.floor, numberOr(current.businessMetadata?.floor, 1));
    const floorBase = Math.max(0, (Math.max(1, Math.round(floor)) - 1) * building.floorHeight);
    const installHeight = roundCoord(y - floorBase);
    const movedComponent: GeneratedHvacComponent = {
      ...current,
      position: { ...(current.position ?? {}), x: point.x, y, z: point.z },
      floor,
      elevation: y,
      installHeight,
      geometry: { ...geometry, x: point.x, y, z: point.z },
      businessMetadata: {
        ...(current.businessMetadata ?? {}),
        floor,
        elevation: y,
        installHeight,
        editedBy: 'viewer-component-crud',
        dragUpdatedAt: new Date().toISOString(),
      },
    };
    previewSelectedComponent(movedComponent);
    setComponentEditor(componentEditorFromComponent(movedComponent));
    setBusy(true);
    setError(null);
    try {
      const saved = await viewerDrafts.updateComponent(
        draftId,
        movedComponent.id,
        componentPayloadFromComponent(movedComponent)
      );
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, 'component-move', 'Move component', before);
      setSelectedComponent(
        modelFrom(saved.generatedModel)?.components.find((item) => item.id === movedComponent.id) ??
          movedComponent
      );
      setStatus(`已通过拖拽更新构件位置 ${movedComponent.name} / v${saved.version}`);
      setModelRecordStatus('构件拖拽位置已保存到草稿 generated_model；刷新后会恢复新位置。');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updatePipeEditorFromPoints = (points: PipePoint[]) => {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return;
    if (pipeEditMode === 'draw-pipe') setDraftRoutePoints(points);
    setPipeEditor((current) => ({
      ...current,
      startX: first.x,
      startY: first.y,
      startZ: first.z,
      endX: last.x,
      endY: last.y,
      endZ: last.z,
      estimatedLengthM: roundLength(routeLength(points)),
    }));
  };

  const undoLastDraftRoutePoint = () => {
    const next = draftRoutePoints.slice(0, Math.max(0, draftRoutePoints.length - 1));
    setDraftRoutePoints(next);
    setDraftRouteEndpointRefs((current) =>
      next.length === 0 ? {} : next.length === 1 ? { from: current.from } : current
    );
    updatePipeEditorFromPoints(next);
  };

  const cancelDraftRoute = () => {
    if (draftRoutePoints.length === 0) return;
    setDraftRoutePoints([]);
    setDraftRouteEndpointRefs({});
    setRouteContinuationComponentId(null);
    setRouteContinuationBasePointCount(0);
    setStatus('Route draft cancelled');
  };

  const beginAddRiser = () => {
    if (!draftId || !generatedModel || !selectedComponent || !isRouteComponent(selectedComponent)) {
      setError('Select an editable route before adding a riser.');
      return;
    }
    if (selectedComponent.locked) {
      setError('Locked routes cannot add risers.');
      return;
    }
    const floors = Math.max(1, Math.round(numberOr(building.floors, 1)));
    if (floors < 2) {
      setError('A riser needs at least two floors.');
      return;
    }
    setError(null);
    setDraftRoutePoints([]);
    setDraftRouteEndpointRefs({});
    setRouteContinuationComponentId(null);
    setRouteContinuationBasePointCount(0);
    setPendingRiser(null);
    setPipeEditMode('add-riser');
    setStatus('Add riser: pick a point on the active floor.');
  };

  const handleRiserPoint = (point: PipePoint) => {
    if (!selectedComponent || !isRouteComponent(selectedComponent)) return;
    const floors = Math.max(1, Math.round(numberOr(building.floors, 1)));
    const sourceFloor = Math.min(floors, Math.max(1, Math.round(activeFloor)));
    const targetFloor = sourceFloor === 1 ? Math.min(2, floors) : sourceFloor - 1;
    const installHeight = installHeightFromElevation({
      floor: sourceFloor,
      elevation: routeDraftPlacement.elevation,
      floorHeight: building.floorHeight,
      fallback: pipeEditor.startY,
    });
    const sourceElevation = roundCoord((sourceFloor - 1) * building.floorHeight + installHeight);
    const targetElevation = roundCoord((targetFloor - 1) * building.floorHeight + installHeight);
    setPendingRiser({
      componentId: selectedComponent.id,
      sourceFloor,
      targetFloor,
      point: { x: roundCoord(point.x), y: sourceElevation, z: roundCoord(point.z) },
      installHeight,
      sourceElevation,
      targetElevation,
    });
    setPipeEditMode('select');
    setStatus('Riser point selected. Confirm target floor.');
  };

  const cancelPendingRiser = () => {
    setPendingRiser(null);
    setPipeEditMode('edit-pipe');
    setStatus('Riser cancelled');
  };

  const updatePendingRiserTargetFloor = (value: string) => {
    const targetFloor = Math.round(numberOr(value, pendingRiser?.targetFloor ?? 1));
    setPendingRiser((current) => {
      if (!current) return current;
      const nextTarget = Math.max(1, targetFloor);
      const targetElevation = roundCoord((nextTarget - 1) * building.floorHeight + current.installHeight);
      return { ...current, targetFloor: nextTarget, targetElevation };
    });
  };

  const confirmPendingRiser = async () => {
    if (!draftId || !generatedModel || !pendingRiser) return;
    if (pendingRiser.sourceFloor === pendingRiser.targetFloor) {
      setError('Riser target floor must differ from source floor.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const before = currentEditableSnapshot();
      const saved = await viewerDrafts.addRiser(draftId, pendingRiser.componentId, {
        sourceFloor: pendingRiser.sourceFloor,
        targetFloor: pendingRiser.targetFloor,
        point: { x: pendingRiser.point.x, z: pendingRiser.point.z },
      });
      await persistViewerSummary(saved);
      applyAcceptedDraft(saved, 'riser-create', 'Create riser', before);
      const updatedRoute =
        modelFrom(saved.generatedModel)?.components.find((item) => item.id === pendingRiser.componentId) ??
        null;
      const savedPoints = Array.isArray(updatedRoute?.geometry?.points)
        ? updatedRoute.geometry.points.map((point) => pointFrom(point, pendingRiser.point))
        : [];
      const targetPoint = savedPoints[savedPoints.length - 1] ?? {
        x: pendingRiser.point.x,
        y: pendingRiser.targetElevation,
        z: pendingRiser.point.z,
      };
      if (updatedRoute) setSelectedComponent(updatedRoute);
      setActiveFloor(pendingRiser.targetFloor);
      setDraftRoutePoints([targetPoint]);
      setDraftRouteEndpointRefs((updatedRoute?.route?.endpointRefs as RouteEndpointRefs) ?? {});
      setRouteContinuationComponentId(pendingRiser.componentId);
      setRouteContinuationBasePointCount(savedPoints.length);
      setPipeEditor((current) => ({
        ...current,
        systemKey: updatedRoute?.systemKey ?? current.systemKey,
        name: updatedRoute?.name ?? current.name,
        startX: targetPoint.x,
        startY: targetPoint.y,
        startZ: targetPoint.z,
        endX: targetPoint.x,
        endY: targetPoint.y,
        endZ: targetPoint.z,
      }));
      setPendingRiser(null);
      setPipeEditMode('draw-pipe');
      setStatus(`Riser added to floor ${pendingRiser.targetFloor}; continue drawing the same route.`);
    } catch (err) {
      setPendingRiser(null);
      setPipeEditMode('edit-pipe');
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finishDraftRoute = async () => {
    if (!routeDraftCanFinish(draftRoutePoints)) {
      setError('Route draft needs at least two valid 3D points before finish.');
      return;
    }
    if (routeContinuationComponentId) {
      const route = generatedModel?.components.find((item) => item.id === routeContinuationComponentId);
      if (!route || !isRouteComponent(route)) {
        setRouteContinuationComponentId(null);
        setRouteContinuationBasePointCount(0);
        setError('Route continuation source no longer exists.');
        return;
      }
      const existingPoints = Array.isArray(route.geometry?.points)
        ? route.geometry.points
            .slice(0, Math.max(0, routeContinuationBasePointCount))
            .map((point) => pointFrom(point, { x: 0, y: 0, z: 0 }))
        : [];
      const firstDraftPoint = draftRoutePoints[0];
      const continuationPoints =
        existingPoints.length && firstDraftPoint && samePipePoint(existingPoints[existingPoints.length - 1], firstDraftPoint)
          ? draftRoutePoints.slice(1)
          : draftRoutePoints;
      const mergedPoints = [...existingPoints, ...continuationPoints];
      setRouteContinuationComponentId(null);
      setRouteContinuationBasePointCount(0);
      setDraftRoutePoints([]);
      await updatePipeRouteFromViewport(route, mergedPoints, draftRouteEndpointRefs);
      setPipeEditMode('edit-pipe');
      return;
    }
    await createPipeRouteFromViewport(draftRoutePoints, draftRouteEndpointRefs);
  };

  return (
    <section
      className="h-full min-h-0 bg-[#f7f9fc] text-slate-900 max-[980px]:h-auto"
      data-viewer-shell="unified-dark-three-column"
    >
      <div className="grid h-full min-h-0 grid-cols-[300px_minmax(0,1fr)_320px] gap-3 p-3 max-[980px]:h-auto max-[980px]:grid-cols-1 max-[980px]:overflow-visible">
        <aside className="min-h-0 overflow-auto border border-slate-200 bg-white max-[980px]:min-h-fit max-[980px]:overflow-visible">
          <div className="border-b border-slate-200 px-5 py-3">
            <div>
              <p className="text-xl font-bold text-[#ff315c]">
                Rysnova
              </p>
              <h2 className="mt-2 text-xs font-medium text-slate-500">3D暖通专业设计架构</h2>
            </div>
            <span className="mt-2 inline-flex shrink-0 border border-slate-200 px-2 py-1 text-xs text-slate-500">
              v{version ?? 0}
            </span>
          </div>
          <div
            className="grid grid-cols-2 gap-2 border-b border-slate-200 px-5 py-3"
            data-left-panel-switch="viewer-parameters-catalog"
          >
            <button
              className={`h-9 rounded-md border text-xs font-bold ${
                leftPanelMode === 'parameters'
                  ? 'border-[#d4143a] bg-[#d4143a] text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => setLeftPanelMode('parameters')}
              type="button"
            >
              项目参数
            </button>
            <button
              className={`h-9 rounded-md border text-xs font-bold ${
                leftPanelMode === 'catalog'
                  ? 'border-[#d4143a] bg-[#d4143a] text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
              onClick={() => setLeftPanelMode('catalog')}
              type="button"
            >
              构件库
            </button>
          </div>
          {leftPanelMode === 'parameters' ? (
            <>
              <div className="border-b border-slate-200 px-5 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">项目信息</p>
                <Field
                  label="项目名称"
                  value={project.name}
                  onChange={(value) => setProject({ ...project, name: value })}
                />
                <Field
                  label="城市"
                  value={project.city}
                  onChange={(value) => setProject({ ...project, city: value })}
                />
              </div>
              <div className="border-b border-slate-200 px-5 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">建筑参数</p>
                <NumberField
                  label="建筑面积"
                  suffix="m²"
                  value={building.area}
                  onChange={(value) => setBuilding({ ...building, area: value })}
                />
                <NumberField
                  label="楼层数"
                  value={building.floors}
                  onChange={(value) => setBuilding({ ...building, floors: value })}
                />
                <NumberField
                  label="层高"
                  suffix="m"
                  value={building.floorHeight}
                  onChange={(value) => setBuilding({ ...building, floorHeight: value })}
                />
                <NumberField
                  label="房间数"
                  value={building.roomCount}
                  onChange={(value) => setBuilding({ ...building, roomCount: value })}
                />
              </div>
              <div className="px-5 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">系统选择</p>
                <SelectField
                  label="制冷系统"
                  value={systems.coolingSystem}
                  options={COOLING_OPTIONS}
                  onChange={(value) => setSystems({ ...systems, coolingSystem: value })}
                />
                <SelectField
                  label="采暖系统"
                  value={systems.heatingSystem}
                  options={HEATING_OPTIONS}
                  onChange={(value) => setSystems({ ...systems, heatingSystem: value })}
                />
                <button
                  className="mt-3 h-11 w-full rounded-md border border-[#d4143a] bg-[#d4143a] text-sm font-bold text-white shadow-[0_10px_24px_rgba(212,20,58,0.25)] disabled:opacity-50"
                  onClick={generateModel}
                  disabled={busy}
                >
                  开始3D设计
                </button>
                <button
                  className="mt-3 h-10 w-full rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 disabled:opacity-50"
                  onClick={saveDraft}
                  disabled={busy}
                  data-viewer-save-draft="true"
                >
                  快速估算
                </button>
                <input
                  ref={legacyDesignerFileInputRef}
                  className="hidden"
                  type="file"
                  accept=".json,.rh-design.json,application/json"
                  onChange={(event) => {
                    void importLegacyDesigner2d(event.target.files?.[0]);
                  }}
                  data-legacy-designer-2d-file-input="true"
                />
                <button
                  className="mt-3 h-10 w-full rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 disabled:opacity-50"
                  onClick={openLegacyDesignerImport}
                  disabled={busy}
                  type="button"
                  data-legacy-designer-2d-import="true"
                >
                  导入 4001 2D 图纸
                </button>
                <p className="mt-2 text-[11px] text-slate-500">{legacyConversionStatus}</p>
              </div>
            </>
          ) : (
            <ToolPaletteComponentCatalogPanel
              catalog={componentCatalog}
              catalogGroups={catalogGroups}
              status={catalogStatus}
              selectedTemplateId={selectedCatalogTemplate?.id ?? null}
              toolPaletteMode={toolPaletteMode}
              templateDefaultOverrides={templateDefaultOverrides}
              onToolPaletteModeChange={setToolPaletteMode}
              onSelect={selectCatalogTemplate}
              onUpdateTemplateDefault={updateTemplateDefaultOverride}
              onPlaceTemplate={(template) =>
                void placeCatalogTemplateInViewport(template.id, { x: 0, y: 0, z: 0 })
              }
              onTemplateDragStart={beginCatalogTemplateDrag}
            />
          )}
        </aside>

        <main className="flex min-h-[620px] min-w-0 flex-col border border-slate-200 bg-white max-[980px]:min-h-[560px]">
          <div className="flex min-h-[74px] items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {['3D视图', '平面图', '立面图', '管道', '设备'].map((mode, index) => (
                  <span
                    key={mode}
                    className={`inline-flex h-9 items-center rounded-md border px-4 text-xs font-bold ${
                      index === 0
                        ? 'border-[#d4143a] bg-[#d4143a] text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {mode}
                  </span>
                ))}
              </div>
              <h1 className="truncate text-base font-semibold">3D 暖通专业设计 · {project.name}</h1>
              <p className="mt-1 text-xs text-slate-500">
                {project.city} / {building.area} m² / {building.floors}层 /{' '}
                {building.roomCount}个房间
                {generatedModel ? ` / 参数化模型 v${generatedModel.modelVersion}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="h-9 rounded-md border border-[#d4143a] bg-[#d4143a] px-3 text-sm font-semibold text-white disabled:opacity-50"
                onClick={generateModel}
                disabled={busy}
              >
                生成暖通模型
              </button>
              {generatedModel ? (
                <button
                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
                  onClick={() => {
                    if (!confirmDiscardUnsavedHistory('Switch viewer source')) return;
                    setGeneratedModel(null);
                    setSelectedComponent(null);
                    setModelObjects([]);
                    activeModelSourceIdRef.current = undefined;
                    clearCommandHistoryAt(snapshotViewerEditableState(null));
                  }}
                >
                  文件/成果视图
                </button>
              ) : null}
              <select
                className="h-9 max-w-[220px] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                value={artifactId ?? ''}
                onChange={(event) => {
                  if (!confirmDiscardUnsavedHistory('Switch artifact')) return;
                  const nextArtifactId = event.target.value || undefined;
                  setArtifactId(nextArtifactId);
                  setGeneratedModel(null);
                  setSelectedComponent(null);
                  activeModelSourceIdRef.current = undefined;
                  clearCommandHistoryAt(snapshotViewerEditableState(null));
                }}
                aria-label="成果模型来源"
              >
                <option value="">本地 IFC/GLB 文件</option>
                {artifacts.map((artifact: any) => (
                  <option key={artifact.id} value={artifact.id}>
                    {displayArtifactName(artifact)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ViewportEditToolbar
            floorOptions={floorOptions}
            activeFloor={activeFloor}
            activeFloorLabel={activeFloorLabel}
            floorViewMode={floorViewMode}
            pipeEditMode={pipeEditMode}
            busy={busy}
            generatedModelReady={Boolean(generatedModel)}
            canUndo={historyCanUndo}
            canRedo={historyCanRedo}
            canAddRiser={canAddRiserFromToolbar}
            canDeleteSelected={canDeleteSelectedEditableObject}
            onUndo={undoCommandHistory}
            onRedo={redoCommandHistory}
            onFloorChange={changeActiveFloor}
            onFloorViewModeChange={setFloorViewMode}
            onSelectTool={() => {
              cancelDraftRoute();
              setPipeEditMode('select');
            }}
            onDrawPipe={() => setPipeEditMode('draw-pipe')}
            onMoveTool={() => {
              cancelDraftRoute();
              setPipeEditMode('move-component');
            }}
            onEditPipe={() => {
              cancelDraftRoute();
              setPipeEditMode('edit-pipe');
            }}
            onAddRiser={beginAddRiser}
            onDeleteTool={() => {
              cancelDraftRoute();
              setPipeEditMode('delete');
            }}
          />
          <div className="min-h-0 flex-1">
            {generatedModel ? (
              <GeneratedHvacViewport
                model={generatedModel}
                componentTemplates={componentCatalog?.templates}
                templateDefaultOverrides={templateDefaultOverrides}
                outsidePlacementMarginM={project.outsidePlacementMarginM}
                visibility={visibility}
                selectedId={selectedComponent?.id}
                floorViewMode={floorViewMode}
                activeFloor={activeFloor}
                editMode={pipeEditMode}
                floorHeight={building.floorHeight}
                onSelect={selectComponentFromViewport}
                onClearSelection={clearViewportSelection}
                onTemplateDrop={placeCatalogTemplateInViewport}
                onComponentMove={updateMovedComponentFromViewport}
                draftRoutePoints={draftRoutePoints}
                routeDraftFloor={routeDraftPlacement.floor}
                routeDraftElevation={routeDraftPlacement.elevation}
                routeDraftSystemKey={pipeEditor.systemKey as GeneratedHvacComponent['systemKey']}
                routeDraftType={
                  selectedCatalogTemplate?.type === 'duct-route' ? 'duct-route' : 'pipe-route'
                }
                draftRouteEndpointRefs={draftRouteEndpointRefs}
                onPipeDraftChange={updatePipeEditorFromPoints}
                onPipeDraftEndpointRefsChange={setDraftRouteEndpointRefs}
                onPipeCreate={createPipeRouteFromViewport}
                onPipeUpdate={updatePipeRouteFromViewport}
                onRiserPoint={handleRiserPoint}
                onDelete={deleteComponentFromViewport}
                onInteractionStateChange={setViewerInteractionState}
              />
            ) : (
              <BimViewer
                key={artifactId || 'local-ifc'}
                artifactId={artifactId}
                onModelEvent={handleModelEvent}
                status={
                  artifactId
                    ? `正在加载成果 ${artifactId}`
                    : '打开本地 IFC/GLB 文件，或选择已审核的成果模型'
                }
              />
            )}
          </div>
        </main>

        <aside className="flex min-h-0 flex-col overflow-auto border border-slate-200 bg-white max-[980px]:min-h-fit">
          <h2 className="border-b border-slate-200 px-5 py-5 text-base font-bold text-[#d4143a]">构件检查器</h2>
          <div
            className="border-b border-slate-200 px-5 py-5"
            data-model-object-tree-panel="true"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">模型对象树 / 图层</p>
              <span className="shrink-0 text-[11px] text-slate-500">
                {generatedModel?.componentSummary.total ?? modelObjects.length}个对象
              </span>
            </div>
            <ModelObjectTreePanel
              groups={modelObjectTreeGroups}
              busy={busy}
              onSelectComponent={selectComponentFromTree}
              onOpenSource={openModelRecord}
              onToggleVisibility={toggleComponentVisibilityFromTree}
              onToggleLock={toggleComponentLockFromTree}
            />
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-500">生成模型控制</p>
                <span className="text-[11px] text-slate-500">临时过滤</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Toggle
                  label="制冷"
                  checked={visibility.cooling}
                  onChange={(value) => setVisibility({ ...visibility, cooling: value })}
                />
                <Toggle
                  label="采暖"
                  checked={visibility.heating}
                  onChange={(value) => setVisibility({ ...visibility, heating: value })}
                />
                <Toggle
                  label="新风"
                  checked={visibility.freshAir}
                  onChange={(value) => setVisibility({ ...visibility, freshAir: value })}
                />
                <Toggle
                  label="管道"
                  checked={visibility.pipes}
                  onChange={(value) => setVisibility({ ...visibility, pipes: value })}
                />
                <Toggle
                  label="设备"
                  checked={visibility.equipment}
                  onChange={(value) => setVisibility({ ...visibility, equipment: value })}
                />
              </div>
            </div>
          </div>
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-400">规范合规</p>
              <StatePill state={designSummary.complianceSummary.state} />
            </div>
            <div className="mt-3 space-y-2">
              {designSummary.complianceSummary.checks.map((check) => (
                <div key={check.key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-xs">
                  <StatePill state={check.state} />
                  <p className="min-w-0 text-slate-400">
                    <span className="block truncate text-slate-800" title={displayComplianceLabel(check.label)}>
                      {displayComplianceLabel(check.label)}
                    </span>
                    <span className="block text-[11px] text-slate-500">{displayComplianceDetail(check.detail)}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-400">构件编辑</p>
              <StatePill state={generatedModel ? 'ready' : 'pending'} />
            </div>
            {pipeEditMode === 'draw-pipe' ? (
              <div
                className="mt-3 rounded-md border border-slate-200 bg-[#f8fafc] p-2"
                data-route-draft-controls="true"
                data-route-draft-point-count={draftRoutePoints.length}
              >
                <div className="grid grid-cols-3 gap-2">
                  <ActionButton
                    label="Finish route"
                    onClick={finishDraftRoute}
                    disabled={busy || !routeDraftCanFinish(draftRoutePoints)}
                  />
                  <ActionButton
                    label="Undo point"
                    onClick={undoLastDraftRoutePoint}
                    disabled={busy || draftRoutePoints.length === 0}
                  />
                  <ActionButton
                    label="Cancel route"
                    tone="danger"
                    onClick={cancelDraftRoute}
                    disabled={busy || draftRoutePoints.length === 0}
                  />
                </div>
              </div>
            ) : null}
            {pendingRiser ? (
              <div
                className="mt-3 rounded-md border border-slate-200 bg-[#f8fafc] p-2"
                data-route-riser-confirm="true"
                data-route-riser-source-floor={pendingRiser.sourceFloor}
                data-route-riser-target-floor={pendingRiser.targetFloor}
              >
                <label className="block text-xs font-semibold text-slate-500">
                  Target floor
                  <select
                    className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#d4143a]"
                    value={String(pendingRiser.targetFloor)}
                    onChange={(event) => updatePendingRiserTargetFloor(event.target.value)}
                    disabled={busy}
                  >
                    {floorOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={Number(option.value) === pendingRiser.sourceFloor}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-[11px] text-slate-500">
                  x/z {pendingRiser.point.x}, {pendingRiser.point.z} / y{' '}
                  {pendingRiser.sourceElevation}m -&gt; {pendingRiser.targetElevation}m
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ActionButton
                    label="Confirm riser"
                    onClick={confirmPendingRiser}
                    disabled={busy || pendingRiser.sourceFloor === pendingRiser.targetFloor}
                  />
                  <ActionButton
                    label="Cancel riser"
                    tone="danger"
                    onClick={cancelPendingRiser}
                    disabled={busy}
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <ActionButton
                label="新增管线"
                onClick={createPipeRouteComponent}
                disabled={busy || !generatedModel}
              />
              <ActionButton
                label="更新选中"
                onClick={updateSelectedPipeRouteComponent}
                disabled={busy || !selectedComponent || !isRouteComponent(selectedComponent)}
              />
              <ActionButton
                label="删除选中"
                tone="danger"
                onClick={deleteSelectedComponent}
                disabled={busy || !selectedComponent}
              />
            </div>
            {selectedComponent ? (
              <SelectedComponentEditor
                component={selectedComponent}
                editor={componentEditor}
                busy={busy}
                onChange={updateComponentEditor}
                onRotate={rotateSelectedComponentBy}
                onSave={saveSelectedComponentProperties}
                onDelete={deleteSelectedComponent}
                interactionState={viewerInteractionState}
                onPropertyFocus={beginPropertyEditing}
                onPropertyBlur={handlePropertyEditorBlur}
                onPropertyKeyDown={handlePropertyEditorKeyDown}
                error={error}
              />
            ) : (
              <p className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
                选中墙体、门窗、设备或管线后，可编辑构件属性并保存到草稿。
              </p>
            )}
          </div>
          <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white px-5 py-5">
            {error ? (
              <p className="mb-3 border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            ) : null}
            <p className="mb-3 text-xs text-slate-400">
              {status}
              {savedAt ? ` / ${new Date(savedAt).toLocaleString()}` : ''}
            </p>
            <p className="mb-3 text-xs font-semibold text-slate-500" data-viewer-dirty-state={historyDirty ? 'dirty' : 'clean'}>
              {historyDirty ? '未保存修改' : draftId ? '草稿已保存' : '尚未保存草稿'}
            </p>
            <div
              className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
              data-viewer-history="true"
              data-viewer-history-can-undo={historyCanUndo ? 'true' : 'false'}
              data-viewer-history-can-redo={historyCanRedo ? 'true' : 'false'}
              data-viewer-history-dirty={historyDirty ? 'true' : 'false'}
            >
              Undo {historyCanUndo ? 'ready' : 'idle'} / Redo {historyCanRedo ? 'ready' : 'idle'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="h-10 rounded-md border border-[#d4143a] bg-[#d4143a] text-sm font-semibold text-white disabled:opacity-50"
                onClick={saveDraft}
                disabled={busy}
                data-viewer-save-draft="true"
              >
                {busy ? '保存中…' : '保存草稿'}
              </button>
              <button
                className="h-10 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 disabled:opacity-50"
                onClick={() => draftId && loadDraft(draftId)}
                disabled={busy || !draftId}
                data-viewer-reload-draft="true"
              >
                {busy ? '载入中…' : '重新载入'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );

  function applyDraft(draft: ViewerDraft) {
    setDraftId(draft.id);
    setVersion(draft.version);
    setSavedAt(draft.updatedAt);
    setArtifactId(draft.artifactId ?? artifactId);
    setProject({ ...DEFAULT_PROJECT, ...(draft.projectInputs as Partial<ProjectInputs>) });
    setBuilding({ ...DEFAULT_BUILDING, ...(draft.buildingInputs as Partial<BuildingInputs>) });
    setSystems({ ...DEFAULT_SYSTEMS, ...(draft.systemInputs as Partial<SystemInputs>) });
    const model = modelFrom(draft.generatedModel);
    setGeneratedModel(model);
    setModelObjects(
      model
        ? model.components.map((item) => ({ id: item.id, name: item.name, type: item.type }))
        : []
    );
    setSelectedComponent((current) => {
      if (!model) return null;
      if (current) {
        const refreshed = model.components.find((item) => item.id === current.id);
        if (refreshed) return refreshed;
      }
      return (
        model.components.find((item) => item.type === 'equipment') ?? model.components[0] ?? null
      );
    });
    updateUrl(draft);
  }

  async function persistDraft() {
    const payload: ViewerDraftPayload = {
      id: draftId,
      projectId: params.get('projectId'),
      designProjectId: params.get('designProjectId'),
      bimProjectId: params.get('bimProjectId'),
      customerId: params.get('customerId'),
      opportunityId: params.get('opportunityId'),
      contractId: params.get('contractId'),
      artifactId: artifactId ?? null,
      projectInputs: project,
      buildingInputs: building,
      systemInputs: systems,
      generatedModel: generatedModel ?? undefined,
    };
    return viewerDrafts.save(payload);
  }

  async function persistViewerSummary(draft: ViewerDraft) {
    const summary = buildViewerDesignSummary({
      project,
      building,
      systems,
      draftId: draft.id,
      generatedModel: selectViewerSummaryModel(
        draft.generatedModel as Record<string, unknown> | undefined,
        generatedModel as unknown as Record<string, unknown> | null,
        loadedModelSummary
      ),
    });
    const saved = await viewerSummaries.save({
      draftId: draft.id,
      draftVersion: draft.version,
      modelId: summary.modelId,
      modelVersion: summary.modelVersion,
      projectId: draft.projectId ?? params.get('projectId'),
      designProjectId: draft.designProjectId ?? params.get('designProjectId'),
      bimProjectId: draft.bimProjectId ?? params.get('bimProjectId'),
      trustStatus: summary.trustStatus,
      calculationSummary: summary.calculationSummary,
      equipmentSummary: summary.equipmentSummary,
      pipeSummary: summary.pipeSummary,
      complianceSummary: summary.complianceSummary,
    });
    setPersistedSummary(saved);
    setSummaryStatus(
      `已保存设计摘要：${displayState(saved.trustStatus)} / ${displayState(String(saved.complianceSummary?.state ?? 'pending'))}`
    );
    setHandoffStatus('下游 2D、BOM 和报价入口可重新载入这份数据库上下文。');
  }

  async function persistGeneratedModelSource(draft: ViewerDraft, model: GeneratedHvacModel | null) {
    if (!model) return;
    const saved = await modelSources.save({
      ...modelBinding,
      draftId: draft.id,
      sourceType: 'generated',
      modelType: 'generated',
      artifactId: null,
      uploadReference: null,
      loadStatus: 'ready',
      loadError: null,
      metadata: {
        name: model.id,
        modelVersion: model.modelVersion,
        componentCount: model.componentSummary.total,
      },
      componentSummary: {
        ...model.componentSummary,
        generatedModelSnapshot: model,
        components: model.components.map((component) => ({
          id: component.id,
          type: component.type,
          systemKey: component.systemKey,
          name: component.name,
        })),
      },
    });
    activeModelSourceIdRef.current = saved.id;
    setActiveModelSource(saved);
    setModelObjects(
      model.components.map((component) => ({
        id: component.id,
        name: component.name,
        type: component.type,
      }))
    );
    setModelRecordStatus(
      `模型来源 ${displayState(saved.loadStatus)} / ${displayModelType(saved.modelType)} v${saved.version}`
    );
  }

  function pipeRoutePayload(
    componentId?: string,
    points?: PipePoint[],
    editor = pipeEditor,
    endpointRefs?: RouteEndpointRefs
  ): GeneratedHvacComponentPayload {
    const routeTemplate = isRouteTemplate(selectedCatalogTemplate) ? selectedCatalogTemplate : null;
    const routeType: 'pipe-route' | 'duct-route' =
      componentId && selectedComponent && isRouteComponent(selectedComponent)
        ? (selectedComponent.type as 'pipe-route' | 'duct-route')
        : routeTemplate?.type === 'duct-route'
          ? 'duct-route'
          : 'pipe-route';
    const bomCategory = routeTemplate?.bomMapping.category ?? routeType;
    const bomSkuHint =
      routeTemplate?.bomMapping.skuPrefix ?? `${editor.systemKey.toUpperCase()}-MANUAL-PIPE`;
    const size =
      routeType === 'duct-route'
        ? {
            width: numberOr(routeTemplate?.defaultDimensions.widthMm, 320),
            height: numberOr(routeTemplate?.defaultDimensions.heightMm, 200),
          }
        : { diameterMm: editor.diameterMm };
    const baseRoute = buildLogicalRouteShapeFromDraft({
      points: points ?? [
        { x: editor.startX, y: editor.startY, z: editor.startZ },
        { x: editor.endX, y: editor.endY, z: editor.endZ },
      ],
      floorHeight: building.floorHeight,
      systemKey: editor.systemKey as GeneratedHvacComponent['systemKey'],
      routeType,
      size,
      material: routeTemplate?.defaultDimensions.material,
      insulation:
        routeTemplate?.defaultDimensions.insulationMm !== undefined
          ? {
              thicknessMm: routeTemplate.defaultDimensions.insulationMm,
              material: routeTemplate.defaultDimensions.insulationMaterial,
            }
          : null,
      bendRadius:
        componentId && selectedComponent && isRouteComponent(selectedComponent)
          ? selectedComponent.route?.bendRadius
        : routeTemplate?.defaultDimensions.bendRadiusM !== undefined
          ? { radiusM: routeTemplate.defaultDimensions.bendRadiusM }
          : editor.bendRadiusMm > 0
            ? { radiusM: editor.bendRadiusMm / 1000 }
          : null,
      endpointRefs:
        endpointRefs ??
        (componentId && selectedComponent && isRouteComponent(selectedComponent)
          ? selectedComponent.route?.endpointRefs
          : draftRouteEndpointRefs),
      bomMapping: {
        bomMappable: true,
        bomCategory,
        bomSkuHint,
        unit: 'm',
        measurementKey: routeTemplate?.bomMapping.measurementKey ?? 'estimatedLengthM',
      },
    });
    const existingTransitions =
      componentId && selectedComponent && isRouteComponent(selectedComponent)
        ? selectedComponent.route?.crossFloorTransitions ?? []
        : [];
    const route = existingTransitions.length
      ? {
          ...baseRoute,
          crossFloorTransitions: existingTransitions,
          summary: {
            ...baseRoute.summary,
            transitionCount: existingTransitions.length,
          },
        }
      : baseRoute;
    const routePoints = route.points;
    const first = routePoints[0] ?? { x: editor.startX, y: editor.startY, z: editor.startZ };
    const floor = route.floors[0]?.floor ?? numberOr(selectedComponent?.businessMetadata?.floor, 1);
    const elevation = first.y;
    const floorBase = Math.max(0, (Math.max(1, Math.round(floor)) - 1) * building.floorHeight);
    const installHeight = roundCoord(elevation - floorBase);
    const lengthM = route.summary.totalLengthM;
    return {
      id: componentId,
      type: routeType,
      systemKey: editor.systemKey as GeneratedHvacComponent['systemKey'],
      name: editor.name || '手动管线',
      displayName: editor.name || '手动管线',
      sourceTemplateId: routeTemplate?.id,
      rotation: { x: 0, y: 0, z: 0 },
      visibility: 'visible',
      locked: false,
      floor,
      elevation,
      installHeight,
      position: { x: first.x, y: elevation, z: first.z },
      businessMetadata: {
        ...(routeTemplate?.defaultDimensions ?? {}),
        bomMappable: true,
        bomCategory,
        bomSkuHint,
        estimatedLengthM: lengthM,
        material: route.material,
        insulationMm: route.insulation?.thicknessMm,
        floor,
        elevation,
        installHeight,
        editedBy: 'viewer-component-crud',
        routeSummary: route.summary,
        endpointRefs: route.endpointRefs,
      },
      bomMetadata: {
        bomMappable: true,
        bomCategory,
        bomSkuHint,
        quantity: lengthM,
        unit: 'm',
        estimatedLengthM: lengthM,
      },
      geometry: {
        kind: 'polyline',
        ...size,
        points: routePoints,
      },
      route,
    };
  }

  function updateUrl(draft: ViewerDraft) {
    const next = new URLSearchParams(params.toString());
    next.set('draftId', draft.id);
    if (draft.artifactId) next.set('artifactId', draft.artifactId);
    window.history.replaceState(null, '', `/viewer?${next.toString()}`);
  }
}

function Field(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-400">
      {props.label}
      <input
        className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#d4143a] disabled:bg-slate-100 disabled:text-slate-400"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        data-route-name-input={props.label === '管线名称' ? 'true' : undefined}
      />
    </label>
  );
}

function NumberField(props: {
  label: string;
  suffix?: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-slate-400">
      {props.label}
      <div className="mt-1 flex h-8 rounded-md border border-slate-300 bg-white focus-within:border-[#d4143a]">
        <input
          className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none"
          type="number"
          value={props.value}
          disabled={props.disabled}
          onChange={(event) => props.onChange(numberValue(event.target.value))}
        />
        {props.suffix ? (
          <span className="flex items-center border-l border-slate-800 px-2 text-xs text-slate-500">
            {props.suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-1.5 block text-xs font-semibold text-slate-400">
      {props.label}
      <select
        className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#d4143a]"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectedComponentEditor(props: {
  component: GeneratedHvacComponent;
  editor: ComponentEditor;
  busy: boolean;
  onChange: (patch: Partial<ComponentEditor>) => void;
  onRotate: (axis: 'x' | 'y' | 'z', degrees: number) => void;
  onSave: () => void;
  onDelete: () => void;
  interactionState: ViewerInteractionState;
  onPropertyFocus: () => void;
  onPropertyBlur: (event: FocusEvent<HTMLElement>) => void;
  onPropertyKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  error?: string | null;
}) {
  const component = props.component;
  const editor = props.editor;
  const route = isRouteComponent(component);
  const wall = component.type === 'wall';
  const opening = component.type === 'door' || component.type === 'window';
  const equipment = component.type === 'equipment';
  const locked = component.locked;
  const title = userFacingComponentTitle(component, editor.name);
  return (
    <div
      className="mt-4 border-t border-slate-200 pt-4"
      data-selected-component-editor="true"
      data-selected-component-id={component.id}
      data-selected-component-type={component.type}
      data-viewer-interaction-state={props.interactionState}
      onFocus={props.onPropertyFocus}
      onBlur={props.onPropertyBlur}
      onKeyDown={props.onPropertyKeyDown}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">选中构件属性</p>
          <h3 className="mt-1 truncate text-sm font-bold text-slate-900" title={title}>
            {title}
          </h3>
        </div>
        <span className="shrink-0 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-500">
          {displayComponentType(component.type)}
        </span>
      </div>
      {locked ? (
        <p className="mt-3 rounded border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
          构件已锁定，属性、尺寸、位置、旋转和删除操作已禁用。
        </p>
      ) : null}
      {props.error ? (
        <p className="mt-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {props.error}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Field label="名称" value={editor.name} disabled={locked} onChange={(name) => props.onChange({ name })} />
        <SelectField
          label="系统"
          value={editor.systemKey}
          options={COMPONENT_SYSTEM_OPTIONS}
          disabled={locked}
          onChange={(systemKey) => props.onChange({ systemKey })}
        />
        <SelectField
          label="状态"
          value={editor.status}
          options={COMPONENT_STATUS_OPTIONS}
          disabled={locked}
          onChange={(status) => props.onChange({ status: status as ComponentEditor['status'] })}
        />
        <Toggle
          label="显示"
          checked={editor.visible}
          disabled={locked}
          onChange={(visible) => props.onChange({ visible })}
        />
        <Toggle
          label="锁定"
          checked={editor.locked}
          disabled={locked}
          onChange={(locked) => props.onChange({ locked })}
        />
        <div className="mb-1.5 text-xs font-semibold text-slate-400">
          <Detail label="类型" value={displayComponentType(component.type)} />
        </div>
        <NumberField label="楼层" value={editor.floor} disabled={locked} onChange={(floor) => props.onChange({ floor })} />
        <NumberField label="位置X" suffix="m" value={editor.x} disabled={locked} onChange={(x) => props.onChange({ x })} />
        <NumberField label="位置Y" suffix="m" value={editor.y} disabled={locked} onChange={(y) => props.onChange({ y })} />
        <NumberField label="位置Z" suffix="m" value={editor.z} disabled={locked} onChange={(z) => props.onChange({ z })} />
        <NumberField
          label="标高"
          suffix="m"
          value={editor.elevation}
          disabled={locked}
          onChange={(elevation) => props.onChange({ elevation })}
        />
        <NumberField
          label="安装高度"
          suffix="m"
          value={editor.installHeight}
          disabled={locked}
          onChange={(installHeight) => props.onChange({ installHeight })}
        />
        <NumberField
          label="旋转X"
          suffix="deg"
          value={editor.rotationX}
          disabled={locked}
          onChange={(rotationX) => props.onChange({ rotationX })}
        />
        <NumberField
          label="旋转Y"
          suffix="deg"
          value={editor.rotationY}
          disabled={locked}
          onChange={(rotationY) => props.onChange({ rotationY })}
        />
        <NumberField
          label="旋转Z"
          suffix="deg"
          value={editor.rotationZ}
          disabled={locked}
          onChange={(rotationZ) => props.onChange({ rotationZ })}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2" data-component-rotation-controls="true">
        <ActionButton label="X +90" onClick={() => props.onRotate('x', 90)} disabled={props.busy || locked} />
        <ActionButton label="Y +90" onClick={() => props.onRotate('y', 90)} disabled={props.busy || locked} />
        <ActionButton label="Z +90" onClick={() => props.onRotate('z', 90)} disabled={props.busy || locked} />
        <ActionButton label="X -90" onClick={() => props.onRotate('x', -90)} disabled={props.busy || locked} />
        <ActionButton label="Y -90" onClick={() => props.onRotate('y', -90)} disabled={props.busy || locked} />
        <ActionButton label="Z -90" onClick={() => props.onRotate('z', -90)} disabled={props.busy || locked} />
      </div>

      {wall ? (
        <section className="mt-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">墙体</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="长度" suffix="m" value={editor.length} disabled={locked} onChange={(length) => props.onChange({ length })} />
            <NumberField label="厚度" suffix="m" value={editor.thickness} disabled={locked} onChange={(thickness) => props.onChange({ thickness })} />
            <NumberField label="高度" suffix="m" value={editor.height} disabled={locked} onChange={(height) => props.onChange({ height })} />
            <Field label="墙体类型" value={editor.wallType} disabled={locked} onChange={(wallType) => props.onChange({ wallType })} />
            <NumberField label="起点X" suffix="m" value={editor.startX} disabled={locked} onChange={(startX) => props.onChange({ startX })} />
            <NumberField label="起点Y" suffix="m" value={editor.startY} disabled={locked} onChange={(startY) => props.onChange({ startY })} />
            <NumberField label="起点Z" suffix="m" value={editor.startZ} disabled={locked} onChange={(startZ) => props.onChange({ startZ })} />
            <NumberField label="终点X" suffix="m" value={editor.endX} disabled={locked} onChange={(endX) => props.onChange({ endX })} />
            <NumberField label="终点Y" suffix="m" value={editor.endY} disabled={locked} onChange={(endY) => props.onChange({ endY })} />
            <NumberField label="终点Z" suffix="m" value={editor.endZ} disabled={locked} onChange={(endZ) => props.onChange({ endZ })} />
          </div>
        </section>
      ) : null}

      {opening ? (
        <section className="mt-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">门窗</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="宽度" suffix="m" value={editor.width} disabled={locked} onChange={(width) => props.onChange({ width })} />
            <NumberField label="高度" suffix="m" value={editor.height} disabled={locked} onChange={(height) => props.onChange({ height })} />
            <NumberField label="厚度" suffix="m" value={editor.thickness} disabled={locked} onChange={(thickness) => props.onChange({ thickness })} />
            <NumberField label="离地高度" suffix="m" value={editor.elevation} disabled={locked} onChange={(elevation) => props.onChange({ elevation })} />
            <Field label="开启方向" value={editor.openingDirection} disabled={locked} onChange={(openingDirection) => props.onChange({ openingDirection })} />
          </div>
        </section>
      ) : null}

      {equipment ? (
        <section className="mt-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">设备</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="长度" suffix="m" value={editor.length} disabled={locked} onChange={(length) => props.onChange({ length })} />
            <NumberField label="宽度" suffix="m" value={editor.width} disabled={locked} onChange={(width) => props.onChange({ width })} />
            <NumberField label="高度" suffix="m" value={editor.height} disabled={locked} onChange={(height) => props.onChange({ height })} />
            <NumberField label="容量" suffix="kW" value={editor.capacityKw} disabled={locked} onChange={(capacityKw) => props.onChange({ capacityKw })} />
            <Field label="型号" value={editor.modelSku} disabled={locked} onChange={(modelSku) => props.onChange({ modelSku })} />
            <Field label="安装方式" value={editor.installMethod} disabled={locked} onChange={(installMethod) => props.onChange({ installMethod })} />
            <Detail label="所属系统" value={displaySystemKey(editor.systemKey)} />
            <Field label="接口方向" value={editor.connectionDirection} disabled={locked} onChange={(connectionDirection) => props.onChange({ connectionDirection })} />
          </div>
        </section>
      ) : null}

      {route ? (
        <section className="mt-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">管线</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="管线名称" value={editor.name} disabled={locked} onChange={(name) => props.onChange({ name })} />
            <SelectField
              label="管线系统"
              value={editor.systemKey}
              options={PIPE_SYSTEM_OPTIONS}
              disabled={locked}
              onChange={(systemKey) => props.onChange({ systemKey })}
            />
            {component.type === 'duct-route' ? (
              <>
                <NumberField label="风管宽度" suffix="mm" value={editor.width} disabled={locked} onChange={(width) => props.onChange({ width })} />
                <NumberField label="风管高度" suffix="mm" value={editor.height} disabled={locked} onChange={(height) => props.onChange({ height })} />
              </>
            ) : (
              <NumberField label="管径" suffix="mm" value={editor.diameterMm} disabled={locked} onChange={(diameterMm) => props.onChange({ diameterMm })} />
            )}
            <Field label="材质" value={editor.material} disabled={locked} onChange={(material) => props.onChange({ material })} />
            <Field label="保温信息" value={editor.insulationInfo} disabled={locked} onChange={(insulationInfo) => props.onChange({ insulationInfo })} />
            <NumberField label="保温厚度" suffix="mm" value={editor.insulationMm} disabled={locked} onChange={(insulationMm) => props.onChange({ insulationMm })} />
            <NumberField label="起点标高" suffix="m" value={editor.startY} disabled={locked} onChange={(startY) => props.onChange({ startY })} />
            <NumberField label="终点标高" suffix="m" value={editor.endY} disabled={locked} onChange={(endY) => props.onChange({ endY })} />
            <Detail label="计算长度" value={routeLengthLabel(component, editor)} />
            <NumberField label="弯曲半径" suffix="mm" value={editor.bendRadiusMm} disabled={locked} onChange={(bendRadiusMm) => props.onChange({ bendRadiusMm })} />
            <Detail label="端点连接" value={routeEndpointConnectionLabel(component)} />
            <Detail label="节点连接" value={routeJunctionConnectionLabel(component)} />
          </div>
        </section>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ActionButton label="保存属性" onClick={props.onSave} disabled={props.busy || locked} />
        <ActionButton label="删除构件" tone="danger" onClick={props.onDelete} disabled={props.busy || locked} />
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        尺寸和旋转会立即更新 3D 对象；保存后刷新/重新打开会恢复尺寸、位置、旋转和删除状态。
      </p>
    </div>
  );
}

function userFacingComponentTitle(component: GeneratedHvacComponent, editorName: string): string {
  const candidates = [editorName, component.displayName, component.name].map((value) =>
    String(value ?? '').trim()
  );
  const title = candidates.find((value) => value && !looksLikeUuid(value));
  return title || displayComponentType(component.type);
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function routeLengthLabel(component: GeneratedHvacComponent, editor: ComponentEditor): string {
  const points = Array.isArray(component.geometry?.points) ? component.geometry.points : [];
  const lengthM =
    roundAcceptedLength(
      numberOr(
        component.route?.summary?.totalLengthM ??
          component.bomMetadata?.estimatedLengthM ??
          component.dimensions?.estimatedLengthM ??
          component.businessMetadata?.estimatedLengthM,
        0
      )
    ) || (points.length >= 2 ? roundAcceptedLength(routeLength(points)) : editor.estimatedLengthM);
  return `${lengthM} m`;
}

function routeEndpointConnectionLabel(component: GeneratedHvacComponent): string {
  const refs = component.route?.endpointRefs as Record<string, any> | undefined;
  const from = endpointStatusLabel(refs?.from?.status);
  const to = endpointStatusLabel(refs?.to?.status);
  return `起点 ${from} / 终点 ${to}`;
}

function routeJunctionConnectionLabel(component: GeneratedHvacComponent): string {
  const transitions = component.route?.crossFloorTransitions ?? [];
  const refs = component.route?.endpointRefs as Record<string, any> | undefined;
  const statuses = [refs?.from?.status, refs?.to?.status].filter(Boolean);
  if (statuses.includes('stale')) return '存在失效连接';
  return transitions.length ? `${transitions.length} 个跨层节点` : '无跨层节点';
}

function endpointStatusLabel(status: unknown): string {
  if (status === 'connected') return '已连接';
  if (status === 'stale') return '失效';
  if (status === 'disconnected') return '未连接';
  return '未连接';
}

function routeBendRadiusMm(component: GeneratedHvacComponent): number {
  const routeRadius = component.route?.bendRadius as Record<string, unknown> | null | undefined;
  return numberOr(
    component.businessMetadata?.bendRadiusMm ??
      component.businessMetadata?.bendRadius ??
      routeRadius?.radiusMm ??
      (routeRadius?.radiusM !== undefined ? numberOr(routeRadius.radiusM, 0) * 1000 : undefined),
    0
  );
}

function validateComponentEditor(
  component: GeneratedHvacComponent,
  editor: ComponentEditor
): string | null {
  if (!editor.name.trim()) return '名称不能为空，请输入中文构件名称。';
  if (looksLikeUuid(editor.name.trim())) return '名称不能使用系统 UUID，请输入中文构件名称。';
  for (const [label, value] of [
    ['楼层', editor.floor],
    ['位置X', editor.x],
    ['位置Y', editor.y],
    ['位置Z', editor.z],
    ['标高', editor.elevation],
    ['安装高度', editor.installHeight],
    ['旋转X', editor.rotationX],
    ['旋转Y', editor.rotationY],
    ['旋转Z', editor.rotationZ],
  ] as Array<[string, number]>) {
    if (!Number.isFinite(value)) return `${label} 必须是有效数字。`;
  }
  if (!Number.isInteger(editor.floor) || editor.floor < 1) return '楼层必须是大于 0 的整数。';
  if (editor.elevation < 0 || editor.y < 0) return '标高必须大于或等于 0。';
  if (editor.installHeight < 0) return '安装高度必须大于或等于 0。';
  for (const [label, value] of [
    ['旋转X', editor.rotationX],
    ['旋转Y', editor.rotationY],
    ['旋转Z', editor.rotationZ],
  ] as Array<[string, number]>) {
    if (value < -360 || value > 360) return `${label} 必须在 -360 到 360 度之间。`;
  }

  const positiveFields: Array<[string, number]> = [];
  if (component.type === 'wall') {
    positiveFields.push(['长度', editor.length], ['厚度', editor.thickness], ['高度', editor.height]);
  } else if (component.type === 'door' || component.type === 'window') {
    positiveFields.push(['宽度', editor.width], ['高度', editor.height], ['厚度', editor.thickness]);
  } else if (component.type === 'equipment') {
    positiveFields.push(['长度', editor.length], ['宽度', editor.width], ['高度', editor.height]);
    if (editor.capacityKw < 0) return '容量不能为负数。';
  } else if (isRouteComponent(component)) {
    positiveFields.push(['长度估算', editor.estimatedLengthM]);
    if (component.type === 'duct-route') {
      positiveFields.push(['风管宽度', editor.width], ['风管高度', editor.height]);
    } else {
      positiveFields.push(['管径', editor.diameterMm]);
    }
    if (editor.insulationMm < 0) return '保温厚度不能为负数。';
    if (!Number.isFinite(editor.bendRadiusMm)) return '弯曲半径必须是有效数字。';
    if (editor.bendRadiusMm < 0) return '弯曲半径不能为负数。';
  }

  for (const [label, value] of positiveFields) {
    if (!Number.isFinite(value)) return `${label} 必须是有效数字。`;
    if (value <= 0) return `${label} 必须大于 0。`;
  }
  return null;
}

function componentEditorErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rotation .* between -360 and 360/i.test(message)) return '旋转角度必须在 -360 到 360 度之间。';
  if (/positive number/i.test(message)) return '尺寸、管径、长度估算等数值必须大于 0。';
  if (/displayName/i.test(message)) return '中文名称不能为空，且长度不能超过 120 个字符。';
  if (/visibility/i.test(message)) return '显示状态只能是显示或隐藏。';
  if (/locked|lockState/i.test(message)) return '锁定状态只能是锁定或解锁。';
  return message || '构件属性保存失败，请检查输入。';
}

function ToolPaletteComponentCatalogPanel(props: {
  catalog: ViewerComponentCatalog | null;
  catalogGroups: Array<
    ViewerComponentCatalog['categories'][number] & {
      templates: ViewerComponentCatalogTemplate[];
    }
  >;
  status: string;
  selectedTemplateId: string | null;
  toolPaletteMode: ToolPaletteMode;
  templateDefaultOverrides: Record<string, CatalogTemplateDefaultOverrides>;
  onToolPaletteModeChange: (mode: ToolPaletteMode) => void;
  onSelect: (template: ViewerComponentCatalogTemplate) => void;
  onUpdateTemplateDefault: (
    templateId: string,
    key: string,
    value: string | number | boolean
  ) => void;
  onPlaceTemplate: (template: ViewerComponentCatalogTemplate) => void;
  onTemplateDragStart: (
    event: DragEvent<HTMLButtonElement>,
    template: ViewerComponentCatalogTemplate
  ) => void;
}) {
  const activeTool =
    TOOL_PALETTE_MODES.find((item) => item.key === props.toolPaletteMode) ?? TOOL_PALETTE_MODES[0];
  const selectedTemplate =
    props.catalog?.templates.find((template) => template.id === props.selectedTemplateId) ?? null;
  const visibleGroups =
    props.toolPaletteMode === 'edit'
      ? []
      : props.catalogGroups
          .filter((category) => activeTool.categoryKeys.includes(category.key))
          .map((category) =>
            props.toolPaletteMode === 'annotation'
              ? {
                  ...category,
                  templates: category.templates.filter((template) => template.type === 'room-zone'),
                }
              : category
          )
          .filter((category) => category.templates.length > 0);

  return (
    <div
      className="flex min-h-0 gap-3 px-3 py-3"
      data-left-panel-mode="component-catalog"
      data-selected-template-id={props.selectedTemplateId ?? ''}
      data-tool-palette-mode={props.toolPaletteMode}
    >
      <div
        className="flex w-12 shrink-0 flex-col gap-1"
        data-tool-palette-rail="viewer-component-library"
      >
        {TOOL_PALETTE_MODES.map((mode) => (
          <button
            key={mode.key}
            className={`flex min-h-[54px] w-12 flex-col items-center justify-center rounded-md border px-1 text-[11px] font-bold leading-tight ${
              props.toolPaletteMode === mode.key
                ? 'border-[#d4143a] bg-[#d4143a] text-white'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
            onClick={() => props.onToolPaletteModeChange(mode.key)}
            type="button"
            title={mode.label}
            data-tool-palette-rail-item={mode.key}
          >
            <span className="text-sm leading-none">{mode.icon}</span>
            <span className="mt-1 truncate">{mode.label}</span>
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-500">3D 构件工具面板</p>
          <p className="mt-1 text-[11px] text-slate-500">{props.status}</p>
        </div>
        <div
          className="mb-3 grid grid-cols-5 gap-1"
          data-tool-palette-segmented="布局,设备,管路,标注,编辑"
        >
          {TOOL_PALETTE_MODES.map((mode) => (
            <button
              key={mode.key}
              className={`h-8 rounded-md border px-1 text-[11px] font-bold ${
                props.toolPaletteMode === mode.key
                  ? 'border-[#d4143a] bg-[#fff1f4] text-[#d4143a]'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
              onClick={() => props.onToolPaletteModeChange(mode.key)}
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>

        {visibleGroups.length ? (
          <div className="space-y-3">
            {visibleGroups.map((category) => (
              <section key={category.key} data-component-category={category.key}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="truncate text-xs font-bold text-slate-800">{category.label}</h3>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {category.templates.length} 个
                  </span>
                </div>
                <div className="space-y-2">
                  {category.templates.map((template) => {
                    const selected = template.id === props.selectedTemplateId;
                    const overrides = props.templateDefaultOverrides[template.id] ?? {};
                    return (
                      <button
                        key={template.id}
                        className={`block w-full rounded-md border p-2 text-left text-xs ${
                          selected
                            ? 'border-[#d4143a] bg-[#fff1f4]'
                            : 'border-slate-200 bg-[#f8fafc]'
                        }`}
                        data-component-template-id={template.id}
                        data-component-template-type={template.type}
                        data-component-template-system={template.systemKey}
                        data-template-default-overrides={Object.keys(overrides).join(',')}
                        draggable
                        onClick={() => props.onSelect(template)}
                        onDragStart={(event) => props.onTemplateDragStart(event, template)}
                        type="button"
                      >
                        <span className="flex items-start gap-2">
                          <TemplateModelGlyph template={template} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-slate-900">
                              {displayTemplateName(template, overrides)}
                            </span>
                            <span className="mt-1 block truncate text-[11px] text-slate-500">
                              {templateDefaultSummary(template, overrides)}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : props.toolPaletteMode === 'edit' ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-[#f8fafc] p-3 text-xs text-slate-500">
            选择任一构件卡片后，可在这里调整放置前默认参数。
          </p>
        ) : (
          <p className="text-xs text-slate-500">当前分类暂无可用模板，请从后端构件目录补充。</p>
        )}

        <TemplateDefaultEditor
          template={selectedTemplate}
          overrides={selectedTemplate ? props.templateDefaultOverrides[selectedTemplate.id] ?? {} : {}}
          onChange={props.onUpdateTemplateDefault}
          onPlace={props.onPlaceTemplate}
        />
      </div>
    </div>
  );
}

function TemplateDefaultEditor(props: {
  template: ViewerComponentCatalogTemplate | null;
  overrides: CatalogTemplateDefaultOverrides;
  onChange: (templateId: string, key: string, value: string | number | boolean) => void;
  onPlace: (template: ViewerComponentCatalogTemplate) => void;
}) {
  if (!props.template) {
    return null;
  }
  const template = props.template;
  return (
    <section
      className="mt-3 rounded-md border border-slate-200 bg-white p-3"
      data-template-default-editor={template.id}
    >
      <div className="mb-2 min-w-0">
        <p className="truncate text-xs font-bold text-slate-800">默认参数：{template.label}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">
          编辑结果保存在页面状态，后续拖拽放置会读取这些默认值。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <label className="block text-[11px] font-semibold text-slate-500">
          楼层
          <input
            className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#d4143a]"
            type="number"
            min={1}
            step={1}
            value={String(props.overrides.floor ?? 1)}
            onChange={(event) => props.onChange(template.id, 'floor', numberValue(event.target.value))}
          />
        </label>
        <label className="block text-[11px] font-semibold text-slate-500">
          安装高度
          <input
            className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#d4143a]"
            type="number"
            min={0}
            step={0.1}
            value={String(props.overrides.installHeight ?? 0)}
            onChange={(event) =>
              props.onChange(template.id, 'installHeight', numberValue(event.target.value))
            }
          />
        </label>
        {template.editableProperties.map((property) => (
          <TemplateDefaultField
            key={property.key}
            template={template}
            property={property}
            value={templateDefaultValue(template, property, props.overrides)}
            onChange={props.onChange}
          />
        ))}
      </div>
      <button
        className="mt-3 h-9 w-full rounded-md border border-[#d4143a] bg-[#d4143a] px-2 text-xs font-bold text-white disabled:opacity-50"
        data-template-click-place={template.id}
        onClick={() => props.onPlace(template)}
        type="button"
      >
        放置到视图中心
      </button>
    </section>
  );
}

function TemplateDefaultField(props: {
  template: ViewerComponentCatalogTemplate;
  property: ViewerComponentCatalogTemplate['editableProperties'][number];
  value: string | number | boolean;
  onChange: (templateId: string, key: string, value: string | number | boolean) => void;
}) {
  const { template, property } = props;
  if (property.input === 'select') {
    return (
      <label className="block text-[11px] font-semibold text-slate-500">
        {property.label}
        <select
          className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#d4143a]"
          value={String(props.value)}
          onChange={(event) => props.onChange(template.id, property.key, event.target.value)}
        >
          {(property.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (property.input === 'number') {
    return (
      <label className="block text-[11px] font-semibold text-slate-500">
        {property.label}
        <div className="mt-1 flex h-8 rounded-md border border-slate-300 bg-white focus-within:border-[#d4143a]">
          <input
            className="min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold text-slate-900 outline-none"
            type="number"
            value={Number(props.value)}
            onChange={(event) =>
              props.onChange(template.id, property.key, numberValue(event.target.value))
            }
          />
          {property.unit ? (
            <span className="flex items-center border-l border-slate-200 px-2 text-[11px] text-slate-500">
              {property.unit}
            </span>
          ) : null}
        </div>
      </label>
    );
  }
  if (property.input === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
        <span className="truncate">{property.label}</span>
        <input
          type="checkbox"
          checked={Boolean(props.value)}
          onChange={(event) => props.onChange(template.id, property.key, event.target.checked)}
        />
      </label>
    );
  }
  return (
    <label className="block text-[11px] font-semibold text-slate-500">
      {property.label}
      <input
        className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#d4143a]"
        value={String(props.value)}
        onChange={(event) => props.onChange(template.id, property.key, event.target.value)}
      />
    </label>
  );
}

function templateDefaultValue(
  template: ViewerComponentCatalogTemplate,
  property: ViewerComponentCatalogTemplate['editableProperties'][number],
  overrides: CatalogTemplateDefaultOverrides
): string | number | boolean {
  if (overrides[property.key] !== undefined) return overrides[property.key];
  if (property.key === 'displayName') return template.label;
  if (property.key === 'systemKey') return template.systemKey;
  if (template.defaultDimensions[property.key] !== undefined) {
    return template.defaultDimensions[property.key];
  }
  return property.defaultValue ?? '';
}

function displayTemplateName(
  template: ViewerComponentCatalogTemplate,
  overrides: CatalogTemplateDefaultOverrides
): string {
  const value = overrides.displayName;
  return typeof value === 'string' && value.trim() ? value.trim() : template.label;
}

function templateDefaultSummary(
  template: ViewerComponentCatalogTemplate,
  overrides: CatalogTemplateDefaultOverrides
): string {
  const dimensions = { ...template.defaultDimensions, ...overrides };
  const keys =
    template.type === 'pipe-route' || template.type === 'duct-route'
      ? ['diameterMm', 'widthMm', 'heightMm', 'estimatedLengthM']
      : template.type === 'door' || template.type === 'window'
        ? ['widthM', 'heightM', 'thicknessMm', 'sillHeightM', 'openingDirection']
        : template.type === 'room-zone'
          ? ['areaM2', 'heightM', 'designCoolingLoadKw', 'designHeatingLoadKw']
        : template.type === 'equipment'
          ? ['floor', 'installHeight', 'widthM', 'depthM', 'heightM', 'nominalCapacityKw']
          : ['floor', 'installHeight', 'lengthM', 'widthM', 'heightM', 'thicknessMm', 'areaM2'];
  return keys
    .filter((key) => dimensions[key] !== undefined && dimensions[key] !== '')
    .slice(0, 4)
    .map((key) => `${templateDimensionLabel(key)} ${formatTemplateValue(key, dimensions[key])}`)
    .join(' / ');
}

function templateDimensionLabel(key: string): string {
  const labels: Record<string, string> = {
    widthM: '宽',
    depthM: '深',
    heightM: '高',
    lengthM: '长',
    thicknessMm: '厚',
    sillHeightM: '离地',
    areaM2: '面积',
    diameterMm: '管径',
    widthMm: '宽',
    heightMm: '高',
    estimatedLengthM: '长度',
    floor: '楼层',
    installHeight: '安装高',
    material: '材质',
    openingDirection: '方向',
    modelSku: '型号',
    installMethod: '安装',
    nominalCapacityKw: '容量',
    designCoolingLoadKw: '冷负荷',
    designHeatingLoadKw: '热负荷',
  };
  return labels[key] ?? key;
}

function formatTemplateValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (key === 'floor') return `${String(value)}F`;
  if (key === 'installHeight') return `${String(value)}m`;
  const suffix = key.endsWith('Mm')
    ? 'mm'
    : key.endsWith('M')
      ? 'm'
      : key.endsWith('M2')
        ? 'm2'
        : '';
  return `${String(value)}${suffix}`;
}

function ComponentCatalogPanel(props: {
  catalog: ViewerComponentCatalog | null;
  catalogGroups: Array<
    ViewerComponentCatalog['categories'][number] & {
      templates: ViewerComponentCatalogTemplate[];
    }
  >;
  status: string;
  selectedTemplateId: string | null;
  onSelect: (template: ViewerComponentCatalogTemplate) => void;
  onTemplateDragStart: (
    event: DragEvent<HTMLButtonElement>,
    template: ViewerComponentCatalogTemplate
  ) => void;
}) {
  return (
    <div
      className="px-5 py-3"
      data-left-panel-mode="component-catalog"
      data-selected-template-id={props.selectedTemplateId ?? ''}
    >
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-500">3D 构件库</p>
        <p className="mt-1 text-[11px] text-slate-500">{props.status}</p>
      </div>
      {props.catalogGroups.length ? (
        <div className="space-y-4">
          {props.catalogGroups.map((category) => (
            <section key={category.key} data-component-category={category.key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-800">{category.label}</h3>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {category.templates.length}个
                </span>
              </div>
              <div className="space-y-2">
                {category.templates.map((template) => {
                  const selected = template.id === props.selectedTemplateId;
                  return (
                    <button
                      key={template.id}
                      className={`block w-full rounded-md border p-2 text-left text-xs ${
                        selected
                          ? 'border-[#d4143a] bg-[#fff1f4]'
                          : 'border-slate-200 bg-[#f8fafc]'
                      }`}
                      data-component-template-id={template.id}
                      data-component-template-type={template.type}
                      data-component-template-system={template.systemKey}
                      draggable
                      onClick={() => props.onSelect(template)}
                      onDragStart={(event) => props.onTemplateDragStart(event, template)}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <TemplateModelGlyph template={template} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-slate-900">
                            {template.label}
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-slate-500">
                            {templateDefaultSummary(template, {})}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">构件库暂未返回可用模板。</p>
      )}
    </div>
  );
}

function TemplateModelGlyph(props: { template: ViewerComponentCatalogTemplate }) {
  const type = props.template.type;
  const color =
    props.template.systemKey === 'cooling'
      ? 'bg-sky-500'
      : props.template.systemKey === 'heating'
        ? 'bg-red-500'
        : props.template.systemKey === 'freshAir'
          ? 'bg-emerald-500'
          : props.template.systemKey === 'zone'
            ? 'bg-slate-300'
            : 'bg-slate-700';
  if (type === 'pipe-route' || type === 'duct-route') {
    return (
      <span
        className="relative h-9 w-12 shrink-0 rounded border border-slate-200 bg-white"
        data-template-model-glyph={type}
      >
        <span className={`absolute left-1 top-4 h-1 w-10 rotate-[-18deg] rounded ${color}`} />
        <span className={`absolute right-1 top-2 h-2.5 w-2.5 rounded-full ${color}`} />
      </span>
    );
  }
  if (type === 'equipment') {
    return (
      <span
        className="relative h-9 w-12 shrink-0 rounded border border-slate-200 bg-white"
        data-template-model-glyph={type}
      >
        <span className={`absolute left-2 top-2 h-5 w-7 rounded-sm shadow-sm ${color}`} />
        <span className="absolute right-2 top-3 h-3 w-1.5 rounded-sm bg-slate-700" />
        <span className="absolute left-3 top-7 h-1 w-6 rounded bg-slate-300" />
      </span>
    );
  }
  if (type === 'door' || type === 'window') {
    return (
      <span
        className="relative h-9 w-12 shrink-0 rounded border border-slate-200 bg-white"
        data-template-model-glyph={type}
      >
        <span className={`absolute left-3 top-2 h-6 w-5 rounded-sm ${color}`} />
        <span className="absolute left-4 top-3 h-4 w-3 rounded-sm border border-white/80" />
      </span>
    );
  }
  return (
    <span
      className="relative h-9 w-12 shrink-0 rounded border border-slate-200 bg-white"
      data-template-model-glyph={type}
    >
      <span
        className={`absolute left-2 top-3 h-3 w-8 rounded-sm ${color} ${
          type === 'room-zone' ? 'opacity-40' : ''
        }`}
      />
      <span className="absolute left-3 top-2 h-3 w-8 skew-x-[-18deg] rounded-sm bg-slate-200/80" />
    </span>
  );
}

function renderTemplateDragPreview(template: ViewerComponentCatalogTemplate): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('data-template-drag-model-preview', template.type);
  node.style.position = 'fixed';
  node.style.left = '-200px';
  node.style.top = '-200px';
  node.style.width = '96px';
  node.style.height = '68px';
  node.style.border = '1px solid #cbd5e1';
  node.style.borderRadius = '8px';
  node.style.background = '#ffffff';
  node.style.boxShadow = '0 10px 30px rgba(15, 23, 42, 0.18)';
  node.style.transform = 'rotateX(58deg) rotateZ(-24deg)';
  node.style.transformOrigin = '50% 50%';
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = template.type === 'pipe-route' || template.type === 'duct-route' ? '12px' : '26px';
  body.style.top = template.type === 'pipe-route' || template.type === 'duct-route' ? '32px' : '18px';
  body.style.width = template.type === 'pipe-route' || template.type === 'duct-route' ? '72px' : '44px';
  body.style.height = template.type === 'pipe-route' || template.type === 'duct-route' ? '5px' : '30px';
  body.style.borderRadius = '3px';
  body.style.background =
    template.systemKey === 'cooling'
      ? '#0ea5e9'
      : template.systemKey === 'heating'
        ? '#ef4444'
        : template.systemKey === 'freshAir'
          ? '#22c55e'
          : '#334155';
  node.appendChild(body);
  document.body.appendChild(node);
  window.setTimeout(() => node.remove(), 0);
  return node;
}

function ModelObjectTreePanel(props: {
  groups: ModelObjectTreeGroup[];
  busy: boolean;
  onSelectComponent: (component: GeneratedHvacComponent) => void;
  onOpenSource: (id: string) => void;
  onToggleVisibility: (component: GeneratedHvacComponent) => void;
  onToggleLock: (component: GeneratedHvacComponent) => void;
}) {
  return (
    <div className="mt-3 max-h-[360px] space-y-3 overflow-auto pr-1" data-model-object-tree="true">
      {props.groups.map((group) => (
        <section
          key={group.key}
          className="rounded-md border border-slate-200 bg-[#f8fafc]"
          data-model-object-tree-group={group.label}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-2">
            <p className="min-w-0 truncate text-xs font-bold text-slate-700" title={group.label}>
              {group.label}
            </p>
            <span className="shrink-0 text-[11px] text-slate-500">{group.nodes.length}</span>
          </div>
          <div className="space-y-1 p-1.5">
            {group.nodes.length ? (
              group.nodes.map((node) => (
                <ModelObjectTreeRow
                  key={`${node.kind}-${node.id}`}
                  node={node}
                  busy={props.busy}
                  onSelectComponent={props.onSelectComponent}
                  onOpenSource={props.onOpenSource}
                  onToggleVisibility={props.onToggleVisibility}
                  onToggleLock={props.onToggleLock}
                />
              ))
            ) : (
              <p className="px-2 py-1.5 text-xs text-slate-500">暂无对象</p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function ModelObjectTreeRow(props: {
  node: ModelObjectTreeNode;
  busy: boolean;
  onSelectComponent: (component: GeneratedHvacComponent) => void;
  onOpenSource: (id: string) => void;
  onToggleVisibility: (component: GeneratedHvacComponent) => void;
  onToggleLock: (component: GeneratedHvacComponent) => void;
}) {
  const node = props.node;
  const selected =
    node.kind === 'component' || node.kind === 'source' ? node.selected : false;
  const click = () => {
    if (node.kind === 'component') props.onSelectComponent(node.component);
    if (node.kind === 'source') props.onOpenSource(node.source.id);
  };
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-1.5 text-xs ${
        selected ? 'border-[#d4143a] bg-[#fff1f2]' : 'border-transparent bg-white'
      }`}
      data-model-object-tree-node={node.kind}
      data-model-object-component-id={node.kind === 'component' ? node.id : undefined}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left disabled:cursor-default"
        onClick={click}
        disabled={props.busy || node.kind === 'project'}
        title={node.label}
      >
        <span className="block min-w-0 truncate font-semibold text-slate-800">{node.label}</span>
        <span className="block min-w-0 truncate text-[11px] text-slate-500" title={node.meta}>
          {node.meta}
        </span>
      </button>
      {node.kind === 'component' ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="h-7 w-7 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              props.onToggleVisibility(node.component);
            }}
            disabled={props.busy}
            title={node.visible ? '隐藏构件' : '显示构件'}
            aria-label={node.visible ? '隐藏构件' : '显示构件'}
          >
            {node.visible ? '显' : '隐'}
          </button>
          <button
            type="button"
            className="h-7 w-7 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation();
              props.onToggleLock(node.component);
            }}
            disabled={props.busy}
            title={node.locked ? '解锁构件' : '锁定构件'}
            aria-label={node.locked ? '解锁构件' : '锁定构件'}
          >
            {node.locked ? '锁' : '开'}
          </button>
        </span>
      ) : null}
    </div>
  );
}

function StatePill(props: { state: string }) {
  const tone =
    props.state === 'passed' || props.state === 'verified' || props.state === 'active' || props.state === 'ready'
      ? 'border-emerald-700 bg-emerald-950/50 text-emerald-200'
      : props.state === 'failed'
        ? 'border-red-800 bg-red-950/50 text-red-200'
        : props.state === 'warning' || props.state === 'estimate' || props.state === 'archived'
          ? 'border-amber-800 bg-amber-950/50 text-amber-200'
          : 'border-slate-300 bg-white text-slate-700';
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded border px-2 text-[11px] font-semibold tracking-normal ${tone}`}
    >
      {displayState(props.state)}
    </span>
  );
}

function ViewportEditToolbar(props: {
  floorOptions: SelectOption[];
  activeFloor: number;
  activeFloorLabel: string;
  floorViewMode: ViewerFloorViewMode;
  pipeEditMode: PipeEditMode;
  busy: boolean;
  generatedModelReady: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canAddRiser: boolean;
  canDeleteSelected: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFloorChange: (value: string) => void;
  onFloorViewModeChange: (mode: ViewerFloorViewMode) => void;
  onSelectTool: () => void;
  onDrawPipe: () => void;
  onMoveTool: () => void;
  onEditPipe: () => void;
  onAddRiser: () => void;
  onDeleteTool: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur"
      data-viewer-viewport-toolbar="true"
      data-toolbar-active-floor={props.activeFloor}
      data-toolbar-active-floor-label={props.activeFloorLabel}
      data-toolbar-pipe-edit-mode={props.pipeEditMode}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden pb-1">
        <div className="flex shrink-0 items-center gap-1" data-toolbar-group="history">
          <ToolbarButton
            order="01-undo"
            label="撤销"
            icon="↶"
            tooltip="撤销上一个编辑动作"
            onClick={props.onUndo}
            disabled={props.busy || !props.canUndo}
            busy={props.busy}
          />
          <ToolbarButton
            order="02-redo"
            label="重做"
            icon="↷"
            tooltip="重做上一个撤销动作"
            onClick={props.onRedo}
            disabled={props.busy || !props.canRedo}
            busy={props.busy}
          />
        </div>
        <div
          className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2"
          data-toolbar-group="floor"
          data-floor-isolation-controls="true"
          data-floor-view-mode={props.floorViewMode}
          data-floor-view-active-floor={props.activeFloor}
        >
          <label
            className="flex h-10 min-w-[136px] shrink-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
            title={`当前楼层 ${props.activeFloorLabel}`}
            data-viewer-toolbar-order="03-floor"
          >
            <span className="shrink-0 text-[11px] text-slate-500">楼层</span>
            <select
              className="h-7 min-w-[78px] rounded border border-slate-200 bg-white px-1 text-xs font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-[#d4143a]"
              value={String(props.activeFloor)}
              onChange={(event) => props.onFloorChange(event.target.value)}
              disabled={props.busy || props.pipeEditMode === 'add-riser'}
              aria-label={`当前楼层 ${props.activeFloorLabel}`}
              title={`当前楼层 ${props.activeFloorLabel}`}
              data-active-route-floor-select="true"
            >
              {props.floorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <ToolbarButton
            order="04-single-floor"
            label="单层"
            icon="1F"
            tooltip="只显示当前楼层"
            active={props.floorViewMode === 'single-floor'}
            onClick={() => props.onFloorViewModeChange('single-floor')}
            disabled={!props.generatedModelReady || props.busy}
            busy={props.busy}
          />
          <ToolbarButton
            order="05-all-floors"
            label="全部楼层"
            icon="ALL"
            tooltip="显示全部楼层"
            active={props.floorViewMode === 'all-floors'}
            onClick={() => props.onFloorViewModeChange('all-floors')}
            disabled={!props.generatedModelReady || props.busy}
            busy={props.busy}
          />
        </div>
        <div
          className="flex shrink-0 items-center gap-1 border-l border-slate-200 pl-2"
          data-toolbar-group="tools"
        >
          <ToolbarButton
            order="06-select"
            label="选择"
            icon="◎"
            tooltip="选择构件"
            mode="select"
            active={props.pipeEditMode === 'select'}
            onClick={props.onSelectTool}
            disabled={props.busy}
            busy={props.busy}
          />
          <ToolbarButton
            order="07-draw-pipe"
            label="画管"
            icon="╱"
            tooltip="绘制管线路径"
            mode="draw-pipe"
            active={props.pipeEditMode === 'draw-pipe'}
            onClick={props.onDrawPipe}
            disabled={!props.generatedModelReady || props.busy}
            busy={props.busy}
          />
          <ToolbarButton
            order="08-move-component"
            label="移动"
            icon="↕"
            tooltip="移动构件"
            mode="move-component"
            active={props.pipeEditMode === 'move-component'}
            onClick={props.onMoveTool}
            disabled={!props.generatedModelReady || props.busy}
            busy={props.busy}
          />
          <ToolbarButton
            order="09-edit-pipe"
            label="拖端点"
            icon="●-●"
            tooltip="拖拽管线端点或折点"
            mode="edit-pipe"
            active={props.pipeEditMode === 'edit-pipe'}
            onClick={props.onEditPipe}
            disabled={!props.generatedModelReady || props.busy}
            busy={props.busy}
          />
          <ToolbarButton
            order="10-add-riser"
            label="立管"
            icon="↕F"
            tooltip="为选中可编辑管线添加跨楼层立管"
            mode="add-riser"
            active={props.pipeEditMode === 'add-riser'}
            onClick={props.onAddRiser}
            disabled={props.busy || !props.canAddRiser}
            busy={props.busy}
          />
        </div>
        <div
          className="flex shrink-0 items-center gap-1 border-l border-red-200 pl-2"
          data-toolbar-group="delete"
        >
          <ToolbarButton
            order="11-delete"
            label="删除"
            icon="×"
            tooltip="删除选中的可编辑对象"
            mode="delete"
            active={props.pipeEditMode === 'delete'}
            onClick={props.onDeleteTool}
            disabled={props.busy || !props.canDeleteSelected}
            busy={props.busy}
            danger
          />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton(props: {
  order: string;
  label: string;
  icon: string;
  tooltip: string;
  mode?: PipeEditMode;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  const activeTone = props.danger
    ? 'border-red-500 bg-red-50 text-red-800 shadow-[inset_0_0_0_2px_#dc2626]'
    : 'border-[#d4143a] bg-rose-50 text-[#8f0d28] shadow-[inset_0_0_0_2px_#d4143a]';
  const inactiveTone = props.danger
    ? 'border-red-200 bg-white text-red-700'
    : 'border-slate-300 bg-white text-slate-700';
  return (
    <button
      className={`inline-flex h-10 min-w-[72px] shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[#d4143a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:saturate-50 ${
        props.active ? activeTone : inactiveTone
      }`}
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.tooltip}
      aria-pressed={props.active ? 'true' : 'false'}
      aria-busy={props.busy ? 'true' : 'false'}
      title={props.tooltip}
      data-viewer-toolbar-order={props.order}
      data-pipe-edit-mode={props.mode}
      data-toolbar-active={props.active ? 'true' : 'false'}
      data-toolbar-disabled={props.disabled ? 'true' : 'false'}
      data-toolbar-busy={props.busy ? 'true' : 'false'}
    >
      <span className="inline-flex w-2 justify-center text-[10px]" aria-hidden="true">
        {props.active ? '*' : ''}
      </span>
      <span className="inline-flex min-w-[22px] justify-center font-bold" aria-hidden="true">
        {props.icon}
      </span>
      <span className="whitespace-nowrap">{props.label}</span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${props.busy ? 'bg-amber-400' : 'bg-transparent'}`}
        aria-hidden="true"
      />
    </button>
  );
}

function ActionButton(props: {
  label: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}) {
  const tone =
    props.tone === 'danger'
      ? 'border-red-800 bg-red-950/30 text-red-200'
      : 'border-slate-300 bg-white text-slate-700';
  return (
    <button
      className={`h-8 rounded border px-2 text-xs font-semibold disabled:opacity-50 ${tone}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.label}
    </button>
  );
}

function Toggle(props: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex h-8 items-center gap-2 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700">
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[#d4143a]"
      />
      {props.label}
    </label>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div data-viewer-detail={props.label}>
      <dt className="text-[11px] tracking-normal text-slate-500">{props.label}</dt>
      <dd className="mt-1 break-all text-slate-800" data-viewer-detail-value={props.label}>{props.value}</dd>
    </div>
  );
}

function buildModelObjectTree(input: {
  project: ProjectInputs;
  draftId?: string;
  generatedModel: GeneratedHvacModel | null;
  modelRecords: ViewerModelSource[];
  activeModelSource: ViewerModelSource | null;
  selectedComponentId?: string | null;
}): ModelObjectTreeGroup[] {
  const components = (input.generatedModel?.components ?? []).filter(
    (component) => (component.status ?? 'active') !== 'deleted'
  );
  const generatedComponents = components.filter((component) => !isManualLayerComponent(component));
  const manualComponents = components.filter(isManualLayerComponent);
  const sources = uniqueModelSources(input.activeModelSource, input.modelRecords).filter(
    isImportedModelSource
  );
  const projectLabel = chineseBusinessName(input.project.name, '当前项目');
  return [
    {
      key: 'current-project',
      label: '当前项目',
      nodes: [
        {
          kind: 'project',
          id: input.draftId ?? 'current-project',
          label: projectLabel,
          meta: input.draftId
            ? `草稿已保存 / ${components.length} 个构件`
            : `${components.length} 个构件 / 草稿未保存`,
        },
      ],
    },
    {
      key: 'generated-model',
      label: '生成模型',
      nodes: generatedComponents.map((component) =>
        componentTreeNode(component, input.selectedComponentId)
      ),
    },
    {
      key: 'manual-components',
      label: '手工构件',
      nodes: manualComponents.map((component) =>
        componentTreeNode(component, input.selectedComponentId)
      ),
    },
    {
      key: 'walls',
      label: '墙体',
      nodes: components
        .filter((component) => component.type === 'wall')
        .map((component) => componentTreeNode(component, input.selectedComponentId)),
    },
    {
      key: 'openings',
      label: '门窗',
      nodes: components
        .filter((component) => component.type === 'door' || component.type === 'window')
        .map((component) => componentTreeNode(component, input.selectedComponentId)),
    },
    {
      key: 'room-zones',
      label: '房间/区域',
      nodes: components
        .filter((component) => component.type === 'room-zone')
        .map((component) => componentTreeNode(component, input.selectedComponentId)),
    },
    {
      key: 'equipment',
      label: '设备',
      nodes: components
        .filter((component) => component.type === 'equipment')
        .map((component) => componentTreeNode(component, input.selectedComponentId)),
    },
    {
      key: 'routes',
      label: '管线',
      nodes: components
        .filter((component) => component.type === 'pipe-route' || component.type === 'duct-route')
        .map((component) => componentTreeNode(component, input.selectedComponentId)),
    },
    {
      key: 'ifc-glb-imports',
      label: 'IFC/GLB 导入模型',
      nodes: sources.map((source) => sourceTreeNode(source, input.activeModelSource?.id)),
    },
  ];
}

function componentTreeNode(
  component: GeneratedHvacComponent,
  selectedComponentId?: string | null
): ModelObjectTreeNode {
  const visible = component.visibility !== 'hidden';
  const locked = Boolean(component.locked);
  const connectionMeta = isRouteComponent(component)
    ? ` / 连接 ${routeConnectionStatusLabel(component)}`
    : '';
  return {
    kind: 'component',
    id: component.id,
    label: componentBusinessName(component),
    meta: `${displayComponentType(component.type)} / ${displaySystemKey(component.systemKey)} / ${
      visible ? '显示' : '隐藏'
    } / ${locked ? '已锁定' : '未锁定'}${connectionMeta}`,
    component,
    selected: component.id === selectedComponentId,
    visible,
    locked,
  };
}

function routeConnectionStatusLabel(component: GeneratedHvacComponent): string {
  const refs = component.route?.endpointRefs as Record<string, any> | undefined;
  const statuses = [refs?.from?.status, refs?.to?.status].filter(Boolean);
  if (statuses.includes('stale')) return '失效';
  if (statuses.includes('connected')) return '已连接';
  if (statuses.includes('disconnected')) return '未连接';
  return '无';
}

function sourceTreeNode(
  source: ViewerModelSource,
  activeModelSourceId?: string | null
): ModelObjectTreeNode {
  return {
    kind: 'source',
    id: source.id,
    label: modelSourceName(source),
    meta: `${displayModelSource(source.sourceType)} / ${displayModelType(source.modelType)} / ${displayState(
      source.loadStatus
    )} / ${source.metadata?.objectCount ?? source.componentSummary?.objectCount ?? 0} 个对象`,
    source,
    selected: source.id === activeModelSourceId,
  };
}

function componentBusinessName(component: GeneratedHvacComponent): string {
  return (
    chineseBusinessName(component.displayName, '') ||
    chineseBusinessName(component.name, '') ||
    `${displaySystemKey(component.systemKey)}${displayComponentType(component.type)}`
  );
}

function modelSourceName(source: ViewerModelSource): string {
  const typeLabel = displayModelType(source.modelType);
  const prefix =
    source.modelType === 'ifc' || source.modelType === 'glb'
      ? `${typeLabel} 导入模型`
      : source.sourceType === 'generated'
        ? '生成模型'
        : '导入模型';
  const rawName = textName(source.name ?? source.metadata?.name);
  if (!rawName || isInternalIdLabel(rawName)) return prefix;
  return rawName.includes(prefix) ? rawName : `${prefix}：${rawName}`;
}

function chineseBusinessName(value: unknown, fallback: string): string {
  const text = textName(value);
  if (!text || isInternalIdLabel(text)) return fallback;
  return hasChinese(text) ? text : fallback;
}

function textName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function isInternalIdLabel(value: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ||
    /^[a-z0-9_-]{24,}$/i.test(value)
  );
}

function isTechnicalEquipmentLabel(value: string): boolean {
  const text = value.trim();
  return (
    isInternalIdLabel(text) ||
    /^(manual|hvac|component|template|bom)[-_]/i.test(text) ||
    /^[A-Z0-9]+(?:[-_][A-Z0-9]+)+$/.test(text)
  );
}

function isManualLayerComponent(component: GeneratedHvacComponent): boolean {
  return Boolean(component.sourceTemplateId) || component.id.startsWith('manual-');
}

function isImportedModelSource(source: ViewerModelSource): boolean {
  return (
    source.modelType === 'ifc' ||
    source.modelType === 'glb' ||
    source.sourceType === 'local-upload' ||
    (source.sourceType === 'artifact' && source.modelType !== 'generated')
  );
}

function uniqueModelSources(
  activeModelSource: ViewerModelSource | null,
  modelRecords: ViewerModelSource[]
): ViewerModelSource[] {
  const items = [activeModelSource, ...modelRecords].filter(Boolean) as ViewerModelSource[];
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function modelFrom(value: unknown): GeneratedHvacModel | null {
  if (!value || typeof value !== 'object') return null;
  const model = value as GeneratedHvacModel;
  return Array.isArray(model.components) && model.modelType === 'parametric-hvac' ? model : null;
}

function isRouteComponent(component: GeneratedHvacComponent): boolean {
  return component.type === 'pipe-route' || component.type === 'duct-route';
}

function isRouteTemplate(template: ViewerComponentCatalogTemplate | null): boolean {
  return template?.type === 'pipe-route' || template?.type === 'duct-route';
}

function componentEditorFromComponent(component: GeneratedHvacComponent): ComponentEditor {
  const geometry = component.geometry ?? {};
  const dimensions = component.dimensions ?? {};
  const position = pointFrom(component.position, {
    x: numberOr(geometry.x, 0),
    y: numberOr(geometry.y, 0),
    z: numberOr(geometry.z, 0),
  });
  const rotation = component.rotation ?? {};
  const business = component.businessMetadata ?? {};
  const routeInsulation = component.route?.insulation as Record<string, unknown> | null | undefined;
  const points = Array.isArray(geometry.points) ? geometry.points : [];
  const width = numberOr(dimensions.width ?? geometry.width, DEFAULT_COMPONENT_EDITOR.width);
  const height = numberOr(dimensions.height ?? geometry.height, DEFAULT_COMPONENT_EDITOR.height);
  const depth = numberOr(dimensions.depth ?? geometry.depth, DEFAULT_COMPONENT_EDITOR.depth);
  const start = pointFrom(business.startPoint ?? points[0], {
    x: roundCoord(position.x - width / 2),
    y: position.y,
    z: position.z,
  });
  const end = pointFrom(business.endPoint ?? points[points.length - 1], {
    x: roundCoord(position.x + width / 2),
    y: position.y,
    z: position.z,
  });
  const length =
    component.type === 'equipment'
      ? numberOr(dimensions.length ?? depth, depth)
      : component.type === 'wall'
        ? numberOr(dimensions.length ?? width, width)
        : numberOr(dimensions.length ?? width, width);
  return {
    ...DEFAULT_COMPONENT_EDITOR,
    name: component.displayName ?? component.name,
    systemKey: component.systemKey,
    status: component.status ?? 'active',
    visible: component.visibility !== 'hidden',
    locked: Boolean(component.locked),
    floor: numberOr(component.floor ?? business.floor ?? business.floorIndex, DEFAULT_COMPONENT_EDITOR.floor),
    x: position.x,
    y: position.y,
    z: position.z,
    elevation: numberOr(component.elevation, position.y),
    installHeight: numberOr(
      component.installHeight ?? business.installHeight,
      numberOr(component.elevation, position.y)
    ),
    rotationX: numberOr(rotation.x, 0),
    rotationY: numberOr(rotation.y, 0),
    rotationZ: numberOr(rotation.z, 0),
    width,
    height,
    depth,
    length,
    thickness: numberOr(dimensions.thickness ?? depth, depth),
    diameterMm: numberOr(dimensions.diameterMm ?? geometry.diameterMm, 32),
    bendRadiusMm: routeBendRadiusMm(component),
    estimatedLengthM: numberOr(
      business.estimatedLengthM ?? dimensions.estimatedLengthM,
      points.length >= 2 ? roundLength(routeLength(points)) : DEFAULT_COMPONENT_EDITOR.estimatedLengthM
    ),
    startX: start.x,
    startY: start.y,
    startZ: start.z,
    endX: end.x,
    endY: end.y,
    endZ: end.z,
    capacityKw: numberOr(business.capacityKw ?? business.loadKw, 0),
    insulationMm: numberOr(business.insulationMm, 0),
    bomCategory: String(business.bomCategory ?? component.bomMetadata?.bomCategory ?? ''),
    bomSkuHint: String(business.bomSkuHint ?? component.bomMetadata?.bomSkuHint ?? ''),
    modelSku: String(business.modelSku ?? business.modelSKU ?? ''),
    installMethod: String(business.installMethod ?? ''),
    openingDirection: String(business.openingDirection ?? ''),
    connectionDirection: String(business.connectionDirection ?? business.interfaceDirection ?? ''),
    material: String(business.material ?? component.route?.material ?? ''),
    insulationInfo: String(business.insulationInfo ?? routeInsulation?.material ?? ''),
    wallType: String(business.wallType ?? ''),
    hostWallId: String(business.hostWallId ?? ''),
  };
}

function mergeComponentEditor(
  current: ComponentEditor,
  patch: Partial<ComponentEditor>,
  type?: GeneratedHvacComponent['type'],
  floorHeight = DEFAULT_BUILDING.floorHeight
): ComponentEditor {
  const next = { ...current, ...patch };
  const floorBase = Math.max(0, (Math.max(1, Math.round(next.floor)) - 1) * floorHeight);
  if (
    Object.prototype.hasOwnProperty.call(patch, 'floor') ||
    Object.prototype.hasOwnProperty.call(patch, 'installHeight')
  ) {
    next.elevation = roundCoord(floorBase + next.installHeight);
    next.y = next.elevation;
  } else if (
    Object.prototype.hasOwnProperty.call(patch, 'elevation') ||
    Object.prototype.hasOwnProperty.call(patch, 'y')
  ) {
    const elevation = Object.prototype.hasOwnProperty.call(patch, 'y') ? next.y : next.elevation;
    next.elevation = elevation;
    next.y = elevation;
    next.installHeight = roundCoord(elevation - floorBase);
  }
  const movedWallEndpoint =
    type === 'wall' &&
    ['startX', 'startY', 'startZ', 'endX', 'endY', 'endZ'].some((key) =>
      Object.prototype.hasOwnProperty.call(patch, key)
    );
  if (movedWallEndpoint) {
    const start = { x: next.startX, y: next.startY, z: next.startZ };
    const end = { x: next.endX, y: next.endY, z: next.endZ };
    next.length = Math.max(0.1, roundLength(distanceBetweenPoints(start, end)));
    next.x = roundCoord((start.x + end.x) / 2);
    next.y = roundCoord((start.y + end.y) / 2);
    next.z = roundCoord((start.z + end.z) / 2);
    next.elevation = next.y;
    next.installHeight = roundCoord(next.elevation - floorBase);
    next.rotationY = roundCoord((Math.atan2(end.z - start.z, end.x - start.x) * 180) / Math.PI);
  }
  return next;
}

function componentFromEditor(
  component: GeneratedHvacComponent,
  editor: ComponentEditor
): GeneratedHvacComponent {
  const businessMetadata: Record<string, unknown> = {
    ...(component.businessMetadata ?? {}),
    bomCategory: editor.bomCategory || component.businessMetadata?.bomCategory,
    bomSkuHint: editor.bomSkuHint || component.businessMetadata?.bomSkuHint,
    capacityKw: editor.capacityKw,
    modelSku: editor.modelSku,
    installMethod: editor.installMethod,
    material: editor.material,
    insulationMm: editor.insulationMm,
    insulationInfo: editor.insulationInfo,
    bendRadiusMm: editor.bendRadiusMm,
    wallType: editor.wallType,
    hostWallId: editor.hostWallId,
    floor: editor.floor,
    elevation: editor.elevation,
    installHeight: editor.installHeight,
    openingDirection: editor.openingDirection,
    connectionDirection: editor.connectionDirection,
    editedBy: 'viewer-component-crud',
  };
  const bomMetadata: Record<string, unknown> = {
    ...(component.bomMetadata ?? {}),
    bomCategory: editor.bomCategory || component.bomMetadata?.bomCategory,
    bomSkuHint: editor.bomSkuHint || component.bomMetadata?.bomSkuHint,
  };
  const rotation = {
    ...(component.rotation ?? {}),
    x: editor.rotationX,
    y: editor.rotationY,
    z: editor.rotationZ,
  };

  if (isRouteComponent(component)) {
    const geometry = { ...(component.geometry ?? {}) };
    const sourcePoints = Array.isArray(geometry.points) ? geometry.points : [];
    const points = sourcePoints.length >= 2 ? sourcePoints.map((point) => pointFrom(point, editor)) : [];
    const start = { x: editor.startX, y: editor.startY, z: editor.startZ };
    const end = { x: editor.endX, y: editor.endY, z: editor.endZ };
    const routePoints = points.length >= 2 ? points : [start, end];
    routePoints[0] = start;
    routePoints[routePoints.length - 1] = end;
    const calculatedLengthM = roundAcceptedLength(routeLength(routePoints));
    const estimatedLengthM =
      calculatedLengthM > 0
        ? calculatedLengthM
        : editor.estimatedLengthM > 0
          ? editor.estimatedLengthM
          : roundLength(distanceBetweenPoints(start, end));
    const dimensions: Record<string, unknown> = {
      ...(component.dimensions ?? {}),
      estimatedLengthM,
    };
    if (component.type === 'duct-route') {
      dimensions.width = positiveOr(editor.width, numberOr(component.dimensions?.width, 0.4));
      dimensions.height = positiveOr(editor.height, numberOr(component.dimensions?.height, 0.25));
      geometry.width = dimensions.width;
      geometry.height = dimensions.height;
    } else {
      dimensions.diameterMm = positiveOr(editor.diameterMm, 32);
      geometry.diameterMm = dimensions.diameterMm;
    }
    businessMetadata.estimatedLengthM = estimatedLengthM;
    bomMetadata.quantity = estimatedLengthM;
    bomMetadata.unit = 'm';
    bomMetadata.estimatedLengthM = estimatedLengthM;
    const route = component.route
      ? {
          ...component.route,
          points: routePoints,
          systemKey: editor.systemKey as GeneratedHvacComponent['systemKey'],
          routeType: component.type as 'pipe-route' | 'duct-route',
          size:
            component.type === 'duct-route'
              ? { ...(component.route.size ?? {}), width: dimensions.width, height: dimensions.height }
              : { ...(component.route.size ?? {}), diameterMm: dimensions.diameterMm },
          material: editor.material || null,
          insulation: editor.insulationMm || editor.insulationInfo
            ? {
                ...(component.route.insulation ?? {}),
                thicknessMm: editor.insulationMm,
                material: editor.insulationInfo || undefined,
              }
            : null,
          bendRadius: editor.bendRadiusMm > 0 ? { radiusM: editor.bendRadiusMm / 1000 } : null,
          visibility: editor.visible ? 'visible' as const : 'hidden' as const,
          locked: editor.locked,
          lockState: (editor.locked ? 'locked' : 'unlocked') as 'locked' | 'unlocked',
          bomMapping: {
            ...(component.route.bomMapping ?? {}),
            quantity: estimatedLengthM,
            totalLengthM: estimatedLengthM,
          },
          summary: {
            ...component.route.summary,
            pointCount: routePoints.length,
            totalLengthM: estimatedLengthM,
          },
        }
      : component.route;
    return {
      ...component,
      systemKey: editor.systemKey as GeneratedHvacComponent['systemKey'],
      name: editor.name || component.name,
      displayName: editor.name || component.displayName || component.name,
      dimensions,
      rotation,
      visibility: editor.visible ? 'visible' : 'hidden',
      locked: editor.locked,
      floor: editor.floor,
      elevation: editor.elevation,
      installHeight: editor.installHeight,
      position: { ...(component.position ?? {}), y: editor.elevation },
      businessMetadata,
      bomMetadata,
      geometry: { ...geometry, kind: 'polyline', points: routePoints },
      route,
      status: editor.status,
    };
  }

  let width = positiveOr(editor.width, numberOr(component.dimensions?.width, 1));
  let height = positiveOr(editor.height, numberOr(component.dimensions?.height, 1));
  let depth = positiveOr(editor.depth, numberOr(component.dimensions?.depth, 1));
  if (component.type === 'wall') {
    width = positiveOr(editor.length, width);
    depth = positiveOr(editor.thickness, depth);
    businessMetadata.startPoint = { x: editor.startX, y: editor.startY, z: editor.startZ };
    businessMetadata.endPoint = { x: editor.endX, y: editor.endY, z: editor.endZ };
  }
  if (component.type === 'equipment') {
    depth = positiveOr(editor.length, depth);
  }
  if (component.type === 'door' || component.type === 'window') {
    depth = positiveOr(editor.thickness, depth);
    businessMetadata.sillElevation = editor.elevation;
  }
  const dimensions: Record<string, unknown> = {
    ...(component.dimensions ?? {}),
    width,
    height,
    depth,
    length: component.type === 'equipment' || component.type === 'wall' ? editor.length : undefined,
    thickness:
      component.type === 'wall' || component.type === 'door' || component.type === 'window'
        ? editor.thickness
        : undefined,
  };
  return {
    ...component,
    systemKey: editor.systemKey as GeneratedHvacComponent['systemKey'],
    name: editor.name || component.name,
    displayName: editor.name || component.displayName || component.name,
    position: { ...(component.position ?? {}), x: editor.x, y: editor.elevation, z: editor.z },
    rotation,
    visibility: editor.visible ? 'visible' : 'hidden',
    locked: editor.locked,
    floor: editor.floor,
    elevation: editor.elevation,
    installHeight: editor.installHeight,
    dimensions,
    businessMetadata,
    bomMetadata,
    geometry: {
      ...(component.geometry ?? {}),
      kind: 'box',
      x: editor.x,
      y: editor.elevation,
      z: editor.z,
      width,
      height,
      depth,
    },
    status: editor.status,
  };
}

function componentPayloadFromComponent(
  component: GeneratedHvacComponent
): GeneratedHvacComponentPayload {
  return {
    id: component.id,
    type: component.type,
    category: component.category,
    systemKey: component.systemKey,
    name: component.name,
    displayName: component.displayName,
    sourceTemplateId: component.sourceTemplateId,
    modelSourceId: component.modelSourceId,
    dimensions: component.dimensions,
    position: component.position,
    rotation: component.rotation,
    visibility: component.visibility,
    locked: component.locked,
    floor: component.floor,
    elevation: component.elevation,
    installHeight: component.installHeight,
    businessMetadata: component.businessMetadata,
    bomMetadata: component.bomMetadata,
    geometry: component.geometry,
    route: component.route,
    status: component.status,
  };
}

function updateModelComponent(
  model: GeneratedHvacModel | null,
  component: GeneratedHvacComponent
): GeneratedHvacModel | null {
  if (!model) return model;
  const components = model.components.map((item) => (item.id === component.id ? component : item));
  return { ...model, components, componentSummary: summarizeModelComponents(components) };
}

function modelFromModelSource(source: ViewerModelSource): GeneratedHvacModel | null {
  return modelFrom(source.componentSummary?.generatedModelSnapshot);
}

function modelObjectsFrom(
  source: ViewerModelSource
): Array<{ id: string; name: string; type: string }> {
  const summary = source.componentSummary ?? {};
  const objects = Array.isArray(summary.objects)
    ? summary.objects
    : Array.isArray(summary.components)
      ? summary.components
      : [];
  return objects
    .map((item: any) => ({
      id: String(item.id ?? item.expressID ?? item.name ?? ''),
      name: String(item.name ?? item.id ?? 'Model object'),
      type: String(item.type ?? item.systemKey ?? source.modelType),
    }))
    .filter((item) => item.id);
}

function pointFrom(value: unknown, fallback: { x: number; y: number; z: number }) {
  const point = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    x: numberOr(point.x, fallback.x),
    y: numberOr(point.y, fallback.y),
    z: numberOr(point.z, fallback.z),
  };
}

function numberOr(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundLength(value: number) {
  return Math.round(value * 10) / 10;
}

function roundCoord(value: number) {
  return Math.round(value * 100) / 100;
}

function samePipePoint(a: PipePoint | undefined, b: PipePoint | undefined) {
  if (!a || !b) return false;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 0.001;
}

function routeMutationKind(
  component: GeneratedHvacComponent,
  nextPoints: PipePoint[]
): ViewerCommandKind {
  const currentPoints = Array.isArray(component.geometry?.points)
    ? component.geometry.points.map((point) => pointFrom(point, { x: 0, y: 0, z: 0 }))
    : [];
  if (nextPoints.length > currentPoints.length) return 'route-point-insert';
  if (nextPoints.length < currentPoints.length) return 'route-point-delete';
  const firstIndex = 0;
  const lastIndex = Math.max(0, currentPoints.length - 1);
  if (
    !samePipePoint(currentPoints[firstIndex], nextPoints[firstIndex]) ||
    !samePipePoint(currentPoints[lastIndex], nextPoints[lastIndex])
  ) {
    return 'route-endpoint-move';
  }
  return 'route-point-move';
}

function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function positiveOr(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Math.max(0.1, fallback);
}

function routeLength(points: unknown[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetweenPoints(
      pointFrom(points[index - 1], { x: 0, y: 0, z: 0 }),
      pointFrom(points[index], { x: 0, y: 0, z: 0 })
    );
  }
  return total;
}

function roundAcceptedLength(value: number) {
  return Math.round(value * 100) / 100;
}

function summarizeModelComponents(
  components: GeneratedHvacComponent[]
): GeneratedHvacModel['componentSummary'] {
  const byType: Record<string, number> = {};
  const bySystem: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const bomMappableComponentIds: string[] = [];
  for (const component of components) {
    const status = component.status ?? 'active';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (
      status === 'deleted' ||
      component.businessMetadata?.excluded === true ||
      component.bomMetadata?.excluded === true
    ) {
      continue;
    }
    byType[component.type] = (byType[component.type] ?? 0) + 1;
    bySystem[component.systemKey] = (bySystem[component.systemKey] ?? 0) + 1;
    if (component.bomMetadata?.bomMappable || component.businessMetadata?.bomMappable) {
      bomMappableComponentIds.push(component.id);
    }
  }
  return {
    total: Object.values(byType).reduce((sum, count) => sum + count, 0),
    byType,
    bySystem,
    byStatus,
    bomMappableComponentIds,
  };
}

function distanceBetweenPoints(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number }
) {
  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

function viewerObjectType(type: string, name: string): string {
  const value = `${type} ${name}`.toLowerCase();
  if (value.includes('pipe') || value.includes('duct') || value.includes('flowsegment')) {
    return 'pipe-route';
  }
  if (value.includes('equipment') || value.includes('unit') || value.includes('pump')) {
    return 'equipment';
  }
  return 'model-object';
}

function viewerObjectSystem(name: string): string {
  const value = name.toLowerCase();
  if (value.includes('heat')) return 'heating';
  if (value.includes('fresh') || value.includes('air')) return 'freshAir';
  return 'cooling';
}
