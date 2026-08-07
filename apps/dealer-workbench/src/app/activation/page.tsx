'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Zap } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { activation } from '../../lib/api';

const TYPES: Array<[string, string]> = [['coupon', '优惠券'], ['groupon', '拼团'], ['flashsale', '秒杀'], ['fission', '裂变'], ['referral', '转介绍']];
const NEXT: Record<string, string> = { draft: 'running', running: 'paused', paused: 'running' };
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}

export default function ActivationPage() {
  const { toast } = useToast();
  const list = useSWR('activation:list', () => activation.list());
  const [f, setF] = useState({ name: '', type: 'coupon', budget: '' });

  async function create() { if (!f.name) { toast('请填写活动名称', 'error'); return; } try { await activation.create({ name: f.name, type: f.type, budget: Number(f.budget) || 0 }); setF({ name: '', type: 'coupon', budget: '' }); toast('活动已创建', 'success'); list.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }
  async function toggle(id: string, status: string) { try { await activation.setStatus(id, NEXT[status] || 'ended'); list.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows: any[] = list.data?.activities || [];

  return (
    <>
      <PageHeader title="活动运营" subtitle="优惠券 · 拼团 · 秒杀 · 裂变 · 转介绍 —— 裂变/转介绍带来的线索计入线索飞轮" />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Zap size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>新建活动</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="活动名称" style={{ flex: 1 }} />
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className="input" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} placeholder="预算" type="number" style={{ width: 110 }} />
          <button className="btn btn-brand" onClick={create}>新建</button>
        </div>
      </div>

      <AsyncBoundary status={statusOf(list.isLoading, list.error, rows.length === 0)} errorMessage="活动加载失败（需 API + 数据库）" onRetry={() => list.mutate()} emptyTitle="暂无活动" emptyDescription="创建促销/裂变活动后可启停，并统计转介绍带来的线索。">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((a) => (
            <div key={a.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="t-sm"><span style={{ fontWeight: 600, color: 'var(--t-strong)' }}>{a.name}</span> <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>· {(TYPES.find((t) => t[0] === a.type) || [])[1] || a.type} · 预算¥{a.budget} · 转介线索 {a.metrics?.referredLeads ?? 0}</span></span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{a.status}</span>
                {a.status !== 'ended' && <button className="btn btn-outline btn-sm" onClick={() => toggle(a.id, a.status)}>{a.status === 'running' ? '暂停' : '启动'}</button>}
              </span>
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </>
  );
}
