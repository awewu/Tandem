import { childLogger } from '@/lib/infra/logger';
import {
  getYonyouAccessToken,
  getYonyouTokenConfig,
  isYonyouTokenConfigured,
  YonyouTokenConfigError,
  YonyouTokenRequestError,
  type YonyouTokenConfig,
} from './yonyou-token';

const DEFAULT_CUSTOMER_LIST_PATH = '/yonbip/digitalModel/merchant/newlistrange';
const DEFAULT_CUSTOMER_CATEGORY_TREE_PATH = '/yonbip/digitalModel/custcategory/newtree';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 5_000;

type LocalizedText = string | {
  simplifiedName?: string;
  englishName?: string;
  traditionalName?: string;
};

export interface YonyouCustomerListConfig extends YonyouTokenConfig {
  apiPrefix?: string;
  customerListPath?: string;
  customerCategoryTreePath?: string;
  customerTimeoutMs?: number;
  filterPotential?: boolean;
}

export interface YonyouCustomerRecord {
  id?: string | number;
  code?: string;
  name?: LocalizedText;
  shortname?: LocalizedText;
  createOrgId?: string;
  createOrgCode?: string;
  belongOrgId?: string;
  belongOrgCode?: string;
  countryName?: string;
  customerClassCode?: string;
  customerClassName?: string;
  customerIndustryCode?: string;
  customerClassId?: string | number;
  customerIndustryName?: string;
  creditCode?: string;
  leaderName?: string;
  contactName?: string;
  contactTel?: string;
  address?: LocalizedText;
  regionCode?: string;
  email?: string;
  money?: string | number;
  buildTime?: string;
  stopStatus?: boolean;
  stopstatus?: boolean;
  createTime?: string;
  modifyTime?: string;
  merchantApplyRanges?: Array<{
    id?: string;
    orgId?: string;
    orgIdCode?: string;
  }>;
  [key: string]: unknown;
}

export interface YonyouCustomerListResult {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  recordCount: number;
  pubts?: string;
  records: YonyouCustomerRecord[];
}

export interface YonyouCustomerCategoryRecord {
  id?: string | number;
  code?: string;
  name?: LocalizedText;
  parent?: string | number;
  order?: number;
  level?: number;
  isEnabled?: boolean;
  orgId?: string;
  [key: string]: unknown;
}

export interface YonyouCustomerCategory {
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  order?: number;
  level: number;
  isEnabled: boolean;
  orgId?: string;
}

export interface YonyouCustomerDealerProfile {
  id: string;
  orgId: string;
  code?: string;
  name?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
  registeredCapital?: number;
  establishedDate?: string;
  coverageRegions: string[];
  source: 'ys';
  status: 'active' | 'stopped';
  customerClassName?: string;
  address?: string;
  legalBody?: string;
  sourceUpdatedAt?: string;
}

interface YonyouCustomerListResponse {
  code?: string;
  message?: string;
  data?: {
    pageCount?: number | string;
    recordCount?: number | string;
    pageSize?: number | string;
    recordList?: YonyouCustomerRecord[];
    pageIndex?: number | string;
    pubts?: string;
  };
}

interface YonyouCustomerCategoryTreeResponse {
  code?: string;
  message?: string;
  data?: YonyouCustomerCategoryRecord[];
}

export class YonyouCustomerRequestError extends Error {
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
    this.name = 'YonyouCustomerRequestError';
  }
}

const log = childLogger({ integration: 'yonyou', component: 'customer-readonly' });

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

function buildCustomerListUrl(config: YonyouCustomerListConfig, accessToken: string): { url: string; endpoint: string } {
  const customerListPath = config.customerListPath || DEFAULT_CUSTOMER_LIST_PATH;
  const endpoint = /^https?:\/\//i.test(customerListPath)
    ? customerListPath
    : `${trimTrailingSlash(config.baseUrl)}${joinApiPrefix(config.apiPrefix, customerListPath)}`;
  const url = new URL(endpoint);
  url.searchParams.set('access_token', accessToken);
  return { url: url.toString(), endpoint };
}

function buildCustomerCategoryTreeUrl(config: YonyouCustomerListConfig, accessToken: string): { url: string; endpoint: string } {
  const customerCategoryTreePath = config.customerCategoryTreePath || DEFAULT_CUSTOMER_CATEGORY_TREE_PATH;
  const endpoint = /^https?:\/\//i.test(customerCategoryTreePath)
    ? customerCategoryTreePath
    : `${trimTrailingSlash(config.baseUrl)}${joinApiPrefix(config.apiPrefix, customerCategoryTreePath)}`;
  const url = new URL(endpoint);
  url.searchParams.set('access_token', accessToken);
  return { url: url.toString(), endpoint };
}

export function isYonyouCustomerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isYonyouTokenConfigured(env);
}

export function getYonyouCustomerListConfig(env: NodeJS.ProcessEnv = process.env): YonyouCustomerListConfig {
  const tokenConfig = getYonyouTokenConfig(env);
  return {
    ...tokenConfig,
    apiPrefix: (env.YONYOU_ERP_API_PREFIX || env.YONSUITE_API_PREFIX)?.trim() || undefined,
    customerListPath: (env.YONYOU_ERP_CUSTOMER_LIST_PATH || env.YONSUITE_CUSTOMER_LIST_PATH)?.trim() || DEFAULT_CUSTOMER_LIST_PATH,
    customerCategoryTreePath: (
      env.YONYOU_ERP_CUSTOMER_CATEGORY_TREE_PATH ||
      env.YONSUITE_CUSTOMER_CATEGORY_TREE_PATH
    )?.trim() || DEFAULT_CUSTOMER_CATEGORY_TREE_PATH,
    customerTimeoutMs: Number(env.YONYOU_ERP_CUSTOMER_TIMEOUT_MS || env.YONSUITE_TIMEOUT_MS || tokenConfig.timeoutMs || DEFAULT_TIMEOUT_MS),
    filterPotential: (env.YONYOU_ERP_CUSTOMER_FILTER_POTENTIAL || env.YONSUITE_CUSTOMER_FILTER_POTENTIAL) === 'true',
  };
}

export function mapYonyouCustomerToDealerProfile(record: YonyouCustomerRecord): YonyouCustomerDealerProfile {
  const id = safeString(record.code) ?? safeString(record.id) ?? localizedName(record.name) ?? 'unknown-customer';
  const customerClassName = safeString(record.customerClassName) ?? safeString(record.customerClassCode);
  const stopped = record.stopStatus === true || record.stopstatus === true;
  return {
    id,
    orgId: id,
    code: safeString(record.code),
    name: localizedName(record.name) ?? localizedName(record.shortname),
    contactName: safeString(record.contactName),
    contactPhone: safeString(record.contactTel),
    contactEmail: safeString(record.email),
    businessLicense: safeString(record.creditCode),
    registeredCapital: safeNumber(record.money),
    establishedDate: safeString(record.buildTime)?.slice(0, 10),
    coverageRegions: [
      safeString(record.countryName),
      safeString(record.regionCode),
      customerClassName,
      safeString(record.customerIndustryName) ?? safeString(record.customerIndustryCode),
      safeString(record.belongOrgCode),
    ].filter(Boolean) as string[],
    source: 'ys',
    status: stopped ? 'stopped' : 'active',
    customerClassName,
    address: localizedName(record.address),
    legalBody: safeString(record.leaderName),
    sourceUpdatedAt: safeString(record.modifyTime) ?? safeString(record.createTime),
  };
}

export function mapYonyouCustomerCategory(record: YonyouCustomerCategoryRecord): YonyouCustomerCategory {
  const id = safeString(record.id) ?? safeString(record.code) ?? localizedName(record.name) ?? 'unknown-category';
  return {
    id,
    code: safeString(record.code),
    name: localizedName(record.name) ?? safeString(record.code) ?? id,
    parentId: safeString(record.parent),
    order: safeNumber(record.order),
    level: safeNumber(record.level) ?? 1,
    isEnabled: record.isEnabled !== false,
    orgId: safeString(record.orgId),
  };
}

export async function listYonyouCustomers(options: {
  config?: YonyouCustomerListConfig;
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  customerClassCode?: string;
  stopStatus?: boolean;
  pubts?: string;
  filterPotential?: boolean;
  fetchImpl?: typeof fetch;
} = {}): Promise<YonyouCustomerListResult> {
  const config = options.config ?? getYonyouCustomerListConfig();
  const pageIndex = clampPositiveInt(options.pageIndex, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampPositiveInt(options.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const timeoutMs = clampPositiveInt(config.customerTimeoutMs, DEFAULT_TIMEOUT_MS, 60_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getYonyouAccessToken({ config: { ...config, timeoutMs }, fetchImpl });
  const { url, endpoint } = buildCustomerListUrl(config, token.accessToken);
  const body: Record<string, unknown> = { pageIndex, pageSize };

  if (options.code) body.code = options.code;
  if (options.name) body.name = options.name;
  if (options.customerClassCode) body.customerClassCode = options.customerClassCode;
  if (typeof options.stopStatus === 'boolean') body.stopStatus = options.stopStatus;
  if (options.pubts) body.pubts = options.pubts;
  body.filterPotential = options.filterPotential ?? config.filterPotential ?? false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: YonyouCustomerListResponse | null = null;
    try {
      payload = text ? JSON.parse(text) as YonyouCustomerListResponse : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new YonyouCustomerRequestError(`Yonyou customer list HTTP request failed: ${response.status}`, {
        status: response.status,
        endpoint,
      });
    }
    if (!payload || payload.code !== '200' || !payload.data) {
      throw new YonyouCustomerRequestError('Yonyou customer list response is not successful', {
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
      recordCount: payload.data.recordCount ?? 0,
    }, 'Yonyou customer list fetched');

    return {
      pageIndex: safeInt(payload.data.pageIndex, pageIndex),
      pageSize: safeInt(payload.data.pageSize, pageSize),
      pageCount: safeInt(payload.data.pageCount, 0),
      recordCount: safeInt(payload.data.recordCount, 0),
      pubts: payload.data.pubts,
      records: payload.data.recordList ?? [],
    };
  } catch (error) {
    if (
      error instanceof YonyouCustomerRequestError ||
      error instanceof YonyouTokenRequestError ||
      error instanceof YonyouTokenConfigError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new YonyouCustomerRequestError(`Yonyou customer list request failed: ${message}`, { endpoint });
  } finally {
    clearTimeout(timer);
  }
}

export async function listYonyouCustomerDealerProfiles(options: Parameters<typeof listYonyouCustomers>[0] = {}) {
  const result = await listYonyouCustomers(options);
  return {
    ...result,
    profiles: result.records.map(mapYonyouCustomerToDealerProfile),
  };
}

export async function listYonyouCustomerCategories(options: {
  config?: YonyouCustomerListConfig;
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  pubts?: string;
  fetchImpl?: typeof fetch;
} = {}): Promise<YonyouCustomerCategory[]> {
  const config = options.config ?? getYonyouCustomerListConfig();
  const pageIndex = clampPositiveInt(options.pageIndex, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampPositiveInt(options.pageSize, 100, MAX_PAGE_SIZE);
  const timeoutMs = clampPositiveInt(config.customerTimeoutMs, DEFAULT_TIMEOUT_MS, 60_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getYonyouAccessToken({ config: { ...config, timeoutMs }, fetchImpl });
  const { url, endpoint } = buildCustomerCategoryTreeUrl(config, token.accessToken);
  const body: Record<string, unknown> = { pageIndex, pageSize };

  if (options.code) body.code = options.code;
  if (options.name) body.name = options.name;
  if (options.pubts) body.pubts = options.pubts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: YonyouCustomerCategoryTreeResponse | null = null;
    try {
      payload = text ? JSON.parse(text) as YonyouCustomerCategoryTreeResponse : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new YonyouCustomerRequestError(`Yonyou customer category tree HTTP request failed: ${response.status}`, {
        status: response.status,
        endpoint,
      });
    }
    if (!payload || (payload.code !== '200' && payload.code !== '"200"') || !Array.isArray(payload.data)) {
      throw new YonyouCustomerRequestError('Yonyou customer category tree response is not successful', {
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
    }, 'Yonyou customer category tree fetched');

    return payload.data.map(mapYonyouCustomerCategory);
  } catch (error) {
    if (
      error instanceof YonyouCustomerRequestError ||
      error instanceof YonyouTokenRequestError ||
      error instanceof YonyouTokenConfigError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new YonyouCustomerRequestError(`Yonyou customer category tree request failed: ${message}`, { endpoint });
  } finally {
    clearTimeout(timer);
  }
}
