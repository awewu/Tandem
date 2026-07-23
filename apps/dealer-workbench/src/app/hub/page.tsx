'use client';
import { useEffect, useState } from 'react';
import { clearToken } from '@rhautt/shared-auth';
import { auth, brandSites } from '../../lib/api';
import { WORKBENCH_PORTS } from '../../lib/workbench-navigation';
import { resolveHubSession } from './session-bridge';

/**
 * 统一门户 / Launcher —— 平台唯一"总入口"。
 *
 * 目的：解决"功能分散在多个应用、不知从哪进"的困惑。
 * 机制：所有应用共享同源 nx_token cookie（localhost 跨端口天然共享）。
 *   在此登录一次后，点击任意应用卡片 → 目标应用免登直接进入。
 *
 * 可见性：按当前账号 role 过滤卡片；platform_admin / hq_admin 可见全部。
 * 端口为本地开发默认值，生产可用 NEXT_PUBLIC_APP_<KEY>_URL 覆盖为子域。
 */

type Feature = { label: string; path?: string }; // path 缺省则深链到模块根路径
type ModuleDef = {
  key: string;
  app: string;      // 应用标识（用于 NEXT_PUBLIC_APP_<APP>_URL 白标覆盖）
  name: string;
  desc: string;
  port: number;
  path: string;     // 模块主入口路径
  color: string;
  roles: string[];  // '*' = 所有人
  features: Feature[]; // 体现该 app 左栏的子功能（可深链）
};
type Cluster = { id: string; title: string; subtitle: string; modules: ModuleDef[] };
type HubBrand = { id: string; name: string; href: string; logoSrc: string };

// Phase 1 Hub 只暴露品牌/厂家/营销资料中台与账号管理入口；CRM/BIM/客户入口等深层模块保留但不挂可见导航。
const CLUSTERS: Cluster[] = [
  {
    id: 'brand', title: '组团一 · 品牌厂家功能组', subtitle: '面向总部 / 品牌方：品牌 · 市场营销 · 产品 · 官网 · 市场中枢',
    modules: [
      { key: 'brand-console', app: 'dealer', name: '品牌运营控制台', desc: '品牌内容 · 产品定位 · 素材与发布', port: WORKBENCH_PORTS.dealer, path: '/brand', color: '#7c3aed',
        roles: ['platform_admin', 'hq_admin', 'marketing', 'brand_admin'],
        features: [
          { label: 'DAM / 素材库' },
          { label: '内容资产' },
          { label: '发布到站点' },
        ] },
      { key: 'growth', app: 'dealer', name: '市场营销 · 增长引擎', desc: 'GEO 可见度 · 文案 · 舆情 · 营销自动化', port: WORKBENCH_PORTS.dealer, path: '/growth', color: '#0ea5e9',
        roles: ['platform_admin', 'hq_admin', 'marketing'],
        features: [{ label: 'GEO 可见度', path: '/growth/geo' }, { label: '文案 Copilot', path: '/growth/copywriter' }, { label: '舆情雷达', path: '/growth/sentiment' }, { label: '营销自动化', path: '/growth/automation' }] },
      { key: 'product', app: 'dealer', name: '产品', desc: '产品库 · 产品资料管理 · 产品目录底座', port: WORKBENCH_PORTS.dealer, path: '/products', color: '#d97706',
        roles: ['platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager', 'sales', 'designer'],
        features: [
          { label: '产品库 / 产品目录', path: '/products?module=catalog' },
          { label: '产品资料管理', path: '/products?module=materials' },
          { label: '产品目录底座', path: '/products?module=base' },
        ] },
      { key: 'public', app: 'dealer', name: '品牌官网管理', desc: '集团官网与子品牌官网主数据、Logo、交付地址 CRUD', port: WORKBENCH_PORTS.dealer, path: '/comfort/sites', color: '#16a34a',
        roles: ['platform_admin', 'hq_admin', 'marketing', 'brand_admin'],
        features: [
          { label: '全部官网 CRUD', path: '/comfort/sites' },
          { label: '瑞美 Rheem 官网', path: '/comfort/sites/rheem' },
          { label: '瑞德 Ruud 官网', path: '/comfort/sites/ruud' },
          { label: '恒热 Everhot 官网', path: '/comfort/sites/everhot' },
        ] },
      { key: 'comfort', app: 'dealer', name: '品牌与市场中枢', desc: '网站 · 物料 · 品牌产品库 · 上新发布', port: WORKBENCH_PORTS.dealer, path: '/comfort', color: '#c8202c',
        roles: ['platform_admin', 'hq_admin', 'marketing'],
        features: [
          { label: '品牌官网管理', path: '/comfort/sites' },
          { label: '瑞美 Rheem 官网', path: '/comfort/sites/rheem' },
          { label: '瑞德 Ruud 官网', path: '/comfort/sites/ruud' },
          { label: '恒热 Everhot 官网', path: '/comfort/sites/everhot' },
          { label: '内容资产', path: '/comfort/dam' },
          { label: '市场物料', path: '/comfort/dam' },
          { label: '品牌产品库', path: '/comfort/catalog' },
          { label: '上新 / 发布', path: '/comfort/publish' },
        ] },
    ],
  },
  {
    id: 'accounts', title: '账号管理', subtitle: '面向管理员：账号 · 角色权限 · 启停 · 密码重置',
    modules: [
      { key: 'accounts', app: 'dealer', name: '账号管理', desc: '后台开户 · 角色权限 · 停用启用 · 重置密码', port: WORKBENCH_PORTS.dealer, path: '/accounts', color: '#4E9A3D',
        roles: ['platform_admin', 'hq_admin', 'dealer_admin'],
        features: [{ label: '账号列表', path: '/accounts' }, { label: '新建账号', path: '/accounts' }] },
    ],
  },
];

/**
 * 白标品牌（多租户 SaaS：Rysnova 为平台方，客户可独立部署并命名）。
 * - NEXT_PUBLIC_TENANT_BRAND：客户/租户品牌，默认样板客户 Rhautt Comfort。
 * - NEXT_PUBLIC_HUB_NAME：本入口的产品化名称，默认「Rhautt Nexus Hub」。
 * - NEXT_PUBLIC_PLATFORM_TAG：平台方署名，固定 Powered by Rysnova AI。
 */
const HUB_BRAND = process.env.NEXT_PUBLIC_TENANT_BRAND || 'Rhautt Comfort';
const HUB_NAME = process.env.NEXT_PUBLIC_HUB_NAME || 'Rhautt Nexus Hub';
const PLATFORM_TAG = process.env.NEXT_PUBLIC_PLATFORM_TAG || 'Powered by Rysnova AI';

// Rhautt® 设计系统 token（源 apps/public-portal globals.css）：
// UI 唯一 accent = 品牌绿；红仅作 logo 识别锚点；暖炭底、锐角、发丝线。
const RH = {
  green: '#4E9A3D', green2: '#3E7C2F', greenDk: '#2F5E24',
  red: '#E4002B', redDk: '#A00F28',
  dark: '#241F1B', dark2: '#322A24',
} as const;

const ROLE_LABEL: Record<string, string> = {
  brand_admin: '品牌管理员',
  platform_admin: '平台超级管理员', hq_admin: '总部管理员', regional_manager: '区域经理',
  dealer_admin: '经销商管理员', store_manager: '门店经理', designer: '设计师',
  sales: '销售', engineer: '工程师', installer: '安装工', customer: '客户',
};

const APP_URLS: Record<string, string | undefined> = {
  brand: process.env.NEXT_PUBLIC_APP_BRAND_URL,
  diagnosis: process.env.NEXT_PUBLIC_APP_DIAGNOSIS_URL ?? 'https://rhautt.com',
  nexus: process.env.NEXT_PUBLIC_APP_NEXUS_URL,
  product: process.env.NEXT_PUBLIC_APP_PRODUCT_URL,
  public: process.env.NEXT_PUBLIC_APP_PUBLIC_URL,
  dealer: process.env.NEXT_PUBLIC_APP_DEALER_URL,
  designer: process.env.NEXT_PUBLIC_APP_DESIGNER_URL,
  bimwb: process.env.NEXT_PUBLIC_APP_BIMWB_URL,
  customer: process.env.NEXT_PUBLIC_APP_CUSTOMER_URL,
};

function appBase(m: ModuleDef): string {
  const override = APP_URLS[m.app];
  if (override) return override;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:${m.port}`;
}
const moduleHref = (m: ModuleDef) => appBase(m) + m.path;
const featureHref = (m: ModuleDef, f: Feature) => appBase(m) + (f.path ?? m.path);

function moduleVisible(m: ModuleDef, role: string | null): boolean {
  if (m.roles.includes('*')) return true;
  if (!role) return false;
  return m.roles.includes(role);
}

export default function HubPage() {
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hubBrands, setHubBrands] = useState<HubBrand[]>([]);

  useEffect(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    resolveHubSession(() => auth.me(), cached)
      .then(async (decision) => {
        if (decision.status === 'redirect') {
          window.location.href = decision.location;
          return;
        }
        setRole(decision.role);
        setName(decision.name);
        try {
          const result = await brandSites.list();
          const candidates = (result.items || []).filter((item: any) =>
            item.status === 'active' && !item.deletedAt && item.logoArtifactId && item.resolvedUrl,
          );
          const logos = await Promise.all(candidates.map(async (item: any) => {
            try {
              const file = await brandSites.logo(item.id);
              if (!file.dataBase64) return null;
              return {
                id: item.id,
                name: item.nameCn || item.nameEn,
                href: item.resolvedUrl,
                logoSrc: `data:${file.mimeType || 'image/png'};base64,${file.dataBase64}`,
              } as HubBrand;
            } catch { return null; }
          }));
          setHubBrands(logos.filter(Boolean) as HubBrand[]);
        } catch { setHubBrands([]); }
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    clearToken();
    if (typeof window !== 'undefined') { localStorage.removeItem('token'); localStorage.removeItem('user'); }
    window.location.href = '/';
  }

  const visibleClusters = CLUSTERS
    .map((c) => ({ ...c, modules: c.modules.filter((m) => moduleVisible(m, role)) }))
    .filter((c) => c.modules.length > 0);
  const totalModules = visibleClusters.reduce((n, c) => n + c.modules.length, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, overflowY: 'auto',
      // Rhautt® 设计系统：暖炭底（禁用冷黑）+ 细腻暖调
      background: 'radial-gradient(1100px 520px at 78% -12%, rgba(78,154,61,0.10), transparent 60%), linear-gradient(180deg, #2A241F 0%, #241F1B 100%)',
      fontFamily: "'InterLocal', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      color: '#fff', ['--hub-green' as string]: RH.green,
    }}>
      {/* 粗犷纹理（Ruud Rugged Texture · 极低不透明度）*/}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.5,
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 2px, transparent 2px 8px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.12) 0 2px, transparent 2px 8px)',
      }} />

      {/* 顶栏 */}
      <header style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 44px', borderBottom: '1px solid rgba(255,255,255,0.09)',
        background: 'rgba(36,31,27,0.72)', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* 品牌识别锚点：唯一允许的红，仅作 logo（六边螺栓）*/}
          <span style={{
            width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            clipPath: 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
            background: `linear-gradient(150deg, ${RH.red} 0%, ${RH.redDk} 100%)`,
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.25)',
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 12 L8 4 L13 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{HUB_BRAND}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: RH.green }}>{HUB_NAME}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 999, letterSpacing: 0.4,
                background: 'rgba(78,154,61,0.14)', color: '#8FCB7A', border: '1px solid rgba(78,154,61,0.32)',
              }}>{PLATFORM_TAG}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', marginTop: 5, letterSpacing: 0.2 }}>
              品牌运营 · 产品资料 · 官网发布 · 市场增长 · 账号权限
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{name || '已登录'}</div>
            <div style={{ fontSize: 11, color: RH.green }}>{role ? (ROLE_LABEL[role] || role) : ''}</div>
          </div>
          <button onClick={logout} className="hub-logout" style={{
            padding: '8px 15px', borderRadius: 3, border: '1px solid rgba(255,255,255,0.16)',
            background: 'transparent', color: 'rgba(255,255,255,0.72)', fontSize: 13, cursor: 'pointer',
            transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
          }}>退出</button>
        </div>
      </header>

      {/* 组团 · 模块区 */}
      <main style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '44px' }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', padding: 40 }}>加载中…</div>
        ) : (
          <>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.42)', marginBottom: 34, letterSpacing: 0.3,
              fontVariantNumeric: 'tabular-nums',
            }}>
              可进入 <b style={{ color: '#fff' }}>{visibleClusters.length}</b> 个组团 · 共 <b style={{ color: '#fff' }}>{totalModules}</b> 个功能模块 —— 点击模块或其子功能，免登直接进入
            </div>
            {visibleClusters.map((cluster, ci) => (
              <section key={cluster.id} style={{ marginBottom: 44 }}>
                {/* 组团标题：六边编号徽章 + 标题 + 副题 + 绿色发丝线 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <span style={{
                    width: 34, height: 34, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    clipPath: 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
                    background: `linear-gradient(150deg, ${RH.green} 0%, ${RH.greenDk} 100%)`,
                    color: '#fff', fontSize: 14, fontWeight: 800,
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.25)',
                  }}>{String(ci + 1).padStart(2, '0')}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>{cluster.title}</h2>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{cluster.subtitle}</span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(78,154,61,0.4), rgba(255,255,255,0.04))', marginLeft: 6 }} />
                </div>

                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {cluster.modules.map((m) => (
                    <div key={m.key} className="hub-card" style={{
                      background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)',
                      borderRadius: 4, padding: '20px 20px 18px', position: 'relative', overflow: 'hidden',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.20)',
                      display: 'flex', flexDirection: 'column',
                    }}>
                      {/* 顶部单色绿轴（统一，去彩虹碎片感）*/}
                      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 2, background: `linear-gradient(90deg, ${RH.green}, ${RH.greenDk})` }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <a href={moduleHref(m)} className="hub-title-link" style={{ fontSize: 15.5, fontWeight: 700, color: '#fff', textDecoration: 'none', transition: 'color 150ms' }}>{m.name}</a>
                        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.32)', fontFamily: "'JetBrains Mono', Menlo, monospace", fontVariantNumeric: 'tabular-nums' }}>:{m.port}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.48)', lineHeight: 1.6, marginBottom: 14 }}>{m.desc}</div>
                      {m.key === 'public-preview' ? (<>
                        <div className="hub-brand-stage">
                          <div className="hub-brand-grid">
                            {hubBrands.length ? hubBrands.map((brand) => (
                              <a key={brand.id} href={brand.href} target="_blank" rel="noopener noreferrer" className="hub-brand-logo" aria-label={`打开${brand.name}官网`}>
                                <img src={brand.logoSrc} alt={`${brand.name} Logo`} />
                              </a>
                            )) : <div className="hub-brand-empty">暂无已配置的品牌 Logo</div>}
                          </div>
                        </div>
                        <a href={moduleHref(m)} className="hub-enter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 16, fontSize: 12, color: RH.green, fontWeight: 600, textDecoration: 'none', transition: 'gap 150ms' }}>进入模块 <span aria-hidden>→</span></a>
                      </>) : <>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.3)', marginBottom: 9, letterSpacing: '0.12em', textTransform: 'uppercase' }}>功能菜单</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {m.features.map((f, i) => (
                          <a key={m.key + i} href={featureHref(m, f)} className="hub-chip" style={{
                            fontSize: 11.5, padding: '4px 10px', borderRadius: 3, textDecoration: 'none', letterSpacing: '0.01em',
                            background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.74)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}>{f.label}</a>
                        ))}
                      </div>
                      <a href={moduleHref(m)} className="hub-enter" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 16, fontSize: 12, color: RH.green, fontWeight: 600, textDecoration: 'none', transition: 'gap 150ms' }}>进入模块 <span aria-hidden>→</span></a>
                      </>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      {/* 平台方署名 */}
      <footer style={{
        position: 'relative', textAlign: 'center', padding: '22px 44px 34px',
        fontSize: 11, color: 'rgba(255,255,255,0.28)', letterSpacing: 0.2,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {HUB_BRAND} {HUB_NAME} · {PLATFORM_TAG} · 独立 AI 软件平台 · 支持客户独立部署与命名
      </footer>

      {/* SSR 友好的 hover（Rhautt premium lift）*/}
      <style>{`
        .hub-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.38) !important; border-color: rgba(78,154,61,0.5) !important; }
        .hub-chip:hover { background: var(--hub-green) !important; color: #fff !important; border-color: var(--hub-green) !important; }
        .hub-title-link:hover { color: #8FCB7A !important; }
        .hub-enter:hover { gap: 10px !important; }
        .hub-logout:hover { background: rgba(255,255,255,0.10) !important; color: #fff !important; border-color: rgba(255,255,255,0.28) !important; }
        .hub-brand-stage { flex: 1; min-height: 58px; display: flex; align-items: center; justify-content: flex-start; }
        .hub-brand-grid { display: flex; flex-wrap: nowrap; justify-content: flex-start; align-items: center; gap: 14px; min-height: 34px; }
        .hub-brand-logo { width: 61px; height: 34px; display: grid; place-items: center; padding: 0; background: transparent; border: 0; border-radius: 3px; transition: transform 150ms, filter 150ms; }
        .hub-brand-logo:hover, .hub-brand-logo:focus-visible { transform: translateY(-2px); filter: drop-shadow(0 8px 18px rgba(0,0,0,.35)); outline: 2px solid var(--hub-green); outline-offset: 6px; }
        .hub-brand-logo img { display: block; width: auto; height: auto; max-width: 61px; max-height: 34px; object-fit: contain; }
        .hub-brand-empty { width: 100%; min-height: 64px; display: grid; place-items: center; color: rgba(255,255,255,.35); border: 1px dashed rgba(255,255,255,.12); }
        @media (max-width: 640px) { .hub-brand-stage { min-height: 58px; } .hub-brand-grid { flex-wrap: wrap; gap: 10px; } .hub-brand-logo { width: 56px; height: 32px; } .hub-brand-logo img { max-width: 56px; max-height: 32px; } }
      `}</style>
    </div>
  );
}
