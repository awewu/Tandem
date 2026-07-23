import { NextResponse } from 'next/server';
import { getSession, canWrite, nexus, listProducts, getProductBySku, fetchTaxonomy, BRAND, BRAND_TENANT } from '../../../lib/brand';

const EMPTY_POSITIONING = {
  targetSegments: [], channels: [], userPersonas: [], markets: [],
  valueProposition: '', painPoints: [], scenarios: [],
};

const PUBLIC_SITE_ORIGIN = (process.env.EVERHOT_PUBLIC_ORIGIN || process.env.EVERHOT_SITE_ORIGIN || 'http://localhost:4017').replace(/\/+$/, '');

const normalizeSlug = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toTags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  return [];
};

const toDisplayOrder = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

const toObjectList = (value: unknown, leftKey: string, rightKey: string) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          [leftKey]: String(row[leftKey] || '').trim(),
          [rightKey]: String(row[rightKey] || '').trim(),
        };
      })
      .filter((item) => item[leftKey] || item[rightKey]);
  }
  if (typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*[|:：]\s*/);
      return {
        [leftKey]: String(parts.shift() || '').trim(),
        [rightKey]: parts.join(' ').trim(),
      };
    })
    .filter((item) => item[leftKey] || item[rightKey]);
};

const toText = (value: unknown, fallback = ''): string => {
  if (value === undefined) return fallback;
  return String(value ?? '').trim();
};

const toGallery = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return { url: item.trim() };
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          url: String(row.url || '').trim(),
          alt: String(row.alt || '').trim(),
        };
      })
      .filter((item) => item.url);
  }
  if (typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*[|]\s*/);
      return {
        url: String(parts.shift() || '').trim(),
        alt: parts.join(' ').trim(),
      };
    })
    .filter((item) => item.url);
};

const toFaqs = (value: unknown) => toObjectList(value, 'q', 'a');

const publicImageUrl = (slug: string, artifactId?: unknown) => {
  const id = String(artifactId || '').trim();
  if (!id) return '';
  return `${PUBLIC_SITE_ORIGIN}/api/v2/brand/${encodeURIComponent(BRAND)}/products/${encodeURIComponent(slug)}/images/${encodeURIComponent(id)}`;
};

const upstreamError = async (res: Response, fallback: string) => {
  const text = await res.text().catch(() => '');
  if (!text) return fallback;
  try {
    const json = JSON.parse(text);
    return json?.error || json?.message || text;
  } catch {
    return text;
  }
};

// GET 产品列表 + 定位词表（供控制台渲染）
export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const page = Math.max(Number(url.searchParams.get('page') || 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') || 25), 1), 100);
    const [products, taxonomy] = await Promise.all([listProducts({ q, page, pageSize }), fetchTaxonomy()]);
    const rows = products.items
      .map((p) => {
        const everhot = p.meta?.everhot || {};
        const assetRefs = Array.isArray(p.assetRefs) ? p.assetRefs : [];
        const mainImage = assetRefs.find((a: any) => a?.role === 'main') || assetRefs.find((a: any) => a?.role === 'card') || null;
        const detailImages = assetRefs
          .filter((a: any) => a?.role === 'detail')
          .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0));
        const slug = normalizeSlug(everhot.slug ?? p.sku);
        const mainImageUrl = publicImageUrl(slug, mainImage?.artifactId || p.meta?.imageArtifactId);
        const gallery = detailImages.length
          ? detailImages.map((a: any) => ({
              url: publicImageUrl(slug, a?.artifactId),
              alt: a?.filename || '',
              filename: a?.filename || '',
              role: a?.role || 'detail',
              artifactId: a?.artifactId || '',
              sortOrder: Number(a?.sortOrder || 0),
            })).filter((item: { url: string }) => item.url)
          : (Array.isArray(everhot.gallery) ? everhot.gallery : []);
        return {
        id: p.id,
        sku: p.sku,
        slug,
        model: everhot.model ?? p.spec?.officialModel ?? p.sku,
        name: p.name,
        category: p.category,
        status: p.status,
        displayOrder: toDisplayOrder(everhot.displayOrder),
        listPrice: Number(p.listPrice ?? 0),
        tagline: everhot.tagline ?? '',
        cat: everhot.cat ?? p.category,
        sys: everhot.sys ?? '',
        series: everhot.series ?? '',
        tags: Array.isArray(everhot.tags) ? everhot.tags : [],
        specs: Array.isArray(everhot.specs) ? everhot.specs : [],
        badges: Array.isArray(everhot.badges) ? everhot.badges : [],
        features: Array.isArray(everhot.features) ? everhot.features : [],
        highlights: Array.isArray(everhot.highlights) ? everhot.highlights : [],
        en: everhot.en ?? '',
        icon: everhot.icon ?? '🔥',
        image: mainImageUrl || (everhot.image ?? ''),
        specImage: everhot.specImage ?? '',
        gallery,
        certs: Array.isArray(everhot.certs) ? everhot.certs : [],
        faqs: Array.isArray(everhot.faqs) ? everhot.faqs : [],
        hasImage: !!mainImage || !!p.meta?.imageArtifactId || !!everhot.image || !!everhot.specImage,
        imageRole: mainImage?.role ?? p.meta?.imageRole ?? null,
        detailImageCount: detailImages.length,
        // D2 定位层：卖给谁/渠道/用户/市场/卖点
        positioning: { ...EMPTY_POSITIONING, ...(p.positioning || {}) },
        // D2 素材引用（P2）
        assetRefs,
      };
      })
      .sort((a, b) => (a.displayOrder - b.displayOrder) || a.name.localeCompare(b.name) || a.sku.localeCompare(b.sku));
    return NextResponse.json({ data: { ...products, items: rows, taxonomy } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

// POST 编辑/上新/上下架：安全合并 meta.everhot，避免覆盖无损往返对象
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: '无写入权限（需要 brand_admin 角色）' }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '请求体无效' }, { status: 400 }); }
  const sku = String(body.sku || '').trim();
  if (!sku) return NextResponse.json({ error: 'sku 必填' }, { status: 400 });

  try {
    const existing = await getProductBySku(sku);
    if (body.createOnly && existing) {
      return NextResponse.json({ error: `SKU/slug 已存在：${sku}` }, { status: 409 });
    }
    const isNew = !existing;
    const prevMeta = existing?.meta || {};
    const prevEverhot = prevMeta.everhot || {};

    // 站点渲染读 meta.everhot；同步顶层与 meta.everhot 关键字段
    const name = body.name ?? existing?.name ?? sku;
    const category = body.category ?? existing?.category ?? prevEverhot.cat ?? null;
    const status = body.status ?? existing?.status ?? 'active';
    const listPrice = body.listPrice != null ? Number(body.listPrice) : Number(existing?.listPrice ?? 0);
    const displayOrderInput = body.displayOrder !== undefined ? Number(body.displayOrder) : toDisplayOrder(prevEverhot.displayOrder);
    if (!Number.isInteger(displayOrderInput) || displayOrderInput < 0) {
      return NextResponse.json({ error: '展示顺序必须是非负整数' }, { status: 400 });
    }
    const displayOrder = displayOrderInput;
    const tagline = body.tagline ?? prevEverhot.tagline ?? '';
    const slug = normalizeSlug(body.slug ?? prevEverhot.slug ?? sku);
    if (!slug) return NextResponse.json({ error: 'slug 必填' }, { status: 400 });
    const tags = body.tags !== undefined ? toTags(body.tags) : (Array.isArray(prevEverhot.tags) ? prevEverhot.tags : []);
    const specs = body.specs !== undefined ? toObjectList(body.specs, 'k', 'v') : (Array.isArray(prevEverhot.specs) ? prevEverhot.specs : []);
    const badges = body.badges !== undefined ? toTags(body.badges) : (Array.isArray(prevEverhot.badges) ? prevEverhot.badges : tags);
    const features = body.features !== undefined ? toObjectList(body.features, 'title', 'desc') : (Array.isArray(prevEverhot.features) ? prevEverhot.features : []);
    const highlights = body.highlights !== undefined ? toObjectList(body.highlights, 'label', 'value') : (Array.isArray(prevEverhot.highlights) ? prevEverhot.highlights : []);
    const gallery = body.gallery !== undefined ? toGallery(body.gallery) : (Array.isArray(prevEverhot.gallery) ? prevEverhot.gallery : []);
    const certs = body.certs !== undefined ? toTags(body.certs) : (Array.isArray(prevEverhot.certs) ? prevEverhot.certs : []);
    const faqs = body.faqs !== undefined ? toFaqs(body.faqs) : (Array.isArray(prevEverhot.faqs) ? prevEverhot.faqs : []);

    const everhot = {
      ...prevEverhot,
      slug,
      model: body.model ?? prevEverhot.model ?? existing?.spec?.officialModel ?? sku,
      name,
      displayOrder,
      tagline,
      tags,
      specs,
      badges,
      features,
      highlights,
      en: toText(body.en, prevEverhot.en ?? ''),
      icon: toText(body.icon, prevEverhot.icon ?? '🔥') || '🔥',
      image: toText(body.image, prevEverhot.image ?? ''),
      specImage: toText(body.specImage, prevEverhot.specImage ?? ''),
      gallery,
      certs,
      faqs,
      cat: category ?? prevEverhot.cat,
      // 上新时给最小可渲染骨架
      sys: body.sys ?? prevEverhot.sys ?? '',
      series: body.series ?? prevEverhot.series ?? '',
    };
    const meta = { ...prevMeta, everhot, source: prevMeta.source || 'brand-console', updatedAt: new Date().toISOString() };

    // 定位层：仅当显式传入时透传（服务端会归一化/受控词表软约束），避免 partial 保存误清定位。
    const positioningPatch = body.positioning !== undefined ? { positioning: body.positioning } : {};
    const spec = {
      ...(existing?.spec || {}),
      ...(body.model !== undefined ? { officialModel: String(body.model || '').trim() } : {}),
    };

    const res = await nexus('/product-catalog/devices', {
      method: 'POST',
      body: JSON.stringify({ tenantId: BRAND_TENANT, sku, name, brand: BRAND, category, status, listPrice, spec, meta, ...positioningPatch }),
    }, { userId: session.sub, role: session.role });
    if (!res.ok) {
      const detail = await upstreamError(res, `保存失败 HTTP ${res.status}`);
      return NextResponse.json({ error: detail }, { status: res.status >= 400 && res.status < 500 ? res.status : 502 });
    }
    const saved = await res.json();
    return NextResponse.json({ data: saved.data, isNew });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: '无写入权限（需要 brand_admin 角色）' }, { status: 403 });
  const url = new URL(req.url);
  let sku = url.searchParams.get('sku') || '';
  if (!sku) {
    try {
      const body = await req.json();
      sku = String(body.sku || '');
    } catch {}
  }
  sku = sku.trim();
  if (!sku) return NextResponse.json({ error: 'sku 必填' }, { status: 400 });

  try {
    const existing = await getProductBySku(sku);
    if (!existing?.id) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    const res = await nexus('/product-catalog/devices', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: BRAND_TENANT,
        sku: existing.sku,
        name: existing.name,
        brand: BRAND,
        category: existing.category,
        status: 'archived',
        listPrice: Number(existing.listPrice ?? 0),
        spec: existing.spec || {},
        meta: existing.meta || {},
        positioning: existing.positioning || undefined,
      }),
    }, { userId: session.sub, role: session.role });
    if (!res.ok) {
      const detail = await upstreamError(res, `删除失败 HTTP ${res.status}`);
      return NextResponse.json({ error: detail }, { status: res.status >= 400 && res.status < 500 ? res.status : 502 });
    }
    const saved = await res.json();
    return NextResponse.json({ data: saved.data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
