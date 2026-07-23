'use client';

import { useMemo, useState } from 'react';
import type { SiteProduct } from '../../lib/site-products';

const ALL = '全部';

function brandColor(brand: string): string {
  return ['rheem', 'ruud', 'everhot'].includes(brand.toLowerCase()) ? 'var(--rh-red)' : 'var(--rh-red-dk)';
}

export default function ProductCatalog({ products, unavailable }: { products: SiteProduct[]; unavailable: boolean }) {
  const [active, setActive] = useState(ALL);
  const categories = useMemo(() => [ALL, ...new Set(products.map((product) => product.cat))], [products]);
  const filtered = active === ALL ? products : products.filter((product) => product.cat === active);

  return (
    <>
      {products.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--rh-border)', background: '#fff', position: 'sticky', top: 68, zIndex: 40 }}>
          <div className="rh-container" style={{ display: 'flex', gap: 4, padding: '0 32px', overflowX: 'auto' }}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActive(category)}
                style={{
                  padding: '14px 18px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: 'transparent', whiteSpace: 'nowrap',
                  color: active === category ? 'var(--rh-green)' : 'var(--rh-t2)',
                  borderBottom: active === category ? '2px solid var(--rh-green)' : '2px solid transparent',
                }}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="rh-section" style={{ background: 'var(--rh-bg)' }}>
        <div className="rh-container" style={{ padding: '0 32px' }}>
          {unavailable ? (
            <div className="rh-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--rh-t2)' }}>
              产品服务暂时不可用，请稍后刷新。
            </div>
          ) : filtered.length === 0 ? (
            <div className="rh-card" style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--rh-t2)' }}>
              当前集团网站暂无已发布产品。
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
              {filtered.map((product) => (
                <article key={product.id} className="rh-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ background: product.bg, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div className="rh-bolt-frame" style={{ width: 56, height: 60, fontSize: 13 }}>{product.code}</div>
                    )}
                  </div>
                  <div style={{ padding: '20px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                        background: `${brandColor(product.brand)}18`, color: brandColor(product.brand),
                      }}>
                        {product.brand}
                      </span>
                      {product.eco && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'rgba(22,163,74,0.10)', color: '#16A34A' }}>节能产品</span>}
                    </div>
                    <a href={`/products/${encodeURIComponent(product.id)}`} style={{ textDecoration: 'none' }}>
                      <h2 className="rh-display" style={{ fontSize: 20, color: 'var(--rh-dark)' }}>{product.name}</h2>
                      <p style={{ fontSize: 13, color: 'var(--rh-t2)', marginTop: 2 }}>{product.desc}</p>
                    </a>
                    {product.metric && <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--rh-green)', background: 'var(--rh-green-soft)', padding: '4px 8px', borderRadius: 4, alignSelf: 'flex-start' }}>{product.metric}</div>}
                    <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--rh-border)', textAlign: 'right' }}>
                      <a href={`/products/${encodeURIComponent(product.id)}`} className="rh-btn rh-btn-brand" style={{ padding: '6px 14px', fontSize: 12 }}>查看详情</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
