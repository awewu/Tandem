import { describe, it, expect } from 'vitest';
import {
  parseYonyouKpiQueryMap,
  isYonyouKpiAdapterConfigured,
  getYonyouKpiAdapterConfig,
} from '@/lib/kpi/erp-adapters/yonyou-kpi-adapter';

const BASE_ENV = {
  YONYOU_ERP_BASE_URL: 'https://c1.yonyoucloud.com',
  YONYOU_ERP_APP_KEY: 'key',
  YONYOU_ERP_APP_SECRET: 'secret',
} as unknown as NodeJS.ProcessEnv;

describe('parseYonyouKpiQueryMap', () => {
  it('returns [] for empty/missing input', () => {
    expect(parseYonyouKpiQueryMap(undefined)).toEqual([]);
    expect(parseYonyouKpiQueryMap('')).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseYonyouKpiQueryMap('not json')).toEqual([]);
  });

  it('filters out entries missing required fields', () => {
    const raw = JSON.stringify([
      { subjectCode: 'REV-001', path: '/yonbip/x', valueField: 'data.v' },
      { subjectCode: 'BAD-NO-PATH', valueField: 'data.v' },
      { path: '/yonbip/y', valueField: 'data.v' },
    ]);
    const parsed = parseYonyouKpiQueryMap(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].subjectCode).toBe('REV-001');
  });
});

describe('isYonyouKpiAdapterConfigured', () => {
  it('false when token config missing', () => {
    expect(isYonyouKpiAdapterConfigured({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('false when token configured but no query map', () => {
    expect(isYonyouKpiAdapterConfigured(BASE_ENV)).toBe(false);
  });

  it('true when both token config and query map present', () => {
    const env = {
      ...BASE_ENV,
      YONYOU_ERP_KPI_QUERY_MAP: JSON.stringify([
        { subjectCode: 'REV-001', path: '/yonbip/x', valueField: 'data.v' },
      ]),
    } as unknown as NodeJS.ProcessEnv;
    expect(isYonyouKpiAdapterConfigured(env)).toBe(true);
  });
});

describe('getYonyouKpiAdapterConfig', () => {
  it('merges token config with parsed queries', () => {
    const env = {
      ...BASE_ENV,
      YONYOU_ERP_KPI_QUERY_MAP: JSON.stringify([
        { subjectCode: 'REV-001', path: '/yonbip/x', valueField: 'data.v', assigneeIds: ['company'] },
      ]),
    } as unknown as NodeJS.ProcessEnv;
    const config = getYonyouKpiAdapterConfig(env);
    expect(config.baseUrl).toBe('https://c1.yonyoucloud.com');
    expect(config.queries).toHaveLength(1);
    expect(config.queries[0].assigneeIds).toEqual(['company']);
  });
});
