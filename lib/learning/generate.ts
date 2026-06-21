/**
 * AI 课程生成服务 · 真 LLM 接入 (P1 闭环, 替换原 route 内 stub)
 *
 * 设计 (对齐 okr-bulk-create / document-review 的"结构化 prompt → router.chat" 模式):
 *   1. 按 sourceType 从 store 取素材原文 (memory.body / material.body / document.content),
 *      并做 tenantId 隔离校验 (§23 租户零信任)。
 *   2. 拼系统/用户 prompt, 调 getRouter().chat({ scenario:'reasoning_complex', responseFormat:'json' }).
 *      —— 输入为系统拼装的结构化 prompt (非用户自由文本), 与 okr-bulk-create 同属 governed-chat-exempt。
 *   3. 严格解析 + 校验 LLM JSON; 任何失败 → 回退确定性 stub (永不断闭环), isStub=true + 原因。
 *   4. 课程内容是 Material 衍生包 (宪章 §7), 不入 Memory, 由 HR/Steward 在 /admin/learning 审核后发布。
 *
 * 可注入 router/store, 便于单测与真模型探针 (probe) 不依赖 boot。
 */

import type { TandemRouter } from '../taf/router';
import type { ChatMessage } from '../taf/provider/types';
import type { TandemStore } from '../storage/repository';
import type { GenerateLessonInput, GeneratedLesson, GeneratedQuestion } from './types';
import { audit } from '../audit/log';

export interface GenerateLessonDeps {
  router?: Pick<TandemRouter, 'chat'>;
  store?: Pick<TandemStore, 'memories' | 'materials' | 'documents'>;
  /** 租户隔离: 仅返回属于该租户的素材 (§23) */
  tenantId?: string;
}

export interface GenerateLessonResult {
  generated: GeneratedLesson;
  /** true = LLM 未跑成 (无 provider / 调用失败 / 解析失败), 用确定性兜底内容 */
  isStub: boolean;
  /** stub 时的降级原因 */
  fallbackReason?: string;
  /** 实际命中的模型名 (真跑成时) */
  modelUsed?: string;
}

const MAX_SOURCE_CHARS = 8000;

const SYSTEM_PROMPT = `你是 Tandem 企业学院的课程设计师. 给你一段公司内部素材 (SOP / 案例 / 政策 / 文档), 你要把它改写成一节面向员工的微课, 严格输出 JSON.

JSON 结构 (只输出 JSON, 不要 markdown 代码块, 不要任何解释):
{
  "lecture": "用 markdown 写的讲解正文, 3 段以上, 每段用 ## 小标题. 必须基于给定素材, 不许编造素材里没有的事实.",
  "questions": [
    { "question": "题干", "options": ["A","B","C","D"], "correctAnswerIdx": 0, "explanation": "为什么这个对, 引用素材依据" }
  ],
  "summaryCard": ["takeaway 1", "takeaway 2", "takeaway 3"]
}

要求:
1. questions 恰好 5 题, 每题恰好 4 个选项, correctAnswerIdx 是 0-3 的整数
2. summaryCard 3-5 条, 每条一句话
3. 全部中文
4. 讲解与题目都必须忠于素材, 不得脱离素材自由发挥`;

/** 按 sourceType 取素材正文 + 标题; 带 tenant 校验. 找不到/越租户返回 null. */
export async function resolveSourceText(
  input: GenerateLessonInput,
  store: GenerateLessonDeps['store'],
  tenantId?: string,
): Promise<{ title: string; text: string } | null> {
  if (!store) return null;
  const sameTenant = (rec: unknown): boolean => {
    if (!tenantId) return true;
    const t = (rec as { tenantId?: string }).tenantId;
    return t === undefined || t === tenantId;
  };

  if (input.sourceType === 'memory') {
    const rec = await store.memories.get(input.sourceId);
    if (!rec || !sameTenant(rec)) return null;
    return { title: rec.title, text: String(rec.body ?? '') };
  }
  if (input.sourceType === 'material') {
    const rec = await store.materials.get(input.sourceId);
    if (!rec || !sameTenant(rec)) return null;
    const body = typeof rec.body === 'string' ? rec.body : JSON.stringify(rec.body ?? '');
    return { title: rec.title, text: body };
  }
  if (input.sourceType === 'document') {
    const rec = await store.documents.get(input.sourceId);
    if (!rec || !sameTenant(rec)) return null;
    return { title: rec.title, text: String(rec.content ?? '') };
  }
  return null;
}

/** 解析 + 校验 LLM 返回的课程 JSON. 任何不合规返回 null. */
export function parseLessonJson(text: string): GeneratedLesson | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }

  const o = obj as Partial<GeneratedLesson> & { questions?: unknown[] };
  if (typeof o.lecture !== 'string' || !o.lecture.trim()) return null;
  if (!Array.isArray(o.questions) || o.questions.length < 1) return null;
  if (!Array.isArray(o.summaryCard) || o.summaryCard.length < 1) return null;

  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < o.questions.length && questions.length < 5; i++) {
    const q = o.questions[i] as Partial<GeneratedQuestion> & { options?: unknown };
    if (typeof q.question !== 'string' || !Array.isArray(q.options)) continue;
    const options = q.options.map((x) => String(x)).slice(0, 4);
    if (options.length !== 4) continue;
    const idx = Number(q.correctAnswerIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
    questions.push({
      id: questions.length + 1,
      question: q.question,
      options,
      correctAnswerIdx: idx,
      explanation: typeof q.explanation === 'string' ? q.explanation : '',
    });
  }
  if (questions.length !== 5) return null;

  const summaryCard = o.summaryCard.map((x) => String(x)).filter(Boolean).slice(0, 5);
  if (summaryCard.length < 1) return null;

  return { lecture: o.lecture.trim(), questions, summaryCard };
}

/** 确定性兜底内容 (LLM 不可用时保活, 不再是空架子: 至少把素材标题带进去). */
function buildFallback(title: string, category: string): GeneratedLesson {
  return {
    lecture: `## ${title}\n\n本节基于素材《${title}》(${category}) 整理. 当前 AI 生成未就绪, 以下为占位结构, 请 HR/Steward 在 /admin/learning 补全后发布.\n\n## 核心要点\n（待 AI 生成或人工补全）\n\n## 实操与边界\n（待补全）`,
    questions: [
      {
        id: 1,
        question: `《${title}》属于哪个学习分类?`,
        options: [category, '其他', '未分类', '不确定'],
        correctAnswerIdx: 0,
        explanation: `本课程素材归类为 ${category}.`,
      },
      {
        id: 2,
        question: '课程内容在发布前必须经过什么?',
        options: ['HR/Steward 审核', '直接发布', 'AI 自动发布', '无需处理'],
        correctAnswerIdx: 0,
        explanation: '混合策略 (C3): AI 起草 + 人工审核, 在 /admin/learning 校对后发布.',
      },
      {
        id: 3,
        question: '课程内容属于知识四层中的哪一层?',
        options: ['Material 衍生 (不入 Memory)', 'Memory', 'Baseline', 'Origins'],
        correctAnswerIdx: 0,
        explanation: '宪章 §7: 课程是 Material 衍生包, 不直接入 Memory.',
      },
      {
        id: 4,
        question: '谁有权触发 AI 课程生成?',
        options: ['Steward / champion 等授权角色', '所有员工', '仅 CEO', '外部访客'],
        correctAnswerIdx: 0,
        explanation: '生成接口受 DATA_STEWARD_ROLES + champion 角色守门.',
      },
      {
        id: 5,
        question: 'AI 生成失败时系统如何处理?',
        options: ['回退占位内容保活', '报错中断', '随机编造', '删除课程'],
        correctAnswerIdx: 0,
        explanation: '失败回退确定性兜底, 永不断闭环, 由人工补全.',
      },
    ],
    summaryCard: [
      `素材: ${title} (${category})`,
      'AI 起草 + 人工审核 (混合策略 C3)',
      '课程是 Material 衍生, 不入 Memory (§7)',
      '生成失败回退占位, 不断闭环',
    ],
  };
}

/**
 * 主入口: 取素材 → 调真 LLM → 解析/校验 → 失败回退兜底.
 * 返回 null 仅当素材不存在/越租户 (route 转 404); 其余一律给 generated.
 */
export async function generateLesson(
  input: GenerateLessonInput,
  deps: GenerateLessonDeps = {},
): Promise<GenerateLessonResult | null> {
  const store = deps.store ?? (await import('../storage/repository')).getStore();
  const source = await resolveSourceText(input, store, deps.tenantId);
  if (!source) return null;

  const fallback = buildFallback(source.title, input.category);
  const sourceText = source.text.slice(0, MAX_SOURCE_CHARS);

  let router = deps.router;
  if (!router) {
    try {
      router = (await import('../boot')).getRouter();
    } catch {
      router = undefined;
    }
  }
  if (!router || (router as TandemRouter).listProviders?.().length === 0) {
    return { generated: fallback, isStub: true, fallbackReason: 'no_provider' };
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `分类: ${input.category}\n素材标题: ${source.title}\n素材正文:\n${sourceText}`,
    },
  ];

  try {
    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: 课程生成输入为系统拼装的结构化素材 prompt (非用户自由文本), 与 okr-bulk-create / document-review 同模式; 产物经 HR/Steward 人工审核后才发布
    const res = await router.chat({
      messages,
      scenario: 'reasoning_complex',
      temperature: 0.5,
      responseFormat: 'json',
      maxTokens: 2400,
      metadata: { userId: input.userId },
    });
    const content = typeof res.message.content === 'string' ? res.message.content : '';
    const parsed = parseLessonJson(content);
    if (!parsed) {
      await audit('academy.lesson_generated', input.userId, {
        targetType: 'lesson_source',
        targetId: input.sourceId,
        metadata: { action: 'learning.generate', result: 'parse_failed', category: input.category },
      });
      return { generated: fallback, isStub: true, fallbackReason: 'parse_failed' };
    }
    await audit('academy.lesson_generated', input.userId, {
      targetType: 'lesson_source',
      targetId: input.sourceId,
      metadata: {
        action: 'learning.generate',
        result: 'ok',
        category: input.category,
        model: res.model,
        questions: parsed.questions.length,
      },
    });
    return { generated: parsed, isStub: false, modelUsed: res.model };
  } catch (err) {
    await audit('academy.lesson_generated', input.userId, {
      targetType: 'lesson_source',
      targetId: input.sourceId,
      metadata: { action: 'learning.generate', result: 'llm_error', category: input.category },
    });
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[learning.generate] LLM failed:', (err as Error)?.message);
    }
    return { generated: fallback, isStub: true, fallbackReason: 'llm_error' };
  }
}
