import { describe, expect, it, vi } from 'vitest';
import { analyzeOpportunityImportRows, importOpportunityRows } from '@/lib/pms/opportunity-import-client';

describe('PMS 商机批量导入客户端', () => {
  it('一次调用批量导入接口，并把撞单行作为跳过结果返回', async () => {
    const fetcher = vi.fn(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith('/preflight')) {
        return new Response(JSON.stringify({
          summary: { total: body.rows.length, duplicate: 0 },
          results: body.rows.map((_: unknown, index: number) => ({ index, status: 'pass' })),
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        summary: { total: 2, created: 1, duplicate: 1, error: 0 },
        results: [
          { index: 0, status: 'created' },
          { index: 1, status: 'duplicate', message: '疑似撞单，已跳过' },
        ],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await importOpportunityRows([
      { customerName: '南京金泰达自动化系统有限公司-商用', projectName: '济南市经济开发区第一实验学校热水源改造项目' },
      { customerName: '上海能罡暖通设备有限公司-商用', projectName: '武汉金港穗厨房设备制造有限公司采购项目' },
      { customerName: '只有客户名' },
    ], fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith('/api/pms/opportunities/import', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
    expect(fetcher).not.toHaveBeenCalledWith('/api/pms/opportunities', expect.anything());
    expect(result).toEqual({
      total: 3,
      success: 1,
      duplicate: 1,
      failed: [{ row: 4, reason: '客户名称和项目名称必填' }],
      notices: [{ row: 3, reason: '疑似撞单，已跳过' }],
    });
  });

  it('导入前识别文件内撞单，提交时跳过重复行', async () => {
    const rows = [
      { customerName: '北京瑞京美机电工程有限公司-商用', projectName: '项目A', customerPhone: '13800138000', customerAddress: '地址A' },
      { customerName: '北京瑞京美机电工程有限公司-商用', projectName: '项目B', customerPhone: '13800138000', customerAddress: '地址B' },
      { customerName: '北京瑞京美机电工程有限公司-商用', projectName: '项目B', customerPhone: '13800138000', customerAddress: '地址B' },
    ];
    const preflight = analyzeOpportunityImportRows(rows);
    const fetcher = vi.fn(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith('/preflight')) {
        expect(body.rows).toEqual([rows[0]]);
        return new Response(JSON.stringify({
          summary: { total: body.rows.length, duplicate: 0 },
          results: body.rows.map((_: unknown, index: number) => ({ index, status: 'pass' })),
        }), { status: 200 });
      }
      expect(body.rows).toEqual([rows[0]]);
      return new Response(JSON.stringify({
        summary: { total: body.rows.length, created: body.rows.length, duplicate: 0, error: 0 },
        results: body.rows.map((_: unknown, index: number) => ({ index, status: 'created' })),
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await importOpportunityRows(rows, fetcher);

    expect(preflight.importable).toBe(1);
    expect(preflight.duplicate).toBe(2);
    expect(preflight.duplicateGroups[0]).toEqual(expect.objectContaining({
      type: 'same_customer_phone',
      rows: [2, 3, 4],
    }));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      total: 3,
      success: 1,
      duplicate: 2,
      failed: [],
      notices: [
        { row: 3, reason: '撞单风险: 与第 2 行客户名称和电话相同，系统会判为重复，已跳过' },
        { row: 4, reason: '文件内重复: 与第 3 行客户/地址/项目相同，已跳过' },
      ],
    });
  });

  it('数据库已有商机在预检阶段跳过，不再提交导入', async () => {
    const rows = [
      { customerName: '客户A', projectName: '项目A', customerAddress: '地址A' },
      { customerName: '客户B', projectName: '项目B', customerAddress: '地址B' },
    ];
    const fetcher = vi.fn(async (url) => {
      expect(String(url)).toBe('/api/pms/opportunities/import/preflight');
      return new Response(JSON.stringify({
        summary: { total: 2, duplicate: 2 },
        results: [
          { index: 0, status: 'duplicate', message: '数据库已存在相同客户/地址/项目，已跳过' },
          { index: 1, status: 'duplicate', message: '数据库已存在相同客户/地址/项目，已跳过' },
        ],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await importOpportunityRows(rows, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      total: 2,
      success: 0,
      duplicate: 2,
      failed: [],
      notices: [
        { row: 2, reason: '数据库已存在相同客户/地址/项目，已跳过' },
        { row: 3, reason: '数据库已存在相同客户/地址/项目，已跳过' },
      ],
    });
  });

  it('大批量数据按批次提交并持续汇报进度', async () => {
    const fetcher = vi.fn(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith('/preflight')) {
        return new Response(JSON.stringify({
          summary: { total: body.rows.length, duplicate: 0 },
          results: body.rows.map((_: unknown, index: number) => ({ index, status: 'pass' })),
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        summary: { total: body.rows.length, created: body.rows.length, duplicate: 0, error: 0 },
        results: body.rows.map((_: unknown, index: number) => ({ index, status: 'created' })),
      }), { status: 200 });
    }) as unknown as typeof fetch;
    const onProgress = vi.fn();
    const rows = Array.from({ length: 1201 }, (_, index) => ({
      customerName: `客户${index}`,
      projectName: `项目${index}`,
    }));

    const result = await importOpportunityRows(rows, fetcher, { onProgress });

    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(result).toEqual({
      total: 1201,
      success: 1201,
      duplicate: 0,
      failed: [],
      notices: [],
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      total: 1201,
      processed: 1201,
      batchIndex: 3,
      batchCount: 3,
    });
  });
});
