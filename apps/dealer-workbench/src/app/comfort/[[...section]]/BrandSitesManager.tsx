'use client';

import {
  Edit3,
  ExternalLink,
  Globe2,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { brandSites } from '../../../lib/api';

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
  { code: 'all', label: '全部站点', tone: 'All' },
  { code: 'rheem', label: '瑞美 Rheem', tone: 'Rheem' },
  { code: 'ruud', label: '瑞德 Ruud', tone: 'Ruud' },
  { code: 'everhot', label: '恒热 Everhot', tone: 'Everhot' },
] as const;

const DEFAULT_FILTER = BRAND_OPTIONS[0];

const BRAND_PRESETS: Record<string, Partial<SiteForm>> = {
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
      window.dispatchEvent(new CustomEvent('rhautt-brand-sites-updated'));
      const logoEntries = await Promise.all(
        items
          .filter((site) => site.logoArtifactId && !site.deletedAt)
          .map(async (site) => {
            try {
              const logo = await brandSites.logo(site.id);
              if (!logo.dataBase64) return null;
              return [
                site.id,
                `data:${logo.mimeType || 'image/png'};base64,${logo.dataBase64}`,
              ] as const;
            } catch {
              return null;
            }
          })
      );
      setLogos(Object.fromEntries(logoEntries.filter(Boolean) as Array<readonly [string, string]>));
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

  const actions = (
    <>
      <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
        <RefreshCw size={15} />
        刷新
      </button>
      <button type="button" className="btn btn-brand" onClick={() => setCreating(true)}>
        <Plus size={15} />
        新增官网
      </button>
    </>
  );

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <div className="page-container brand-sites-page">
        <PageHeader
          title="品牌官网管理"
          subtitle="瑞美 Rheem / 瑞德 Ruud / 恒热 Everhot 官网主数据"
          actions={actions}
        />

        <section className="site-kpis" aria-label="官网状态汇总">
          <Stat label="站点总数" value={counts.total} />
          <Stat label="发布中" value={counts.active} tone="success" />
          <Stat label="已停用" value={counts.inactive} tone="warning" />
          <Stat label="已归档" value={counts.archived} tone="muted" />
        </section>

        <section className="brand-sites-toolbar" aria-label="品牌筛选">
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
        </section>

        {error && <Notice tone="error">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}

        <section className="card-elevated site-list-panel">
          <div className="site-list-head">
            <div>
              <p className="t-label">Official Sites</p>
              <h2>官网站点列表</h2>
            </div>
            <span>{filteredSites.length} 个站点</span>
          </div>

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
                      正在加载官网站点
                    </td>
                  </tr>
                ) : filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      暂无官网站点
                    </td>
                  </tr>
                ) : (
                  filteredSites.map((site) => {
                    const meta = statusMeta(site);
                    const url = displayUrl(site);
                    return (
                      <tr key={site.id} className={site.deletedAt ? 'is-archived' : undefined}>
                        <td>
                          <div className="site-brand-cell">
                            <strong>{site.nameCn}</strong>
                            <span>
                              {site.nameEn} · {site.code}
                            </span>
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
                          <span className={`badge ${meta.className}`}>{meta.label}</span>
                        </td>
                        <td className="mono-cell">{site.sortOrder}</td>
                        <td>
                          <div className="row-actions">
                            {site.deletedAt ? (
                              <button
                                type="button"
                                title="恢复"
                                aria-label={`恢复 ${site.nameCn} 官网配置`}
                                onClick={() => restoreSite(site)}
                                disabled={busyId === site.id}
                              >
                                <RotateCcw size={15} />
                              </button>
                            ) : (
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
                                <button
                                  type="button"
                                  title="归档"
                                  aria-label={`归档 ${site.nameCn} 官网配置`}
                                  onClick={() => archiveSite(site)}
                                  disabled={busyId === site.id}
                                >
                                  <Trash2 size={15} />
                                </button>
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
      </div>

      <style>{`
        .brand-sites-page {
          max-width: 1280px;
        }
        .site-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--s4);
          margin-bottom: var(--s5);
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
        .brand-sites-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: var(--s4);
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
          overflow: hidden;
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
          overflow-x: auto;
        }
        .site-table {
          min-width: 920px;
        }
        .site-table tr.is-archived td {
          color: var(--t-tertiary);
          background: rgba(234,230,223,0.45);
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
