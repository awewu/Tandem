import type { Metadata } from 'next';
import { BRAND, CONTACT } from '../../lib/brand';

export const metadata: Metadata = {
  title: '联系我们',
  description: `联系${BRAND.nameCn}：客服热线 ${CONTACT.hotline}，获取 AI 问诊与产品咨询服务。`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main id="main" style={{ background: 'var(--rv-dark)', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <section className="rh-section" style={{ borderBottom: '3px solid var(--rv-brand)', paddingBottom: '2rem' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: 'var(--rv-accent)' }}>CONTACT US</p>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', margin: '0.5rem 0 0', fontWeight: 800 }}>联系我们</h1>
        </div>
      </section>

      {/* 联系方式 */}
      <section className="rh-section">
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: 'var(--rv-accent)' }}>CONTACT INFO</p>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '1.5rem', fontWeight: 700 }}>联系方式</h2>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {[
              { label: '客服热线', value: CONTACT.hotline, href: `tel:${CONTACT.hotlineTel}` },
              { label: '服务邮箱', value: CONTACT.emails.service, href: `mailto:${CONTACT.emails.service}` },
              { label: '总部地址', value: CONTACT.address, href: null },
              { label: '工作时间', value: CONTACT.hours, href: null },
            ].map(item => (
              <div key={item.label} className="rh-card-dark" style={{ padding: '20px 22px' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</p>
                {item.href ? (
                  <a href={item.href} style={{ color: 'var(--rv-accent)', fontSize: '0.98rem', fontWeight: 600 }}>{item.value}</a>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.98rem', color: '#fff', fontWeight: 600 }}>{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI 问诊入口 */}
      <section className="rh-section" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 100%)', borderTop: '3px solid var(--rv-brand)' }}>
        <div className="rh-container" style={{ textAlign: 'center' }}>
          <p className="rh-eyebrow" style={{ color: 'var(--rv-accent)' }}>{BRAND.nameCn} · {BRAND.taglineCn}</p>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', margin: '0.5rem 0 1rem', fontWeight: 800 }}>需要选型建议？试试 AI 问诊</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.9 }}>
            {BRAND.nameCn}根据家庭用水习惯、户型与预算，智能推荐适合的舒适家系统方案。
          </p>
          <a href="/#diagnosis" className="rh-btn rh-btn-brand" style={{ display: 'inline-block' }}>立即 AI 问诊 →</a>
        </div>
      </section>
    </main>
  );
}
