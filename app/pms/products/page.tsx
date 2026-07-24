/**
 * PMS · 产品目录 (只读)
 * 主数据由 ERP 接口同步导入, PMS 侧只读展示 (系列/型号/价格)。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package, Search } from 'lucide-react';

interface Product {
  id: string;
  series: string;
  model: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  minPrice?: number;
  status: string;
}

export default function PmsProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/products?type=products', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function filtered() {
    if (!search) return products;
    const lower = search.toLowerCase();
    return products.filter(
      (p) => p.model.toLowerCase().includes(lower) || p.series.toLowerCase().includes(lower),
    );
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
          <Package className="w-6 h-6 text-brand-500" />
          产品目录
        </h1>
        <p className="text-body text-ink-secondary mt-1">主数据由 ERP 同步 · 只读</p>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary" />
            <Input
              type="text"
              placeholder="搜索系列 / 型号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-4 border-danger/30">
          <CardContent className="p-4 text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        </div>
      ) : filtered().length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无产品 (待 ERP 同步)</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered().map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-caption bg-surface-2 text-ink-secondary">
                      {p.series}
                    </span>
                    {p.category && <span className="text-caption text-ink-tertiary">{p.category}</span>}
                  </div>
                  <h3 className="text-headline font-semibold text-ink-primary">{p.model}</h3>
                  {p.specification && <p className="text-caption text-ink-tertiary mt-1">{p.specification}</p>}
                </div>
                <div className="text-right shrink-0">
                  {p.listPrice != null && (
                    <p className="text-headline font-bold text-brand-500">
                      ¥{p.listPrice.toLocaleString('zh-CN')}
                      {p.unit ? <span className="text-caption text-ink-tertiary">/{p.unit}</span> : null}
                    </p>
                  )}
                  {p.minPrice != null && (
                    <p className="text-caption text-ink-tertiary mt-1">底价 ¥{p.minPrice.toLocaleString('zh-CN')}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
