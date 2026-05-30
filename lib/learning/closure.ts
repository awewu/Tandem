/**
 * Learning Closure · 学习完成的三柱闭环钩子 (P5)
 *
 * 完成 1 节课 → 触发以下副作用 (best-effort, 失败不阻塞主流程):
 *
 *   1. 推流 KR 进度  (事半 ← 拿捏)
 *      lesson.linkedKrId 存在 → 调 OKR check-in API
 *
 *   2. Mode Proficiency 加分  (搭子 ← 拿捏)
 *      lesson.rewardMode + rewardScore → 累加到对应模式 proficiency
 *
 *   3. 颁发认证 (Certification)
 *      lesson.requirement === 'mandatory_*' 时
 *
 *   4. 主分身记忆增量
 *      把 lesson 摘要作为 Persona Memory 候选 (训练数据 opt-in 才入)
 *
 *   5. Audit 留痕
 *
 * P0 真闭环 (2026-05-29): KvStore-based 真扭转数据.
 *   - insert LessonAttempt → store.learningAttempts
 *   - 更新 Persona.modeProficiency (累加分)
 *   - mandatory_* → insert Certification → store.learningCertifications
 *   - linkedKrId → store.checkIns 真推 KR 进度
 *   - 更新 LearningEnrollment.lessonsCompleted (去重)
 */

import { audit } from '../audit/log';
import type { Lesson, LessonAttempt, Certification } from './types';
import type { SkillMode } from '../persona/skill-modes';
import { enrollmentIdFor, type LearningEnrollment } from './enrollment';
import type { CheckIn, Confidence } from '../types/okr-tti';
import type { TandemStore } from '../storage/repository';

/**
 * 可注入 store 获取器 (单测可传 mock).
 * 默认延迟导入 boot.getStore 避免在 import-time 调 makeClient (要求 DATABASE_URL).
 */
let _storeGetter: (() => TandemStore | null) | null = null;
export function setClosureStoreGetter(
  getter: (() => TandemStore | null) | null,
): void {
  _storeGetter = getter;
}
async function resolveStore(): Promise<TandemStore | null> {
  if (_storeGetter) return _storeGetter();
  try {
    const mod = await import('../boot');
    return mod.getStore();
  } catch {
    return null;
  }
}

export interface ClosureInput {
  attempt: LessonAttempt;
  lesson: Lesson;
}

export interface ClosureResult {
  success: boolean;
  effects: {
    krProgressDelta?: { krId: string; deltaPercent: number };
    proficiencyDelta?: { mode: SkillMode; addedScore: number };
    certification?: Certification;
    personaMemoryCandidate?: { lessonId: string; summary: string };
  };
  warnings: string[];
}

/**
 * 完成学习后的闭环主入口.
 *
 * 必须在 attempt.passed === true 后调用 (调用方判断).
 */
/**
 * 退化路径: store 不可用时 (例: 单测环境 / DATABASE_URL 缺失) 仅返回 effects, 不写库.
 * 与历史 stub 行为一致, 保证调用方 (UI) 仍能渲染.
 */
function runStubFallback(
  input: ClosureInput,
  warnings: string[],
  effects: ClosureResult['effects'],
): ClosureResult {
  const { attempt, lesson } = input;
  if (lesson.linkedKrId) {
    effects.krProgressDelta = { krId: lesson.linkedKrId, deltaPercent: 5 };
  }
  if (lesson.rewardMode && lesson.rewardScore) {
    effects.proficiencyDelta = {
      mode: lesson.rewardMode,
      addedScore: lesson.rewardScore,
    };
  }
  if (
    lesson.requirement === 'mandatory_once' ||
    lesson.requirement === 'mandatory_quarterly'
  ) {
    effects.certification = {
      id: `cert_${attempt.id}`,
      userId: attempt.userId,
      lessonId: lesson.id,
      earnedAt: new Date().toISOString(),
      expiresAt:
        lesson.requirement === 'mandatory_quarterly'
          ? new Date(Date.now() + 90 * 86400 * 1000).toISOString()
          : undefined,
    };
  }
  effects.personaMemoryCandidate = {
    lessonId: lesson.id,
    summary: `${attempt.userId} 完成 "${lesson.title}" (得分 ${attempt.score ?? '?'})`,
  };
  return { success: true, effects, warnings };
}

export async function onLessonCompleted(input: ClosureInput): Promise<ClosureResult> {
  const { attempt, lesson } = input;
  const warnings: string[] = [];
  const effects: ClosureResult['effects'] = {};

  if (!attempt.passed) {
    warnings.push('attempt.passed=false, 跳过闭环 (调用方应在 passed=true 后调本接口)');
    return { success: false, effects, warnings };
  }

  const store = await resolveStore();
  if (!store) {
    warnings.push('store 不可用, 闭环退化为纯 effects (不写库)');
    return runStubFallback(input, warnings, effects);
  }

  // ① 推流 KR 进度 (事半闭环) — 真调 store.checkIns.create
  if (lesson.linkedKrId) {
    try {
      const kr = await store.keyResults.get(lesson.linkedKrId);
      const progressBefore = kr?.currentValue ?? 0;
      const progressAfter = Math.min(100, progressBefore + 5);
      const confidence: Confidence = progressAfter >= 80 ? 'on-track' : 'at-risk';

      const checkInId = `ci_${attempt.id}`;
      const checkInRow: CheckIn = {
        id: checkInId,
        scope: 'kr',
        scopeId: lesson.linkedKrId,
        authorId: attempt.userId,
        progressBefore,
        progressAfter,
        confidenceBefore: confidence,
        confidenceAfter: confidence,
        achievements: `学习贡献: 通过课程 "${lesson.title}" (+5%)`,
        blockers: null,
        nextSteps: null,
        mood: null,
        createdAt: new Date().toISOString(),
      };
      await store.checkIns.create(checkInRow);

      effects.krProgressDelta = {
        krId: lesson.linkedKrId,
        deltaPercent: progressAfter - progressBefore,
      };
    } catch (err) {
      warnings.push(`KR 推流失败: ${(err as Error).message}`);
    }
  }

  // ② Mode Proficiency 加分 (搭子闭环) — 真写 Persona
  if (lesson.rewardMode && lesson.rewardScore) {
    try {
      const personas = await store.personas.list({ userId: attempt.userId } as never);
      const persona = personas[0];
      if (persona) {
        const cur = persona.modeProficiency ?? {};
        const old = cur[lesson.rewardMode] ?? 0;
        const next = Math.min(100, old + lesson.rewardScore);
        await store.personas.update(persona.id, {
          modeProficiency: { ...cur, [lesson.rewardMode]: next },
          updatedAt: new Date().toISOString(),
        } as never);
        effects.proficiencyDelta = {
          mode: lesson.rewardMode,
          addedScore: next - old,
        };
      } else {
        warnings.push(`Persona for ${attempt.userId} not found, 跳过 proficiency 写入`);
      }
    } catch (err) {
      warnings.push(`Mode proficiency 写入失败: ${(err as Error).message}`);
    }
  }

  // ③ 颁发认证 (mandatory 才生成) — 真写 KvStore
  if (lesson.requirement === 'mandatory_once' || lesson.requirement === 'mandatory_quarterly') {
    const cert: Certification = {
      id: `cert_${attempt.id}`,
      userId: attempt.userId,
      lessonId: lesson.id,
      earnedAt: new Date().toISOString(),
      expiresAt:
        lesson.requirement === 'mandatory_quarterly'
          ? new Date(Date.now() + 90 * 86400 * 1000).toISOString()
          : undefined,
    };
    try {
      await store.learningCertifications.create(cert);
    } catch (err) {
      warnings.push(`Certification 写入失败: ${(err as Error).message}`);
    }
    effects.certification = cert;
  }

  // ④ Persona Memory 候选 (opt-in 才入)
  effects.personaMemoryCandidate = {
    lessonId: lesson.id,
    summary: `${attempt.userId} 完成 "${lesson.title}" (得分 ${attempt.score ?? '?'})`,
  };

  // ⑤ 持久化 LessonAttempt + 更新 LearningEnrollment (去重 append)
  try {
    await store.learningAttempts.create(attempt);

    const enrollId = enrollmentIdFor(attempt.userId);
    const existing = await store.learningEnrollments.get(enrollId);
    if (existing) {
      const set = new Set(existing.lessonsCompleted);
      set.add(lesson.id);
      await store.learningEnrollments.update(enrollId, {
        lessonsCompleted: Array.from(set),
        totalScore: attempt.score ?? existing.totalScore,
      } as never);
    } else {
      const fresh: LearningEnrollment = {
        id: enrollId,
        userId: attempt.userId,
        lessonsCompleted: [lesson.id],
        totalScore: attempt.score,
        enrolledAt: new Date().toISOString(),
      };
      await store.learningEnrollments.create(fresh);
    }
  } catch (err) {
    warnings.push(`Attempt/Enrollment 写入失败: ${(err as Error).message}`);
  }

  // ⑤ Audit (Steward 月度审计)
  try {
    await audit('skill.executed', attempt.userId, {
      targetType: 'learning_attempt',
      targetId: attempt.id,
      metadata: {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        category: lesson.category,
        score: attempt.score,
        krProgressDelta: effects.krProgressDelta,
        proficiencyDelta: effects.proficiencyDelta,
        certificationGranted: !!effects.certification,
      },
    });
  } catch {
    /* audit 失败不阻塞 */
  }

  return { success: true, effects, warnings };
}

/**
 * 检查季度必修的过期状态 (P4 锁权限触发器).
 *
 * 在 cron 或访问敏感页面前调用.
 */
export function checkComplianceExpiration(certs: Certification[]): {
  expired: Certification[];
  inGrace: Certification[];
  ok: Certification[];
} {
  const now = Date.now();
  const GRACE_MS = 24 * 3600 * 1000; // 24h grace period

  const expired: Certification[] = [];
  const inGrace: Certification[] = [];
  const ok: Certification[] = [];

  for (const c of certs) {
    if (!c.expiresAt) {
      ok.push(c); // 一次性认证, 永不过期
      continue;
    }
    const expMs = Date.parse(c.expiresAt);
    if (now > expMs + GRACE_MS) expired.push({ ...c, inGracePeriod: false });
    else if (now > expMs) inGrace.push({ ...c, inGracePeriod: true });
    else ok.push(c);
  }

  return { expired, inGrace, ok };
}
