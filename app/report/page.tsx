'use client';

/**
 * /report — 5 分钟极简日报 ↔ OKR 智能双向闭环
 * Spec: docs/PRODUCT-DEFINITION.md §3.1.3 & Tita Daily/Weekly Template Philosophy
 *
 * 核心创新：
 *   1. 目标锚定与 AI 问题引导：根据选定的 OKR，AI 抛出针对性指标质问，拒绝胡乱填报。
 *   2. AI 提炼 Action Plan (AP)：无论输入多凌乱，AI 智能提炼 Achievements / Blockers / Next Steps。
 *   3. OKR 进度反向推流：AI 自动推算增量，一键更新全局 OKR / TTI 进度，生成 Check-in，终结拉动滑块！
 */

import React, { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOKRStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useAuthStore, useCurrentUserId } from '@/lib/hooks/use-current-user';
import { krProgress, objectiveProgress } from '@/lib/okr/progress';
import {
  Clock,
  Sparkles,
  Target,
  ArrowRight,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  CornerDownRight,
  Smile,
  Meh,
  Frown,
  Zap,
  CheckSquare,
  ShieldAlert,
  Activity,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

type Mood = 'happy' | 'neutral' | 'sad';

/**
 * 极简、健壮的 Partial JSON 修复器 (P2-Streaming 核心突破)
 * 能够将正在 Stream 出来、缺口中括号、大括号、双引号的 JSON 片段补齐为可读 Object
 */
function parsePartialJson(raw: string): any {
  let cleaned = raw.trim();
  if (!cleaned) return null;

  // 找到第一个 { 位置
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  cleaned = cleaned.slice(start);

  // 1. 尝试直接 parse
  try { return JSON.parse(cleaned); } catch { /* noop */ }

  // 2. 依次尝试补齐双引号、中括号、大括号
  let testStr = cleaned;
  // 补齐未闭合的双引号
  const quoteCount = (testStr.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    testStr += '"';
  }

  // 补齐未闭合的中括号和大括号 (Heuristic stack)
  const stack: string[] = [];
  for (let i = 0; i < testStr.length; i++) {
    const c = testStr[i];
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}') { if (stack[stack.length - 1] === '}') stack.pop(); }
    else if (c === ']') { if (stack[stack.length - 1] === ']') stack.pop(); }
  }

  while (stack.length > 0) {
    testStr += stack.pop();
  }

  try {
    return JSON.parse(testStr);
  } catch {
    // 若依然解析失败，返回 null，由外层降级或等待
    return null;
  }
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportPageInner />
    </Suspense>
  );
}

function ReportPageInner() {
  const { toast } = useToast();
  const store = useOKRStore();
  const legacyCurrentUserId = useCurrentUserId();
  const authUserId = useAuthStore((s) => s.user?.id);
  const currentUserId = authUserId ?? legacyCurrentUserId;
  const {
    cycles,
    objectives,
    keyResults,
    checkIns,
    initiatives,
    activities,
    activeCycleId,
    updateKeyResult,
    addCheckIn,
  } = store;

  // ===== 当前周期的 OKRs =====
  const activeCycle = useMemo(() => cycles.find((c) => c.id === activeCycleId), [cycles, activeCycleId]);
  const cycleObjectives = useMemo(() => objectives.filter((o) => o.cycleId === activeCycleId), [objectives, activeCycleId]);
  const myOwnerIds = useMemo(
    () => new Set([legacyCurrentUserId, authUserId, authUserId ? `person:${authUserId}` : null].filter(Boolean) as string[]),
    [authUserId, legacyCurrentUserId],
  );
  const myObjectiveIds = useMemo(
    () => new Set(cycleObjectives.filter((o) => myOwnerIds.has(o.ownerId)).map((o) => o.id)),
    [cycleObjectives, myOwnerIds],
  );
  const cycleKrs = useMemo(
    () =>
      keyResults.filter(
        (k) =>
          cycleObjectives.some((o) => o.id === k.objectiveId) &&
          (myOwnerIds.has(k.ownerId) ||
            (k.collaborators ?? []).some((id) => myOwnerIds.has(id)) ||
            myObjectiveIds.has(k.objectiveId)),
      ),
    [keyResults, cycleObjectives, myOwnerIds, myObjectiveIds],
  );
  const objectiveGroups = useMemo(
    () =>
      cycleObjectives
        .map((objective) => ({
          objective,
          progress: objectiveProgress(objective, keyResults),
          krs: cycleKrs.filter((kr) => kr.objectiveId === objective.id),
        }))
        .filter((group) => group.krs.length > 0),
    [cycleObjectives, cycleKrs, keyResults],
  );

  // ===== 页面交互状态 =====
  const [selectedKrId, setSelectedKrId] = useState<string>('');
  const [openObjectiveIds, setOpenObjectiveIds] = useState<Set<string>>(() => new Set());
  const [openKrIds, setOpenKrIds] = useState<Set<string>>(() => new Set());
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<Mood>('happy');
  const [isAnalyzing, setIsAnlyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<null | {
    achievements: string[];
    blockers: string[];
    nextSteps: string[];
    suggestedValue: number;
    suggestedConfidence: 'on-track' | 'at-risk' | 'off-track';
    explanation: string;
    source: 'llm' | 'fallback';
    model?: string;
    reason?: string;
  }>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushedSuccess, setPushSuccess] = useState<boolean>(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);
  const [submittedReportAt, setSubmittedReportAt] = useState<number | null>(null);
  const [generatedDraftAt, setGeneratedDraftAt] = useState<number | null>(null);

  const selectedKr = useMemo(() => cycleKrs.find(k => k.id === selectedKrId) ?? null, [cycleKrs, selectedKrId]);
  const selectedRawInput = selectedKrId ? rawInputs[selectedKrId] ?? '' : '';
  const filledKrEntries = useMemo(
    () =>
      cycleKrs
        .map((kr) => ({ kr, input: rawInputs[kr.id]?.trim() ?? '' }))
        .filter((entry) => entry.input.length > 0),
    [cycleKrs, rawInputs],
  );
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const todayEnd = todayStart + 86_400_000;

  /** §P4 OKR 联动: 支持 ?krId=xxx URL 参数, mobile OKR 列表点 "写进展" 跳过来直接锚定 */
  const searchParams = useSearchParams();
  const urlKrId = searchParams.get('krId');

  // 当 URL 带 krId 且有效时直接展开对应 KR；普通进入页面时保持列表收起。
  useEffect(() => {
    const urlKr = urlKrId ? cycleKrs.find(k => k.id === urlKrId) : null;
    if (urlKr) {
      setSelectedKrId(urlKr.id);
      setOpenObjectiveIds((prev) => new Set(prev).add(urlKr.objectiveId));
      setOpenKrIds((prev) => new Set(prev).add(urlKr.id));
    }
  }, [cycleKrs, urlKrId]);

  const toggleObjectivePanel = (objectiveId: string) => {
    setOpenObjectiveIds((prev) => {
      const next = new Set(prev);
      if (next.has(objectiveId)) {
        next.delete(objectiveId);
      } else {
        next.add(objectiveId);
      }
      return next;
    });
  };

  const toggleKrPanel = (krId: string) => {
    setOpenKrIds((prev) => {
      const next = new Set(prev);
      if (next.has(krId)) {
        next.delete(krId);
      } else {
        next.add(krId);
      }
      return next;
    });
  };

  // ===== AI 动态问题引导逻辑 =====
  const aiPrompt = useMemo(() => {
    if (!selectedKr) {
      return {
        question: '先展开一个 Objective，再选择今天有进展的 KR 填写内容。',
        hint: '可以同时打开多个 KR 分别填写；点击「提炼此 KR」后，AI 会只针对当前 KR 生成 Action Plan 并给出进度建议。',
      };
    }
    const currentPct = selectedKr.targetValue > 0 ? (selectedKr.currentValue / selectedKr.targetValue) * 100 : 0;
    const isLagging = selectedKr.confidence !== 'on-track' || currentPct < 50;

    if (isLagging) {
      return {
        question: `🎯 针对「${selectedKr.title}」：当前进度为 ${selectedKr.currentValue}/${selectedKr.targetValue} ${selectedKr.unit ?? ''} (${Math.round(currentPct)}%)，目前处于关注区。请问今天你有没有针对关键阻碍采取了任何重构或紧急对账手段？`,
        hint: '写下具体排查或重构细节，AI 会自动估算指标提升比例并反向推流。',
      };
    } else {
      return {
        question: `🌟 针对「${selectedKr.title}」：指标进展非常顺利 (${Math.round(currentPct)}%)。今天又完成了哪些核心 AP (Action Plan) 的增量交付？`,
        hint: '写下你今天的心流收获，AI 会帮你自动沉淀至团队成果库。',
      };
    }
  }, [selectedKr]);

  // ===== 调用真实 LLM 提炼日报（SSE 流式 + 失败自动降级） =====
  const handleAiAnalyze = async (krId = selectedKrId) => {
    const kr = cycleKrs.find((item) => item.id === krId) ?? null;
    const input = rawInputs[krId] ?? '';
    if (!input.trim() || !kr) return;
    setSelectedKrId(kr.id);
    setIsAnlyzing(true);
    setAnalysisResult(null);
    setStreamingText('');
    setPushSuccess(false);

    try {
      const res = await fetch('/api/ai/extract-daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          rawInput: input.trim(),
          kr: {
            id: kr.id,
            title: kr.title,
            startValue: kr.startValue,
            targetValue: kr.targetValue,
            currentValue: kr.currentValue,
            unit: kr.unit ?? null,
            confidence: kr.confidence,
          },
          mood,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedJson = '';

      // SSE 帧解析：每个 \n\n 是一帧，帧内以 data: 开头是 payload
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload) continue;
            try {
              const ev = JSON.parse(payload) as
                | { type: 'delta'; content: string }
                | { type: 'done'; result: NonNullable<typeof analysisResult> }
                | { type: 'error'; message: string };
              if (ev.type === 'delta') {
                setStreamingText((prev) => prev + ev.content);
                accumulatedJson += ev.content;

                // 实时解析 Partial JSON (P2 Stream 核心黑科技)
                const partial = parsePartialJson(accumulatedJson);
                if (partial) {
                  setAnalysisResult({
                    achievements: Array.isArray(partial.achievements) ? partial.achievements.map(String) : [],
                    blockers: Array.isArray(partial.blockers) ? partial.blockers.map(String) : [],
                    nextSteps: Array.isArray(partial.nextSteps) ? partial.nextSteps.map(String) : [],
                    suggestedValue: typeof partial.suggestedValue === 'number' ? partial.suggestedValue : kr.currentValue,
                    suggestedConfidence: ['on-track', 'at-risk', 'off-track'].includes(partial.suggestedConfidence) ? partial.suggestedConfidence : 'on-track',
                    explanation: partial.explanation || '正在通过 AI 提炼...',
                    source: 'llm',
                  });
                }
              } else if (ev.type === 'done') {
                setAnalysisResult(ev.result);
              } else if (ev.type === 'error') {
                toast({ variant: 'destructive', title: '提炼失败', description: ev.message });
              }
            } catch {
              // 忽略无法解析的帧（心跳等）
            }
          }
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: '分析出错', description: (e as Error).message });
    } finally {
      setIsAnlyzing(false);
    }
  };

  // ===== Optimistic 反向推流：先改 store + 发 API；失败回滚 =====
  const handlePushToOkr = async () => {
    if (!selectedKr || !analysisResult) return;
    setIsPushing(true);

    // 1. 快照原值（用于失败回滚）
    const snapshot = {
      currentValue: selectedKr.currentValue,
      confidence: selectedKr.confidence,
    };
    const newValue = analysisResult.suggestedValue;
    const newConf = analysisResult.suggestedConfidence;

    // 2. 立刻乐观更新 Zustand store + UI 标成功
    updateKeyResult(selectedKr.id, { currentValue: newValue, confidence: newConf });
    addCheckIn({
      scope: 'kr',
      scopeId: selectedKr.id,
      authorId: currentUserId,
      progressBefore: snapshot.currentValue,
      progressAfter: newValue,
      confidenceBefore: snapshot.confidence,
      confidenceAfter: newConf,
      achievements: analysisResult.achievements.join('\n'),
      blockers: analysisResult.blockers.length ? analysisResult.blockers.join('\n') : undefined,
      nextSteps: analysisResult.nextSteps.join('\n'),
      mood,
    });
    setPushSuccess(true);
    toast({ variant: 'success', title: '对账推流成功', description: 'OKR 进度条已实时递进，后台审计链已固化对账凭证！' });

    // 3. 后台异步落库；失败 → 回滚 + toast
    try {
      const res = await fetch('/api/okr/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'kr',
          scopeId: selectedKr.id,
          progressBefore: snapshot.currentValue,
          progressAfter: newValue,
          confidenceBefore: snapshot.confidence,
          confidenceAfter: newConf,
          achievements: analysisResult.achievements.join('\n'),
          blockers: analysisResult.blockers.length ? analysisResult.blockers.join('\n') : undefined,
          nextSteps: analysisResult.nextSteps.join('\n'),
          mood,
          currentValue: newValue,
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }

      // 推流成功后清空输入
      setRawInputs((prev) => ({ ...prev, [selectedKr.id]: '' }));
    } catch (e) {
      // 回滚 store
      updateKeyResult(selectedKr.id, snapshot);
      setPushSuccess(false);
      toast({ variant: 'destructive', title: '推流异步失败，已执行快照回滚', description: (e as Error).message });
    } finally {
      setIsPushing(false);
    }
  };

  const handleSubmitDailyReport = async () => {
    if (filledKrEntries.length === 0) {
      toast({ title: '还没有可提交的内容', description: '请先展开 KR，填写今天的进展。' });
      return;
    }

    setIsSubmittingReport(true);
    setSubmittedReportAt(null);

    try {
      for (const { kr, input } of filledKrEntries) {
        const progress = krProgress(kr);
        const res = await fetch('/api/okr/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'kr',
            scopeId: kr.id,
            progressBefore: progress,
            progressAfter: progress,
            confidenceBefore: kr.confidence,
            confidenceAfter: kr.confidence,
            achievements: input,
            mood,
            currentValue: kr.currentValue,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`「${kr.title}」提交失败：HTTP ${res.status} ${text.slice(0, 120)}`);
        }
      }

      const submittedIds = new Set(filledKrEntries.map(({ kr }) => kr.id));
      setRawInputs((prev) => {
        const next = { ...prev };
        for (const id of Array.from(submittedIds)) delete next[id];
        return next;
      });
      setSubmittedReportAt(Date.now());
      toast({
        variant: 'success',
        title: '今日日报已提交',
        description: `已保存 ${filledKrEntries.length} 条 KR 进展记录。需要更新进度的 KR，可继续单独提炼并推流。`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: '日报提交失败', description: (e as Error).message });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleGenerateDailyDraft = async () => {
    if (cycleKrs.length === 0) {
      toast({ title: '暂无可匹配的 KR', description: '当前周期内没有属于你的 KR。' });
      return;
    }

    setIsGeneratingDraft(true);

    try {
      const krById = new Map(cycleKrs.map((kr) => [kr.id, kr]));
      const res = await fetch('/api/ai/daily-report-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
      }
      const data = await res.json() as {
        drafts?: Record<string, string>;
        sources?: Partial<Record<'okr' | 'im' | 'mail', number>>;
      };
      const drafts = new Map(
        Object.entries(data.drafts ?? {}).filter(([krId, text]) => krById.has(krId) && text.trim()),
      );

      if (drafts.size === 0) {
        toast({
          title: '今天还没有可生成的系统操作',
          description: '没有找到今日 OKR、IM 或邮件内容。可以先手动填写，或者稍后再生成。',
        });
        return;
      }

      setRawInputs((prev) => {
        const next = { ...prev };
        for (const [krId, generated] of Array.from(drafts.entries())) {
          const existing = next[krId]?.trim();
          next[krId] = existing ? `${existing}\n${generated}` : generated;
        }
        return next;
      });
      setOpenKrIds((prev) => {
        const next = new Set(prev);
        for (const krId of Array.from(drafts.keys())) next.add(krId);
        return next;
      });
      setOpenObjectiveIds((prev) => {
        const next = new Set(prev);
        for (const krId of Array.from(drafts.keys())) {
          const kr = krById.get(krId);
          if (kr) next.add(kr.objectiveId);
        }
        return next;
      });
      setSelectedKrId(Array.from(drafts.keys())[0] ?? selectedKrId);
      setSubmittedReportAt(null);
      setGeneratedDraftAt(Date.now());
      toast({
        variant: 'success',
        title: '已生成日报草稿',
        description: `已根据今日 OKR / IM / 邮件匹配到 ${drafts.size} 个 KR，请快速确认后提交。`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: '生成草稿失败', description: (e as Error).message });
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  /** §P2 mobile sticky CTA: 根据当前阶段显示主操作, 防止键盘挡住 + 滚动卷走 */
  const stickyState: 'idle' | 'analyze' | 'push' | 'done' | 'submit' =
    pushedSuccess ? 'done'
    : analysisResult ? 'push'
    : (selectedKrId && selectedRawInput.trim().length > 0) ? 'analyze'
    : filledKrEntries.length > 0 ? 'submit'
    : 'idle';

  const renderKrPanel = (kr: (typeof cycleKrs)[number]) => {
    const isSelected = kr.id === selectedKrId;
    const isOpen = openKrIds.has(kr.id);
    const pct = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
    const krInput = rawInputs[kr.id] ?? '';

    return (
      <div
        key={kr.id}
        className={cn(
          "w-full text-left rounded border text-footnote transition-all",
          isSelected || isOpen
            ? "bg-white border-primary/40 ring-1 ring-primary/20 shadow-soft-sm"
            : "bg-white hover:bg-muted/50 border-slate-100"
        )}
      >
        <button
          type="button"
          onClick={() => toggleKrPanel(kr.id)}
          className="w-full p-2.5 text-left"
          aria-expanded={isOpen}
        >
          <div className="flex items-start justify-between gap-2 font-medium">
            <span className="flex min-w-0 items-start gap-1.5">
              <Target className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", isSelected || isOpen ? "text-[rgb(var(--brand-500))]" : "text-slate-400")} />
              <span className="line-clamp-2 leading-snug">{kr.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="font-semibold tabular-nums text-slate-600">{Math.round(pct)}%</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform",
                  isOpen && "rotate-180 text-[rgb(var(--brand-500))]",
                )}
              />
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>当前: {kr.currentValue}/{kr.targetValue} {kr.unit ?? ''}</span>
            <span className={cn(
              "font-medium",
              kr.confidence === 'on-track' ? 'text-emerald-600' : kr.confidence === 'at-risk' ? 'text-warning' : 'text-rose-600'
            )}>
              {kr.confidence === 'on-track' ? '正常' : kr.confidence === 'at-risk' ? '有卡点' : '严重落后'}
            </span>
            {krInput.trim() && !isSelected && (
              <span className="ml-auto rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                已填写
              </span>
            )}
          </div>
        </button>
        {isOpen && (
          <div className="border-t border-slate-100 bg-slate-50/70 p-2.5">
            <Textarea
              value={krInput}
              spellCheck={false}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => {
                setSelectedKrId(kr.id);
                setPushSuccess(false);
              }}
              onChange={(e) =>
                {
                  setSubmittedReportAt(null);
                  setGeneratedDraftAt(null);
                  setRawInputs((prev) => ({ ...prev, [kr.id]: e.target.value }));
                }
              }
              placeholder="写下今天围绕这个 KR 做了什么、遇到什么阻碍、下一步准备做什么..."
              className="min-h-[96px] bg-white text-footnote leading-relaxed font-sans placeholder:opacity-60 text-slate-800"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">
                只会提炼当前展开的 KR。
              </p>
              <Button
                type="button"
                size="sm"
                disabled={!krInput.trim() || isAnalyzing}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleAiAnalyze(kr.id);
                }}
              >
                {isAnalyzing && isSelected ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    AI 正在对账...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1" />
                    提炼此 KR
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6 space-y-4 pb-24 md:pb-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-headline font-semibold tracking-tight text-ink-primary leading-tight">
            今日 5 分钟日报
          </h1>
          <p className="mt-1 text-[12.5px] md:text-caption text-ink-tertiary leading-relaxed">
            写下今天的进展, AI 帮你提炼成 Action Plan, 一键推流到 OKR 进度.
          </p>
        </div>
        {activeCycle && (
          <Badge variant="outline" className="shrink-0 h-6 text-[11px] bg-white border-slate-200 font-medium">
            {activeCycle.name}
          </Badge>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左侧：日常推进填报区 (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-footnote font-semibold text-slate-700 block">
                    1. 按 Objective / KR 分别填写今日进展
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleGenerateDailyDraft()}
                    disabled={isGeneratingDraft || isSubmittingReport || isAnalyzing || isPushing}
                    className="shrink-0"
                  >
                    {isGeneratingDraft ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        AI 生成草稿
                      </>
                    )}
                  </Button>
                </div>
                {generatedDraftAt && (
                  <p className="text-[11px] text-emerald-700">
                    已根据今日系统操作生成草稿，请确认后提交。
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 max-h-[460px] overflow-y-auto pr-1 border rounded-md p-2 bg-slate-50/50">
                  {objectiveGroups.length === 0 ? (
                    <p className="text-footnote text-muted-foreground text-center py-4">当前考核周期内无属于你的 O/KR 指标，请在后台配置。</p>
                  ) : (
                    objectiveGroups.map(({ objective, progress, krs }) => {
                      const isObjectiveOpen = openObjectiveIds.has(objective.id);
                      const filledCount = krs.filter((kr) => (rawInputs[kr.id] ?? '').trim()).length;

                      return (
                        <section
                          key={objective.id}
                          className={cn(
                            "rounded-md border bg-white transition-all",
                            isObjectiveOpen ? "border-slate-200 shadow-soft-sm" : "border-slate-200 hover:border-slate-300",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleObjectivePanel(objective.id)}
                            className="w-full border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 text-left"
                            aria-expanded={isObjectiveOpen}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Objective
                                </p>
                                <h3 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800">
                                  {objective.title}
                                </h3>
                                {objective.description && (
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-normal text-muted-foreground">
                                    {objective.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {filledCount > 0 && (
                                  <Badge variant="outline" className="bg-emerald-50 text-[10px] font-medium text-emerald-700">
                                    已写 {filledCount}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-white text-[10px] font-medium">
                                  {krs.length} KR
                                </Badge>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-slate-400 transition-transform",
                                    isObjectiveOpen && "rotate-180 text-[rgb(var(--brand-500))]",
                                  )}
                                />
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Progress value={progress} className="h-1.5 flex-1 bg-slate-100" />
                              <span className="w-9 text-right text-[10px] font-semibold tabular-nums text-slate-500">
                                {progress}%
                              </span>
                            </div>
                          </button>
                          {isObjectiveOpen && (
                            <div className="space-y-2 p-2">
                              {krs.map((kr) => renderKrPanel(kr))}
                            </div>
                          )}
                        </section>
                      );
                    })
                  )}
                </div>
              </div>

              {/* AI 问题引导 — Apple HIG 风格 quote card */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-primary text-white">
                  <Brain className="h-3.5 w-3.5" />
                </span>
                <div className="space-y-1 text-[12.5px] min-w-0">
                  <p className="font-medium text-ink-primary leading-relaxed">{aiPrompt.question}</p>
                  <p className="text-ink-tertiary leading-normal">{aiPrompt.hint}</p>
                </div>
              </div>

              {/* 团队心流状态 */}
              <div className="flex items-center justify-between gap-4 border-t pt-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-footnote font-semibold text-slate-700">2. 今日心流状态</span>
                  <div className="flex items-center gap-1.5">
                    {(['happy', 'neutral', 'sad'] as const).map(m => {
                      const isActive = mood === m;
                      const Icon = m === 'happy' ? Smile : m === 'neutral' ? Meh : Frown;
                      const label = m === 'happy' ? '高效心流' : m === 'neutral' ? '平静推进' : '压力较大';
                      return (
                        <button
                          key={m}
                          onClick={() => setMood(m)}
                          className={cn(
                            "h-9 w-9 rounded-full border flex items-center justify-center transition-colors",
                            isActive
                              ? "bg-ink-primary border-ink-primary text-white"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          )}
                          title={label}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-3">
                  {submittedReportAt ? (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      今日日报已提交
                    </span>
                  ) : (
                    <p className="hidden sm:block text-[11px] text-muted-foreground">
                      已填写 {filledKrEntries.length} 个 KR
                    </p>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSubmitDailyReport()}
                    disabled={filledKrEntries.length === 0 || isSubmittingReport || isAnalyzing || isPushing}
                  >
                    {isSubmittingReport ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        正在提交...
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3.5 w-3.5 mr-1" />
                        提交今日日报
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：AI 提炼结果与一键反向推流 (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {!analysisResult ? (
            isAnalyzing && streamingText ? (
              <Card className="border-indigo-100 bg-indigo-50/20">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-indigo-100 text-indigo-700">
                      <Brain className="h-4 w-4 animate-pulse" />
                    </span>
                    <span className="text-footnote font-semibold text-slate-800">AI 思考中（流式输出）</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-indigo-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      正在生成
                    </span>
                  </div>
                  <pre className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap font-mono max-h-[280px] overflow-y-auto bg-white/60 rounded p-3 border border-slate-100">
                    {streamingText}
                    <span className="inline-block w-1.5 h-3 ml-0.5 bg-indigo-500 animate-pulse align-middle" />
                  </pre>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed border-slate-200">
                <CardContent className="py-24 text-center space-y-3">
                  <Brain className="h-8 w-8 text-indigo-300 mx-auto" />
                  <p className="text-footnote font-semibold text-slate-700">等待 AI 提炼</p>
                  <p className="text-[10px] text-muted-foreground max-w-[240px] mx-auto leading-normal">
                    锚定 KR 后写下今日进展，点击「AI 智能提炼 &amp; 对齐」即可。
                    未配置 LLM 时会进入降级模式（基于关键词的规则提取）。
                  </p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card className={cn(
              "border-indigo-100 transition-all shadow-soft animate-fade-in-up",
              pushedSuccess ? "bg-emerald-50/30 border-emerald-100 animate-pulse" : "bg-indigo-50/20"
            )}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "p-1 rounded shrink-0",
                    pushedSuccess ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-700"
                  )}>
                    {pushedSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
                  </span>
                  <span className="text-footnote font-bold text-slate-800">
                    {pushedSuccess ? '已推流到 OKR' : 'AI 提炼结果'}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-auto text-[10px] border',
                      analysisResult.source === 'llm'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-warning/5 text-warning border-warning/20',
                    )}
                    title={analysisResult.reason}
                  >
                    {analysisResult.source === 'llm'
                      ? `LLM · ${analysisResult.model ?? 'unknown'}`
                      : '降级模式（未调用 LLM）'}
                  </Badge>
                </div>

                {/* 1. AI 提取 AP (Action Plan) */}
                <div className="space-y-2.5 text-footnote text-slate-800 border-b pb-3">
                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-1 text-slate-700">
                      <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                      Achievements (今日增量成果):
                    </p>
                    {analysisResult.achievements.map((item, i) => (
                      <p key={i} className="text-[11px] text-slate-600 pl-4 relative">
                        <CornerDownRight className="h-3 w-3 inline text-slate-400 mr-1" />
                        {item}
                      </p>
                    ))}
                  </div>

                  {analysisResult.blockers.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-semibold flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning animate-pulse" />
                        Blockers (潜在卡点阻碍):
                      </p>
                      {analysisResult.blockers.map((item, i) => (
                        <p key={i} className="text-[11px] text-warning pl-4 relative">
                          <CornerDownRight className="h-3 w-3 inline text-warning mr-1" />
                          {item}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-1 text-slate-700">
                      <Zap className="h-3.5 w-3.5 text-indigo-500" />
                      Next Steps (下一步行动计划/AP):
                    </p>
                    {analysisResult.nextSteps.map((item, i) => (
                      <p key={i} className="text-[11px] text-slate-600 pl-4 relative">
                        <CornerDownRight className="h-3 w-3 inline text-slate-400 mr-1" />
                        {item}
                      </p>
                    ))}
                  </div>
                </div>

                {/* 2. 反向推流建议区 */}
                <div className="space-y-3">
                  <div className="bg-white rounded-md p-3 border border-slate-100 shadow-soft-sm space-y-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Suggested OKR Alignment (对账进度变化)</p>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-footnote font-medium text-slate-800 truncate max-w-[200px]">{selectedKr?.title}</p>
                        <p className="text-[10px] text-muted-foreground">当前进度: {selectedKr?.currentValue}/{selectedKr?.targetValue} {selectedKr?.unit}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-footnote font-semibold tabular-nums text-muted-foreground">{selectedKr?.currentValue}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-caption font-bold tabular-nums text-primary">{analysisResult.suggestedValue}</span>
                        <span className="text-[10px] font-medium text-primary">({selectedKr?.unit})</span>
                      </div>
                    </div>
                    {/* 进度条动画对比 */}
                    <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-slate-300 transition-all"
                        style={{
                          transitionDuration: 'var(--duration-base)',
                          transitionTimingFunction: 'var(--ease-standard)',
                          width: `${selectedKr ? (selectedKr.currentValue / selectedKr.targetValue) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="absolute left-0 top-0 h-full bg-[rgb(var(--brand-500))] transition-all"
                        style={{
                          transitionDuration: 'var(--duration-slow)',
                          transitionTimingFunction: 'var(--ease-emphasis)',
                          width: `${selectedKr ? (analysisResult.suggestedValue / selectedKr.targetValue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground leading-normal flex items-start gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    <span>{analysisResult.explanation}</span>
                  </div>

                  {pushedSuccess ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-[13px] font-medium text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      OKR 进度已更新
                    </div>
                  ) : (
                    <Button
                      onClick={handlePushToOkr}
                      disabled={isPushing || isAnalyzing}
                      className="w-full h-11 md:h-10 text-[13px] font-medium"
                    >
                      {isPushing ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          正在推流更新...
                        </>
                      ) : isAnalyzing ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          AI 正在全力对账中，请稍候...
                        </>
                      ) : (
                        <>
                          <CheckSquare className="h-3.5 w-3.5 mr-1" />
                          确认智能推流 (一键更新 OKR)
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* §P2 移动端 sticky CTA · md+ 隐藏 · safe-area 适配 */}
      <div className="md:hidden fixed bottom-16 inset-x-0 z-30 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pointer-events-none">
        <div className="pointer-events-auto rounded-2xl bg-white/95 backdrop-blur-md shadow-[0_-2px_24px_rgba(0,0,0,0.06)] border border-slate-200/70 p-2.5">
          {stickyState === 'idle' && (
            <div className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-ink-tertiary">
              <Target className="h-3.5 w-3.5" />
              <span>先选 KR, 写下今日进展</span>
            </div>
          )}
          {stickyState === 'analyze' && (
            <Button
              onClick={() => void handleAiAnalyze()}
              disabled={isAnalyzing}
              className="w-full h-11 text-[13.5px] font-medium"
            >
              {isAnalyzing ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />AI 正在对账...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1.5" />AI 智能提炼 & 对齐</>
              )}
            </Button>
          )}
          {stickyState === 'push' && (
            <Button
              onClick={handlePushToOkr}
              disabled={isPushing || isAnalyzing}
              className="w-full h-11 text-[13.5px] font-medium"
            >
              {isPushing ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />正在推流...</>
              ) : (
                <><CheckSquare className="h-3.5 w-3.5 mr-1.5" />确认推流到 OKR</>
              )}
            </Button>
          )}
          {stickyState === 'done' && (
            <div className="flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>已更新 OKR 进度</span>
            </div>
          )}
          {stickyState === 'submit' && (
            <Button
              onClick={() => void handleSubmitDailyReport()}
              disabled={isSubmittingReport || isAnalyzing || isPushing}
              className="w-full h-11 text-[13.5px] font-medium"
            >
              {isSubmittingReport ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />正在提交...</>
              ) : (
                <><CheckSquare className="h-3.5 w-3.5 mr-1.5" />提交今日日报 ({filledKrEntries.length})</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
