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
import {
  isYonyouCustomerConfigured,
  listYonyouCustomerDealerProfiles,
} from '@/lib/integrations/yonyou-customer';
import {
  getYonyouMaterialConfig,
  isYonyouMaterialConfigured,
  listYonyouMaterialCategories,
  listYonyouMaterialProducts,
  YonyouMaterialRequestError,
} from '@/lib/integrations/yonyou-material';
import {
  YonyouTokenConfigError,
  YonyouTokenRequestError,
} from '@/lib/integrations/yonyou-token';

type MaterialCategoryForDefault = Awaited<ReturnType<typeof listYonyouMaterialCategories>>[number];

const MATERIAL_CATEGORY_CACHE_TTL_MS = 10 * 60 * 1000;

let materialCategoryCache: {
  expiresAt: number;
  categories: MaterialCategoryForDefault[];
} | null = null;
let materialCategoryInFlight: Promise<MaterialCategoryForDefault[]> | null = null;

async function listCachedYonyouMaterialCategories(): Promise<MaterialCategoryForDefault[]> {
  const now = Date.now();
  if (materialCategoryCache && materialCategoryCache.expiresAt > now) {
    return materialCategoryCache.categories;
  }
  if (materialCategoryInFlight) return materialCategoryInFlight;

  materialCategoryInFlight = listYonyouMaterialCategories({
    pageIndex: 1,
    pageSize: 5000,
  }).then((categories) => {
    materialCategoryCache = {
      categories,
      expiresAt: Date.now() + MATERIAL_CATEGORY_CACHE_TTL_MS,
    };
    return categories;
  }).finally(() => {
    materialCategoryInFlight = null;
  });
  return materialCategoryInFlight;
}

function pickDefaultProductCategoryCode(
  categories: MaterialCategoryForDefault[],
  rootCategoryCodes: string[],
  includeStopped: boolean,
): string | undefined {
  const source = categories.filter((category) => includeStopped || category.isEnabled);
  const rootKeys = new Set(rootCategoryCodes);
  const rootCategories = source.filter((category) => rootKeys.has(category.code ?? '') || rootKeys.has(category.id));
  const rootLookup = new Set(rootCategories.flatMap((category) => [category.id, category.code].filter(Boolean) as string[]));
  const candidates = rootLookup.size
    ? source.filter((category) => category.parentId && rootLookup.has(category.parentId))
    : source.filter((category) => !rootKeys.has(category.code ?? '') && !rootKeys.has(category.id));
  const sorted = [...candidates].sort((a, b) => {
    if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return sorted[0]?.code ?? sorted[0]?.id;
}

function expandProductCategoryCodes(
  categories: MaterialCategoryForDefault[],
  rootCategoryCodes: string[],
  includeStopped: boolean,
): string[] {
  if (!rootCategoryCodes.length) return [];
  const source = categories.filter((category) => includeStopped || category.isEnabled);
  const byParent = new Map<string, MaterialCategoryForDefault[]>();
  source.forEach((category) => {
    if (!category.parentId) return;
    byParent.set(category.parentId, [...(byParent.get(category.parentId) ?? []), category]);
  });

  const codes: string[] = [];
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const category = source.find((item) => item.code === key || item.id === key);
    if (!category) {
      codes.push(key);
      return;
    }
    codes.push(category.code ?? category.id);
    [
      ...(byParent.get(category.id) ?? []),
      ...(category.code ? byParent.get(category.code) ?? [] : []),
    ].forEach((child) => visit(child.code ?? child.id));
  };
  rootCategoryCodes.forEach(visit);
  return Array.from(new Set(codes));
}

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
      if (searchParams.get('source') === 'ys') {
        if (!isYonyouCustomerConfigured()) {
          return NextResponse.json({
            error: 'YONSUITE_API_BASE, YONSUITE_APP_KEY and YONSUITE_APP_SECRET are required',
          }, { status: 503 });
        }
        const pageIndex = searchParams.get('pageIndex') ? parseInt(searchParams.get('pageIndex')!) : 1;
        const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 100;
        const keyword = (searchParams.get('q') || '').trim();
        const keywordLooksLikeCode = /^[A-Za-z0-9_.\/-]+$/.test(keyword);
        const result = await listYonyouCustomerDealerProfiles({
          pageIndex,
          pageSize,
          stopStatus: searchParams.get('includeStopped') === '1' ? undefined : false,
          ...(keyword
            ? (keywordLooksLikeCode ? { code: keyword } : { name: keyword })
            : {}),
          customerClassCode: searchParams.get('customerClassCode') || undefined,
          pubts: searchParams.get('pubts') || undefined,
        });
        const customers = result.profiles.map((profile) => ({
          id: profile.id,
          name: profile.name || profile.orgId,
          externalCode: profile.code,
          type: profile.customerClassName,
          region: profile.coverageRegions?.[0],
          dealerOrgId: profile.orgId,
          attributes: {
            contactName: profile.contactName,
            contactPhone: profile.contactPhone,
            contactEmail: profile.contactEmail,
            address: profile.address,
            customerIndustry: profile.coverageRegions?.[3],
            customerClassName: profile.customerClassName,
            legalBody: profile.legalBody,
          },
          source: 'ys',
          status: profile.status === 'stopped' ? 'stopped' : 'active',
        }));
        return NextResponse.json({
          source: 'ys',
          customers,
          page: {
            pageIndex: result.pageIndex,
            pageSize: result.pageSize,
            pageCount: result.pageCount,
            recordCount: result.recordCount,
            pubts: result.pubts,
          },
        });
      }

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

    if (searchParams.get('source') === 'ys') {
      if (!isYonyouMaterialConfigured()) {
        return NextResponse.json({
          error: 'YONSUITE_API_BASE, YONSUITE_APP_KEY and YONSUITE_APP_SECRET are required',
        }, { status: 503 });
      }
      const config = getYonyouMaterialConfig();
      const pageIndex = searchParams.get('pageIndex') ? parseInt(searchParams.get('pageIndex')!) : 1;
      const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50;
      const includeStopped = searchParams.get('includeStopped') === '1';
      const allCategories = searchParams.get('allCategories') === '1';
      const categories = await listCachedYonyouMaterialCategories();
      const keyword = (searchParams.get('q') || '').trim();
      const materialClassCodes = (searchParams.get('categoryCodes') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50);
      const requestedCategoryCode = searchParams.get('categoryCode') || undefined;
      const defaultCategoryCode = !allCategories && !materialClassCodes.length && !requestedCategoryCode
        ? pickDefaultProductCategoryCode(categories, config.productRootCategoryCodes ?? [], includeStopped)
        : undefined;
      const allProductCategoryCodes = allCategories
        ? expandProductCategoryCodes(categories, config.productRootCategoryCodes ?? [], includeStopped)
        : [];
      const categoryCodes = materialClassCodes.length
        ? materialClassCodes
        : (allCategories
          ? allProductCategoryCodes
          : (requestedCategoryCode
          ? [requestedCategoryCode]
          : (defaultCategoryCode ? [defaultCategoryCode] : config.productRootCategoryCodes ?? [])));
      const keywordLooksLikeCode = /^[A-Za-z0-9_.\/-]+$/.test(keyword);
      const searchVariants = keyword
        ? (keywordLooksLikeCode ? [{ code: keyword }, { name: keyword }] : [{ name: keyword }, { code: keyword }])
        : [{
          code: searchParams.get('code') || undefined,
          name: searchParams.get('name') || undefined,
        }];
      const results = await Promise.all(searchVariants.map((variant) => (
        listYonyouMaterialProducts({
          pageIndex,
          pageSize,
          ...variant,
          categoryCodes,
          enabled: includeStopped ? undefined : true,
          pubts: searchParams.get('pubts') || undefined,
        })
      )));
      const result = results[0];
      const shouldMergeProducts = searchVariants.length > 1;
      const products = shouldMergeProducts
        ? Array.from(new Map(results.flatMap((item) => item.products).map((product) => [product.id, product])).values()).slice(0, pageSize)
        : result.products;
      return NextResponse.json({
        source: 'ys',
        products,
        categories,
        selectedCategoryCode: defaultCategoryCode,
        rootCategoryCodes: config.productRootCategoryCodes ?? [],
        page: {
          pageIndex,
          pageSize,
          pageCount: shouldMergeProducts ? Math.max(...results.map((item) => item.pageCount), 1) : result.pageCount,
          recordCount: shouldMergeProducts ? results.reduce((sum, item) => sum + item.recordCount, 0) : result.recordCount,
          pubts: result.pubts,
        },
      });
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
    if (error instanceof YonyouTokenConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof YonyouTokenRequestError || error instanceof YonyouMaterialRequestError) {
      return NextResponse.json({
        error: error.message,
        code: error.details.code,
        yonyouMessage: error.details.yonyouMessage,
        status: error.details.status,
      }, { status: 502 });
    }
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
