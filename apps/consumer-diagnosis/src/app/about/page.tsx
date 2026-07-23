import type { Metadata } from 'next';
import { BRAND, CONTACT, LINKS } from '../../lib/brand';

export const metadata: Metadata = {
  title: '关于我们',
  description: `关于${BRAND.nameCn}（${BRAND.nameEn}）— AI 驱动的中立舒适家居选型工具。`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <main id="main">
      {/* Hero */}
      <section style={{ background: 'var(--rv-dark)', color: '#fff', padding: '80px 32px 60px' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: 'var(--rv-accent)' }}>ABOUT US</p>
          <h1 style={{ fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 800, margin: '12px 0 20px' }}>关于{BRAND.nameCn}</h1>
          <p style={{ maxWidth: 600, opacity: 0.75, fontSize: 16, lineHeight: 1.9 }}>
            {BRAND.nameCn}（{BRAND.nameEn}）是一款 AI 驱动的舒适家居系统选型工具，帮助消费者快速了解中央热水、采暖制冷、空气品质、水处理及智控系统，并获得精准的智能推荐。
          </p>
        </div>
        <div style={{ height: 3, background: 'var(--rv-brand)', marginTop: 40 }} />
      </section>

      {/* 定位 */}
      <section className="rh-section">
        <div className="rh-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40 }}>
            <div>
              <div className="rh-eyebrow" style={{ color: 'var(--rv-brand)' }}>我们的定位</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>中立 · 智能 · 精准</h2>
              <p style={{ color: 'var(--rv-t2)', lineHeight: 1.9, fontSize: 15 }}>
                {BRAND.nameCn}以中立第三方的角色，通过 AI 技术为家庭用户提供舒适家居系统的选型建议与方案推荐。我们不偏向任何单一品牌，而是根据用户的实际需求、户型条件与预算，匹配最优的系统配置。
              </p>
            </div>
            <div>
              <div className="rh-eyebrow" style={{ color: 'var(--rv-ok)' }}>技术能力</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>AI 问诊引擎</h2>
              <p style={{ color: 'var(--rv-t2)', lineHeight: 1.9, fontSize: 15 }}>
                内置的 AI 问诊引擎通过分析用户的居住痛点、空间面积、用水习惯与预算区间，自动推荐系统组合方案与参考报价，将传统暖通方案设计从数天缩短到 3 分钟。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 系统覆盖 */}
      <section className="rh-section" style={{ background: 'var(--rv-s2)' }}>
        <div className="rh-container">
          <div className="rh-eyebrow">系统覆盖</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>五大核心系统族</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 20 }}>
            {[
              { icon: '🚿', name: '中央热水' },
              { icon: '🔥', name: '采暖制冷' },
              { icon: '🌬️', name: '空气品质' },
              { icon: '💧', name: '水处理' },
              { icon: '📡', name: '智控系统' },
            ].map(s => (
              <div key={s.name} className="rh-card" style={{ padding: '22px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 联系入口 */}
      <section className="rh-section" style={{ textAlign: 'center' }}>
        <div className="rh-container">
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>有问题？联系我们</h2>
          <p style={{ color: 'var(--rv-t3)', marginBottom: 28, fontSize: 15 }}>客服热线 {CONTACT.hotline} · 周一至周六 {CONTACT.hours.split(' ')[1] || '9:00-18:00'}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '12px 30px', fontSize: 15 }}>联系我们</a>
            <a href="/#diagnosis" className="rh-btn rh-btn-outline" style={{ padding: '12px 30px', fontSize: 15 }}>免费 AI 问诊</a>
          </div>
        </div>
      </section>
    </main>
  );
}
