'use client';
import { useEffect, useState, useCallback } from 'react';
import { auth, adminUsers } from '../../lib/api';

/**
 * 账号管理（管理员）——统一登录体系的后台开户/权限维护入口。
 * 能力：列表 + 搜索/筛选、新建账号、改角色/停用启用、重置密码。
 * 可见性/权限由后端 @Roles 与租户 RLS 强制；此页仅做交互与 UX 门禁。
 */

type AdminUser = {
  id: string; name: string; role: string; status: 'active' | 'inactive' | 'suspended';
  identifierMasked: string; isLocked: boolean; dealerId: string | null; storeId: string | null;
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
const STATUS_LABEL: Record<string, string> = { active: '正常', inactive: '停用', suspended: '封禁' };
const STATUS_COLOR: Record<string, string> = { active: '#16a34a', inactive: '#9ca3af', suspended: '#dc2626' };

const BRAND_ADMINS = ['platform_admin', 'hq_admin'];

export default function AccountsPage() {
  const [role, setRole] = useState<string | null>(null);
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

      const r = (meResult.value as { role?: string }).role || null;
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

  if (authed === 'denied') return <Center>当前角色无权访问账号管理（仅平台/总部/经销商管理员）。</Center>;

  return (
    <div style={{ minHeight: '100vh', background: '#F6F7F5', fontFamily: 'var(--font, system-ui)', color: '#241F1B' }}>
      {/* 顶栏 */}
      <header style={{ background: 'linear-gradient(120deg,#0E3F22,#1C6634)', color: '#fff', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>账号管理</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>后台开户 · 角色权限 · 状态与密码维护 · 当前身份：{role ? ROLE_LABEL[role] : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/hub" style={{ fontSize: 13, color: '#EAF7E4', textDecoration: 'none', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8 }}>← 返回 Hub</a>
          <button onClick={() => setShowCreate(true)} disabled={authed !== 'ok'} style={{ ...btnPrimary, opacity: authed === 'ok' ? 1 : 0.55 }}>+ 新建账号</button>
        </div>
      </header>

      <main style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 32px' }}>
        {/* 筛选 */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="搜索姓名 / 标识" style={{ ...input, width: 220 }} />
          <select value={fRole} onChange={(e) => setFRole(e.target.value)} style={input}>
            <option value="">全部角色</option>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={input}>
            <option value="">全部状态</option>
            {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <button onClick={load} style={btnGhost}>查询</button>
          <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: '#6b7280' }}>共 {users.length} 个账号</span>
        </div>

        {err && <Banner color="#dc2626" bg="#fef2f2">{err}</Banner>}
        {msg && <Banner color="#16a34a" bg="#f0fdf4">{msg}</Banner>}

        {/* 列表 */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#F0F3EE', textAlign: 'left', color: '#4b5563' }}>
                <th style={th}>姓名</th><th style={th}>标识</th><th style={th}>角色</th><th style={th}>状态</th><th style={th}>最近登录</th><th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>加载中…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 28, textAlign: 'center', color: '#9ca3af' }}>暂无账号</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={td}>{u.name}{u.isLocked && <span style={{ marginLeft: 6, fontSize: 11, color: '#dc2626' }}>🔒锁定</span>}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: '#6b7280' }}>{u.identifierMasked}</td>
                  <td style={td}>
                    <select value={u.role} onChange={(e) => updateUser(u, { role: e.target.value })} style={{ ...input, padding: '4px 8px', fontSize: 12.5 }}>
                      {manageableRoles.includes(u.role) ? null : <option value={u.role}>{ROLE_LABEL[u.role] || u.role}</option>}
                      {manageableRoles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[u.status] }} />
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                  <td style={{ ...td, color: '#9ca3af', fontSize: 12.5 }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN') : '—'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {u.status === 'active'
                        ? <button onClick={() => updateUser(u, { status: 'inactive' })} style={btnMini}>停用</button>
                        : <button onClick={() => updateUser(u, { status: 'active' })} style={{ ...btnMini, color: '#16a34a', borderColor: '#16a34a' }}>启用</button>}
                      {u.status !== 'suspended'
                        ? <button onClick={() => updateUser(u, { status: 'suspended' })} style={{ ...btnMini, color: '#dc2626', borderColor: '#fca5a5' }}>封禁</button>
                        : null}
                      <button onClick={() => setResetFor(u)} style={btnMini}>重置密码</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showCreate && <CreateModal roles={manageableRoles} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); flash('账号已创建'); load(); }} onError={setErr} />}
      {resetFor && <ResetModal user={resetFor} onClose={() => setResetFor(null)} onDone={() => { setResetFor(null); flash('密码已重置'); }} onError={setErr} />}
    </div>
  );
}

function CreateModal({ roles, onClose, onDone, onError }: { roles: string[]; onClose: () => void; onDone: () => void; onError: (m: string) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [r, setR] = useState(roles[0] || 'sales');
  const [busy, setBusy] = useState(false);
  const isBrandRole = ['platform_admin', 'hq_admin', 'brand_admin', 'regional_manager'].includes(r);

  async function submit() {
    if (!identifier || !password) { onError('账号与密码必填'); return; }
    setBusy(true); onError('');
    try { await adminUsers.create({ identifier, name, password, role: r }); onDone(); }
    catch (e) { onError((e as Error).message || '创建失败'); }
    finally { setBusy(false); }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 800 }}>新建账号</h3>
      <Field label={isBrandRole ? '企业邮箱（品牌员工须用 @rhautt.com/.local）' : '手机号 / 邮箱'}>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={isBrandRole ? 'name@rhautt.com' : '手机号或邮箱'} style={input} autoFocus />
      </Field>
      <Field label="姓名"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="显示名称" style={input} /></Field>
      <Field label="角色">
        <select value={r} onChange={(e) => setR(e.target.value)} style={input}>
          {roles.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}
        </select>
      </Field>
      <Field label="初始密码（≥8位）"><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少8位" style={input} /></Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnGhost}>取消</button>
        <button onClick={submit} disabled={busy} style={btnPrimary}>{busy ? '创建中…' : '创建'}</button>
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
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>为「{user.name}」（{user.identifierMasked}）设置新密码。</p>
      <Field label="新密码（≥8位）"><input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="至少8位" style={input} autoFocus /></Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={btnGhost}>取消</button>
        <button onClick={submit} disabled={busy} style={btnPrimary}>{busy ? '重置中…' : '确认重置'}</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: 380, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>{children}</div>;
}
function Banner({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return <div style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{children}</div>;
}
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: 14, padding: 24, textAlign: 'center' }}>{children}</div>;
}

const input: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13.5, background: '#fff', color: '#111', outline: 'none' };
const th: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 12.5 };
const td: React.CSSProperties = { padding: '11px 16px', verticalAlign: 'middle' };
const btnPrimary: React.CSSProperties = { background: '#4E9A3D', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 14px', fontSize: 13.5, cursor: 'pointer' };
const btnMini: React.CSSProperties = { background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' };
