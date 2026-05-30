/**
 * ThreePlusOneSelector · 3+1 决策选项通用渲染器
 *
 * 对应 MANIFESTO §2 「AI 给 3+1 选项, 不替员工决策」
 * 配套 @/lib/decision-layer/three-plus-one-engine.ts (生产引擎)
 *
 * 使用场景 (与 DecisionScenario 一一对应):
 *   - convergence    议事室   (P0 · 已通过 DecisionCardView 渲染, 后续可迁本组件)
 *   - report_extract 5min 日报推流 KR
 *   - tti_breakdown  TTI 任务拆解
 *   - weekly_retro   周回顾
 *   - persona_brief  主分身 brief 推荐  ← 本轮 /tandem RecommendCard 接入
 *   - learning_qa    学习中心答题
 *
 * 设计铁律:
 *   - A/B/C 由 AI 生成, D 必须员工自填 (humanOnly=true)
 *   - 每个选项强制展示: confidence + risk + (reasoning|空) + citedMemory
 *   - 提交按钮放在选中选项 footer, 不放页面底, 减少误触
 *   - UI: 只用 surface- / shadow-soft- / pill- / semantic- token (CHARTER-UI-V1)
 */

'use client';

import { useState } from 'react';
import { CheckCircle2, Lightbulb, AlertCircle, History, User, BookOpen } from 'lucide-react';
import type { DecisionOption } from '@/lib/types/decision-card';
import type { DecisionScenario } from '@/lib/decision-layer';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────

export interface ThreePlusOneSelectorProps {
  /** 4 选项 (A/B/C/D), 由 ThreePlusOneEngine.generateOptions 产出 */
  options: DecisionOption[];
  /** 引擎产出的警告 (baseline-guard / SOP 缺失 / LLM 失败) */
  warnings?: string[];
  /** 场景标签 (audit + 文案微调) */
  scenario: DecisionScenario;
  /** 提交回调 · D 选项时携带员工填写的 novelInsight */
  onChoose: (choice: { option: DecisionOption; novelInsight?: string }) => void | Promise<void>;
  /** 提交中 (外部 form 控制) */
  submitting?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 紧凑模式: 取消 reasoning 展示 (右栏小卡用) */
  compact?: boolean;
}

// ────────────────────────────────────────────────────────────────
// 视觉映射
// ────────────────────────────────────────────────────────────────

const TYPE_META: Record<DecisionOption['type'], { icon: React.ComponentType<{ className?: string }>; label: string; tone: 'sop' | 'reason' | 'history' | 'human' }> = {
  SOP:             { icon: BookOpen,  label: 'A · SOP',      tone: 'sop' },
  AGENT_REASONING: { icon: Lightbulb, label: 'B · AI 推演',  tone: 'reason' },
  HISTORICAL:      { icon: History,   label: 'C · 历史案例', tone: 'history' },
  ORIGINAL:        { icon: User,      label: 'D · 我自创',   tone: 'human' },
};

const RISK_LABEL: Record<DecisionOption['risk'], string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};

const SCENARIO_HINT: Record<DecisionScenario, string> = {
  convergence:    '议事 4 选项',
  report_extract: '日报推流 4 种方案',
  tti_breakdown:  'TTI 拆解 4 种路径',
  weekly_retro:   '本周回顾 4 个总结角度',
  persona_brief:  '今天先做哪一项 · 4 个建议',
  learning_qa:    '学习反馈 4 种解读',
};

// ────────────────────────────────────────────────────────────────
// 主组件
// ────────────────────────────────────────────────────────────────

export function ThreePlusOneSelector({
  options,
  warnings = [],
  scenario,
  onChoose,
  submitting = false,
  error = null,
  compact = false,
}: ThreePlusOneSelectorProps) {
  const [selectedId, setSelectedId] = useState<DecisionOption['id'] | null>(null);
  const [novelInsight, setNovelInsight] = useState('');

  const selected = options.find((o) => o.id === selectedId) ?? null;
  const isOriginal = selected?.id === 'D';
  const submitDisabled =
    submitting || !selected || (isOriginal && novelInsight.trim().length < 10);

  async function handleSubmit() {
    if (!selected || submitDisabled) return;
    await onChoose({
      option: isOriginal
        ? { ...selected, novelInsight: novelInsight.trim() }
        : selected,
      novelInsight: isOriginal ? novelInsight.trim() : undefined,
    });
  }

  return (
    <div className="space-y-3" role="radiogroup" aria-label="3+1 决策选项">
      <p className="text-footnote text-tertiary leading-relaxed">
        {SCENARIO_HINT[scenario]} · A/B/C 由 AI 给, D 必须你写 · 选一项再提交
      </p>

      {warnings.length > 0 && (
        <div className="surface-card-soft rounded-2xl p-3 shadow-soft-xs space-y-1">
          {warnings.slice(0, 3).map((w, i) => (
            <p key={i} className="text-footnote text-[rgb(var(--semantic-warning))] flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {options.map((opt) => (
          <OptionRow
            key={opt.id}
            option={opt}
            selected={selectedId === opt.id}
            onSelect={() => setSelectedId(opt.id)}
            compact={compact}
          />
        ))}
      </div>

      {isOriginal && (
        <div className="surface-card-soft rounded-2xl p-3 shadow-soft-xs space-y-2">
          <label className="text-caption text-secondary block">
            写一句「我多看到了什么」<span className="text-[rgb(var(--semantic-danger))]">*</span>
            <span className="text-footnote text-tertiary ml-1">(至少 10 字, AI 禁止代写)</span>
          </label>
          <textarea
            value={novelInsight}
            onChange={(e) => setNovelInsight(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="例: 上面三个选项都默认了 X 假设, 但我从客户最近反馈里看到 …"
            className="w-full resize-none rounded-md border bg-[rgb(var(--surface-1))] px-2 py-1.5 text-caption text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-300))]"
            style={{ borderColor: 'rgb(var(--border-subtle))' }}
          />
          <p className="text-footnote text-tertiary text-right">{novelInsight.length}/500</p>
        </div>
      )}

      {error && (
        <p className="text-caption text-[rgb(var(--semantic-danger))]">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitDisabled}
        className={cn(
          'w-full inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-caption font-medium surface-interactive',
          submitDisabled
            ? 'bg-[rgb(var(--surface-3))] text-tertiary cursor-not-allowed'
            : 'bg-[rgb(var(--brand-500))] text-white hover:bg-[rgb(var(--brand-600))]',
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {submitting
          ? '提交中…'
          : !selected
          ? '请先选一项'
          : isOriginal && novelInsight.trim().length < 10
          ? `还需 ${10 - novelInsight.trim().length} 字才能提交`
          : `提交 · 选 ${selected.id}`}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 子组件 · 单选项 row
// ────────────────────────────────────────────────────────────────

function OptionRow({
  option,
  selected,
  onSelect,
  compact,
}: {
  option: DecisionOption;
  selected: boolean;
  onSelect: () => void;
  compact: boolean;
}) {
  const meta = TYPE_META[option.type];
  const Icon = meta.icon;
  const confidencePct = Math.round(option.confidence * 100);
  const isHuman = option.id === 'D';
  const isStub = option.description.includes('[ 等待员工填写');

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-2xl border p-3 surface-interactive transition-colors duration-fast ease-standard',
        selected
          ? 'border-[rgb(var(--brand-500))] bg-[rgb(var(--brand-50))] shadow-soft-xs'
          : 'hover:bg-[rgb(var(--surface-2))]',
      )}
      style={!selected ? { borderColor: 'rgb(var(--border-subtle))' } : undefined}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            'h-4 w-4 mt-0.5 shrink-0',
            selected ? 'text-[rgb(var(--brand-600))]' : 'text-tertiary',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('text-footnote font-medium', selected ? 'text-[rgb(var(--brand-700))]' : 'text-secondary')}>
              {meta.label}
            </span>
            {isHuman && <span className="pill-neutral text-footnote">需你填</span>}
            {!isHuman && !isStub && (
              <>
                <span className="text-footnote text-tertiary">置信 {confidencePct}%</span>
                <span className={cn(
                  'text-footnote',
                  option.risk === 'high'
                    ? 'text-[rgb(var(--semantic-danger))]'
                    : option.risk === 'medium'
                    ? 'text-[rgb(var(--semantic-warning))]'
                    : 'text-[rgb(var(--semantic-success))]',
                )}>
                  {RISK_LABEL[option.risk]}
                </span>
              </>
            )}
            {option.timelineDays && (
              <span className="text-footnote text-tertiary">{option.timelineDays}d</span>
            )}
          </div>
          <p className={cn('mt-1 text-caption leading-relaxed', isStub ? 'text-tertiary italic' : 'text-primary')}>
            {option.description}
          </p>
          {!compact && option.reasoning && (
            <p className="mt-1.5 text-footnote text-secondary leading-relaxed line-clamp-3">
              {option.reasoning}
            </p>
          )}
          {option.citedMemory && option.citedMemory.length > 0 && (
            <p className="mt-1.5 text-footnote text-tertiary">
              引用 Memory: {option.citedMemory.length} 条
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
