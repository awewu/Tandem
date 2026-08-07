/**
 * PMS API · 商机批量导入
 *
 * POST /api/pms/opportunities/import
 * body: { rows: ImportRow[], defaultDealerOrgId?: string, skipDuplicateCheck?: boolean }
 *
 * 逐行调用 createOpportunity(含五维查重), 返回每行回执:
 *   status: 'created' | 'duplicate' | 'error'
 * 撞单行不阻断后续行 — 导入尽力而为, 结果逐条回执。
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import { createOpportunity } from '@/lib/pms/opportunity-service';
import { resolveDealerOrgId } from '@/lib/pms/dealer-resolver';

const MAX_ROWS = 500;

interface ImportRow {
  customerName?: string;
  projectName?: string;
  customerIndustry?: string;
  contactName?: string;
  contactTitle?: string;
  customerPhone?: string;
  customerAddress?: string;
  leadSource?: string;
  competitors?: string;
  estimatedAmount?: string | number;
  estimatedClosingDate?: string;
  region?: string;
  channel?: string;
  dealerOrgId?: string;
  dealerOrgName?: string;
  dealerOrgCode?: string;
  dealerOrg?: string;
  归属经销商?: string;
}

interface RowResult {
  index: number;
  customerName: string;
  projectName: string;
  status: 'created' | 'duplicate' | 'error';
  id?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  await boot();

  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const rows = body.rows as ImportRow[] | undefined;
    const defaultDealerOrgId = typeof body.defaultDealerOrgId === 'string' ? body.defaultDealerOrgId.trim() : '';
    const skipDuplicateCheck = body.skipDuplicateCheck === true;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '缺少导入数据 (rows)' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `单次最多导入 ${MAX_ROWS} 行` }, { status: 400 });
    }

    const results: RowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const customerName = (row.customerName || '').trim();
      const projectName = (row.projectName || '').trim();

      const base: RowResult = { index: i, customerName, projectName, status: 'error' };

      if (!customerName || !projectName) {
        results.push({ ...base, message: '缺少客户名称或项目名称' });
        continue;
      }

      const dealerRef = row.dealerOrgId || row.dealerOrgCode || row.dealerOrgName || row.dealerOrg || row['归属经销商'] || defaultDealerOrgId;
      const rowDealer = auth.isInternal
        ? await resolveDealerOrgId(auth, dealerRef, {
          dealerName: row.dealerOrgName || row.dealerOrg || row['归属经销商'],
          dealerCode: row.dealerOrgCode,
        })
        : (auth.orgId || String(dealerRef || '').trim());
      if (auth.isInternal && !rowDealer) {
        results.push({ ...base, message: '内部导入需填写有效的归属经销商名称、编码或ID (行内或默认值)' });
        continue;
      }
      const resolvedRowDealer = rowDealer!;
      const resolvedOrgId = auth.isInternal ? resolvedRowDealer : (auth.orgId || resolvedRowDealer);
      const resolvedDealerOrgId = auth.isInternal ? resolvedRowDealer : (auth.orgId || resolvedRowDealer);

      const amountRaw = row.estimatedAmount;
      const estimatedAmount =
        amountRaw === undefined || amountRaw === null || String(amountRaw).trim() === ''
          ? undefined
          : Number(String(amountRaw).replace(/[,，\s¥￥]/g, ''));
      const competitors = (row.competitors || '')
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean);

      try {
        const result = await createOpportunity({
          tenantId: auth.tenantId,
          orgId: resolvedOrgId,
          dealerOrgId: resolvedDealerOrgId,
          reporterId: auth.userId,
          bypassDuplicateCheck: skipDuplicateCheck,
          customerName,
          projectName,
          customerIndustry: (row.customerIndustry || '').trim() || undefined,
          contactName: (row.contactName || '').trim() || undefined,
          contactTitle: (row.contactTitle || '').trim() || undefined,
          customerPhone: (row.customerPhone || '').trim() || undefined,
          customerAddress: (row.customerAddress || '').trim() || undefined,
          leadSource: (row.leadSource || '').trim() || undefined,
          competitors: competitors.length ? competitors : undefined,
          estimatedAmount: estimatedAmount != null && !Number.isNaN(estimatedAmount) ? estimatedAmount : undefined,
          estimatedClosingDate: (row.estimatedClosingDate || '').trim() || undefined,
          region: (row.region || '').trim() || undefined,
          channel: (row.channel || '').trim() || undefined,
        });

        if (!result.opportunity && result.duplicateCheck) {
          results.push({ ...base, status: 'duplicate', message: '疑似撞单，已跳过' });
        } else {
          results.push({ ...base, status: 'created', id: result.opportunity?.id });
        }
      } catch (err: any) {
        results.push({ ...base, message: err?.message || '创建失败' });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
      error: results.filter((r) => r.status === 'error').length,
    };

    return NextResponse.json({ summary, results }, { status: 200 });
  } catch (error: any) {
    console.error('Import opportunities error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import opportunities' },
      { status: 500 }
    );
  }
}
