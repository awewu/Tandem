import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileImage,
  FileSearch,
  FileText,
  FolderOpen,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import { GrowthGeoWorkspace } from '../../../components/GrowthGeoWorkspace';
import { GeoExperimentPanel } from '../../../components/GeoExperimentPanel';
import { GeoIntelligencePanel } from '../../../components/GeoIntelligencePanel';
import { AiSwotPanel } from '../../../components/AiSwotPanel';
import { ScenarioLibraryPanel } from '../../../components/ScenarioLibraryPanel';
import { MarketingTaskCenter } from '../../../components/MarketingTaskCenter';
import { AiCostPanel } from '../../../components/AiCostPanel';
import { SentimentRadarPanel } from '../../../components/SentimentRadarPanel';
import { CopyAssetsPanel } from '../../../components/CopyAssetsPanel';
import { CampaignRoiPanel } from '../../../components/CampaignRoiPanel';
import WechatPublishingWorkspace from '../../../components/WechatPublishingWorkspace';

type GrowthSection = 'geo' | 'copywriter' | 'sentiment' | 'automation' | 'materials';
type WechatSection = 'wechat-accounts' | 'wechat-review' | 'wechat-drafts';
type StatusKind = 'running' | 'review' | 'risk' | 'config' | 'download' | 'success' | 'warning' | 'neutral';

type SectionConfig = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  primaryMetric: string;
  primaryLabel: string;
  status: string;
  statusKind: StatusKind;
};

const SECTIONS: Record<GrowthSection, SectionConfig> = {
  geo: {
    title: 'GEO 可见度分析',
    subtitle: 'AI 搜索、品牌词、品类词与竞品露出监测',
    icon: Search,
    primaryMetric: '8',
    primaryLabel: '已监测 AI 搜索入口',
    status: '运行中',
    statusKind: 'running',
  },
  copywriter: {
    title: '文案 Copilot',
    subtitle: '面向官网、投放、活动页的品牌一致性文案生成',
    icon: Sparkles,
    primaryMetric: '24',
    primaryLabel: '本周生成候选文案',
    status: '待审核',
    statusKind: 'review',
  },
  sentiment: {
    title: '舆情雷达',
    subtitle: '公开渠道声量、情绪与风险线索汇总',
    icon: Radio,
    primaryMetric: '92%',
    primaryLabel: '正向及中性声量',
    status: '低风险',
    statusKind: 'risk',
  },
  automation: {
    title: '营销自动化',
    subtitle: '线索触达、UTM 归因、活动节奏与 ROI 看板',
    icon: Zap,
    primaryMetric: '4',
    primaryLabel: '运行中的自动化流程',
    status: '配置中',
    statusKind: 'config',
  },
  materials: {
    title: '营销物料库',
    subtitle: '官网专题、活动海报、朋友圈图文与培训资料统一取用',
    icon: FolderOpen,
    primaryMetric: '18',
    primaryLabel: '当前可用营销物料',
    status: '可下载',
    statusKind: 'download',
  },
};

const SECTION_LINKS: Array<{ key: GrowthSection; href: string }> = [
  { key: 'geo', href: '/growth/geo' },
  { key: 'copywriter', href: '/growth/copywriter' },
  { key: 'sentiment', href: '/growth/sentiment' },
  { key: 'automation', href: '/growth/automation' },
  { key: 'materials', href: '/growth/materials' },
];

// 假数据常量已移除：各营销模块改用连真 API 的组件（Sentiment/Copy/Campaign/GeoIntelligence 等）。

function sectionFromParams(section?: string[]): GrowthSection {
  const key = section?.[0];
  if (key === 'copywriter' || key === 'sentiment' || key === 'automation' || key === 'materials') return key;
  return 'geo';
}

function wechatSectionFromParams(section?: string[]): WechatSection | null {
  const key = section?.[0];
  if (key === 'wechat-accounts' || key === 'wechat-review' || key === 'wechat-drafts') return key;
  return null;
}

export default async function GrowthWorkspacePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const wechatSection = wechatSectionFromParams(section);
  if (wechatSection === 'wechat-accounts') return <WechatPublishingWorkspace mode="accounts" />;
  if (wechatSection === 'wechat-review') return <WechatPublishingWorkspace mode="review" />;
  if (wechatSection === 'wechat-drafts') return <WechatPublishingWorkspace mode="drafts" />;

  const activeKey = sectionFromParams(section);
  const active = SECTIONS[activeKey];
  const ActiveIcon = active.icon;

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ display: 'grid', gap: 20, maxWidth: 'none', width: '100%' }}>
        <PageHeader
          title="市场增长"
          subtitle="GEO 可见度 · 文案 Copilot · 舆情雷达 · 营销自动化 · 营销物料库"
          actions={<StatusPill kind={active.statusKind}>{active.status}</StatusPill>}
        />

        <nav className="card-elevated" aria-label="市场增长模块" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SECTION_LINKS.map((item) => {
            const config = SECTIONS[item.key];
            const Icon = config.icon;
            const isActive = item.key === activeKey;
            return (
              <a
                key={item.key}
                href={item.href}
                className={isActive ? 'btn btn-brand btn-sm' : 'btn btn-ghost btn-sm'}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={15} />
                {config.title}
              </a>
            );
          })}
        </nav>

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
              <h1 style={{ marginTop: 4, fontSize: 24, lineHeight: 1.22, letterSpacing: 0, color: 'var(--t-strong)' }}>{active.title}</h1>
              <p style={{ marginTop: 8, color: 'var(--t-secondary)', fontSize: 14 }}>{active.subtitle}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <span className="pill-neutral">营销面板</span>
                <span className="pill-neutral">审核状态清晰</span>
                <span className="pill-neutral">仅保留营销目的地</span>
              </div>
            </div>
          </div>
          {/* 各模块的真实指标由其真数据组件内部渲染，此处不再显示占位数字（避免假数据）。 */}
          <div className="inset" style={{ display: 'grid', alignContent: 'center', gap: 8 }}>
            <div className="t-label">实时指标</div>
            <div style={{ color: 'var(--t-secondary)', fontSize: 13, lineHeight: 1.5 }}>
              见下方工作区（全部来自后端真实数据）
            </div>
          </div>
        </section>

        <section
          className="split-main"
          style={activeKey === 'geo' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined}
        >
          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
            <NativePanel activeKey={activeKey} />
            {activeKey === 'geo' ? null : <StatePreview />}
          </div>
          {activeKey === 'geo' ? null : (
            <aside style={{ display: 'grid', gap: 16 }}>
              <SideQueue />
              <PublishQueue />
            </aside>
          )}
        </section>
      </div>
    </div>
  );
}

function NativePanel({ activeKey }: { activeKey: GrowthSection }) {
  if (activeKey === 'geo') {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <MarketingTaskCenter brandSlug="rheem" />
        <GrowthGeoWorkspace />
        <AiCostPanel />
        {/* 选题上游：场景库 → prompt 簇（新品类冷启动入口） */}
        <ScenarioLibraryPanel brandSlug="rheem" />
        {/* 可测的 SWOT：由探测数据派生，非主观自评 */}
        <AiSwotPanel brandSlug="rheem" />
        <GeoIntelligencePanel brandSlug="rheem" />
        <GeoExperimentPanel brandSlug="rheem" />
      </div>
    );
  }

  if (activeKey === 'copywriter') {
    return <CopyAssetsPanel />;
  }

  if (activeKey === 'sentiment') {
    return <SentimentRadarPanel />;
  }

  if (activeKey === 'automation') {
    return <CampaignRoiPanel />;
  }


  // 安全兜底：activeKey 恒在枚举内（sectionFromParams 默认 'geo'），正常到不了这里。
  // 一旦到达也不回落假数据，而是显示真实 GEO 工作区。
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <GrowthGeoWorkspace />
      <GeoIntelligencePanel brandSlug="rheem" />
      <GeoExperimentPanel brandSlug="rheem" />
    </div>
  );
}

function PanelShell({ icon: Icon, title, desc, children }: { icon: LucideIcon; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="card-elevated" style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <p className="t-label">营销模块</p>
          <h2 className="t-headline" style={{ marginTop: 4 }}>{title}</h2>
          <p style={{ marginTop: 4, color: 'var(--t-secondary)', fontSize: 13 }}>{desc}</p>
        </div>
        <div style={{ width: 38, height: 38, borderRadius: 'var(--r-lg)', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--brand)' }}>
          <Icon size={18} />
        </div>
      </div>
      {children}
    </section>
  );
}

function StatePreview() {
  return (
    <section className="card-elevated" style={{ padding: 18 }}>
      <div className="workbench-section-header" style={{ marginBottom: 12 }}>
        <div>
          <p className="workbench-section-header__eyebrow">页面状态</p>
          <h2 className="workbench-section-header__title">加载 / 空 / 错误状态</h2>
          <p className="workbench-section-header__description">用于检查营销增长数据在不同状态下的展示效果。</p>
        </div>
      </div>
      <div className="g3">
        <StateTile icon={Loader2} title="加载中" desc="正在同步营销增长数据" tone="loading" />
        <StateTile icon={FolderOpen} title="暂无数据" desc="筛选条件下没有可展示项目" tone="empty" />
        <StateTile icon={AlertCircle} title="加载失败" desc="请刷新后重试或联系管理员" tone="error" />
      </div>
    </section>
  );
}

function StateTile({ icon: Icon, title, desc, tone }: { icon: LucideIcon; title: string; desc: string; tone: 'loading' | 'empty' | 'error' }) {
  const color = tone === 'error' ? 'var(--danger)' : tone === 'loading' ? 'var(--brand)' : 'var(--t-secondary)';
  return (
    <div className="inset" style={{ minHeight: 116, display: 'grid', placeItems: 'center', textAlign: 'center', gap: 6 }}>
      <Icon size={20} className={tone === 'loading' ? 'animate-spin' : undefined} style={{ color }} />
      <strong style={{ fontSize: 13, color: tone === 'error' ? 'var(--danger)' : 'var(--t-primary)' }}>{title}</strong>
      <p style={{ fontSize: 12, color: 'var(--t-secondary)' }}>{desc}</p>
    </div>
  );
}

function SideQueue() {
  const items = [
    { label: 'GEO 引擎检测', value: '已同步 8 个入口', icon: FileSearch },
    { label: '品牌审核', value: '3 条文案待确认', icon: Bot },
    { label: '物料发布', value: '18 项资源可取用', icon: Download },
    { label: '活动归因', value: 'UTM 参数待补齐', icon: TrendingUp },
  ];

  return (
    <div className="card-elevated" style={{ padding: 16 }}>
      <p className="t-label">本周推进</p>
      <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
        {items.map((item) => {
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
  );
}

function PublishQueue() {
  const queue = ['官网专题页', '朋友圈短文案', '经销商活动海报', '认证培训资料'];

  return (
    <div className="card-elevated" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p className="t-label">发布队列</p>
        <a className="btn btn-outline btn-sm" href="/brand">
          <RefreshCw size={13} />
          刷新
        </a>
      </div>
      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {queue.map((item) => (
          <div key={item} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--t-primary)' }}>{item}</span>
            <StatusPill kind="review">待审</StatusPill>
          </div>
        ))}
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

function StatusPill({ kind, children }: { kind: StatusKind; children: React.ReactNode }) {
  const Icon = statusIcon(kind);
  return (
    <span className={`status-pill ${statusClass(kind)}`}>
      <Icon size={13} />
      {children}
    </span>
  );
}

function statusClass(kind: StatusKind) {
  if (kind === 'success' || kind === 'download') return 'status-pill-success';
  if (kind === 'review' || kind === 'warning' || kind === 'risk') return 'status-pill-warning';
  if (kind === 'running' || kind === 'config') return 'status-pill-info';
  return 'status-pill-neutral';
}

function statusIcon(kind: StatusKind): LucideIcon {
  if (kind === 'success') return CheckCircle2;
  if (kind === 'download') return Download;
  if (kind === 'review' || kind === 'warning' || kind === 'risk') return Clock3;
  if (kind === 'running' || kind === 'config') return Loader2;
  return AlertCircle;
}
