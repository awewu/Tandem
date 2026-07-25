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
import { ArrowLeft, AlertTriangle, Package } from 'lucide-react';

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

interface DuplicateMatchDetail {
  similarity: number;
  dimensions?: string[];
}
interface DuplicateCheck {
  matchDetails?: DuplicateMatchDetail[];
  matchedOpportunities?: string[];
}

export default function NewOpportunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheck | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedSeriesCode, setSelectedSeriesCode] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const [formData, setFormData] = useState({
    dealerOrgId: 'dealer_default',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    projectName: '',
    estimatedAmount: '',
    estimatedClosingDate: '',
    region: '',
    channel: '',
  });

  useEffect(() => {
    fetch('/api/pms/products?status=active&limit=500', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products || []))
      .catch(() => setProducts([]));
  }, []);

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
      
      const res = await fetch('/api/pms/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
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
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="例：北京某医院"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">联系电话</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="13800138000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customerAddress">项目地址</Label>
              <Input
                id="customerAddress"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                placeholder="北京市朝阳区xxx路xxx号"
              />
            </div>

            <div>
              <Label htmlFor="projectName">项目名称 *</Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="例：中央空调采购项目"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedAmount">预估金额（元）</Label>
                <Input
                  id="estimatedAmount"
                  type="number"
                  value={formData.estimatedAmount}
                  onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })}
                  placeholder="5000000"
                />
              </div>
              <div>
                <Label htmlFor="estimatedClosingDate">预计成交日期</Label>
                <Input
                  id="estimatedClosingDate"
                  type="date"
                  value={formData.estimatedClosingDate}
                  onChange={(e) => setFormData({ ...formData, estimatedClosingDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="region">区域</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="华北"
                />
              </div>
              <div>
                <Label htmlFor="channel">渠道</Label>
                <Input
                  id="channel"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  placeholder="直销"
                />
              </div>
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
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>产品系列</Label>
                <Select
                  value={selectedSeriesCode}
                  onValueChange={(v) => {
                    setSelectedSeriesCode(v);
                    setSelectedProductId('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={seriesList.length ? '选择系列' : '暂无产品目录'} />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesList.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>型号</Label>
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                  disabled={!selectedSeriesCode}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedSeriesCode ? '选择型号' : '请先选系列'} />
                  </SelectTrigger>
                  <SelectContent>
                    {modelsInSeries.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
