'use client';

/**
 * LessonViewer · 课时查看器
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md Phase 2.1
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - Hero (顶部 breadcrumb + 课程元) = .hero-ink
 *   - 阅读 / 答题 / 完成 = surface-card 内容卡
 *   - 完成态用 .glass 玻璃拟态 + brand 色 accent
 *
 * 真扭转: POST /api/learning/complete → closure.ts 真写 store.
 */

import { useMemo, useState } from 'react';
import type { ClosureResult } from '@/lib/learning/closure';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { Lesson } from '@/lib/learning/types';

export interface LessonViewerProps {
  lesson: Lesson;
}

const REQUIREMENT_LABEL: Record<Lesson['requirement'], string> = {
  mandatory_once: '必修 · 一次性',
  mandatory_quarterly: '必修 · 季度复训',
  recommended: '推荐',
  elective: '选修',
};

const CATEGORY_LABEL: Record<Lesson['category'], string> = {
  onboarding: '入职必修',
  compliance: '合规与红线',
  products: '产品学院',
  processes: '流程与标准',
  tracks: '专项进阶',
};

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function LessonViewer({ lesson }: LessonViewerProps) {
  const [phase, setPhase] = useState<'content' | 'quiz' | 'done'>('content');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [closure, setClosure] = useState<ClosureResult | null>(null);
  const [closureError, setClosureError] = useState<string | null>(null);

  const mockQuestion = useMemo(() => buildMockQuestion(lesson), [lesson]);
  const isMandatory = lesson.requirement.startsWith('mandatory');

  async function handleSubmit() {
    if (selectedAnswer === null) return;
    setSubmitted(true);
    const correct = selectedAnswer === mockQuestion.correctIdx;
    const score = correct ? 100 : 40;
    try {
      const res = await fetch('/api/learning/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id, score }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setClosureError(data?.error ?? 'CLOSURE_FAILED');
      } else {
        setClosure({
          success: true,
          effects: data.effects ?? {},
          warnings: data.warnings ?? [],
        });
      }
    } catch (err) {
      setClosureError((err as Error).message);
    }
    setTimeout(() => setPhase('done'), 1200);
  }

  return (
    <div className="space-y-5">
      {/* ===== Hero · 课程元信息 ===== */}
      <header className="hero-ink p-6 sm:p-8">
        <Link
          href="/learning"
          className="inline-flex items-center gap-1 text-footnote"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回课程目录
        </Link>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span
            className="rounded-md px-2 py-0.5 text-footnote font-semibold"
            style={{
              background: isMandatory
                ? 'rgb(var(--brand-500))'
                : 'rgba(255,255,255,0.16)',
              color: '#fff',
            }}
          >
            {REQUIREMENT_LABEL[lesson.requirement]}
          </span>
          <span className="pill-on-dark">{CATEGORY_LABEL[lesson.category]}</span>
        </div>

        <h1 className="mt-3 text-title-2 text-white">{lesson.title}</h1>
        <p
          className="mt-2 text-body"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          {lesson.summary}
        </p>

        {/* 元信息行 */}
        <div
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            预计 {lesson.durationMin} 分钟
          </span>
          {lesson.rewardMode && lesson.rewardScore && (
            <span
              className="inline-flex items-center gap-1.5"
              style={{ color: 'rgb(var(--brand-300))' }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              完成 +{lesson.rewardScore} 分 · {lesson.rewardMode} 主修
            </span>
          )}
          {lesson.linkedKrId && (
            <span
              className="inline-flex items-center gap-1.5"
              style={{ color: 'rgb(var(--semantic-success))' }}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              完成 → 推流 KR-{lesson.linkedKrId}
            </span>
          )}
        </div>

        {/* 阶段进度 */}
        <div className="mt-6 flex items-center gap-2">
          <PhasePip
            active={phase === 'content'}
            done={phase !== 'content'}
            label="阅读"
          />
          <span
            className="h-px flex-1"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          />
          <PhasePip
            active={phase === 'quiz'}
            done={phase === 'done'}
            label="答题"
          />
          <span
            className="h-px flex-1"
            style={{ background: 'rgba(255,255,255,0.18)' }}
          />
          <PhasePip active={phase === 'done'} done={false} label="完成" />
        </div>
      </header>

      {/* ===== 内容阶段 ===== */}
      {phase === 'content' && (
        <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
          <article className="prose prose-sm max-w-none">
            {lesson.contentMarkdown ? (
              <MarkdownContent markdown={lesson.contentMarkdown} />
            ) : (
              <div
                className="text-body text-primary [&>h2]:mt-5 [&>h2]:mb-2 [&>h2]:text-headline [&>h2]:font-semibold [&>p]:my-2 [&>p]:text-secondary [&>ul]:my-2 [&>ul]:list-disc [&>ul]:pl-5 [&>li]:my-0.5 [&>li]:text-secondary"
                dangerouslySetInnerHTML={{
                  __html: buildMockContentHtml(lesson),
                }}
              />
            )}
          </article>

          <div
            className="mt-6 flex items-center justify-between gap-3 border-t pt-4"
            style={{ borderColor: 'rgb(var(--border-subtle))' }}
          >
            <p className="text-footnote text-tertiary">
              {lesson.contentMarkdown ? `📄 ${lesson.title}` : '💡 示例内容 · 课程正文待录入'}
            </p>
            <button
              type="button"
              onClick={() => setPhase('quiz')}
              className="rheem-btn-pill"
              style={{ padding: '8px 20px', fontSize: 14 }}
            >
              我看完了 → 答题
            </button>
          </div>
        </section>
      )}

      {/* ===== 答题阶段 ===== */}
      {phase === 'quiz' && (
        <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
          <h2 className="text-headline text-primary">✏️ 答题 · 1 / 1</h2>
          <p className="mt-4 text-body text-primary">{mockQuestion.prompt}</p>

          <div className="mt-4 space-y-2">
            {mockQuestion.options.map((opt, i) => {
              const isSelected = selectedAnswer === i;
              const showResult = submitted;
              const isCorrect = i === mockQuestion.correctIdx;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedAnswer(i)}
                  className="surface-interactive flex w-full items-start gap-2.5 rounded-2xl border p-3.5 text-left text-body"
                  style={getQuizOptionStyle({
                    showResult,
                    isCorrect,
                    isSelected,
                  })}
                >
                  <span
                    className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-footnote font-bold"
                    style={
                      isSelected
                        ? {
                            background: 'rgb(var(--brand-500))',
                            color: '#fff',
                            borderColor: 'rgb(var(--brand-500))',
                          }
                        : {
                            background: 'rgb(var(--surface-1))',
                            color: 'rgb(var(--text-secondary))',
                            borderColor: 'rgb(var(--border-default))',
                          }
                    }
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {showResult && isCorrect && (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'rgb(var(--semantic-success))' }}
                    />
                  )}
                  {showResult && isSelected && !isCorrect && (
                    <AlertTriangle
                      className="h-4 w-4 shrink-0"
                      style={{ color: 'rgb(var(--semantic-danger))' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {submitted && (
            <div className="surface-card-soft mt-4 p-3.5 text-caption text-secondary">
              <span className="font-semibold text-primary">解析:</span>{' '}
              {mockQuestion.explanation}
            </div>
          )}

          <div
            className="mt-6 flex items-center justify-between gap-3 border-t pt-4"
            style={{ borderColor: 'rgb(var(--border-subtle))' }}
          >
            <button
              type="button"
              onClick={() => setPhase('content')}
              className="text-caption text-tertiary hover:text-primary"
            >
              ← 回到阅读
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedAnswer === null || submitted}
              className="rheem-btn-pill"
              style={{
                padding: '8px 20px',
                fontSize: 14,
                opacity: selectedAnswer === null || submitted ? 0.4 : 1,
                cursor:
                  selectedAnswer === null || submitted
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {submitted ? '已提交…' : '提交答案'}
            </button>
          </div>
        </section>
      )}

      {/* ===== 完成阶段 ===== */}
      {phase === 'done' && (
        <section
          className="rounded-3xl p-6 sm:p-8 text-center shadow-soft-lg"
          style={{
            background:
              'linear-gradient(180deg, rgb(var(--semantic-success) / 0.08) 0%, rgb(var(--surface-1)) 60%)',
            border: '1px solid rgb(var(--semantic-success) / 0.2)',
          }}
        >
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: 'rgb(var(--semantic-success))',
              boxShadow: '0 0 0 8px rgb(var(--semantic-success) / 0.12)',
            }}
          >
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
          <h2 className="mt-4 text-title-2 text-primary">🎉 课程完成</h2>
          <p className="mt-2 text-body text-secondary">
            <span className="font-medium text-primary">{lesson.title}</span>{' '}
            已记录到你的实习日志
          </p>

          <div
            className="surface-card mx-auto mt-6 inline-block min-w-[280px] max-w-md p-4 text-left text-caption shadow-soft-sm"
          >
            <p className="mb-2 text-footnote font-semibold text-primary">
              ✅ 闭环效果 (真实上报)
            </p>
            <ul className="space-y-1.5 text-secondary">
              {closure?.effects.proficiencyDelta && (
                <li>
                  ✨{' '}
                  <span
                    className="font-medium"
                    style={{ color: 'rgb(var(--brand-600))' }}
                  >
                    主修 GPA
                  </span>{' '}
                  ·{' '}
                  <span className="font-mono text-primary">
                    {closure.effects.proficiencyDelta.mode}
                  </span>{' '}
                  +{closure.effects.proficiencyDelta.addedScore} 分
                </li>
              )}
              {closure?.effects.krProgressDelta && (
                <li>
                  📈{' '}
                  <span
                    className="font-medium"
                    style={{ color: 'rgb(var(--semantic-success))' }}
                  >
                    KR 推流
                  </span>{' '}
                  · KR-
                  <span className="font-mono text-primary">
                    {closure.effects.krProgressDelta.krId}
                  </span>{' '}
                  +{closure.effects.krProgressDelta.deltaPercent}%
                </li>
              )}
              {closure?.effects.certification && (
                <li>
                  🎓{' '}
                  <span
                    className="font-medium"
                    style={{ color: 'rgb(var(--brand-700))' }}
                  >
                    证书
                  </span>{' '}
                  ·{' '}
                  <span className="font-mono text-primary">
                    {closure.effects.certification.id}
                  </span>
                  {closure.effects.certification.expiresAt && (
                    <span className="text-tertiary">
                      {' '}
                      (过期{' '}
                      {new Date(
                        closure.effects.certification.expiresAt,
                      ).toLocaleDateString()}
                      )
                    </span>
                  )}
                </li>
              )}
              {closure?.effects.personaMemoryCandidate && (
                <li>
                  🧠{' '}
                  <span
                    className="font-medium"
                    style={{ color: 'rgb(var(--semantic-info))' }}
                  >
                    主分身记忆
                  </span>{' '}
                  · 已在 candidate 队列
                </li>
              )}
              {closure?.warnings && closure.warnings.length > 0 && (
                <li
                  className="mt-2"
                  style={{ color: 'rgb(var(--semantic-warning))' }}
                >
                  ⚠️ {closure.warnings.join('; ')}
                </li>
              )}
              {closureError && (
                <li style={{ color: 'rgb(var(--semantic-danger))' }}>
                  ❌ 接口错: {closureError}
                </li>
              )}
              {!closure && !closureError && (
                <li className="text-tertiary">加载中…</li>
              )}
              <li className="pt-1.5 text-[10px] text-tertiary">
                真调{' '}
                <code className="font-mono">POST /api/learning/complete</code>{' '}
                → closure.ts
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/learning"
              className="surface-card-soft surface-interactive rounded-full px-5 py-2.5 text-caption font-medium text-primary"
              style={{ border: '1px solid rgb(var(--border-default))' }}
            >
              返回课程目录
            </Link>
            <Link
              href="/persona?tab=archive"
              className="rheem-btn-pill"
              style={{ padding: '10px 20px', fontSize: 14 }}
            >
              查看实习日志
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件 · 阶段 pip (深底)
// ---------------------------------------------------------------------------

function PhasePip({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  const dotStyle = done
    ? {
        background: 'rgb(var(--semantic-success))',
        color: '#fff',
      }
    : active
      ? {
          background: 'rgb(var(--brand-500))',
          color: '#fff',
        }
      : {
          background: 'rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.6)',
        };
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
        style={dotStyle}
      >
        {done ? '✓' : active ? '●' : '○'}
      </span>
      <span
        className="text-footnote font-medium"
        style={{
          color:
            active || done ? '#fff' : 'rgba(255,255,255,0.5)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 答题选项配色 (CSS var, 不再用 raw bg-emerald-50 等)
// ---------------------------------------------------------------------------

function getQuizOptionStyle({
  showResult,
  isCorrect,
  isSelected,
}: {
  showResult: boolean;
  isCorrect: boolean;
  isSelected: boolean;
}): React.CSSProperties {
  if (showResult && isCorrect) {
    return {
      borderColor: 'rgb(var(--semantic-success) / 0.5)',
      background: 'rgb(var(--semantic-success) / 0.08)',
      color: 'rgb(var(--text-primary))',
    };
  }
  if (showResult && isSelected && !isCorrect) {
    return {
      borderColor: 'rgb(var(--semantic-danger) / 0.5)',
      background: 'rgb(var(--semantic-danger) / 0.08)',
      color: 'rgb(var(--text-primary))',
    };
  }
  if (isSelected) {
    return {
      borderColor: 'rgb(var(--brand-500))',
      background: 'rgb(var(--brand-50))',
      color: 'rgb(var(--text-primary))',
    };
  }
  return {
    borderColor: 'rgb(var(--border-subtle))',
    background: 'rgb(var(--surface-1))',
    color: 'rgb(var(--text-primary))',
  };
}

// ---------------------------------------------------------------------------
// Mock 内容生成
// ---------------------------------------------------------------------------

function buildMockContentHtml(lesson: Lesson): string {
  return `
<h2>📖 课程导读</h2>
<p>${lesson.summary}</p>

<h2>🎯 学完后你会</h2>
<ul>
  <li>掌握「${lesson.title}」的核心概念</li>
  <li>能在日常工作中应用相关原则</li>
  <li>识别 3 个常见误区并规避</li>
</ul>

<h2>📚 核心要点</h2>
<p><strong>要点 1.</strong> 这是 P1 mock 内容. 真实接入后这里展示 <code>Lesson.contentMarkdown</code> 的渲染结果.</p>
<p><strong>要点 2.</strong> P2 阶段会替换为真 markdown 渲染器 (例如 <code>react-markdown</code> + <code>remark-gfm</code>).</p>
<p><strong>要点 3.</strong> AI 生成课程经过 Skill Gateway 4 道闸 + Steward 双签批后方可上架.</p>

<h2>💡 经验沉淀</h2>
<p>本课程对应 ${CATEGORY_LABEL[lesson.category]}, ${
    lesson.requirement === 'mandatory_quarterly'
      ? '季度复训, 通过后获 90 天有效证书.'
      : lesson.requirement === 'mandatory_once'
        ? '一次必修, 通过后永久有效.'
        : '推荐学习, 提升相关主修 GPA.'
  }</p>
`;
}

// ---------------------------------------------------------------------------
// Markdown 渲染 (轻量, 无额外依赖)
// ---------------------------------------------------------------------------

function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');
  const nodes: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList() {
    if (listBuffer.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-2 list-disc pl-5 space-y-0.5">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-secondary text-body">{item}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  lines.forEach((line, i) => {
    if (line.startsWith('### ')) {
      flushList();
      nodes.push(<h3 key={i} className="mt-4 mb-1 text-body font-semibold text-primary">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      flushList();
      nodes.push(<h2 key={i} className="mt-5 mb-2 text-headline font-semibold text-primary">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      flushList();
      nodes.push(<h1 key={i} className="mt-5 mb-2 text-title-3 font-bold text-primary">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      const bold = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code class="font-mono text-footnote bg-surface-2 px-1 rounded">$1</code>');
      nodes.push(<p key={i} className="my-2 text-secondary text-body" dangerouslySetInnerHTML={{ __html: bold }} />);
    }
  });
  flushList();

  return <div className="text-body text-primary">{nodes}</div>;
}

function buildMockQuestion(lesson: Lesson): {
  prompt: string;
  options: string[];
  correctIdx: number;
  explanation: string;
} {
  return {
    prompt: `根据《${lesson.title}》课程内容, 以下哪个做法最符合本课的核心原则?`,
    options: [
      '严格按 SOP 执行, 不假思索',
      '结合 SOP + AI 推演 + 历史案例 + 个人判断, 选最优',
      '凭经验拍板, 跳过检查',
      '推给 AI 决策, 自己不参与',
    ],
    correctIdx: 1,
    explanation:
      'Tandem 3+1 决策原则: A SOP / B AI 推演 / C 历史案例 / D 个人原创, 综合裁决. 任何单一来源都可能盲区.',
  };
}
