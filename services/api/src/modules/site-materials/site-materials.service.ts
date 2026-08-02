import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  readRemoteSiteMaterialAsset,
  readRemoteSiteMaterialManifest,
  siteMediaOriginEnabled,
  syncSiteMaterialBundle,
} from '../file-artifact/site-media-origin.client';
import {
  SiteAudienceCardItem,
  SiteHeroCarouselItem,
  SiteMaterialKey,
  SiteMaterialManifest,
} from './site-materials.types';

const MATERIAL_KEYS = new Set<SiteMaterialKey>([
  'home-hero',
  'brand-story',
  'service-banner',
  'footer-cert',
]);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const DEFAULT_UPDATED_AT = '2026-07-31T00:00:00.000Z';

const DEFAULT_MANIFEST: SiteMaterialManifest = {
  'brand-story': {
    src: '/assets/img/site-materials/home-audience-residential-bg.webp',
    filename: 'home-audience-residential-bg.webp',
    mimeType: 'image/webp',
    size: 9554,
    updatedAt: DEFAULT_UPDATED_AT,
  },
  'service-banner': {
    src: '/assets/img/site-materials/home-audience-commercial-bg.webp',
    filename: 'home-audience-commercial-bg.webp',
    mimeType: 'image/webp',
    size: 9498,
    updatedAt: DEFAULT_UPDATED_AT,
  },
  'footer-cert': {
    src: '/assets/img/site-materials/home-audience-professionals-bg.webp',
    filename: 'home-audience-professionals-bg.webp',
    mimeType: 'image/webp',
    size: 10358,
    updatedAt: DEFAULT_UPDATED_AT,
  },
  'home-audience-cards': [
    {
      id: 'residential',
      tagZh: '家用',
      tagEn: 'RESIDENTIAL',
      title: '为家庭打造的舒适系统',
      description: '热水 · 采暖为核心，兼顾制冷，全屋舒适一站解决',
      primaryLabel: '热水 Water →',
      primaryHref: '/products/residential/water-heating/',
      secondaryLabel: '采暖制冷 Air →',
      secondaryHref: '/products/residential/heating-cooling/',
      visible: true,
      sortOrder: 0,
    },
    {
      id: 'commercial',
      tagZh: '商用',
      tagEn: 'COMMERCIAL',
      title: '为建筑而生的工程系统',
      description: '酒店 · 公寓 · 综合体，高并发连续供热水、稳定供暖，兼顾供冷',
      primaryLabel: '热水 Water →',
      primaryHref: '/products/commercial/water-heating/',
      secondaryLabel: '采暖制冷 Air →',
      secondaryHref: '/products/commercial/heating-cooling/',
      visible: true,
      sortOrder: 1,
    },
    {
      id: 'professionals',
      tagZh: '专业人士',
      tagEn: 'PROFESSIONALS',
      title: '为经销商与工程师赋能',
      description: '培训 · 技术资料 · BIM/CAD · 合作计划',
      primaryLabel: '专业人士中心 →',
      primaryHref: '/professionals/',
      secondaryLabel: '查找经销商 →',
      secondaryHref: '/find-a-pro/',
      visible: true,
      sortOrder: 2,
    },
  ],
};

@Injectable()
export class SiteMaterialsService {
  private readonly everhotPublicDir = resolveEverhotPublicDir();
  private readonly materialDir = path.join(this.everhotPublicDir, 'assets', 'img', 'site-materials');
  private readonly manifestPath = path.join(this.materialDir, 'manifest.json');

  async list(brandCode: string): Promise<SiteMaterialManifest> {
    this.assertSupportedBrand(brandCode);
    return this.readManifest();
  }

  async readAsset(brandCode: string, asset: string): Promise<{ buffer: Buffer; mimeType: string }> {
    this.assertSupportedBrand(brandCode);
    const remoteBuffer = await readRemoteSiteMaterialAsset(asset);
    if (remoteBuffer) return { buffer: remoteBuffer, mimeType: mimeTypeFromFilename(path.basename(asset)) };
    const localAssetPath = this.resolvePreviewAssetPath(asset);
    if (!localAssetPath) throw new BadRequestException('unsupported material asset');

    try {
      const buffer = await readFile(localAssetPath);
      return { buffer, mimeType: mimeTypeFromFilename(path.basename(asset)) };
    } catch {
      throw new NotFoundException('material asset not found');
    }
  }

  async upload(brandCode: string, body: {
    key?: string;
    filename?: string;
    mimeType?: string;
    dataBase64?: string;
    files?: Array<{ filename?: string; mimeType?: string; dataBase64?: string; linkUrl?: string }>;
  }): Promise<unknown> {
    this.assertSupportedBrand(brandCode);

    if (body.key === 'home-hero-carousel') {
      return this.uploadCarousel(body.files);
    }

    const key = body.key as SiteMaterialKey;
    if (!MATERIAL_KEYS.has(key)) throw new BadRequestException('unsupported material key');

    const { ext, buffer, mimeType } = decodeImage(body.mimeType, body.dataBase64);
    const outputName = `${key}-${Date.now()}.${ext}`;

    const manifest = await this.readManifest();
    manifest[key] = {
      src: `/assets/img/site-materials/${outputName}`,
      filename: String(body.filename || outputName),
      mimeType,
      size: buffer.length,
      updatedAt: new Date().toISOString(),
    };
    await this.writeManifest(manifest, [{ path: outputName, mimeType, dataBase64: buffer.toString('base64') }]);
    return manifest[key];
  }

  async update(brandCode: string, body: {
    key?: string;
    items?: SiteHeroCarouselItem[] | SiteAudienceCardItem[];
    resetDefault?: boolean;
  }) {
    this.assertSupportedBrand(brandCode);

    const materialKey = body.key as SiteMaterialKey;
    if (body.resetDefault === true && MATERIAL_KEYS.has(materialKey)) {
      const manifest = await this.readManifest();
      manifest[materialKey] = DEFAULT_MANIFEST[materialKey];
      await this.writeManifest(manifest);
      return manifest[materialKey];
    }

    if (body.key === 'home-audience-cards' && Array.isArray(body.items)) {
      const allowed = new Set(['residential', 'commercial', 'professionals']);
      const items = (body.items as SiteAudienceCardItem[])
        .filter((item) => allowed.has(String(item?.id || '')))
        .map((item, index) => ({
          id: String(item.id),
          tagZh: String(item.tagZh || '').slice(0, 24),
          tagEn: String(item.tagEn || '').slice(0, 32),
          title: String(item.title || '').slice(0, 80),
          description: String(item.description || '').slice(0, 160),
          primaryLabel: String(item.primaryLabel || '').slice(0, 32),
          primaryHref: sanitizeLinkUrl(item.primaryHref),
          secondaryLabel: String(item.secondaryLabel || '').slice(0, 32),
          secondaryHref: sanitizeLinkUrl(item.secondaryHref),
          visible: item.visible !== false,
          sortOrder: index,
        }));
      const manifest = await this.readManifest();
      manifest['home-audience-cards'] = items;
      await this.writeManifest(manifest);
      return items;
    }

    if (body.key !== 'home-hero-carousel' || !Array.isArray(body.items)) {
      throw new BadRequestException('unsupported material update');
    }

    const items = (body.items as SiteHeroCarouselItem[])
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

    const manifest = await this.readManifest();
    manifest['home-hero-carousel'] = items;
    await this.writeManifest(manifest);
    return items;
  }

  private async uploadCarousel(filesInput: unknown) {
    const files = Array.isArray(filesInput) ? filesInput : [];
    if (!files.length) throw new BadRequestException('missing carousel images');

    const manifest = await this.readManifest();
    const current = Array.isArray(manifest['home-hero-carousel']) ? manifest['home-hero-carousel'] : [];
    const now = Date.now();
    const saved: SiteHeroCarouselItem[] = [];
    const bundleFiles: Array<{ path: string; mimeType: string; dataBase64: string }> = [];

    for (const [index, file] of files.entries()) {
      const row = file as { filename?: string; mimeType?: string; dataBase64?: string; linkUrl?: string };
      const { ext, buffer, mimeType } = decodeImage(row.mimeType, row.dataBase64);
      const id = `hero-${now}-${index}`;
      const outputName = `${id}.${ext}`;
      bundleFiles.push({ path: outputName, mimeType, dataBase64: buffer.toString('base64') });
      saved.push({
        id,
        src: `/assets/img/site-materials/${outputName}`,
        filename: String(row.filename || outputName),
        mimeType,
        size: buffer.length,
        updatedAt: new Date().toISOString(),
        linkUrl: sanitizeLinkUrl(row.linkUrl),
        remark: '',
        visible: true,
        sortOrder: current.length + index,
      });
    }

    manifest['home-hero-carousel'] = [...current, ...saved].map((item, index) => ({ ...item, sortOrder: index }));
    await this.writeManifest(manifest, bundleFiles);
    return manifest['home-hero-carousel'];
  }

  private async readManifest(): Promise<SiteMaterialManifest> {
    const remoteManifest = await readRemoteSiteMaterialManifest();
    if (remoteManifest) return { ...DEFAULT_MANIFEST, ...remoteManifest } as SiteMaterialManifest;
    try {
      const manifest = JSON.parse(await readFile(this.manifestPath, 'utf8'));
      return { ...DEFAULT_MANIFEST, ...manifest };
    } catch {
      return { ...DEFAULT_MANIFEST };
    }
  }

  private async writeManifest(
    manifest: SiteMaterialManifest,
    files: Array<{ path: string; mimeType: string; dataBase64: string }> = [],
  ) {
    if (siteMediaOriginEnabled()) {
      await syncSiteMaterialBundle(manifest as Record<string, unknown>, files);
      return;
    }
    await mkdir(this.materialDir, { recursive: true });
    for (const file of files) {
      await writeFile(path.join(this.materialDir, file.path), Buffer.from(file.dataBase64, 'base64'));
    }
    await writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  private assertSupportedBrand(brandCode: string) {
    if (brandCode !== 'everhot') throw new NotFoundException('only everhot site materials are supported');
  }

  private resolvePreviewAssetPath(asset: string): string | null {
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
    const resolved = path.resolve(this.everhotPublicDir, relative);
    const publicRoot = path.resolve(this.everhotPublicDir);
    return resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`) ? resolved : null;
  }
}

function decodeImage(mimeTypeInput: unknown, dataBase64Input: unknown) {
  const mimeType = String(mimeTypeInput || '').toLowerCase();
  const ext = MIME_EXTENSIONS[mimeType];
  if (!ext) throw new BadRequestException('unsupported image type');

  const dataBase64 = String(dataBase64Input || '').replace(/^data:[^;]+;base64,/, '');
  if (!dataBase64) throw new BadRequestException('missing image data');

  const buffer = Buffer.from(dataBase64, 'base64');
  if (!buffer.length) throw new BadRequestException('empty image data');
  return { ext, buffer, mimeType };
}

function sanitizeLinkUrl(value: unknown): string {
  const link = String(value || '').trim();
  if (!link) return '';
  if (link.startsWith('/') || /^https?:\/\//i.test(link)) return link;
  return '';
}

function mimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'ico') return 'image/x-icon';
  return 'image/png';
}

function resolveEverhotPublicDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'apps', 'everhot-cn', 'public'),
    path.resolve(process.cwd(), '..', '..', 'apps', 'everhot-cn', 'public'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'apps', 'everhot-cn', 'public'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  return found || candidates[0];
}
