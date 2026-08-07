'use client';

import { Fragment } from 'react';
import { PageHeader } from '@rhautt/ui';
import { Target, Flag, Rocket, Route } from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--sh-card)', padding: 18 };

const POSITIONING = [
  { brand: 'RHEEM · EVERHOT', pos: '大户型选恒热 · 商用级大水量' },
  { brand: 'RUUD 瑞德', pos: '北美健康空调 · 商用采暖' },
];
const PLAYS = [
  { t: 'B 端驱动，专业立身', d: '强化瑞德宜居家与网点建设；数字化 + 产品内容营销，构建自媒体及 KOL 矩阵，垂直分类关键影响者推广，渠道战略合作，奠定专业口碑。' },
  { t: '价值锚定', d: '超长质保，树立高端价值标杆。' },
  { t: '差异化破局，精准制胜', d: '聚焦大宅 / 酒店 / 餐饮 / 康养；打造技术工程师赋能体系；通过混动热水器应用推广，驱动大宅机电渠道破局，构建专业赛道「隐形冠军」。' },
  { t: '专业切入', d: '设计院 / 行业 / 给排水等意见领袖，打造 B 端专业认知。' },
];
const CATEGORIES = ['商用热水', '中央热水', '采暖', '空调'];
const LANES = [
  {
    lane: '产品 / 渠道',
    phase1: ['战略市场：核心市场标杆，「产品出样·服务标准·营销动作」三统一', '渠道策略：自有渠道建设 100 家，开拓氟机/水机渠道热水分销', '传播策略：内容聚焦产品卖点与品牌传承，影响者精准渗透', '能力建设：技术服务组织专业能力，认证工程师覆盖核心市场'],
    phase2: ['产品进化：空调/采暖/热水/能源管理智能联动，构建「QUANTUM 智能舒适生态系统」', '品牌升级：将 RUUD 瑞德宜居家 打造为「高端全屋舒适系统」的代名词'],
  },
  {
    lane: '营销策略',
    phase1: ['战略市场：引进酒店高质量经销商，品牌入库 TOP50 酒店集团', '渠道策略：大宅机电 / 集采渠道深度开发', '样板打造：大宅热水切入，构建可复制的商业渠道模型', '能力建设：技术服务专项组织，技术选型标准，工程交付能力'],
    phase2: ['产品进化：推动可持续战略，70% 冷凝化 · 70% 热泵化 · 70% 智能化', '品牌升级：大宅渠道突破，复制至酒店 / 餐饮 / 科技住宅'],
  },
];

export default function StrategyRoadmapPage() {
  return (
    <div className="page-container">
      <PageHeader title="营销战略路线图 · Rhautt Group" subtitle="品牌定位 · 关键路径 · 2026–2030 里程碑 —— 全员对齐方向(源自品牌涡轮&营销战略路线图)" />

      {/* 里程碑 + 定位 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ ...card, borderLeft: '3px solid var(--brand)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Flag size={16} style={{ color: 'var(--brand)' }} /><span className="t-lg" style={{ fontWeight: 700 }}>里程碑目标</span></div>
          <div className="t-num" style={{ fontSize: 30, fontWeight: 800, color: 'var(--brand)', margin: '10px 0 4px' }}>2030 · 销售额 5 亿</div>
          <div className="t-sm" style={{ color: 'var(--t-secondary)' }}>成为受人尊重的热水解决方案可持续发展的引领者</div>
        </div>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><Target size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>品牌定位</span></div>
          {POSITIONING.map((p) => (
            <div key={p.brand} style={{ marginBottom: 8 }}>
              <div className="t-sm" style={{ fontWeight: 700, color: 'var(--brand)' }}>{p.brand}</div>
              <div className="t-xs" style={{ color: 'var(--t-secondary)' }}>{p.pos}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 关键路径打法 */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><Route size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>关键路径 · 战略打法</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {PLAYS.map((p, i) => (
            <div key={p.t} className="inset">
              <div className="t-sm" style={{ fontWeight: 700, color: 'var(--t-strong)' }}><span style={{ color: 'var(--brand)' }}>{i + 1}.</span> {p.t}</div>
              <p className="t-xs" style={{ color: 'var(--t-secondary)', lineHeight: 1.6, margin: '6px 0 0' }}>{p.d}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {CATEGORIES.map((c) => <span key={c} className="t-xs" style={{ background: 'var(--surface-2)', color: 'var(--t-secondary)', borderRadius: 999, padding: '4px 12px' }}>{c}</span>)}
        </div>
      </div>

      {/* 路线图矩阵：两泳道 × 两阶段 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px' }}><Rocket size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>路线图 · 两阶段推进</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12, alignItems: 'stretch' }}>
        <div />
        <div className="t-sm" style={{ fontWeight: 700, textAlign: 'center', color: 'var(--brand)', padding: '6px 0' }}>2026–2028 · 聚焦突破，打造样板</div>
        <div className="t-sm" style={{ fontWeight: 700, textAlign: 'center', color: 'var(--brand)', padding: '6px 0' }}>2029–2030 · 生态构建，品牌引领</div>
        {LANES.map((l) => (
          <Fragment key={l.lane}>
            <div className="t-sm" style={{ fontWeight: 700, color: 'var(--t-strong)', display: 'flex', alignItems: 'center' }}>{l.lane}</div>
            <div style={card}>
              <ul className="t-xs" style={{ color: 'var(--t-secondary)', lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>{l.phase1.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
            <div style={{ ...card, background: 'var(--surface-2)' }}>
              <ul className="t-xs" style={{ color: 'var(--t-secondary)', lineHeight: 1.7, margin: 0, paddingLeft: 16 }}>{l.phase2.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          </Fragment>
        ))}
      </div>

      <div style={{ ...card, marginTop: 16, borderLeft: '3px solid var(--brand)' }}>
        <div className="t-xs" style={{ color: 'var(--t-secondary)', lineHeight: 1.9 }}>
          <div><strong style={{ color: 'var(--brand)' }}>使命</strong>　以「创新高效低碳技术 + 数智化服务」为核，为每一个空间赋予更舒适、高效、可持续的生活环境</div>
          <div><strong style={{ color: 'var(--brand)' }}>愿景</strong>　成为受人尊重的水和空气产品及解决方案可持续发展的引领者</div>
          <div><strong style={{ color: 'var(--brand)' }}>价值观</strong>　客户满意 ┃ 股东满意 ┃ 社会满意 ┃ 员工满意</div>
        </div>
      </div>
    </div>
  );
}
