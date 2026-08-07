'use client';

import { PageHeader } from '@rhautt/ui';
import { Flame, Wind, Droplet, Cpu, Building2 } from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-card)', padding: 20 };
const BRANDS = [
  { code: 'Rheem', cn: '瑞美', desc: '美国百年供暖与热水领导者' },
  { code: 'RUUD', cn: '瑞德', desc: '北美健康空调 · 大宅舒适' },
  { code: 'EVERHOT', cn: '恒热', desc: '大户型热水 · 商用级大水量' },
  { code: 'RYSNOVA', cn: '瑞诺瓦', desc: '经销商赋能软件与数智化' },
];
const PILLARS = [
  { icon: <Flame size={18} />, v: '70%', k: '产品冷凝化', d: '高效冷凝技术迭代' },
  { icon: <Wind size={18} />, v: '70%', k: '产品热泵化', d: '低碳热泵节能' },
  { icon: <Cpu size={18} />, v: '70%', k: '智能控制', d: '搭载智能控制系统' },
];
const SCENES = [
  { icon: <Droplet size={16} />, t: '舒适热水采暖' },
  { icon: <Wind size={16} />, t: '健康空调' },
  { icon: <Droplet size={16} />, t: '全屋净水' },
  { icon: <Cpu size={16} />, t: '智能控制' },
];

export default function StrategyOverviewPage() {
  return (
    <div className="page-container">
      <PageHeader title="集团战略概览 · 瑞合瑞德集团 Rhautt Group" subtitle="三十载辉煌历程 · 全球暖通舒适家居领导者 —— 战略方向对齐(源自品牌涡轮&营销战略路线图)" />

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Building2 size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>关于我们</span></div>
        <p className="t-sm" style={{ color: 'var(--t-secondary)', lineHeight: 1.8, margin: 0 }}>
          瑞合瑞德集团（Rhautt Group）前身为全球供暖与热水领域百年领导者——美国瑞美（Rheem）集团于 1994 年在中国设立的独资公司。
          长期为家用、商用及工业领域提供高效稳定的热水、采暖、净水及空调系统解决方案，以卓越技术创新与产品可靠性享誉国际市场。
          我们打造覆盖<strong>舒适热水采暖 · 健康空调 · 全屋净水 · 智能控制</strong>的一站式全场景人居解决方案，
          搭建从研发、智造、渠道销售到全周期运维的完整产业链闭环。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
        {BRANDS.map((b) => (
          <div key={b.code} style={card}>
            <div className="t-lg" style={{ fontWeight: 700, color: 'var(--brand)' }}>{b.code} <span style={{ color: 'var(--t-strong)' }}>{b.cn}</span></div>
            <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 6 }}>{b.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div className="t-lg" style={{ fontWeight: 600, marginBottom: 4 }}>可持续发展三大技术支柱</div>
        <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginBottom: 16 }}>以低碳高效技术迭代驱动产业升级</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {PILLARS.map((p) => (
            <div key={p.k} className="inset" style={{ textAlign: 'center', padding: 18 }}>
              <div style={{ color: 'var(--brand)', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{p.icon}</div>
              <div className="t-num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--brand)', lineHeight: 1 }}>{p.v}</div>
              <div className="t-sm" style={{ fontWeight: 700, color: 'var(--t-strong)', marginTop: 8 }}>{p.k}</div>
              <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 4 }}>{p.d}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {SCENES.map((s) => (
            <span key={s.t} className="t-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', color: 'var(--t-secondary)', borderRadius: 999, padding: '6px 12px' }}>{s.icon}{s.t}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={{ ...card, borderLeft: '3px solid var(--brand)' }}>
          <div className="t-sm" style={{ fontWeight: 700, color: 'var(--brand)' }}>我们的使命</div>
          <p className="t-sm" style={{ color: 'var(--t-secondary)', lineHeight: 1.7, margin: '8px 0 0' }}>以创新高效的低碳技术与数智化服务为核心，为每一个空间赋予更舒适、高效、可持续的生活环境。</p>
        </div>
        <div style={{ ...card, borderLeft: '3px solid var(--brand)' }}>
          <div className="t-sm" style={{ fontWeight: 700, color: 'var(--brand)' }}>我们的愿景</div>
          <p className="t-sm" style={{ color: 'var(--t-secondary)', lineHeight: 1.7, margin: '8px 0 0' }}>成为受人尊重的水和空气产品及解决方案可持续发展的引领者。</p>
        </div>
        <div style={{ ...card, borderLeft: '3px solid var(--brand)' }}>
          <div className="t-sm" style={{ fontWeight: 700, color: 'var(--brand)' }}>我们的价值观</div>
          <p className="t-sm" style={{ color: 'var(--t-secondary)', lineHeight: 1.7, margin: '8px 0 0' }}>客户满意 ┃ 股东满意 ┃ 社会满意 ┃ 员工满意</p>
        </div>
      </div>
    </div>
  );
}
