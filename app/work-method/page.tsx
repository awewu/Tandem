'use client';

/**
 * /work-method — 四象限工作法驾驶舱 (对标 Tita「工作法」, 2026-06-27)
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

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Target, CalendarRange, CalendarCheck, ArrowRight,
  Pin, PinOff, AlertTriangle, ClipboardCheck, User, Edit2, Save, Trash2,
} from 'lucide-react';
import { useOKRStore } from '@/lib/store';
import { krProgress, objectiveProgress } from '@/lib/okr/progress';
import { objectiveScheduleRisk, type RiskBand } from '@/lib/okr/risk';
import { startOfWeek, buildWorkMethod } from '@/lib/okr/work-method';
import { persistCreateInitiative, persistDeleteInitiative, persistUpdateInitiative, hydrateOkrFromApi } from '@/lib/store/okr-sync';
import type { Confidence, Initiative, KeyResult } from '@/lib/store';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const BAND_STYLE: Record<RiskBand, { text: string; bg: string; label: string }> = {
  'on-track': { text: 'text-success', bg: 'bg-success/15', label: '在轨' },
  'at-risk': { text: 'text-warning', bg: 'bg-warning/10', label: '预警' },
  'off-track': { text: 'text-danger', bg: 'bg-danger/10', label: '滞后' },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  'on-track': '有信心',
  'at-risk': '有风险',
  'off-track': '需关注',
};

const INITIATIVE_STATUS_OPTIONS: Array<{ value: Initiative['status']; label: string }> = [
  { value: 'todo', label: '待办' },
  { value: 'in-progress', label: '进行中' },
  { value: 'blocked', label: '阻塞' },
  { value: 'done', label: '完成' },
  { value: 'cancelled', label: '取消' },
];

type InitiativeEditPatch = {
  weekOf?: number | null;
  status?: Initiative['status'];
  dueDate?: number | null;
  title?: string;
};

type CreatePlanDraft = Required<Pick<InitiativeEditPatch, 'title' | 'status'>> & Pick<InitiativeEditPatch, 'dueDate' | 'weekOf'> & {
  keyResultId: string;
};

function toDateInputValue(ms?: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms);
  const offset = d.getTimezoneOffset();
  d.setMinutes(d.getMinutes() - offset);
  return d.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): number | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function startDateInputToValue(value: string): number | null {
  return fromDateInputValue(value) ?? null;
}

export default function WorkMethodPage() {
  const { cycles, objectives, keyResults, checkIns, initiatives, currentUserId, updateInitiative, deleteInitiative } = useOKRStore();
  const { user } = useCurrentUser();
  const { people, nameOf } = useOwnerDirectory();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  useEffect(() => {
    void hydrateOkrFromApi();
    const onFocus = () => { void hydrateOkrFromApi(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const activeCycle = useMemo(() => cycles.find((c) => c.isActive) ?? cycles[0], [cycles]);

  // 查看对象 (本人 / 下属) — 默认本人
  const [ownerId, setOwnerId] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const ownerPickerRef = useRef<HTMLDivElement | null>(null);
  const selfOwnerIds = useMemo(() => {
    const ids = [currentUserId, user?.id].filter(Boolean) as string[];
    return new Set(ids.flatMap((id) => [id, `person:${id}`]));
  }, [currentUserId, user?.id]);
  const effectiveOwner = ownerId || user?.id || currentUserId;
  const effectiveOwnerIds = useMemo(
    () => new Set([effectiveOwner, `person:${effectiveOwner}`]),
    [effectiveOwner],
  );
  const isViewingSelf = selfOwnerIds.has(effectiveOwner);

  const visibleOwnerIds = useMemo(() => new Set(people.map((p) => p.id)), [people]);

  const peopleOptions = useMemo(() => {
    const scoped = people.filter((p) => visibleOwnerIds.has(p.id) && !(user?.id && p.id === 'me'));
    if (!user?.id || scoped.some((p) => p.id === user.id)) return scoped;
    return [{ id: user.id, name: user.name || user.email || '我' }, ...scoped];
  }, [people, user?.email, user?.id, user?.name, visibleOwnerIds]);

  const ownerLabel = useMemo(() => {
    const hit = peopleOptions.find((p) => p.id === effectiveOwner);
    if (!hit) return nameOf(effectiveOwner);
    return selfOwnerIds.has(hit.id) && hit.name !== '我' ? `${hit.name}（我）` : hit.name;
  }, [effectiveOwner, nameOf, peopleOptions, selfOwnerIds]);

  useEffect(() => {
    if (!ownerPickerOpen) setOwnerSearch(ownerLabel);
  }, [ownerLabel, ownerPickerOpen]);

  useEffect(() => {
    if (!ownerPickerOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ownerPickerRef.current?.contains(target)) return;
      setOwnerPickerOpen(false);
      setOwnerSearch(ownerLabel);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [ownerLabel, ownerPickerOpen]);

  const filteredPeopleOptions = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    if (!q || q === ownerLabel.toLowerCase()) return peopleOptions;
    return peopleOptions.filter((p) => {
      const label = selfOwnerIds.has(p.id) && p.name !== '我' ? `${p.name}（我）` : p.name;
      return label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [ownerLabel, ownerSearch, peopleOptions, selfOwnerIds]);

  function chooseOwner(id: string) {
    setOwnerId(id === user?.id || id === currentUserId ? '' : id);
    setSelectedId('');
    setOwnerPickerOpen(false);
  }

  const ownerObjectives = useMemo(
    () => {
      return objectives.filter((o) => {
        if (activeCycle && o.cycleId !== activeCycle.id) return false;
        const ownerMatch = effectiveOwnerIds.has(o.ownerId);
        const krMatch = keyResults.some(
          (k) =>
            k.objectiveId === o.id &&
            (effectiveOwnerIds.has(k.ownerId) ||
              (k.collaborators ?? []).some((id) => effectiveOwnerIds.has(id))),
        );
        if (ownerMatch || krMatch) return true;
        return false;
      });
    },
    [objectives, activeCycle, effectiveOwnerIds, keyResults],
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
  const selectedCheckIns = useMemo(() => {
    if (!selected) return [];
    const krIds = new Set(objKRs.map((k) => k.id));
    return checkIns
      .filter((c) =>
        (c.scope === 'objective' && c.scopeId === selected.id) ||
        (c.scope === 'kr' && krIds.has(c.scopeId)),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);
  }, [checkIns, objKRs, selected]);

  const risk = useMemo(
    () => (selected && now != null ? objectiveScheduleRisk(selected, activeCycle, keyResults, now) : null),
    [selected, activeCycle, keyResults, now],
  );

  const [editingInit, setEditingInit] = useState<Initiative | null>(null);
  const [initiativeError, setInitiativeError] = useState<string | null>(null);
  const [savingInitiative, setSavingInitiative] = useState(false);
  const [creatingPlanWeekOf, setCreatingPlanWeekOf] = useState<number | null | undefined>(undefined);
  const [createPlanError, setCreatePlanError] = useState<string | null>(null);
  const [savingCreatePlan, setSavingCreatePlan] = useState(false);
  const [deletingInit, setDeletingInit] = useState<Initiative | null>(null);
  const [deletePlanError, setDeletePlanError] = useState<string | null>(null);
  const [savingDeletePlan, setSavingDeletePlan] = useState(false);

  useEffect(() => {
    if (isViewingSelf) return;
    setEditingInit(null);
    setCreatingPlanWeekOf(undefined);
    setDeletingInit(null);
    setInitiativeError(null);
    setCreatePlanError(null);
    setDeletePlanError(null);
  }, [isViewingSelf]);

  function openInitiativeEditor(init: Initiative) {
    if (!isViewingSelf) return;
    setInitiativeError(null);
    setEditingInit(init);
  }

  async function updateInitiativePatch(
    init: Initiative,
    patch: InitiativeEditPatch,
  ) {
    updateInitiative(init.id, {
      ...(patch.weekOf !== undefined ? { weekOf: patch.weekOf ?? undefined } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ?? undefined } : {}),
      ...(patch.title !== undefined ? { title: patch.title } : {}),
    });
    try {
      await persistUpdateInitiative(init.id, patch);
      await hydrateOkrFromApi(true);
    } catch (err) {
      await hydrateOkrFromApi(true);
      throw err;
    }
  }

  /** 落库: 钉到本周 / 移回 backlog。乐观更新 → PATCH → hydrate 收敛。 */
  async function setWeek(init: Initiative, weekOf: number | null) {
    if (!isViewingSelf) return;
    try {
      await updateInitiativePatch(init, { weekOf });
    } catch (err) {
      alert(`更新失败：${(err as Error)?.message || err}`);
    }
  }

  async function updateInitiativeFromList(init: Initiative, patch: InitiativeEditPatch) {
    if (!isViewingSelf) return;
    try {
      await updateInitiativePatch(init, patch);
    } catch (err) {
      alert(`更新失败：${(err as Error)?.message || err}`);
    }
  }

  function deleteInitiativeFromList(init: Initiative) {
    if (!isViewingSelf) return;
    setDeletePlanError(null);
    setDeletingInit(init);
  }

  function createPlan(weekOf: number | null) {
    if (!isViewingSelf) return;
    if (!selected) return;
    if (objKRs.length === 0) {
      alert('请先给当前目标添加 KR，再创建工作计划');
      return;
    }
    setCreatePlanError(null);
    setCreatingPlanWeekOf(weekOf);
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
            四象限工作法
          </h1>
          <p className="mt-1 text-body text-ink-secondary">
            把 OKR 拆成本周可执行的事 · {activeCycle ? activeCycle.name : '无激活周期'}
          </p>
        </div>
        {/* 查看对象切换 (本人/下属) */}
        <label className="inline-flex items-center gap-2 text-caption text-ink-secondary">
          <User className="h-3.5 w-3.5" />
          查看
          <div ref={ownerPickerRef} className="relative w-52">
            <input
              value={ownerPickerOpen ? ownerSearch : ownerLabel}
              onChange={(e) => {
                setOwnerSearch(e.target.value);
                setOwnerPickerOpen(true);
              }}
              onFocus={() => {
                setOwnerSearch('');
                setOwnerPickerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOwnerPickerOpen(false);
                  return;
                }
                if (e.key === 'Enter' && filteredPeopleOptions[0]) {
                  e.preventDefault();
                  chooseOwner(filteredPeopleOptions[0].id);
                }
              }}
              placeholder="输入姓名搜索"
              className="w-full rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
            {ownerPickerOpen && (
              <div className="absolute right-0 z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface-1 py-1 shadow-soft-lg">
                {filteredPeopleOptions.length === 0 ? (
                  <div className="px-3 py-2 text-footnote text-ink-tertiary">没有匹配的人</div>
                ) : (
                  filteredPeopleOptions.map((p) => {
                    const label = selfOwnerIds.has(p.id) && p.name !== '我' ? `${p.name}（我）` : p.name;
                    const active = p.id === effectiveOwner;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => chooseOwner(p.id)}
                        className={`block w-full px-3 py-2 text-left text-caption ${
                          active ? 'bg-brand-50 text-brand-700' : 'text-ink-primary hover:bg-surface-3'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })
                )}
              </div>
            )}
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
              {selected ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-border bg-surface-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-caption font-medium text-ink-primary">KR 进度</div>
                      {isViewingSelf ? (
                        <Link
                          href={`/okr#obj-${selected.id}`}
                          className="inline-flex items-center gap-1 text-footnote text-brand-600 hover:text-brand-700"
                        >
                          去 OKR 更新 <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="inline-flex cursor-not-allowed items-center gap-1 text-footnote text-ink-tertiary">
                          去 OKR 更新 <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-2">
                      {objKRs.length === 0 ? (
                        <div className="py-4 text-center text-footnote text-ink-tertiary">
                          先为目标添加 KR 才能看到进展
                        </div>
                      ) : (
                        objKRs.map((kr) => {
                          const pct = krProgress(kr);
                          return (
                            <div key={kr.id} className="space-y-1.5 rounded-md border border-surface-3 p-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-caption text-ink-primary">{kr.title}</div>
                                  <div className="text-[11px] text-ink-tertiary">
                                    {kr.currentValue} / {kr.targetValue} {kr.unit || ''}
                                  </div>
                                </div>
                                <span className="shrink-0 text-footnote text-ink-secondary">{pct}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-surface-1 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-caption font-medium text-ink-primary">最近进展</div>
                      <Link href="/okr" className="inline-flex items-center gap-1 text-footnote text-brand-600 hover:text-brand-700">
                        看完整记录 <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    {selectedCheckIns.length === 0 ? (
                      <div className="py-4 text-center text-footnote text-ink-tertiary">暂无 Check-in</div>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {selectedCheckIns.map((c) => {
                          const scopeTitle = c.scope === 'objective'
                            ? selected.title
                            : objKRs.find((kr) => kr.id === c.scopeId)?.title ?? '关键成果';
                          return (
                            <li key={c.id} className="rounded-md border border-surface-3 px-2.5 py-2 text-footnote">
                              <div className="flex items-center justify-between gap-2 text-ink-secondary">
                                <span>{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                                <span>{c.progressBefore}% → {c.progressAfter}%</span>
                              </div>
                              <div className="mt-1 truncate text-ink-primary">{scopeTitle}</div>
                              {c.achievements && <div className="mt-1 text-ink-primary">成果：{c.achievements}</div>}
                              {c.blockers && <div className="mt-1 text-ink-secondary">障碍：{c.blockers}</div>}
                              {c.nextSteps && <div className="mt-1 text-ink-secondary">下一步：{c.nextSteps}</div>}
                              <div className="mt-1 text-ink-tertiary">信心：{CONFIDENCE_LABEL[c.confidenceAfter]}</div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-caption text-ink-secondary">
                  {objKRs.length === 0
                    ? '先为目标添加 KR 才能记录进展。'
                    : '在 OKR 页对 KR 做 check-in，进度会自动回填到这里与看板。'}
                </div>
              )}
            </section>

            {/* ② 本周工作 (遗留 + 本周) */}
            <section className="card-elevated p-4">
              <QuadrantHeader
                icon={CalendarCheck}
                title="本周工作"
                hint={`${view?.thisWeekFocus.length ?? 0} 项 · 含遗留`}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!isViewingSelf}
                  onClick={() => createPlan(startOfWeek(now))}
                  className="rounded-md border border-border px-2.5 py-1 text-footnote text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-ink-tertiary disabled:hover:bg-transparent"
                >
                  + 新增本周工作
                </button>
              </div>
              <InitiativeList
                items={view?.thisWeekFocus ?? []}
                emptyHint="本周暂无安排 · 从右下「未来/待规划」钉过来"
                now={now}
                ownerName={nameOf}
                onEdit={openInitiativeEditor}
                onUpdate={updateInitiativeFromList}
                onDelete={deleteInitiativeFromList}
                readOnly={!isViewingSelf}
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
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={!isViewingSelf}
                  onClick={() => createPlan(startOfWeek(now) + WEEK_MS)}
                  className="rounded-md border border-border px-2.5 py-1 text-footnote text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-ink-tertiary disabled:hover:bg-transparent"
                >
                  + 新增未来计划
                </button>
              </div>
              <InitiativeList
                items={[...(view?.buckets['next-4-weeks'] ?? []), ...(view?.buckets.later ?? []), ...(view?.buckets.backlog ?? [])]}
                emptyHint="暂无待规划行动项 · 去 OKR 给 KR 添加行动项"
                now={now}
                ownerName={nameOf}
                onEdit={openInitiativeEditor}
                onUpdate={updateInitiativeFromList}
                onDelete={deleteInitiativeFromList}
                readOnly={!isViewingSelf}
                action={{ icon: Pin, label: '钉到本周', onClick: (i) => setWeek(i, startOfWeek(now)) }}
              />
            </section>
          </div>
        </>
      )}
      <DeletePlanDialog
        initiative={deletingInit}
        saving={savingDeletePlan}
        error={deletePlanError}
        onClose={() => {
          if (savingDeletePlan) return;
          setDeletingInit(null);
          setDeletePlanError(null);
        }}
        onConfirm={async (init) => {
          setSavingDeletePlan(true);
          setDeletePlanError(null);
          deleteInitiative(init.id);
          try {
            await persistDeleteInitiative(init.id);
            await hydrateOkrFromApi(true);
            setDeletingInit(null);
          } catch (err) {
            await hydrateOkrFromApi(true);
            setDeletePlanError(`删除失败：${(err as Error)?.message || err}`);
          } finally {
            setSavingDeletePlan(false);
          }
        }}
      />
      <CreatePlanDialog
        open={creatingPlanWeekOf !== undefined}
        krs={objKRs}
        initialWeekOf={creatingPlanWeekOf}
        saving={savingCreatePlan}
        error={createPlanError}
        onClose={() => {
          if (savingCreatePlan) return;
          setCreatingPlanWeekOf(undefined);
          setCreatePlanError(null);
        }}
        onSave={async (draft) => {
          if (!draft.title.trim()) {
            setCreatePlanError('请填写工作计划标题');
            return;
          }
          if (!draft.keyResultId) {
            setCreatePlanError('请选择归属 KR');
            return;
          }
          setSavingCreatePlan(true);
          setCreatePlanError(null);
          try {
            await persistCreateInitiative({
              keyResultId: draft.keyResultId,
              title: draft.title.trim(),
              ownerId: effectiveOwner,
              status: draft.status,
              dueDate: draft.dueDate ?? undefined,
              weekOf: draft.weekOf ?? undefined,
            });
            await hydrateOkrFromApi(true);
            setCreatingPlanWeekOf(undefined);
          } catch (err) {
            setCreatePlanError(`新增失败：${(err as Error)?.message || err}`);
          } finally {
            setSavingCreatePlan(false);
          }
        }}
      />
      <InitiativeEditDialog
        initiative={editingInit}
        saving={savingInitiative}
        error={initiativeError}
        onClose={() => {
          if (savingInitiative) return;
          setEditingInit(null);
          setInitiativeError(null);
        }}
        onSave={async (init, patch) => {
          if (!patch.title?.trim()) {
            setInitiativeError('请填写工作事项标题');
            return;
          }
          setSavingInitiative(true);
          setInitiativeError(null);
          try {
            await updateInitiativePatch(init, { ...patch, title: patch.title.trim() });
            setEditingInit(null);
          } catch (err) {
            setInitiativeError(`保存失败：${(err as Error)?.message || err}`);
          } finally {
            setSavingInitiative(false);
          }
        }}
      />
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

function DeletePlanDialog({
  initiative,
  saving,
  error,
  onClose,
  onConfirm,
}: {
  initiative: Initiative | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (init: Initiative) => void;
}) {
  return (
    <Dialog open={Boolean(initiative)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-headline">删除工作计划</DialogTitle>
        </DialogHeader>
        {initiative && (
          <>
            <div className="space-y-2 px-5 py-4 text-caption">
              <p className="text-ink-primary">确认删除「{initiative.title}」？</p>
              <p className="text-ink-secondary">删除后会从本周工作 / 未来计划中移除，并同步重算对应 KR 进度。</p>
              {error && <p className="text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-caption text-ink-secondary hover:bg-surface-3 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onConfirm(initiative)}
                className="inline-flex items-center gap-1 rounded-md bg-danger px-3 py-1.5 text-caption text-white hover:bg-danger/90 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {saving ? '删除中…' : '确认删除'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatePlanDialog({
  open,
  krs,
  initialWeekOf,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  krs: KeyResult[];
  initialWeekOf: number | null | undefined;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: CreatePlanDraft) => void;
}) {
  const [title, setTitle] = useState('');
  const [keyResultId, setKeyResultId] = useState('');
  const [status, setStatus] = useState<Initiative['status']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [weekOf, setWeekOf] = useState('');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setTitle('');
      setKeyResultId(krs[0]?.id ?? '');
      setStatus('todo');
      setDueDate('');
      setWeekOf(toDateInputValue(initialWeekOf));
    }
    wasOpenRef.current = open;
  }, [initialWeekOf, krs, open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className="max-h-[88vh] max-w-xl overflow-hidden p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-headline">新增工作计划</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block space-y-1.5">
            <span className="text-footnote font-medium text-ink-secondary">归属 KR</span>
            <select
              value={keyResultId}
              onChange={(e) => setKeyResultId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            >
              {krs.map((kr) => (
                <option key={kr.id} value={kr.id}>{kr.title}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-footnote font-medium text-ink-secondary">计划标题</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              placeholder="输入本周工作或未来计划"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-footnote font-medium text-ink-secondary">进度状态</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Initiative['status'])}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            >
              {INITIATIVE_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-footnote font-medium text-ink-secondary">开始时间</span>
              <input
                type="date"
                value={weekOf}
                onChange={(e) => setWeekOf(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-footnote font-medium text-ink-secondary">截止时间</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {error && <div className="mr-auto text-footnote text-danger">{error}</div>}
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-caption text-ink-secondary hover:bg-surface-3 disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              onSave({
                title,
                keyResultId,
                status,
                dueDate: fromDateInputValue(dueDate) ?? null,
                weekOf: startDateInputToValue(weekOf),
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-caption text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InitiativeEditDialog({
  initiative,
  saving,
  error,
  onClose,
  onSave,
}: {
  initiative: Initiative | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (init: Initiative, patch: Required<Pick<InitiativeEditPatch, 'title' | 'status'>> & Pick<InitiativeEditPatch, 'dueDate' | 'weekOf'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<Initiative['status']>('todo');
  const [dueDate, setDueDate] = useState('');
  const [weekOf, setWeekOf] = useState('');

  useEffect(() => {
    if (!initiative) return;
    setTitle(initiative.title);
    setStatus(initiative.status);
    setDueDate(toDateInputValue(initiative.dueDate));
    setWeekOf(toDateInputValue(initiative.weekOf));
  }, [initiative]);

  return (
    <Dialog open={Boolean(initiative)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-h-[88vh] max-w-xl overflow-hidden p-0"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-headline">编辑工作计划</DialogTitle>
        </DialogHeader>
        {initiative && (
          <>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <label className="block space-y-1.5">
                <span className="text-footnote font-medium text-ink-secondary">事项标题</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                  placeholder="输入本周工作或未来计划"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-footnote font-medium text-ink-secondary">进度状态</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Initiative['status'])}
                  className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                >
                  {INITIATIVE_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-footnote font-medium text-ink-secondary">开始时间</span>
                  <input
                    type="date"
                    value={weekOf}
                    onChange={(e) => setWeekOf(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-footnote font-medium text-ink-secondary">截止时间</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption text-ink-primary outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-5 py-3">
              {error && <div className="mr-auto text-footnote text-danger">{error}</div>}
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-caption text-ink-secondary hover:bg-surface-3 disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  onSave(initiative, {
                    title,
                    status,
                    dueDate: fromDateInputValue(dueDate) ?? null,
                    weekOf: startDateInputToValue(weekOf),
                  })
                }
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-caption text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InitiativeList({
  items, emptyHint, now, ownerName, onEdit, onUpdate, onDelete, readOnly = false, action,
}: {
  items: Initiative[];
  emptyHint: string;
  now: number;
  ownerName: (id: string) => string;
  onEdit: (i: Initiative) => void;
  onUpdate: (i: Initiative, patch: InitiativeEditPatch) => void;
  onDelete: (i: Initiative) => void;
  readOnly?: boolean;
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
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${done ? 'bg-success' : overdue ? 'bg-danger' : 'bg-brand-400'}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-caption truncate ${done ? 'text-ink-tertiary line-through' : 'text-ink-primary'}`}>{i.title}</div>
              <div className="text-footnote text-ink-tertiary flex items-center gap-2">
                <span>{ownerName(i.ownerId)}</span>
                {readOnly ? (
                  <span className="rounded border border-border bg-surface-1 px-1.5 py-0.5 text-[11px] text-ink-secondary">
                    {INITIATIVE_STATUS_OPTIONS.find((s) => s.value === i.status)?.label ?? i.status}
                  </span>
                ) : (
                  <select
                    value={i.status}
                    onChange={(e) => onUpdate(i, { status: e.target.value as Initiative['status'] })}
                    className="rounded border border-border bg-surface-1 px-1.5 py-0.5 text-[11px] text-ink-secondary outline-none hover:bg-surface-3"
                    title="更新进度状态"
                  >
                    {INITIATIVE_STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                )}
                {i.dueDate != null && (
                  <span className={overdue ? 'text-danger' : ''}>
                    {overdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                    截止 {new Date(i.dueDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                  title="编辑本周/未来计划"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">编辑</span>
                </button>
                <button
                  type="button"
                  onClick={() => action.onClick(i)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                >
                  <ActionIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(i)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-footnote text-danger hover:bg-danger/10"
                  title="删除工作计划"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">删除</span>
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
