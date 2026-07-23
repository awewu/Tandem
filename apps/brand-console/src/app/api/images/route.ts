import { NextResponse } from 'next/server';
import { getSession, canWrite, nexus, getProductBySku, BRAND, BRAND_TENANT } from '../../../lib/brand';

type AssetRef = {
  role: string;
  artifactId: string;
  objectKey?: string;
  filename?: string;
  mimeType?: string;
  sortOrder?: number;
};

const PUBLIC_SITE_ORIGIN = (process.env.EVERHOT_PUBLIC_ORIGIN || process.env.EVERHOT_SITE_ORIGIN || 'http://localhost:4017').replace(/\/+$/, '');

const normalizeRole = (role: unknown): 'main' | 'detail' | 'icon' =>
  role === 'detail' || role === 'icon' ? role : 'main';

const normalizeSlug = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const publicImageUrl = (slug: string, artifactId: string) =>
  `${PUBLIC_SITE_ORIGIN}/api/v2/brand/${encodeURIComponent(BRAND)}/products/${encodeURIComponent(normalizeSlug(slug))}/images/${encodeURIComponent(artifactId)}`;

const allAssetRefs = (product: any): AssetRef[] =>
  Array.isArray(product?.assetRefs) ? product.assetRefs : [];

const isImageRole = (role: string) => role === 'main' || role === 'detail' || role === 'card' || role === 'icon';

const imageRefs = (product: any): AssetRef[] =>
  allAssetRefs(product).filter((a: any) => isImageRole(a?.role));

async function saveImageRefs(product: any, assetRefs: AssetRef[], meta: Record<string, unknown>, actor: { userId?: string; role?: string }) {
  const res = await nexus('/product-catalog/devices', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: BRAND_TENANT,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      category: product.category,
      status: product.status,
      meta,
      assetRefs,
    }),
  }, actor);
  if (!res.ok) throw new Error(`product image save HTTP ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const sku = new URL(req.url).searchParams.get('sku')?.trim();
  if (!sku) return NextResponse.json({ error: 'sku 必填' }, { status: 400 });
  const product = await getProductBySku(sku);
  if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
  const refs = imageRefs(product);
  return NextResponse.json({
    data: {
      main: refs.find((a) => a.role === 'main') || refs.find((a) => a.role === 'card') || null,
      icon: refs.find((a) => a.role === 'icon') || null,
      details: refs.filter((a) => a.role === 'detail').sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: '无写入权限（需要 brand_admin 角色）' }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '请求体无效' }, { status: 400 }); }
  const sku = String(body.sku || '').trim();
  const role = normalizeRole(body.role);
  const mimeType = String(body.mimeType || 'image/jpeg');
  if (!sku || !body.dataBase64) return NextResponse.json({ error: 'sku 与图片必填' }, { status: 400 });
  if (!mimeType.startsWith('image/')) return NextResponse.json({ error: '仅支持图片文件' }, { status: 400 });

  try {
    const product = await getProductBySku(sku);
    if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    const actor = { userId: session.sub, role: session.role };
    const upload = await nexus('/file-artifact/upload-base64', {
      method: 'POST',
      body: JSON.stringify({
        entityType: 'product-image',
        entityId: sku,
        filename: body.filename || `${sku}.jpg`,
        mimeType,
        dataBase64: body.dataBase64,
      }),
    }, actor);
    if (!upload.ok) return NextResponse.json({ error: `DAM 上传失败 HTTP ${upload.status}` }, { status: 502 });
    const artifact = (await upload.json()).data;
    const refs = allAssetRefs(product);
    const nonImageRefs = refs.filter((a) => !isImageRole(a.role));
    const current = refs.filter((a) => isImageRole(a.role) && (
      role === 'main'
        ? a.role !== 'main' && a.role !== 'card'
        : role === 'icon'
          ? a.role !== 'icon'
          : true
    ));
    const nextRef: AssetRef = {
      role,
      artifactId: artifact.id,
      objectKey: artifact.fileKey,
      filename: body.filename || `${sku}.jpg`,
      mimeType,
      sortOrder: role === 'detail'
        ? Math.max(-1, ...current.filter((a) => a.role === 'detail').map((a) => Number(a.sortOrder || 0))) + 1
        : 0,
    };
    const meta = { ...(product.meta || {}) };
    if (role === 'main') {
      Object.assign(meta, {
        imageArtifactId: artifact.id,
        imageObjectKey: artifact.fileKey,
        imageMimeType: mimeType,
        imageFilename: body.filename || `${sku}.jpg`,
        imageRole: 'main',
        imageOwned: true,
      });
    }
    if (role === 'icon') {
      const everhot = { ...((meta.everhot as Record<string, unknown>) || {}) };
      everhot.icon = publicImageUrl(String(everhot.slug || sku), artifact.id);
      everhot.iconArtifactId = artifact.id;
      everhot.iconFilename = body.filename || `${sku}-icon.jpg`;
      everhot.iconMimeType = mimeType;
      meta.everhot = everhot;
    }
    await saveImageRefs(product, [...nonImageRefs, ...current, nextRef], meta, actor);
    return NextResponse.json({ data: { artifactId: artifact.id, role, filename: nextRef.filename, mimeType } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: '无写入权限（需要 brand_admin 角色）' }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '请求体无效' }, { status: 400 }); }
  const sku = String(body.sku || '').trim();
  const order: string[] = Array.isArray(body.detailArtifactIds) ? body.detailArtifactIds.map(String) : [];
  if (!sku) return NextResponse.json({ error: 'sku 必填' }, { status: 400 });
  try {
    const product = await getProductBySku(sku);
    if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    const current = allAssetRefs(product);
    const next = current.map((ref) => ref.role === 'detail' && order.includes(ref.artifactId)
      ? { ...ref, sortOrder: order.indexOf(ref.artifactId) }
      : ref);
    await saveImageRefs(product, next, product.meta || {}, { userId: session.sub, role: session.role });
    return NextResponse.json({ data: { detailArtifactIds: order } });
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
  let artifactId = url.searchParams.get('artifactId') || '';
  if (!sku || !artifactId) {
    try {
      const body = await req.json();
      sku = sku || String(body.sku || '');
      artifactId = artifactId || String(body.artifactId || '');
    } catch {}
  }
  sku = sku.trim();
  artifactId = artifactId.trim();
  if (!sku || !artifactId) return NextResponse.json({ error: 'sku 与 artifactId 必填' }, { status: 400 });
  try {
    const product = await getProductBySku(sku);
    if (!product) return NextResponse.json({ error: '产品不存在' }, { status: 404 });
    const refs = allAssetRefs(product);
    const removed = refs.find((a) => a.artifactId === artifactId);
    const meta = { ...(product.meta || {}) };
    if (removed?.role === 'main' || removed?.role === 'card' || meta.imageArtifactId === artifactId) {
      delete meta.imageArtifactId;
      delete meta.imageObjectKey;
      delete meta.imageMimeType;
      delete meta.imageFilename;
      delete meta.imageRole;
      delete meta.imageOwned;
    }
    if (removed?.role === 'icon') {
      const everhot = { ...((meta.everhot as Record<string, unknown>) || {}) };
      delete everhot.icon;
      delete everhot.iconArtifactId;
      delete everhot.iconFilename;
      delete everhot.iconMimeType;
      meta.everhot = everhot;
    }
    await saveImageRefs(product, refs.filter((a) => a.artifactId !== artifactId), meta, { userId: session.sub, role: session.role });
    await nexus(`/file-artifact/${encodeURIComponent(artifactId)}`, { method: 'DELETE' }, { userId: session.sub, role: session.role }).catch(() => null);
    return NextResponse.json({ data: { deleted: !!removed } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
