'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PenTool } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { content } from '../../lib/api';

const STATUS_LABEL: Record<string, string> = { draft: '草稿', in_review: '审核中', approved: '已核准', published: '已发布', rejected: '已驳回' };
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}

export default function ContentPage() {
  const { toast } = useToast();
  const list = useSWR('content:list', () => content.list());
  const [f, setF] = useState({ title: '', kind: 'article', channel: 'geo', body: '', factRefs: '' });

  async function create() {
    if (!f.title) { toast('请填写标题', 'error'); return; }
    try {
      const factRefs = f.factRefs.split(',').map((s) => s.trim()).filter(Boolean).map((id) => ({ type: 'fact', id }));
      await content.create({ title: f.title, kind: f.kind, channel: f.channel, body: f.body, factRefs });
      setF({ title: '', kind: 'article', channel: 'geo', body: '', factRefs: '' }); toast('内容已创建（草稿）', 'success'); list.mutate();
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function act(fn: () => Promise<any>, label: string) { try { await fn(); toast(label, 'success'); list.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows: any[] = list.data?.contents || [];

  return (
    <>
      <PageHeader title="内容工厂" subtitle="brief→草稿→审核→发布 全流水线 · 基座4：无事实源引用不得对外发布（发布按钮会拦）" />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><PenTool size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>新建内容</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="标题" style={{ flex: 1, minWidth: 220 }} />
          <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="article">文章</option><option value="faq">FAQ</option><option value="comparison">对比</option><option value="topic">主题</option><option value="social">社媒</option><option value="landing">落地页</option></select>
          <input className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} placeholder="渠道" style={{ width: 110 }} />
        </div>
        <textarea className="textarea" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="正文" style={{ minHeight: 64, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={f.factRefs} onChange={(e) => setF({ ...f, factRefs: e.target.value })} placeholder="事实源ID(逗号分隔,发布必需)" style={{ flex: 1 }} />
          <button className="btn btn-brand" onClick={create}>新建草稿</button>
        </div>
      </div>

      <AsyncBoundary status={statusOf(list.isLoading, list.error, rows.length === 0)} errorMessage="内容加载失败（需 API + 数据库）" onRetry={() => list.mutate()} emptyTitle="暂无内容" emptyDescription="新建草稿后走 送审→核准→发布 流水线；发布前须挂事实源。">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((c) => (
            <div key={c.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="t-sm"><span style={{ fontWeight: 600, color: 'var(--t-strong)' }}>{c.title}</span> <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>· {c.kind}/{c.channel} · 事实源 {(c.factRefs || []).length}</span></span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{STATUS_LABEL[c.status] || c.status}</span>
                {c.status === 'draft' && <button className="btn btn-outline btn-sm" onClick={() => act(() => content.submit(c.id), '已送审')}>送审</button>}
                {c.status === 'in_review' && <>
                  <button className="btn btn-outline btn-sm" onClick={() => act(() => content.decide(c.id, 'approved'), '已核准')}>核准</button>
                  <button className="btn btn-outline btn-sm" onClick={() => act(() => content.decide(c.id, 'rejected'), '已驳回')}>驳回</button>
                </>}
                {c.status === 'approved' && <button className="btn btn-brand btn-sm" onClick={() => act(() => content.publish(c.id), '已发布')}>发布</button>}
              </span>
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </>
  );
}
