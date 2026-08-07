'use client';

import { FolderOpen, Megaphone, Inbox, GraduationCap, HardHat } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-card)', padding: 20 };

// 经销商门户 —— 端口预留(Under Construction)。数据将按 RBAC scope(dealerId)隔离。
// 承接北极星副指标「经销商成交率」;规划中的四大自助能力见下方预览。
const PLANNED = [
  { icon: <FolderOpen size={18} />, title: '营销物料库', desc: '按品牌/品类自助领取海报、单页、视频、话术' },
  { icon: <Megaphone size={18} />, title: '政策与返利', desc: '渠道政策、返利进度与到账查询(过毛利闸后可见)' },
  { icon: <Inbox size={18} />, title: '我的线索', desc: 'GEO/活动派发到本网点的高意向线索,认领与跟进' },
  { icon: <GraduationCap size={18} />, title: '培训与认证', desc: '产品/技术/安装认证,认证等级联动返利资格' },
];

export default function DealerPortalPage() {
  return (
    <div className="page-container">
      <PageHeader title="经销商门户 · 自助赋能" subtitle="B端赋能自助前台 —— 承接北极星副指标「经销商成交率」" />

      <div style={{ ...card, textAlign: 'center', padding: 40, marginBottom: 16, borderStyle: 'dashed', borderColor: 'var(--brand)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--brand)', marginBottom: 12 }}>
          <HardHat size={26} />
        </div>
        <div className="t-lg" style={{ fontWeight: 800, color: 'var(--t-strong)' }}>门户建设中 · Under Construction</div>
        <p className="t-sm" style={{ color: 'var(--t-secondary)', maxWidth: 560, margin: '10px auto 0', lineHeight: 1.7 }}>
          经销商自助门户入口已预留。将开放:物料领取、政策返利查询、线索认领、培训认证 —— 数据按网点(RBAC scope)隔离,动作与成交回流总部驾驶舱。敬请期待。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {PLANNED.map((s) => (
          <div key={s.title} style={{ ...card, opacity: 0.72 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--brand)' }}>{s.icon}</span>
              <span className="t-sm" style={{ fontWeight: 700, color: 'var(--t-strong)' }}>{s.title}</span>
              <span className="t-xs" style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--t-tertiary)', fontWeight: 600 }}>规划中</span>
            </div>
            <p className="t-xs" style={{ color: 'var(--t-secondary)', lineHeight: 1.6, margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
