import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 品牌注册表只读服务（配置驱动）。
 * ────────────────────────────────────────────────────────────────
 * 唯一事实源：仓库根目录 `brand-registry.json`（品牌基础要素：命名/VI/NAP/外链/交付方式）。
 * 「预留 Rhautt 持续新增品牌」的模式：新增品牌 = 往 brand-registry.json 增加一条 `brands[]`，
 * 本 API 自动暴露，无需改代码。各品牌站与后台 brand-console 消费此 API，禁止硬编码品牌要素。
 *
 * 注意：本服务只读、不含机密（品牌要素本身是可公开的市场信息）；写入仍走注册表文件 + 评审。
 */

export interface BrandVi {
  tokenCss?: string;
  primary?: string;
  primaryDark?: string;
  [k: string]: unknown;
}

export interface BrandEntry {
  slug: string;
  name_cn: string;
  name_en: string;
  domain?: string;
  type?: string;
  delivery?: string;
  selfBuilt?: boolean;
  token?: string;
  app?: string;
  standaloneLaunchable?: boolean;
  embeddedInRhauttPortal?: boolean;
  fundamentals?: { vi?: BrandVi; [k: string]: unknown };
  crossLinks?: Record<string, unknown>;
  [k: string]: unknown;
}

interface BrandRegistryFile {
  _governance?: { _vendor?: Record<string, unknown>; [k: string]: unknown };
  _resolvedDecisions?: string[];
  _openDecisions?: string[];
  brands: BrandEntry[];
}

export interface BrandSummary {
  slug: string;
  nameCn: string;
  nameEn: string;
  domain?: string;
  type?: string;
  delivery?: string;
  selfBuilt?: boolean;
  standaloneLaunchable?: boolean;
  embeddedInRhauttPortal?: boolean;
  primaryColor?: string;
  app?: string;
}

const CACHE_TTL_MS = 60 * 1000; // 注册表极少变动，1 分钟缓存即可；改文件后自动过期。

@Injectable()
export class BrandRegistryService {
  private readonly logger = new Logger(BrandRegistryService.name);
  private cache: BrandRegistryFile | null = null;
  private loadedAt = 0;
  private resolvedPath: string | null = null;

  /** 解析 brand-registry.json 路径：优先 env，其次从 cwd / __dirname 逐级向上查找。 */
  private resolvePath(): string {
    if (this.resolvedPath && fs.existsSync(this.resolvedPath)) return this.resolvedPath;

    const envPath = process.env.BRAND_REGISTRY_PATH;
    if (envPath && fs.existsSync(envPath)) {
      this.resolvedPath = envPath;
      return envPath;
    }

    const starts = [process.cwd(), __dirname];
    for (const start of starts) {
      let dir = start;
      // 逐级向上（最多 8 层）查找仓库根的 brand-registry.json
      for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, 'brand-registry.json');
        if (fs.existsSync(candidate)) {
          this.resolvedPath = candidate;
          return candidate;
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    throw new Error(
      'brand-registry.json not found. Set BRAND_REGISTRY_PATH or run from within the repo.',
    );
  }

  private load(force = false): BrandRegistryFile {
    if (!force && this.cache && Date.now() - this.loadedAt < CACHE_TTL_MS) {
      return this.cache;
    }
    const file = this.resolvePath();
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw) as BrandRegistryFile;
    if (!Array.isArray(parsed.brands)) {
      throw new Error('brand-registry.json malformed: missing brands[]');
    }
    this.cache = parsed;
    this.loadedAt = Date.now();
    this.logger.log(`Loaded brand registry: ${parsed.brands.length} brands from ${file}`);
    return parsed;
  }

  /** 强制重载（改注册表后可调用）。 */
  reload(): { reloaded: true; count: number } {
    const data = this.load(true);
    return { reloaded: true, count: data.brands.length };
  }

  private toSummary(b: BrandEntry): BrandSummary {
    return {
      slug: b.slug,
      nameCn: b.name_cn,
      nameEn: b.name_en,
      domain: b.domain,
      type: b.type,
      delivery: b.delivery,
      selfBuilt: b.selfBuilt,
      standaloneLaunchable: b.standaloneLaunchable,
      embeddedInRhauttPortal: b.embeddedInRhauttPortal,
      primaryColor: b.fundamentals?.vi?.primary as string | undefined,
      app: b.app,
    };
  }

  /** 品牌清单（摘要）+ 供应商与决策元数据。 */
  list(opts?: { type?: string; selfBuilt?: boolean }): {
    vendor: Record<string, unknown> | undefined;
    count: number;
    brands: BrandSummary[];
  } {
    const data = this.load();
    let brands = data.brands;
    if (opts?.type) brands = brands.filter(b => b.type === opts.type);
    if (typeof opts?.selfBuilt === 'boolean') {
      brands = brands.filter(b => Boolean(b.selfBuilt) === opts.selfBuilt);
    }
    return {
      vendor: data._governance?._vendor,
      count: brands.length,
      brands: brands.map(b => this.toSummary(b)),
    };
  }

  /** 单个品牌的完整要素（含 fundamentals / VI / NAP / 外链）。 */
  get(slug: string): BrandEntry {
    const data = this.load();
    const brand = data.brands.find(b => b.slug === slug);
    if (!brand) {
      throw new NotFoundException(`Unknown brand slug: ${slug}`);
    }
    return brand;
  }

  /** 治理元数据（供应商定位、已决/待决事项），供后台展示。 */
  meta(): Pick<BrandRegistryFile, '_governance' | '_resolvedDecisions' | '_openDecisions'> {
    const data = this.load();
    return {
      _governance: data._governance,
      _resolvedDecisions: data._resolvedDecisions,
      _openDecisions: data._openDecisions,
    };
  }
}
