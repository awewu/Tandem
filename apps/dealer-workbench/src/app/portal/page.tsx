'use client';

import Link from 'next/link';
import { FolderOpen, Megaphone, Inbox, GraduationCap, ArrowRight } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-card)', padding: 20, textDecoration: 'none', display: 'block' };

// 经销商自助前台(B端赋能载体) —— 承接北极星副指标「经销商成交率」。
// 数据按 RBAC scope(dealerId)隔离；本页为 P1 脚手架,聚合既有能力入口 + 标注开放状态。
const SECTIONS = [
  { icon: <FolderOpen size={20} />, title: '营销物料库', desc: '按品牌/品类自助领取海报、单页、视频、话术等物料', href: '/growth/materials', live: true },
  { icon: <Megaphone size={20} />, title: '政策与返利', desc: '查看渠道政策、返利进度与到账；返利过毛利闸后可见', href: '/channel', live: true },
  { icon: <Inbox size={20} />, title: '我的线索', desc: 'GEO / 活动派发到本网点的高意向线索,认领与跟进', href: '/cockpit', live: false },
  { icon: <GraduationCap size={20} />, title: '培训与认证', desc: '产品/技术/安装认证课程与考试,认证等级联动返利资格', href: '/portal', live: false },
];

export default function DealerPortalPage() {
  return (
    <div className="page-container">
      <PageHeader title="经销商门户 · 自助赋能" subtitle="物料领取 · 政策返利 · 线索认领 · 培训认证 —— 一处直达,数据按网点隔离(RBAC scope)" />

      <div style={{ ...card, marginBottom: 16, borderLeft: '3px solid var(--brand)', cursor: 'default' }}>
        <div className="t-sm" style={{ color: 'var(--t-secondary)', lineHeight: 1.7 }}>
          欢迎回到经销商门户。这里聚合了你日常最需要的自助能力:一键领物料、查政策返利、认领线索、学产品与考认证。
          门户是「经销商赋能验证有效性」的载体 —— 你的动作与成交将回流总部驾驶舱,共同做大网络 GMV。
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {SECTIONS.map((s) => (
          <Link key={s.title} href={s.href} style={{ ...card, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand)', marginBottom: 10 }}>
              {s.icon}
              <span className="t-lg" style={{ fontWeight: 700, color: 'var(--t-strong)' }}>{s.title}</span>
              <span className="t-xs" style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 999, background: s.live ? 'rgba(16,185,129,0.10)' : 'var(--surface-2)', color: s.live ? 'var(--semantic-success, #16A34A)' : 'var(--t-tertiary)', fontWeight: 600 }}>{s.live ? '已开放' : '即将开放'}</span>
            </div>
            <p className="t-sm" style={{ color: 'var(--t-secondary)', lineHeight: 1.6, margin: '0 0 12px' }}>{s.desc}</p>
            <span className="t-xs" style={{ color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>进入 <ArrowRight size={13} /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
