'use client';
import useSWR from 'swr';
import { apiFetch } from '../../lib/api';
import { ArrowRight, Globe2, BookOpen, Trophy, Megaphone, ChevronRight } from 'lucide-react';
import { HeroCarousel, type HeroSlide } from '../../components/HeroCarousel';
import { BRAND_TARGETS, CAMPAIGNS, TRAININGS, brandSummary } from '../../lib/brand-data';
import { WorkbenchSectionHeader } from '../../components/WorkbenchCore';

const fmt  = (v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}万` : `¥${v.toLocaleString()}`;
const pct  = (v: number) => `${(v*100).toFixed(0)}%`;

type ResourceLink = { label: string; href: string };
const FALLBACK_RESOURCES: ResourceLink[] = [
  { label:'Rheem 官网首页',   href:'https://rheem.com.cn' },
  { label:'品牌新闻中心',      href:'https://rheem.com.cn/news' },
  { label:'产品中心',          href:'https://rheem.com.cn/products' },
  { label:'培训认证',          href:'https://rheem.com.cn/training' },
];

// ── Hero slides from active campaigns ──
const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'brand-hero-1',
    eyebrow: '品牌中心',
    title: '瑞合瑞德 · 经销商品牌协同平台',
    subtitle: '活动参与 · 培训认证 · 返点追踪 · 物料下载 — 一站直达',
    bgGradient: 'linear-gradient(135deg, #1F1F1F 0%, #680014 58%, #C8202C 100%)',
    href: '/brand',
    badge: 'Rheem Partner',
  },
  ...CAMPAIGNS.filter(c => c.status === '进行中').slice(0, 2).map((c, i) => ({
    id: c.id,
    eyebrow: '品牌活动',
    title: c.title,
    subtitle: c.incentive,
    bgGradient: i === 0
      ? 'linear-gradient(135deg, #1F1F1F 0%, #8F001B 62%, #C8202C 100%)'
      : 'linear-gradient(135deg, #101828 0%, #680014 60%, #B80023 100%)',
    href: '/brand',
    badge: c.status,
  })),
];

// ── Section header (Tandem pattern) ──
function SectionHeader({ eyebrow, title, actionHref }: { eyebrow: string; title: string; actionHref?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:12 }}>
      <div>
        <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'var(--t-tertiary)' }}>{eyebrow}</p>
        <h3 style={{ fontSize:18, fontWeight:600, color:'var(--t-primary)', lineHeight:1.3 }}>{title}</h3>
      </div>
      {actionHref && (
        <a href={actionHref} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:13, fontWeight:500, color:'var(--brand)' }}>
          查看全部 <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}

export default function BrandPage() {
  const { data: live } = useSWR('/api/v2/brand', apiFetch);
  const s = brandSummary();

  // 把 rheem.com.cn 新闻注入 Hero slides
  const liveNewsSlides: HeroSlide[] = (live?.news || []).slice(0, 2).map((n: any, i: number) => ({
    id: `rheem-news-${i}`,
    eyebrow: 'Rheem 品牌动态',
    title: n.title,
    subtitle: n.date || '',
    bgGradient: 'linear-gradient(135deg, #101828 0%, #680014 60%, #C8202C 100%)',
    href: n.url || '/brand',
    badge: '品牌资讯',
  }));

  // 把抓取到的真实 products/trainings/campaigns 汇成官网直达链接（此前被丢弃）
  const liveResources: ResourceLink[] = [
    ...(live?.products  || []).slice(0, 2).map((p: any) => ({ label: `产品 · ${p.name}`,  href: p.url })),
    ...(live?.trainings || []).slice(0, 1).map((t: any) => ({ label: `培训 · ${t.title}`, href: t.url })),
    ...(live?.campaigns || []).slice(0, 1).map((c: any) => ({ label: `活动 · ${c.title}`, href: c.url })),
  ].filter((r) => r.href);

  return (
    <div style={{ background:'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight:'100%' }}>
      <div className="page-container">
        <WorkbenchSectionHeader
          eyebrow="营销工作台"
          title="品牌运营"
          description="活动、培训、返点与官网物料入口，面向品牌官网和市场协同的营销控制台。"
          actions={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <a className="btn btn-brand btn-sm" href="/comfort/sites">
                <Globe2 size={14} />
                管理品牌官网
              </a>
              <a className="btn btn-outline btn-sm" href="/products?module=catalog">
                产品目录
                <ArrowRight size={14} />
              </a>
            </div>
          }
        />
        <div className="split-main">

          {/* ──────── 左主区 ──────── */}
          <div style={{ display:'grid', gap:24, minWidth:0 }}>

            {/* Hero Carousel — merge static + live rheem news */}
            <HeroCarousel slides={[...HERO_SLIDES, ...liveNewsSlides]} />

            {/* 品牌活动 — 新闻卡片行 */}
            <section>
              <SectionHeader eyebrow="品牌活动" title="ACTIVE CAMPAIGNS" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
                {CAMPAIGNS.map(c => (
                  <a key={c.id} href="/brand" className="card-elevated surface-interactive" style={{ padding:16, display:'flex', alignItems:'flex-start', gap:12, textDecoration:'none' }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'var(--t-secondary)' }}>
                      <Globe2 size={16} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <span style={{
                        display:'inline-block', borderRadius:4, padding:'1px 6px',
                        fontSize:10, fontWeight:600,
                        background: c.status === '进行中' ? 'var(--brand-50)' : c.status === '即将开始' ? 'rgba(37,99,235,0.08)' : 'var(--surface-3)',
                        color:      c.status === '进行中' ? 'var(--brand-700)' : c.status === '即将开始' ? 'var(--info)'          : 'var(--t-tertiary)',
                      }}>{c.status}</span>
                      <h4 style={{ marginTop:4, fontSize:13, fontWeight:600, color:'var(--t-primary)', lineHeight:1.3, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{c.title}</h4>
                      <p style={{ marginTop:4, fontSize:11, color:'var(--t-tertiary)' }}>{c.startAt.slice(5)} – {c.endAt.slice(5)}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* 培训认证 — 年鉴大卡 */}
            <section>
              <SectionHeader eyebrow="培训认证" title="TRAINING ARCHIVE" actionHref="/brand" />
              <div style={{ display:'grid', gap:10 }}>
                {TRAININGS.map(t => {
                  const prog = t.completedBy / t.totalReps;
                  const urgent = new Date(t.deadline).getTime() - Date.now() < 7*86400000;
                  return (
                    <a key={t.id} href="/brand" className="card-elevated surface-interactive" style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16, textDecoration:'none' }}>
                      <div style={{ width:40, height:40, borderRadius:10, background: prog === 1 ? 'rgba(22,163,74,0.10)' : 'rgba(37,99,235,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <BookOpen size={18} style={{ color: prog === 1 ? 'var(--success)' : 'var(--info)' }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <p style={{ fontSize:14, fontWeight:600, color:'var(--t-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</p>
                          <span style={{ fontSize:11, color: urgent ? 'var(--danger)' : 'var(--t-tertiary)', flexShrink:0 }}>截止 {t.deadline.slice(5)}</span>
                        </div>
                        <div style={{ marginTop:6, height:5, background:'var(--surface-3)', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${prog*100}%`, background: prog===1 ? 'var(--success)' : 'var(--info)', borderRadius:3, transition:'width 600ms' }} />
                        </div>
                        <p style={{ marginTop:4, fontSize:11, color:'var(--t-tertiary)' }}>
                          {t.completedBy}/{t.totalReps} 人完成 · Lv.{t.level}
                          {t.required && <span style={{ color:'var(--danger)', marginLeft:6 }}>必修</span>}
                        </p>
                      </div>
                      <ChevronRight size={14} style={{ color:'var(--t-tertiary)', flexShrink:0 }} />
                    </a>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ──────── 右栏 ──────── */}
          <aside style={{ display:'grid', gap:16 }}>

            {/* GMV & 返点 KPI */}
            <div className="card-elevated" style={{ overflow:'hidden' }}>
              <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid var(--border)' }}>
                <p style={{ fontSize:11, fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'0.07em', color:'var(--t-tertiary)' }}>季度目标</p>
                <h3 style={{ fontSize:18, fontWeight:600, color:'var(--t-primary)' }}>GMV & 返点</h3>
              </div>
              <div style={{ padding:'12px 20px', display:'grid', gap:14 }}>
                {BRAND_TARGETS.map(t => {
                  const prog = Math.min(1, t.achieved / t.target);
                  return (
                    <div key={t.period}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                        <span style={{ fontWeight:600, color:'var(--t-primary)' }}>{t.period}</span>
                        <span style={{ color:'var(--brand)', fontWeight:600 }}>返点 {pct(t.rebateRate)}</span>
                      </div>
                      <div style={{ height:6, background:'var(--surface-3)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                        <div style={{ height:'100%', width:`${prog*100}%`, background: prog >= 1 ? 'var(--success)' : 'var(--brand)', borderRadius:3 }} />
                      </div>
                      <p style={{ fontSize:11, color:'var(--t-tertiary)' }}>{fmt(t.achieved)} / {fmt(t.target)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 本期汇总快览 */}
            <div className="card-elevated" style={{ padding:16 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--t-primary)', marginBottom:12 }}>#本期汇总</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[
                  { label:'Q2 进度',   value: pct(s.q2Progress),  color:'var(--brand)' },
                  { label:'年度返点',  value: fmt(s.ytdRebate),   color:'var(--success)' },
                  { label:'参与活动',  value: String(s.activeJoined), color:'var(--info)' },
                  { label:'培训完成率',value: pct(s.completedTrainings/s.totalTrainings), color:'var(--warning)' },
                ].map(k => (
                  <div key={k.label} style={{ background:'var(--surface-2)', borderRadius:8, padding:'10px 12px' }}>
                    <p style={{ fontSize:11, color:'var(--t-tertiary)', marginBottom:4 }}>{k.label}</p>
                    <p style={{ fontSize:24, fontWeight:700, color:k.color, fontVariantNumeric:'tabular-nums' }}>{k.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 返点激励 promo (Tandem CeoWeeklyPromo pattern) */}
            <a href="/brand" style={{ display:'block', borderRadius:16, overflow:'hidden', boxShadow:'var(--sh-lg)', textDecoration:'none' }}>
              <div style={{
                position:'relative', padding:20, color:'#fff',
                background:'linear-gradient(135deg, #1F1F1F 0%, #680014 56%, #C8202C 100%)',
              }}>
                <div style={{ position:'absolute', inset:0, opacity:0.15, backgroundImage:'radial-gradient(circle,white 1px,transparent 1px)', backgroundSize:'18px 18px', pointerEvents:'none' }} />
                <div style={{ position:'relative' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                    <Trophy size={14} style={{ opacity:0.8 }} />
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', opacity:0.8 }}>返点激励计划</span>
                  </div>
                  <h4 style={{ fontSize:16, fontWeight:700, lineHeight:1.3 }}>达标解锁季度返点<br />最高 {pct(Math.max(...BRAND_TARGETS.map(t=>t.rebateRate)))} 返点率</h4>
                  <p style={{ marginTop:8, fontSize:12, opacity:0.8, lineHeight:1.5 }}>
                    完成 GMV 目标即可解锁阶梯返点，本季结算后直接抵扣货款。
                  </p>
                  <span style={{ marginTop:14, display:'inline-flex', alignItems:'center', gap:6, background:'#fff', color:'var(--brand)', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:600 }}>
                    查看激励详情 <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </a>

            {/* Rheem 官网直达 — 来自 /api/v2/brand 抓取的真实链接 */}
            <div className="card-elevated" style={{ padding:16 }}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--t-primary)', marginBottom:10 }}>
                <Megaphone size={13} style={{ display:'inline', marginRight:6, verticalAlign:'middle' }} />
                Rheem 官网直达
              </p>
              {(liveResources.length ? liveResources : FALLBACK_RESOURCES).map((l, i) => (
                <a key={`${l.label}-${i}`} href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13, color:'var(--t-primary)', textDecoration:'none' }}>
                  <span style={{ minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.label}</span>
                  <ChevronRight size={13} style={{ color:'var(--t-tertiary)', flexShrink:0 }} />
                </a>
              ))}
              {!live && (
                <p style={{ marginTop:8, fontSize:11, color:'var(--t-tertiary)' }}>登录后加载官网实时内容</p>
              )}
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
