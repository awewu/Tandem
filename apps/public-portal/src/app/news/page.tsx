import type { Metadata } from 'next';
import { GROUP, CONTACT } from '../../lib/brand';
import { NEWS } from '../../lib/news';
import PageHero from '../../components/PageHero';

export const metadata: Metadata = {
  title: 'Newsroom | Rhautt Comfort Group',
  description: `${GROUP.nameShort}最新动态、行业新闻与企业公告。`,
  alternates: { canonical: '/news' },
};

const TAG_COLOR: Record<string, string> = {
  '公司新闻': 'var(--rh-green)',
  '产品发布': 'var(--rh-green-dk)',
  '品牌活动': 'var(--rh-warm)',
  '行业洞察': 'var(--rh-green)',
};

export default function NewsPage() {
  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        minHeight={360}
        eyebrow="NEWSROOM · 新闻中心"
        title={<>最新<span style={{ color: 'var(--rh-green)' }}>动态</span></>}
        lead={<>{GROUP.nameCn}最新动态、品牌新闻与行业洞察。</>}
      />

      {/* ── Media Contacts + View by Year — 对标 A.O. Smith news.html 结构 ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--rh-border)', padding: '24px 32px' }}>
        <div className="rh-container" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rh-t3)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12 }}>
              Media Contacts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rh-t1)' }}>集团公关负责人</div>
              <div style={{ fontSize: 12, color: 'var(--rh-t3)', marginBottom: 6 }}>SVP – Human Resources &amp; Public Affairs</div>
              <a href={`mailto:${CONTACT.emails.media}`} style={{ fontSize: 13, color: 'var(--rh-green)', textDecoration: 'none', fontWeight: 600 }}>
                {CONTACT.emails.media}
              </a>
              <a href={`tel:${CONTACT.hotlineTel}`} style={{ fontSize: 13, color: 'var(--rh-t2)', textDecoration: 'none' }}>
                {CONTACT.hotline}
              </a>
              <div style={{ fontSize: 12, color: 'var(--rh-t3)', marginTop: 6, lineHeight: 1.6 }}>
                如需媒体采访、评论或管理层出席邀请，请通过以上联系方式提交。<br />
                其他一般咨询请使用联系表单。
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rh-t3)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12 }}>
              View Posts by Year
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['2026', '2025', '2024', '2023'].map((yr, i) => (
                <button key={yr} style={{
                  padding: '7px 18px', fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--rh-border)', borderRadius: 4, cursor: 'pointer',
                  background: i === 0 ? 'var(--rh-green)' : '#fff',
                  color: i === 0 ? '#fff' : 'var(--rh-t2)',
                }}>{yr}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── News list ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s1)' }}>
        <div className="rh-container">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {NEWS.map(item => (
              <div key={item.slug} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr',
                gap: 28, padding: '28px 0',
                borderBottom: '1px solid var(--rh-border)',
                alignItems: 'start',
              }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--rh-t3)', marginBottom: 8 }}>{item.date}</div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 4,
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    background: (TAG_COLOR[item.category] ?? 'var(--rh-green)') + '18',
                    color: TAG_COLOR[item.category] ?? 'var(--rh-green)',
                  }}>{item.category}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--rh-t1)', marginBottom: 8, lineHeight: 1.45 }}>
                    <a href={`/news/${item.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--rh-t3)', lineHeight: 1.7, marginBottom: 12 }}>{item.excerpt}</p>
                  <a href={`/news/${item.slug}`} style={{ fontSize: 13, color: 'var(--rh-green)', fontWeight: 700, textDecoration: 'none' }}>
                    Read More →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Investor Financial Releases note ── */}
      <section style={{ background: 'var(--rh-s2)', padding: '48px 32px' }}>
        <div className="rh-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--rh-t1)', marginBottom: 6 }}>
              Looking for {GROUP.nameShort} Financial Release information?
            </p>
            <p style={{ fontSize: 13, color: 'var(--rh-t3)' }}>
              Investor relations resources, financial reports and quarterly results.
            </p>
          </div>
          <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '11px 26px', fontSize: 13, flexShrink: 0 }}>
            Investor Relations →
          </a>
        </div>
      </section>

    </main>
  );
}
