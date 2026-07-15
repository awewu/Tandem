'use client';

/**
 * /work-method — 工作法 · 周节奏驾驶舱 (对标 Tita「工作法」, 2026-06-27)
 *
 * 四象限: OKR 面板 / 本周工作 / 未来四周计划 / 当前进展。
 * 核心交互: 把行动项"钉"到本周 (Initiative.weekOf) — 完整落库 (Server.Initiative.weekOf),
 *   桶位由 weekOf 派生 (lib/okr/work-method.ts), 防漂移。
 *
 * 工程约束 (用户铁律):
 *   - 100% 派生自 useOKRStore (DB hydrate), 无 mock / 无写死
 *   - 钉选/移除 weekOf 走 persistUpdateInitiative → 真落库 → hydrate 收敛
 *   - 下属切换复用现有 people; check-in 深链到 /okr 复用既有弹窗 (不重复造)
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Target, CalendarRange, CalendarCheck, Inbox, ArrowRight, ArrowLeft,
  Pin, PinOff, AlertTriangle, ClipboardCheck, User, ChevronDown,
} from 'lucide-react';
import { useOKRStore } from '@/lib/store';
import { krProgress, objectiveProgress } from '@/lib/okr/progress';
import { objectiveScheduleRisk, type RiskBand } from '@/lib/okr/risk';
import { startOfWeek, buildWorkMethod } from '@/lib/okr/work-method';
import { persistUpdateInitiative, hydrateOkrFromApi } from '@/lib/store/okr-sync';
import type { Initiative } from '@/lib/store';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';

const BAND_STYLE: Record<RiskBand, { text: string; bg: string; label: string }> = {
  'on-track': { text: 'text-emerald-700', bg: 'bg-emerald-100', label: '在轨' },
  'at-risk': { text: 'text-warning', bg: 'bg-warning/10', label: '预警' },
  'off-track': { text: 'text-danger', bg: 'bg-rose-100', label: '滞后' },
};

export default function WorkMethodPage() {
  const { cycles, objectives, keyResults, initiatives, currentUserId, updateInitiative } = useOKRStore();
  const { people, nameOf } = useOwnerDirectory();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const activeCycle = useMemo(() => cycles.find((c) => c.isActive) ?? cycles[0], [cycles]);

  // 查看对象 (本人 / 下属) — 默认本人
  const [ownerId, setOwnerId] = useState<string>('');
  const effectiveOwner = ownerId || currentUserId;

  const ownerObjectives = useMemo(
    () =>
      objectives.filter(
        (o) =>
          (!activeCycle || o.cycleId === activeCycle.id) &&
          (o.ownerId === effectiveOwner || o.ownerId === `person:${effectiveOwner}`),
      ),
    [objectives, activeCycle, effectiveOwner],
  );

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(
    () => ownerObjectives.find((o) => o.id === selectedId) ?? ownerObjectives[0],
    [ownerObjectives, selectedId],
  );

  const view = useMemo(() => {
    if (now == null || !selected) return null;
    return buildWorkMethod({ objective: selected, keyResults, initiatives, now });
  }, [now, selected, keyResults, initiatives]);

  const objKRs = useMemo(
    () => (selected ? keyResults.filter((k) => k.objectiveId === selected.id) : []),
    [keyResults, selected],
  );

  const risk = useMemo(
    () => (selected && now != null ? objectiveScheduleRisk(selected, activeCycle, keyResults, now) : null),
    [selected, activeCycle, keyResults, now],
  );

  /** 落库: 钉到本周 / 移回 backlog。乐观更新 → PATCH → hydrate 收敛。 */
  async function setWeek(init: Initiative, weekOf: number | null) {
    updateInitiative(init.id, { weekOf: weekOf ?? undefined }); // 乐观
    try {
      await persistUpdateInitiative(init.id, { weekOf });
      await hydrateOkrFromApi(true);
    } catch (err) {
      await hydrateOkrFromApi(true); // 回滚到后端真值
      alert(`更新失败：${(err as Error)?.message || err}`);
    }
  }

  if (now == null) {
    return <div className="page-container section-y text-caption text-ink-tertiary">加载中…</div>;
  }

  return (
    <div className="page-container section-y space-y-5">
      {/* Header */}
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-brand-500" />
            工作法 · 周节奏
          </h1>
          <p className="mt-1 text-body text-ink-secondary">
            把 OKR 拆成本周可执行的事 · {activeCycle ? activeCycle.name : '无激活周期'}
          </p>
        </div>
        {/* 查看对象切换 (本人/下属) */}
        <label className="inline-flex items-center gap-2 text-caption text-ink-secondary">
          <User className="h-3.5 w-3.5" />
          查看
          <div className="relative">
            <select
              value={effectiveOwner}
              onChange={(e) => { setOwnerId(e.target.value); setSelectedId(''); }}
              className="appearance-none rounded-md border border-border bg-surface-1 pl-2.5 pr-7 py-1.5 text-caption text-ink-primary"
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === currentUserId ? `${p.name}（我）` : p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-tertiary" />
          </div>
        </label>
      </header>

      {ownerObjectives.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <Target className="h-10 w-10 mx-auto text-ink-tertiary" />
          <div className="mt-3 text-headline text-ink-primary">{nameOf(effectiveOwner)} 本周期暂无 Objective</div>
          <Link href="/okr" className="mt-3 inline-flex items-center gap-1 text-caption text-brand-600 hover:text-brand-700">
            去创建 OKR <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Objective 切换器 */}
          <div className="flex items-center gap-2 flex-wrap">
            {ownerObjectives.map((o) => {
              const active = o.id === selected?.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  className={`px-3 py-1.5 rounded-full text-caption ring-1 transition ${
                    active ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'text-ink-secondary ring-surface-3 hover:bg-surface-3'
                  }`}
                >
                  {o.title}
                </button>
              );
            })}
          </div>

          {/* 四象限 */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ① OKR 面板 */}
            <section className="card-elevated p-4">
              <QuadrantHeader icon={Target} title="OKR" hint="目标 + KR 进度" />
              {selected && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-headline text-ink-primary">{selected.title}</div>
                    {risk && (
                      <span className={`shrink-0 text-footnote px-1.5 py-0.5 rounded ${BAND_STYLE[risk.band].bg} ${BAND_STYLE[risk.band].text}`}>
                        {BAND_STYLE[risk.band].label} · {objectiveProgress(selected, keyResults)}%
                      </span>
                    )}
                  </div>
                  {risk && risk.band !== 'on-track' && (
                    <div className="mt-1 text-footnote text-ink-tertiary">
                      时间已过 {risk.expectedProgress}% · 实际 {risk.actualProgress}% · 落后基准 {risk.variance}%
                    </div>
                  )}
                  <ul className="mt-3 space-y-2">
                    {objKRs.map((kr) => {
                      const p = krProgress(kr);
                      return (
                        <li key={kr.id} className="text-caption">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-ink-secondary truncate">{kr.title}</span>
                            <span className="text-ink-tertiary shrink-0">{p}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                            <div className="h-full bg-brand-500" style={{ width: `${p}%` }} />
                          </div>
                        </li>
                      );
                    })}
                    {objKRs.length === 0 && <li className="text-footnote text-ink-tertiary">该目标暂无 KR</li>}
                  </ul>
                </div>
              )}
            </section>

            {/* ④ 当前进展 (深链到 /okr 复用既有 check-in) */}
            <section className="card-elevated p-4">
              <QuadrantHeader icon={ClipboardCheck} title="当前进展" hint="更新关键成果进度" />
              <div className="mt-3 text-caption text-ink-secondary">
                {objKRs.length === 0
                  ? '先为目标添加 KR 才能记录进展。'
                  : '在 OKR 页对 KR 做 check-in,进度会自动回填到这里与看板。'}
              </div>
              {selected && (
                <Link
                  href={`/okr#obj-${selected.id}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-3 py-1.5 text-caption text-brand-700 hover:bg-brand-100"
                >
                  去更新进展 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </section>

            {/* ② 本周工作 (遗留 + 本周) */}
            <section className="card-elevated p-4">
              <QuadrantHeader
                icon={CalendarCheck}
                title="本周工作"
                hint={`${view?.thisWeekFocus.length ?? 0} 项 · 含遗留`}
              />
              <InitiativeList
                items={view?.thisWeekFocus ?? []}
                emptyHint="本周暂无安排 · 从右下「未来/待规划」钉过来"
                now={now}
                ownerName={nameOf}
                action={{ icon: PinOff, label: '移出本周', onClick: (i) => setWeek(i, null) }}
              />
            </section>

            {/* ③ 未来四周 + 待规划 */}
            <section className="card-elevated p-4">
              <QuadrantHeader
                icon={CalendarRange}
                title="未来四周 / 待规划"
                hint={`${(view?.counts['next-4-weeks'] ?? 0) + (view?.counts.later ?? 0) + (view?.counts.backlog ?? 0)} 项`}
              />
              <InitiativeList
                items={[...(view?.buckets['next-4-weeks'] ?? []), ...(view?.buckets.later ?? []), ...(view?.buckets.backlog ?? [])]}
                emptyHint="暂无待规划行动项 · 去 OKR 给 KR 添加行动项"
                now={now}
                ownerName={nameOf}
                action={{ icon: Pin, label: '钉到本周', onClick: (i) => setWeek(i, startOfWeek(now)) }}
              />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function QuadrantHeader({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-headline text-ink-primary flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-500" />
        {title}
      </div>
      <span className="text-footnote text-ink-tertiary">{hint}</span>
    </div>
  );
}

function InitiativeList({
  items, emptyHint, now, ownerName, action,
}: {
  items: Initiative[];
  emptyHint: string;
  now: number;
  ownerName: (id: string) => string;
  action: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: (i: Initiative) => void };
}) {
  if (items.length === 0) {
    return <div className="mt-3 text-footnote text-ink-tertiary py-6 text-center">{emptyHint}</div>;
  }
  const ActionIcon = action.icon;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((i) => {
        const overdue = i.dueDate != null && i.dueDate < now && i.status !== 'done' && i.status !== 'cancelled';
        const done = i.status === 'done';
        return (
          <li key={i.id} className="group flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${done ? 'bg-emerald-500' : overdue ? 'bg-danger' : 'bg-brand-400'}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-caption truncate ${done ? 'text-ink-tertiary line-through' : 'text-ink-primary'}`}>{i.title}</div>
              <div className="text-footnote text-ink-tertiary flex items-center gap-2">
                <span>{ownerName(i.ownerId)}</span>
                {i.dueDate != null && (
                  <span className={overdue ? 'text-danger' : ''}>
                    {overdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                    截止 {new Date(i.dueDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => action.onClick(i)}
              className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
            >
              <ActionIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
