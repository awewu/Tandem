import { BadGatewayException } from '@nestjs/common';

const PUBLIC_SITE_IMAGE_TYPES = new Set([
  'brand_logo',
  'brand-site-basic-settings',
  'product-image',
  'product-detail-image',
  'product-main-image',
  'product-official-detail-image',
  'product-detail-body',
  'site-news',
  'site-news-body',
]);

type SiteMaterialFile = {
  path: string;
  mimeType: string;
  dataBase64: string;
};

export function siteMediaOriginEnabled() {
  const hasOrigin = Boolean(siteMediaOriginUrl());
  const hasToken = Boolean(process.env.SITE_MEDIA_SYNC_TOKEN);
  if (hasOrigin !== hasToken) {
    throw new Error('SITE_MEDIA_ORIGIN_URL and SITE_MEDIA_SYNC_TOKEN must be configured together');
  }
  return hasOrigin && hasToken;
}

export function shouldSyncPublicSiteImage(entityType: string, mimeType?: string | null) {
  return String(mimeType || '').toLowerCase().startsWith('image/') && PUBLIC_SITE_IMAGE_TYPES.has(entityType);
}

export function publicSiteImageUrl(fileKey: string) {
  const origin = siteMediaOriginUrl();
  if (!origin) return '';
  const encodedKey = String(fileKey || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
  return encodedKey ? `${origin}/media/${encodedKey}` : '';
}

export async function syncPublicSiteImage(input: { fileKey: string; mimeType: string; buffer: Buffer }) {
  if (!siteMediaOriginEnabled()) return '';
  const response = await postToMediaOrigin({
    kind: 'artifact-image',
    key: input.fileKey,
    mimeType: input.mimeType,
    dataBase64: input.buffer.toString('base64'),
  });
  const path = String(response?.data?.path || '');
  const url = path ? new URL(path, `${siteMediaOriginUrl()}/`).toString() : publicSiteImageUrl(input.fileKey);
  await assertPublicMediaAvailable(url);
  return url;
}

export async function readPublicSiteImage(fileKey: string) {
  if (!siteMediaOriginEnabled()) return null;
  const url = publicSiteImageUrl(fileKey);
  if (!url) return null;
  const response = await fetchWithTimeout(url, { cache: 'no-store' });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

export async function syncSiteMaterialBundle(manifest: Record<string, unknown>, files: SiteMaterialFile[] = []) {
  if (!siteMediaOriginEnabled()) return null;
  const response = await postToMediaOrigin({ kind: 'site-material-bundle', manifest, files });
  for (const file of files) {
    const relative = file.path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    await assertPublicMediaAvailable(`${siteMediaOriginUrl()}/assets/img/site-materials/${relative}`);
  }
  return response?.data || manifest;
}

export async function readRemoteSiteMaterialManifest() {
  const origin = siteMediaOriginUrl();
  if (!siteMediaOriginEnabled() || !origin) return null;
  const response = await fetchWithTimeout(`${origin}/assets/img/site-materials/manifest.json`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (response.status === 404) return {};
  if (!response.ok) throw new BadGatewayException(`Everhot media manifest returned HTTP ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function readRemoteSiteMaterialAsset(asset: string) {
  const origin = siteMediaOriginUrl();
  if (!siteMediaOriginEnabled() || !origin) return null;
  const url = new URL(asset, `${origin}/`).toString();
  const response = await fetchWithTimeout(url, { cache: 'no-store' });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function siteMediaOriginUrl() {
  return String(process.env.SITE_MEDIA_ORIGIN_URL || '').trim().replace(/\/+$/, '');
}

function siteMediaSyncUrl() {
  const configured = String(process.env.SITE_MEDIA_SYNC_URL || '').trim();
  return configured || `${siteMediaOriginUrl()}/internal/media-sync`;
}

async function postToMediaOrigin(payload: Record<string, unknown>) {
  const token = String(process.env.SITE_MEDIA_SYNC_TOKEN || '');
  if (!siteMediaOriginUrl() || !token) throw new BadGatewayException('A-server media sync is not configured');
  const response = await fetchWithTimeout(siteMediaSyncUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Everhot-Media-Token': token,
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null) as any;
  if (!response.ok || result?.success !== true) {
    throw new BadGatewayException(result?.error || `A-server media sync returned HTTP ${response.status}`);
  }
  return result;
}

async function assertPublicMediaAvailable(url: string) {
  if (!url) throw new BadGatewayException('A-server media sync did not return a public URL');
  const response = await fetchWithTimeout(url, { method: 'HEAD', cache: 'no-store' });
  if (!response.ok) throw new BadGatewayException(`A-server image verification returned HTTP ${response.status}`);
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.SITE_MEDIA_SYNC_TIMEOUT_MS || 30_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new BadGatewayException(`A-server media request failed: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
