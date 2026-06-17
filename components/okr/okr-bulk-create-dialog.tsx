'use client';

/**
 * OKRBulkCreateDialog · "AI 起草 4 套 OKR 候选" 对话框 (vs Tita 2025 H2 #1 缺口)
 *
 * 流程:
 *   1. 用户输入: 公司战略一句话 + 选择部门列表 (默认全选 active cycle)
 *   2. POST /api/okr/bulk-create/options → 返回 4 选项 (A SOP / B REASONING / C HISTORICAL / D ORIGINAL)
 *   3. 4 卡片预览 (含每选项的公司 Objective + 各部门 cascade)
 *   4. 用户点 "采用此方案" → batch insert 进 Zustand store
 *      D 选项 → "我自己写" 关闭 dialog (humanOnly 反 AI 欺诈)
 *
 * 设计原则:
 *   - 复用 OKR_TEMPLATES picker 的 store insert 模式 (addObjective + addKeyResult + addInitiative)
 *   - cascade objective 用 parentLocalIndex (1) 解析 → 公司 Objective 的真实 id
 *   - 走语义 token (warning/success/danger), 不用 raw amber/red/green
 *   - charter §1.10 motion 走 CSS var
 */

import { useEffect, useState } from 'react';
import { useOKRStore, useOrgStore } from '@/lib/store';
import {
  hydrateOkrFromApi,
  persistCreateObjective,
  persistCreateKeyResult,
  persistCreateInitiative,
} from '@/lib/store/okr-sync';
import { Sparkles, X, Loader2, CheckCircle2, AlertTriangle, FileText, Brain, History, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BulkCreateOption, BulkCreateResult } from '@/lib/services/okr-bulk-create';

interface Props {
  open: boolean;
  cycleId: string;
  cycleName: string;
  onClose: () => void;
  /** 应用成功后回调 (传公司 Objective id) */
  onApplied?: (companyObjectiveId: string) => void;
}

// 选项类型 → 图标 / 颜色 (走语义 token, 不 raw color)
const OPTION_META: Record<
  BulkCreateOption['type'],
  { icon: typeof FileText; label: string; tone: string; ring: string }
> = {
  SOP: { icon: FileText, label: 'A · SOP 模板', tone: 'text-info', ring: 'ring-info/30 bg-info/5' },
  REASONING: { icon: Brain, label: 'B · AI 推演', tone: 'text-success', ring: 'ring-success/30 bg-success/5' },
  HISTORICAL: { icon: History, label: 'C · 历史相似', tone: 'text-warning', ring: 'ring-warning/30 bg-warning/5' },
  ORIGINAL: { icon: PenLine, label: 'D · 你自己写', tone: 'text-ink-primary', ring: 'ring-border bg-surface-2' },
};

export function OKRBulkCreateDialog({ open, cycleId, cycleName, onClose, onApplied }: Props) {
  const currentUserId = useOKRStore((s) => s.currentUserId);
  const departments = useOrgStore((s) => s.departments);

  const [strategy, setStrategy] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<'input' | 'loading' | 'preview' | 'applying' | 'error'>('input');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCreateResult | null>(null);
  const [applyingOption, setApplyingOption] = useState<string | null>(null);

  // 默认全选所有部门 (open 时)
  useEffect(() => {
    if (open && selectedDeptIds.length === 0) {
      setSelectedDeptIds(departments.map((d) => d.id));
    }
  }, [open, departments, selectedDeptIds.length]);

  // 关闭时重置
  useEffect(() => {
    if (!open) {
      setStrategy('');
      setPhase('input');
      setErrorMsg(null);
      setResult(null);
      setApplyingOption(null);
    }
  }, [open]);

  if (!open) return null;

  const formValid = strategy.trim().length >= 5 && selectedDeptIds.length > 0;

  async function generate() {
    if (!formValid) return;
    setPhase('loading');
    setErrorMsg(null);
    try {
      const depts = departments
        .filter((d) => selectedDeptIds.includes(d.id))
        .map((d) => ({ id: d.id, name: d.name }));
      const res = await fetch('/api/okr/bulk-create/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleName,
          strategy: strategy.trim(),
          departments: depts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setResult(data);
      setPhase('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '网络错误');
      setPhase('error');
    }
  }

  /**
   * 应用某个选项: batch insert 公司 Objective + 部门 cascade Objective + 所有 KR
   * 返回新建的公司 Objective id (用于 onApplied 回调).
   */
  // DB 落库 (2026-06-17): 批量创建直接写后端, 不再只写本地 store.
  async function applyOption(option: BulkCreateOption): Promise<void> {
    if (option.objectives.length === 0) return;

    // 1. 找公司层 Objective (level='company', 应为第一个)
    const companyDraft = option.objectives.find((o) => o.level === 'company');
    if (!companyDraft) return;

    setApplyingOption(option.id);
    try {
      // 2. 创建公司层 Objective
      const companyObjId = await persistCreateObjective({
        title: companyDraft.title,
        description: companyDraft.description ?? '',
        cycleId,
        ownerId: currentUserId,
        parentId: null,
        weight: 100,
        status: 'active',
        confidence: 'on-track',
        visibility: 'public',
        tags: [`AI 起草 · ${option.type}`, `周期 ${cycleName}`],
        progressOverride: null,
      });

      // 3. 创建公司层的 KR + Initiatives
      for (const kr of companyDraft.keyResults) {
        const newKrId = await persistCreateKeyResult({
          objectiveId: companyObjId,
          title: kr.title,
          ownerId: currentUserId,
          type: kr.type,
          startValue: kr.startValue,
          currentValue: kr.startValue,
          targetValue: kr.targetValue,
          unit: kr.unit,
          weight: kr.weight,
          confidence: 'on-track',
          status: 'active',
          tags: [],
        });
        if (kr.initiatives) {
          for (const initTitle of kr.initiatives) {
            await persistCreateInitiative({ keyResultId: newKrId, title: initTitle, ownerId: currentUserId });
          }
        }
      }

      // 4. 创建部门层 cascade Objective + 各自 KR (parentId 串到公司 Objective 的服务端 id)
      const cascadeDrafts = option.objectives.filter((o) => o.level !== 'company');
      for (const draft of cascadeDrafts) {
        const cascadeObjId = await persistCreateObjective({
          title: draft.title,
          description: draft.description ?? '',
          cycleId,
          ownerId: currentUserId, // v0 简化, v1 接 deptId → owner
          parentId: companyObjId,
          weight: 100,
          status: 'active',
          confidence: 'on-track',
          visibility: 'public',
          tags: draft.ownerDepartmentId ? [`部门: ${draft.ownerDepartmentId}`] : [],
          progressOverride: null,
        });
        for (const kr of draft.keyResults) {
          await persistCreateKeyResult({
            objectiveId: cascadeObjId,
            title: kr.title,
            ownerId: currentUserId,
            type: kr.type,
            startValue: kr.startValue,
            currentValue: kr.startValue,
            targetValue: kr.targetValue,
            unit: kr.unit,
            weight: kr.weight,
            confidence: 'on-track',
            status: 'active',
            tags: [],
          });
        }
      }

      await hydrateOkrFromApi(true);
      setApplyingOption(null);
      onApplied?.(companyObjId);
      onClose();
    } catch (err: any) {
      setApplyingOption(null);
      setErrorMsg(err?.message || String(err));
      setPhase('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--rheem-ink-black)/0.55)] p-4">
      <div className="card-elevated w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-title-3 text-ink-primary inline-flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[rgb(var(--brand-500))]" />
              AI 起草 OKR · 4 套候选
            </h2>
            <p className="mt-1 text-caption text-ink-secondary">
              周期: {cycleName} · 输入战略 → AI 给 4 选项 (3 模板 + 1 原创) → 你拍板.
              D 选项必员工自己写 (反 AI 欺诈, MANIFESTO §2)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="surface-interactive rounded p-1 text-ink-tertiary hover:text-ink-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 输入态 */}
        {phase === 'input' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-caption text-ink-secondary" htmlFor="okr-strategy">
                公司战略一句话 (≥ 5 字)
              </label>
              <textarea
                id="okr-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder='例: "本季度全力做 ARR 增长 + 客户续约率提升"'
                rows={3}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-body outline-none focus:border-[rgb(var(--brand-500))] focus:ring-2 focus:ring-[rgb(var(--brand-500))/0.2]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-caption text-ink-secondary">
                  参与部门 ({selectedDeptIds.length} / {departments.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDeptIds(departments.map((d) => d.id))}
                    className="text-footnote text-[rgb(var(--brand-600))] hover:underline"
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDeptIds([])}
                    className="text-footnote text-ink-tertiary hover:underline"
                  >
                    清空
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {departments.map((d) => {
                  const checked = selectedDeptIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() =>
                        setSelectedDeptIds((prev) =>
                          checked ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                        )
                      }
                      className={cn(
                        'surface-interactive rounded-full px-3 py-1 text-caption ring-1 transition',
                        checked
                          ? 'bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))] ring-[rgb(var(--brand-300))]'
                          : 'bg-surface-2 text-ink-secondary ring-border hover:bg-surface-3',
                      )}
                    >
                      {checked && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                      {d.name}
                    </button>
                  );
                })}
              </div>
              {selectedDeptIds.length > 8 && (
                <div className="text-footnote text-warning">
                  ⚠ 部门 {'>'}  8 个会被自动截断 (防 prompt 爆炸)
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="surface-interactive rounded-md px-4 py-2 text-caption text-ink-secondary hover:bg-surface-3"
              >
                取消
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={!formValid}
                className="surface-interactive rounded-md bg-[rgb(var(--brand-500))] px-4 py-2 text-caption font-medium text-white hover:bg-[rgb(var(--brand-600))] disabled:opacity-40"
              >
                生成 4 套候选 →
              </button>
            </div>
          </div>
        )}

        {/* 加载态 */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--brand-500))]" />
            <p className="text-caption text-ink-secondary">AI 正在起草 4 套候选 (LLM 推演中)...</p>
            <p className="text-footnote text-ink-tertiary">SOP / REASONING / HISTORICAL / ORIGINAL</p>
          </div>
        )}

        {/* 错误态 */}
        {phase === 'error' && (
          <div className="space-y-3 rounded-md ring-1 ring-danger/30 bg-danger/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-caption font-medium text-ink-primary">生成失败</div>
                <div className="mt-1 text-caption text-ink-secondary">{errorMsg}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPhase('input')}
                className="text-caption text-ink-secondary hover:underline"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* 预览态: 4 选项 */}
        {phase === 'preview' && result && (
          <div className="space-y-3">
            {result.source === 'fallback' && (
              <div className="text-footnote text-warning rounded-md bg-warning/5 ring-1 ring-warning/30 p-2">
                ⚠ B 选项已降级 (原因: {result.fallbackReason ?? 'unknown'}). A/C/D 仍可用.
              </div>
            )}
            {result.options.map((opt) => {
              const meta = OPTION_META[opt.type];
              const Icon = meta.icon;
              const isHumanOnly = opt.humanOnly === true;
              const isApplying = applyingOption === opt.id;
              return (
                <div
                  key={opt.id}
                  className={cn('rounded-lg p-4 ring-1 space-y-2', meta.ring)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', meta.tone)} />
                      <div className="min-w-0">
                        <div className={cn('text-caption font-semibold', meta.tone)}>
                          {meta.label}
                        </div>
                        <div className="text-caption text-ink-primary mt-0.5">{opt.description}</div>
                        {opt.reasoning && (
                          <div className="text-footnote text-ink-tertiary mt-1">{opt.reasoning}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-footnote text-ink-tertiary shrink-0 tabular-nums">
                      信心 {Math.round(opt.confidence * 100)}%
                    </div>
                  </div>

                  {/* Objective 预览 */}
                  {opt.objectives.length > 0 && (
                    <div className="space-y-1.5 pl-7">
                      {opt.objectives.slice(0, 4).map((objDraft, i) => (
                        <div
                          key={i}
                          className="rounded bg-surface-1 p-2 ring-1 ring-border text-footnote"
                        >
                          <div className="font-medium text-ink-primary">
                            {objDraft.level === 'company' ? '🏛 公司' : '🏢 部门'} · {objDraft.title}
                          </div>
                          {objDraft.keyResults.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-ink-secondary">
                              {objDraft.keyResults.slice(0, 3).map((kr, ki) => (
                                <li key={ki} className="truncate">
                                  · {kr.title}{' '}
                                  <span className="text-ink-tertiary">
                                    ({kr.startValue}→{kr.targetValue} {kr.unit}, w{kr.weight})
                                  </span>
                                </li>
                              ))}
                              {objDraft.keyResults.length > 3 && (
                                <li className="text-ink-tertiary">
                                  + {objDraft.keyResults.length - 3} 条 KR...
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      ))}
                      {opt.objectives.length > 4 && (
                        <div className="text-footnote text-ink-tertiary pl-2">
                          + {opt.objectives.length - 4} 个部门 cascade...
                        </div>
                      )}
                    </div>
                  )}

                  {/* 操作 */}
                  <div className="flex justify-end pt-1">
                    {isHumanOnly ? (
                      <button
                        type="button"
                        onClick={onClose}
                        className="surface-interactive rounded-md bg-surface-3 px-3 py-1 text-caption text-ink-primary hover:bg-surface-2"
                      >
                        我自己写 →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => applyOption(opt)}
                        disabled={isApplying}
                        className={cn(
                          'surface-interactive rounded-md px-3 py-1 text-caption font-medium transition',
                          'bg-[rgb(var(--brand-500))] text-white hover:bg-[rgb(var(--brand-600))]',
                          'disabled:opacity-40',
                        )}
                      >
                        {isApplying ? (
                          <>
                            <Loader2 className="inline h-3 w-3 mr-1 animate-spin" />
                            应用中...
                          </>
                        ) : (
                          '采用此方案 →'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPhase('input')}
                className="text-caption text-ink-secondary hover:underline"
              >
                ← 返回重新输入
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
