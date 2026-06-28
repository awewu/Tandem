'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, Server, AlertTriangle, ShieldCheck } from 'lucide-react';

interface McpServer {
  name: string;
  description: string;
  transport: 'stdio' | 'http' | 'sse' | 'websocket';
  endpoint: string;
  authHeader?: string;
  mode: 'stub' | 'live';
  enabled: boolean;
  requireBaselineGuard: boolean;
  requireOkrDriftCheck: boolean;
  dataScope: string;
  actionScope: string;
}

const BLANK: McpServer = {
  name: '', description: '', transport: 'http', endpoint: '', authHeader: '',
  mode: 'stub', enabled: false, requireBaselineGuard: true, requireOkrDriftCheck: false,
  dataScope: '', actionScope: '',
};

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? 'bg-brand-500' : 'bg-surface-3 border border-hairline'}`}
        onClick={() => onChange(!value)}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-caption text-ink-primary">{label}</span>
    </label>
  );
}

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [draft, setDraft] = useState<McpServer | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/admin/mcp-servers', { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) { setErrMsg(j.error ?? `HTTP ${res.status}`); setStatus('error'); return; }
      setServers(j.servers ?? []);
      setStatus('ok');
    } catch (e) {
      setErrMsg((e as Error).message);
      setStatus('error');
    }
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setErrMsg('');
    try {
      const res = await fetch('/api/admin/mcp-servers', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setDraft(null);
      await load();
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(name: string) {
    if (!confirm(`确认删除 MCP server "${name}"?`)) return;
    await fetch(`/api/admin/mcp-servers?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await load();
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-64 text-ink-secondary"><Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…</div>;
  }

  const set = <K extends keyof McpServer>(k: K, v: McpServer[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-3 font-bold text-ink-primary flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-500" /> MCP Server 管理
          </h1>
          <p className="text-caption text-ink-secondary mt-0.5">
            配置外部 MCP server, 中央 AI 即可调用其工具 (经 Skill Gateway 4 道闸)。保存后即时生效。
          </p>
        </div>
        {!draft && (
          <button
            onClick={() => setDraft({ ...BLANK })}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-caption font-medium"
          >
            <Plus className="w-4 h-4" /> 新增
          </button>
        )}
      </div>

      {errMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-danger bg-danger/5 px-4 py-3 text-caption text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {errMsg}
        </div>
      )}

      {draft && (
        <div className="rounded-2xl border border-hairline bg-surface-1 p-5 space-y-4">
          <h2 className="text-caption font-semibold text-ink-primary">{draft.name ? `编辑 ${draft.name}` : '新增 MCP Server'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="名称 (唯一, 字母/数字/_/-)" value={draft.name} onChange={(v) => set('name', v.replace(/[^a-zA-Z0-9_-]/g, ''))} placeholder="github" />
            <Field label="描述" value={draft.description} onChange={(v) => set('description', v)} placeholder="GitHub 只读 MCP" />
            <div className="flex flex-col gap-1">
              <label className="text-footnote text-ink-secondary font-medium">Transport</label>
              <select value={draft.transport} onChange={(e) => set('transport', e.target.value as McpServer['transport'])}
                className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="http">http (streamableHttp)</option>
                <option value="sse">sse</option>
                <option value="stdio">stdio (本地子进程)</option>
                <option value="websocket">websocket</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-footnote text-ink-secondary font-medium">模式</label>
              <select value={draft.mode} onChange={(e) => set('mode', e.target.value as McpServer['mode'])}
                className="rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="stub">stub (不实连, 安全默认)</option>
                <option value="live">live (真连 + 自动发现工具)</option>
              </select>
            </div>
            <Field label={draft.transport === 'stdio' ? '命令 (endpoint)' : 'URL (endpoint)'} value={draft.endpoint} onChange={(v) => set('endpoint', v)} placeholder={draft.transport === 'stdio' ? 'npx' : 'https://mcp.example.com/sse'} />
            <Field label="Authorization 头 (可选)" value={draft.authHeader ?? ''} onChange={(v) => set('authHeader', v)} placeholder="Bearer xxx（留空沿用已存值）" />
            <Field label="dataScope (逗号分隔工具名前缀, 空=不限)" value={draft.dataScope} onChange={(v) => set('dataScope', v)} placeholder="list_,get_,read_" />
            <Field label="actionScope (逗号分隔, 空=不限)" value={draft.actionScope} onChange={(v) => set('actionScope', v)} placeholder="search_" />
          </div>
          <div className="flex flex-wrap items-center gap-5 pt-1">
            <Toggle label="启用" value={draft.enabled} onChange={(v) => set('enabled', v)} />
            <Toggle label="Baseline 守门" value={draft.requireBaselineGuard} onChange={(v) => set('requireBaselineGuard', v)} />
            <Toggle label="OKR 漂移检查" value={draft.requireOkrDriftCheck} onChange={(v) => set('requireOkrDriftCheck', v)} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving || !draft.name || (draft.transport !== 'stdio' && !draft.endpoint)}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-caption font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
            </button>
            <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-md border border-hairline text-caption text-ink-primary hover:bg-surface-2">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {servers.length === 0 && !draft && (
          <p className="text-caption text-ink-secondary text-center py-8">还没有配置 MCP server。点"新增"接入第一个。</p>
        )}
        {servers.map((s) => (
          <div key={s.name} className="rounded-2xl border border-hairline bg-surface-1 p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-caption font-semibold text-ink-primary font-mono">{s.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.enabled ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-surface-3 text-ink-secondary'}`}>{s.enabled ? '已启用' : '已停用'}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-3 text-ink-secondary font-mono">{s.transport} · {s.mode}</span>
                {s.requireBaselineGuard && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 inline-flex items-center gap-0.5"><ShieldCheck className="w-3 h-3" /> 守门</span>}
              </div>
              <p className="text-footnote text-ink-secondary mt-1 truncate">{s.description || '—'}</p>
              <p className="text-footnote text-ink-secondary font-mono truncate">{s.endpoint}</p>
              {(s.dataScope || s.actionScope) && (
                <p className="text-footnote text-ink-secondary mt-0.5">scope: {[s.dataScope && `data=${s.dataScope}`, s.actionScope && `action=${s.actionScope}`].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setDraft({ ...s, authHeader: '' })} className="px-3 py-1.5 rounded-md border border-hairline text-footnote text-ink-primary hover:bg-surface-2">编辑</button>
              <button onClick={() => remove(s.name)} className="p-1.5 rounded-md border border-hairline text-rose-600 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-footnote text-ink-secondary font-medium">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );
}
