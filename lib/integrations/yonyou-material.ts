import { childLogger } from '@/lib/infra/logger';
import {
  getYonyouAccessToken,
  getYonyouTokenConfig,
  isYonyouTokenConfigured,
  YonyouTokenConfigError,
  YonyouTokenRequestError,
  type YonyouTokenConfig,
} from './yonyou-token';

const DEFAULT_MATERIAL_LIST_PATH = '/yonbip/digitalModel/product/integration/querylist';
const DEFAULT_MATERIAL_CATEGORY_TREE_PATH = '/yonbip/digitalModel/managementclass/newtree';
const FALLBACK_MATERIAL_LIST_PATHS = [
  '/yonbip/digitalModel/product/newlistrange',
  '/yonbip/digitalModel/productcenter/product/newlistrange',
  '/yonbip/digitalModel/material/newlistrange',
  '/yonbip/digitalModel/pc_product/newlistrange',
];
const FALLBACK_MATERIAL_CATEGORY_TREE_PATHS = [
  '/yonbip/digitalModel/productcenter/managementclass/newtree',
  '/yonbip/digitalModel/materialclass/newtree',
  '/yonbip/digitalModel/pc_managementclass/newtree',
];
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 5_000;

type LocalizedText = string | {
  simplifiedName?: string;
  englishName?: string;
  traditionalName?: string;
};

export interface YonyouMaterialConfig extends YonyouTokenConfig {
  apiPrefix?: string;
  materialListPath?: string;
  materialCategoryTreePath?: string;
  materialTimeoutMs?: number;
  categoryCodeField?: string;
  enabledField?: string;
  productRootCategoryCodes?: string[];
}

export interface YonyouMaterialRecord {
  id?: string | number;
  code?: string;
  name?: LocalizedText;
  materialName?: LocalizedText;
  productName?: LocalizedText;
  model?: string;
  specification?: string;
  specs?: string;
  unitName?: string;
  unit?: string;
  materialClassCode?: string;
  materialClassName?: string;
  manageClassCode?: string;
  manageClassName?: string;
  managementClassCode?: string;
  managementClassName?: string;
  productLineName?: string;
  productLineCode?: string;
  brandName?: string;
  listPrice?: string | number;
  price?: string | number;
  stopStatus?: boolean;
  stopstatus?: boolean;
  isEnabled?: boolean;
  enable?: boolean;
  pubts?: string;
  modifyTime?: string;
  createTime?: string;
  [key: string]: unknown;
}

export interface YonyouMaterialListResult {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  recordCount: number;
  pubts?: string;
  records: YonyouMaterialRecord[];
}

export interface YonyouMaterialCategoryRecord {
  id?: string | number;
  code?: string;
  name?: LocalizedText;
  parent?: string | number;
  parentId?: string | number;
  order?: number;
  level?: number;
  isEnabled?: boolean;
  orgId?: string;
  [key: string]: unknown;
}

export interface YonyouMaterialCategory {
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  order?: number;
  level: number;
  isEnabled: boolean;
  orgId?: string;
}

export interface YonyouProductCatalogItem {
  id: string;
  series: string;
  seriesCode?: string;
  model: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  minPrice?: number;
  status: 'active' | 'stopped';
  source: 'ys';
  sourceRefId?: string;
  sourceUpdatedAt?: string;
  attributes: Record<string, string>;
}

interface YonyouMaterialListResponse {
  code?: string;
  message?: string;
  data?: {
    pageCount?: number | string;
    recordCount?: number | string;
    pageSize?: number | string;
    recordList?: YonyouMaterialRecord[];
    pageIndex?: number | string;
    pubts?: string;
  } | YonyouMaterialRecord[];
}

interface YonyouMaterialCategoryTreeResponse {
  code?: string;
  message?: string;
  data?: YonyouMaterialCategoryRecord[];
}

export class YonyouMaterialRequestError extends Error {
  constructor(
    message: string,
    readonly details: {
      status?: number;
      code?: string;
      yonyouMessage?: string;
      endpoint?: string;
    } = {},
  ) {
    super(message);
    this.name = 'YonyouMaterialRequestError';
  }
}

const log = childLogger({ integration: 'yonyou', component: 'material-readonly' });

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function joinApiPrefix(apiPrefix: string | undefined, path: string): string {
  const normalizedPath = normalizePath(path);
  if (!apiPrefix?.trim()) return normalizedPath;
  const prefix = normalizePath(apiPrefix.trim()).replace(/\/+$/, '');
  if (prefix.endsWith('/yonbip') && normalizedPath.startsWith('/yonbip/')) {
    return `${prefix}${normalizedPath.slice('/yonbip'.length)}`;
  }
  return `${prefix}${normalizedPath}`;
}

function parseIdList(value: string | undefined, fallback: string[] = []): string[] {
  const parsed = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
}

function clampPositiveInt(value: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(value) || !value || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}

function safeString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function safeInt(value: unknown, fallback: number): number {
  const parsed = safeNumber(value);
  return parsed == null ? fallback : Math.floor(parsed);
}

function localizedName(value: LocalizedText | undefined): string | undefined {
  if (typeof value === 'string') return safeString(value);
  return safeString(value?.simplifiedName) ?? safeString(value?.traditionalName) ?? safeString(value?.englishName);
}

function successCode(code: string | undefined): boolean {
  return code === '200' || code === '"200"';
}

function buildMaterialUrl(
  config: YonyouMaterialConfig,
  accessToken: string,
  path: string,
): { url: string; endpoint: string } {
  const endpoint = /^https?:\/\//i.test(path)
    ? path
    : `${trimTrailingSlash(config.baseUrl)}${joinApiPrefix(config.apiPrefix, path)}`;
  const url = new URL(endpoint);
  url.searchParams.set('access_token', accessToken);
  return { url: url.toString(), endpoint };
}

function candidatePaths(configuredPath: string | undefined, defaultPath: string, fallbackPaths: string[]): string[] {
  const path = configuredPath || defaultPath;
  if (path !== defaultPath || /^https?:\/\//i.test(path)) return [path];
  return [defaultPath, ...fallbackPaths];
}

function buildMaterialListBody(
  path: string,
  config: YonyouMaterialConfig,
  options: {
    pageIndex: number;
    pageSize: number;
    code?: string;
    name?: string;
    categoryCode?: string;
    categoryCodes?: string[];
    enabled?: boolean;
    pubts?: string;
  },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    pageIndex: options.pageIndex,
    pageSize: options.pageSize,
  };
  const categoryCodes = options.categoryCodes?.length
    ? options.categoryCodes
    : (options.categoryCode ? [options.categoryCode] : []);

  if (path.includes('/product/integration/querylist')) {
    if (options.code) body.productCodeList = [options.code];
    if (options.name) body.productNameList = [options.name];
    if (categoryCodes.length) body.managerClassCodeList = categoryCodes;
    if (typeof options.enabled === 'boolean') body.stopStatus = options.enabled ? false : true;
    if (options.pubts) body.pubts = options.pubts;
    return body;
  }

  if (options.code) body.code = options.code;
  if (options.name) body.name = options.name;
  if (categoryCodes.length) body[config.categoryCodeField || 'managementClassCode'] = categoryCodes[0];
  if (typeof options.enabled === 'boolean') body[config.enabledField || 'stopStatus'] = options.enabled ? false : true;
  if (options.pubts) body.pubts = options.pubts;
  return body;
}

export function isYonyouMaterialConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isYonyouTokenConfigured(env);
}

export function getYonyouMaterialConfig(env: NodeJS.ProcessEnv = process.env): YonyouMaterialConfig {
  const tokenConfig = getYonyouTokenConfig(env);
  return {
    ...tokenConfig,
    apiPrefix: (env.YONYOU_ERP_API_PREFIX || env.YONSUITE_API_PREFIX)?.trim() || undefined,
    materialListPath: (env.YONYOU_ERP_MATERIAL_LIST_PATH || env.YONSUITE_MATERIAL_LIST_PATH)?.trim() || DEFAULT_MATERIAL_LIST_PATH,
    materialCategoryTreePath: (
      env.YONYOU_ERP_MATERIAL_CATEGORY_TREE_PATH ||
      env.YONSUITE_MATERIAL_CATEGORY_TREE_PATH
    )?.trim() || DEFAULT_MATERIAL_CATEGORY_TREE_PATH,
    materialTimeoutMs: Number(env.YONYOU_ERP_MATERIAL_TIMEOUT_MS || env.YONSUITE_TIMEOUT_MS || tokenConfig.timeoutMs || DEFAULT_TIMEOUT_MS),
    categoryCodeField: (env.YONYOU_ERP_MATERIAL_CATEGORY_CODE_FIELD || env.YONSUITE_MATERIAL_CATEGORY_CODE_FIELD)?.trim() || 'managementClassCode',
    enabledField: (env.YONYOU_ERP_MATERIAL_ENABLED_FIELD || env.YONSUITE_MATERIAL_ENABLED_FIELD)?.trim() || 'stopStatus',
    productRootCategoryCodes: parseIdList(
      env.YONYOU_ERP_PRODUCT_ROOT_CATEGORY_CODES || env.YONSUITE_PRODUCT_ROOT_CATEGORY_CODES,
      ['G'],
    ),
  };
}

export function mapYonyouMaterialCategory(record: YonyouMaterialCategoryRecord): YonyouMaterialCategory {
  const id = safeString(record.id) ?? safeString(record.code) ?? localizedName(record.name) ?? 'unknown-material-category';
  return {
    id,
    code: safeString(record.code),
    name: localizedName(record.name) ?? safeString(record.code) ?? id,
    parentId: safeString(record.parentId) ?? safeString(record.parent),
    order: safeNumber(record.order),
    level: safeNumber(record.level) ?? 1,
    isEnabled: record.isEnabled !== false,
    orgId: safeString(record.orgId),
  };
}

export function mapYonyouMaterialToProduct(record: YonyouMaterialRecord): YonyouProductCatalogItem {
  const code = safeString(record.code);
  const name = localizedName(record.name) ?? localizedName(record.materialName) ?? localizedName(record.productName);
  const categoryCode = safeString(record.managementClassCode) ?? safeString(record.manageClassCode) ?? safeString(record.materialClassCode);
  const categoryName = safeString(record.managementClassName) ?? safeString(record.manageClassName) ?? safeString(record.materialClassName);
  const stopped = record.stopStatus === true || record.stopstatus === true || record.isEnabled === false || record.enable === false;
  const series = safeString(record.productLineName) ?? safeString(record.brandName) ?? categoryName ?? '成品';
  return {
    id: code ?? safeString(record.id) ?? name ?? 'unknown-material',
    series,
    seriesCode: safeString(record.productLineCode) ?? categoryCode,
    model: name ?? code ?? '未命名物料',
    modelCode: code,
    category: categoryName ?? categoryCode,
    specification: safeString(record.specification) ?? safeString(record.specs) ?? safeString(record.model),
    unit: safeString(record.unitName) ?? safeString(record.unit),
    listPrice: safeNumber(record.listPrice) ?? safeNumber(record.price),
    status: stopped ? 'stopped' : 'active',
    source: 'ys',
    sourceRefId: safeString(record.id),
    sourceUpdatedAt: safeString(record.modifyTime) ?? safeString(record.pubts) ?? safeString(record.createTime),
    attributes: {
      ...(categoryCode ? { categoryCode } : {}),
      ...(categoryName ? { categoryName } : {}),
      ...(safeString(record.brandName) ? { brand: safeString(record.brandName)! } : {}),
    },
  };
}

export async function listYonyouMaterials(options: {
  config?: YonyouMaterialConfig;
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  categoryCode?: string;
  categoryCodes?: string[];
  enabled?: boolean;
  pubts?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<YonyouMaterialListResult> {
  const config = options.config ?? getYonyouMaterialConfig();
  const pageIndex = clampPositiveInt(options.pageIndex, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampPositiveInt(options.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const timeoutMs = clampPositiveInt(config.materialTimeoutMs, DEFAULT_TIMEOUT_MS, 60_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getYonyouAccessToken({ config: { ...config, timeoutMs }, fetchImpl });
  const paths = candidatePaths(config.materialListPath, DEFAULT_MATERIAL_LIST_PATH, FALLBACK_MATERIAL_LIST_PATHS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let lastNotFound: YonyouMaterialRequestError | null = null;
  try {
    for (const path of paths) {
      const { url, endpoint } = buildMaterialUrl(config, token.accessToken, path);
      const body = buildMaterialListBody(path, config, {
        pageIndex,
        pageSize,
        code: options.code,
        name: options.name,
        categoryCode: options.categoryCode,
        categoryCodes: options.categoryCodes,
        enabled: options.enabled,
        pubts: options.pubts,
      });
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: YonyouMaterialListResponse | null = null;
      try {
        payload = text ? JSON.parse(text) as YonyouMaterialListResponse : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const error = new YonyouMaterialRequestError(`Yonyou material list HTTP request failed: ${response.status}`, {
          status: response.status,
          endpoint,
        });
        if (response.status === 404 && path !== paths[paths.length - 1]) {
          lastNotFound = error;
          continue;
        }
        throw error;
      }
      if (!payload || !successCode(payload.code) || !payload.data) {
        throw new YonyouMaterialRequestError('Yonyou material list response is not successful', {
          status: response.status,
          code: payload?.code,
          yonyouMessage: payload?.message,
          endpoint,
        });
      }

      const data = Array.isArray(payload.data)
        ? {
          pageIndex,
          pageSize,
          pageCount: 1,
          recordCount: payload.data.length,
          recordList: payload.data,
        }
        : payload.data;

      log.info({
        endpoint,
        pageIndex,
        pageSize,
        recordCount: data.recordCount ?? 0,
      }, 'Yonyou material list fetched');

      return {
        pageIndex: safeInt(data.pageIndex, pageIndex),
        pageSize: safeInt(data.pageSize, pageSize),
        pageCount: safeInt(data.pageCount, 0),
        recordCount: safeInt(data.recordCount, 0),
        pubts: data.pubts,
        records: data.recordList ?? [],
      };
    }
    throw lastNotFound ?? new YonyouMaterialRequestError('Yonyou material list endpoint was not found');
  } catch (error) {
    if (
      error instanceof YonyouMaterialRequestError ||
      error instanceof YonyouTokenRequestError ||
      error instanceof YonyouTokenConfigError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new YonyouMaterialRequestError(`Yonyou material list request failed: ${message}`, {
      endpoint: lastNotFound?.details.endpoint,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function listYonyouMaterialProducts(options: Parameters<typeof listYonyouMaterials>[0] = {}) {
  const result = await listYonyouMaterials(options);
  return {
    ...result,
    products: result.records.map(mapYonyouMaterialToProduct),
  };
}

export async function listYonyouMaterialCategories(options: {
  config?: YonyouMaterialConfig;
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  pubts?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<YonyouMaterialCategory[]> {
  const config = options.config ?? getYonyouMaterialConfig();
  const pageIndex = clampPositiveInt(options.pageIndex, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampPositiveInt(options.pageSize, 100, MAX_PAGE_SIZE);
  const timeoutMs = clampPositiveInt(config.materialTimeoutMs, DEFAULT_TIMEOUT_MS, 60_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getYonyouAccessToken({ config: { ...config, timeoutMs }, fetchImpl });
  const paths = candidatePaths(
    config.materialCategoryTreePath,
    DEFAULT_MATERIAL_CATEGORY_TREE_PATH,
    FALLBACK_MATERIAL_CATEGORY_TREE_PATHS,
  );
  const body: Record<string, unknown> = { pageIndex, pageSize };

  if (options.code) body.code = options.code;
  if (options.name) body.name = options.name;
  if (options.pubts) body.pubts = options.pubts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let lastNotFound: YonyouMaterialRequestError | null = null;
  try {
    for (const path of paths) {
      const { url, endpoint } = buildMaterialUrl(config, token.accessToken, path);
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: YonyouMaterialCategoryTreeResponse | null = null;
      try {
        payload = text ? JSON.parse(text) as YonyouMaterialCategoryTreeResponse : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const error = new YonyouMaterialRequestError(`Yonyou material category tree HTTP request failed: ${response.status}`, {
          status: response.status,
          endpoint,
        });
        if (response.status === 404 && path !== paths[paths.length - 1]) {
          lastNotFound = error;
          continue;
        }
        throw error;
      }
      if (!payload || !successCode(payload.code) || !Array.isArray(payload.data)) {
        throw new YonyouMaterialRequestError('Yonyou material category tree response is not successful', {
          status: response.status,
          code: payload?.code,
          yonyouMessage: payload?.message,
          endpoint,
        });
      }

      log.info({
        endpoint,
        pageIndex,
        pageSize,
        recordCount: payload.data.length,
      }, 'Yonyou material category tree fetched');

      return payload.data.map(mapYonyouMaterialCategory);
    }
    throw lastNotFound ?? new YonyouMaterialRequestError('Yonyou material category tree endpoint was not found');
  } catch (error) {
    if (
      error instanceof YonyouMaterialRequestError ||
      error instanceof YonyouTokenRequestError ||
      error instanceof YonyouTokenConfigError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new YonyouMaterialRequestError(`Yonyou material category tree request failed: ${message}`, {
      endpoint: lastNotFound?.details.endpoint,
    });
  } finally {
    clearTimeout(timer);
  }
}
