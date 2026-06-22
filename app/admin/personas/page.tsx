'use client';

/**
 * /admin/personas · 分身阶段管理 (Owner/Admin)
 *
 * 管理员手动调整任意用户 Persona 的阶段 + 委托级别 (组织主权侧 override).
 *   - 列表: GET  /api/admin/personas        (本租户全部用户 + persona 阶段)
 *   - 设阶段: PATCH /api/admin/personas/:userId  { stage, delegationLevel? }
 *
 * 说明: assistant (熟手) 及以上 = soft_opinion 及以上委托级别, 才允许 IM 分身代行回复;
 * newborn/apprentice 仍受门控只旁听汇报。
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, Check, Search } from 'lucide-react';
import { STAGE_META, STAGE_LIST } from '@/lib/persona/stage-meta';
import type { PersonaStage, DelegationLevel } from '@/lib/types/persona';

interface Row {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  stage: PersonaStage | null;
  delegationLevel: DelegationLevel | null;
  stageEnteredAt: string | null;
  hasPersona: boolean;
}

const STAGES: PersonaStage[] = STAGE_LIST.map((m) => m.stage);

/** assistant 及以上 = 允许 IM 代行 */
const CAN_DELEGATE: PersonaStage[] = ['assistant', 'deputy', 'partner'];

export default function AdminPersonasPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Record<string, PersonaStage>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/personas', { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '加载失败');
      setRows(data.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  async function save(userId: string) {
    const stage = draft[userId];
    if (!stage) return;
    setSavingId(userId);
    setSavedId(null);
    try {
      const res = await fetch(`/api/admin/personas/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? '保存失败');
      setSavedId(userId);
      setDraft((d) => {
        const { [userId]: _, ...rest } = d;
        return rest;
      });
      await fetchRows();
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingId(null);
    }
  }

  const filtered = rows.filter(
    (r) =>
      !q.trim() ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.email.toLowerCase().includes(q.toLowerCase()) ||
      r.userId.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <main className="container mx-auto max-w-4xl space-y-4 p-6 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            分身阶段管理
          </CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">
            管理员可手动设定任意成员 AI 分身的阶段 (新手 → 上手 → 熟手 → 老手 → 拿手)。
            <span className="font-medium text-foreground"> 熟手 (🐤) 及以上</span>
            才允许 IM 分身代行回复; 新手/上手仍只旁听或汇报。委托级别按阶段默认映射, 调阶段后自动生效, 全程留痕。
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索姓名 / 邮箱 / userId"
              className="w-full rounded border p-1.5 pl-8 text-caption"
            />
          </div>

          {loading ? (
            <p className="flex items-center gap-2 text-caption text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </p>
          ) : error ? (
            <p className="text-caption text-rose-600">加载失败: {error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-caption text-muted-foreground">无匹配用户。</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const current = r.stage;
                const selected = draft[r.userId] ?? current ?? 'newborn';
                const meta = STAGE_META[selected];
                const dirty = draft[r.userId] && draft[r.userId] !== current;
                const canDelegate = CAN_DELEGATE.includes(selected);
                return (
                  <div key={r.userId} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.name}</span>
                          {r.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-[10px]">
                              {role}
                            </Badge>
                          ))}
                          {!r.hasPersona && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              未建分身
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.email} · {r.userId}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          当前: {current ? `${STAGE_META[current].emoji} ${STAGE_META[current].title}` : '—'}
                        </span>
                        <select
                          value={selected}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [r.userId]: e.target.value as PersonaStage }))
                          }
                          className="rounded border p-1.5 text-caption"
                        >
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {STAGE_META[s].emoji} Lv.{STAGE_META[s].level} {STAGE_META[s].title}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => void save(r.userId)}
                          disabled={!dirty || savingId === r.userId}
                        >
                          {savingId === r.userId ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : savedId === r.userId ? (
                            <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                          ) : null}
                          保存
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {meta.blurb} · 委托级别 {meta.defaultDelegation}
                      {canDelegate ? (
                        <span className="ml-1 text-emerald-600">· 可 IM 代行</span>
                      ) : (
                        <span className="ml-1 text-amber-600">· 不代行 (仅旁听/汇报)</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
