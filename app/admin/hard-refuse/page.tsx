'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, CheckCircle2, AlertTriangle, Plus, Trash2, RotateCcw, ShieldAlert } from 'lucide-react';

interface Topic {
  id: string;
  label: string;
  keywords: string[];
  redirect: string;
}

type Status = 'loading' | 'ok' | 'saving' | 'saved' | 'error';

export default function HardRefusePage() {
  const [enabled, setEnabled] = useState(true);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [defaults, setDefaults] = useState<Topic[]>([]);
  const [source, setSource] = useState<'db' | 'default'>('default');
  const [status, setStatus] = useState<Status>('loading');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/hard-refuse', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        setEnabled(j.enabled !== false);
        setTopics(j.topics ?? []);
        setDefaults(j.defaults ?? []);
        setSource(j.source ?? 'default');
        setStatus('ok');
      })
      .catch((e) => {
        setErrMsg((e as Error).message);
        setStatus('error');
      });
  }, []);

  function updateTopic(idx: number, patch: Partial<Topic>) {
    setTopics((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  function addTopic() {
    setTopics((prev) => [
      ...prev,
      { id: `topic_${Date.now().toString(36)}`, label: '', keywords: [], redirect: '' },
    ]);
  }

  function removeTopic(idx: number) {
    setTopics((prev) => prev.filter((_, i) => i !== idx));
  }

  function restoreDefaults() {
    if (!confirm('用出厂默认清单覆盖当前编辑内容? (保存后才会真正生效)')) return;
    setTopics(defaults.map((t) => ({ ...t, keywords: [...t.keywords] })));
  }

  async function handleSave() {
    setStatus('saving');
    setErrMsg('');
    try {
      const res = await fetch('/api/admin/hard-refuse', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, topics }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setTopics(j.topics ?? topics);
      setSource('db');
      setStatus('saved');
      setTimeout(() => setStatus('ok'), 2500);
    } catch (err) {
      setErrMsg((err as Error).message);
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64 text-ink-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载红线清单…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-bold text-ink-primary flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            业务红线硬拒清单
          </h1>
          <p className="text-caption text-ink-secondary mt-0.5">
            员工提问命中任一关键词时, 中央 AI / 搭子会<strong>立即拒答并转人工</strong>(不进 LLM)。
            用于薪资、裁员、法律、对外承诺、资金、考评等不能由 AI 替公司拍板的话题。
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-caption font-medium disabled:opacity-50 transition"
        >
          {status === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" />
            : status === 'saved' ? <CheckCircle2 className="w-4 h-4" />
            : <Save className="w-4 h-4" />}
          {status === 'saving' ? '保存中…' : status === 'saved' ? '已保存' : '保存'}
        </button>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-danger bg-danger/5 px-4 py-3 text-caption text-danger">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errMsg || '出错了, 请刷新重试'}
        </div>
      )}

      <div className="rounded-2xl border border-hairline bg-surface-1 p-4 flex items-center justify-between">
        <div>
          <p className="text-caption font-medium text-ink-primary">启用红线硬拒</p>
          <p className="text-footnote text-ink-secondary">
            关闭后所有话题一律放行 (紧急临时停用)。当前清单来源:
            <span className="font-mono ml-1">{source === 'db' ? '数据库(已自定义)' : '出厂默认'}</span>
          </p>
        </div>
        <div
          className={`relative h-6 w-11 shrink-0 rounded-full cursor-pointer transition-colors ${enabled ? 'bg-brand-500' : 'bg-surface-3 border border-hairline'}`}
          onClick={() => setEnabled((v) => !v)}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </div>

      <div className="space-y-4">
        {topics.map((t, idx) => (
          <div key={t.id} className="rounded-2xl border border-hairline bg-surface-1 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                value={t.label}
                onChange={(e) => updateTopic(idx, { label: e.target.value })}
                placeholder="主题名 (如: 薪资 / 调薪)"
                className="flex-1 rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                onClick={() => removeTopic(idx)}
                title="删除该主题"
                className="p-1.5 rounded-md text-ink-tertiary hover:bg-rose-50 hover:text-rose-600 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-footnote text-ink-secondary font-medium mb-1 block">
                命中关键词 (每行一个, 用最具体的词避免误伤)
              </label>
              <textarea
                value={t.keywords.join('\n')}
                onChange={(e) => updateTopic(idx, { keywords: e.target.value.split('\n').map((k) => k.trim()).filter(Boolean) })}
                rows={4}
                placeholder={'涨薪\n调薪\n我的工资'}
                className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y font-mono"
              />
              <p className="text-[10px] text-ink-tertiary mt-1">共 {t.keywords.length} 个关键词</p>
            </div>

            <div>
              <label className="text-footnote text-ink-secondary font-medium mb-1 block">
                转人工话术 (命中后给员工看的回复)
              </label>
              <textarea
                value={t.redirect}
                onChange={(e) => updateTopic(idx, { redirect: e.target.value })}
                rows={2}
                placeholder="涉及个人薪酬属人力决策, 请联系 HR / 你的主管, 我不能替公司给薪资承诺。"
                className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-1.5 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500 resize-y"
              />
            </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={addTopic}
          className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-1 hover:bg-surface-2 px-4 py-2 text-caption font-medium text-ink-primary transition"
        >
          <Plus className="w-4 h-4" /> 新增红线主题
        </button>
        <button
          onClick={restoreDefaults}
          className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-1 hover:bg-surface-2 px-4 py-2 text-caption font-medium text-ink-secondary transition"
        >
          <RotateCcw className="w-4 h-4" /> 恢复出厂默认
        </button>
      </div>

      <div className="rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-footnote text-ink-secondary space-y-1">
        <p className="font-medium text-ink-primary">说明</p>
        <p>匹配方式: 大小写不敏感的<strong>子串包含</strong> — 关键词越具体越不会误伤 (如用「我的工资」而非「工资」)。</p>
        <p>保存后<strong>立即生效</strong>, 无需重新部署。留空全部主题无法保存 (至少保留 1 条)。</p>
        <p>此清单只约束 AI 回答, 不影响员工之间正常沟通。</p>
      </div>
    </div>
  );
}
