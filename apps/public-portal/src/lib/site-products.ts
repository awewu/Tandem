import 'server-only';

const SITE_CODE = 'rhautt-group';
const API_ORIGIN = (process.env.NEXUS_API_ORIGIN || 'http://localhost:5500').replace(/\/+$/, '');

type UnknownRecord = Record<string, unknown>;

export type SiteProduct = {
  id: string;
  name: string;
  desc: string;
  brand: string;
  cat: string;
  code: string;
  bg: string;
  metric: string;
  eco: boolean;
  image: string;
  specs: { label: string; value: string }[];
  features: string[];
  scenarios: string[];
};

export type SiteProductListResult =
  | { ok: true; items: SiteProduct[] }
  | { ok: false; items: []; message: string };

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item.trim();
    const row = record(item);
    return text(row.title) || text(row.desc) || text(row.label);
  }).filter(Boolean);
}

function brandBackground(brand: string): string {
  if (brand.toLowerCase() === 'ruud') return 'linear-gradient(135deg,rgba(44,49,52,0.16),rgba(228,0,43,0.08))';
  if (brand.toLowerCase() === 'everhot') return 'linear-gradient(135deg,rgba(228,0,43,0.09),rgba(16,28,40,0.06))';
  return 'linear-gradient(135deg,rgba(228,0,43,0.12),rgba(118,35,47,0.06))';
}

function mapProduct(value: unknown): SiteProduct | null {
  const product = record(value);
  const id = text(product.slug) || text(product.sku);
  const name = text(product.name);
  if (!id || !name) return null;

  const siteMeta = record(product.siteMeta);
  const positioning = record(product.positioning);
  const highlights = Array.isArray(product.highlights) ? product.highlights.map(record) : [];
  const firstHighlight = highlights[0] || {};
  const specs = Array.isArray(product.specs) ? product.specs.map((item) => {
    const row = record(item);
    return { label: text(row.label) || text(row.k), value: text(row.value) || text(row.v) };
  }).filter((item) => item.label && item.value) : [];
  const tags = [...textList(product.tags), ...textList(product.badges)];
  const brand = text(product.brand) || 'Rhautt';

  return {
    id,
    name,
    desc: text(product.summary) || text(product.tagline),
    brand,
    cat: text(product.websiteCategory) || text(product.cat) || text(product.category) || '其他产品',
    code: text(siteMeta.code) || text(product.series) || text(product.sku).split('-')[0] || 'HVAC',
    bg: brandBackground(brand),
    metric: [text(firstHighlight.value), text(firstHighlight.label)].filter(Boolean).join(' ') || text(product.series),
    eco: tags.some((tag) => /节能|能效|eco|energy/i.test(tag)),
    image: text(product.image) || text(record(product.mainImage).url),
    specs,
    features: textList(product.features),
    scenarios: textList(positioning.scenarios).length ? textList(positioning.scenarios) : textList(siteMeta.scenarios),
  };
}

async function fetchPublic(path: string): Promise<Response> {
  return fetch(`${API_ORIGIN}/api/v2/sites/${SITE_CODE}/products${path}`, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });
}

export async function listSiteProducts(): Promise<SiteProductListResult> {
  try {
    const response = await fetchPublic('?locale=zh-CN');
    if (!response.ok) return { ok: false, items: [], message: `产品服务返回 HTTP ${response.status}` };
    const payload = record(await response.json());
    const data = record(payload.data);
    if (!Array.isArray(data.items)) return { ok: false, items: [], message: '产品服务响应格式无效' };
    return { ok: true, items: data.items.map(mapProduct).filter((item): item is SiteProduct => item !== null) };
  } catch {
    return { ok: false, items: [], message: '产品服务暂时不可用' };
  }
}

export async function getSiteProduct(slug: string): Promise<SiteProduct | null> {
  try {
    const response = await fetchPublic(`/${encodeURIComponent(slug)}?locale=zh-CN`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return mapProduct(record(await response.json()).data);
  } catch {
    return null;
  }
}

export const SITE_PRODUCT_BRAND_COLOR: Record<string, string> = {
  Rheem: 'var(--rh-red)',
  rheem: 'var(--rh-red)',
  Ruud: 'var(--rh-red)',
  ruud: 'var(--rh-red)',
  Everhot: 'var(--rh-red)',
  EverHot: 'var(--rh-red)',
  everhot: 'var(--rh-red)',
  Rhautt: 'var(--rh-red-dk)',
};
