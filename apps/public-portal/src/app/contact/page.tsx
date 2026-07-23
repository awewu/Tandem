import type { Metadata } from 'next';
import { GROUP, CONTACT, LINKS } from '../../lib/brand';
import PageHero from '../../components/PageHero';

export const metadata: Metadata = {
  title: '联系我们 & 找经销商',
  description: `联系${GROUP.nameCn}：客服热线 ${CONTACT.hotline}，或查询授权经销商与工程服务。`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main id="main" style={{ background: 'var(--rh-s2)', minHeight: '100vh', color: 'var(--rh-t1)' }}>
      {/* Header */}
      <PageHero
        minHeight={320}
        eyebrow="CONTACT & DEALERS · 联系我们"
        title={<>联系我们 &amp; <span style={{ color: 'var(--rh-green)' }}>找经销商</span></>}
      />

      {/* 找经销商（静态占位，后续接 Nexus 经销商域） */}
      <section className="rh-section">
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>FIND A DEALER</p>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem', fontWeight: 700 }}>查找授权经销商</h2>
          <p style={{ color: 'var(--rh-t2)', maxWidth: 560, lineHeight: 1.9, marginBottom: '1.5rem' }}>
            您可直接使用在线经销商查询，或通过总部热线与邮箱获取您所在城市的授权经销商与工程服务信息。
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <a href="/dealers" className="rh-btn rh-btn-brand" style={{ padding: '12px 26px' }}>在线查找经销商 →</a>
            <a href={`tel:${CONTACT.hotlineTel}`} className="rh-btn rh-btn-outline" style={{ padding: '12px 26px' }}>致电总部 {CONTACT.hotline}</a>
            <a href={`mailto:${CONTACT.emails.service}`} className="rh-btn rh-btn-outline" style={{ padding: '12px 26px' }}>邮件咨询</a>
          </div>
        </div>
      </section>

      {/* 联系方式 */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>CONTACT INFO</p>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '1.5rem', fontWeight: 700 }}>联系方式</h2>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {[
              { label: '客服热线', value: CONTACT.hotline, href: `tel:${CONTACT.hotlineTel}` },
              { label: '商务合作', value: CONTACT.emails.business, href: `mailto:${CONTACT.emails.business}` },
              { label: '媒体联系', value: CONTACT.emails.media, href: `mailto:${CONTACT.emails.media}` },
              { label: '总部地址', value: CONTACT.address, href: null },
              { label: '工作时间', value: CONTACT.hours, href: null },
            ].map(item => (
              <div key={item.label} className="rh-card" style={{ background: 'var(--rh-s2)', border: '1px solid var(--rh-border)', padding: '18px 20px' }}>
                <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: 'var(--rh-t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</p>
                {item.href ? (
                  <a href={item.href} style={{ color: 'var(--rh-green)', fontSize: '0.98rem', fontWeight: 600 }}>{item.value}</a>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.98rem', color: 'var(--rh-t1)', fontWeight: 600 }}>{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 瑞诺瓦 Rysnova（中性第三方入口） */}
      <section className="rh-section" style={{ background: 'var(--rh-green-soft)', color: 'var(--rh-t1)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ textAlign: 'center' }}>
          <p className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>瑞诺瓦 Rysnova · AI 舒适家</p>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2.2rem)', margin: '0.5rem 0 1rem', fontWeight: 800, color: 'var(--rh-t1)' }}>在线选型建议</h2>
          <p style={{ color: 'var(--rh-t2)', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.9 }}>
            瑞诺瓦 Rysnova 根据家庭用水习惯、户型与预算，提供舒适家系统选型参考。
          </p>
          <a href={LINKS.diagnosis} target="_blank" rel="noreferrer" className="rh-btn rh-btn-brand" style={{ display: 'inline-block' }}>获取选型建议</a>
        </div>
      </section>
    </main>
  );
}
