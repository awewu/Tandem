/**
 * 用友 YonSuite (YonBIP) KPI ERP 适配器 (ErpAdapter 实现)
 *
 * 复用已验证的 lib/integrations/yonyou-token.ts 鉴权 (appKey/appSecret HMAC-SHA256
 * 签名换 access_token, 与 lib/integrations/yonyou-vendor.ts 同一套鉴权流程).
 *
 * 与 yonyou-vendor.ts 的关键差异: 供应商列表只有一个稳定的官方 API, 但 KPI 的
 * "业绩结果数据" 分散在不同 YonBIP 模块 (总账科目余额 / 销售发票统计 / 人力成本 / ...),
 * 没有单一通用查询接口。因此本适配器按 `KpiSubject.code` 维护一张
 * (subjectCode → YonBIP 查询配置) 映射表, 由 finance/IT 在 .env.local 里配置
 * (YONYOU_ERP_KPI_QUERY_MAP, JSON 数组), 与 lib/kpi/erp-adapter.ts 顶部注释
 * "ERP 那边维护一张 subject_code → erp_query 配置表" 的设计意图一致。
 *
 * 上线前必须由知悉贵司 YonSuite 报表/单据结构的同事补齐每个 subject 的
 * path/body/valueField —— 本文件不猜测/虚构具体业务接口路径。
 */

import { childLogger } from '@/lib/infra/logger';
import {
  getYonyouAccessToken,
  getYonyouTokenConfig,
  isYonyouTokenConfigured,
  YonyouTokenConfigError,
  YonyouTokenRequestError,
  type YonyouTokenConfig,
} from '@/lib/integrations/yonyou-token';
import type { ErpAdapter, ErpFetchResult } from '../erp-adapter';

const DEFAULT_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

/**
 * 单个 subjectCode 的 YonBIP 查询配置.
 *
 *   path        : YonBIP API 路径, 如 '/yonbip/fi/gl/voucher/query' (需 finance/IT 按实际报表补齐)
 *   method      : 默认 POST (多数 YonBIP 查询类 API 用 POST body 传条件)
 *   body        : 请求体模板; 支持占位符 "{{assigneeId}}" 会在运行时替换成实际维度值
 *   valueField  : 从响应 JSON 取值的点号路径, 如 'data.records.0.balance'
 *   assigneeIds : 该 subject 要分别抓取的维度 (部门/公司/个人 id); 缺省则只抓一次, assigneeId='company'
 */
export interface YonyouKpiQueryConfig {
  subjectCode: string;
  path: string;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  valueField: string;
  assigneeIds?: string[];
}

export interface YonyouKpiAdapterConfig extends YonyouTokenConfig {
  apiPrefix?: string;
  queryTimeoutMs?: number;
  queries: YonyouKpiQueryConfig[];
}

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

/** 解析 .env 里的 YONYOU_ERP_KPI_QUERY_MAP (JSON 字符串数组) */
export function parseYonyouKpiQueryMap(raw: string | undefined): YonyouKpiQueryConfig[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is YonyouKpiQueryConfig =>
        item && typeof item.subjectCode === 'string' && typeof item.path === 'string' && typeof item.valueField === 'string',
    );
  } catch {
    return [];
  }
}

export function isYonyouKpiAdapterConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isYonyouTokenConfigured(env) && parseYonyouKpiQueryMap(env.YONYOU_ERP_KPI_QUERY_MAP).length > 0;
}

export function getYonyouKpiAdapterConfig(env: NodeJS.ProcessEnv = process.env): YonyouKpiAdapterConfig {
  const tokenConfig = getYonyouTokenConfig(env);
  const queries = parseYonyouKpiQueryMap(env.YONYOU_ERP_KPI_QUERY_MAP);
  return {
    ...tokenConfig,
    apiPrefix: (env.YONYOU_ERP_API_PREFIX || env.YONSUITE_API_PREFIX)?.trim() || undefined,
    queryTimeoutMs: Number(env.YONYOU_ERP_KPI_QUERY_TIMEOUT_MS || tokenConfig.timeoutMs || DEFAULT_TIMEOUT_MS),
    queries,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function resolvePlaceholders<T>(value: T, assigneeId: string): T {
  if (typeof value === 'string') {
    return value.replace(/\{\{assigneeId\}\}/g, assigneeId) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolvePlaceholders(v, assigneeId)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolvePlaceholders(v, assigneeId);
    }
    return out as unknown as T;
  }
  return value;
}

/** 按点号路径从任意 JSON 里取值, 支持数组下标 (如 'data.records.0.balance') */
function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const log = childLogger({ integration: 'yonyou', component: 'kpi-erp-adapter' });

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class YonyouKpiErpAdapter implements ErpAdapter {
  readonly name = 'yonyou-yonsuite';

  constructor(private readonly configOverride?: YonyouKpiAdapterConfig) {}

  async fetch(subjectCodes: string[]): Promise<ErpFetchResult[]> {
    const config = this.configOverride ?? getYonyouKpiAdapterConfig();
    const wanted = new Set(subjectCodes);
    const queries = config.queries.filter((q) => wanted.has(q.subjectCode));
    if (queries.length === 0) return [];

    const timeoutMs = config.queryTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const token = await getYonyouAccessToken({ config });

    const out: ErpFetchResult[] = [];
    const now = new Date().toISOString();

    for (const q of queries) {
      const assigneeIds = q.assigneeIds?.length ? q.assigneeIds : ['company'];
      for (const assigneeId of assigneeIds) {
        try {
          const value = await this.fetchOne(config, token.accessToken, q, assigneeId, timeoutMs);
          if (value == null) {
            log.warn({ subjectCode: q.subjectCode, assigneeId, path: q.path }, 'Yonyou KPI query returned no numeric value at valueField');
            continue;
          }
          out.push({
            subjectCode: q.subjectCode,
            assigneeId,
            value,
            asOf: now,
            metadata: { adapter: this.name, path: q.path },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log.warn({ subjectCode: q.subjectCode, assigneeId, path: q.path, error: message }, 'Yonyou KPI query failed');
        }
      }
    }
    return out;
  }

  private async fetchOne(
    config: YonyouKpiAdapterConfig,
    accessToken: string,
    q: YonyouKpiQueryConfig,
    assigneeId: string,
    timeoutMs: number,
  ): Promise<number | null> {
    const endpoint = /^https?:\/\//i.test(q.path)
      ? q.path
      : `${trimTrailingSlash(config.baseUrl)}${joinApiPrefix(config.apiPrefix, q.path)}`;
    const url = new URL(endpoint);
    url.searchParams.set('access_token', accessToken);
    const method = q.method ?? 'POST';
    const body = q.body ? resolvePlaceholders(q.body, assigneeId) : undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return toNumber(getByPath(payload, q.valueField));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 注册便捷入口, 供 lib/boot.ts 按环境条件调用 */
export function createYonyouKpiErpAdapterIfConfigured(
  env: NodeJS.ProcessEnv = process.env,
): YonyouKpiErpAdapter | null {
  if (!isYonyouKpiAdapterConfigured(env)) return null;
  try {
    return new YonyouKpiErpAdapter(getYonyouKpiAdapterConfig(env));
  } catch (error) {
    if (error instanceof YonyouTokenConfigError || error instanceof YonyouTokenRequestError) {
      log.warn({ error: error.message }, 'Yonyou KPI adapter config invalid, skip registration');
      return null;
    }
    throw error;
  }
}
