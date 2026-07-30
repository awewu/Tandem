/**
 * PMS · 新建商机
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ArrowLeft, AlertTriangle, Check, ChevronDown, Package, Search } from 'lucide-react';

const LEAD_SOURCES = ['设计院', '招标网', '老客户转介绍', '展会', '网络营销', '电话开发', '厂家线索', '合作伙伴', '其他'];
const INDUSTRIES = ['医院', '学校', '酒店', '商业综合体', '数据中心', '工业厂房', '住宅地产', '政府/公建', '其他'];
const REGIONS = ['华北', '华东', '华南', '华中', '西南', '西北', '东北'];
const CHANNELS = ['直销', '经销', '工程', '设计院', '电商', '其他'];
const YS_MASTER_REQUEST_TIMEOUT_MS = 60_000;
const MASTER_PAGE_SIZE = 5000;
const SEARCHABLE_SELECT_VISIBLE_LIMIT = 200;

interface CatalogProduct {
  id: string;
  series: string;
  seriesCode?: string;
  model: string;
  modelCode?: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  attributes?: Record<string, string>;
}

interface DealerProfile {
  orgId: string;
  code?: string;
  name?: string;
  orgName?: string;
  status?: string;
  source?: 'pms' | 'organization' | 'ys';
}

interface DuplicateMatchDetail {
  similarity: number;
  dimensions?: string[];
}
interface DuplicateCheck {
  matchDetails?: DuplicateMatchDetail[];
  matchedOpportunities?: string[];
}

interface PageInfo {
  pageIndex: number;
  pageCount: number;
}

interface SearchableOption {
  value: string;
  label: string;
  description?: string;
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheck | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productSource, setProductSource] = useState<'ys' | 'local' | 'none'>('none');
  const [selectedSeriesCode, setSelectedSeriesCode] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [dealers, setDealers] = useState<DealerProfile[]>([]);

  const [formData, setFormData] = useState({
    dealerOrgId: '',
    customerName: '',
    customerIndustry: '',
    customerPhone: '',
    contactName: '',
    contactTitle: '',
    customerAddress: '',
    projectName: '',
    leadSource: '',
    competitors: '',
    estimatedAmount: '',
    estimatedClosingDate: '',
    region: '',
    channel: '',
  });

  useEffect(() => {
    loadMasterData();
    // Master data is loaded once when the create form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMasterData() {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), YS_MASTER_REQUEST_TIMEOUT_MS);
    const [localDealersResult, ysDealersResult] = await Promise.allSettled([
      fetch('/api/pms/dealer-orgs?limit=5000', { credentials: 'include', cache: 'no-store' })
        .then(async (res) => (res.ok ? (await res.json()).profiles || [] : [])),
      loadPagedMasterData<DealerProfile>({
        basePath: '/api/pms/dealer-orgs',
        itemKey: 'profiles',
        source: 'ys',
        signal: controller.signal,
      }),
    ]);
    window.clearTimeout(timer);

    const localDealers = localDealersResult.status === 'fulfilled' ? localDealersResult.value : [];
    const ysDealers = ysDealersResult.status === 'fulfilled' ? ysDealersResult.value : [];
    setDealers(mergeDealerOptions(localDealers, ysDealers));

    await loadProducts();
  }

  async function loadPagedMasterData<T>(options: {
    basePath: string;
    itemKey: string;
    source: 'ys';
    signal?: AbortSignal;
  }): Promise<T[]> {
    const loadPage = async (pageIndex: number) => {
      const url = new URL(options.basePath, window.location.origin);
      url.searchParams.set('source', options.source);
      url.searchParams.set('pageIndex', String(pageIndex));
      url.searchParams.set('pageSize', String(MASTER_PAGE_SIZE));
      const res = await fetch(url.toString(), {
        credentials: 'include',
        cache: 'no-store',
        signal: options.signal,
      });
      if (!res.ok) return { items: [] as T[], page: { pageIndex, pageCount: 0 } };
      const data = await res.json();
      return {
        items: (data[options.itemKey] || []) as T[],
        page: (data.page || { pageIndex, pageCount: 1 }) as PageInfo,
      };
    };

    const first = await loadPage(1);
    const pageCount = Math.max(first.page.pageCount || 1, 1);
    if (pageCount === 1) return first.items;
    const items = [...first.items];
    for (let pageIndex = 2; pageIndex <= pageCount; pageIndex += 1) {
      const nextPage = await loadPage(pageIndex);
      items.push(...nextPage.items);
    }
    return items;
  }

  function dealerLabel(dealer: DealerProfile | undefined): string {
    return dealer?.orgName || dealer?.name || dealer?.code || dealer?.orgId || '';
  }

  function dealerKeys(dealer: DealerProfile): string[] {
    return [dealer.orgId, dealer.orgName, dealer.name, dealer.code]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
  }

  function mergeDealerOptions(localDealers: DealerProfile[], ysDealers: DealerProfile[]): DealerProfile[] {
    const seen = new Set<string>();
    const merged: DealerProfile[] = [];
    const add = (dealer: DealerProfile) => {
      if (dealer.status === 'suspended' || dealer.status === 'stopped') return;
      const keys = dealerKeys(dealer);
      if (keys.some((key) => seen.has(key))) return;
      keys.forEach((key) => seen.add(key));
      merged.push(dealer);
    };
    localDealers.forEach(add);
    ysDealers.forEach(add);
    return merged;
  }

  async function loadProducts() {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), YS_MASTER_REQUEST_TIMEOUT_MS);
    try {
      const nextProducts = await loadPagedMasterData<CatalogProduct>({
        basePath: '/api/pms/products?type=products&allCategories=1',
        itemKey: 'products',
        source: 'ys',
        signal: controller.signal,
      });
      if (nextProducts.length > 0) {
        setProducts(nextProducts);
        setProductSource('ys');
        return;
      }
    } catch {
      // fall back to local catalog below
    } finally {
      window.clearTimeout(timer);
    }

    fetch('/api/pms/products?status=active&limit=5000', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => {
        const nextProducts = d.products || [];
        setProducts(nextProducts);
        setProductSource(nextProducts.length > 0 ? 'local' : 'none');
      })
      .catch(() => {
        setProducts([]);
        setProductSource('none');
      });
  }

  // 系列列表 (按 seriesCode 去重)
  const seriesList = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      const code = p.seriesCode || p.series;
      if (!map.has(code)) map.set(code, p.series);
    }
    return Array.from(map, ([code, name]) => ({ code, name }));
  }, [products]);

  // 当前系列下的型号
  const modelsInSeries = useMemo(
    () => products.filter((p) => (p.seriesCode || p.series) === selectedSeriesCode),
    [products, selectedSeriesCode],
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId],
  );

  const dealerOptions = useMemo<SearchableOption[]>(() => (
    dealers.map((dealer) => ({
      value: dealer.orgId,
      label: dealerLabel(dealer),
      description: dealer.code && dealer.code !== dealerLabel(dealer) ? dealer.code : undefined,
    }))
  ), [dealers]);

  const seriesOptions = useMemo<SearchableOption[]>(() => (
    seriesList.map((series) => ({
      value: series.code,
      label: series.name,
      description: series.code !== series.name ? series.code : undefined,
    }))
  ), [seriesList]);

  const modelOptions = useMemo<SearchableOption[]>(() => (
    modelsInSeries.map((product) => ({
      value: product.id,
      label: product.model,
      description: [product.modelCode, product.specification].filter(Boolean).join(' / ') || undefined,
    }))
  ), [modelsInSeries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.projectName) {
      setError('请填写客户名称和项目名称');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setDuplicateWarning(null);
      const selectedDealer = dealers.find((dealer) => dealer.orgId === formData.dealerOrgId);
      
      const res = await fetch('/api/pms/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          dealerOrgName: dealerLabel(selectedDealer),
          dealerOrgCode: selectedDealer?.code,
          dealerOrgSource: selectedDealer?.source,
          competitors: formData.competitors
            ? formData.competitors.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
            : undefined,
          estimatedAmount: formData.estimatedAmount ? parseFloat(formData.estimatedAmount) : undefined,
          // 结构化产品选型 (来自目录, 供后续按系列/型号分析 + AI 报价)
          productSeries: selectedProduct?.series,
          productSeriesCode: selectedProduct?.seriesCode,
          productModel: selectedProduct?.model,
          productModelCode: selectedProduct?.modelCode,
          productCatalogId: selectedProduct?.id,
          productCategory: selectedProduct?.category,
          productAttributes: selectedProduct?.attributes,
          productLine: selectedProduct?.series,
        }),
      });
      
      const data = await res.json();
      
      // 撞单检测
      if (res.status === 409) {
        setDuplicateWarning(data.duplicateCheck);
        return;
      }
      
      if (!res.ok) {
        throw new Error(data.error || '创建失败');
      }
      
      // 成功，跳转到详情页
      router.push(`/pms/opportunities/${data.opportunity.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-3xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <h1 className="text-title-lg font-bold text-ink-primary">新建商机</h1>
        <p className="text-body text-ink-secondary mt-1">
          填写商机信息，系统将自动进行查重检测
        </p>
      </div>

      {duplicateWarning && (
        <Card className="mb-6 border-warning bg-warning/10">
          <CardHeader>
            <CardTitle className="flex items-center text-warning">
              <AlertTriangle className="w-5 h-5 mr-2" />
              检测到疑似撞单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-warning mb-2">
              相似度: {((duplicateWarning.matchDetails?.[0]?.similarity ?? 0) * 100).toFixed(0)}%
            </p>
            <p className="text-caption text-warning mb-4">
              匹配维度: {duplicateWarning.matchDetails?.[0]?.dimensions?.join(', ')}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDuplicateWarning(null)}
              >
                修改信息
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/pms/opportunities/${duplicateWarning.matchedOpportunities?.[0]}`)}
              >
                查看已有商机
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-danger bg-danger/10">
          <CardContent className="p-4">
            <p className="text-caption text-danger">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">客户名称 *</Label>
                <Input id="customerName" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} placeholder="例：上海某医院" required />
              </div>
              <div>
                <Label>客户行业</Label>
                <Select value={formData.customerIndustry} onValueChange={(v) => setFormData({ ...formData, customerIndustry: v })}>
                  <SelectTrigger><SelectValue placeholder="选择行业" /></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="contactName">联系人</Label>
                <Input id="contactName" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} placeholder="例：张经理" />
              </div>
              <div>
                <Label htmlFor="contactTitle">职务</Label>
                <Input id="contactTitle" value={formData.contactTitle} onChange={(e) => setFormData({ ...formData, contactTitle: e.target.value })} placeholder="例：采购负责人" />
              </div>
              <div>
                <Label htmlFor="customerPhone">联系电话</Label>
                <Input id="customerPhone" value={formData.customerPhone} onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} placeholder="例：13800000000" />
              </div>
            </div>

            <div>
              <Label htmlFor="customerAddress">项目地址</Label>
              <Input id="customerAddress" value={formData.customerAddress} onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })} placeholder="例：上海市浦东新区..." />
            </div>

            <div>
              <Label htmlFor="projectName">项目名称 *</Label>
              <Input id="projectName" value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} placeholder="例：中央空调采购项目" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>线索来源</Label>
                <Select value={formData.leadSource} onValueChange={(v) => setFormData({ ...formData, leadSource: v })}>
                  <SelectTrigger><SelectValue placeholder="选择来源" /></SelectTrigger>
                  <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="competitors">竞争对手</Label>
                <Input id="competitors" value={formData.competitors} onChange={(e) => setFormData({ ...formData, competitors: e.target.value })} placeholder="开利, 麦克维尔 (逗号分隔)" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedAmount">预估金额（元）</Label>
                <Input id="estimatedAmount" type="number" value={formData.estimatedAmount} onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })} placeholder="5000000" />
              </div>
              <div>
                <Label htmlFor="estimatedClosingDate">预计成交日期</Label>
                <Input id="estimatedClosingDate" type="date" value={formData.estimatedClosingDate} onChange={(e) => setFormData({ ...formData, estimatedClosingDate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>区域</Label>
                <Select value={formData.region} onValueChange={(v) => setFormData({ ...formData, region: v })}>
                  <SelectTrigger><SelectValue placeholder="选择区域" /></SelectTrigger>
                  <SelectContent>{REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>渠道</Label>
                <Select value={formData.channel} onValueChange={(v) => setFormData({ ...formData, channel: v })}>
                  <SelectTrigger><SelectValue placeholder="选择渠道" /></SelectTrigger>
                  <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>归属经销商</Label>
              <SearchableSelect
                value={formData.dealerOrgId}
                options={dealerOptions}
                placeholder={dealers.length ? '选择归属经销商' : '暂无可选经销商'}
                searchPlaceholder="输入经销商名称/编码筛选"
                onChange={(v) => setFormData({ ...formData, dealerOrgId: v })}
              />
              <p className="text-caption text-ink-tertiary mt-1">
                {dealers.length
                  ? `已加载 ${dealers.length} 个经销商；内部代报时从经销商组织中选择。`
                  : '暂无可选经销商，请先在组织架构中维护经销商组织。'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-500" />
              产品选型
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-caption text-ink-tertiary">
              从产品目录选择系列与型号，便于后续按系列/型号分析与 AI 报价。
              {productSource === 'ys'
                ? ` 当前读取 YS 物料档案，已加载 ${products.length} 个型号、${seriesList.length} 个系列。`
                : productSource === 'local'
                  ? ` 当前读取本地产品目录，已加载 ${products.length} 个型号、${seriesList.length} 个系列。`
                  : ' 当前暂无可选产品目录。'}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>产品系列</Label>
                <SearchableSelect
                  value={selectedSeriesCode}
                  options={seriesOptions}
                  placeholder={seriesList.length ? '选择系列' : '暂无产品目录'}
                  searchPlaceholder="输入系列名称/编码筛选"
                  placement="top"
                  onChange={(v) => {
                    setSelectedSeriesCode(v);
                    setSelectedProductId('');
                  }}
                />
              </div>
              <div>
                <Label>型号</Label>
                <SearchableSelect
                  value={selectedProductId}
                  options={modelOptions}
                  placeholder={selectedSeriesCode ? '选择型号' : '请先选系列'}
                  searchPlaceholder="输入型号/规格筛选"
                  onChange={setSelectedProductId}
                  disabled={!selectedSeriesCode}
                  placement="top"
                />
              </div>
            </div>

            {selectedProduct && (
              <div className="rounded-md border border-border bg-surface-2 p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-headline font-semibold text-ink-primary">
                    {selectedProduct.model}
                  </span>
                  {selectedProduct.listPrice != null && (
                    <span className="text-headline font-bold text-brand-500">
                      目录价 ¥{selectedProduct.listPrice.toLocaleString('zh-CN')}
                    </span>
                  )}
                </div>
                <p className="text-caption text-ink-tertiary">
                  {selectedProduct.category} · {selectedProduct.specification || '—'}
                  {selectedProduct.unit ? ` / ${selectedProduct.unit}` : ''}
                </p>
                {selectedProduct.attributes && Object.keys(selectedProduct.attributes).length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(selectedProduct.attributes).map(([k, v]) => (
                      <span
                        key={k}
                        className="text-caption text-ink-secondary bg-surface-1 border border-border rounded px-2 py-0.5"
                      >
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-500 hover:bg-brand-600"
          >
            {loading ? '创建中...' : '创建商机'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SearchableSelect({
  value,
  options,
  placeholder,
  searchPlaceholder,
  onChange,
  disabled,
  placement = 'bottom',
}: {
  value: string;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placement?: 'bottom' | 'top';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => (
      option.label.toLowerCase().includes(normalizedQuery) ||
      (option.description || '').toLowerCase().includes(normalizedQuery) ||
      option.value.toLowerCase().includes(normalizedQuery)
    ));
  }, [normalizedQuery, options]);
  const visibleOptions = filteredOptions.slice(0, SEARCHABLE_SELECT_VISIBLE_LIMIT);
  const hiddenCount = filteredOptions.length - visibleOptions.length;

  return (
    <div
      className="relative"
      onBlur={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node && event.currentTarget.contains(nextFocus)) return;
        setOpen(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery('');
        }}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-caption ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? 'truncate text-ink-primary' : 'truncate text-muted-foreground'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && !disabled && (
        <div className={`absolute z-50 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-soft ${
          placement === 'top' ? 'bottom-full mb-1' : 'mt-1'
        }`}>
          <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder={searchPlaceholder}
              className="h-8 min-w-0 flex-1 bg-transparent text-caption outline-none placeholder:text-ink-tertiary"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {visibleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-caption hover:bg-accent hover:text-accent-foreground"
              >
                <Check className={`h-4 w-4 shrink-0 ${option.value === value ? 'opacity-100' : 'opacity-0'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink-primary">{option.label}</span>
                  {option.description && (
                    <span className="block truncate text-[11px] text-ink-tertiary">{option.description}</span>
                  )}
                </span>
              </button>
            ))}
            {visibleOptions.length === 0 && (
              <div className="px-3 py-6 text-center text-caption text-ink-tertiary">没有匹配结果</div>
            )}
            {hiddenCount > 0 && (
              <div className="px-3 py-2 text-center text-[11px] text-ink-tertiary">
                还有 {hiddenCount} 条结果，请继续输入筛选
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
