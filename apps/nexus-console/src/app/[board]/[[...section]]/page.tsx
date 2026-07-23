import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { BOARDS, getPanel, type Panel as PanelType } from '../../../lib/boards';
import Panel from '../../../components/Panel';
import GeoAnalyzer from '../../../components/GeoAnalyzer';
import BrandSitesManager from '../../../components/BrandSitesManager';
import ProductCatalogManager from '../../../components/ProductCatalogManager';
import DamLibraryManager from '../../../components/DamLibraryManager';
import BrandPublishManager from '../../../components/BrandPublishManager';
import { getBrandStats, getSessionUser, getTenantsCount } from '../../../lib/api';

// Reads the session cookie to fetch live KPIs → must render per-request.
export const dynamic = 'force-dynamic';

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || 'http://localhost:5000';

export function generateStaticParams() {
  const params: { board: string; section?: string[] }[] = [];
  for (const board of BOARDS) {
    for (const panel of board.panels) {
      params.push(panel.key === 'overview' ? { board: board.id } : { board: board.id, section: [panel.key] });
    }
  }
  return params;
}

// Replace a card's KPI by title, only when a real value is available.
function setKpi(panel: PanelType, title: string, value: number | null) {
  if (value == null) return;
  for (const block of panel.blocks) {
    if (block.type !== 'cards') continue;
    const card = block.items.find((i) => i.title === title);
    if (card) card.kpi = String(value);
  }
}

async function withLiveKpis(boardId: string, panel: PanelType): Promise<PanelType> {
  const live: PanelType = JSON.parse(JSON.stringify(panel)); // avoid mutating module data
  if (boardId === 'enablement') {
    setKpi(live, '租户', await getTenantsCount());
  } else if (boardId === 'comfort') {
    const brand = await getBrandStats();
    setKpi(live, '产品条目', brand?.products ?? null);
  }
  return live;
}

async function redirectToLogin(board: string, section?: string[]): Promise<never> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:5010';
  const proto =
    requestHeaders.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const pathname = `/${[board, ...(section ?? [])].map(encodeURIComponent).join('/')}`;
  const returnUrl = `${proto}://${host}${pathname}`;

  redirect(`${LOGIN_URL.replace(/\/$/, '')}/?returnUrl=${encodeURIComponent(returnUrl)}`);
}

export default async function BoardSectionPage({
  params,
}: {
  params: Promise<{ board: string; section?: string[] }>;
}) {
  const { board, section } = await params;
  const sectionKey = section?.[0] ?? 'overview';
  if (!(await getSessionUser())) {
    await redirectToLogin(board, section);
  }
  const panel = getPanel(board, sectionKey);
  if (!panel) notFound();
  // Interactive tool pages — render dedicated components instead of static Panel
  if (board === 'growth' && sectionKey === 'geo') {
    return (
      <>
        <div className="crumb">{panel.crumb}</div>
        <h1 className="h1">{panel.h1}</h1>
        <p className="sub">{panel.sub}</p>
        <GeoAnalyzer />
      </>
    );
  }
  if (board === 'comfort' && sectionKey === 'sites') {
    const focusCode = section?.[1];
    return (
      <>
        <div className="crumb">{panel.crumb}</div>
        <h1 className="h1">{panel.h1}</h1>
        <p className="sub">企业租户的品牌主数据、唯一官网地址与 Logo 素材配置。</p>
        <BrandSitesManager focusCode={focusCode} />
      </>
    );
  }
  if (board === 'comfort' && sectionKey === 'catalog') {
    return (
      <>
        <div className="crumb">{panel.crumb}</div>
        <h1 className="h1">{panel.h1}</h1>
        <p className="sub">统一查看共享目录，并在当前品牌租户中完成上新、定位、定价与上下架。</p>
        <ProductCatalogManager />
      </>
    );
  }
  if (board === 'comfort' && sectionKey === 'dam') {
    return (
      <>
        <div className="crumb">{panel.crumb}</div>
        <h1 className="h1">{panel.h1}</h1>
        <p className="sub">集中管理产品图片、参数表、认证文件、BIM 族与说明文档。</p>
        <DamLibraryManager />
      </>
    );
  }
  if (board === 'comfort' && sectionKey === 'publish') {
    return (
      <>
        <div className="crumb">{panel.crumb}</div>
        <h1 className="h1">{panel.h1}</h1>
        <p className="sub">校验产品与素材状态，并将已批准内容同步到品牌站点。</p>
        <BrandPublishManager />
      </>
    );
  }

  let view = panel;
  if (sectionKey === 'overview') {
    view = await withLiveKpis(board, panel);
  }
  return <Panel panel={view} />;
}
