'use client';
import { ArrowRight, Boxes, FileText, Globe2, Megaphone, Rocket, ShieldCheck, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ConsoleCard = {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: 'brand' | 'info' | 'success' | 'neutral';
};

const CONSOLE_CARDS: ConsoleCard[] = [
  {
    href: '/comfort/sites',
    label: '品牌官网',
    value: '3',
    hint: 'Rheem / Ruud / Everhot 官网与内容资产',
    icon: Globe2,
    tone: 'brand',
  },
  {
    href: '/growth',
    label: '市场增长',
    value: '5',
    hint: 'GEO、文案、舆情与自动化营销工具',
    icon: Rocket,
    tone: 'info',
  },
  {
    href: '/products?module=catalog',
    label: '产品',
    value: '目录',
    hint: '产品目录、产品资料与目录底座',
    icon: Boxes,
    tone: 'success',
  },
  {
    href: '/accounts',
    label: '账号权限',
    value: '权限',
    hint: '营销账号、角色权限与启停维护',
    icon: UsersRound,
    tone: 'neutral',
  },
];

const QUICK_LINKS = [
  { href: '/comfort/sites', label: '全部站点', icon: Globe2, primary: true },
  { href: '/brand', label: '品牌运营', icon: Megaphone, primary: false },
  { href: '/growth/geo', label: 'GEO', icon: Rocket, primary: false },
  { href: '/growth/materials', label: '营销物料', icon: FileText, primary: false },
  { href: '/products?module=catalog', label: '产品目录', icon: Boxes, primary: false },
  { href: '/accounts', label: '账号权限', icon: ShieldCheck, primary: false },
];

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
      <div>
        <h2 className="t-title-3">{title}</h2>
        {subtitle && <p style={{ marginTop: 2, fontSize: 13, color: 'var(--t-secondary)' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function ConsoleCard({ card }: { card: ConsoleCard }) {
  const Icon = card.icon;
  const toneStyle: Record<ConsoleCard['tone'], React.CSSProperties> = {
    brand: { background: 'var(--brand-50)', color: 'var(--brand)' },
    info: { background: 'rgba(37,99,235,0.10)', color: 'var(--info)' },
    success: { background: 'rgba(22,163,74,0.10)', color: 'var(--success)' },
    neutral: { background: 'rgba(99,102,106,0.10)', color: 'var(--t-secondary)' },
  };

  return (
    <a href={card.href} className="card-elevated surface-interactive" style={{ display: 'block', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--t-secondary)' }}>{card.label}</span>
        <span style={{ ...toneStyle[card.tone], borderRadius: 8, padding: 6, display: 'flex' }}><Icon size={14} /></span>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{card.value}</span>
      </div>
      <p style={{ marginTop: 6, fontSize: 12, color: 'var(--t-tertiary)', lineHeight: 1.5 }}>{card.hint}</p>
    </a>
  );
}

export default function Dashboard() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ display: 'grid', gap: 28 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--surface-1)', padding: '10px 16px',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--brand)',
            color: '#fff', borderRadius: 9999, padding: '2px 8px',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', flexShrink: 0,
          }}>
            <Megaphone size={10} /> 营销系统
          </span>
          <span style={{ fontSize: 13, color: 'var(--t-primary)', flex: 1 }}>{dateStr}</span>
          <span style={{ fontSize: 12, color: 'var(--t-tertiary)', flexShrink: 0 }}>瑞合瑞德 · 品牌官网与市场增长控制台</span>
        </div>

        <div className="split-main">
          <section>
            <SectionHeader title="营销控制台" subtitle="品牌官网 · 市场增长 · 产品 · 账号权限" />
            <div className="g4" style={{ gap: 12 }}>
              {CONSOLE_CARDS.map((card) => <ConsoleCard key={card.href} card={card} />)}
            </div>
          </section>

          <section>
            <SectionHeader title="快捷入口" subtitle="常用营销入口" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <a key={link.href} href={link.href} className="surface-interactive" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, minHeight: 72, padding: '14px 8px', borderRadius: 8,
                    background: link.primary ? 'var(--brand)' : 'var(--surface-2)',
                    border: link.primary ? '1px solid var(--brand)' : '1px solid var(--border)',
                    color: link.primary ? '#fff' : 'var(--t-primary)',
                    fontSize: 12, fontWeight: 600, textAlign: 'center' as const, lineHeight: 1.3,
                  }}>
                    <Icon size={14} style={{ opacity: link.primary ? 0.9 : 0.45 }} />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        <section>
          <SectionHeader title="运营路径" subtitle="从品牌官网内容到增长动作，再到产品资料和营销账号权限。" />
          <div className="card-elevated" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {CONSOLE_CARDS.map((card, index) => (
                <a key={card.href} href={card.href} className="surface-interactive" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--surface-1)', color: 'var(--t-primary)', textDecoration: 'none',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 12 }}>{String(index + 1).padStart(2, '0')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.label}</span>
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
