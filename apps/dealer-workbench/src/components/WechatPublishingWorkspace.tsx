'use client';

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  X,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import { WorkbenchTableShell, WorkbenchTableState } from './WorkbenchCore';
import { auth, brandSites, wechatPublishing } from '../lib/api';

type Mode = 'accounts' | 'review' | 'drafts';

type WechatAccount = {
  id: string;
  brandId: string;
  displayName: string;
  originalId?: string | null;
  appIdMasked: string;
  status: string;
  connectionStatus: string;
  connectionErrorSummary?: string | null;
  lastTestedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  secretConfigured?: boolean;
};

type ReviewVersion = {
  id: string;
  versionNo: number;
  reviewStatus: string;
  wechatPayload: {
    title?: string;
    digest?: string;
    author?: string;
    contentHtml?: string;
    coverImage?: Record<string, unknown>;
  };
  targetSnapshot: {
    brandId?: string;
    brandName?: string;
    accountId?: string;
    accountName?: string;
    maskedAppId?: string;
  };
  submitterId: string;
  reviewerId?: string | null;
  reviewComment?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
};

type DraftTask = {
  id: string;
  reviewVersionId: string;
  accountId: string;
  syncStatus: string;
  attempts: number;
  wechatDraftId?: string | null;
  errorType?: string | null;
  errorSummary?: string | null;
  manualNote?: string | null;
  title?: string | null;
  versionNo?: number | null;
  reviewStatus?: string | null;
  targetSnapshot?: ReviewVersion['targetSnapshot'] | null;
  createdAt?: string | null;
  finishedAt?: string | null;
};

const BRANDS = [
  { id: 'rheem', label: 'Rheem 瑞美' },
  { id: 'ruud', label: 'Ruud 瑞德' },
  { id: 'everhot', label: 'Everhot 恒热' },
];

type BrandOption = { id: string; label: string };

function firstBrandId(options: BrandOption[]) {
  return options[0]?.id || BRANDS[0].id;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function statusBadge(status?: string | null) {
  const map: Record<string, { label: string; className: string }> = {
    enabled: { label: '已启用', className: 'badge badge-success' },
    disabled: { label: '已停用', className: 'badge badge-grey' },
    normal: { label: '连接正常', className: 'badge badge-success' },
    untested: { label: '未测试', className: 'badge badge-grey' },
    credential_error: { label: '凭证错误', className: 'badge badge-danger' },
    permission_error: { label: '权限不足', className: 'badge badge-warning' },
    ip_whitelist_error: { label: 'IP 白名单', className: 'badge badge-warning' },
    temporary_error: { label: '临时异常', className: 'badge badge-warning' },
    pending_review: { label: '待审核', className: 'badge badge-warning' },
    approved: { label: '审核通过', className: 'badge badge-success' },
    changes_requested: { label: '退回修改', className: 'badge badge-warning' },
    voided: { label: '已作废', className: 'badge badge-grey' },
    queued: { label: '已入队', className: 'badge badge-info' },
    syncing: { label: '同步中', className: 'badge badge-info' },
    succeeded: { label: '已进入草稿箱', className: 'badge badge-success' },
    failed: { label: '同步失败', className: 'badge badge-danger' },
    unconfirmed: { label: '结果待核对', className: 'badge badge-warning' },
    superseded: { label: '已被替代', className: 'badge badge-grey' },
  };
  const config = map[status || ''] || { label: status || '-', className: 'badge badge-grey' };
  return <span className={config.className}>{config.label}</span>;
}

function brandLabel(value?: string | null) {
  return BRANDS.find((brand) => brand.id === value)?.label || value || '-';
}

export default function WechatPublishingWorkspace({ mode }: { mode: Mode }) {
  const [accounts, setAccounts] = useState<WechatAccount[]>([]);
  const [reviews, setReviews] = useState<ReviewVersion[]>([]);
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [accountForm, setAccountForm] = useState({ displayName: '', brandId: 'rheem', appId: '', originalId: '', appSecret: '' });
  const [accountCreateOpen, setAccountCreateOpen] = useState(false);
  const [accountFilters, setAccountFilters] = useState({ keyword: '', brandId: 'all', status: 'all', connectionStatus: 'all' });
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>(BRANDS);
  const [secretAccount, setSecretAccount] = useState<WechatAccount | null>(null);
  const [secretValue, setSecretValue] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBrandFilter, setReviewBrandFilter] = useState('all');
  const [noteByTask, setNoteByTask] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'accounts') {
        const result = await wechatPublishing.accounts();
        setAccounts(Array.isArray(result?.items) ? result.items : []);
      } else if (mode === 'review') {
        const result = await wechatPublishing.pendingReviews();
        setReviews(Array.isArray(result?.items) ? result.items : []);
      } else {
        const result = await wechatPublishing.tasks();
        setTasks(Array.isArray(result?.items) ? result.items : []);
      }
    } catch (loadError) {
      setError((loadError as Error).message || '加载失败');
    } finally {
      setBusy(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    auth.me()
      .then((me) => setCurrentUserId(String(me?.userId || me?.id || '')))
      .catch(() => setCurrentUserId(''));
  }, []);

  useEffect(() => {
    let cancelled = false;
    brandSites.list()
      .then((result) => {
        if (cancelled) return;
        const items = Array.isArray(result?.items) ? result.items : [];
        const next = items
          .filter((site: any) => String(site?.status || 'active') === 'active')
          .map((site: any) => {
            const id = String(site?.code || '').trim().toLowerCase();
            const label = `${site?.nameCn || site?.name_cn || site?.nameEn || site?.name_en || id} ${site?.nameEn || site?.name_en || ''}`.trim();
            return id ? { id, label } : null;
          })
          .filter(Boolean) as BrandOption[];
        if (next.length) {
          setBrandOptions(next);
          setAccountForm((current) => (
            next.some((brand) => brand.id === current.brandId)
              ? current
              : { ...current, brandId: next[0].id }
          ));
        }
      })
      .catch(() => {
        if (!cancelled) setBrandOptions(BRANDS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const header = useMemo(() => {
    if (mode === 'accounts') {
      return {
        title: '发布账号配置',
        subtitle: '微信公众号 AppID、AppSecret、品牌绑定、连接测试与启停',
        icon: <Settings2 size={13} />,
      };
    }
    if (mode === 'review') {
      return {
        title: '内容审核',
        subtitle: '审核冻结后的微信公众号渠道稿，通过后自动创建草稿同步任务',
        icon: <CheckCircle2 size={13} />,
      };
    }
    return {
      title: '发布记录',
      subtitle: '查看微信公众号草稿同步状态、失败原因和人工处理备注',
      icon: <Send size={13} />,
    };
  }, [mode]);

  async function createAccount() {
    if (!accountForm.displayName || !accountForm.appId || !accountForm.appSecret) {
      setError('请填写公众号名称、AppID 和 AppSecret');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.createAccount(accountForm);
      setAccountForm({ displayName: '', brandId: firstBrandId(brandOptions), appId: '', originalId: '', appSecret: '' });
      setMessage('公众号配置已新增');
      await load();
    } catch (createError) {
      setError((createError as Error).message || '新增失败');
    } finally {
      setBusy(false);
    }
  }

  async function testConnection(id: string) {
    setBusy(true);
    setError('');
    try {
      const result = await wechatPublishing.testConnection(id);
      setMessage(result?.message || '连接测试完成');
      await load();
    } catch (testError) {
      setError((testError as Error).message || '连接测试失败');
    } finally {
      setBusy(false);
    }
  }

  async function updateSecret() {
    const appSecret = secretValue.trim();
    if (!secretAccount) return;
    if (!appSecret) {
      setError('请填写新的 AppSecret');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.updateSecret(secretAccount.id, appSecret);
      setSecretValue('');
      setSecretAccount(null);
      setMessage('AppSecret 已更新，请重新测试连接');
      await load();
    } catch (secretError) {
      setError((secretError as Error).message || 'AppSecret 更新失败');
    } finally {
      setBusy(false);
    }
  }

  async function updateAccountBasic(account: WechatAccount) {
    const displayName = window.prompt('公众号显示名称', account.displayName);
    if (displayName === null) return;
    const brandList = brandOptions.map((brand) => `${brand.id} (${brand.label})`).join(', ');
    const brandId = window.prompt(`品牌 ID：${brandList || '请先在品牌管理中新增品牌'}`, account.brandId);
    if (brandId === null) return;
    const originalId = window.prompt('原始 ID，如 gh_xxx', account.originalId || '');
    if (originalId === null) return;
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.updateAccount(account.id, {
        displayName: displayName.trim(),
        brandId: brandId.trim(),
        originalId: originalId.trim(),
      });
      setMessage('公众号基础信息已更新');
      await load();
    } catch (updateError) {
      setError((updateError as Error).message || '公众号基础信息更新失败');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(id: string, status: 'enabled' | 'disabled') {
    const verb = status === 'enabled' ? '启用' : '停用';
    if (status === 'disabled' && !window.confirm('停用后不能用于新提交或新审核通过，确认停用？')) return;
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.updateStatus(id, status);
      setMessage(`账号已${verb}`);
      await load();
    } catch (statusError) {
      setError((statusError as Error).message || `${verb}失败`);
    } finally {
      setBusy(false);
    }
  }

  async function approveReview(id: string) {
    if (!window.confirm('通过后将自动同步至指定公众号草稿箱，确认通过？')) return;
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.approveReview(id, reviewComment);
      setReviewComment('');
      setMessage('审核已通过，已创建草稿同步任务');
      await load();
    } catch (approveError) {
      setError((approveError as Error).message || '审核通过失败');
    } finally {
      setBusy(false);
    }
  }

  async function rejectReview(id: string, action: 'request' | 'void') {
    const reason = window.prompt(action === 'request' ? '请输入退回原因' : '请输入作废原因');
    if (!reason?.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (action === 'request') await wechatPublishing.requestChanges(id, reason.trim());
      else await wechatPublishing.voidReview(id, reason.trim());
      setMessage(action === 'request' ? '已退回修改' : '已作废');
      await load();
    } catch (rejectError) {
      setError((rejectError as Error).message || '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function processQueued() {
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.processQueuedTasks();
      setMessage('后台同步扫描已执行');
      await load();
    } catch (processError) {
      setError((processError as Error).message || '同步扫描失败');
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(id: string) {
    const note = (noteByTask[id] || '').trim();
    if (!note) {
      setError('请填写处理备注');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await wechatPublishing.addTaskNote(id, note);
      setMessage('处理备注已保存');
      await load();
    } catch (noteError) {
      setError((noteError as Error).message || '备注保存失败');
    } finally {
      setBusy(false);
    }
  }

  const filteredAccounts = useMemo(() => {
    const keyword = accountFilters.keyword.trim().toLowerCase();
    const labelByBrand = new Map(brandOptions.map((brand) => [brand.id, brand.label]));
    return accounts.filter((account) => {
      if (accountFilters.brandId !== 'all' && account.brandId !== accountFilters.brandId) return false;
      if (accountFilters.status !== 'all' && account.status !== accountFilters.status) return false;
      if (accountFilters.connectionStatus !== 'all' && account.connectionStatus !== accountFilters.connectionStatus) return false;
      if (!keyword) return true;
      return [
        account.displayName,
        labelByBrand.get(account.brandId) || brandLabel(account.brandId),
        account.appIdMasked,
        account.originalId || '',
        account.connectionErrorSummary || '',
      ].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [accounts, accountFilters, brandOptions]);

  const reviewBrandOptions = useMemo(() => {
    const seen = new Map<string, string>(brandOptions.map((brand) => [brand.id, brand.label]));
    for (const item of reviews) {
      const brandId = String(item.targetSnapshot?.brandId || '').trim();
      if (!brandId || seen.has(brandId)) continue;
      seen.set(brandId, String(item.targetSnapshot?.brandName || brandLabel(brandId)));
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [brandOptions, reviews]);

  const filteredReviews = useMemo(() => {
    if (reviewBrandFilter === 'all') return reviews;
    return reviews.filter((item) => item.targetSnapshot?.brandId === reviewBrandFilter);
  }, [reviews, reviewBrandFilter]);

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container growth-copywriter-page" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title={header.title}
          subtitle={header.subtitle}
          actions={<span className="badge badge-info">{header.icon}微信公众号草稿箱 MVP</span>}
        />

        {(message || error) ? (
          <div className="toolbar" role={error ? 'alert' : 'status'}>
            {message ? <span className="badge badge-success">{message}</span> : null}
            {error ? <span className="badge badge-warning">{error}</span> : null}
          </div>
        ) : null}

        {mode === 'accounts' ? (
          <>
            <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <p className="t-label">公众号账号管理</p>
                  <h2 className="t-headline" style={{ margin: 0 }}>账号列表</h2>
                </div>
                <div className="table-row-actions">
                  <button className="btn btn-outline btn-sm" onClick={load} disabled={busy}><RefreshCw size={13} />刷新</button>
                  <button
                    className="btn btn-brand btn-sm"
                    onClick={() => {
                      setAccountForm((current) => brandOptions.some((brand) => brand.id === current.brandId)
                        ? current
                        : { ...current, brandId: firstBrandId(brandOptions) });
                      setAccountCreateOpen(true);
                    }}
                    disabled={busy}
                  >
                    <Plus size={14} />新增公众号
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) repeat(3, minmax(150px, 1fr))', gap: 10 }}>
                <input className="input" placeholder="搜索公众号 / AppID / 原始 ID" value={accountFilters.keyword} onChange={(event) => setAccountFilters({ ...accountFilters, keyword: event.target.value })} />
                <select className="input" value={accountFilters.brandId} onChange={(event) => setAccountFilters({ ...accountFilters, brandId: event.target.value })}>
                  <option value="all">全部品牌</option>
                  {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
                </select>
                <select className="input" value={accountFilters.status} onChange={(event) => setAccountFilters({ ...accountFilters, status: event.target.value })}>
                  <option value="all">全部启用状态</option>
                  <option value="enabled">已启用</option>
                  <option value="disabled">已停用</option>
                </select>
                <select className="input" value={accountFilters.connectionStatus} onChange={(event) => setAccountFilters({ ...accountFilters, connectionStatus: event.target.value })}>
                  <option value="all">全部连接状态</option>
                  <option value="normal">连接正常</option>
                  <option value="untested">未测试</option>
                  <option value="credential_error">凭证错误</option>
                  <option value="ip_whitelist_error">IP 白名单</option>
                  <option value="permission_error">权限不足</option>
                  <option value="temporary_error">临时异常</option>
                </select>
              </div>
              <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>
                共 {accounts.length} 个账号，当前显示 {filteredAccounts.length} 个。新增账号会在弹窗中填写 AppID、AppSecret 和品牌绑定。
              </span>
            </section>
            <section className="card-elevated" style={{ padding: 18, display: 'none', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <p className="t-label">新增公众号</p>
                  <h2 className="t-headline" style={{ marginTop: 4 }}>账号配置</h2>
                </div>
                <button className="btn btn-outline btn-sm" onClick={load} disabled={busy}><RefreshCw size={13} />刷新</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">公众号显示名称</span>
                  <input className="input" placeholder="例如：cai先生的小宇宙" value={accountForm.displayName} onChange={(event) => setAccountForm({ ...accountForm, displayName: event.target.value })} />
                  <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于系统内识别账号，提交审核时显示给运营选择。</span>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">绑定品牌</span>
                  <select className="input" value={accountForm.brandId} onChange={(event) => setAccountForm({ ...accountForm, brandId: event.target.value })}>
                    {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
                  </select>
                  <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>决定哪些品牌文案可以提交到这个公众号。</span>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">AppID</span>
                  <input className="input" placeholder="微信开发者平台获取，wx 开头" value={accountForm.appId} onChange={(event) => setAccountForm({ ...accountForm, appId: event.target.value })} />
                  <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于后端调用微信接口获取 access_token。</span>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">原始 ID</span>
                  <input className="input" placeholder="可选，例如 gh_xxx" value={accountForm.originalId} onChange={(event) => setAccountForm({ ...accountForm, originalId: event.target.value })} />
                  <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于核对公众号身份；不参与接口鉴权。</span>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="t-label">AppSecret</span>
                  <input className="input" type="password" placeholder="只保存到后端，不明文展示" value={accountForm.appSecret} onChange={(event) => setAccountForm({ ...accountForm, appSecret: event.target.value })} />
                  <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于连接测试和写入草稿箱，保存后列表只显示已配置。</span>
                </label>
                <button className="btn btn-brand" onClick={createAccount} disabled={busy} style={{ minHeight: 40 }}><Plus size={14} />保存账号配置</button>
              </div>
              <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>
                AppSecret 只在提交时发送给后端保存，列表不会明文展示。测试连接前请先在微信开发者平台配置当前后端公网 IP 到 API IP 白名单。
              </span>
            </section>
            <AccountsTable
              items={filteredAccounts}
              busy={busy}
              brandOptions={brandOptions}
              onSecret={(account) => {
                setSecretAccount(account);
                setSecretValue('');
                setError('');
              }}
              onEdit={updateAccountBasic}
              onTest={testConnection}
              onStatus={updateStatus}
            />
            {accountCreateOpen ? (
              <AccountCreateDialog
                form={accountForm}
                busy={busy}
                brandOptions={brandOptions}
                onChange={setAccountForm}
                onClose={() => setAccountCreateOpen(false)}
                onSubmit={async () => {
                  await createAccount();
                }}
              />
            ) : null}
            {secretAccount ? (
              <SecretUpdateDialog
                account={secretAccount}
                value={secretValue}
                busy={busy}
                onChange={setSecretValue}
                onClose={() => {
                  setSecretAccount(null);
                  setSecretValue('');
                }}
                onSubmit={updateSecret}
              />
            ) : null}
          </>
        ) : null}

        {mode === 'review' ? (
          <ReviewTable
            items={filteredReviews}
            busy={busy}
            reviewComment={reviewComment}
            setReviewComment={setReviewComment}
            brandFilter={reviewBrandFilter}
            setBrandFilter={setReviewBrandFilter}
            brandOptions={reviewBrandOptions}
            totalCount={reviews.length}
            currentUserId={currentUserId}
            onApprove={approveReview}
            onReject={rejectReview}
          />
        ) : null}

        {mode === 'drafts' ? (
            <DraftTasksTable
              items={tasks}
              busy={busy}
              brandOptions={brandOptions}
            noteByTask={noteByTask}
            setNoteByTask={setNoteByTask}
            onProcess={processQueued}
            onSaveNote={saveNote}
            onRefresh={load}
          />
        ) : null}
      </div>
    </div>
  );
}

function AccountsTable({
  items,
  busy,
  brandOptions,
  onSecret,
  onEdit,
  onTest,
  onStatus,
}: {
  items: WechatAccount[];
  busy: boolean;
  brandOptions: BrandOption[];
  onSecret: (account: WechatAccount) => void;
  onEdit: (account: WechatAccount) => void;
  onTest: (id: string) => void;
  onStatus: (id: string, status: 'enabled' | 'disabled') => void;
}) {
  const labelByBrand = new Map(brandOptions.map((brand) => [brand.id, brand.label]));
  return (
    <WorkbenchTableShell>
      <table className="table">
        <thead>
          <tr>
            <th>公众号</th>
            <th>品牌</th>
            <th>AppID</th>
            <th>原始 ID</th>
            <th>密钥状态</th>
            <th>启用状态</th>
            <th>连接状态</th>
            <th>最近测试</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.displayName}</strong></td>
              <td>{labelByBrand.get(item.brandId) || brandLabel(item.brandId)}</td>
              <td>{item.appIdMasked}</td>
              <td>{item.originalId || '-'}</td>
              <td>
                <span className={item.secretConfigured ? 'badge badge-success' : 'badge badge-warning'}>
                  {item.secretConfigured ? '已配置' : '未配置'}
                </span>
              </td>
              <td>{statusBadge(item.status)}</td>
              <td>
                <div style={{ display: 'grid', gap: 4 }}>
                  {statusBadge(item.connectionStatus)}
                  {item.connectionErrorSummary ? <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>{item.connectionErrorSummary}</span> : null}
                </div>
              </td>
              <td>{formatDate(item.lastTestedAt)}</td>
              <td>
                <div className="table-row-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => onEdit(item)} disabled={busy}>编辑</button>
                  <button
                    className="btn btn-outline btn-sm icon-only"
                    onClick={() => onSecret(item)}
                    disabled={busy}
                    aria-label={`更新 ${item.displayName} 的 AppSecret`}
                    title="更新 AppSecret"
                  >
                    <KeyRound size={14} />
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => onTest(item.id)} disabled={busy}>测试</button>
                  {item.status === 'enabled' ? (
                    <button className="btn btn-outline btn-sm" onClick={() => onStatus(item.id, 'disabled')} disabled={busy}>停用</button>
                  ) : (
                    <button className="btn btn-brand btn-sm" onClick={() => onStatus(item.id, 'enabled')} disabled={busy || item.connectionStatus !== 'normal'}>启用</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {busy ? <tr><td colSpan={9}><WorkbenchTableState type="loading" title="加载中" /></td></tr> : null}
          {!busy && !items.length ? <tr><td colSpan={9}><WorkbenchTableState type="empty" title="暂无公众号配置" /></td></tr> : null}
        </tbody>
      </table>
    </WorkbenchTableShell>
  );
}

function AccountCreateDialog({
  form,
  busy,
  brandOptions,
  onChange,
  onClose,
  onSubmit,
}: {
  form: { displayName: string; brandId: string; appId: string; originalId: string; appSecret: string };
  busy: boolean;
  brandOptions: BrandOption[];
  onChange: (value: { displayName: string; brandId: string; appId: string; originalId: string; appSecret: string }) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(17,24,39,0.46)' }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="wechat-account-dialog-title"
        className="card-elevated"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        style={{ width: 'min(100%, 880px)', padding: 20, display: 'grid', gap: 18, boxShadow: 'var(--sh-modal)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'grid', gap: 5 }}>
            <span className="t-label">新增公众号</span>
            <h2 id="wechat-account-dialog-title" className="t-headline">保存账号配置</h2>
            <span style={{ color: 'var(--t-secondary)', fontSize: 13 }}>
              填写微信开发者平台中的 AppID、AppSecret，并绑定到业务品牌。
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm icon-only" onClick={onClose} disabled={busy} aria-label="关闭新增公众号弹窗" title="关闭">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(240px, 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span className="t-label">公众号显示名称</span>
            <input className="input" placeholder="例如：cai先生的小宇宙" value={form.displayName} onChange={(event) => onChange({ ...form, displayName: event.target.value })} disabled={busy} />
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于系统内识别账号，提交审核时显示给运营选择。</span>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span className="t-label">绑定品牌</span>
            <select className="input" value={form.brandId} onChange={(event) => onChange({ ...form, brandId: event.target.value })} disabled={busy}>
              {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
            </select>
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>决定哪些品牌文案可以提交到这个公众号。</span>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span className="t-label">AppID</span>
            <input className="input" placeholder="微信开发者平台获取，wx 开头" value={form.appId} onChange={(event) => onChange({ ...form, appId: event.target.value })} disabled={busy} />
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于后端调用微信接口获取 access_token。</span>
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span className="t-label">原始 ID</span>
            <input className="input" placeholder="可选，例如 gh_xxx" value={form.originalId} onChange={(event) => onChange({ ...form, originalId: event.target.value })} disabled={busy} />
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于核对公众号身份；不参与接口鉴权。</span>
          </label>
          <label style={{ display: 'grid', gap: 7, gridColumn: '1 / -1' }}>
            <span className="t-label">AppSecret</span>
            <input className="input" type="password" autoComplete="new-password" placeholder="只保存到后端，不明文展示" value={form.appSecret} onChange={(event) => onChange({ ...form, appSecret: event.target.value })} disabled={busy} />
            <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>用于连接测试和写入草稿箱，保存后列表只显示已配置。测试连接前请先在微信开发者平台配置当前后端公网 IP 到 API IP 白名单。</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>取消</button>
          <button type="submit" className="btn btn-brand" disabled={busy || !form.displayName.trim() || !form.appId.trim() || !form.appSecret.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            保存账号配置
          </button>
        </div>
      </form>
    </div>
  );
}

function SecretUpdateDialog({
  account,
  value,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  account: WechatAccount;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose]);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(17,24,39,0.46)' }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="wechat-secret-dialog-title"
        className="card-elevated"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        style={{ width: 'min(100%, 480px)', padding: 20, display: 'grid', gap: 18, boxShadow: 'var(--sh-modal)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'grid', gap: 5 }}>
            <span className="t-label">敏感凭证</span>
            <h2 id="wechat-secret-dialog-title" className="t-headline">更新 AppSecret</h2>
            <span style={{ color: 'var(--t-secondary)', fontSize: 13 }}>
              {account.displayName} · {account.appIdMasked}
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm icon-only" onClick={onClose} disabled={busy} aria-label="关闭更新密钥弹窗" title="关闭">
            <X size={18} />
          </button>
        </div>

        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ color: 'var(--t-primary)', fontSize: 13, fontWeight: 700 }}>新的 AppSecret</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="输入新的 AppSecret"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={busy}
          />
        </label>

        <p style={{ margin: 0, color: 'var(--t-secondary)', fontSize: 12, lineHeight: 1.6 }}>
          系统不会展示或回显已保存的密钥。更新后账号连接状态将重置，请重新执行连接测试。
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>取消</button>
          <button type="submit" className="btn btn-brand" disabled={busy || !value.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            更新密钥
          </button>
        </div>
      </form>
    </div>
  );
}

function ReviewTable({
  items,
  busy,
  reviewComment,
  setReviewComment,
  brandFilter,
  setBrandFilter,
  brandOptions,
  totalCount,
  currentUserId,
  onApprove,
  onReject,
}: {
  items: ReviewVersion[];
  busy: boolean;
  reviewComment: string;
  setReviewComment: (value: string) => void;
  brandFilter: string;
  setBrandFilter: (value: string) => void;
  brandOptions: Array<{ id: string; label: string }>;
  totalCount: number;
  currentUserId: string;
  onApprove: (id: string) => void;
  onReject: (id: string, action: 'request' | 'void') => void;
}) {
  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div className="toolbar">
        <FileText size={16} style={{ color: 'var(--brand)' }} />
        <select className="input" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} style={{ width: 180 }}>
          <option value="all">全部品牌</option>
          {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.label}</option>)}
        </select>
        <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>显示 {items.length} / {totalCount}</span>
        <span className="t-label">租户共享待审核池</span>
        <input className="input" placeholder="审核通过意见（可选）" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} style={{ minWidth: 260 }} />
      </div>
      <WorkbenchTableShell>
        <table className="table wechat-review-table">
          <colgroup>
            <col />
            <col style={{ width: 96 }} />
            <col style={{ width: 112 }} />
            <col style={{ width: 56 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 126 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 260 }} />
          </colgroup>
          <thead>
            <tr>
              <th>标题</th>
              <th>品牌</th>
              <th>公众号</th>
              <th>版本</th>
              <th>提交人</th>
              <th>提交时间</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="wechat-review-table__content">
                    <strong className="wechat-review-table__ellipsis">{item.wechatPayload?.title || '-'}</strong>
                    <span className="wechat-review-table__digest">{item.wechatPayload?.digest || '-'}</span>
                  </div>
                </td>
                <td>{item.targetSnapshot?.brandName || brandLabel(item.targetSnapshot?.brandId)}</td>
                <td>{item.targetSnapshot?.accountName || '-'}</td>
                <td>v{item.versionNo}</td>
                <td>{item.submitterId.slice(0, 8)}</td>
                <td>{formatDate(item.submittedAt)}</td>
                <td>{statusBadge(item.reviewStatus)}</td>
                <td>
                  <div className="table-row-actions wechat-review-table__actions">
                    <button className="btn btn-brand btn-sm" onClick={() => onApprove(item.id)} disabled={busy}><CheckCircle2 size={13} />通过</button>
                    <button className="btn btn-outline btn-sm" onClick={() => onReject(item.id, 'request')} disabled={busy}><Clock3 size={13} />退回</button>
                    <button className="btn btn-danger btn-sm" onClick={() => onReject(item.id, 'void')} disabled={busy}><XCircle size={13} />作废</button>
                  </div>
                </td>
              </tr>
            ))}
            {busy ? <tr><td colSpan={8}><WorkbenchTableState type="loading" title="加载中" /></td></tr> : null}
            {!busy && !items.length ? <tr><td colSpan={8}><WorkbenchTableState type="empty" title="暂无待审核内容" /></td></tr> : null}
          </tbody>
        </table>
      </WorkbenchTableShell>
    </section>
  );
}

function DraftTasksTable({
  items,
  busy,
  brandOptions,
  noteByTask,
  setNoteByTask,
  onProcess,
  onSaveNote,
  onRefresh,
}: {
  items: DraftTask[];
  busy: boolean;
  brandOptions: BrandOption[];
  noteByTask: Record<string, string>;
  setNoteByTask: (value: Record<string, string>) => void;
  onProcess: () => void;
  onSaveNote: (id: string) => void;
  onRefresh: () => void;
}) {
  const labelByBrand = new Map(brandOptions.map((brand) => [brand.id, brand.label]));
  const oneLine: CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div className="toolbar">
        <button className="btn btn-outline btn-sm" onClick={onRefresh} disabled={busy}><RefreshCw size={13} />刷新</button>
        <button className="btn btn-brand btn-sm" onClick={onProcess} disabled={busy}><Loader2 size={13} />执行同步扫描</button>
        <span style={{ color: 'var(--t-secondary)', fontSize: 12 }}>执行后会上传封面素材并创建微信公众平台草稿</span>
      </div>
      <WorkbenchTableShell>
        <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '34%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '23%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={oneLine}>文案</th>
              <th style={oneLine}>品牌/公众号</th>
              <th style={oneLine}>同步状态</th>
              <th style={oneLine}>微信草稿标识</th>
              <th style={oneLine}>失败原因</th>
              <th style={oneLine}>同步时间</th>
              <th style={oneLine}>人工备注</th>
              <th style={oneLine}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td title={`${item.title || item.reviewVersionId} v${item.versionNo || '-'}`}>
                  <div style={oneLine}><strong>{item.title || item.reviewVersionId.slice(0, 8)}</strong></div>
                  <span style={{ ...oneLine, display: 'block', color: 'var(--t-secondary)', fontSize: 12 }}>v{item.versionNo || '-'}</span>
                </td>
                <td title={`${item.targetSnapshot?.brandName || labelByBrand.get(String(item.targetSnapshot?.brandId || '')) || brandLabel(item.targetSnapshot?.brandId)} / ${item.targetSnapshot?.accountName || item.accountId}`}>
                  <div style={oneLine}>{item.targetSnapshot?.brandName || labelByBrand.get(String(item.targetSnapshot?.brandId || '')) || brandLabel(item.targetSnapshot?.brandId)}</div>
                  <span style={{ ...oneLine, display: 'block', color: 'var(--t-secondary)', fontSize: 12 }}>{item.targetSnapshot?.accountName || item.accountId.slice(0, 8)}</span>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{statusBadge(item.syncStatus)}</td>
                <td title={item.wechatDraftId || '-'} style={oneLine}>{item.wechatDraftId || '-'}</td>
                <td title={item.errorSummary || '-'} style={oneLine}>{item.errorSummary || '-'}</td>
                <td style={oneLine} title={formatDate(item.finishedAt || item.createdAt)}>{formatDate(item.finishedAt || item.createdAt)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {['failed', 'unconfirmed'].includes(item.syncStatus) ? (
                    <input
                      className="input"
                      placeholder={item.manualNote || '记录人工处理备注'}
                      value={noteByTask[item.id] || ''}
                      onChange={(event) => setNoteByTask({ ...noteByTask, [item.id]: event.target.value })}
                      style={{ width: '100%', minWidth: 0 }}
                    />
                  ) : (item.manualNote || '-')}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {['failed', 'unconfirmed'].includes(item.syncStatus) ? (
                    <button className="btn btn-outline btn-sm" onClick={() => onSaveNote(item.id)} disabled={busy}>保存备注</button>
                  ) : <span style={{ color: 'var(--t-tertiary)' }}>-</span>}
                </td>
              </tr>
            ))}
            {busy ? <tr><td colSpan={8}><WorkbenchTableState type="loading" title="加载中" /></td></tr> : null}
            {!busy && !items.length ? <tr><td colSpan={8}><WorkbenchTableState type="empty" title="暂无发布记录" /></td></tr> : null}
          </tbody>
        </table>
      </WorkbenchTableShell>
    </section>
  );
}
