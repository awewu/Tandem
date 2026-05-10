'use client';

/**
 * OKR · 季末复盘
 *
 * 增量补丁 (P0.1, 2026-05-10) — Tita 对标的"复盘"模块.
 *
 * 三种结构化方法论 (用户可切):
 *   PDCA  — Plan / Do / Check / Act
 *   KISS  — Keep / Improve / Start / Stop
 *   4L    — Liked / Learned / Lacked / Longed for
 *
 * 数据流:
 *   - 读 Objective.retrospective (zustand 已有字段)
 *   - 写 reviewObjective(id, text) 持久化
 *   - 与 /okr 评分 tab 共享同一字段, 互不冲突 (各自重新解析)
 *
 * 与简版 (评分 tab 的 textarea) 区别:
 *   - 结构化提示 + 4 段输入 + 自动合并为一段保存
 *   - 显示上次复盘时间 + 评分总览 (Objective + KR 评分)
 *   - 提示 KR 偏差大的项 (引导反思)
 */

import { useState, useMemo, useEffect } from 'react';
import { useOKRStore } from '@/lib/store';
import { calcObjectiveScore } from '@/lib/okr/scoring';
import {
  BookOpen, Save, RotateCcw, Lightbulb, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown,
} from 'lucide-react';

interface Props {
  objectiveId: string;
}

type Methodology = 'pdca' | 'kiss' | '4l';

interface StructuredFields {
  // PDCA
  plan?: string;
  do?: string;
  check?: string;
  act?: string;
  // KISS
  keep?: string;
  improve?: string;
  start?: string;
  stop?: string;
  // 4L
  liked?: string;
  learned?: string;
  lacked?: string;
  longed?: string;
}

const METHODOLOGY_META: Record<Methodology, { label: string; sections: { key: keyof StructuredFields; label: string; placeholder: string }[] }> = {
  pdca: {
    label: 'PDCA · 计划→执行→检查→改进',
    sections: [
      { key: 'plan',  label: 'Plan · 计划', placeholder: '本季度目标设定 / 关键假设 / 资源安排' },
      { key: 'do',    label: 'Do · 执行', placeholder: '实际做了什么 / 路径调整 / 资源使用' },
      { key: 'check', label: 'Check · 检查', placeholder: '结果对比预期 / 差距在哪 / 数据证据' },
      { key: 'act',   label: 'Act · 改进', placeholder: '下季度修正 / 新假设 / 流程改进' },
    ],
  },
  kiss: {
    label: 'KISS · 保留 / 改进 / 开始 / 停止',
    sections: [
      { key: 'keep',    label: 'Keep · 保留', placeholder: '什么做对了, 下季度继续' },
      { key: 'improve', label: 'Improve · 改进', placeholder: '哪些做得不够, 怎么提升' },
      { key: 'start',   label: 'Start · 开始', placeholder: '从未做过但应该开始的' },
      { key: 'stop',    label: 'Stop · 停止', placeholder: '正在做但应该停止的' },
    ],
  },
  '4l': {
    label: '4L · 喜欢 / 学到 / 缺失 / 期待',
    sections: [
      { key: 'liked',   label: 'Liked · 喜欢', placeholder: '过程中的亮点 / 协作良好的瞬间' },
      { key: 'learned', label: 'Learned · 学到', placeholder: '新认知 / 反直觉的发现' },
      { key: 'lacked',  label: 'Lacked · 缺失', placeholder: '遗憾 / 资源/能力短板' },
      { key: 'longed',  label: 'Longed for · 期待', placeholder: '下季度想拥有的 / 对组织的期待' },
    ],
  },
};

const METHODOLOGY_PREFIX = '<!-- methodology:';

/** 把结构化字段 + 方法论标签序列化为 markdown */
function serialize(method: Methodology, fields: StructuredFields): string {
  const meta = METHODOLOGY_META[method];
  const sections = meta.sections
    .map((s) => {
      const v = fields[s.key]?.trim();
      if (!v) return null;
      return `### ${s.label}\n${v}`;
    })
    .filter(Boolean)
    .join('\n\n');
  return `${METHODOLOGY_PREFIX}${method} -->\n${sections}`.trim();
}

/** 解析已保存的 markdown 复盘 */
function parse(text: string | undefined): { method: Methodology; fields: StructuredFields } {
  if (!text) return { method: '4l', fields: {} };
  const methodMatch = text.match(/<!-- methodology:(pdca|kiss|4l) -->/);
  const method: Methodology = (methodMatch?.[1] as Methodology) ?? '4l';
  const fields: StructuredFields = {};
  const sectionMatches = [...text.matchAll(/^### (.+?)\n([\s\S]*?)(?=^### |$)/gm)];
  const meta = METHODOLOGY_META[method];
  for (const m of sectionMatches) {
    const label = m[1].trim();
    const value = m[2].trim();
    const sec = meta.sections.find((s) => label.startsWith(s.label.split(' ')[0]));
    if (sec) fields[sec.key] = value;
  }
  return { method, fields };
}

export function OKRRetrospective({ objectiveId }: Props) {
  const obj = useOKRStore((s) => s.objectives.find((o) => o.id === objectiveId));
  const krs = useOKRStore((s) => s.keyResults.filter((k) => k.objectiveId === objectiveId));
  const allKRs = useOKRStore((s) => s.keyResults);
  const reviewObjective = useOKRStore((s) => s.reviewObjective);

  const initial = useMemo(() => parse(obj?.retrospective), [obj?.retrospective]);
  const [method, setMethod] = useState<Methodology>(initial.method);
  const [fields, setFields] = useState<StructuredFields>(initial.fields);

  // 切方法论时, 保留已填字段, 但展示当前方法论的 4 个槽位
  useEffect(() => {
    setMethod(initial.method);
    setFields(initial.fields);
  }, [objectiveId, initial.method, initial.fields]);

  if (!obj) return null;

  const finalScore = calcObjectiveScore(obj, allKRs);
  const meta = METHODOLOGY_META[method];

  const handleSave = () => {
    const md = serialize(method, fields);
    reviewObjective(objectiveId, md);
  };
  const handleClear = () => {
    if (!confirm('清空当前复盘内容？(已保存的内容会被覆盖)')) return;
    setFields({});
  };

  // 引导提示: 偏差大的 KR 自动列出
  const lowKRs = krs.filter((k) => {
    const s = (k.finalScore ?? k.selfScore);
    return s !== null && s !== undefined && s < 0.5;
  });

  const reviewedAtStr = obj.reviewedAt
    ? new Date(obj.reviewedAt).toLocaleString('zh-CN')
    : null;

  return (
    <div className="space-y-4 text-sm">
      {/* Header: 总评 + 上次复盘时间 */}
      <div className="border rounded p-3 bg-muted/30">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">本季度总分 (基于 KR 评分)</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{(finalScore * 100).toFixed(0)}</span>
              <span className="text-xs text-muted-foreground">/ 100 (Tita 风 0.1-0.7 = 健康)</span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            {reviewedAtStr ? (
              <>
                <div>上次复盘</div>
                <div className="font-medium text-foreground">{reviewedAtStr}</div>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle size={12} /> 未复盘
              </span>
            )}
          </div>
        </div>

        {/* 偏差 KR 引导 */}
        {lowKRs.length > 0 && (
          <div className="mt-3 pt-3 border-t flex items-start gap-2 text-xs">
            <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">引导反思:</div>
              <div className="text-muted-foreground mt-0.5">
                {lowKRs.length} 项 KR 评分 &lt; 0.5, 建议重点回答「为什么没达成 + 下季度怎么调」:
                {lowKRs.map((k) => (
                  <span key={k.id} className="inline-block ml-1.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    {k.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 方法论切换 */}
      <div>
        <div className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
          <BookOpen size={14} /> 选择复盘方法论
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(METHODOLOGY_META) as Methodology[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                method === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-accent'
              }`}
            >
              {METHODOLOGY_META[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 个结构化输入槽 */}
      <div className="space-y-3">
        {meta.sections.map((s) => (
          <div key={s.key}>
            <label className="text-xs font-medium block mb-1">{s.label}</label>
            <textarea
              value={fields[s.key] ?? ''}
              onChange={(e) => setFields({ ...fields, [s.key]: e.target.value })}
              placeholder={s.placeholder}
              rows={3}
              className="w-full text-sm border rounded p-2 bg-background resize-none"
            />
          </div>
        ))}
      </div>

      {/* 保存 / 清空 */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          onClick={handleClear}
          className="text-xs px-3 py-1.5 rounded text-muted-foreground hover:bg-accent inline-flex items-center gap-1"
        >
          <RotateCcw size={11} /> 清空
        </button>
        <button
          onClick={handleSave}
          className="text-xs px-4 py-1.5 rounded bg-primary text-primary-foreground inline-flex items-center gap-1.5 font-medium"
        >
          <Save size={11} /> 保存复盘
        </button>
      </div>

      {/* M2 提示 */}
      <div className="border-2 border-dashed rounded p-3 text-xs">
        <div className="font-medium mb-1 inline-flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-500" />
          复盘后 (M2 联动)
        </div>
        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
          <li>高质量 Lacked / Learned 内容自动提议入 Memory (Lv2 部门级签批)</li>
          <li>Stop 项联动 OKR 模板生成下季度新 Objective</li>
          <li>引导 1on1: 复盘内容自动作为下次 1on1 议程</li>
        </ul>
      </div>
    </div>
  );
}
