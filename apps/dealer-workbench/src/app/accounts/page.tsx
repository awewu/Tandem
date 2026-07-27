'use client';
import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Ban, KeyRound, LockKeyhole, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { auth, adminUsers } from '../../lib/api';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchSectionHeader,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../components/WorkbenchCore';

/**
 * 账号管理（管理员）——统一登录体系的后台开户/权限维护入口。
 * 能力：列表 + 搜索/筛选、新建账号、改角色/停用启用、重置密码。
 * 可见性/权限由后端 @Roles 与租户 RLS 强制；此页仅做交互与 UX 门禁。
 */

type AdminUser = {
  id: string; name: string; role: string; status: 'active' | 'inactive' | 'suspended';
  identifierMasked: string; identifierKind?: 'email' | 'phone' | 'unknown'; isLocked: boolean; dealerId: string | null; storeId: string | null;
  lastLoginAt: string | null; createdAt: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  brand_admin: '品牌管理员',
  platform_admin: '平台超管', hq_admin: '总部管理员', regional_manager: '区域经理',
  dealer_admin: '经销商管理员', store_manager: '门店经理', designer: '设计师',
  sales: '销售', engineer: '工程师', installer: '安装工', customer: '客户',
};
// 品牌管理员可建/管全部角色；经销商管理员仅这几种。
const DEALER_ROLES = ['store_manager', 'sales', 'designer', 'engineer', 'installer'];
const ALL_ROLES = Object.keys(ROLE_LABEL);
const STATUS_LABEL: Record<string, string> = { active: '正常', inactive: '停用' };
const STATUS_TONE: Record<AdminUser['status'], 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'neutral',
};

const BRAND_ADMINS = ['platform_admin', 'hq_admin'];
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

function displayContact(user: AdminUser) {
  if (user.identifierMasked && user.identifierMasked !== '***') return user.identifierMasked;
  return '未绑定联系方式';
}

function displayStatus(status: AdminUser['status']) {
  return status === 'active' ? '正常' : '停用';
}

export default function AccountsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authed, setAuthed] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [fRole, setFRole] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [editRoleFor, setEditRoleFor] = useState<AdminUser | null>(null);

  const manageableRoles = role && BRAND_ADMINS.includes(role) ? ALL_ROLES : DEALER_ROLES;

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q: Record<string, string> = {};
      if (search) q.search = search;
      if (fRole) q.role = fRole;
      if (fStatus) q.status = fStatus;
      const res = await adminUsers.list(q);
      setUsers(res.users || []);
    } catch (e) { setErr((e as Error).message || '加载失败'); }
    finally { setLoading(false); }
  }, [search, fRole, fStatus]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      const [meResult, usersResult] = await Promise.allSettled([
        auth.me(),
        adminUsers.list(),
      ]);

      if (cancelled) return;
      if (meResult.status === 'rejected') {
        window.location.href = '/?returnUrl=' + encodeURIComponent('/accounts');
        return;
      }

      const me = meResult.value as { id?: string; role?: string };
      const r = me.role || null;
      setCurrentUserId(me.id || null);
      setRole(r);
      if (!r || ![...BRAND_ADMINS, 'dealer_admin'].includes(r)) {
        setAuthed('denied');
        setLoading(false);
        return;
      }

      setAuthed('ok');
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value.users || []);
      } else {
        setErr((usersResult.reason as Error).message || '加载失败');
      }
      setLoading(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 2500); }

  async function updateUser(u: AdminUser, patch: Record<string, unknown>) {
    setErr('');
    try { await adminUsers.update(u.id, patch); flash('已更新：' + u.name); load(); }
    catch (e) { setErr((e as Error).message || '更新失败'); }
  }

  async function deleteUser(u: AdminUser) {
    if (u.id === currentUserId) { setErr('不能删除当前登录账号'); return; }
    if (!window.confirm(`确认删除账号「${u.name}」？删除后不可在列表中恢复。`)) return;
    setErr('');
    try { await adminUsers.remove(u.id); flash('已删除：' + u.name); load(); }
    catch (e) { setErr((e as Error).message || '删除失败'); }
  }

  if (authed === 'denied') {
    return (
      <Center>
        <WorkbenchTableState
          type="error"
          title="当前角色无权访问账号管理"
          description="仅平台、总部、经销商管理员可以维护营销账号与权限。"
        />
      </Center>
    );
  }

  return (
    <div className="page-container" style={{ display: 'grid', gap: 18 }}>
      <WorkbenchSectionHeader
        eyebrow="营销工作台"
        title="营销账号与权限"
        description={`营销控制台账号、角色权限、状态与密码维护。当前身份：${role ? ROLE_LABEL[role] : ''}`}
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <a href="/comfort/sites" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} />
              品牌官网
            </a>
            <button onClick={() => setShowCreate(true)} disabled={authed !== 'ok'} className="btn btn-brand btn-sm">
              <Plus size={14} />
              新建账号
            </button>
          </div>
        }
      />

      <main style={{ display: 'grid', gap: 14 }}>
        {/* 筛选 */}
        <WorkbenchFilterToolbar className="accounts-filter-toolbar">
          <div style={{ position: 'relative', flex: '1 1 360px', minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-tertiary)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="搜索姓名 / 联系方式" className="input" style={{ width: '100%', paddingLeft: 34 }} />
          </div>
          <select value={fRole} onChange={(e) => setFRole(e.target.value)} className="select accounts-filter-toolbar__select">
            <option value="">全部角色</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="select accounts-filter-toolbar__select">
            <option value="">全部状态</option>
            {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button onClick={load} className="btn btn-outline btn-sm">
            <Search size={14} />
            查询
          </button>
          <span className="workbench-filter-toolbar__meta">共 {users.length} 个账号</span>
        </WorkbenchFilterToolbar>

        {err && <Banner tone="error">{err}</Banner>}
        {msg && <Banner tone="success">{msg}</Banner>}

        {/* 列表 */}
        <WorkbenchTableShell>
          <table className="table">
            <thead>
              <tr>
                <th>姓名</th><th>联系方式</th><th>角色</th><th>状态</th><th>最近登录</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><WorkbenchTableState type="loading" title="正在加载账号" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6}><WorkbenchTableState type="empty" title="暂无账号" description="调整筛选条件后可以重新查询。" /></td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}{u.isLocked && <span className="badge badge-warning" style={{ marginLeft: 6 }}><LockKeyhole size={12} />锁定</span>}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--t-secondary)' }}>{displayContact(u)}</td>
                  <td>
                    <span className="pill-neutral"><ShieldCheck size={12} />{ROLE_LABEL[u.role] || u.role}</span>
                  </td>
                  <td>
                    <StatusPill tone={STATUS_TONE[u.status]}>{displayStatus(u.status)}</StatusPill>
                  </td>
                  <td style={{ ...td, color: 'var(--t-tertiary)', fontSize: 12.5 }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN') : '—'}</td>
                  <td>
                    <div className="table-row-actions">
                      {u.status === 'active'
                        ? <button onClick={() => updateUser(u, { status: 'inactive' })} className="btn btn-outline btn-sm"><Ban size={13} />停用</button>
                        : <button onClick={() => updateUser(u, { status: 'active' })} className="btn btn-outline btn-sm"><RotateCcw size={13} />启用</button>}
                      <button onClick={() => setEditRoleFor(u)} className="btn btn-outline btn-sm"><UserRound size={13} />修改角色</button>
                      <button onClick={() => setResetFor(u)} className="btn btn-outline btn-sm"><KeyRound size={13} />重置密码</button>
                      <button onClick={() => deleteUser(u)} disabled={u.id === currentUserId} className="btn btn-danger btn-sm" title={u.id === currentUserId ? '不能删除当前登录账号' : '删除账号'} aria-label={`删除账号 ${u.name}`}><Trash2 size={13} />删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </WorkbenchTableShell>
      </main>

      {showCreate && <CreateModal roles={manageableRoles} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); flash('账号已创建'); load(); }} onError={setErr} />}
      {editRoleFor && <RoleModal user={editRoleFor} roles={manageableRoles} onClose={() => setEditRoleFor(null)} onDone={() => { setEditRoleFor(null); flash('角色已更新'); load(); }} onError={setErr} />}
      {resetFor && <ResetModal user={resetFor} onClose={() => setResetFor(null)} onDone={() => { setResetFor(null); flash('密码已重置'); }} onError={setErr} />}
    </div>
  );
}

function CreateModal({ roles, onClose, onDone, onError }: { roles: string[]; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [r, setR] = useState(roles[0] || 'sales');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!PHONE_PATTERN.test(phone)) { onError('请输入正确的手机号'); return; }
    if (!name.trim()) { onError('姓名必填'); return; }
    if (!r) { onError('请选择角色'); return; }
    if (password.length < 8) { onError('初始密码至少8位'); return; }
    setBusy(true); onError('');
    try { await adminUsers.create({ identifier: phone, phone, name, password, role: r }); onDone(); }
    catch (e) { onError((e as Error).message || '创建失败'); }
    finally { setBusy(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>新建账号</h3>
      <Field label="手机号">
        <input value={phone} onChange={(e) => setPhone(e.target.value.trim())} placeholder="请输入手机号" className="input" autoFocus />
      </Field>
      <Field label="姓名"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名称" className="input" /></Field>
      <Field label="角色">
        <select value={r} onChange={(e) => setR(e.target.value)} className="select">
          {roles.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
        </select>
      </Field>
      <Field label="初始密码（≥8位）"><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少8位" className="input" /></Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm"><Plus size={14} />{busy ? '创建中...' : '创建'}</button>
      </div>
    </Overlay>
  );
}

function RoleModal({ user, roles, onClose, onDone, onError }: { user: AdminUser; roles: string[]; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [r, setR] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const allowedRoles = roles.includes(user.role) ? roles : [user.role, ...roles];

  async function submit() {
    setBusy(true); onError('');
    try { await adminUsers.update(user.id, { role: r }); onDone(); }
    catch (e) { onError((e as Error).message || '角色更新失败'); }
    finally { setBusy(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>修改角色</h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--t-secondary)' }}>账号：{user.name}（{displayContact(user)}）</p>
      <Field label="角色">
        <select value={r} onChange={(e) => setR(e.target.value)} className="select">
          {allowedRoles.map((x) => <option key={x} value={x}>{ROLE_LABEL[x] || x}</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
        <button onClick={submit} disabled={busy || r === user.role} className="btn btn-brand btn-sm"><ShieldCheck size={14} />{busy ? '保存中...' : '确认保存'}</button>
      </div>
    </Overlay>
  );
}

function ResetModal({ user, onClose, onDone, onError }: { user: AdminUser; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (pwd.length < 8) { onError('新密码至少8位'); return; }
    setBusy(true); onError('');
    try { await adminUsers.resetPassword(user.id, pwd); onDone(); }
    catch (e) { onError((e as Error).message || '重置失败'); }
    finally { setBusy(false); }
  }
  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800 }}>重置密码</h3>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--t-secondary)' }}>为「{user.name}」（{displayContact(user)}）设置新密码。</p>
      <Field label="新密码（≥8位）"><input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="至少8位" className="input" autoFocus /></Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm"><KeyRound size={14} />{busy ? '重置中...' : '确认重置'}</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.46)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card-elevated" style={{ padding: 24, width: 'min(100%, 420px)', boxShadow: 'var(--sh-modal)' }}>{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--t-secondary)', marginBottom: 6 }}>{label}</label>{children}</div>;
}
function Banner({ children, tone }: { children: React.ReactNode; tone: 'success' | 'error' }) {
  return <div className={tone === 'success' ? 'badge badge-success' : 'badge badge-danger'} style={{ justifyContent: 'flex-start', whiteSpace: 'normal', overflowWrap: 'anywhere', padding: '10px 14px' }}>{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="page-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>;
}

const td: React.CSSProperties = { padding: '11px 16px', verticalAlign: 'middle' };
