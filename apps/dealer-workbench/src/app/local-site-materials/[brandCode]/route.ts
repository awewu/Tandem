import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SiteMaterialKey = 'home-hero' | 'brand-story' | 'service-banner' | 'footer-cert';
type SiteHeroCarouselKey = 'home-hero-carousel';
type SiteAudienceCardsKey = 'home-audience-cards';
type SiteHeroCarouselItem = {
  id: string;
  src: string;
  filename: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  linkUrl?: string;
  remark?: string;
  visible?: boolean;
  sortOrder: number;
};
type SiteAudienceCardItem = {
  id: string;
  tagZh: string;
  tagEn: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  visible: boolean;
  sortOrder: number;
};
type RouteContext = { params: Promise<{ brandCode: string }> };

const MATERIAL_KEYS = new Set<SiteMaterialKey>([
  'home-hero',
  'brand-story',
  'service-banner',
  'footer-cert',
]);

const MATERIAL_DIR = path.join(
  process.cwd(),
  '..',
  'everhot-cn',
  'public',
  'assets',
  'img',
  'site-materials'
);
const EVERHOT_PUBLIC_DIR = path.join(process.cwd(), '..', 'everhot-cn', 'public');
const MANIFEST_PATH = path.join(MATERIAL_DIR, 'manifest.json');
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function GET(req: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  if (params.brandCode !== 'everhot') {
    return NextResponse.json({ error: 'only everhot site materials are supported' }, { status: 404 });
  }

  const asset = new URL(req.url).searchParams.get('asset');
  if (asset) {
    const localAssetPath = resolvePreviewAssetPath(asset);
    if (!localAssetPath) {
      return NextResponse.json({ error: 'unsupported material asset' }, { status: 400 });
    }
    const filename = path.basename(asset);
    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const mimeType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'ico'
              ? 'image/x-icon'
            : 'image/png';
    try {
      const buffer = await readFile(localAssetPath);
      return new Response(buffer, { headers: { 'Content-Type': mimeType, 'Cache-Control': 'no-store' } });
    } catch {
      return NextResponse.json({ error: 'material asset not found' }, { status: 404 });
    }
  }

  return NextResponse.json({ data: await readManifest() });
}

export async function POST(req: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  if (params.brandCode !== 'everhot') {
    return NextResponse.json({ error: 'only everhot site materials are supported' }, { status: 404 });
  }

  let body: {
    key?: string;
    filename?: string;
    mimeType?: string;
    dataBase64?: string;
    files?: Array<{ filename?: string; mimeType?: string; dataBase64?: string; linkUrl?: string }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  if (body.key === 'home-hero-carousel') {
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) {
      return NextResponse.json({ error: 'missing carousel images' }, { status: 400 });
    }

    await mkdir(MATERIAL_DIR, { recursive: true });
    const manifest = await readManifest();
    const current = Array.isArray(manifest['home-hero-carousel']) ? manifest['home-hero-carousel'] : [];
    const now = Date.now();
    const saved: SiteHeroCarouselItem[] = [];

    for (const [index, file] of files.entries()) {
      const mimeType = String(file.mimeType || '').toLowerCase();
      const ext = MIME_EXTENSIONS[mimeType];
      if (!ext) {
        return NextResponse.json({ error: 'unsupported image type' }, { status: 400 });
      }
      const dataBase64 = String(file.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!dataBase64) {
        return NextResponse.json({ error: 'missing image data' }, { status: 400 });
      }
      const buffer = Buffer.from(dataBase64, 'base64');
      if (!buffer.length) {
        return NextResponse.json({ error: 'empty image data' }, { status: 400 });
      }

      const id = `hero-${now}-${index}`;
      const outputName = `${id}.${ext}`;
      await writeFile(path.join(MATERIAL_DIR, outputName), buffer);
      saved.push({
        id,
        src: `/assets/img/site-materials/${outputName}`,
        filename: String(file.filename || outputName),
        mimeType,
        size: buffer.length,
        updatedAt: new Date().toISOString(),
        linkUrl: sanitizeLinkUrl(file.linkUrl),
        remark: '',
        visible: true,
        sortOrder: current.length + index,
      });
    }

    manifest['home-hero-carousel'] = [...current, ...saved].map((item, index) => ({ ...item, sortOrder: index }));
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    return NextResponse.json({ data: manifest['home-hero-carousel'] });
  }

  const key = body.key as SiteMaterialKey;
  if (!MATERIAL_KEYS.has(key)) {
    return NextResponse.json({ error: 'unsupported material key' }, { status: 400 });
  }

  const mimeType = String(body.mimeType || '').toLowerCase();
  const ext = MIME_EXTENSIONS[mimeType];
  if (!ext) {
    return NextResponse.json({ error: 'unsupported image type' }, { status: 400 });
  }

  const dataBase64 = String(body.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!dataBase64) {
    return NextResponse.json({ error: 'missing image data' }, { status: 400 });
  }

  const buffer = Buffer.from(dataBase64, 'base64');
  if (!buffer.length) {
    return NextResponse.json({ error: 'empty image data' }, { status: 400 });
  }

  await mkdir(MATERIAL_DIR, { recursive: true });
  const outputName = `${key}.${ext}`;
  const outputPath = path.join(MATERIAL_DIR, outputName);
  await writeFile(outputPath, buffer);

  const manifest = await readManifest();
  manifest[key] = {
    src: `/assets/img/site-materials/${outputName}`,
    filename: String(body.filename || outputName),
    mimeType,
    size: buffer.length,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  return NextResponse.json({ data: manifest[key] });
}

export async function PUT(req: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  if (params.brandCode !== 'everhot') {
    return NextResponse.json({ error: 'only everhot site materials are supported' }, { status: 404 });
  }

  let body: { key?: string; items?: SiteHeroCarouselItem[] | SiteAudienceCardItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  if (body.key === 'home-audience-cards' && Array.isArray(body.items)) {
    const allowed = new Set(['residential', 'commercial', 'professionals']);
    const items = body.items
      .filter((item) => allowed.has(String((item as SiteAudienceCardItem)?.id || '')))
      .map((item, index) => {
        const row = item as SiteAudienceCardItem;
        return {
          id: String(row.id),
          tagZh: String(row.tagZh || '').slice(0, 24),
          tagEn: String(row.tagEn || '').slice(0, 32),
          title: String(row.title || '').slice(0, 80),
          description: String(row.description || '').slice(0, 160),
          primaryLabel: String(row.primaryLabel || '').slice(0, 32),
          primaryHref: sanitizeLinkUrl(row.primaryHref),
          secondaryLabel: String(row.secondaryLabel || '').slice(0, 32),
          secondaryHref: sanitizeLinkUrl(row.secondaryHref),
          visible: row.visible !== false,
          sortOrder: index,
        };
      });
    const manifest = await readManifest();
    manifest['home-audience-cards'] = items;
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
    return NextResponse.json({ data: items });
  }

  if (body.key !== 'home-hero-carousel' || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'unsupported material update' }, { status: 400 });
  }

  const carouselItems = body.items as SiteHeroCarouselItem[];
  const items = carouselItems
    .filter((item) => typeof item?.src === 'string' && item.src.startsWith('/assets/img/site-materials/'))
    .map((item, index) => ({
      id: String(item.id || `hero-${Date.now()}-${index}`),
      src: String(item.src),
      filename: String(item.filename || item.src.split('/').pop() || 'hero-banner'),
      mimeType: String(item.mimeType || 'image/png'),
      size: Number(item.size || 0),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
      linkUrl: sanitizeLinkUrl(item.linkUrl),
      remark: String(item.remark || '').slice(0, 200),
      visible: item.visible !== false,
      sortOrder: index,
    }));

  const manifest = await readManifest();
  manifest['home-hero-carousel'] = items;
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  return NextResponse.json({ data: items });
}

async function readManifest(): Promise<
  Partial<
    Record<SiteMaterialKey, { src: string; filename: string; mimeType: string; size: number; updatedAt: string }> &
      Record<SiteHeroCarouselKey, SiteHeroCarouselItem[]>
      & Record<SiteAudienceCardsKey, SiteAudienceCardItem[]>
  >
> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function sanitizeLinkUrl(value: unknown): string {
  const link = String(value || '').trim();
  if (!link) return '';
  if (link.startsWith('/') || /^https?:\/\//i.test(link)) return link;
  return '';
}

function resolvePreviewAssetPath(asset: string): string | null {
  const normalized = asset.replace(/\\/g, '/');
  const allowed =
    normalized.startsWith('/assets/img/site-materials/') ||
    normalized.startsWith('/assets/img/brand/') ||
    normalized === '/favicon-16x16.png' ||
    normalized === '/favicon-32x32.png' ||
    normalized === '/favicon.ico' ||
    normalized === '/apple-touch-icon.png';

  if (!allowed) return null;
  const relative = normalized.replace(/^\/+/, '');
  const resolved = path.resolve(EVERHOT_PUBLIC_DIR, relative);
  const publicRoot = path.resolve(EVERHOT_PUBLIC_DIR);
  return resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null;
}
