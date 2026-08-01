'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useOKRStore, type CheckIn, type Confidence, type KeyResult, type Objective } from '@/lib/store';
import { krProgress } from '@/lib/okr/progress';
import { useOwnerDirectory } from '@/lib/org/use-owner-directory';
import { useAuthStore, useCurrentUserId } from '@/lib/hooks/use-current-user';
import type { ReportSummary } from '@/lib/types/report-summary';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ThumbsUp,
  User,
  Users,
  X,
} from 'lucide-react';

type Mood = 'happy' | 'neutral' | 'sad';
type SummaryTab = 'all' | 'daily' | 'weekly' | 'monthly';
type ScopeView = 'mine' | 'all' | 'peers' | 'department' | 'group' | `person:${string}`;
type SubmitStatus = 'on_time' | 'delayed' | 'missing';
type VisibleReport = Omit<CheckIn, 'scope' | 'achievements' | 'blockers' | 'nextSteps' | 'mood'> & {
  scope: CheckIn['scope'] | 'non_okr';
  achievements?: string | null;
  blockers?: string | null;
  nextSteps?: string | null;
  mood?: Mood | null;
  tenantId?: string;
  reportDate?: string;
  hours?: number;
  workType?: string;
  projectCode?: string;
  sourceSystem?: string;
};
type PlmDailyReport = {
  id: string;
  tenantId: string;
  authorId: string;
  reportDate: string;
  entries: Array<{
    externalEntryId: string;
    krId: string | null;
    projectCode: string;
    hours: number;
    workType: string;
    content: string;
  }>;
};
type ReportWithOkr = {
  report: VisibleReport;
  kr: KeyResult | null;
  objective: Objective | null;
};
type SummaryCardModel = {
  id: string;
  tab: Exclude<SummaryTab, 'all'>;
  authorId: string;
  title: string;
  periodLabel: string;
  periodKey: string;
  submittedAt: number;
  reports: ReportWithOkr[];
  status: SubmitStatus;
  publishedSummary?: ReportSummary;
};
type OkrReportGroup = {
  key: string;
  objective: Objective | null;
  kr: KeyResult | null;
  reports: ReportWithOkr[];
};
type SummaryContentLine = {
  id: string;
  text: string;
  time: string;
  number: number;
};
type SummaryContentGroup = OkrReportGroup & {
  lines: SummaryContentLine[];
};
type OkrDraftRow = {
  id: string;
  kind: 'objective' | 'kr';
  objectiveId: string;
  objectiveTitle: string;
  keyResultId?: string;
  keyResultTitle?: string;
  progress: number;
  confidence: Confidence;
  content: string;
  reportCount: number;
};
type OkrDisplayRow = Pick<
  OkrDraftRow,
  'id' | 'kind' | 'objectiveId' | 'objectiveTitle' | 'keyResultId' | 'keyResultTitle' | 'progress' | 'confidence' | 'content' | 'reportCount'
>;
type SummaryDraft = {
  periodLabel: string;
  sourceCount: number;
  okrRows: OkrDraftRow[];
  workSummary: string;
  okrProgress: string;
  achievements: string;
  blockers: string;
  nextPlan: string;
  supportNeeded: string;
};
type SummaryDraftTextField = Exclude<keyof SummaryDraft, 'sourceCount' | 'okrRows'>;

function okrGroupKey(item: ReportWithOkr): string {
  if (item.kr?.id) {
    return `kr:${item.kr.id}`;
  }
  if (item.objective?.id) {
    return `objective:${item.objective.id}`;
  }
  return `non_okr:${item.report.projectCode ?? item.report.sourceSystem ?? item.report.id}`;
}

function groupReportsByOkr(items: ReportWithOkr[]): OkrReportGroup[] {
  const groups = new Map<string, OkrReportGroup>();
  for (const item of items) {
    const key = okrGroupKey(item);
    const group = groups.get(key) ?? { key, objective: item.objective, kr: item.kr, reports: [] };
    group.reports.push(item);
    groups.set(key, group);
  }
  return Array.from(groups.values());
}

function okrGroupTitle(group: Pick<OkrReportGroup, 'objective' | 'kr'>): string {
  return `${group.objective?.title ?? '非 OKR 工作'}${group.kr ? ` / ${group.kr.title}` : ''}`;
}

const TABS: Array<{ key: SummaryTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'daily', label: '日报' },
  { key: 'weekly', label: '周报' },
  { key: 'monthly', label: '月报' },
];

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  'on-track': '正常',
  'at-risk': '有风险',
  'off-track': '严重落后',
};

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  'on-track': 'bg-success/15 text-success',
  'at-risk': 'bg-warning/15 text-warning',
  'off-track': 'bg-danger/15 text-danger',
};

export default function DailyReportViewPage() {
  const { cycles, objectives, keyResults, activeCycleId } = useOKRStore();
  const { people, nameOf } = useOwnerDirectory();
  const legacyCurrentUserId = useCurrentUserId();
  const authUserId = useAuthStore((state) => state.user?.id);
  const myOwnerIds = useMemo(
    () => new Set([legacyCurrentUserId, authUserId, authUserId ? `person:${authUserId}` : null].filter(Boolean) as string[]),
    [authUserId, legacyCurrentUserId],
  );
  const currentPerson = useMemo(
    () => people.find((person) => ownerMatchesSet(person.id, myOwnerIds)) ?? null,
    [myOwnerIds, people],
  );
  const [reports, setReports] = useState<VisibleReport[]>([]);
  const [reportSummaries, setReportSummaries] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<SummaryTab>('daily');
  const [scope, setScope] = useState<ScopeView>('mine');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(() => dateKey(new Date()));
  const [peersOpen, setPeersOpen] = useState(true);
  const [addingFollow, setAddingFollow] = useState(false);
  const [followSearch, setFollowSearch] = useState('');
  const [followedPersonIds, setFollowedPersonIds] = useState<string[]>([]);
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [summaryEditorTab, setSummaryEditorTab] = useState<'weekly' | 'monthly' | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<SummaryDraft | null>(null);
  const [summaryDraftPublishedAt, setSummaryDraftPublishedAt] = useState<number | null>(null);
  const [summaryPublishing, setSummaryPublishing] = useState(false);
  const [summaryPublishError, setSummaryPublishError] = useState<string | null>(null);

  const selectTab = (nextTab: SummaryTab) => {
    setTab(nextTab);
    setSelectedDateKey(nextTab === 'all' ? null : dateKey(new Date()));
  };

  const selectDate = (nextDateKey: string) => {
    if (tab === 'all') {
      setTab('daily');
    }
    setSelectedDateKey(nextDateKey);
  };

  const openSummaryEditor = (targetTab: 'weekly' | 'monthly') => {
    const anchorDate = selectedDateKey ? parseDateKey(selectedDateKey) : new Date();
    const sourceBaseItems = myReportItems.length > 0 ? myReportItems : scopedItems;
    const sourceItems = sourceBaseItems.filter((item) => matchesSelectedDate(item.report, dateKey(anchorDate), targetTab));
    setSummaryEditorTab(targetTab);
    setSummaryDraft(buildSummaryDraft(sourceItems, targetTab, anchorDate, {
      activeCycleId,
      keyResults,
      myOwnerIds,
      objectives,
    }));
    setSummaryDraftPublishedAt(null);
    setSummaryPublishError(null);
  };

  const publishSummary = async () => {
    if (!summaryEditorTab || !summaryDraft || summaryPublishing) return;
    const anchorDate = selectedDateKey ? parseDateKey(selectedDateKey) : new Date();
    setSummaryPublishing(true);
    setSummaryPublishError(null);
    try {
      const res = await fetch('/api/report/summaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          periodType: summaryEditorTab,
          periodKey: summaryPeriodKey(summaryEditorTab, anchorDate),
          periodLabel: summaryDraft.periodLabel,
          reportDate: dateKey(anchorDate),
          sourceReportCount: summaryDraft.sourceCount,
          okrRows: summaryDraft.okrRows,
          workSummary: summaryDraft.workSummary,
          okrProgress: summaryDraft.okrProgress,
          achievements: summaryDraft.achievements,
          blockers: summaryDraft.blockers,
          nextPlan: summaryDraft.nextPlan,
          supportNeeded: summaryDraft.supportNeeded,
          visibility: 'private',
          viewerIds: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.summary) {
        const message = typeof data?.message === 'string'
          ? data.message
          : typeof data?.error === 'string'
            ? data.error
            : '发布失败';
        throw new Error(`发布失败（${res.status}）：${message}`);
      }
      const nextSummary = data.summary as ReportSummary;
      setReportSummaries((prev) => [nextSummary, ...prev.filter((item) => item.id !== nextSummary.id)]);
      setSummaryDraftPublishedAt(Date.now());
      setSummaryEditorTab(null);
      setSummaryDraft(null);
      setSummaryPublishError(null);
    } catch (error) {
      setSummaryPublishError((error as Error).message);
    } finally {
      setSummaryPublishing(false);
    }
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [checkInRes, dailyReportRes, summariesRes] = await Promise.all([
        fetch('/api/okr/checkins?feed=visible-daily', {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch('/api/integrations/plm/daily-reports', {
          cache: 'no-store',
          credentials: 'include',
        }),
        fetch('/api/report/summaries', {
          cache: 'no-store',
          credentials: 'include',
        }),
      ]);

      const checkInData = checkInRes.ok ? await checkInRes.json() : { checkIns: [] };
      const dailyReportData = dailyReportRes.ok ? await dailyReportRes.json() : { dailyReports: [] };
      const summariesData = summariesRes.ok ? await summariesRes.json() : { summaries: [] };
      const checkIns = Array.isArray(checkInData.checkIns) ? checkInData.checkIns : [];
      const dailyReports = Array.isArray(dailyReportData.dailyReports)
        ? (dailyReportData.dailyReports as PlmDailyReport[])
        : [];
      const summaries = Array.isArray(summariesData.summaries)
        ? (summariesData.summaries as ReportSummary[])
        : [];

      const checkInReports: VisibleReport[] = checkIns.map((item: any) => ({
        ...item,
        achievements: item.achievements ?? undefined,
        blockers: item.blockers ?? undefined,
        nextSteps: item.nextSteps ?? undefined,
        mood: item.mood ?? undefined,
        createdAt: typeof item.createdAt === 'string' ? Date.parse(item.createdAt) : item.createdAt,
      }));
      const nonOkrReports: VisibleReport[] = dailyReports.flatMap((report) =>
        report.entries
          .filter((entry) => entry.krId == null)
          .map((entry) => ({
            id: `${report.id}:${entry.externalEntryId}`,
            scope: 'non_okr' as const,
            scopeId: '',
            authorId: report.authorId,
            progressBefore: 0,
            progressAfter: 0,
            confidenceBefore: 'on-track' as const,
            confidenceAfter: 'on-track' as const,
            achievements: entry.content,
            blockers: null,
            nextSteps: null,
            mood: null,
            visibility: 'private' as const,
            viewerIds: [],
            tenantId: report.tenantId,
            createdAt: Date.parse(`${report.reportDate}T12:00:00.000Z`),
            reportDate: report.reportDate,
            hours: entry.hours,
            workType: entry.workType,
            projectCode: entry.projectCode,
            sourceSystem: 'innovation-studio',
          })),
      );

      setReports([...checkInReports, ...nonOkrReports].sort((a, b) => b.createdAt - a.createdAt));
      setReportSummaries(summaries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreference() {
      setPreferenceLoading(true);
      try {
        const res = await fetch('/api/me/report-view-preferences', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        const ids = data?.preference?.followedPersonIds;
        if (!cancelled && Array.isArray(ids)) {
          setFollowedPersonIds(ids.filter((id): id is string => typeof id === 'string'));
        }
      } finally {
        if (!cancelled) setPreferenceLoading(false);
      }
    }
    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveFollowedPersonIds = useCallback(async (nextIds: string[], rollbackIds: string[]) => {
    const res = await fetch('/api/me/report-view-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ followedPersonIds: nextIds }),
    });
    if (!res.ok) {
      setFollowedPersonIds(rollbackIds);
    }
  }, []);

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === activeCycleId),
    [activeCycleId, cycles],
  );
  const reportItems = useMemo<ReportWithOkr[]>(
    () =>
      reports.map((report) => {
        const kr = report.scope === 'kr' ? keyResults.find((item) => item.id === report.scopeId) ?? null : null;
        const objective =
          report.scope === 'objective'
            ? objectives.find((item) => item.id === report.scopeId) ?? null
            : kr
              ? objectives.find((item) => item.id === kr.objectiveId) ?? null
              : null;
        return { report, kr, objective };
      }),
    [keyResults, objectives, reports],
  );
  const myReportItems = useMemo(
    () => reportItems.filter((item) => ownerMatchesSet(item.report.authorId, myOwnerIds)),
    [myOwnerIds, reportItems],
  );
  const peerIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentPerson?.managerId) return ids;
    for (const person of people) {
      if (person.id !== currentPerson.id && person.managerId === currentPerson.managerId) {
        ids.add(person.id);
        ids.add(`person:${person.id}`);
      }
    }
    return ids;
  }, [currentPerson, people]);
  const departmentIds = useMemo(() => {
    const ids = new Set<string>();
    if (!currentPerson?.ministryId) return ids;
    for (const person of people) {
      if (person.ministryId === currentPerson.ministryId) {
        ids.add(person.id);
        ids.add(`person:${person.id}`);
      }
    }
    return ids;
  }, [currentPerson, people]);
  const groupIds = useMemo(() => {
    if (peerIds.size > 0) return peerIds;
    return departmentIds;
  }, [departmentIds, peerIds]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const scopedItems = useMemo(() => {
    return reportItems.filter((item) => {
      const authorId = item.report.authorId;
      const visibleByScope =
        scope === 'all' ||
        (scope === 'mine' && ownerMatchesSet(authorId, myOwnerIds)) ||
        (scope === 'peers' && ownerMatchesSet(authorId, peerIds)) ||
        (scope === 'department' && ownerMatchesSet(authorId, departmentIds)) ||
        (scope === 'group' && ownerMatchesSet(authorId, groupIds)) ||
        (scope.startsWith('person:') && ownerMatchesSet(authorId, ownerIdSet(scope.slice('person:'.length))));
      if (!visibleByScope) return false;
      if (!normalizedKeyword) return true;
      const text = [
        nameOf(authorId),
        authorId,
        item.objective?.title,
        item.kr?.title,
        item.report.achievements,
        item.report.blockers,
        item.report.nextSteps,
        item.report.projectCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [departmentIds, groupIds, myOwnerIds, nameOf, normalizedKeyword, peerIds, reportItems, scope]);

  const dateFilteredItems = useMemo(
    () => scopedItems.filter((item) => matchesSelectedDate(item.report, selectedDateKey, tab)),
    [scopedItems, selectedDateKey, tab],
  );
  const scopedSummaries = useMemo(() => {
    return reportSummaries.filter((summary) => {
      const authorId = summary.authorId;
      const visibleByScope =
        scope === 'all' ||
        (scope === 'mine' && ownerMatchesSet(authorId, myOwnerIds)) ||
        (scope === 'peers' && ownerMatchesSet(authorId, peerIds)) ||
        (scope === 'department' && ownerMatchesSet(authorId, departmentIds)) ||
        (scope === 'group' && ownerMatchesSet(authorId, groupIds)) ||
        (scope.startsWith('person:') && ownerMatchesSet(authorId, ownerIdSet(scope.slice('person:'.length))));
      if (!visibleByScope) return false;
      if (!normalizedKeyword) return true;
      const text = [
        nameOf(authorId),
        authorId,
        summary.periodLabel,
        summary.workSummary,
        summary.achievements,
        summary.blockers,
        summary.nextPlan,
        ...summary.okrRows.map((row) => `${row.objectiveTitle} ${row.keyResultTitle ?? ''} ${row.content}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [departmentIds, groupIds, myOwnerIds, nameOf, normalizedKeyword, peerIds, reportSummaries, scope]);
  const dateFilteredSummaries = useMemo(
    () => scopedSummaries.filter((summary) => matchesSummaryDate(summary, selectedDateKey, tab)),
    [scopedSummaries, selectedDateKey, tab],
  );

  const cards = useMemo(() => {
    const daily = buildDailyCards(dateFilteredItems);
    const weekly = buildGroupedCards(dateFilteredItems, 'weekly');
    const monthly = buildGroupedCards(dateFilteredItems, 'monthly');
    if (tab === 'daily') return daily;
    if (tab === 'weekly') return mergePublishedAndComputedCards(buildPublishedSummaryCards(dateFilteredSummaries, 'weekly'), weekly);
    if (tab === 'monthly') return mergePublishedAndComputedCards(buildPublishedSummaryCards(dateFilteredSummaries, 'monthly'), monthly);
    return daily;
  }, [dateFilteredItems, dateFilteredSummaries, tab]);

  const addablePeople = useMemo(() => {
    const existing = new Set(followedPersonIds);
    const search = followSearch.trim().toLowerCase();
    return people
      .filter((person) => !ownerMatchesSet(person.id, myOwnerIds) && !existing.has(person.id))
      .filter((person) => !search || person.name.toLowerCase().includes(search) || person.id.toLowerCase().includes(search))
      .slice(0, 10);
  }, [followSearch, followedPersonIds, myOwnerIds, people]);
  const writeLabel = tab === 'monthly' ? '写月报' : tab === 'weekly' ? '写周报' : '写日报';

  return (
    <>
    <div className="min-h-full bg-surface-2">
      <div className="mx-auto flex min-h-full w-full max-w-[1560px] gap-4 px-4 py-4">
        <aside className="hidden w-[216px] shrink-0 md:block">
          <div className="sticky top-4 rounded-lg bg-surface-1 p-4 shadow-soft-sm ring-1 ring-border">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索同事"
                className="h-9 rounded-full border-border bg-surface-1 pl-8 pr-8 text-[12px] focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-ink-tertiary hover:bg-surface-2 hover:text-ink-secondary"
                  aria-label="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-5 space-y-1">
              <SideButton active={scope === 'mine'} icon={User} label="我的总结" onClick={() => setScope('mine')} />
              <SideButton active={scope === 'all'} icon={FileText} label="全部总结" onClick={() => setScope('all')} />
              <button
                type="button"
                onClick={() => {
                  setScope('peers');
                  setPeersOpen((value) => !value);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition',
                  scope === 'peers' ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
                )}
              >
                <Users className={cn('h-4 w-4 shrink-0', scope === 'peers' ? 'text-brand-700' : 'text-ink-tertiary')} />
                <span className="min-w-0 flex-1 truncate">我的同级</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition', peersOpen && 'rotate-180')} />
              </button>
              {peersOpen && (
                <div className="space-y-1 pl-6">
                  {people
                    .filter((person) => ownerMatchesSet(person.id, peerIds))
                    .slice(0, 6)
                    .map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => setScope(`person:${person.id}`)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition',
                          scope === `person:${person.id}` ? 'bg-brand-50 text-brand-700' : 'text-ink-secondary hover:bg-surface-2',
                        )}
                      >
                        <Avatar name={person.name} size="sm" />
                        <span className="truncate">{person.name}</span>
                      </button>
                    ))}
                </div>
              )}

              <div className="relative">
                <div className="flex items-center justify-between">
                  <SideButton active={false} icon={Heart} label="关注的人" onClick={() => setAddingFollow((value) => !value)} />
                  <button
                    type="button"
                    onClick={() => setAddingFollow((value) => !value)}
                    className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-tertiary hover:bg-brand-50 hover:text-brand-700"
                    aria-label="添加关注的人"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {followedPersonIds.length > 0 && (
                  <div className="space-y-1 pl-6">
                    {followedPersonIds.map((personId) => (
                      <button
                        key={personId}
                        type="button"
                        onClick={() => setScope(`person:${personId}`)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition',
                          scope === `person:${personId}` ? 'bg-brand-50 text-brand-700' : 'text-ink-secondary hover:bg-surface-2',
                        )}
                      >
                        <Avatar name={nameOf(personId)} size="sm" />
                        <span className="truncate">{nameOf(personId)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {preferenceLoading && followedPersonIds.length === 0 && (
                  <p className="px-9 py-1 text-[11px] text-ink-tertiary">正在读取关注的人...</p>
                )}
                {addingFollow && (
                  <div className="absolute left-[112px] top-8 z-20 w-[312px] rounded-lg bg-surface-1 p-4 shadow-soft-lg ring-1 ring-border">
                    <div className="relative mb-3">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-600" />
                      <Input
                        value={followSearch}
                        onChange={(event) => setFollowSearch(event.target.value)}
                        placeholder="搜索"
                        className="h-9 rounded-md border-brand-300 bg-surface-1 pl-8 text-[12px] focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                    <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
                      {addablePeople.length === 0 ? (
                        <p className="px-2 py-2 text-[12px] text-ink-tertiary">暂无可添加人员</p>
                      ) : (
                        addablePeople.map((person) => (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() => {
                              setFollowedPersonIds((prev) => {
                                const next = Array.from(new Set([...prev, person.id]));
                                void saveFollowedPersonIds(next, prev);
                                return next;
                              });
                              setScope(`person:${person.id}`);
                              setAddingFollow(false);
                              setFollowSearch('');
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-secondary hover:bg-brand-50 hover:text-brand-700"
                          >
                            <Folder className="h-3.5 w-3.5 text-ink-tertiary" />
                            <span className="truncate">{person.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-7">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => selectTab(item.key)}
                  className={cn(
                    'relative h-9 text-[16px] transition',
                    tab === item.key ? 'font-semibold text-ink-primary' : 'text-ink-tertiary hover:text-ink-primary',
                  )}
                >
                  {item.label}
                  {tab === item.key && <span className="absolute inset-x-1 -bottom-0.5 h-[3px] rounded-full bg-brand-500" />}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedDateKey(null)}
                className="h-10 rounded-full bg-surface-1 px-4 text-[13px]"
              >
                {selectedDateKey ? selectedDateFilterLabel(selectedDateKey, tab) : '全部日期'}
                {selectedDateKey ? <X className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
              {tab === 'weekly' || tab === 'monthly' ? (
                <Button
                  type="button"
                  onClick={() => openSummaryEditor(tab)}
                  className="h-10 rounded-full bg-brand-500 px-5 text-[13px] text-white hover:bg-brand-600"
                >
                  {writeLabel}
                </Button>
              ) : (
                <Button asChild className="h-10 rounded-full bg-brand-500 px-5 text-[13px] text-white hover:bg-brand-600">
                  <Link href="/report">{writeLabel}</Link>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadReports()}
                disabled={loading}
                className="h-10 rounded-full bg-surface-1 px-3 text-[13px]"
              >
                <RefreshCw className={cn('h-3.5 w-3.5 text-brand-600', loading && 'animate-spin')} />
              </Button>
            </div>
          </header>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_312px]">
            <section className="min-w-0 space-y-3">
              {cards.length === 0 ? (
                <div className="flex min-h-[500px] items-center justify-center rounded-lg bg-surface-2 text-center">
                  <div>
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <FileText className="h-9 w-9" />
                    </div>
                    <p className="mt-4 text-[14px] text-ink-secondary">
                      {loading ? '正在加载总结...' : '总结工作更有助于效率提升哦~'}
                    </p>
                  </div>
                </div>
              ) : (
                cards.map((card) => (
                  card.publishedSummary
                    ? <PublishedSummaryCard key={card.id} card={card} nameOf={nameOf} />
                    : <SummaryCard key={card.id} card={card} nameOf={nameOf} />
                ))
              )}
            </section>
            <DatePanel
              tab={tab}
              reports={scopedItems.map((item) => item.report)}
              selectedDateKey={selectedDateKey}
              onSelectDate={selectDate}
            />
          </div>
        </main>
      </div>
    </div>
    <SummaryEditorDialog
      open={summaryEditorTab !== null && summaryDraft !== null}
      tab={summaryEditorTab}
      draft={summaryDraft}
      publishedAt={summaryDraftPublishedAt}
      publishing={summaryPublishing}
      publishError={summaryPublishError}
      onChange={setSummaryDraft}
      onClose={() => {
        setSummaryEditorTab(null);
        setSummaryDraft(null);
        setSummaryDraftPublishedAt(null);
        setSummaryPublishError(null);
      }}
      onPublish={() => void publishSummary()}
    />
    </>
  );
}

function SummaryEditorDialog({
  open,
  tab,
  draft,
  publishedAt,
  publishing,
  publishError,
  onChange,
  onClose,
  onPublish,
}: {
  open: boolean;
  tab: 'weekly' | 'monthly' | null;
  draft: SummaryDraft | null;
  publishedAt: number | null;
  publishing: boolean;
  publishError: string | null;
  onChange: (draft: SummaryDraft) => void;
  onClose: () => void;
  onPublish: () => void;
}) {
  if (!draft || !tab) return null;
  const title = tab === 'weekly' ? '写周报' : '写月报';
  const reportName = tab === 'weekly' ? '周报' : '月报';
  const periodName = tab === 'weekly' ? '本周' : '本月';
  const update = (field: SummaryDraftTextField, value: string) => onChange({ ...draft, [field]: value });
  const updateOkrRow = (rowId: string, content: string) => {
    const okrRows = draft.okrRows.map((row) => (row.id === rowId ? { ...row, content } : row));
    onChange({ ...draft, okrRows, okrProgress: composeOkrProgressFromRows(okrRows) });
  };
  const updateOkrRowProgress = (rowId: string, value: string) => {
    const okrRows = draft.okrRows.map((row) => (
      row.id === rowId ? { ...row, progress: clampProgress(Number(value)) } : row
    ));
    onChange({ ...draft, okrRows, okrProgress: composeOkrProgressFromRows(okrRows) });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[84vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle className="text-headline">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-6">
          <div className="mb-4 rounded-md border border-brand-100 bg-brand-50/70 px-3 py-2 text-footnote text-ink-secondary">
            <span className="font-medium text-ink-primary">{draft.periodLabel}</span>
            <span className="mx-1.5">·</span>
            已按{periodName} {draft.sourceCount} 条日报生成待发布内容，发布后会进入{reportName}列表。
            {publishedAt && (
              <span className="ml-2 text-success">已发布 {new Date(publishedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>

          <section className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[14px] font-semibold text-ink-primary">{periodName} OKR 进展</h3>
                <p className="mt-0.5 text-footnote text-ink-tertiary">按我的当前周期 OKR / KR 填写，日报内容已自动带入对应 KR。</p>
              </div>
              <Badge variant="outline" className="bg-white text-[11px]">
                {draft.okrRows.length} 项
              </Badge>
            </div>
            {draft.okrRows.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-footnote text-ink-tertiary">
                当前周期暂无可关联的个人 OKR / KR。
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[minmax(320px,1.4fr)_150px_110px_minmax(340px,1.6fr)] bg-surface-2 text-[12px] font-medium text-ink-tertiary">
                    <div className="border-r border-border px-3 py-2">OKR / KR</div>
                    <div className="border-r border-border px-3 py-2 text-center">完成度</div>
                    <div className="border-r border-border px-3 py-2 text-center">信心</div>
                    <div className="px-3 py-2">进展</div>
                  </div>
                  {draft.okrRows.map((row) => (
                    <div key={row.id} className="grid grid-cols-[minmax(320px,1.4fr)_150px_110px_minmax(340px,1.6fr)] border-t border-border bg-white">
                      <div className="min-w-0 border-r border-border px-3 py-3">
                        <div className="flex items-start gap-2">
                          <span className={cn(
                            'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            row.kind === 'objective' ? 'bg-brand-50 text-brand-700' : 'bg-surface-2 text-ink-tertiary',
                          )}>
                            {row.kind === 'objective' ? 'O' : 'KR'}
                          </span>
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-[13px] font-medium text-ink-primary">
                              {row.kind === 'objective' ? row.objectiveTitle : row.keyResultTitle}
                            </p>
                            {row.kind === 'kr' && (
                              <p className="mt-1 line-clamp-1 text-[11px] text-ink-tertiary">{row.objectiveTitle}</p>
                            )}
                            {row.reportCount > 0 && (
                              <p className="mt-1 text-[11px] text-brand-700">已带入 {row.reportCount} 条日报</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="border-r border-border px-3 py-3">
                        <label className="mx-auto flex h-8 max-w-[98px] items-center rounded-md border border-border bg-white px-2 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={row.progress}
                            onChange={(event) => updateOkrRowProgress(row.id, event.target.value)}
                            className="h-6 border-0 bg-transparent p-0 text-center text-[13px] font-semibold tabular-nums text-ink-primary shadow-none focus-visible:ring-0"
                            aria-label={`${row.kind === 'objective' ? row.objectiveTitle : row.keyResultTitle}完成度`}
                          />
                          <span className="ml-1 shrink-0 text-[12px] text-ink-tertiary">%</span>
                        </label>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${row.progress}%` }} />
                        </div>
                      </div>
                      <div className="flex items-start justify-center border-r border-border px-3 py-3">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', CONFIDENCE_STYLE[row.confidence])}>
                          {CONFIDENCE_LABEL[row.confidence]}
                        </span>
                      </div>
                      <div className="px-3 py-2">
                        <Textarea
                          value={row.content}
                          onChange={(event) => updateOkrRow(row.id, event.target.value)}
                          placeholder="填写本周期围绕该 OKR / KR 的进展、结果或风险"
                          className="min-h-[76px] resize-y border-0 bg-transparent px-0 py-0 text-[12px] leading-relaxed shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <SummaryDraftField
              label={`${periodName}工作总结`}
              value={draft.workSummary}
              onChange={(value) => update('workSummary', value)}
              className="md:col-span-2"
            />
            <SummaryDraftField
              label="关键成果"
              value={draft.achievements}
              onChange={(value) => update('achievements', value)}
            />
            <SummaryDraftField
              label="问题与卡点"
              value={draft.blockers}
              onChange={(value) => update('blockers', value)}
            />
            <SummaryDraftField
              label={tab === 'weekly' ? '下周计划' : '下月计划'}
              value={draft.nextPlan}
              onChange={(value) => update('nextPlan', value)}
            />
            <SummaryDraftField
              label="需要协同 / 支持"
              value={draft.supportNeeded}
              onChange={(value) => update('supportNeeded', value)}
              className="md:col-span-2"
            />
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-surface-1 px-5 py-4 pb-5">
          <div className="flex items-center justify-between gap-3">
          <p className={cn('text-footnote', publishError ? 'text-danger' : 'text-ink-tertiary')}>
            {publishError ?? `点击发布后，这条${reportName}会保存到当前周期记录列表，并显示为“已发布”。`}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={publishing}>关闭</Button>
            <Button type="button" onClick={onPublish} disabled={publishing}>
              {publishing ? '发布中...' : `发布${reportName}`}
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryDraftField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-footnote font-medium text-ink-secondary">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[92px] resize-y bg-white text-caption leading-relaxed"
      />
    </label>
  );
}

function PublishedSummaryCard({ card, nameOf }: { card: SummaryCardModel; nameOf: (ownerId: string | undefined | null) => string }) {
  const summary = card.publishedSummary;
  if (!summary) return null;
  return (
    <article className="rounded-lg bg-surface-1 px-6 py-5 shadow-soft-sm ring-1 ring-border">
      <div className="flex items-start gap-4">
        <Avatar name={nameOf(summary.authorId)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-semibold text-ink-primary">{nameOf(summary.authorId)}</h2>
                <span className="text-[15px] text-ink-tertiary">的{summary.periodType === 'weekly' ? '周报' : '月报'}</span>
                <span className="rounded-md bg-success/15 px-2 py-0.5 text-[12px] text-success">已发布</span>
              </div>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                总裁办 · {formatTime(Date.parse(summary.publishedAt))} · 仅相关成员
              </p>
            </div>
            <MoreHorizontal className="h-4 w-4 text-ink-tertiary" />
          </div>

          <div className="mt-4">
            <Badge variant="outline" className="rounded-md border-brand-200 bg-brand-50 px-2 py-0.5 text-[12px] text-brand-700">
              {summary.periodType === 'weekly' ? '周报' : '月报'} · {summary.periodLabel}
            </Badge>
          </div>

          <ExpandableOkrProgressTable
            title={`${summary.periodType === 'weekly' ? '本周' : '本月'} OKR 进展`}
            rows={summary.okrRows}
            defaultExpanded
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <SummaryTextBlock title="工作总结" value={summary.workSummary} />
            <SummaryTextBlock title="关键成果" value={summary.achievements} />
            <SummaryTextBlock title="问题与卡点" value={summary.blockers} />
            <SummaryTextBlock title={summary.periodType === 'weekly' ? '下周计划' : '下月计划'} value={summary.nextPlan} />
          </div>
        </div>
      </div>
    </article>
  );
}

function ExpandableOkrProgressTable({
  title,
  rows,
  defaultExpanded = false,
}: {
  title: string;
  rows: OkrDisplayRow[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-[15px] font-semibold text-ink-primary"
        aria-expanded={expanded}
      >
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', !expanded && '-rotate-90')} />
        <span>{title}</span>
        <span className="text-[13px] font-semibold tabular-nums text-ink-secondary">{rows.length}</span>
      </button>
      {expanded && (
        <div className="mt-2 overflow-x-auto rounded-md border border-border">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[minmax(360px,1.5fr)_100px_96px_minmax(300px,1fr)] bg-surface-2 text-[12px] font-medium text-ink-tertiary">
              <div className="border-r border-border px-3 py-2 text-center">OKR / KR</div>
              <div className="border-r border-border px-3 py-2 text-center">完成度</div>
              <div className="border-r border-border px-3 py-2 text-center">信心</div>
              <div className="px-3 py-2">进展</div>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-6 text-center text-footnote text-ink-tertiary">暂无可展开的 OKR / KR 进展。</div>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[minmax(360px,1.5fr)_100px_96px_minmax(300px,1fr)] border-t border-border bg-white text-[12px]">
                  <div className="min-w-0 border-r border-border px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <span className={cn(
                        'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        row.kind === 'objective' ? 'bg-brand-50 text-brand-700' : 'bg-surface-2 text-ink-tertiary',
                      )}>
                        {row.kind === 'objective' ? 'O' : 'KR'}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium text-ink-primary">
                          {row.kind === 'objective' ? row.objectiveTitle : row.keyResultTitle}
                        </p>
                        {row.kind === 'kr' && <p className="mt-1 line-clamp-1 text-[11px] text-ink-tertiary">{row.objectiveTitle}</p>}
                        {row.reportCount > 0 && <p className="mt-1 text-[11px] text-brand-700">已带入 {row.reportCount} 条日报</p>}
                      </div>
                    </div>
                  </div>
                  <div className="border-r border-border px-3 py-2.5">
                    <div className="text-center font-semibold tabular-nums text-ink-primary">{row.progress}%</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${row.progress}%` }} />
                    </div>
                  </div>
                  <div className="flex items-start justify-center border-r border-border px-3 py-2.5">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium', CONFIDENCE_STYLE[row.confidence])}>
                      {CONFIDENCE_LABEL[row.confidence]}
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="line-clamp-3 whitespace-pre-wrap leading-6 text-ink-secondary">{row.content || '-'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryTextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-4 py-3">
      <p className="mb-1 text-[12px] font-semibold text-ink-secondary">{title}</p>
      <p className="line-clamp-3 whitespace-pre-wrap text-[13px] leading-6 text-ink-primary">{value || '暂无'}</p>
    </div>
  );
}

function SummaryCard({ card, nameOf }: { card: SummaryCardModel; nameOf: (ownerId: string | undefined | null) => string }) {
  const [expanded, setExpanded] = useState(false);
  const okrGroups = useMemo(() => groupReportsByOkr(card.reports), [card.reports]);
  const summaryRows = useMemo(() => buildOkrDisplayRowsFromGroups(okrGroups), [okrGroups]);
  const contentGroups = useMemo(() => {
    let lineNumber = 0;
    return okrGroups
      .map((group) => {
        const lines = group.reports.flatMap(({ report }) => {
          const time = formatTime(report.createdAt);
          return [
            report.achievements ? { id: `${report.id}:achievements`, text: report.achievements, time, number: ++lineNumber } : null,
            report.blockers ? { id: `${report.id}:blockers`, text: `卡点：${report.blockers}`, time, number: ++lineNumber } : null,
            report.nextSteps ? { id: `${report.id}:nextSteps`, text: `下一步：${report.nextSteps}`, time, number: ++lineNumber } : null,
          ].filter(Boolean) as SummaryContentLine[];
        });
        return { ...group, lines };
      })
      .filter((group) => group.lines.length > 0);
  }, [okrGroups]);
  const contentLineCount = contentGroups.reduce((total, group) => total + group.lines.length, 0);
  const visibleContentGroups = useMemo(() => {
    if (expanded) {
      return contentGroups;
    }
    let remaining = 4;
    return contentGroups
      .map((group) => {
        if (remaining <= 0) {
          return null;
        }
        const lines = group.lines.slice(0, remaining);
        remaining -= lines.length;
        return { ...group, lines };
      })
      .filter(Boolean) as SummaryContentGroup[];
  }, [contentGroups, expanded]);
  const hasMore = contentLineCount > 4 || okrGroups.length > 3;
  const taskCount = Math.max(1, card.reports.length);

  return (
    <article className="rounded-lg bg-surface-1 px-6 py-5 shadow-soft-sm ring-1 ring-border">
      <div className="flex items-start gap-4">
        <Avatar name={nameOf(card.authorId)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-semibold text-ink-primary">{nameOf(card.authorId)}</h2>
                <span className="text-[15px] text-ink-tertiary">的{card.tab === 'daily' ? '日报' : card.tab === 'weekly' ? '周报' : '月报'}</span>
                <StatusBadge status={card.status} />
              </div>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                总裁办 · {formatTime(card.submittedAt)} · 仅相关成员
              </p>
            </div>
            <MoreHorizontal className="h-4 w-4 text-ink-tertiary" />
          </div>

          <div className="mt-4">
            <Badge variant="outline" className="rounded-md border-brand-200 bg-brand-50 px-2 py-0.5 text-[12px] text-brand-700">
              {card.tab === 'daily' ? '日报' : card.tab === 'weekly' ? '周报' : '月报'} · {card.periodLabel}
            </Badge>
          </div>

          <ExpandableOkrProgressTable
            title={`${card.tab === 'daily' ? '今日' : card.tab === 'weekly' ? '本周' : '本月'} OKR 进展`}
            rows={summaryRows}
            defaultExpanded={false}
          />

          <div className="mt-5">
            <p className="mb-2 text-[15px] font-semibold text-ink-primary">工作总结</p>
            {contentLineCount === 0 ? (
              <p className="text-[13px] text-ink-tertiary">没有具体描述完成的事项</p>
            ) : (
              <div className={cn('space-y-3 text-[14px] leading-7 text-ink-primary', !expanded && 'max-h-[168px] overflow-hidden')}>
                {visibleContentGroups.map((group) => (
                  <div key={`${card.id}:${group.key}`} className="space-y-1">
                    {contentGroups.length > 1 && (
                      <p className="line-clamp-1 text-[12px] leading-5 text-ink-tertiary">{okrGroupTitle(group)}</p>
                    )}
                    {group.lines.map((line) => (
                      <p key={line.id} className="whitespace-pre-wrap">
                        {card.tab === 'daily' ? line.text : `${line.number}. ${line.text}`}
                        <span className="ml-2 whitespace-nowrap text-[12px] text-ink-tertiary">{line.time}</span>
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline"
              >
                {expanded ? '收起' : '查看更多'}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
          </div>

          <div className="mt-4 grid max-w-[860px] grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-md bg-brand-50 px-4 py-3 text-ink-secondary">
              <span>全部</span>
              <span className="float-right font-semibold tabular-nums text-brand-700">{taskCount}</span>
            </div>
            <div className="rounded-md bg-surface-2 px-4 py-3 text-ink-secondary">
              <span>进行中</span>
              <span className="float-right font-semibold tabular-nums text-brand-700">{taskCount}</span>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-6 text-ink-tertiary">
            <FileText className="h-4 w-4" />
            <MessageCircle className="h-4 w-4" />
            <ThumbsUp className="h-4 w-4" />
          </div>
        </div>
      </div>
    </article>
  );
}

function DatePanel({
  tab,
  reports,
  selectedDateKey,
  onSelectDate,
}: {
  tab: SummaryTab;
  reports: VisibleReport[];
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const now = new Date();
  const panelDate = selectedDateKey ? parseDateKey(selectedDateKey) : now;
  const year = panelDate.getFullYear();
  const month = panelDate.getMonth();
  const reportDaySet = new Set(reports.map((report) => reportDateKey(report)));
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-4 rounded-lg bg-surface-1 p-5 shadow-soft-sm ring-1 ring-border">
        {tab === 'monthly' ? (
          <MonthGrid year={year} reports={reports} selectedDateKey={selectedDateKey} onSelectDate={onSelectDate} />
        ) : tab === 'weekly' ? (
          <WeekList year={year} month={month} reports={reports} selectedDateKey={selectedDateKey} onSelectDate={onSelectDate} />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink-primary">{year} 年 {String(month + 1).padStart(2, '0')} 月</h3>
              <div className="flex items-center gap-2 text-ink-tertiary">
                <ChevronDown className="h-4 w-4 rotate-180" />
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-[12px] text-ink-tertiary">
              {'日一二三四五六'.split('').map((day) => <span key={day}>{day}</span>)}
              {calendarCells(year, month).map((date, index) => {
                if (!date) {
                  return <span key={`empty-${index}`} aria-hidden="true" className="h-7 rounded-md" />;
                }
                const cellKey = date ? dateKey(date) : null;
                const hasReport = cellKey ? reportDaySet.has(cellKey) : false;
                const isToday = date?.toDateString() === now.toDateString();
                const isSelected = cellKey === selectedDateKey;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      if (cellKey) onSelectDate(cellKey);
                    }}
                    className={cn(
                      'flex h-7 items-center justify-center rounded-md transition',
                      hasReport && 'bg-success/15 text-ink-primary',
                      !hasReport && 'bg-danger/10 text-ink-secondary',
                      'hover:ring-1 hover:ring-brand-300',
                      isToday && !isSelected && 'font-semibold text-brand-700',
                      isSelected && 'bg-brand-500 font-semibold text-white ring-2 ring-brand-500',
                    )}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <Legend />
      </div>
    </aside>
  );
}

function WeekList({
  year,
  month,
  reports,
  selectedDateKey,
  onSelectDate,
}: {
  year: number;
  month: number;
  reports: VisibleReport[];
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const weeks = monthWeeks(year, month);
  const submittedWeeks = new Set(reports.map((report) => weekKey(reportDateOf(report))));
  const selectedWeekKey = selectedDateKey ? weekKey(parseDateKey(selectedDateKey)) : null;
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink-primary">{year} 年 {String(month + 1).padStart(2, '0')} 月</h3>
        <div className="flex items-center gap-2 text-ink-tertiary">
          <ChevronDown className="h-4 w-4 rotate-180" />
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
      <div className="space-y-3">
        {weeks.map((week, index) => {
          const isSelected = week.key === selectedWeekKey;
          return (
          <button
            key={week.key}
            type="button"
            onClick={() => onSelectDate(dateKey(week.start))}
            className={cn(
              'w-full rounded-md px-4 py-3 text-left text-[13px] transition hover:ring-1 hover:ring-brand-300',
              submittedWeeks.has(week.key) ? 'bg-success/15 text-ink-primary' : index === weeks.length - 1 ? 'bg-surface-2 text-ink-secondary' : 'bg-danger/10 text-ink-secondary',
              isSelected && 'bg-brand-500 font-semibold text-white ring-2 ring-brand-500',
            )}
          >
            第{index + 1}周&nbsp;&nbsp; {formatShortDate(week.start)} ~ {formatShortDate(week.end)}
          </button>
          );
        })}
      </div>
    </>
  );
}

function MonthGrid({
  year,
  reports,
  selectedDateKey,
  onSelectDate,
}: {
  year: number;
  reports: VisibleReport[];
  selectedDateKey: string | null;
  onSelectDate: (dateKey: string) => void;
}) {
  const submittedMonths = new Set(reports.map((report) => {
    const reportDate = reportDateOf(report);
    return `${reportDate.getFullYear()}-${reportDate.getMonth()}`;
  }));
  const selectedDate = selectedDateKey ? parseDateKey(selectedDateKey) : null;
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <ChevronLeft className="h-4 w-4 text-ink-tertiary" />
        <h3 className="text-[15px] font-semibold text-ink-primary">{year}</h3>
        <ChevronRight className="h-4 w-4 text-ink-tertiary" />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-[13px]">
        {Array.from({ length: 12 }, (_, index) => {
          const hasReport = submittedMonths.has(`${year}-${index}`);
          const isSelected = selectedDate?.getFullYear() === year && selectedDate.getMonth() === index;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectDate(dateKey(new Date(year, index, 1)))}
              className={cn(
                'rounded-md px-3 py-2 transition hover:ring-1 hover:ring-brand-300',
                hasReport ? 'bg-success/15 text-ink-primary' : 'bg-danger/10 text-ink-secondary',
                isSelected && 'bg-brand-500 font-semibold text-white ring-2 ring-brand-500',
              )}
            >
              {index + 1}月
            </button>
          );
        })}
      </div>
    </>
  );
}

function Legend() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-ink-secondary">
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-success/40" />按时提交</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-warning/40" />延时提交</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-danger/30" />未提交</span>
    </div>
  );
}

function SideButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition',
        active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-700' : 'text-ink-tertiary')} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-200',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-12 w-12 text-[14px]',
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: SubmitStatus }) {
  const meta = {
    on_time: 'bg-success/15 text-success',
    delayed: 'bg-warning/15 text-warning',
    missing: 'bg-danger/15 text-danger',
  }[status];
  const label = status === 'on_time' ? '按时提交' : status === 'delayed' ? '延时提交' : '未提交';
  return <span className={cn('rounded-md px-2 py-0.5 text-[12px]', meta)}>{label}</span>;
}

function buildPublishedSummaryCards(summaries: ReportSummary[], tab: 'weekly' | 'monthly'): SummaryCardModel[] {
  return summaries
    .filter((summary) => summary.periodType === tab)
    .map((summary) => ({
      id: `published:${summary.id}`,
      tab,
      authorId: summary.authorId,
      title: `${summary.periodLabel} ${tab === 'weekly' ? '周报' : '月报'}`,
      periodLabel: `${summary.periodLabel} ${tab === 'weekly' ? '周报' : '月报'}`,
      periodKey: summary.periodKey,
      submittedAt: Date.parse(summary.publishedAt),
      reports: [],
      status: 'on_time' as const,
      publishedSummary: summary,
    }))
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

function mergePublishedAndComputedCards(publishedCards: SummaryCardModel[], computedCards: SummaryCardModel[]): SummaryCardModel[] {
  const publishedKeys = new Set(publishedCards.map((card) => `${card.authorId}:${card.tab}:${card.periodKey}`));
  return [
    ...publishedCards,
    ...computedCards.filter((card) => !publishedKeys.has(`${card.authorId}:${card.tab}:${card.periodKey}`)),
  ].sort((a, b) => b.submittedAt - a.submittedAt);
}

function buildOkrDisplayRowsFromGroups(groups: OkrReportGroup[]): OkrDisplayRow[] {
  return groups
    .filter((group) => group.objective || group.kr)
    .map((group) => {
      const latest = [...group.reports].sort((a, b) => b.report.createdAt - a.report.createdAt)[0]?.report;
      const kind = group.kr ? 'kr' : 'objective';
      return {
        id: group.key,
        kind,
        objectiveId: group.objective?.id ?? group.kr?.objectiveId ?? group.key,
        objectiveTitle: group.objective?.title ?? '非 OKR 工作',
        keyResultId: group.kr?.id,
        keyResultTitle: group.kr?.title,
        progress: latest ? clampProgress(latest.progressAfter) : 0,
        confidence: latest?.confidenceAfter ?? group.kr?.confidence ?? group.objective?.confidence ?? 'on-track',
        content: composeReportContent(group.reports),
        reportCount: group.reports.length,
      } satisfies OkrDisplayRow;
    });
}

function buildDailyCards(items: ReportWithOkr[]): SummaryCardModel[] {
  const groups = new Map<string, ReportWithOkr[]>();
  for (const item of items) {
    const key = `${item.report.authorId}:${reportDateKey(item.report)}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([key, reports]) => {
      const latest = Math.max(...reports.map((item) => item.report.createdAt));
      const periodDate = reportDateOf(reports[0].report);
      return {
        id: `daily:${key}`,
        tab: 'daily',
        authorId: reports[0].report.authorId,
        title: `${formatDate(periodDate)} 日报`,
        periodLabel: `${formatDate(periodDate)} 日报`,
        periodKey: dateKey(periodDate),
        submittedAt: latest,
        reports: reports.sort((a, b) => a.report.createdAt - b.report.createdAt),
        status: reports.some((item) => inferStatus(item.report) === 'delayed') ? 'delayed' : 'on_time',
      } satisfies SummaryCardModel;
    })
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

function buildGroupedCards(items: ReportWithOkr[], tab: 'weekly' | 'monthly'): SummaryCardModel[] {
  const groups = new Map<string, ReportWithOkr[]>();
  for (const item of items) {
    const date = reportDateOf(item.report);
    const periodKey = summaryPeriodKey(tab, date);
    const key = `${item.report.authorId}:${periodKey}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .map(([key, reports]) => {
      const latest = Math.max(...reports.map((item) => item.report.createdAt));
      const authorId = reports[0].report.authorId;
      const periodDate = reportDateOf(reports[0].report);
      const computedPeriodKey = summaryPeriodKey(tab, periodDate);
      return {
        id: `${tab}:${key}`,
        tab,
        authorId,
        title: tab === 'weekly' ? `${weekLabel(periodDate)} 周报` : `${monthLabel(periodDate)} 月报`,
        periodLabel: tab === 'weekly' ? `${weekLabel(periodDate)} 周报` : `${monthLabel(periodDate)} 月报`,
        periodKey: computedPeriodKey,
        submittedAt: latest,
        reports,
        status: reports.some((item) => inferStatus(item.report) === 'delayed') ? 'delayed' : 'on_time',
      } satisfies SummaryCardModel;
    })
    .sort((a, b) => b.submittedAt - a.submittedAt);
}

function buildSummaryDraft(
  items: ReportWithOkr[],
  tab: 'weekly' | 'monthly',
  anchorDate: Date,
  okrContext: {
    activeCycleId: string | null | undefined;
    keyResults: KeyResult[];
    myOwnerIds: Set<string>;
    objectives: Objective[];
  },
): SummaryDraft {
  const periodLabel = tab === 'weekly' ? weekLabel(anchorDate) : monthLabel(anchorDate);
  const periodName = tab === 'weekly' ? '本周' : '本月';
  const groups = groupReportsByOkr(items);
  const okrRows = buildOkrDraftRows(items, okrContext);
  const achievements = uniqueReportLines(items.flatMap((item) => splitReportLines(item.report.achievements)));
  const blockers = uniqueReportLines(items.flatMap((item) => splitReportLines(item.report.blockers)));
  const nextSteps = uniqueReportLines(items.flatMap((item) => splitReportLines(item.report.nextSteps)));
  const okrProgress = okrRows.length > 0
    ? composeOkrProgressFromRows(okrRows)
    : groups.length > 0
      ? groups.map((group) => {
          const latest = [...group.reports].sort((a, b) => b.report.createdAt - a.report.createdAt)[0];
          const progress = latest ? ` · ${latest.report.progressBefore}% -> ${latest.report.progressAfter}%` : '';
          return `- ${okrGroupTitle(group)}${progress}`;
        }).join('\n')
      : '暂无 OKR / KR 推进记录。';

  return {
    periodLabel,
    sourceCount: items.length,
    okrRows,
    workSummary: items.length > 0
      ? `${periodName}共汇总 ${items.length} 条日报，围绕 ${Math.max(groups.length, 1)} 个 OKR/工作主题推进。`
      : `${periodName}暂无可汇总的日报记录。`,
    okrProgress,
    achievements: achievements.length > 0
      ? achievements.map((line) => `- ${line}`).join('\n')
      : '暂无明确成果记录。',
    blockers: blockers.length > 0
      ? blockers.map((line) => `- ${line}`).join('\n')
      : '暂无明确卡点。',
    nextPlan: nextSteps.length > 0
      ? nextSteps.map((line) => `- ${line}`).join('\n')
      : tab === 'weekly' ? '下周继续围绕当前 KR 推进。' : '下月继续围绕当前 OKR 推进。',
    supportNeeded: blockers.length > 0 ? '需要相关同事协同处理上述卡点。' : '暂无额外协同支持需求。',
  };
}

function buildOkrDraftRows(
  items: ReportWithOkr[],
  {
    activeCycleId,
    keyResults,
    myOwnerIds,
    objectives,
  }: {
    activeCycleId: string | null | undefined;
    keyResults: KeyResult[];
    myOwnerIds: Set<string>;
    objectives: Objective[];
  },
): OkrDraftRow[] {
  const reportsByObjective = new Map<string, ReportWithOkr[]>();
  const reportsByKr = new Map<string, ReportWithOkr[]>();
  for (const item of items) {
    if (item.kr) {
      const list = reportsByKr.get(item.kr.id) ?? [];
      list.push(item);
      reportsByKr.set(item.kr.id, list);
    } else if (item.objective) {
      const list = reportsByObjective.get(item.objective.id) ?? [];
      list.push(item);
      reportsByObjective.set(item.objective.id, list);
    }
  }

  const activeObjectives = objectives.filter((objective) => !activeCycleId || objective.cycleId === activeCycleId);
  const matchedObjectives = activeObjectives.filter((objective) => {
      const objectiveKrs = keyResults.filter((kr) => kr.objectiveId === objective.id);
      return (
        ownerMatchesSet(objective.ownerId, myOwnerIds) ||
        objective.collaborators?.some((ownerId) => ownerMatchesSet(ownerId, myOwnerIds)) ||
        objectiveKrs.some((kr) =>
          ownerMatchesSet(kr.ownerId, myOwnerIds) ||
          kr.collaborators?.some((ownerId) => ownerMatchesSet(ownerId, myOwnerIds)),
        )
      );
    });
  const objectivesInCycle = matchedObjectives.length > 0 ? matchedObjectives : activeObjectives;

  return objectivesInCycle.flatMap((objective) => {
    const objectiveKrs = keyResults.filter((kr) => kr.objectiveId === objective.id);
    const objectiveReports = reportsByObjective.get(objective.id) ?? [];
    const rows: OkrDraftRow[] = [
      {
        id: `objective:${objective.id}`,
        kind: 'objective',
        objectiveId: objective.id,
        objectiveTitle: objective.title,
        progress: objectiveProgressFromRows(objective, objectiveKrs),
        confidence: objective.confidence,
        content: composeReportContent(objectiveReports),
        reportCount: objectiveReports.length,
      },
    ];

    for (const kr of objectiveKrs) {
      const krReports = reportsByKr.get(kr.id) ?? [];
      rows.push({
        id: `kr:${kr.id}`,
        kind: 'kr',
        objectiveId: objective.id,
        objectiveTitle: objective.title,
        keyResultId: kr.id,
        keyResultTitle: kr.title,
        progress: krProgress(kr),
        confidence: kr.confidence,
        content: composeReportContent(krReports),
        reportCount: krReports.length,
      });
    }

    return rows;
  });
}

function objectiveProgressFromRows(objective: Objective, objectiveKrs: KeyResult[]): number {
  if (objective.progressOverride != null) return Math.max(0, Math.min(100, Math.round(objective.progressOverride)));
  if (objective.currentProgress != null) return Math.max(0, Math.min(100, Math.round(objective.currentProgress)));
  if (objectiveKrs.length === 0) return 0;
  const totalWeight = objectiveKrs.reduce((sum, kr) => sum + (kr.weight || 1), 0);
  if (totalWeight === 0) return 0;
  const weighted = objectiveKrs.reduce((sum, kr) => sum + krProgress(kr) * (kr.weight || 1), 0);
  return Math.round(weighted / totalWeight);
}

function composeReportContent(items: ReportWithOkr[]): string {
  const lines = uniqueReportLines(items.flatMap((item) => [
    ...splitReportLines(item.report.achievements),
    ...splitReportLines(item.report.blockers).map((line) => `卡点：${line}`),
    ...splitReportLines(item.report.nextSteps).map((line) => `下一步：${line}`),
  ]));
  return lines.map((line) => `- ${line}`).join('\n');
}

function composeOkrProgressFromRows(rows: OkrDraftRow[]): string {
  const filledRows = rows.filter((row) => row.content.trim());
  if (filledRows.length === 0) return '暂无 OKR / KR 推进记录。';
  return filledRows
    .map((row) => {
      const title = row.kind === 'objective' ? row.objectiveTitle : `${row.objectiveTitle} / ${row.keyResultTitle}`;
      return `- ${title} · ${row.progress}% · ${CONFIDENCE_LABEL[row.confidence]}\n${row.content}`;
    })
    .join('\n');
}

function splitReportLines(value?: string | null): string[] {
  return (value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueReportLines(lines: string[]): string[] {
  return Array.from(new Set(lines)).slice(0, 12);
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferStatus(report: VisibleReport): SubmitStatus {
  const date = new Date(report.createdAt);
  return date.getHours() >= 22 ? 'delayed' : 'on_time';
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: Date): string {
  return `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日`;
}

function dateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function reportDateOf(report: Pick<VisibleReport, 'createdAt' | 'reportDate'>): Date {
  return report.reportDate ? parseDateKey(report.reportDate) : new Date(report.createdAt);
}

function reportDateKey(report: Pick<VisibleReport, 'createdAt' | 'reportDate'>): string {
  return dateKey(reportDateOf(report));
}

function matchesSelectedDate(report: VisibleReport, selectedDateKey: string | null, tab: SummaryTab): boolean {
  if (!selectedDateKey) return true;
  const reportDate = reportDateOf(report);
  const selectedDate = parseDateKey(selectedDateKey);
  if (tab === 'weekly') {
    return weekKey(reportDate) === weekKey(selectedDate);
  }
  if (tab === 'monthly') {
    return reportDate.getFullYear() === selectedDate.getFullYear() && reportDate.getMonth() === selectedDate.getMonth();
  }
  return dateKey(reportDate) === selectedDateKey;
}

function matchesSummaryDate(summary: ReportSummary, selectedDateKey: string | null, tab: SummaryTab): boolean {
  if (!selectedDateKey) return true;
  if (tab !== 'weekly' && tab !== 'monthly') return false;
  const selectedDate = parseDateKey(selectedDateKey);
  return summary.periodKey === summaryPeriodKey(tab, selectedDate);
}

function summaryPeriodKey(tab: 'weekly' | 'monthly', value: Date): string {
  if (tab === 'weekly') return weekKey(value);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function selectedDateFilterLabel(selectedDateKey: string, tab: SummaryTab): string {
  const selectedDate = parseDateKey(selectedDateKey);
  if (tab === 'weekly') return weekLabel(selectedDate);
  if (tab === 'monthly') return monthLabel(selectedDate);
  return formatDate(selectedDate);
}

function formatShortDate(value: Date): string {
  return `${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')}`;
}

function weekLabel(value: Date): string {
  const start = startOfWeek(value);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${value.getFullYear()}年${value.getMonth() + 1}月第${Math.ceil(value.getDate() / 7)}周 (${formatShortDate(start)} ~ ${formatShortDate(end)})`;
}

function monthLabel(value: Date): string {
  return `${value.getFullYear()}年${value.getMonth() + 1}月`;
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function weekKey(value: Date): string {
  const start = startOfWeek(value);
  return `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
}

function calendarCells(year: number, month: number): Array<Date | null> {
  const first = new Date(year, month, 1);
  const total = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= total; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function monthWeeks(year: number, month: number): Array<{ key: string; start: Date; end: Date }> {
  const weeks: Array<{ key: string; start: Date; end: Date }> = [];
  let cursor = startOfWeek(new Date(year, month, 1));
  const monthEnd = new Date(year, month + 1, 0);
  while (cursor <= monthEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(start.getDate() + 6);
    weeks.push({ key: weekKey(start), start, end });
    cursor = new Date(end);
    cursor.setDate(end.getDate() + 1);
  }
  return weeks;
}

function ownerIdSet(ownerId: string): Set<string> {
  return new Set([ownerId, normalizeOwnerId(ownerId), `person:${normalizeOwnerId(ownerId)}`]);
}

function normalizeOwnerId(ownerId: string): string {
  return ownerId.startsWith('person:') ? ownerId.slice('person:'.length) : ownerId;
}

function ownerMatchesSet(ownerId: string | undefined | null, ids: Set<string>): boolean {
  if (!ownerId) return false;
  const normalized = normalizeOwnerId(ownerId);
  return ids.has(ownerId) || ids.has(normalized) || ids.has(`person:${normalized}`);
}
