import { Injectable } from '@nestjs/common';

export type ViewerComponentCatalogCategoryKey =
  | 'wall'
  | 'door'
  | 'window'
  | 'room-zone'
  | 'hvac-equipment'
  | 'pipe';

export type ViewerComponentCatalogSystemKey =
  | 'envelope'
  | 'zone'
  | 'cooling'
  | 'heating'
  | 'freshAir'
  | 'water'
  | 'smartControl';

export type ViewerComponentCatalogComponentType =
  | 'wall'
  | 'door'
  | 'window'
  | 'room-zone'
  | 'equipment'
  | 'pipe-route'
  | 'duct-route';

export interface ViewerComponentCatalogCategory {
  key: ViewerComponentCatalogCategoryKey;
  label: string;
  description: string;
  sortOrder: number;
}

export interface ViewerComponentEditableProperty {
  key: string;
  label: string;
  input: 'text' | 'number' | 'select' | 'boolean';
  unit?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface ViewerComponentBomMappingHint {
  category: string;
  skuPrefix: string;
  quantityUnit: 'm' | 'm2' | 'm3' | 'set' | 'point' | 'zone';
  measurementKey: string;
  notes: string[];
}

export interface ViewerComponentCatalogTemplate {
  id: string;
  category: ViewerComponentCatalogCategoryKey;
  type: ViewerComponentCatalogComponentType;
  label: string;
  description: string;
  systemKey: ViewerComponentCatalogSystemKey;
  defaultDimensions: Record<string, number | string>;
  editableProperties: ViewerComponentEditableProperty[];
  bomMapping: ViewerComponentBomMappingHint;
}

export interface ViewerComponentCatalog {
  source: 'seed-global-defaults';
  version: string;
  extensionPoint: string;
  categories: ViewerComponentCatalogCategory[];
  templates: ViewerComponentCatalogTemplate[];
}

const CATEGORIES: ViewerComponentCatalogCategory[] = [
  { key: 'wall', label: '墙体', description: '建筑围护与隔墙模板', sortOrder: 10 },
  { key: 'door', label: '门', description: '入户门、室内门与洞口模板', sortOrder: 20 },
  { key: 'window', label: '窗', description: '外窗与采光洞口模板', sortOrder: 30 },
  { key: 'room-zone', label: '房间/区域', description: '房间、热区与控制分区模板', sortOrder: 40 },
  { key: 'hvac-equipment', label: '暖通设备', description: '冷热源、末端、新风与控制设备模板', sortOrder: 50 },
  { key: 'pipe', label: '管线', description: '冷媒、水、风管、冷凝水与地暖回路模板', sortOrder: 60 },
];

const TEMPLATES: ViewerComponentCatalogTemplate[] = [
  template('wall-standard-200', 'wall', 'wall', '200mm 标准墙体', '室内隔墙或外墙线段', 'envelope', {
    lengthM: 3.6,
    heightM: 3,
    thicknessMm: 200,
  }),
  template('door-single-900', 'door', 'door', '900mm 单开门', '常规室内单开门洞口', 'envelope', {
    widthM: 0.9,
    heightM: 2.1,
    thicknessMm: 80,
  }),
  template('window-standard-1500', 'window', 'window', '1500mm 标准窗', '常规外窗或采光窗', 'envelope', {
    widthM: 1.5,
    heightM: 1.5,
    sillHeightM: 0.9,
  }),
  template('room-zone-living', 'room-zone', 'room-zone', '客餐厅热区', '房间/区域负荷与控制分区', 'zone', {
    areaM2: 36,
    heightM: 3,
    designCoolingLoadKw: 4.5,
    designHeatingLoadKw: 3.8,
  }),
  template('heat-pump-air-source', 'hvac-equipment', 'equipment', '空气源热泵', '冷热源主机模板', 'cooling', {
    widthM: 1.1,
    depthM: 0.45,
    heightM: 1.35,
    nominalCapacityKw: 16,
  }),
  template('gas-boiler-wall-hung', 'hvac-equipment', 'equipment', '燃气壁挂炉', '采暖热源模板', 'heating', {
    widthM: 0.42,
    depthM: 0.32,
    heightM: 0.75,
    nominalCapacityKw: 24,
  }),
  template('fcu-ceiling-concealed', 'hvac-equipment', 'equipment', '风机盘管 FCU', '吊顶暗装末端模板', 'cooling', {
    widthM: 1.05,
    depthM: 0.45,
    heightM: 0.24,
    airflowM3h: 680,
  }),
  template('radiator-panel', 'hvac-equipment', 'equipment', '散热器', '墙挂式采暖末端模板', 'heating', {
    widthM: 1.2,
    depthM: 0.12,
    heightM: 0.6,
    capacityKw: 1.8,
  }),
  template('underfloor-heating-zone', 'hvac-equipment', 'equipment', '地暖区域', '地暖盘管覆盖区模板', 'heating', {
    areaM2: 18,
    loopSpacingMm: 150,
    designWaterTempC: 40,
  }),
  template('ahu-horizontal', 'hvac-equipment', 'equipment', '空气处理机组 AHU', '新风或全空气处理设备模板', 'freshAir', {
    widthM: 1.6,
    depthM: 0.9,
    heightM: 0.8,
    airflowM3h: 1200,
  }),
  template('air-vent-slot', 'hvac-equipment', 'equipment', '风口', '送风、回风或排风口模板', 'freshAir', {
    widthM: 0.6,
    depthM: 0.12,
    heightM: 0.12,
    airflowM3h: 180,
  }),
  template('thermostat-wall', 'hvac-equipment', 'equipment', '温控器', '房间控制面板模板', 'smartControl', {
    widthM: 0.086,
    depthM: 0.012,
    heightM: 0.086,
    installHeightM: 1.35,
  }),
  template('manifold-heating', 'hvac-equipment', 'equipment', '分集水器', '地暖或水系统分配装置模板', 'heating', {
    widthM: 0.75,
    depthM: 0.12,
    heightM: 0.32,
    loopCount: 6,
  }),
  template('refrigerant-pipe-pair', 'pipe', 'pipe-route', '冷媒管', '空调冷媒铜管路由模板', 'cooling', {
    diameterMm: 19.05,
    insulationMm: 20,
    estimatedLengthM: 8,
  }),
  template('air-duct-rectangular', 'pipe', 'duct-route', '风管', '矩形送回风管路由模板', 'freshAir', {
    widthMm: 320,
    heightMm: 200,
    estimatedLengthM: 6,
  }),
  template('underfloor-loop-pexa', 'pipe', 'pipe-route', '地暖回路', 'PE-Xa 地暖盘管回路模板', 'heating', {
    diameterMm: 16,
    loopSpacingMm: 150,
    estimatedLengthM: 80,
  }),
  template('condensate-pipe-pvc', 'pipe', 'pipe-route', '冷凝水管', '空调冷凝水排水路由模板', 'water', {
    diameterMm: 25,
    slopePercent: 1,
    estimatedLengthM: 5,
  }),
];

@Injectable()
export class ViewerComponentCatalogService {
  list(): ViewerComponentCatalog {
    return {
      source: 'seed-global-defaults',
      version: '2026-07-issue-09',
      extensionPoint:
        'Seed defaults are the backend source for this slice; tenant-editable catalog rows can replace this service contract later without changing the viewer panel.',
      categories: [...CATEGORIES]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(localizeCategory),
      templates: TEMPLATES.map(localizeTemplate),
    };
  }
}

const CATEGORY_TEXT: Record<
  ViewerComponentCatalogCategoryKey,
  Pick<ViewerComponentCatalogCategory, 'label' | 'description'>
> = {
  wall: { label: '墙体', description: '建筑围护与隔墙模板' },
  door: { label: '门', description: '入户门、室内门与洞口模板' },
  window: { label: '窗', description: '外窗与采光洞口模板' },
  'room-zone': { label: '房间/区域', description: '房间、热区与控制分区模板' },
  'hvac-equipment': { label: '暖通设备', description: '冷热源、末端、新风与控制设备模板' },
  pipe: { label: '管线', description: '冷媒、水、风管、冷凝水与地暖回路模板' },
};

const TEMPLATE_TEXT: Record<string, Pick<ViewerComponentCatalogTemplate, 'label' | 'description'>> = {
  'wall-standard-200': { label: '200mm 标准墙体', description: '室内隔墙或外墙线段' },
  'door-single-900': { label: '900mm 单开门', description: '常规室内单开门洞口' },
  'window-standard-1500': { label: '1500mm 标准窗', description: '常规外窗或采光窗' },
  'room-zone-living': { label: '客餐厅热区', description: '房间/区域负荷与控制分区' },
  'heat-pump-air-source': { label: '空气源热泵', description: '冷热源主机模板' },
  'gas-boiler-wall-hung': { label: '燃气壁挂炉', description: '采暖热源模板' },
  'fcu-ceiling-concealed': { label: '风机盘管 FCU', description: '吊顶暗装末端模板' },
  'radiator-panel': { label: '散热器', description: '壁挂式采暖末端模板' },
  'underfloor-heating-zone': { label: '地暖盘管', description: '地暖盘管覆盖区模板' },
  'ahu-horizontal': { label: '新风主机 AHU', description: '新风或全空气处理设备模板' },
  'air-vent-slot': { label: '风口', description: '送风、回风或排风口模板' },
  'thermostat-wall': { label: '温控器', description: '房间控制面板模板' },
  'manifold-heating': { label: '分集水器', description: '地暖或水系统分配装置模板' },
  'refrigerant-pipe-pair': { label: '冷媒管', description: '空调冷媒铜管路由模板' },
  'air-duct-rectangular': { label: '风管', description: '矩形送回风管路由模板' },
  'underfloor-loop-pexa': { label: '地暖管', description: 'PE-Xa 地暖盘管回路模板' },
  'condensate-pipe-pvc': { label: '冷凝水管', description: '空调冷凝水排水路由模板' },
};

function localizeCategory(category: ViewerComponentCatalogCategory): ViewerComponentCatalogCategory {
  return { ...category, ...CATEGORY_TEXT[category.key] };
}

function localizeTemplate(template: ViewerComponentCatalogTemplate): ViewerComponentCatalogTemplate {
  const defaultDimensions = { ...template.defaultDimensions };
  return {
    ...template,
    ...(TEMPLATE_TEXT[template.id] ?? {}),
    defaultDimensions,
    editableProperties: editablePropertiesFor(
      template.category,
      template.systemKey,
      defaultDimensions
    ).map(localizeEditableProperty),
  };
}

function localizeEditableProperty(
  property: ViewerComponentEditableProperty
): ViewerComponentEditableProperty {
  const labels: Record<string, string> = {
    displayName: '构件名称',
    systemKey: '系统归属',
    widthM: '宽度',
    depthM: '深度',
    heightM: '高度',
    lengthM: '长度',
    thicknessMm: '厚度',
    sillHeightM: '离地高度',
    openingDirection: '开启方向',
    areaM2: '面积',
    designCoolingLoadKw: '设计冷负荷',
    designHeatingLoadKw: '设计热负荷',
    nominalCapacityKw: '名义能力',
    airflowM3h: '风量',
    capacityKw: '散热量',
    loopSpacingMm: '盘管间距',
    designWaterTempC: '设计水温',
    installHeightM: '安装高度',
    loopCount: '回路数',
    modelSku: '型号/SKU',
    installMethod: '安装方式',
    diameterMm: '管径',
    insulationMm: '保温厚度',
    estimatedLengthM: '预估长度',
    widthMm: '宽度',
    heightMm: '高度',
    slopePercent: '坡度',
    material: '材质',
  };
  const units: Record<string, string | undefined> = {
    widthM: 'm',
    depthM: 'm',
    heightM: 'm',
    lengthM: 'm',
    thicknessMm: 'mm',
    sillHeightM: 'm',
    areaM2: 'm2',
    designCoolingLoadKw: 'kW',
    designHeatingLoadKw: 'kW',
    nominalCapacityKw: 'kW',
    airflowM3h: 'm3/h',
    capacityKw: 'kW',
    loopSpacingMm: 'mm',
    designWaterTempC: 'C',
    installHeightM: 'm',
    diameterMm: 'mm',
    insulationMm: 'mm',
    estimatedLengthM: 'm',
    widthMm: 'mm',
    heightMm: 'mm',
    slopePercent: '%',
  };
  if (property.key === 'systemKey') {
    return {
      ...property,
      label: labels[property.key],
      unit: units[property.key],
      options: [
        { value: 'envelope', label: '建筑围护' },
        { value: 'zone', label: '房间/区域' },
        { value: 'cooling', label: '制冷' },
        { value: 'heating', label: '采暖' },
        { value: 'freshAir', label: '新风' },
        { value: 'water', label: '水系统' },
        { value: 'smartControl', label: '智能控制' },
      ],
    };
  }
  return {
    ...property,
    label: labels[property.key] ?? property.label,
    unit: units[property.key] ?? property.unit,
  };
}

function template(
  id: string,
  category: ViewerComponentCatalogCategoryKey,
  type: ViewerComponentCatalogComponentType,
  label: string,
  description: string,
  systemKey: ViewerComponentCatalogSystemKey,
  defaultDimensions: Record<string, number | string>
): ViewerComponentCatalogTemplate {
  return {
    id,
    category,
    type,
    label,
    description,
    systemKey,
    defaultDimensions,
    editableProperties: editablePropertiesFor(category, systemKey, defaultDimensions),
    bomMapping: bomMappingFor(category, type, id, defaultDimensions),
  };
}

function editablePropertiesFor(
  category: ViewerComponentCatalogCategoryKey,
  systemKey: ViewerComponentCatalogSystemKey,
  dimensions: Record<string, number | string>
): ViewerComponentEditableProperty[] {
  const dimensionFields = Object.entries(dimensions).map(([key, value]) => ({
    key,
    label: dimensionLabel(key),
    input: 'number' as const,
    unit: dimensionUnit(key),
    defaultValue: value,
  }));
  const templateFields: ViewerComponentEditableProperty[] = [];
  if (category === 'door' || category === 'window') {
    if (category === 'window' && dimensions.thicknessMm === undefined) {
      templateFields.push({
        key: 'thicknessMm',
        label: '厚度',
        input: 'number',
        unit: 'mm',
        defaultValue: 120,
      });
    }
    templateFields.push({
      key: 'openingDirection',
      label: '开启方向',
      input: 'select',
      defaultValue: category === 'door' ? 'left-in' : 'sliding',
      options: [
        { value: 'left-in', label: '左内开' },
        { value: 'right-in', label: '右内开' },
        { value: 'sliding', label: '推拉' },
        { value: 'fixed', label: '固定' },
      ],
    });
  }
  if (category === 'hvac-equipment') {
    templateFields.push(
      {
        key: 'modelSku',
        label: '型号/SKU',
        input: 'text',
        defaultValue: '',
      },
      {
        key: 'installMethod',
        label: '安装方式',
        input: 'select',
        defaultValue: 'floor',
        options: [
          { value: 'floor', label: '落地' },
          { value: 'wall', label: '壁挂' },
          { value: 'ceiling', label: '吊装' },
          { value: 'embedded', label: '暗装' },
        ],
      }
    );
  }
  if (category === 'pipe') {
    templateFields.push({
      key: 'material',
      label: '材质',
      input: 'select',
      defaultValue: systemKey === 'freshAir' ? 'galvanized-steel' : 'copper',
      options: [
        { value: 'copper', label: '铜管' },
        { value: 'pvc', label: 'PVC' },
        { value: 'pexa', label: 'PE-Xa' },
        { value: 'galvanized-steel', label: '镀锌钢板' },
      ],
    });
  }
  return [
    {
      key: 'displayName',
      label: '构件名称',
      input: 'text',
      defaultValue: category === 'hvac-equipment' ? '暖通设备' : '构件',
    },
    {
      key: 'systemKey',
      label: '系统归属',
      input: 'select',
      defaultValue: systemKey,
      options: [
        { value: 'envelope', label: '建筑围护' },
        { value: 'zone', label: '房间/区域' },
        { value: 'cooling', label: '制冷' },
        { value: 'heating', label: '采暖' },
        { value: 'freshAir', label: '新风' },
        { value: 'water', label: '水系统' },
        { value: 'smartControl', label: '智能控制' },
      ],
    },
    ...templateFields,
    ...dimensionFields,
  ];
}

function bomMappingFor(
  category: ViewerComponentCatalogCategoryKey,
  type: ViewerComponentCatalogComponentType,
  id: string,
  dimensions: Record<string, number | string>
): ViewerComponentBomMappingHint {
  const quantityUnit =
    category === 'wall'
      ? 'm2'
      : category === 'room-zone'
        ? 'zone'
        : type === 'pipe-route' || type === 'duct-route'
          ? 'm'
          : 'set';
  return {
    category,
    skuPrefix: id.toUpperCase().replace(/-/g, '_'),
    quantityUnit,
    measurementKey:
      quantityUnit === 'm2'
        ? 'areaM2'
        : quantityUnit === 'm'
          ? 'estimatedLengthM'
          : quantityUnit === 'zone'
            ? 'areaM2'
            : 'quantity',
    notes: [
      'BOM rows should keep sourceTemplateId for traceability.',
      dimensions.estimatedLengthM ? 'Route length can be recomputed from placement geometry.' : 'Dimensions are defaults and should be editable after placement.',
    ],
  };
}

function dimensionLabel(key: string) {
  const labels: Record<string, string> = {
    widthM: '宽度',
    depthM: '深度',
    heightM: '高度',
    lengthM: '长度',
    thicknessMm: '厚度',
    sillHeightM: '窗台高度',
    areaM2: '面积',
    designCoolingLoadKw: '设计冷负荷',
    designHeatingLoadKw: '设计热负荷',
    nominalCapacityKw: '名义能力',
    airflowM3h: '风量',
    capacityKw: '散热量',
    loopSpacingMm: '盘管间距',
    designWaterTempC: '设计水温',
    installHeightM: '安装高度',
    loopCount: '回路数',
    diameterMm: '管径',
    insulationMm: '保温厚度',
    estimatedLengthM: '预估长度',
    widthMm: '宽度',
    heightMm: '高度',
    slopePercent: '坡度',
  };
  return labels[key] ?? key;
}

function dimensionUnit(key: string) {
  if (key.endsWith('M')) return 'm';
  if (key.endsWith('Mm')) return 'mm';
  if (key.endsWith('M2')) return 'm²';
  if (key.endsWith('Kw')) return 'kW';
  if (key.endsWith('M3h')) return 'm³/h';
  if (key.endsWith('C')) return '°C';
  if (key.endsWith('Percent')) return '%';
  return undefined;
}
