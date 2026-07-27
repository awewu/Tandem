import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SiteMaterialKey = 'home-hero' | 'brand-story' | 'service-banner' | 'footer-cert';
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
const MANIFEST_PATH = path.join(MATERIAL_DIR, 'manifest.json');
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function GET(_req: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  if (params.brandCode !== 'everhot') {
    return NextResponse.json({ error: 'only everhot site materials are supported' }, { status: 404 });
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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
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

async function readManifest(): Promise<
  Partial<Record<SiteMaterialKey, { src: string; filename: string; mimeType: string; size: number; updatedAt: string }>>
> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}
