import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NEWS, getArticle } from '../../../lib/news';
import { GROUP } from '../../../lib/brand';

export function generateStaticParams() {
  return NEWS.map(n => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: '文章未找到', robots: { index: false, follow: true } };
  return {
    title: a.title,
    description: a.excerpt,
    alternates: { canonical: `/news/${a.slug}` },
    openGraph: {
      title: `${a.title} | ${GROUP.nameShort}`,
      description: a.excerpt,
      url: `/news/${a.slug}`,
      type: 'article',
      publishedTime: a.date,
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <main id="main">

      {/* ── 文章头部 ── */}
      <section style={{
        background: 'var(--rh-s2)', color: 'var(--rh-t1)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: 'var(--rh-green)' }} />
        <div className="rh-container" style={{ padding: '64px 32px 56px 52px', maxWidth: 900 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
              background: 'var(--rh-green-2)', color: '#fff', letterSpacing: '0.06em',
            }}>{article.category}</span>
            <span style={{ fontSize: 13, color: 'var(--rh-t3)' }}>{article.date}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(24px,3.5vw,38px)', fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.01em' }}>
            {article.title}
          </h1>
        </div>
      </section>

      {/* ── 正文 ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container" style={{ maxWidth: 760 }}>
          <p style={{
            fontSize: 17, color: 'var(--rh-t2)', lineHeight: 1.9, marginBottom: 36,
            paddingLeft: 20, borderLeft: '3px solid var(--rh-green)', fontStyle: 'italic',
          }}>
            {article.excerpt}
          </p>
          {article.body.map((para, i) => (
            <p key={i} style={{ fontSize: 16, color: 'var(--rh-t1)', lineHeight: 2.0, marginBottom: 24 }}>
              {para}
            </p>
          ))}
          <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--rh-border)' }}>
            <a href="/news" style={{ fontSize: 14, color: 'var(--rh-green)', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em' }}>
              ← 返回新闻列表
            </a>
          </div>
        </div>
      </section>

      {/* ── 更多新闻 ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
        <div className="rh-container">
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>更多新闻</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            {NEWS.filter(n => n.slug !== article.slug).slice(0, 3).map(n => (
              <a key={n.slug} href={`/news/${n.slug}`} className="rh-card-hover" style={{
                display: 'block', padding: '26px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                textDecoration: 'none', color: 'var(--rh-t1)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 700, marginBottom: 10 }}>{n.category} · {n.date}</div>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.6 }}>{n.title}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
