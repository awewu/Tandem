'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LayoutGrid,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff,
  Briefcase,
  MessagesSquare,
  GraduationCap,
  Sparkles,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import type { LaunchpadApp, LaunchpadCategory, LaunchpadStats } from '@/lib/types/launchpad';

type AppWithStats = LaunchpadApp & { stats: LaunchpadStats };

const CATEGORY_META: Record<LaunchpadCategory, { label: string; icon: typeof Briefcase; cls: string }> = {
  business: { label: '业务系统', icon: Briefcase, cls: 'bg-blue-100 text-blue-700' },
  comm: { label: '通讯协同', icon: MessagesSquare, cls: 'bg-emerald-100 text-emerald-700' },
  learning: { label: '学习工具', icon: GraduationCap, cls: 'bg-purple-100 text-purple-700' },
  custom: { label: '自定义', icon: Sparkles, cls: 'bg-warning/10 text-warning' },
};

export default function LaunchpadAdminPage() {
  const [apps, setApps] = useState<AppWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/launchpad');
      if (r.ok) {
        const d = await r.json();
        setApps(d.apps ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(id: string, direction: -1 | 1) {
    const sorted = [...apps].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((a) => a.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const aA = sorted[idx];
    const aB = sorted[swapIdx];
    setBusy(id);
    try {
      await fetch('/api/admin/launchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderMap: [
            { id: aA.id, order: aB.order },
            { id: aB.id, order: aA.order },
          ],
        }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function toggleStatus(app: AppWithStats) {
    setBusy(app.id);
    try {
      await fetch(`/api/launchpad/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: app.status === 'active' ? 'disabled' : 'active' }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('确认删除该跳板卡片？此操作不可撤销。')) return;
    setBusy(id);
    try {
      await fetch(`/api/launchpad/${id}`, { method: 'DELETE' });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:px-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-title-3 font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-brand-600" /> Launchpad 跳板配置
          </h1>
          <p className="text-caption text-slate-500 mt-1">
            3 分类 · 部门权限 · SSO 一键 · AI 今日推荐 · 使用统计
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-caption font-medium hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> 新建卡片
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : apps.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">尚未配置任何跳板卡片</p>
          <p className="text-footnote text-slate-400 mt-1">点击右上角&ldquo;新建&rdquo;添加 ERP/CRM/IM/Wiki 等系统</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((app, idx, arr) => {
              const meta = CATEGORY_META[app.category];
              const Icon = meta.icon;
              return (
                <div
                  key={app.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 bg-white ${
                    app.status === 'disabled' ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.cls}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{app.name}</span>
                      <span className={`text-footnote px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {app.ssoMode !== 'none' && (
                        <span className="text-footnote px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          SSO · {app.ssoMode}
                        </span>
                      )}
                      {app.visibleTo.length > 0 && (
                        <span className="text-footnote px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                          限 {app.visibleTo.length} 个部门
                        </span>
                      )}
                    </div>
                    <div className="text-footnote text-slate-500 mt-1 truncate">
                      {app.url} {app.description ? `· ${app.description}` : ''}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-footnote text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        累计 {app.stats.totalClicks} 次 · {app.stats.uniqueUsers} 人 · 近 7 天 {app.stats.last7DaysClicks} 次
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(app.id, -1)}
                      disabled={idx === 0 || busy === app.id}
                      className="p-2 rounded hover:bg-slate-100 disabled:opacity-30"
                      title="上移"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(app.id, 1)}
                      disabled={idx === arr.length - 1 || busy === app.id}
                      className="p-2 rounded hover:bg-slate-100 disabled:opacity-30"
                      title="下移"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(app)}
                      disabled={busy === app.id}
                      className="p-2 rounded hover:bg-slate-100"
                      title={app.status === 'active' ? '禁用' : '启用'}
                    >
                      {app.status === 'active' ? (
                        <Power className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <PowerOff className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(app.id);
                        setShowForm(true);
                      }}
                      className="px-3 py-1.5 text-footnote font-medium rounded hover:bg-slate-100"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(app.id)}
                      disabled={busy === app.id}
                      className="p-2 rounded hover:bg-rose-50 text-rose-600"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {showForm && (
        <LaunchpadForm
          editingId={editingId}
          existing={apps}
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form (create / edit)
// ---------------------------------------------------------------------------

function LaunchpadForm({
  editingId,
  existing,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  existing: LaunchpadApp[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = editingId ? existing.find((a) => a.id === editingId) ?? null : null;
  const [form, setForm] = useState<Partial<LaunchpadApp>>(
    editing ?? {
      category: 'business',
      name: '',
      description: '',
      url: '',
      iconUrl: '',
      ssoMode: 'none',
      visibleTo: [],
      visibleToRoles: [],
      recommendKeywords: [],
      order: existing.length,
      status: 'active',
    },
  );
  const [saving, setSaving] = useState(false);

  function update<K extends keyof LaunchpadApp>(k: K, v: LaunchpadApp[K] | undefined) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.name || !form.url) {
      alert('名称和链接必填');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/launchpad/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/launchpad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-headline font-bold">{editing ? '编辑跳板卡片' : '新建跳板卡片'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="名称 *">
            <input
              value={form.name ?? ''}
              onChange={(e) => update('name', e.target.value)}
              placeholder="金蝶 ERP / 钉钉 / 公司 Wiki ..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
          </Field>
          <Field label="链接 URL *">
            <input
              value={form.url ?? ''}
              onChange={(e) => update('url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
          </Field>
          <Field label="分类 *">
            <select
              aria-label="分类"
              value={form.category ?? 'business'}
              onChange={(e) => update('category', e.target.value as LaunchpadCategory)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption bg-white"
            >
              <option value="business">业务系统 (ERP/CRM/财务)</option>
              <option value="comm">通讯协同 (IM/会议)</option>
              <option value="learning">学习工具 (Wiki/培训)</option>
              <option value="custom">自定义</option>
            </select>
          </Field>
          <Field label="一句话描述">
            <input
              value={form.description ?? ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="客户关系 · 销售机会跟进"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
          </Field>
          <Field label="图标 URL（可空）">
            <input
              value={form.iconUrl ?? ''}
              onChange={(e) => update('iconUrl', e.target.value)}
              placeholder="https://.../icon.png"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
          </Field>
          <Field label="SSO 模式">
            <select
              aria-label="SSO 模式"
              value={form.ssoMode ?? 'none'}
              onChange={(e) => update('ssoMode', e.target.value as LaunchpadApp['ssoMode'])}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption bg-white"
            >
              <option value="none">无 SSO（直接跳转）</option>
              <option value="oidc">OIDC（OpenID Connect）</option>
              <option value="saml">SAML 2.0</option>
              <option value="redirect-token">URL 注入 token</option>
              <option value="credential-vault">凭据保险柜（用户名密码加密）</option>
            </select>
          </Field>
          <Field label="可见部门（逗号分隔，留空=全员）">
            <input
              value={(form.visibleTo ?? []).join(',')}
              onChange={(e) =>
                update('visibleTo', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="dept-sales,dept-finance"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
          </Field>
          <Field label="可见角色（逗号分隔，留空=不限）">
            <input
              value={(form.visibleToRoles ?? []).join(',')}
              onChange={(e) =>
                update('visibleToRoles', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="manager,admin"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
          </Field>
          <Field label="AI 推荐关键词（逗号分隔）">
            <input
              value={(form.recommendKeywords ?? []).join(',')}
              onChange={(e) =>
                update('recommendKeywords', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="销售,客户,商机,sales,crm"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-caption"
            />
            <p className="text-footnote text-slate-400 mt-1">
              当用户的 OKR/Initiative 文本中出现这些关键词，会被 AI 推荐到首页
            </p>
          </Field>
        </div>
        <div className="p-6 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-caption rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-caption rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : editing ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-footnote font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
