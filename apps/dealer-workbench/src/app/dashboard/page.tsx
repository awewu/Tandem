'use client';
import { useEffect, useState } from 'react';
import { bim, crm, quotation } from '../../lib/api';
import { Users, ClipboardList, TrendingUp, Clock, ArrowRight, ChevronRight, Sparkles, LayoutGrid } from 'lucide-react';

function SectionHeader({ title, subtitle, actionHref, actionLabel }: {
  title: string; subtitle?: string; actionHref?: string; actionLabel?: string;
}) {
  return (
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, marginBottom:12 }}>
      <div>
        <h2 className="t-title-3">{title}</h2>
        {subtitle && <p style={{ marginTop:2, fontSize:13, color:'var(--t-secondary)' }}>{subtitle}</p>}
      </div>
      {actionHref && (
        <a href={actionHref} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:13, fontWeight:500, color:'var(--brand)', whiteSpace:'nowrap' }}>
          {actionLabel} <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}

function WorkbenchCard({ icon: Icon, tone, label, value, unit, hint, href }: {
  icon: React.ComponentType<any>; tone: 'brand'|'success'|'info'|'warn';
  label: string; value: number|string; unit?: string; hint?: string; href: string;
}) {
  const iconStyle: Record<string, React.CSSProperties> = {
    brand:   { background:'var(--brand-50)',            color:'var(--brand)' },
    success: { background:'rgba(22,163,74,0.10)',        color:'var(--success)' },
    info:    { background:'rgba(37,99,235,0.10)',        color:'var(--info)' },
    warn:    { background:'rgba(217,119,6,0.10)',        color:'var(--warning)' },
  };
  return (
    <a href={href} className="card-elevated surface-interactive" style={{ display:'block', padding:20 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, color:'var(--t-secondary)' }}>{label}</span>
        <span style={{ ...iconStyle[tone], borderRadius:8, padding:6, display:'flex' }}><Icon size={14} /></span>
      </div>
      <div style={{ marginTop:12, display:'flex', alignItems:'baseline', gap:4 }}>
        <span style={{ fontSize:36, fontWeight:700, color:'var(--t-strong)', letterSpacing:'-0.015em', fontVariantNumeric:'tabular-nums', lineHeight:1.1 }}>{value}</span>
        {unit && <span style={{ fontSize:18, fontWeight:500, color:'var(--t-secondary)' }}>{unit}</span>}
      </div>
      {hint && <p style={{ marginTop:4, fontSize:12, color:'var(--t-tertiary)' }}>{hint}</p>}
    </a>
  );
}

const QUICK_LINKS = [
  { href:'/crm',      label:'新建线索', primary:true  },
  { href:'/design',   label:'方案设计', primary:false },
  { href:'/bim',      label:'BIM 交付', primary:false },
  { href:'/products', label:'产品目录', primary:false },
  { href:'/projects', label:'项目进度', primary:false },
  { href:'/analytics',label:'经营分析', primary:false },
];

export default function Dashboard() {
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [bimStats, setBimStats]   = useState<{ inProgress: number; delivered: number } | null>(null);
  const [area, setArea]           = useState('150');
  const [city, setCity]           = useState('上海');
  const [loadResult, setLoadResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    crm.listCustomers({}).then((r: any) => setCustomers(r?.data?.items || r?.items || [])).catch(() => {});
    bim.stats().then((s: any) => setBimStats(s)).catch(() => {});
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { month:'long', day:'numeric', weekday:'long' });

  return (
    <div style={{ background:'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight:'100%' }}>
      <div className="page-container" style={{ display:'grid', gap:28 }}>

        {/* ── 顶部公告条 ── */}
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          borderRadius:10, border:'1px solid var(--border)',
          background:'var(--surface-1)', padding:'10px 16px',
        }}>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:4, background:'var(--brand)',
            color:'#fff', borderRadius:9999, padding:'2px 8px',
            fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.05em', flexShrink:0,
          }}>
            <Sparkles size={10} /> 工作台
          </span>
          <span style={{ fontSize:13, color:'var(--t-primary)', flex:1 }}>{dateStr}</span>
          <span style={{ fontSize:12, color:'var(--t-tertiary)', flexShrink:0 }}>瑞合瑞德 · 瑞诺瓦 AI 舒适家</span>
        </div>

        {/* ── §1 KPI (左2/3) + 快速跳板 (右1/3) ── */}
        <div className="split-main">
          <section>
            <SectionHeader title="我的工作台" subtitle="线索 · BIM · 签约 · 跟进" />
            <div className="g4" style={{ gap:12 }}>
              <WorkbenchCard icon={Users}         tone="brand"   label="本月新线索"  value={customers.length || 0}      unit="条" hint="CRM 线索总量"   href="/crm" />
              <WorkbenchCard icon={ClipboardList} tone="info"    label="在途BIM项目" value={bimStats?.inProgress ?? '—'} unit="个" hint="施工交付中"     href="/bim" />
              <WorkbenchCard icon={TrendingUp}    tone="success" label="已交付项目"  value={bimStats?.delivered  ?? '—'} unit="个" hint="本周期完成"     href="/bim" />
              <WorkbenchCard icon={Clock}         tone="warn"    label="待跟进"      value="—"                          unit="条" hint="超48h未联系"   href="/crm" />
            </div>
          </section>

          {/* 快速跳板 */}
          <section>
            <SectionHeader title="快速跳板" subtitle="常用入口" />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {QUICK_LINKS.map(l => (
                <a key={l.href} href={l.href} className="surface-interactive" style={{
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  gap:6, padding:'14px 8px', borderRadius:12,
                  background: l.primary ? 'var(--brand)' : 'var(--surface-2)',
                  border: l.primary ? 'none' : '1px solid var(--border)',
                  color: l.primary ? '#fff' : 'var(--t-primary)',
                  fontSize:12, fontWeight:600, textAlign:'center' as const, lineHeight:1.3,
                }}>
                  <LayoutGrid size={14} style={{ opacity:l.primary ? 0.9 : 0.45 }} />
                  {l.label}
                </a>
              ))}
            </div>
          </section>
        </div>

        {/* ── §2 负荷估算 + 最近线索 ── */}
        <div className="g2" style={{ gap:20, alignItems:'start' }}>

          <section>
            <SectionHeader title="快速负荷估算" subtitle="AI 秒算冷热负荷" />
            <div className="card-elevated" style={{ padding:20 }}>
              <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                <input className="input" value={area} onChange={e => setArea(e.target.value)} placeholder="面积 ㎡" style={{ width:100 }} />
                <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="城市"   style={{ width:80  }} />
                <button className="btn btn-brand btn-sm" onClick={async () => {
                  setLoading(true);
                  try { setLoadResult(await quotation.loadCalc(Number(area), city) as any); } catch {}
                  setLoading(false);
                }} disabled={loading}>{loading ? '计算中…' : '估算'}</button>
              </div>
              {loadResult ? (
                <div className="inset">
                  <pre className="t-mono" style={{ overflow:'auto', fontSize:12, color:'var(--t-secondary)' }}>
                    {JSON.stringify(loadResult, null, 2)}
                  </pre>
                </div>
              ) : (
                <p style={{ fontSize:13, color:'var(--t-tertiary)', textAlign:'center', padding:'16px 0' }}>输入参数后点击估算</p>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="最近线索" subtitle="CRM 客户 · 最新动态" actionHref="/crm" actionLabel="查看全部" />
            <div className="card-elevated" style={{ overflow:'hidden' }}>
              {customers.length === 0 ? (
                <div style={{ padding:'40px 20px', textAlign:'center' }}>
                  <p style={{ fontSize:14, color:'var(--t-secondary)' }}>暂无线索 — 请先登录</p>
                  <a href="/crm" style={{ marginTop:12, display:'inline-flex', alignItems:'center', gap:4, fontSize:13, color:'var(--brand)', fontWeight:500 }}>
                    新建第一条线索 <ArrowRight size={14} />
                  </a>
                </div>
              ) : (
                <ul style={{ listStyle:'none' }}>
                  {customers.slice(0, 6).map((c: any, i: number) => (
                    <li key={c.id} style={{ borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
                      <a href={`/crm/${c.id}`} className="surface-interactive" style={{
                        display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
                      }}>
                        <span style={{
                          width:8, height:8, borderRadius:'50%', flexShrink:0,
                          background: c.status === 'active' ? 'var(--success)' : c.status === 'lost' ? 'var(--danger)' : 'var(--info)',
                        }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:14, fontWeight:600, color:'var(--t-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize:12, color:'var(--t-tertiary)', marginTop:1 }}>{c.city || '—'} · {c.status}</p>
                        </div>
                        <ChevronRight size={14} style={{ color:'var(--t-tertiary)', flexShrink:0 }} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <footer style={{ paddingBottom:16, textAlign:'center', fontSize:12, color:'var(--t-tertiary)' }}>
          按 <kbd style={{ borderRadius:4, border:'1px solid var(--border)', background:'var(--surface-2)', padding:'1px 6px', fontFamily:'monospace', fontSize:11 }}>⌘K</kbd> 打开命令面板
        </footer>
      </div>
    </div>
  );
}
