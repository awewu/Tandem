'use client';

/**
 * /teammates · AI 同事目录 (对标 Asana AI Teammate)
 *
 * 员工像浏览团队成员一样浏览可对话的 AI 角色, 一键召唤.
 * 第一版: 中央 AI + 我的搭子. 后续可加部门 AI / 三大部 AI.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Teammate {
  id: string;
  kind: 'central' | 'persona' | 'governance' | 'department';
  name: string;
  subtitle: string;
  capabilities: string[];
  zone: 'green' | 'mixed' | 'red';
  stats: { label: string; value: string | number }[];
  entryUrl: string;
  status: 'active' | 'disabled';
}

const ZONE_BADGE: Record<Teammate['zone'], { label: string; cls: string }> = {
  green: { label: '只读 · 绿区', cls: 'bg-success/10 text-success' },
  mixed: { label: '有写 · 黄区', cls: 'bg-warning/10 text-warning' },
  red: { label: '高代行 · 红区', cls: 'bg-destructive/10 text-destructive' },
};

const KIND_ICON: Record<Teammate['kind'], string> = {
  central: '🧠',
  persona: '🤝',
  governance: '⚖',
  department: '🏛',
};

export default function TeammatesPage() {
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/teammates')
      .then((r) => (r.ok ? r.json() : { teammates: [] }))
      .then((j) => { if (active) setTeammates(j.teammates ?? []); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="container mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-title-3 font-bold">AI 同事</h1>
        <p className="text-caption text-muted-foreground">
          每个 AI 角色都有明确职责 / 代行边界 / 红线兜底. 像浏览团队成员一样查看, 一键对话.
        </p>
      </header>

      {loading && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">加载中...</CardContent></Card>
      )}

      {!loading && teammates.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">暂无可用 AI 同事</CardContent></Card>
      )}

      {!loading && teammates.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {teammates.map((t) => {
            const zone = ZONE_BADGE[t.zone];
            return (
              <Card key={t.id} className={t.status === 'disabled' ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl leading-none">{KIND_ICON[t.kind]}</span>
                      <div>
                        <CardTitle className="text-base">{t.name}</CardTitle>
                        <p className="mt-1 text-caption text-muted-foreground">{t.subtitle}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-caption ${zone.cls}`}>
                      {zone.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 能力 */}
                  <div>
                    <p className="mb-1 text-caption text-muted-foreground">能力</p>
                    <div className="flex flex-wrap gap-1">
                      {t.capabilities.map((c) => (
                        <span key={c} className="rounded-md bg-muted px-1.5 py-0.5 text-caption">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 指标 */}
                  <div className="grid grid-cols-2 gap-2 border-y py-2">
                    {t.stats.map((s, i) => (
                      <div key={i}>
                        <p className="text-caption text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-medium">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <Link
                    href={t.entryUrl}
                    className="block rounded-md bg-warning px-3 py-2 text-center text-caption font-medium text-warning-foreground hover:opacity-90"
                  >
                    {t.kind === 'central' ? '去对话 / 浮窗已挂载全局' : t.kind === 'persona' ? '管理 / 进化' : '查看'}
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="py-4 text-caption text-muted-foreground">
          后续规划: 部门 AI · 治理委员会 AI · 三大部 AI (战略 / 人力 / 财务) — 当工作流真正需要时再上,
          不为了凑数加角色 (charter §15 不替员工自决, 每个 AI 必须有清晰职责).
        </CardContent>
      </Card>
    </main>
  );
}
