'use client';

import {
  Edit3,
  ExternalLink,
  Globe2,
  ShieldAlert,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { auth, brandSites } from '../../../lib/api';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchSectionHeader,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../../components/WorkbenchCore';

type SiteStatus = 'active' | 'inactive';
type DeliveryType = 'self_hosted' | 'external';

type BrandSite = {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  appKey: string | null;
  deliveryType: DeliveryType;
  developmentUrl: string | null;
  productionUrl: string | null;
  resolvedUrl: string | null;
  resolvedEnvironment: string;
  logoArtifactId: string | null;
  sortOrder: number;
  status: SiteStatus;
  siteNote: string | null;
  deletedAt: string | null;
  updatedAt: string | null;
};

type Session = {
  role?: string | null;
  permissions?: string[] | null;
};

function can(session: Session | null, permission: string) {
  if (session?.role === 'platform_admin' || session?.role === 'hq_admin') return true;
  return Boolean(session?.permissions?.includes('*') || session?.permissions?.includes(permission));
}

type SiteForm = {
  code: string;
  nameCn: string;
  nameEn: string;
  appKey: string;
  deliveryType: DeliveryType;
  developmentUrl: string;
  productionUrl: string;
  sortOrder: string;
  status: SiteStatus;
  siteNote: string;
};

const BRAND_OPTIONS = [
  { code: 'rhautt-group', label: '瑞合瑞德暖通科技集团', tone: 'Group' },
  { code: 'all', label: '全部站点', tone: 'All' },
  { code: 'rheem', label: '瑞美 Rheem', tone: 'Rheem' },
  { code: 'ruud', label: '瑞德 Ruud', tone: 'Ruud' },
  { code: 'everhot', label: '恒热 Everhot', tone: 'Everhot' },
] as const;

const DEFAULT_FILTER = BRAND_OPTIONS.find((option) => option.code === 'all') || BRAND_OPTIONS[0];

const BRAND_PRESETS: Record<string, Partial<SiteForm>> = {
  'rhautt-group': {
    code: 'rhautt-group',
    nameCn: '瑞合瑞德暖通科技集团',
    nameEn: 'Rhautt Comfort',
    appKey: '',
    sortOrder: '0',
  },
  rheem: {
    code: 'rheem',
    nameCn: '瑞美',
    nameEn: 'Rheem',
    appKey: 'rheem-cn',
    developmentUrl: 'http://localhost:5014',
    productionUrl: 'https://www.rheem.com.cn',
    sortOrder: '10',
  },
  ruud: {
    code: 'ruud',
    nameCn: '瑞德',
    nameEn: 'Ruud',
    appKey: 'ruud-cn',
    developmentUrl: 'http://localhost:5015',
    productionUrl: 'https://www.ruud.com.cn',
    sortOrder: '20',
  },
  everhot: {
    code: 'everhot',
    nameCn: '恒热',
    nameEn: 'Everhot',
    appKey: 'everhot-cn',
    developmentUrl: 'http://localhost:5011',
    productionUrl: 'https://www.everhot.com.cn',
    sortOrder: '30',
  },
};

const blankForm = (brandCode = 'all'): SiteForm => ({
  code: '',
  nameCn: '',
  nameEn: '',
  appKey: '',
  deliveryType: 'self_hosted',
  developmentUrl: '',
  productionUrl: '',
  sortOrder: '0',
  status: 'active',
  siteNote: '',
  ...BRAND_PRESETS[brandCode],
});

const statusMeta = (site: Pick<BrandSite, 'status' | 'deletedAt'>) => {
  if (site.deletedAt) return { label: '已归档', className: 'badge-grey' };
  if (site.status === 'active') return { label: '发布中', className: 'badge-success' };
  return { label: '已停用', className: 'badge-warning' };
};

const displayUrl = (site: BrandSite) =>
  site.productionUrl || site.resolvedUrl || site.developmentUrl || '';

const isGroupSite = (site: Pick<BrandSite, 'code'>) => site.code === 'rhautt-group';

async function loadLogo(siteId: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    return await brandSites.logo(siteId, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function BrandSitesManager({ brandCode }: { brandCode: string }) {
  const initialBrand = brandCode || DEFAULT_FILTER.code;
  const [activeBrand, setActiveBrand] = useState(initialBrand);
  const [sites, setSites] = useState<BrandSite[]>([]);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<BrandSite | null>(null);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandSite | null>(null);

  const canCreateSites = can(session, 'brand.library.create');
  const canUpdateSites = can(session, 'brand.library.update');
  const canDeleteSites = can(session, 'brand.library.delete');

  const filteredSites = useMemo(() => {
    const selectedSites = activeBrand === 'all'
      ? sites
      : sites.filter((site) => site.code === activeBrand);
    return [...selectedSites].sort((left, right) => {
      const archivedOrder = Number(Boolean(left.deletedAt)) - Number(Boolean(right.deletedAt));
      if (archivedOrder) return archivedOrder;
      const sortOrder = Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
      if (sortOrder) return sortOrder;
      return (left.nameCn || left.nameEn || left.code).localeCompare(right.nameCn || right.nameEn || right.code);
    });
  }, [activeBrand, sites]);

  const filterOptions = useMemo(() => {
    const visibleSites = sites
      .filter((site) => !site.deletedAt)
      .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));

    if (!visibleSites.length) return BRAND_OPTIONS;

    return [
      DEFAULT_FILTER,
      ...visibleSites.map((site) => ({
        code: site.code,
        label: `${site.nameCn || site.nameEn} ${site.nameEn || ''}`.trim(),
        tone: site.nameEn || site.code,
      })),
    ];
  }, [sites]);

  const counts = useMemo(() => {
    const visible = sites.filter((site) => !site.deletedAt);
    return {
      total: sites.length,
      active: visible.filter((site) => site.status === 'active').length,
      inactive: visible.filter((site) => site.status === 'inactive').length,
      archived: sites.filter((site) => site.deletedAt).length,
    };
  }, [sites]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await brandSites.list({ includeDeleted: true });
      const items = (result.items || []) as BrandSite[];
      setSites(items);
      setLogos((current) => {
        const visibleIds = new Set(items.filter((site) => !site.deletedAt).map((site) => site.id));
        return Object.fromEntries(Object.entries(current).filter(([siteId]) => visibleIds.has(siteId)));
      });
      window.dispatchEvent(new CustomEvent('rhautt-brand-sites-updated'));
      setLoading(false);
      void Promise.all(
        items
          .filter((site) => site.logoArtifactId && !site.deletedAt)
          .map(async (site) => {
            try {
              const logo = await loadLogo(site.id);
              if (!logo.dataBase64) return null;
              return [
                site.id,
                `data:${logo.mimeType || 'image/png'};base64,${logo.dataBase64}`,
              ] as const;
            } catch {
              return null;
            }
          })
      ).then((logoEntries) => {
        setLogos((current) => ({
          ...current,
          ...Object.fromEntries(logoEntries.filter(Boolean) as Array<readonly [string, string]>),
        }));
      });
    } catch (e) {
      setError((e as Error).message || '官网站点加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then((me) => {
        if (!cancelled) setSession(me as Session);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveBrand(initialBrand);
  }, [initialBrand]);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2400);
  }

  async function updateSite(site: BrandSite, patch: Record<string, unknown>, doneText: string) {
    setBusyId(site.id);
    setError('');
    try {
      await brandSites.update(site.id, patch);
      await load();
      flash(doneText);
    } catch (e) {
      setError((e as Error).message || '站点更新失败');
    } finally {
      setBusyId('');
    }
  }

  async function archiveSite(site: BrandSite) {
    if (!canDeleteSites) {
      setError('只有平台管理员可以删除或归档官网配置。');
      return;
    }
    if (!window.confirm(`归档 ${site.nameCn || site.nameEn} 官网配置？`)) return;
    setBusyId(site.id);
    setError('');
    try {
      await brandSites.remove(site.id);
      await load();
      flash('官网配置已归档');
    } catch (e) {
      setError((e as Error).message || '归档失败');
    } finally {
      setBusyId('');
    }
  }

  async function restoreSite(site: BrandSite) {
    setBusyId(site.id);
    setError('');
    try {
      await brandSites.restore(site.id);
      await load();
      flash('官网配置已恢复');
    } catch (e) {
      setError((e as Error).message || '恢复失败');
    } finally {
      setBusyId('');
    }
  }

  function deleteArchivedSite(site: BrandSite) {
    if (!canDeleteSites) {
      setError('只有平台管理员可以永久删除官网配置。');
      return;
    }
    setDeleteTarget(site);
  }

  async function legacyDeleteArchivedSite(site: BrandSite) {
    if (!canDeleteSites) {
      setError('只有平台管理员可以永久删除官网配置。');
      return;
    }
    setDeleteTarget(site);
    return;
    if (!window.confirm(`永久删除 ${site.nameCn || site.nameEn} 官网配置？该操作不可恢复。`)) return;
    setBusyId(site.id);
    setError('');
    try {
      await brandSites.remove(site.id);
      setSites((current) => current.filter((item) => item.id !== site.id));
      await load();
      flash('官网配置已删除');
    } catch (e) {
      setError((e as Error).message || '删除失败');
    } finally {
      setBusyId('');
    }
  }

  async function confirmDeleteArchivedSite(site: BrandSite) {
    setBusyId(site.id);
    setError('');
    try {
      await brandSites.remove(site.id);
      setSites((current) => current.filter((item) => item.id !== site.id));
      await load();
      flash('官网配置已删除');
    } catch (e) {
      setError((e as Error).message || '删除失败');
    } finally {
      setBusyId('');
      setDeleteTarget(null);
    }
  }

  const actions = (
    <>
      <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
        <RefreshCw size={15} />
        刷新
      </button>
      {canCreateSites && (
        <button type="button" className="btn btn-brand" onClick={() => setCreating(true)}>
          <Plus size={15} />
          新增官网
        </button>
      )}
    </>
  );

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <div className="page-container brand-sites-page">
        <WorkbenchSectionHeader
          eyebrow="品牌官网"
          title="品牌官网管理"
          description="维护 Rheem、Ruud、Everhot 与集团官网的站点主数据、Logo、发布状态和访问地址。"
          actions={<div className="site-header-actions">{actions}</div>}
        />

        <section className="site-kpis" aria-label="官网状态汇总">
          <Stat label="站点总数" value={counts.total} />
          <Stat label="发布中" value={counts.active} tone="success" />
          <Stat label="已停用" value={counts.inactive} tone="warning" />
          <Stat label="已归档" value={counts.archived} tone="muted" />
        </section>

        <WorkbenchFilterToolbar>
          <div className="brand-filter-group">
            {filterOptions.map((brand) => (
              <button
                key={brand.code}
                type="button"
                className={brand.code === activeBrand ? 'brand-filter is-active' : 'brand-filter'}
                onClick={() => setActiveBrand(brand.code)}
              >
                <span>{brand.label}</span>
                <small>{brand.tone}</small>
              </button>
            ))}
          </div>
          <span className="workbench-filter-toolbar__meta">当前显示 {filteredSites.length} 个站点</span>
        </WorkbenchFilterToolbar>

        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}

        <section className="site-list-panel">
          <div className="site-list-head">
            <div>
              <p className="t-label">Official Sites</p>
              <h2>官网站点列表</h2>
            </div>
            <span>{filteredSites.length} 个站点</span>
          </div>

          <WorkbenchTableShell>
          <div className="site-table-wrap">
            <table className="table site-table">
              <thead>
                <tr>
                  <th>品牌</th>
                  <th>Logo</th>
                  <th>URL</th>
                  <th>交付</th>
                  <th>发布状态</th>
                  <th>排序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      <WorkbenchTableState
                        type="loading"
                        title="正在加载官网站点"
                        description="正在同步品牌站点、发布状态和 Logo 素材。"
                      />
                    </td>
                  </tr>
                ) : filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      <WorkbenchTableState
                        type="empty"
                        title="暂无官网站点"
                        description="可以新建 Rheem、Ruud、Everhot 或集团品牌站点配置。"
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSites.map((site) => {
                    const meta = statusMeta(site);
                    const url = displayUrl(site);
                    return (
                      <tr
                        key={site.id}
                        className={`${site.deletedAt ? 'is-archived' : ''}${isGroupSite(site) ? ' is-group-site' : ''}`}
                      >
                        <td>
                          <div className="site-brand-cell">
                            <strong>{site.nameCn}</strong>
                            <span>
                              {site.nameEn} · {site.code}
                            </span>
                            {isGroupSite(site) && <em className="group-site-chip">集团官网</em>}
                          </div>
                        </td>
                        <td>
                          <LogoPreview site={site} src={logos[site.id]} />
                        </td>
                        <td>
                          <div className="site-url-cell">
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <span>{url}</span>
                                <ExternalLink size={13} />
                              </a>
                            ) : (
                              <span>未配置</span>
                            )}
                            <small>
                              生产环境 {site.productionUrl ? '已配置' : '未配置'} · 测试环境{' '}
                              {site.developmentUrl ? '已配置' : '未配置'}
                            </small>
                          </div>
                        </td>
                        <td>
                          <span className="pill-neutral">
                            {site.deliveryType === 'self_hosted' ? '自建站' : '外部站'}
                          </span>
                        </td>
                        <td>
                          <StatusPill tone={meta.className === 'badge-success' ? 'success' : meta.className === 'badge-warning' ? 'warning' : 'neutral'}>
                            {meta.label}
                          </StatusPill>
                        </td>
                        <td className="mono-cell">{site.sortOrder}</td>
                        <td>
                          <div className="row-actions">
                            {site.deletedAt ? (
                              <>
                                {canUpdateSites && (
                                  <button
                                    type="button"
                                    title="恢复"
                                    aria-label={`恢复 ${site.nameCn} 官网配置`}
                                    onClick={() => restoreSite(site)}
                                    disabled={busyId === site.id}
                                  >
                                    <RotateCcw size={15} />
                                  </button>
                                )}
                                {canDeleteSites && (
                                  <button
                                    type="button"
                                    title="删除"
                                    aria-label={`删除 ${site.nameCn} 官网配置`}
                                    className="danger-action"
                                    onClick={() => deleteArchivedSite(site)}
                                    disabled={busyId === site.id}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                {canUpdateSites && (
                                  <>
                                    <button
                                      type="button"
                                      title="编辑"
                                      aria-label={`编辑 ${site.nameCn} 官网配置`}
                                      onClick={() => setEditing(site)}
                                      disabled={busyId === site.id}
                                    >
                                      <Edit3 size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      title={site.status === 'active' ? '停用' : '启用'}
                                      aria-label={`${site.status === 'active' ? '停用' : '启用'} ${
                                        site.nameCn
                                      } 官网`}
                                      onClick={() =>
                                        updateSite(
                                          site,
                                          { status: site.status === 'active' ? 'inactive' : 'active' },
                                          site.status === 'active' ? '官网已停用' : '官网已启用'
                                        )
                                      }
                                      disabled={busyId === site.id}
                                    >
                                      <Power size={15} />
                                    </button>
                                  </>
                                )}
                                {canDeleteSites && (
                                  <button
                                    type="button"
                                    title="归档"
                                    aria-label={`归档 ${site.nameCn} 官网配置`}
                                    className="danger-action"
                                    onClick={() => archiveSite(site)}
                                    disabled={busyId === site.id}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </WorkbenchTableShell>
        </section>

        {(creating || editing) && (
          <SiteDialog
            brandCode={activeBrand}
            site={editing}
            onClose={() => {
              setCreating(false);
              setEditing(null);
            }}
            onDone={async (text) => {
              setCreating(false);
              setEditing(null);
              await load();
              flash(text);
            }}
            onError={setError}
          />
        )}
        {deleteTarget && (
          <DeleteSiteDialog
            site={deleteTarget}
            busy={busyId === deleteTarget.id}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => confirmDeleteArchivedSite(deleteTarget)}
          />
        )}
      </div>

      <style>{`
        .brand-sites-page {
          display: grid;
          gap: var(--s4);
          width: 100%;
          max-width: none;
        }
        .site-header-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }
        .site-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--s4);
        }
        .site-stat {
          min-height: 92px;
          padding: 16px 18px;
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--sh-card);
          border-top: 3px solid var(--brand);
        }
        .site-stat.success {
          border-top-color: var(--success);
        }
        .site-stat.warning {
          border-top-color: var(--warning);
        }
        .site-stat.muted {
          border-top-color: var(--t-tertiary);
        }
        .site-stat span {
          display: block;
          font-size: 12px;
          color: var(--t-secondary);
        }
        .site-stat strong {
          display: block;
          margin-top: 8px;
          font-size: 30px;
          line-height: 1;
          font-weight: 700;
          color: var(--t-strong);
          font-variant-numeric: tabular-nums;
        }
        .brand-filter-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .brand-filter {
          min-width: 128px;
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 7px 12px;
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          background: var(--surface-1);
          color: var(--t-primary);
          box-shadow: var(--sh-xs);
        }
        .brand-filter:hover,
        .brand-filter:focus-visible {
          border-color: var(--brand);
          outline: none;
          box-shadow: var(--sh-glow);
        }
        .brand-filter.is-active {
          background: var(--brand-tint);
          border-color: var(--brand-100);
          color: var(--brand-700);
          font-weight: 700;
        }
        .brand-filter small {
          color: var(--t-tertiary);
          font-size: 11px;
        }
        .brand-filter.is-active small {
          color: var(--brand-700);
        }
        .site-list-panel {
          width: 100%;
          overflow: hidden;
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--sh-card);
        }
        .site-list-panel .workbench-table-shell {
          border: 0;
          border-top: 1px solid var(--border);
          border-radius: 0;
          box-shadow: none;
        }
        .site-list-head {
          min-height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .site-list-head h2 {
          margin: 2px 0 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--t-strong);
        }
        .site-list-head > span {
          font-size: 13px;
          color: var(--t-secondary);
        }
        .site-table-wrap {
          overflow: visible;
          width: 100%;
        }
        .site-table {
          width: 100%;
          min-width: 0;
          table-layout: fixed;
        }
        .site-table tr.is-archived td {
          color: var(--t-tertiary);
          background: rgba(234,230,223,0.45);
        }
        .site-table tr.is-group-site td:first-child {
          border-left: 3px solid var(--brand);
        }
        .site-brand-cell {
          display: grid;
          gap: 2px;
          min-width: 130px;
        }
        .site-brand-cell strong {
          font-size: 14px;
          color: var(--t-primary);
        }
        .site-brand-cell span {
          font-size: 12px;
          color: var(--t-tertiary);
        }
        .group-site-chip {
          width: max-content;
          padding: 2px 7px;
          border-radius: 999px;
          background: var(--brand-tint);
          color: var(--brand-700);
          font-size: 11px;
          font-style: normal;
          font-weight: 700;
        }
        .site-logo {
          width: 72px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: var(--r);
          background: var(--surface-1);
          overflow: hidden;
        }
        .site-logo img {
          display: block;
          max-width: 64px;
          max-height: 30px;
          object-fit: contain;
        }
        .site-logo-fallback {
          color: var(--brand-logo);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0;
        }
        .site-url-cell {
          display: grid;
          gap: 3px;
          min-width: 250px;
        }
        .site-url-cell a {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          max-width: 360px;
          color: var(--brand-700);
          font-weight: 600;
        }
        .site-url-cell a span,
        .site-url-cell > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-url-cell small {
          color: var(--t-tertiary);
          font-size: 11px;
        }
        .mono-cell {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }
        .row-actions {
          display: inline-flex;
          gap: 6px;
          white-space: nowrap;
        }
        .row-actions button,
        .dialog-close {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: var(--r);
          background: var(--surface-1);
          color: var(--t-secondary);
        }
        .row-actions button:hover,
        .row-actions button:focus-visible,
        .dialog-close:hover,
        .dialog-close:focus-visible {
          border-color: var(--brand);
          color: var(--brand-700);
          outline: none;
          box-shadow: 0 0 0 3px rgba(78,154,61,0.12);
        }
        .row-actions button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .row-actions button.danger-action:not(:disabled) {
          color: var(--danger);
          border-color: rgba(220,38,38,0.24);
        }
        .row-actions button.danger-action:not(:disabled):hover,
        .row-actions button.danger-action:not(:disabled):focus-visible {
          color: var(--danger);
          border-color: var(--danger);
          box-shadow: 0 0 0 3px rgba(220,38,38,0.12);
        }
        .table-empty {
          height: 128px;
          text-align: center;
          color: var(--t-tertiary);
        }
        .notice {
          margin-bottom: 12px;
          border-radius: var(--r-lg);
          padding: 10px 14px;
          font-size: 13px;
          border: 1px solid;
        }
        .notice.success {
          color: var(--success);
          background: var(--success-bg);
          border-color: rgba(120,157,74,0.28);
        }
        .notice.error {
          color: var(--danger);
          background: var(--danger-bg);
          border-color: rgba(220,38,38,0.22);
        }
        .site-dialog-backdrop {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(36,31,27,0.42);
        }
        .site-dialog {
          width: min(760px, 100%);
          max-height: min(760px, calc(100vh - 48px));
          overflow: auto;
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          box-shadow: var(--sh-modal);
        }
        .site-dialog-head {
          position: sticky;
          top: 0;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 20px 22px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-1);
        }
        .site-dialog-head h2 {
          margin: 0;
          font-size: 18px;
          color: var(--t-strong);
        }
        .site-dialog-head p {
          margin-top: 4px;
          font-size: 12px;
          color: var(--t-secondary);
        }
        .delete-site-dialog {
          max-width: 620px;
        }
        .delete-site-dialog-head {
          border-top: 4px solid var(--danger);
        }
        .delete-site-dialog-body {
          display: grid;
          gap: 16px;
          padding: 20px 22px 22px;
        }
        .delete-site-warning {
          display: flex;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(220,38,38,0.22);
          border-radius: var(--r-lg);
          background: var(--danger-bg);
          color: var(--danger);
        }
        .delete-site-warning div {
          display: grid;
          gap: 4px;
        }
        .delete-site-warning span {
          color: var(--t-secondary);
          font-size: 13px;
          line-height: 1.6;
        }
        .btn.btn-danger {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-color: var(--danger);
          background: var(--danger);
          color: #fff;
        }
        .btn.btn-danger:disabled {
          opacity: 0.48;
          cursor: not-allowed;
        }
        .site-form {
          display: grid;
          gap: 14px;
          padding: 20px 22px 22px;
        }
        .site-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .site-field {
          display: grid;
          gap: 6px;
        }
        .site-field.full {
          grid-column: 1 / -1;
        }
        .site-field label {
          font-size: 12px;
          font-weight: 700;
          color: var(--t-secondary);
        }
        .site-field textarea {
          min-height: 74px;
          resize: vertical;
        }
        .logo-upload-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .logo-upload-label {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border: 1px solid var(--border-2);
          border-radius: var(--r-sm);
          background: var(--surface-1);
          color: var(--t-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .logo-upload-label:hover,
        .logo-upload-label:focus-within {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(78,154,61,0.12);
        }
        .logo-upload-label input {
          display: none;
        }
        .site-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 4px;
        }
        @media (max-width: 900px) {
          .site-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .site-kpis,
          .site-form-grid {
            grid-template-columns: 1fr;
          }
          .brand-filter {
            flex: 1 1 150px;
          }
          .site-dialog-backdrop {
            align-items: stretch;
            padding: 12px;
          }
          .site-dialog {
            max-height: calc(100vh - 24px);
          }
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'muted';
}) {
  return (
    <div className={`site-stat ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: 'success' | 'error' }) {
  return <div className={`notice ${tone}`}>{children}</div>;
}

function LogoPreview({ site, src }: { site: BrandSite; src?: string }) {
  return (
    <div className="site-logo">
      {src ? (
        <img src={src} alt={`${site.nameCn || site.nameEn} Logo`} />
      ) : (
        <span className="site-logo-fallback">{site.nameEn || site.code}</span>
      )}
    </div>
  );
}

function DeleteSiteDialog({
  site,
  busy,
  onClose,
  onConfirm,
}: {
  site: BrandSite;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmCode, setConfirmCode] = useState('');
  const matched = confirmCode.trim() === site.code;
  return (
    <div className="site-dialog-backdrop" onClick={onClose}>
      <div
        className="site-dialog delete-site-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-site-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="site-dialog-head delete-site-dialog-head">
          <div>
            <p className="t-label">Platform admin only</p>
            <h2 id="delete-site-dialog-title">永久删除官网站点</h2>
            <p>{site.nameCn || site.nameEn} / {site.code}</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="delete-site-dialog-body">
          <div className="delete-site-warning">
            <ShieldAlert size={20} />
            <div>
              <strong>该操作不可恢复</strong>
              <span>删除后将移除官网入口、站点配置、Logo 绑定和集团子品牌绑定关系；子品牌站点与产品主数据不会被删除。</span>
            </div>
          </div>
          <label className="site-field">
            <span>输入站点 Code 确认删除</span>
            <input
              className="input"
              value={confirmCode}
              onChange={(event) => setConfirmCode(event.target.value)}
              placeholder={site.code}
              autoFocus
            />
          </label>
          <div className="site-dialog-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={!matched || busy}>
              <Trash2 size={15} />
              {busy ? '删除中' : '永久删除'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteDialog({
  brandCode,
  site,
  onClose,
  onDone,
  onError,
}: {
  brandCode: string;
  site: BrandSite | null;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<SiteForm>(() => (site ? fromSite(site) : blankForm(brandCode)));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof SiteForm>(key: K, value: SiteForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError('');
    try {
      const payload = toPayload(form, !site);
      const saved = site
        ? await brandSites.update(site.id, payload)
        : await brandSites.create(payload);
      if (logoFile) {
        await brandSites.uploadLogo(saved.id, await fileToLogoPayload(logoFile));
      }
      onDone(site ? '官网配置已更新' : '官网配置已创建');
    } catch (e) {
      onError((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="site-dialog-backdrop" onClick={onClose}>
      <div
        className="site-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="site-dialog-head">
          <div>
            <h2 id="site-dialog-title">{site ? '编辑官网站点' : '新增官网站点'}</h2>
            <p>{site ? `${site.nameCn} · ${site.nameEn}` : '官网主数据与发布状态'}</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <form className="site-form" onSubmit={submit}>
          <div className="site-form-grid">
            <Field label="品牌代码">
              <input
                className="input"
                value={form.code}
                onChange={(event) => setField('code', event.target.value.toLowerCase())}
                disabled={Boolean(site)}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
              />
            </Field>
            <Field label="发布状态">
              <select
                className="input"
                value={form.status}
                onChange={(event) => setField('status', event.target.value as SiteStatus)}
              >
                <option value="active">发布中</option>
                <option value="inactive">已停用</option>
              </select>
            </Field>
            <Field label="中文名称">
              <input
                className="input"
                value={form.nameCn}
                onChange={(event) => setField('nameCn', event.target.value)}
                required
              />
            </Field>
            <Field label="英文名称">
              <input
                className="input"
                value={form.nameEn}
                onChange={(event) => setField('nameEn', event.target.value)}
                required
              />
            </Field>
            <Field label="应用标识">
              <input
                className="input"
                value={form.appKey}
                onChange={(event) => setField('appKey', event.target.value)}
                placeholder="rheem-cn"
              />
            </Field>
            <Field label="交付类型">
              <select
                className="input"
                value={form.deliveryType}
                onChange={(event) => setField('deliveryType', event.target.value as DeliveryType)}
              >
                <option value="self_hosted">自建站</option>
                <option value="external">外部站</option>
              </select>
            </Field>
            <Field label="测试环境 URL">
              <input
                className="input"
                type="url"
                value={form.developmentUrl}
                onChange={(event) => setField('developmentUrl', event.target.value)}
              />
            </Field>
            <Field label="生产环境 URL">
              <input
                className="input"
                type="url"
                value={form.productionUrl}
                onChange={(event) => setField('productionUrl', event.target.value)}
              />
            </Field>
            <Field label="排序">
              <input
                className="input"
                type="number"
                min="0"
                max="9999"
                value={form.sortOrder}
                onChange={(event) => setField('sortOrder', event.target.value)}
              />
            </Field>
            <Field label="Logo">
              <div className="logo-upload-row">
                <label className="logo-upload-label">
                  <Upload size={15} />
                  选择 Logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                  />
                </label>
                <span className="t-footnote">{logoFile ? logoFile.name : '未选择新 Logo'}</span>
              </div>
            </Field>
            <Field label="备注" full>
              <textarea
                className="input"
                value={form.siteNote}
                onChange={(event) => setField('siteNote', event.target.value)}
              />
            </Field>
          </div>

          <div className="site-dialog-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-brand" disabled={saving}>
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'site-field full' : 'site-field'}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function fromSite(site: BrandSite): SiteForm {
  return {
    code: site.code,
    nameCn: site.nameCn || '',
    nameEn: site.nameEn || '',
    appKey: site.appKey || '',
    deliveryType: site.deliveryType || 'self_hosted',
    developmentUrl: site.developmentUrl || '',
    productionUrl: site.productionUrl || '',
    sortOrder: String(site.sortOrder ?? 0),
    status: site.status || 'active',
    siteNote: site.siteNote || '',
  };
}

function toPayload(form: SiteForm, creating: boolean) {
  const payload: Record<string, unknown> = {
    nameCn: form.nameCn.trim(),
    nameEn: form.nameEn.trim(),
    appKey: nullable(form.appKey),
    deliveryType: form.deliveryType,
    developmentUrl: nullable(form.developmentUrl),
    productionUrl: nullable(form.productionUrl),
    sortOrder: Number(form.sortOrder || 0),
    status: form.status,
    siteNote: nullable(form.siteNote),
  };
  if (creating) payload.code = form.code.trim().toLowerCase();
  return payload;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function fileToLogoPayload(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return {
    filename: file.name,
    mimeType: file.type || 'image/png',
    dataBase64: dataUrl,
  };
}
