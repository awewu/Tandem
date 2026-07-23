import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GROUP, LINKS } from '../../../lib/brand';
import { getSiteProduct, listSiteProducts, SITE_PRODUCT_BRAND_COLOR } from '../../../lib/site-products';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getSiteProduct(id);
  if (!product) return { title: '产品未找到', robots: { index: false, follow: true } };
  return {
    title: `${product.name} ${product.desc}`,
    description: `${product.brand} ${product.name} - ${product.desc}`,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: {
      title: `${product.name} | ${GROUP.nameShort}`,
      description: `${product.brand} ${product.name} - ${product.desc}`,
      url: `/products/${product.id}`,
      type: 'website',
      images: product.image ? [product.image] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, catalog] = await Promise.all([getSiteProduct(id), listSiteProducts()]);
  if (!product) notFound();
  const related = catalog.items.filter((item) => item.cat === product.cat && item.id !== product.id).slice(0, 4);
  const brandColor = SITE_PRODUCT_BRAND_COLOR[product.brand] || 'var(--rh-red-dk)';

  return (
    <main id="main">
      <div style={{ background: 'var(--rh-s2)', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ padding: '14px 32px', fontSize: 13, color: 'var(--rh-t3)' }}>
          <a href="/products" style={{ color: 'var(--rh-green)', textDecoration: 'none', fontWeight: 600 }}>产品系列</a>
          {' / '}{product.cat}{' / '}<span style={{ color: 'var(--rh-t1)', fontWeight: 600 }}>{product.name}</span>
        </div>
      </div>

      <section style={{ background: '#fff' }}>
        <div className="rh-container rh-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, padding: '56px 32px', alignItems: 'center' }}>
          <div style={{ background: product.bg, borderRadius: 'var(--rh-r-lg)', minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--rh-border)', overflow: 'hidden' }}>
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt={product.name} style={{ width: '100%', height: 360, objectFit: 'contain' }} />
            ) : (
              <div className="rh-bolt-frame" style={{ width: 110, height: 120, fontSize: 22 }}>{product.code}</div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(228,0,43,0.08)', color: brandColor }}>{product.brand}</span>
              {product.eco && <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700, background: 'rgba(22,163,74,0.10)', color: '#16A34A' }}>节能产品</span>}
            </div>
            <h1 className="rh-display" style={{ fontSize: 'clamp(32px,4vw,48px)', color: 'var(--rh-dark)', marginBottom: 8 }}>{product.name}</h1>
            <p style={{ fontSize: 17, color: 'var(--rh-t2)', marginBottom: 20 }}>{product.desc}</p>
            {product.metric && <div style={{ display: 'inline-block', fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--rh-green)', background: 'var(--rh-green-soft)', padding: '6px 12px', borderRadius: 4, marginBottom: 24 }}>{product.metric}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '13px 32px', fontSize: 14 }}>咨询经销商</a>
              <a href={LINKS.diagnosis} target="_blank" rel="noreferrer" className="rh-btn rh-btn-outline" style={{ padding: '13px 28px', fontSize: 14 }}>AI 选型对比</a>
            </div>
          </div>
        </div>
      </section>

      {product.specs.length > 0 && (
        <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
          <div className="rh-container">
            <p className="rh-eyebrow" style={{ marginBottom: 8 }}>Specifications</p>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 28 }}>规格参数</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 1, background: 'var(--rh-border)', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', overflow: 'hidden' }}>
              {product.specs.map((spec) => (
                <div key={spec.label} style={{ background: '#fff', padding: '20px 24px' }}>
                  <div style={{ fontSize: 12, color: 'var(--rh-t3)', marginBottom: 6 }}>{spec.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--rh-t1)' }}>{spec.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {(product.features.length > 0 || product.scenarios.length > 0) && (
        <section className="rh-section" style={{ background: '#fff' }}>
          <div className="rh-container rh-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56 }}>
            <div>
              <p className="rh-eyebrow" style={{ marginBottom: 8 }}>Features</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>核心特性</h2>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {product.features.map((feature) => <li key={feature} style={{ fontSize: 15, color: 'var(--rh-t2)', borderLeft: '3px solid var(--rh-green)', paddingLeft: 14 }}>{feature}</li>)}
              </ul>
            </div>
            <div>
              <p className="rh-eyebrow" style={{ marginBottom: 8 }}>Scenarios</p>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>适用场景</h2>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {product.scenarios.map((scenario) => <li key={scenario} style={{ padding: '14px 18px', background: 'var(--rh-s2)', borderRadius: 'var(--rh-r-md)', fontSize: 14, color: 'var(--rh-t2)' }}>{scenario}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
          <div className="rh-container">
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>同类产品</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
              {related.map((item) => (
                <a key={item.id} href={`/products/${encodeURIComponent(item.id)}`} className="rh-card-hover" style={{ display: 'block', padding: 24, background: '#fff', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', textDecoration: 'none', color: 'var(--rh-t1)' }}>
                  <div className="rh-display" style={{ fontSize: 20, color: 'var(--rh-dark)', marginBottom: 4 }}>{item.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--rh-t3)', marginBottom: 12 }}>{item.desc}</div>
                  <span style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 700 }}>查看详情</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
