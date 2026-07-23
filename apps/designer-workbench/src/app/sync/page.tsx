'use client';
import { useEffect, useState } from 'react';
import '../globals.css';
import { getToken, setToken } from '@rhautt/shared-auth';
import { auth, sync, type SyncStatus, type SyncLink, type SyncState } from '../../lib/api';

const STATE_LABEL: Record<SyncState, string> = {
  in_sync: '已同步',
  stale: '已过期',
  proposed_change: '待确认变更',
};

export default function SyncPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('13900000002');
  const [password, setPassword] = useState('Design@2026');
  const [loginErr, setLoginErr] = useState('');

  const [designId, setDesignId] = useState('');
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // 工具面板入参
  const [linkArtifact, setLinkArtifact] = useState('');
  const [linkVersion, setLinkVersion] = useState('v1');
  const [newVersion, setNewVersion] = useState('');
  const [confirmVersion, setConfirmVersion] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    if (!t) { setAuthed(false); return; }
    auth.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  async function doLogin() {
    setLoginErr('');
    try {
      const r = await auth.login(phone, password);
      if (r?.token) { localStorage.setItem('token', r.token); setToken(r.token); setAuthed(true); }
      else setLoginErr('登录失败：无 token');
    } catch (e: any) { setLoginErr(e.message || '登录失败'); }
  }

  async function refresh() {
    if (!designId.trim()) { setErr('请输入 design 版本主键（designId）'); return; }
    setBusy(true); setErr(''); setMsg('');
    try { setStatus(await sync.status(designId.trim())); }
    catch (e: any) { setErr(e.message || '查询失败'); }
    finally { setBusy(false); }
  }

  async function act(label: string, fn: () => Promise<any>) {
    setBusy(true); setErr(''); setMsg('');
    try {
      await fn();
      setMsg(label + '成功');
      if (designId.trim()) setStatus(await sync.status(designId.trim()));
    } catch (e: any) { setErr(e.message || (label + '失败')); }
    finally { setBusy(false); }
  }

  if (authed === null) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>加载中…</div>;

  if (!authed) {
    return (
      <div className="dw-auth">
        <div className="dw-card" style={{ width: 360 }}>
          <div className="dw-h1">设计师登录</div>
          <div className="dw-sub" style={{ marginBottom: 20 }}>瑞诺瓦 · M12 同步真相源</div>
          <input className="dw-input" placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="dw-input" type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginErr && <div className="dw-err">{loginErr}</div>}
          <button className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={doLogin}>登录</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dw-page">
      <header className="dw-topbar">
        <div>
          <div className="dw-h1">M12 · 同步真相源</div>
          <div className="dw-sub">design 为真相源 · Rysnova 深化产物派生登记 · 变更禁止静默分叉</div>
        </div>
        <a className="dw-link" href="/">← 返回工作台</a>
      </header>

      <div className="dw-grid">
        {/* 左：查询 + 工具 */}
        <section className="dw-card">
          <div className="dw-h2">查询同步状态</div>
          <label className="dw-label">design 主键（designId）</label>
          <input className="dw-input" placeholder="例如 design-project-uuid" value={designId} onChange={(e) => setDesignId(e.target.value)} />
          <button className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={busy} onClick={refresh}>
            {busy ? '查询中…' : '查询状态'}
          </button>
          {err && <div className="dw-err">{err}</div>}
          {msg && <div style={{ color: 'var(--success)', fontSize: 13, margin: '8px 0' }}>{msg}</div>}

          <div className="dw-disclaimer" style={{ marginTop: 20 }}>
            工具面板：账本为空时可先登记一条派生产物，再演示「变更置过期 → 工程回流建议 → 确认回同步」闭环。
          </div>

          <div className="dw-h2" style={{ marginTop: 20 }}>① 登记派生产物</div>
          <label className="dw-label">artifactId（Rysnova 深化产物）</label>
          <input className="dw-input" placeholder="artifact-uuid" value={linkArtifact} onChange={(e) => setLinkArtifact(e.target.value)} />
          <label className="dw-label">artifactVersion</label>
          <input className="dw-input" value={linkVersion} onChange={(e) => setLinkVersion(e.target.value)} />
          <button className="dw-btn" style={{ marginTop: 10 }} disabled={busy || !designId.trim() || !linkArtifact.trim()}
            onClick={() => act('登记', () => sync.link({ designId: designId.trim(), designVersion: status?.links?.[0]?.designVersion || 'v1', artifactId: linkArtifact.trim(), artifactVersion: linkVersion }))}>
            登记为派生（in_sync）
          </button>

          <div className="dw-h2" style={{ marginTop: 20 }}>② 模拟 design 变更</div>
          <label className="dw-label">新 design 版本号</label>
          <input className="dw-input" placeholder="例如 v2" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} />
          <button className="dw-btn dw-btn-warn" style={{ marginTop: 10 }} disabled={busy || !designId.trim() || !newVersion.trim()}
            onClick={() => act('置过期', () => sync.designChanged(designId.trim(), newVersion.trim()))}>
            真相源变更 → 派生全部置过期
          </button>
        </section>

        {/* 右：状态视图 */}
        <section className="dw-card">
          {!status ? (
            <div className="dw-empty">输入 designId 查询该设计的同步账本与逐产物状态。</div>
          ) : (
            <>
              <div className="dw-h2">同步概览</div>
              <div className="dw-loadrow">
                <div><span className="dw-num">{status.artifacts}</span><span className="dw-unit"> 派生产物</span></div>
                <div className="dw-tag">真相源：{status.sourceOfTruth}</div>
                <div className={`dw-gate ${status.allInSync ? 'pass' : 'block'}`} style={{ padding: '6px 12px' }}>
                  <span className="dw-gate-dot" />
                  {status.allInSync ? '全部已同步' : '存在过期 / 待确认'}
                </div>
              </div>

              <div className="dw-sync-counts">
                {(['in_sync', 'stale', 'proposed_change'] as SyncState[]).map((s) => (
                  <div key={s} className={`dw-sync-count ${s}`}>
                    <div className="dw-sync-count-n">{status.states[s] ?? 0}</div>
                    <div className="dw-sync-count-l">{STATE_LABEL[s]}</div>
                  </div>
                ))}
              </div>

              <div className="dw-h2" style={{ marginTop: 20 }}>派生产物明细</div>
              {status.links.length === 0 ? (
                <div className="dw-empty-sm">该 design 暂无登记派生产物。可用左侧「① 登记派生产物」创建。</div>
              ) : (
                <div className="dw-sync-list">
                  {status.links.map((l) => (
                    <LinkRow key={l.syncId} link={l}
                      confirmVersion={confirmVersion[l.syncId] ?? ''}
                      onConfirmVersionChange={(v) => setConfirmVersion((p) => ({ ...p, [l.syncId]: v }))}
                      busy={busy}
                      onPropose={() => act('回流建议', () => sync.proposeChange(l.syncId, { note: 'Rysnova 工程修正回流', at: new Date().toISOString() }))}
                      onConfirm={() => act('确认变更', () => sync.confirm(l.syncId, (confirmVersion[l.syncId] || l.designVersion)))}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function LinkRow({ link, confirmVersion, onConfirmVersionChange, busy, onPropose, onConfirm }: {
  link: SyncLink; confirmVersion: string; onConfirmVersionChange: (v: string) => void;
  busy: boolean; onPropose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="dw-sync-item">
      <div className="dw-sync-item-head">
        <span className={`dw-sync-badge ${link.syncState}`}>{STATE_LABEL[link.syncState]}</span>
        <span className="dw-sync-artifact">{link.artifactId || '（未指定产物）'}</span>
        <span className="dw-sync-ver">产物 {link.artifactVersion || '—'} · 锚定 design {link.designVersion}</span>
      </div>
      <div className="dw-sync-item-meta">
        更新 {new Date(link.updatedAt).toLocaleString('zh-CN')}
        {link.reviewedBy && <> · 复核 {link.reviewedBy}</>}
      </div>
      {link.changeProposal && (
        <pre className="dw-sync-proposal">{JSON.stringify(link.changeProposal, null, 2)}</pre>
      )}
      <div className="dw-sync-actions">
        {link.syncState === 'stale' && (
          <button className="dw-btn" disabled={busy} onClick={onPropose}>提交工程回流建议</button>
        )}
        {link.syncState === 'proposed_change' && (
          <>
            <input className="dw-input" style={{ width: 120, margin: 0 }} placeholder="新 design 版本"
              value={confirmVersion} onChange={(e) => onConfirmVersionChange(e.target.value)} />
            <button className="dw-btn dw-btn-primary" disabled={busy} onClick={onConfirm}>确认变更 → 回同步</button>
          </>
        )}
      </div>
    </div>
  );
}
