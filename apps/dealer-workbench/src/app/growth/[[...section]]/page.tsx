import {
  ArrowRight,
  BarChart3,
  Bot,
  FileImage,
  FileSearch,
  FileText,
  FolderOpen,
  Gauge,
  PenTool,
  Radio,
  Search,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@rhautt/ui';

type GrowthSection = 'geo' | 'copywriter' | 'sentiment' | 'automation' | 'materials';

type SectionConfig = {
  title: string;
  subtitle: string;
  icon: typeof Search;
  primaryMetric: string;
  primaryLabel: string;
  status: string;
};

const SECTIONS: Record<GrowthSection, SectionConfig> = {
  geo: {
    title: 'GEO 可见度分析',
    subtitle: 'AI 搜索、品牌词、品类词与竞品露出监测',
    icon: Search,
    primaryMetric: '8',
    primaryLabel: '已监测 AI 搜索入口',
    status: '运行中',
  },
  copywriter: {
    title: '文案 Copilot',
    subtitle: '面向官网、投放、活动页的品牌一致性文案生成',
    icon: PenTool,
    primaryMetric: '24',
    primaryLabel: '本周生成候选文案',
    status: '待审核',
  },
  sentiment: {
    title: '舆情雷达',
    subtitle: '公开渠道声量、情绪与风险线索汇总',
    icon: Radio,
    primaryMetric: '92%',
    primaryLabel: '正向及中性声量',
    status: '低风险',
  },
  automation: {
    title: '营销自动化',
    subtitle: '线索触达、UTM 归因、活动节奏与 ROI 看板',
    icon: Zap,
    primaryMetric: '4',
    primaryLabel: '运行中的自动化流程',
    status: '配置中',
  },
  materials: {
    title: '营销物料库',
    subtitle: '官网专题、活动海报、朋友圈图文与培训资料统一取用',
    icon: FolderOpen,
    primaryMetric: '18',
    primaryLabel: '当前可用营销物料',
    status: '可下载',
  },
};

const OVERVIEW = [
  { label: 'GEO 分析', value: '8', hint: 'AI 引擎品牌可见度', icon: Search },
  { label: '文案 Copilot', value: '24', hint: '多平台候选文案', icon: PenTool },
  { label: '舆情雷达', value: '92%', hint: '正向及中性声量', icon: Radio },
  { label: '营销自动化', value: '4', hint: '触达流程运行中', icon: Zap },
];

const KEYWORDS = [
  { word: '瑞美热水系统', rank: 'A-', exposure: '76%', intent: '品牌词' },
  { word: '别墅五恒系统', rank: 'B+', exposure: '62%', intent: '品类词' },
  { word: '空气源热泵热水', rank: 'B', exposure: '58%', intent: '方案词' },
  { word: 'Rheem 商用热水', rank: 'A', exposure: '81%', intent: '商用词' },
];

const COPY_TASKS = [
  { title: '瑞美官网夏季热泵专题', channel: '官网专题', state: '待品牌审核' },
  { title: '经销商朋友圈活动短文案', channel: '私域触达', state: '可发布' },
  { title: '恒热 Everhot 商用案例标题', channel: '案例页', state: '需补证据' },
];

const SENTIMENT = [
  { source: '小红书 / 抖音', signal: '节能、省电、安装体验', tone: '正向' },
  { source: '搜索问答', signal: '维修响应、型号选型', tone: '中性' },
  { source: '公开投诉', signal: '交付周期个别延迟', tone: '关注' },
];

const AUTOMATIONS = [
  { name: '官网询盘 5 分钟内首触达', step: '短信 + 企微任务', conversion: '38%' },
  { name: '未报价客户 48 小时唤醒', step: '顾问提醒 + 资料包', conversion: '21%' },
  { name: '活动页报名后培育', step: '三段式内容触达', conversion: '44%' },
];

const MATERIALS = [
  {
    title: '夏季制冷专项返点活动包',
    type: '活动物料',
    brand: 'Rheem',
    format: '海报 / 朋友圈图',
    updatedAt: '07-18',
    status: '可下载',
    href: '/brand',
    icon: FileImage,
  },
  {
    title: 'Econet 全屋智控推广话术',
    type: '私域文案',
    brand: 'Rheem',
    format: '图文 / 顾问话术',
    updatedAt: '07-16',
    status: '可发布',
    href: '/brand',
    icon: FileText,
  },
  {
    title: '经销商产品认证培训资料',
    type: '培训资料',
    brand: 'Rhautt Comfort',
    format: '课件 / 产品页',
    updatedAt: '07-12',
    status: '需审核',
    href: '/products?module=materials',
    icon: FolderOpen,
  },
  {
    title: '恒热 Everhot 商用热水案例图包',
    type: '案例素材',
    brand: 'Everhot',
    format: '案例长图 / 产品图',
    updatedAt: '07-10',
    status: '可下载',
    href: '/comfort/sites/everhot',
    icon: FileImage,
  },
];

function sectionFromParams(section?: string[]): GrowthSection {
  const key = section?.[0];
  if (key === 'copywriter' || key === 'sentiment' || key === 'automation' || key === 'materials') return key;
  return 'geo';
}

export default async function GrowthWorkspacePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const activeKey = sectionFromParams(section);
  const active = SECTIONS[activeKey];
  const ActiveIcon = active.icon;

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title="市场营销"
          subtitle="GEO 可见度 · 文案 Copilot · 舆情雷达 · 营销自动化 · 营销物料库"
          actions={<span className="pill-brand">{active.status}</span>}
        />

        <section
          className="card-elevated"
          style={{
            padding: 22,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(240px, 300px)',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', minWidth: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--r-xl)', display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand-700)', flexShrink: 0 }}>
              <ActiveIcon size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="t-label">增长引擎</p>
              <h1 style={{ marginTop: 4, fontSize: 28, lineHeight: 1.18, letterSpacing: 0, color: 'var(--t-strong)' }}>{active.title}</h1>
              <p style={{ marginTop: 8, color: 'var(--t-secondary)', fontSize: 14 }}>{active.subtitle}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <span className="pill-brand">稳供品牌证据</span>
                <span className="pill-neutral">准入官网发布</span>
                <span className="pill-neutral">通达私域触达</span>
                <span className="pill-neutral">原生物料取用</span>
              </div>
            </div>
          </div>
          <div className="inset" style={{ display: 'grid', alignContent: 'center', gap: 6 }}>
            <div className="t-label">{active.primaryLabel}</div>
            <div style={{ fontSize: 38, lineHeight: 1, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{active.primaryMetric}</div>
            <p style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>5000 原生营销工作台，不再内嵌 5010 页面。</p>
          </div>
        </section>

        <section className="g4" style={{ gap: 12 }}>
          {OVERVIEW.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="card-elevated" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span className="t-label">{item.label}</span>
                  <Icon size={16} style={{ color: 'var(--brand)' }} />
                </div>
                <div style={{ marginTop: 8, fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                <p style={{ marginTop: 4, color: 'var(--t-tertiary)', fontSize: 12 }}>{item.hint}</p>
              </div>
            );
          })}
        </section>

        <section className="split-main">
          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
            <NativePanel activeKey={activeKey} />
          </div>
          <aside style={{ display: 'grid', gap: 16 }}>
            <div className="card-elevated" style={{ padding: 16 }}>
              <p className="t-label">本周推进</p>
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {[
                  { label: 'GEO 引擎检测', value: '已同步 8 个入口', icon: FileSearch },
                  { label: '品牌审核', value: '3 条文案待确认', icon: Bot },
                  { label: '物料发布', value: '18 项资源可取用', icon: FolderOpen },
                  { label: '活动归因', value: 'UTM 参数待补齐', icon: Gauge },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="inset" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon size={16} style={{ color: 'var(--brand)' }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-primary)' }}>{item.label}</p>
                        <p style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card-elevated" style={{ padding: 16 }}>
              <p className="t-label">发布队列</p>
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {['官网专题页', '朋友圈短文案', '经销商活动海报', '认证培训资料'].map((item) => (
                  <div key={item} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--t-primary)' }}>{item}</span>
                    <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>待审</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function NativePanel({ activeKey }: { activeKey: GrowthSection }) {
  if (activeKey === 'copywriter') {
    return (
      <div className="card-elevated" style={{ padding: 18 }}>
        <PanelTitle icon={PenTool} title="文案 Copilot 工作区" desc="生成、审校并沉淀符合品牌语气的官网与私域文案。" />
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {COPY_TASKS.map((item) => (
            <div key={item.title} className="inset" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 100px', gap: 12, alignItems: 'center' }}>
              <strong style={{ fontSize: 14, color: 'var(--t-primary)' }}>{item.title}</strong>
              <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>{item.channel}</span>
              <span className={item.state === '可发布' ? 'badge badge-success' : 'badge badge-warning'}>{item.state}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeKey === 'sentiment') {
    return (
      <div className="card-elevated" style={{ padding: 18 }}>
        <PanelTitle icon={Radio} title="舆情雷达" desc="跟踪公开渠道声量，给品牌和销售团队提供风险提示。" />
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table className="table">
            <thead><tr><th>渠道</th><th>主要信号</th><th>情绪</th></tr></thead>
            <tbody>
              {SENTIMENT.map((item) => (
                <tr key={item.source}><td>{item.source}</td><td>{item.signal}</td><td><span className={item.tone === '关注' ? 'badge badge-warning' : 'badge badge-success'}>{item.tone}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeKey === 'automation') {
    return (
      <div className="card-elevated" style={{ padding: 18 }}>
        <PanelTitle icon={Zap} title="营销自动化" desc="把官网线索、顾问任务和内容触达串成可追踪流程。" />
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {AUTOMATIONS.map((item) => (
            <div key={item.name} className="inset" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 160px 80px', gap: 12, alignItems: 'center' }}>
              <strong style={{ fontSize: 14, color: 'var(--t-primary)' }}>{item.name}</strong>
              <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>{item.step}</span>
              <span className="pill-brand">{item.conversion}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeKey === 'materials') {
    return (
      <div className="card-elevated" style={{ padding: 18 }}>
        <PanelTitle icon={FolderOpen} title="营销物料库" desc="在当前工作台内原生展示可下载、可发布、待审核的市场物料，不使用 iframe 嵌入外部页面。" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
          {MATERIALS.map((item) => {
            const Icon = item.icon;
            const statusClass = item.status === '需审核' ? 'badge badge-warning' : 'badge badge-success';
            return (
              <article key={item.title} className="inset" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 'var(--r-lg)', display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand-700)', flexShrink: 0 }}>
                      <Icon size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span className="t-label">{item.type}</span>
                      <h3 style={{ marginTop: 4, fontSize: 14, lineHeight: 1.35, fontWeight: 700, color: 'var(--t-primary)' }}>{item.title}</h3>
                    </div>
                  </div>
                  <span className={statusClass}>{item.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Meta label="品牌" value={item.brand} />
                  <Meta label="格式" value={item.format} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>更新 {item.updatedAt}</span>
                  <a href={item.href} className="btn btn-outline btn-sm" aria-label={`查看${item.title}`}>
                    查看资源
                    <ArrowRight size={13} />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated" style={{ padding: 18 }}>
      <PanelTitle icon={BarChart3} title="GEO 可见度分析" desc="监测 AI 搜索入口中的品牌露出、答案引用和品类词排名。" />
      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table className="table">
          <thead><tr><th>关键词</th><th>意图</th><th>等级</th><th>露出率</th></tr></thead>
          <tbody>
            {KEYWORDS.map((item) => (
              <tr key={item.word}>
                <td style={{ fontWeight: 700 }}>{item.word}</td>
                <td>{item.intent}</td>
                <td><span className="pill-brand">{item.rank}</span></td>
                <td>{item.exposure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="t-label" style={{ marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--t-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, desc }: { icon: typeof Search; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
      <div>
        <p className="t-label">原生 VI 页面</p>
        <h2 className="t-headline" style={{ marginTop: 4 }}>{title}</h2>
        <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>{desc}</p>
      </div>
      <div style={{ width: 38, height: 38, borderRadius: 'var(--r-lg)', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--brand)' }}>
        <Icon size={18} />
      </div>
    </div>
  );
}
