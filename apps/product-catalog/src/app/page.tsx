'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { products } from '../lib/api';
import { CATEGORIES, PRODUCTS, SYSTEM_PACKS, type CatKey } from '../lib/products-data';
import { PageHeader } from '@rhautt/ui';

const fmt = (v: number) => `¥${v.toLocaleString()}`;
const STOCK = { in: { label: '现货', color: 'var(--success)' }, low: { label: '低库存', color: 'var(--warning)' }, order: { label: '需订货', color: 'var(--danger)' } };

export default function ProductsPage() {
  const [cat, setCat] = useState<CatKey | 'all'>('all');
  const [view, setView] = useState<'products' | 'packs'>('products');

  const { data: apiData } = useSWR(
    '/api/v2/product-catalog/devices',
    products.list,
    { revalidateOnFocus: false }
  );

  const rawProducts: any[] = apiData?.data?.items ?? apiData?.items ?? apiData ?? [];
  const liveProducts = rawProducts.length
    ? rawProducts.map((p: any) => ({
        id: p.id || p._id,
        name: p.name || p.productName,
        brand: p.brand || p.manufacturer,
        spec: (typeof p.spec === 'string' ? p.spec : p.spec?.text) || p.description || '',
        category: (p.category || p.systemFamily || 'heat_pump') as CatKey,
        marketPrice: Number(p.marketPrice ?? p.listPrice ?? 0),
        dealerPrice: Number(p.dealerPrice ?? p.costPrice ?? p.price ?? 0),
        stock: (p.stock || p.meta?.stock || p.availability || 'in') as 'in' | 'low' | 'order',
        isNew: !!(p.isNew ?? p.meta?.isNew),
        model: p.model || p.sku || '',
      }))
    : PRODUCTS;

  const list = cat === 'all' ? liveProducts : liveProducts.filter(p => p.category === cat);

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100vh' }}>
      <div className="page-container">
        <PageHeader
          title="产品目录"
          subtitle="Rheem 正品 · 实时库存"
          actions={
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
              {(['products', 'packs'] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  border: 'none', borderRadius: 6, padding: '5px 16px', fontSize: 13, cursor: 'pointer',
                  background: view === v ? '#fff' : 'transparent', fontWeight: view === v ? 600 : 400,
                  color: view === v ? 'var(--t-strong)' : 'var(--t-secondary)', boxShadow: view === v ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}>{v === 'products' ? '单品' : '系统方案包'}</button>
              ))}
            </div>
          }
        />

        {view === 'products' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              <Chip active={cat === 'all'} onClick={() => setCat('all')}>全部</Chip>
              {CATEGORIES.map(c => (
                <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {list.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px', color: 'var(--t-tertiary)' }}>
                  <p style={{ fontSize: 14, color: 'var(--t-secondary)' }}>该分类暂无产品</p>
                  <button onClick={() => setCat('all')} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--brand)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>查看全部产品</button>
                </div>
              )}
              {list.map(p => {
                const margin = ((p.marketPrice - p.dealerPrice) / p.marketPrice * 100).toFixed(0);
                const st = STOCK[p.stock];
                return (
                  <div key={p.id} className="card-elevated" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--t-secondary)' }}>{p.brand}</span>
                        {p.isNew && <span style={{ fontSize: 10, background: 'var(--brand-tint)', color: 'var(--brand-700)', padding: '1px 6px', borderRadius: 999, marginLeft: 6 }}>新品</span>}
                      </div>
                      <span style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>● {st.label}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t-secondary)', marginBottom: 10, lineHeight: 1.5, minHeight: 32 }}>{p.spec}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--t-tertiary)', textDecoration: 'line-through' }}>市场价 {fmt(p.marketPrice)}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand)' }}>{fmt(p.dealerPrice)}</div>
                      </div>
                      <span style={{ fontSize: 11, background: 'var(--success-bg)', color: 'var(--success)', padding: '3px 8px', borderRadius: 6 }}>毛利 {margin}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === 'packs' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {SYSTEM_PACKS.map(pk => {
              const itemSum = pk.items.reduce((a, it) => {
                const prod = PRODUCTS.find(p => p.model === it.model);
                return a + (prod ? prod.marketPrice * it.qty : 0);
              }, 0);
              const save = itemSum - pk.bundlePrice;
              return (
                <div key={pk.id} className="card-elevated" style={{ padding: 18, borderTop: '3px solid var(--brand)' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{pk.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--t-secondary)', margin: '4px 0 2px' }}>{pk.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginBottom: 12 }}>适用：{pk.scenario}</div>
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    {pk.items.map(it => {
                      const prod = PRODUCTS.find(p => p.model === it.model);
                      return (
                        <div key={it.model} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                          <span style={{ color: 'var(--t-primary)' }}>{prod?.name || it.model}</span>
                          <span style={{ color: 'var(--t-tertiary)' }}>×{it.qty}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--t-tertiary)', textDecoration: 'line-through' }}>单买 {fmt(itemSum)}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{fmt(pk.bundlePrice)}</div>
                    </div>
                    <span style={{ fontSize: 12, background: 'var(--brand-tint)', color: 'var(--brand-700)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>立省 {fmt(save)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      border: 'none', borderRadius: 999, padding: '6px 16px', fontSize: 13, cursor: 'pointer',
      background: active ? 'var(--t-strong)' : '#fff', color: active ? '#fff' : 'var(--t-primary)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)', fontWeight: active ? 600 : 400,
    }}>{children}</button>
  );
}
