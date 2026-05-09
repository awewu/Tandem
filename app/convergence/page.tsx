'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, ArrowRight } from 'lucide-react';
import type { DecisionCard } from '@/lib/types';

export default function ConvergenceListPage() {
  const [cards, setCards] = useState<DecisionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const router = useRouter();

  useEffect(() => {
    refreshList();
  }, []);

  async function refreshList() {
    setLoading(true);
    try {
      const res = await fetch('/api/convergence');
      const json = await res.json();
      setCards(json.cards ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function createRoom() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/convergence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          ownerId: 'demo-user',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error ?? 'create failed');
      }
      const json = await res.json();
      router.push(`/convergence/${json.cardId}`);
    } catch (err) {
      alert(`创建失败: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="container mx-auto max-w-5xl py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">议事室</h1>
          <p className="text-sm text-muted-foreground mt-1">
            17 分钟内, 用 3+1 框架达成共识
          </p>
        </div>
      </div>

      {/* New room form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            发起议事
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full rounded border p-2 text-sm"
            placeholder="议题标题 (如: 客户投诉应对方案)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={creating}
          />
          <textarea
            className="w-full rounded border p-2 text-sm"
            rows={3}
            placeholder="描述背景, 让 AI 能找到相关 SOP / 案例..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={creating}
          />
          <div className="flex justify-end">
            <Button onClick={createRoom} disabled={creating || !title.trim()}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在生成 3+1 选项...
                </>
              ) : (
                '发起议事'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近议事</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载...
            </div>
          ) : cards.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              还没有议事记录, 上方发起一个吧
            </div>
          ) : (
            <ul className="divide-y">
              {cards.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/convergence/${c.id}`}
                    className="flex items-center justify-between py-3 hover:bg-accent/50 rounded px-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.title}</div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <StateBadge state={c.convergenceState} />
                        <span>{formatDate(c.createdAt)}</span>
                        {c.elapsedSeconds > 0 && (
                          <span>用时 {Math.floor(c.elapsedSeconds / 60)}min</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StateBadge({ state }: { state: string }) {
  const config: Record<string, { label: string; className: string }> = {
    DIVERGE: { label: '审议中', className: 'bg-blue-100 text-blue-700' },
    CONVERGE: { label: '收敛中', className: 'bg-purple-100 text-purple-700' },
    COMMIT: { label: '已生效', className: 'bg-emerald-100 text-emerald-700' },
    ESCALATED: { label: '已升级', className: 'bg-amber-100 text-amber-700' },
    VETOED: { label: '已否决', className: 'bg-red-100 text-red-700' },
  };
  const c = config[state] ?? { label: state, className: 'bg-slate-100 text-slate-700' };
  return (
    <span className={`rounded-full px-2 py-0.5 ${c.className}`}>{c.label}</span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
