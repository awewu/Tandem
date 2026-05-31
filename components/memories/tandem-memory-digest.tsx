/**
 * <TandemMemoryDigest>
 *
 * 公司 Memory artifact 摘要 (Tandem Memory layer · CHARTER §6).
 * 在 /memories 页顶部展示, 真接 /api/tandem/memory/list.
 *
 * 与下方"我的记事本" (zustand 个人 demo) 不冲突 — §9.1 设计冻结后, 个人记事本将
 * 迁到 /knowledge, /memories 完全成为 artifact 浏览页. 本组件是过渡入口.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrustBanner } from '@/components/trust-banner';
import {
  BookOpen,
  AlertTriangle,
  Lightbulb,
  Heart,
  TrendingUp,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface MemoryArtifact {
  id: string;
  type: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  title: string;
  status: 'active' | 'revising' | 'inactive' | 'deprecated';
  referenceCount: number;
  createdAt: string;
  updatedAt: string;
}

const TYPE_META: Record<MemoryArtifact['type'], { label: string; icon: React.ElementType; color: string }> = {
  sop: { label: 'SOP', icon: BookOpen, color: 'bg-sky-100 text-sky-800 border-sky-200' },
  case: { label: '案例', icon: Lightbulb, color: 'bg-warning/10 text-warning border-warning/20' },
  redline: { label: '红线', icon: AlertTriangle, color: 'bg-rose-100 text-rose-800 border-rose-200' },
  value: { label: '价值观', icon: Heart, color: 'bg-violet-100 text-violet-800 border-violet-200' },
  lesson: { label: '教训', icon: TrendingUp, color: 'bg-surface-1 text-ink-primary border' },
};

export function TandemMemoryDigest() {
  const [items, setItems] = useState<MemoryArtifact[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/tandem/memory/list?status=active&limit=20', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setItems(j.memories ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = (items ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-body flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              公司 Memory · 全员可引用
            </CardTitle>
            <p className="text-footnote text-muted-foreground mt-1">
              经 Lv1/2/3 签批沉淀的 SOP / 案例 / 红线 / 价值观 · CHARTER §6
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link
              href="/admin/steward"
              className="text-footnote text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Steward 工作台 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <TrustBanner tone="audit" charter="CHARTER §6.2">
          这里的条目<strong>已经过签批</strong>, 全公司可引用. 想让你的经验入库 →
          先去 <Link href="/admin/steward" className="underline font-medium">Steward 工作台</Link>{' '}
          走升级流程.
        </TrustBanner>

        {/* 类型计数 */}
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            return (
              <Badge key={t} variant="outline" className={`${meta.color} gap-1`}>
                <Icon className="h-3 w-3" />
                {meta.label} <span className="font-mono ml-0.5">{counts[t] ?? 0}</span>
              </Badge>
            );
          })}
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="text-footnote text-muted-foreground py-4 text-center">加载中…</div>
        ) : error ? (
          <div className="text-footnote text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            加载失败: {error} · <button onClick={() => void load()} className="underline">重试</button>
          </div>
        ) : items && items.length > 0 ? (
          <ul className="divide-y divide-border border rounded-md">
            {items.slice(0, 8).map((m) => {
              const meta = TYPE_META[m.type];
              const Icon = meta.icon;
              return (
                <li key={m.id} className="px-3 py-2 hover:bg-muted/30 transition-colors flex items-center gap-3 text-caption">
                  <Badge variant="outline" className={`${meta.color} shrink-0 gap-1`}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <span className="flex-1 truncate font-medium">{m.title}</span>
                  <span className="text-footnote text-muted-foreground tabular-nums shrink-0">
                    引用 {m.referenceCount}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-footnote text-muted-foreground bg-muted/30 border border-dashed rounded px-3 py-6 text-center">
            <p>暂无已签批的 Memory artifact</p>
            <Link
              href="/admin/steward"
              className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              起草第一个 SOP <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {items && items.length > 8 && (
          <Link
            href="/admin/steward"
            className="block text-center text-footnote text-primary hover:underline"
          >
            查看全部 {items.length} 条 →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
