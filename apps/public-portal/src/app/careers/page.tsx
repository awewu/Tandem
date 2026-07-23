import type { Metadata } from 'next';
import { GROUP, CONTACT } from '../../lib/brand';
import PageHero from '../../components/PageHero';

export const metadata: Metadata = {
  title: 'Careers | Rhautt Comfort Group',
  description: `加入${GROUP.nameShort} — 在国际品牌环境中发展你的 HVAC、工程与商务职业生涯。`,
  alternates: { canonical: '/careers' },
};

/* 对标 A.O. Smith: Responsive Services / Opportunities to Learn / Innovation is in Our DNA */
const PILLARS = [
  {
    code: 'RS',
    title: 'Responsive Services & Support',
    subtitle: '客户响应与支持',
    desc: '我们以技术为第一语言，以客户满意为唯一标准。每一位工程师的判断都被认真对待。',
  },
  {
    code: 'LG',
    title: 'Opportunities to Learn & Grow',
    subtitle: '学习与成长',
    desc: '内部培训、行业认证与品牌访学，支持每位员工的专业深度扩展与职业路径规划。',
  },
  {
    code: 'IN',
    title: 'Innovation is in Our DNA',
    subtitle: '创新基因',
    desc: '运营瑞美集团国际品牌，直接连接全球 HVAC 行业标准，参与前沿技术的中国落地实践。',
  },
];

/* We Live Our Values — 对标 A.O. Smith 官方五大价值观 */
const CORE_VALUES = [
  { title: 'Achieve Profitable Growth',  subtitle: '实现盈利增长',   desc: '我们通过持续创新与高效运营，为集团、品牌伙伴与客户创造可持续的商业价值。' },
  { title: 'Emphasize Innovation',       subtitle: '强调创新',       desc: '创新是我们 DNA 的一部分。我们不断推动下一代热水与热泵技术，引领行业进步。' },
  { title: 'Preserve Its Good Name',     subtitle: '维护品牌声誉',   desc: '我们以诚信经营维护品牌声誉，对客户、合作伙伴与社区承担长期责任。' },
  { title: 'Be a Good Place to Work',    subtitle: '成为优秀雇主',   desc: '我们关心每一位员工的成长，提供学习机会、职业路径与包容的工作环境。' },
  { title: 'Be a Good Citizen',          subtitle: '做优秀的企业公民', desc: '我们积极回馈社区，推动环境可持续，以行动践行我们对社会责任的承诺。' },
];

const DEPT = [
  { name: '工程技术', roles: ['系统集成工程师', 'HVAC 设计工程师', 'BIM 技术专员'] },
  { name: '商务拓展', roles: ['大区业务经理', '经销商发展专员', '方案顾问'] },
  { name: '市场品牌', roles: ['品牌传播专员', '数字营销运营', '内容策划'] },
  { name: '运营支持', roles: ['项目协调', '客户成功', '供应链管理'] },
];

export default function CareersPage() {
  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        eyebrow="CAREERS · 加入我们"
        title={<>加入<span style={{ color: 'var(--rh-green)' }}>{GROUP.nameShort}</span></>}
        lead={<>创新根植于{GROUP.nameShort}的基因。我们专注服务每一位客户，并将共同的价值观践行于每一天。</>}
      >
        <a href={`mailto:${CONTACT.emails.business}`} className="rh-btn rh-btn-brand" style={{ padding: '13px 34px', fontSize: 14, letterSpacing: '0.04em' }}>
          加入人才社区
        </a>
      </PageHero>

      {/* ── We're Passionate About Caring for Customers — 三支柱 ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>WHY US · 为何选择我们</p>
            <h2 style={{ fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
              我们，专注服务<br />每一位客户
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {PILLARS.map(p => (
              <div key={p.code} style={{
                padding: '36px 28px',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                background: 'var(--rh-s2)', position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div aria-hidden style={{ width: 28, height: 4, background: 'var(--rh-green)', marginBottom: 20 }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>{p.subtitle}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.8 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WE LIVE OUR VALUES EVERY DAY ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', color: 'var(--rh-t1)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 10 }}>OUR CULTURE</p>
            <h2 className="rh-display" style={{ fontSize: 'clamp(22px,3vw,38px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)' }}>
              WE LIVE OUR VALUES<br /><span style={{ color: 'var(--rh-green)' }}>EVERY DAY</span>
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            {CORE_VALUES.map(v => (
              <div key={v.title} style={{
                padding: '30px 24px',
                border: '1px solid var(--rh-border)',
                borderRadius: 'var(--rh-r-lg)',
                background: '#fff',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, color: 'var(--rh-t1)' }}>{v.title}</div>
                <div style={{ fontSize: 11, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{v.subtitle}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.75 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 职能领域 ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Open Roles</p>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>我们在招募的方向</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            {DEPT.map(d => (
              <div key={d.name} style={{
                padding: '28px 24px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: 'var(--rh-green)' }}>{d.name}</div>
                {d.roles.map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div className="rh-bolt" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--rh-t1)' }}>{r}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Join the Talent Community CTA ── */}
      <section style={{ background: 'var(--rh-s2)', padding: '80px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rh-green)', marginBottom: 16 }}>
            Talent Community
          </p>
          <h2 className="rh-display" style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)', marginBottom: 14 }}>
            Join the {GROUP.nameShort} Talent Community
          </h2>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.8 }}>
            对我们的职位感兴趣？加入人才社区，第一时间获取新职位推送与团队动态。
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`mailto:${CONTACT.emails.business}`} className="rh-btn rh-btn-brand" style={{
              padding: '13px 32px', fontSize: 14, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              发送简历
            </a>
            <a href="/about" className="rh-btn rh-btn-outline" style={{ padding: '13px 28px', fontSize: 14 }}>
              About {GROUP.nameShort}
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
