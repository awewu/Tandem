import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { boot } from '@/lib/boot';
import { db } from '@/lib/infra/drizzle-client';
import { pmsOpportunities } from '@/lib/infra/drizzle-schema';
import { generateDedupeKey } from '@/lib/pms/opportunity-service';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';

const MAX_ROWS = 500;

interface ImportRow {
  customerName?: string;
  projectName?: string;
  customerAddress?: string;
}

interface RowResult {
  index: number;
  status: 'pass' | 'duplicate';
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

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '缺少导入数据 (rows)' }, { status: 400 });
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `单次最多预检 ${MAX_ROWS} 行` }, { status: 400 });
    }

    const rowKeys = rows.map((row) => {
      const customerName = (row.customerName || '').trim();
      const projectName = (row.projectName || '').trim();
      if (!customerName || !projectName) return '';
      return generateDedupeKey(customerName, (row.customerAddress || '').trim(), projectName);
    });
    const keys = Array.from(new Set(rowKeys.filter(Boolean)));
    const existingKeys = new Set<string>();

    if (keys.length > 0) {
      const existing = await db
        .select({ dedupeKey: pmsOpportunities.dedupeKey })
        .from(pmsOpportunities)
        .where(and(
          eq(pmsOpportunities.tenantId, auth.tenantId),
          inArray(pmsOpportunities.dedupeKey, keys),
          isNull(pmsOpportunities.archivedAt),
        ));
      for (const row of existing) existingKeys.add(row.dedupeKey);
    }

    const results: RowResult[] = rowKeys.map((key, index) => (
      key && existingKeys.has(key)
        ? { index, status: 'duplicate', message: '数据库已存在相同客户/地址/项目，已跳过' }
        : { index, status: 'pass' }
    ));
    return NextResponse.json({
      summary: {
        total: results.length,
        duplicate: results.filter((row) => row.status === 'duplicate').length,
      },
      results,
    });
  } catch (error: any) {
    console.error('Preflight import opportunities error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preflight opportunities' },
      { status: 500 },
    );
  }
}
