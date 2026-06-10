'use client';

/**
 * Gap3 · 进化日志面板 · 把 B-024 反思引擎"后端真在学"暴露给员工看见.
 *
 * 用户感知线:
 *   - "近 7 天 N 条教训" → 大数字, 信心来源
 *   - 分类柱 (skill_misuse / okr_drift / knowledge_gap / judgment / other)
 *   - 教训 timeline (最新 20 条标题 + 触发器徽章 + 时间)
 *   - 空态: "暂无教训记录 — 多用一阵, 搭子会从你的反馈中学到东西"
 *
 * 数据源: GET /api/persona/me/reflexion-log?days=N
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Category = 'skill_misuse' | 'okr_drift' | 'knowledge_gap' | 'judgment' | 'other';

interface ReflexionLogResponse {
  windowDays: number;
  lifetimeTotal: number;
  pattern: {
    byCategory: Record<Category, number>;
    skillMisuseCounts: Array<{ skillId: string; count: number }>;
    total: number;
    windowStart: string;
  };
  recentLessons: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
    category: string;
    trigger: string;
    skillId?: string;
  }>;
}

const CATEGORY_LABEL: Record<Category, string> = {
  skill_misuse: '技能误用',
  okr_drift: 'OKR 漂离',
  knowledge_gap: '知识缺口',
  judgment: '判断失误',
  other: '其他',
};

const TRIGGER_LABEL: Record<string, string> = {
  veto: '被否决',
  rejected_for_original: '员工弃 AI 选项',
  retrospective: '复盘回填',
  unknown: '未知',
};

export function ReflexionLogPanel() {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [data, setData] = useState<ReflexionLogResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/persona/me/reflexion-log?days=${days}&limit=20`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j) setData(j);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">加载进化日志…</CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          无法读取进化日志
        </CardContent>
      </Card>
    );
  }

  const recentCount = data.recentLessons.length;
  const totalInWindow = data.pattern.total;

  return (
    <div className="space-y-4">
      {/* 顶部: 大数字 + 时间窗切换 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            分身近 {days} 天学到的教训
          </CardTitle>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-md px-2 py-0.5 text-caption transition ${
                  days === d
                    ? 'bg-warning text-warning-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">{totalInWindow}</span>
            <span className="text-caption text-muted-foreground">条新教训</span>
            <span className="ml-auto text-caption text-muted-foreground">
              累计 {data.lifetimeTotal} 条
            </span>
          </div>
          <p className="mt-2 text-caption text-muted-foreground">
            这是分身从你的否决/弃用/复盘中真实学到的具体教训, 下次回答前会被自动召回注入提示.
          </p>
        </CardContent>
      </Card>

      {/* 分类统计 */}
      {totalInWindow > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">按类别分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
                const n = data.pattern.byCategory[cat] ?? 0;
                if (n === 0) return null;
                const pct = totalInWindow > 0 ? (n / totalInWindow) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="w-20 text-caption text-muted-foreground">
                      {CATEGORY_LABEL[cat]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-warning transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-caption font-medium">{n}</span>
                  </div>
                );
              })}
            </div>
            {data.pattern.skillMisuseCounts.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="mb-2 text-caption text-muted-foreground">
                  最常被误用的 skill (≥1 次):
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.pattern.skillMisuseCounts.slice(0, 5).map((s) => (
                    <span
                      key={s.skillId}
                      className="rounded-md bg-muted px-2 py-0.5 text-caption"
                    >
                      {s.skillId} × {s.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">教训详情 ({recentCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCount === 0 ? (
            <p className="py-6 text-center text-caption text-muted-foreground">
              暂无教训记录 —— 多用一阵, 在 IM 里否决或修改分身的回复, 它会从中真实学到东西.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.recentLessons.map((l) => (
                <li key={l.id} className="border-l-2 border-warning pl-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-caption font-medium text-foreground">{l.title}</p>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {formatRelative(l.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
                      {TRIGGER_LABEL[l.trigger] ?? l.trigger}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
                      {CATEGORY_LABEL[(l.category as Category) ?? 'other'] ?? l.category}
                    </span>
                    {l.skillId && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
                        skill: {l.skillId}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-3 text-caption text-muted-foreground">{l.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const diffMs = Date.now() - t;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}
