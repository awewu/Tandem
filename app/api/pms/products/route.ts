/**
 * PMS API · 产品目录 + 客户体系 (导入驱动主数据)
 *
 * GET  ?type=products|customers   列表 (读全员)
 * POST { action:'create_product' | 'update_product' | 'create_customer' }  (写仅内部)
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requirePmsAuth, type PmsAuthResult } from '@/lib/pms/pms-auth';
import {
  createProduct,
  listProducts,
  updateProductStatus,
  createCustomerAccount,
  listCustomerAccounts,
} from '@/lib/pms/product-catalog-service';

export async function GET(req: NextRequest) {
  await boot();
  let auth: PmsAuthResult;
  try {
    auth = await requirePmsAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'products';

    if (type === 'customers') {
      const customers = await listCustomerAccounts({
        tenantId: auth.tenantId,
        region: searchParams.get('region') || undefined,
        dealerOrgId: searchParams.get('dealerOrgId') || undefined,
        parentAccountId: searchParams.get('parentAccountId') || undefined,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
        offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
      });
      return NextResponse.json({ customers });
    }

    const products = await listProducts({
      tenantId: auth.tenantId,
      series: searchParams.get('series') || undefined,
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    });
    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
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
    const action = body.action as string;

    // 主数据写操作仅内部
    if (!auth.isInternal) {
      return NextResponse.json({ error: 'forbidden: master data write requires internal role' }, { status: 403 });
    }

    if (action === 'create_product') {
      if (!body.series || !body.model) {
        return NextResponse.json({ error: 'Missing required fields: series, model' }, { status: 400 });
      }
      const product = await createProduct(auth.tenantId, body);
      return NextResponse.json({ product }, { status: 201 });
    }

    if (action === 'update_product') {
      if (!body.id || !body.status) {
        return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
      }
      const result = await updateProductStatus({ tenantId: auth.tenantId, id: body.id, status: body.status });
      return NextResponse.json({ result });
    }

    if (action === 'create_customer') {
      if (!body.name) {
        return NextResponse.json({ error: 'Missing name' }, { status: 400 });
      }
      const customer = await createCustomerAccount(auth.tenantId, body);
      return NextResponse.json({ customer }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Products POST error:', error);
    if (/not found/.test(error?.message || '')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
