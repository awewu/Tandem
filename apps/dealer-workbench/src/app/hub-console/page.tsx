'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Boxes,
  ChevronRight,
  CircleDot,
  Database,
  Megaphone,
  MonitorCog,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { WORKBENCH_PORTS } from '../../lib/workbench-navigation';

type ConsoleChild = {
  key: string;
  label: string;
  path: string;
};

type ConsoleModule = {
  key: string;
  label: string;
  desc: string;
  port: number;
  path: string;
  icon: LucideIcon;
  children: ConsoleChild[];
};

type ConsoleCluster = {
  key: string;
  label: string;
  shortLabel: string;
  desc: string;
  icon: LucideIcon;
  modules: ConsoleModule[];
};

const HOST = 'http://nexus.rhautt.com';

const CLUSTERS: ConsoleCluster[] = [
  {
    key: 'brand',
    label: '组团一 · 品牌厂家功能组',
    shortLabel: '品牌',
    desc: '品牌 · 市场营销 · 产品 · 官网 · 市场中枢',
    icon: Megaphone,
    modules: [
      {
        key: 'brand-console',
        label: '品牌运营控制台',
        desc: '品牌内容 · 产品定位 · 素材与发布',
        port: WORKBENCH_PORTS.dealer,
        path: '/brand',
        icon: MonitorCog,
        children: [
          { key: 'positioning', label: '产品定位', path: '/brand' },
          { key: 'dam', label: 'DAM / 素材库', path: '/brand' },
          { key: 'content-assets', label: '内容资产', path: '/brand' },
          { key: 'publish', label: '发布到站点', path: '/brand' },
        ],
      },
      {
        key: 'growth',
        label: '市场营销 · 增长引擎',
        desc: 'GEO 可见度 · 文案 · 舆情 · 营销自动化',
        port: WORKBENCH_PORTS.dealer,
        path: '/growth',
        icon: Rocket,
        children: [
          { key: 'geo', label: 'GEO 可见度', path: '/growth/geo' },
          { key: 'copywriter', label: '文案 Copilot', path: '/growth/copywriter' },
          { key: 'sentiment', label: '舆情雷达', path: '/growth/sentiment' },
          { key: 'automation', label: '营销自动化', path: '/growth/automation' },
        ],
      },
      {
        key: 'product',
        label: '产品',
        desc: '产品库 · 产品资料管理 · 产品目录底座',
        port: WORKBENCH_PORTS.dealer,
        path: '/products',
        icon: Boxes,
        children: [
          { key: 'product-list', label: '产品库 / 产品目录', path: '/products?module=catalog' },
          { key: 'product-materials', label: '产品资料管理', path: '/products?module=materials' },
          { key: 'product-base', label: '产品目录底座', path: '/products?module=base' },
        ],
      },
      {
        key: 'public',
        label: '品牌官网管理',
        desc: '集团官网与子品牌官网主数据、Logo、交付地址 CRUD',
        port: WORKBENCH_PORTS.dealer,
        path: '/comfort/sites',
        icon: Database,
        children: [
          { key: 'sites', label: '全部官网 CRUD', path: '/comfort/sites' },
          { key: 'site-rheem', label: '瑞美 Rheem 官网', path: '/comfort/sites/rheem' },
          { key: 'site-ruud', label: '瑞德 Ruud 官网', path: '/comfort/sites/ruud' },
          { key: 'site-everhot', label: '恒热 Everhot 官网', path: '/comfort/sites/everhot' },
        ],
      },
      {
        key: 'comfort',
        label: '品牌与市场中枢',
        desc: '网站 · 物料 · 品牌产品库 · 上新发布',
        port: WORKBENCH_PORTS.dealer,
        path: '/comfort',
        icon: Database,
        children: [
          { key: 'sites', label: '品牌官网管理', path: '/comfort/sites' },
          { key: 'site-rheem', label: '瑞美 Rheem 官网', path: '/comfort/sites/rheem' },
          { key: 'site-ruud', label: '瑞德 Ruud 官网', path: '/comfort/sites/ruud' },
          { key: 'site-everhot', label: '恒热 Everhot 官网', path: '/comfort/sites/everhot' },
          { key: 'content-assets', label: '内容资产', path: '/comfort/dam' },
          { key: 'market-materials', label: '市场物料', path: '/comfort/dam' },
          { key: 'brand-catalog', label: '品牌产品库', path: '/comfort/catalog' },
          { key: 'release', label: '上新 / 发布', path: '/comfort/publish' },
        ],
      },
    ],
  },
  {
    key: 'accounts',
    label: '账号管理',
    shortLabel: '账号',
    desc: '账号 · 角色权限 · 启停 · 密码重置',
    icon: Users,
    modules: [
      {
        key: 'accounts',
        label: '账号管理',
        desc: '后台开户 · 角色权限 · 停用启用 · 重置密码',
        port: WORKBENCH_PORTS.dealer,
        path: '/accounts',
        icon: ShieldCheck,
        children: [
          { key: 'list', label: '账号列表', path: '/accounts' },
          { key: 'role-assignment', label: '角色分配', path: '/accounts' },
        ],
      },
    ],
  },
];

function targetUrl(module: ConsoleModule, child?: ConsoleChild) {
  return `${HOST}:${module.port}${child?.path ?? module.path}`;
}

export default function HubConsolePage() {
  const [moduleKey, setModuleKey] = useState(CLUSTERS[0].modules[0].key);
  const [childKey, setChildKey] = useState(CLUSTERS[0].modules[0].children[0].key);

  const moduleEntries = useMemo(
    () =>
      CLUSTERS.flatMap((cluster) =>
        cluster.modules.map((module) => ({
          cluster,
          module,
        }))
      ),
    []
  );
  const activeEntry = useMemo(
    () => moduleEntries.find((entry) => entry.module.key === moduleKey) ?? moduleEntries[0],
    [moduleEntries, moduleKey]
  );
  const activeCluster = activeEntry.cluster;
  const activeModule = activeEntry.module;
  const activeChild = useMemo(
    () => activeModule.children.find((child) => child.key === childKey) ?? activeModule.children[0],
    [activeModule, childKey]
  );

  function selectModule(next: ConsoleModule) {
    setModuleKey(next.key);
    setChildKey(next.children[0].key);
  }

  const activeUrl = targetUrl(activeModule, activeChild);
  const ActiveIcon = activeModule.icon;

  return (
    <div style={S.shell}>
      <aside style={S.rail}>
        <div style={S.railHeader}>
          <div style={S.logoMark}>
            <img src="/images/rysnova-logo.jpg" alt="Rysnova" style={S.logoImage} />
          </div>
          <div>
            <div style={S.railBrand}>Rhautt Nexus</div>
            <div style={S.railSub}>父菜单</div>
          </div>
        </div>
        <nav style={S.railNav} aria-label="控制台父菜单">
          {CLUSTERS.map((cluster) => {
            return (
              <div key={cluster.key} style={S.railGroup}>
                <div style={S.railGroupLabel}>{cluster.shortLabel}</div>
                {cluster.modules.map((module) => {
                  const Icon = module.icon;
                  const active = module.key === activeModule.key;
                  return (
                    <button
                      key={module.key}
                      type="button"
                      title={module.label}
                      aria-label={module.label}
                      onClick={() => selectModule(module)}
                      style={{ ...S.railButton, ...(active ? S.railButtonActive : null) }}
                    >
                      <Icon size={17} strokeWidth={active ? 2.4 : 1.9} />
                      <span style={S.railText}>{module.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <aside style={S.menu}>
        <div style={S.menuHeader}>
          <p style={S.kicker}>Rhautt Nexus</p>
          <h1 style={S.menuTitle}>{activeModule.label}</h1>
          <p style={S.menuDesc}>子菜单 · 目标页暂不内嵌</p>
        </div>

        <div style={S.clusterBlock}>
          <div style={S.clusterTitle}>{activeCluster.label}</div>
          <div style={S.clusterDesc}>{activeCluster.desc}</div>
        </div>

        <div style={S.subMenuBlock}>
          <div style={S.subMenuLabel}>子菜单</div>
          <div style={S.childList}>
            {activeModule.children.map((child) => {
              const selected = child.key === activeChild.key;
              return (
                <button
                  type="button"
                  key={child.key}
                  onClick={() => setChildKey(child.key)}
                  style={{ ...S.childButton, ...(selected ? S.childButtonActive : null) }}
                >
                  <CircleDot size={11} style={{ opacity: selected ? 1 : 0.32 }} />
                  <span>{child.label}</span>
                  {selected && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main style={S.canvas}>
        <header style={S.canvasHeader}>
          <div style={S.canvasTitleWrap}>
            <span style={S.canvasIcon}><ActiveIcon size={20} /></span>
            <div>
              <p style={S.canvasKicker}>{activeCluster.label}</p>
              <h2 style={S.canvasTitle}>{activeModule.label}</h2>
            </div>
          </div>
          <div style={S.statusPill}>框架预览</div>
        </header>

        <section style={S.focusPanel}>
          <div>
            <p style={S.sectionLabel}>当前子菜单</p>
            <div style={S.focusTitle}>{activeChild.label}</div>
            <p style={S.focusDesc}>{activeModule.desc}</p>
          </div>
          <div style={S.urlBlock}>
            <span style={S.urlLabel}>目标地址</span>
            <code style={S.urlText}>{activeUrl}</code>
          </div>
        </section>

        <section style={S.archGrid}>
          <div style={S.archColumn}>
            <p style={S.sectionLabel}>一级组团</p>
            <div style={S.archNodeStrong}>{activeCluster.label}</div>
            <div style={S.archHint}>{activeCluster.desc}</div>
          </div>
          <div style={S.connector} />
          <div style={S.archColumn}>
            <p style={S.sectionLabel}>父菜单</p>
            <div style={S.archNodeStrong}>{activeModule.label}</div>
            <div style={S.archHint}>:{activeModule.port}{activeModule.path}</div>
          </div>
          <div style={S.connector} />
          <div style={S.archColumn}>
            <p style={S.sectionLabel}>子菜单</p>
            <div style={S.childMap}>
              {activeModule.children.map((child) => (
                <button
                  key={child.key}
                  type="button"
                  onClick={() => setChildKey(child.key)}
                  style={{
                    ...S.childChip,
                    ...(child.key === activeChild.key ? S.childChipActive : null),
                  }}
                >
                  {child.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section style={S.placeholder}>
          <div style={S.placeholderInner}>
            <MonitorCog size={28} />
            <div>
              <div style={S.placeholderTitle}>右侧工作区暂不接入目标页面</div>
              <p style={S.placeholderText}>
                当前阶段只验证控制台父子菜单、选中态和信息架构。后续再按模块接 iframe、组件或真实 CRUD 页面。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  shell: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    display: 'grid',
    gridTemplateColumns: '236px 286px minmax(0, 1fr)',
    background: '#120F0C',
    color: '#F8FAFC',
    fontFamily:
      "'InterLocal', 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  rail: {
    background: '#211B17',
    borderRight: '1px solid rgba(255,255,255,0.10)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: '14px 10px',
    gap: 16,
    overflowY: 'auto',
    minWidth: 0,
  },
  railHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 6px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.10)',
  },
  logoMark: {
    width: 56,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 2,
    border: '2px solid #E4002B',
    background: '#F8F6F0',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImage: {
    display: 'block',
    width: 44,
    height: 'auto',
    objectFit: 'contain',
    filter: 'contrast(1.06) saturate(1.04)',
  },
  railBrand: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  railSub: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    marginTop: 2,
  },
  railNav: {
    display: 'grid',
    gap: 16,
    width: '100%',
  },
  railGroup: {
    display: 'grid',
    gap: 5,
  },
  railGroupLabel: {
    padding: '0 8px 2px',
    fontSize: 11,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: '0.03em',
  },
  railButton: {
    width: '100%',
    minHeight: 38,
    border: 0,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '0 10px',
    background: 'transparent',
    color: 'rgba(255,255,255,0.66)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  railButtonActive: {
    background: 'rgba(78,154,61,0.20)',
    color: '#DFF5D6',
    boxShadow: 'inset 3px 0 0 #4E9A3D',
  },
  railText: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  menu: {
    background: '#211B17',
    borderRight: '1px solid rgba(255,255,255,0.10)',
    overflowY: 'auto',
    minWidth: 0,
  },
  menuHeader: {
    padding: '22px 20px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.10)',
  },
  kicker: {
    margin: 0,
    fontSize: 11,
    color: '#8FCB7A',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  menuTitle: {
    margin: '4px 0 2px',
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: 0,
    color: '#fff',
  },
  menuDesc: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
  },
  clusterBlock: {
    padding: '18px 20px 14px',
  },
  clusterTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: '#F8FAFC',
  },
  clusterDesc: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.56)',
  },
  subMenuBlock: {
    padding: '0 10px 20px',
    display: 'grid',
    gap: 8,
  },
  subMenuLabel: {
    padding: '0 10px',
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  moduleList: {
    padding: '0 10px 20px',
    display: 'grid',
    gap: 4,
  },
  moduleSection: {
    display: 'grid',
    gap: 4,
  },
  moduleButton: {
    minHeight: 40,
    border: 0,
    borderRadius: 8,
    background: 'transparent',
    color: 'rgba(255,255,255,0.68)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 10px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  moduleButtonActive: {
    background: '#EDF4E3',
    color: '#101828',
  },
  moduleIcon: {
    width: 24,
    display: 'grid',
    placeItems: 'center',
    color: '#4E9A3D',
  },
  moduleLabel: {
    fontSize: 14,
    fontWeight: 700,
  },
  childList: {
    display: 'grid',
    gap: 2,
    padding: 0,
  },
  childButton: {
    minHeight: 38,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: 0,
    borderRadius: 7,
    background: 'transparent',
    color: '#596067',
    padding: '0 10px',
    fontSize: 14,
    cursor: 'pointer',
    textAlign: 'left',
  },
  childButtonActive: {
    background: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    fontWeight: 800,
  },
  canvas: {
    minWidth: 0,
    overflowY: 'auto',
    padding: '28px 34px',
    background:
      'radial-gradient(900px 420px at 80% -12%, rgba(78,154,61,0.11), transparent 58%), repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 2px, transparent 2px 9px), #120F0C',
  },
  canvasHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  canvasTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  canvasIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    background: '#241F1B',
    color: '#8FCB7A',
    flexShrink: 0,
  },
  canvasKicker: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.58)',
  },
  canvasTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
  statusPill: {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(78,154,61,0.14)',
    color: '#A9E895',
    border: '1px solid rgba(78,154,61,0.40)',
    fontSize: 12,
    fontWeight: 800,
  },
  focusPanel: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 420px)',
    gap: 18,
    alignItems: 'stretch',
    padding: 20,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.045)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.26)',
    marginBottom: 18,
  },
  sectionLabel: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  focusTitle: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 1.12,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  focusDesc: {
    margin: '8px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.62)',
  },
  urlBlock: {
    display: 'grid',
    alignContent: 'center',
    gap: 7,
    padding: 14,
    borderRadius: 8,
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.12)',
    minWidth: 0,
  },
  urlLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.42)',
    fontWeight: 800,
  },
  urlText: {
    fontSize: 13,
    color: '#FFFFFF',
    whiteSpace: 'normal',
    wordBreak: 'break-all',
  },
  archGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(180px, 1fr) 42px minmax(180px, 1fr) 42px minmax(240px, 1.3fr)',
    gap: 0,
    alignItems: 'stretch',
    marginBottom: 18,
  },
  archColumn: {
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.045)',
    padding: 18,
    minHeight: 188,
    boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
  },
  connector: {
    alignSelf: 'center',
    height: 2,
    background: 'linear-gradient(90deg, rgba(143,203,122,0.28), #4E9A3D)',
  },
  archNodeStrong: {
    marginTop: 10,
    fontSize: 18,
    lineHeight: 1.3,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  archHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'rgba(255,255,255,0.62)',
  },
  childMap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  childChip: {
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.72)',
    padding: '7px 10px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  childChipActive: {
    borderColor: '#4E9A3D',
    background: 'rgba(78,154,61,0.18)',
    color: '#DFF5D6',
  },
  placeholder: {
    border: '1px dashed rgba(255,255,255,0.16)',
    borderRadius: 8,
    background:
      'repeating-linear-gradient(45deg, rgba(78,154,61,0.045) 0 10px, transparent 10px 20px), rgba(255,255,255,0.035)',
    padding: 22,
  },
  placeholderInner: {
    minHeight: 180,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    color: 'rgba(255,255,255,0.66)',
    textAlign: 'left',
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  placeholderText: {
    margin: '5px 0 0',
    maxWidth: 560,
    fontSize: 13,
    lineHeight: 1.6,
  },
};
