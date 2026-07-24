import { childLogger } from '@/lib/infra/logger';
import {
  getYonyouAccessToken,
  getYonyouTokenConfig,
  isYonyouTokenConfigured,
  YonyouTokenConfigError,
  YonyouTokenRequestError,
  type YonyouTokenConfig,
} from './yonyou-token';

const DEFAULT_VENDOR_LIST_PATH = '/yonbip/digitalModel/vendor/list';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface YonyouVendorListConfig extends YonyouTokenConfig {
  apiPrefix?: string;
  vendorListPath?: string;
  vendorOrgIds?: string[];
  manageOrgIds?: string[];
  vendorTimeoutMs?: number;
}

export interface YonyouVendorRecord {
  id?: string | number;
  code?: string;
  name?: string;
  stop?: boolean;
  stopstatus?: boolean;
  pubts?: string;
  contactphone?: string;
  vendorphone?: string;
  vendoremail?: string;
  vendorzipcode?: string;
  vendoraddress?: string;
  address?: string;
  creditcode?: string;
  legalBody?: string;
  registerFund?: string | number;
  foundDate?: string;
  vendorclass?: string | number;
  vendorclass_name?: string;
  org?: string | number;
  org_name?: string;
  parentVendor?: string | number;
  parentVendor_name?: string;
  correspondingcust?: string | number;
  correspondingcust_name?: string;
  contactsList?: Array<{
    contactname?: string;
    contactmobile?: string;
    defaultcontact?: boolean;
  }>;
  vendorextends?: {
    simplename?: string;
    helpcode?: string;
    freezestatus?: string;
    department_name?: string;
    person_name?: string;
    modifyTime?: string;
    createTime?: string;
    remark?: string;
  };
  [key: string]: unknown;
}

export interface YonyouVendorListResult {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  recordCount: number;
  pubts?: string;
  records: YonyouVendorRecord[];
}

export interface YonyouVendorDealerProfile {
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
  vendorClassName?: string;
  address?: string;
  legalBody?: string;
  sourceUpdatedAt?: string;
}

interface YonyouVendorListResponse {
  code?: string;
  message?: string;
  data?: {
    pageCount?: number;
    recordCount?: number;
    pageSize?: number;
    recordList?: YonyouVendorRecord[];
    pageIndex?: number;
    pubts?: string;
  };
}

export class YonyouVendorRequestError extends Error {
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
    this.name = 'YonyouVendorRequestError';
  }
}

const log = childLogger({ integration: 'yonyou', component: 'vendor-readonly' });

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

function parseIdList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function firstContact(record: YonyouVendorRecord) {
  return record.contactsList?.find((contact) => contact.defaultcontact) ?? record.contactsList?.[0];
}

function buildVendorListUrl(config: YonyouVendorListConfig, accessToken: string): { url: string; endpoint: string } {
  const vendorListPath = config.vendorListPath || DEFAULT_VENDOR_LIST_PATH;
  const endpoint = /^https?:\/\//i.test(vendorListPath)
    ? vendorListPath
    : `${trimTrailingSlash(config.baseUrl)}${joinApiPrefix(config.apiPrefix, vendorListPath)}`;
  const url = new URL(endpoint);
  url.searchParams.set('access_token', accessToken);
  return { url: url.toString(), endpoint };
}

export function isYonyouVendorConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isYonyouTokenConfigured(env);
}

export function getYonyouVendorListConfig(env: NodeJS.ProcessEnv = process.env): YonyouVendorListConfig {
  const tokenConfig = getYonyouTokenConfig(env);
  return {
    ...tokenConfig,
    apiPrefix: (env.YONYOU_ERP_API_PREFIX || env.YONSUITE_API_PREFIX)?.trim() || undefined,
    vendorListPath: (env.YONYOU_ERP_VENDOR_LIST_PATH || env.YONSUITE_VENDOR_LIST_PATH)?.trim() || DEFAULT_VENDOR_LIST_PATH,
    vendorOrgIds: parseIdList(env.YONYOU_ERP_VENDOR_ORG_IDS || env.YONSUITE_VENDOR_ORG_IDS),
    manageOrgIds: parseIdList(env.YONYOU_ERP_VENDOR_MANAGE_ORG_IDS || env.YONSUITE_VENDOR_MANAGE_ORG_IDS),
    vendorTimeoutMs: Number(env.YONYOU_ERP_VENDOR_TIMEOUT_MS || env.YONSUITE_TIMEOUT_MS || tokenConfig.timeoutMs || DEFAULT_TIMEOUT_MS),
  };
}

export function mapYonyouVendorToDealerProfile(record: YonyouVendorRecord): YonyouVendorDealerProfile {
  const contact = firstContact(record);
  const id = safeString(record.id) ?? safeString(record.code) ?? safeString(record.name) ?? 'unknown-vendor';
  const stopped = record.stop === true || record.stopstatus === true;
  return {
    id,
    orgId: id,
    code: safeString(record.code),
    name: safeString(record.name) ?? safeString(record.vendorextends?.simplename),
    contactName: safeString(contact?.contactname) ?? safeString(record.vendorextends?.person_name),
    contactPhone: safeString(contact?.contactmobile) ?? safeString(record.contactphone) ?? safeString(record.vendorphone),
    contactEmail: safeString(record.vendoremail),
    businessLicense: safeString(record.creditcode),
    registeredCapital: safeNumber(record.registerFund),
    establishedDate: safeString(record.foundDate)?.slice(0, 10),
    coverageRegions: [record.org_name, record.vendorclass_name].map(safeString).filter(Boolean) as string[],
    source: 'ys',
    status: stopped ? 'stopped' : 'active',
    vendorClassName: safeString(record.vendorclass_name),
    address: safeString(record.vendoraddress) ?? safeString(record.address),
    legalBody: safeString(record.legalBody),
    sourceUpdatedAt: safeString(record.pubts) ?? safeString(record.vendorextends?.modifyTime),
  };
}

export async function listYonyouVendors(options: {
  config?: YonyouVendorListConfig;
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  pubts?: string;
  vendorOrgIds?: string[];
  manageOrgIds?: string[];
  fetchImpl?: typeof fetch;
} = {}): Promise<YonyouVendorListResult> {
  const config = options.config ?? getYonyouVendorListConfig();
  const pageIndex = clampPositiveInt(options.pageIndex, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampPositiveInt(options.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const vendorOrgIds = options.vendorOrgIds ?? config.vendorOrgIds;
  const manageOrgIds = options.manageOrgIds ?? config.manageOrgIds;
  const timeoutMs = clampPositiveInt(config.vendorTimeoutMs, DEFAULT_TIMEOUT_MS, 60_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getYonyouAccessToken({ config: { ...config, timeoutMs }, fetchImpl });
  const { url, endpoint } = buildVendorListUrl(config, token.accessToken);
  const body: Record<string, unknown> = { pageIndex, pageSize };

  if (vendorOrgIds?.length) body.vendororg = vendorOrgIds;
  if (manageOrgIds?.length) body.org = manageOrgIds;
  if (options.code) body.code = options.code;
  if (options.pubts) body.simple = { pubts: options.pubts };

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
    let payload: YonyouVendorListResponse | null = null;
    try {
      payload = text ? JSON.parse(text) as YonyouVendorListResponse : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new YonyouVendorRequestError(`Yonyou vendor list HTTP request failed: ${response.status}`, {
        status: response.status,
        endpoint,
      });
    }
    if (!payload || payload.code !== '200' || !payload.data) {
      throw new YonyouVendorRequestError('Yonyou vendor list response is not successful', {
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
    }, 'Yonyou vendor list fetched');

    return {
      pageIndex: payload.data.pageIndex ?? pageIndex,
      pageSize: payload.data.pageSize ?? pageSize,
      pageCount: payload.data.pageCount ?? 0,
      recordCount: payload.data.recordCount ?? 0,
      pubts: payload.data.pubts,
      records: payload.data.recordList ?? [],
    };
  } catch (error) {
    if (
      error instanceof YonyouVendorRequestError ||
      error instanceof YonyouTokenRequestError ||
      error instanceof YonyouTokenConfigError
    ) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new YonyouVendorRequestError(`Yonyou vendor list request failed: ${message}`, { endpoint });
  } finally {
    clearTimeout(timer);
  }
}

export async function listYonyouVendorDealerProfiles(options: Parameters<typeof listYonyouVendors>[0] = {}) {
  const result = await listYonyouVendors(options);
  return {
    ...result,
    profiles: result.records.map(mapYonyouVendorToDealerProfile),
  };
}
