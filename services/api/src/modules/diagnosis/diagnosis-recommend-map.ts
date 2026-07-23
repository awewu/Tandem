const VILLA_AREA_MIN = 200;

export const DIAGNOSIS_RECOMMENDATION_BRANDS = ['rheem', 'ruud', 'everhot'] as const;

const BRAND_TENANT_IDS: Record<string, string> = {
  rheem: process.env.RHEEM_TENANT_ID || '4aee0000-0000-4000-8000-000000000001',
  ruud: process.env.RUUD_TENANT_ID || '7aad0000-0000-4000-8000-000000000001',
  everhot: process.env.EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001',
};

const TIER1_CITIES = ['北京', '上海', '广州', '深圳'];
const SOUTH_HUMID_CITIES = [
  '上海', '杭州', '南京', '苏州', '宁波', '无锡', '广州', '深圳', '珠海', '东莞',
  '武汉', '长沙', '南昌', '福州', '厦门', '成都', '重庆', '南宁', '合肥',
];
const NORTH_HEATING_CITIES = [
  '北京', '天津', '济南', '青岛', '石家庄', '太原', '郑州', '西安', '兰州',
  '沈阳', '大连', '长春', '哈尔滨', '呼和浩特', '银川', '乌鲁木齐',
];
const EAST_VILLA_CITIES = ['上海', '杭州', '苏州', '南京', '宁波', '无锡', '嘉兴'];

function cityToMarkets(cityRaw: string): string[] {
  const city = String(cityRaw || '').trim();
  if (!city) return [];
  const hit = (list: string[]) => list.some((c) => city.includes(c));
  const markets: string[] = [];
  if (hit(SOUTH_HUMID_CITIES)) markets.push('south_humid');
  if (hit(NORTH_HEATING_CITIES)) markets.push('north_heating');
  if (hit(TIER1_CITIES)) markets.push('tier1_city');
  if (hit(EAST_VILLA_CITIES)) markets.push('east_villa');
  return markets;
}

function tierToPersonas(tierId: string): string[] {
  if (tierId === 'premium') return ['premium_upgrade'];
  if (tierId === 'essential') return ['essential'];
  return [];
}

export interface RecommendCriteria {
  tenantId?: string;
  brand?: string;
  segments?: string[];
  channels?: string[];
  personas?: string[];
  markets?: string[];
  systems?: string[];
  painPoints?: string[];
  limit?: number;
}

export interface DiagnosisBrandTenant {
  brand: string;
  tenantId: string;
}

export function resolveDiagnosisBrandTenants(input?: unknown): DiagnosisBrandTenant[] {
  const requested = Array.isArray(input)
    ? input.map((item) => String(item).toLowerCase())
    : typeof input === 'string' && input.trim()
      ? [input.trim().toLowerCase()]
      : [];
  const brands = requested.length
    ? DIAGNOSIS_RECOMMENDATION_BRANDS.filter((brand) => requested.includes(brand))
    : DIAGNOSIS_RECOMMENDATION_BRANDS;
  return brands.map((brand) => ({ brand, tenantId: BRAND_TENANT_IDS[brand] }));
}

export function buildRecommendCriteria(payload: any = {}, result: any = {}): RecommendCriteria {
  const home = payload?.home || payload?.profile || {};
  const area = Number(home.area ?? payload?.area ?? 0) || 0;
  const type = String(home.type ?? payload?.propertyType ?? '').toLowerCase();
  const city = String(home.city ?? payload?.city ?? '');
  const tierId = String(result?.recommendedTierId || 'balanced');

  const isVilla = type.includes('villa') || type.includes('别墅') || area >= VILLA_AREA_MIN;
  const isCommercial = type.includes('commercial') || type.includes('商用') || type.includes('office');

  const segments = isCommercial ? ['commercial'] : isVilla ? ['villa'] : ['home'];
  const personas = tierToPersonas(tierId);
  const markets = cityToMarkets(city);
  const painPoints = Array.isArray(result?.diagnosis?.painPoints) ? result.diagnosis.painPoints
    : Array.isArray(payload?.painPoints) ? payload.painPoints : [];
  const systems = Array.isArray(result?.diagnosis?.systems) ? result.diagnosis.systems
    : Array.isArray(payload?.systems) ? payload.systems : [];

  return {
    channels: ['dealer'],
    segments,
    personas,
    markets,
    systems,
    painPoints,
    limit: 6,
  };
}
