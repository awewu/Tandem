/**
 * 职级变更签批流 (PRD §6) — 直连 typed 表
 *
 * 变更类型: 知悉 / PIP告知 / 降职生效 / 职级晋升 / 任务承接
 * 签批状态: 待签 → 已签 / 拒签 / 逾期视同送达
 * 申诉: none → open → resolved
 *
 * 晋升生效后更新 comp_employee_grade.currentLevel + baseWageSnapshot。
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compGradeChangeLog,
  compEmployeeGrade,
  compGradeBand,
} from '../infra/drizzle-schema';
import type { CompLevel } from '../types/comp';

export interface GradeChangeInput {
  tenantId: string;
  employeeId: string;
  nodeId: string;
  cycle: string;
  changeType: '知悉' | 'PIP告知' | '降职生效' | '职级晋升' | '任务承接';
  fromGrade?: CompLevel;
  toGrade?: CompLevel;
  evidenceSnapshot?: unknown;
}

export interface GradeChangeRow {
  id: string;
  tenantId: string;
  employeeId: string;
  nodeId: string;
  cycle: string;
  changeType: string;
  fromGrade: string | null;
  toGrade: string | null;
  evidenceSnapshot: unknown;
  signatureState: string;
  signedAt: Date | null;
  appealState: string;
  createdAt: Date;
}

/** 发起职级变更 (待签状态) */
export async function createGradeChange(input: GradeChangeInput): Promise<{ id: string }> {
  const id = `change_${input.tenantId}_${input.employeeId}_${input.cycle}_${Date.now()}`;

  await db.insert(compGradeChangeLog).values({
    id,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    nodeId: input.nodeId,
    cycle: input.cycle,
    changeType: input.changeType,
    fromGrade: input.fromGrade ?? null,
    toGrade: input.toGrade ?? null,
    evidenceSnapshot: input.evidenceSnapshot ?? {},
    signatureState: '待签',
    appealState: 'none',
  });

  return { id };
}

/** 签批 (待签 → 已签 / 拒签) */
export async function signGradeChange(
  tenantId: string,
  changeId: string,
  signatureState: '已签' | '拒签',
): Promise<{ ok: boolean; applied: boolean }> {
  const [change] = await db
    .select()
    .from(compGradeChangeLog)
    .where(
      and(
        eq(compGradeChangeLog.tenantId, tenantId),
        eq(compGradeChangeLog.id, changeId),
      ),
    )
    .limit(1);

  if (!change) throw new Error('change record not found');
  if (change.signatureState !== '待签') throw new Error(`already signed: ${change.signatureState}`);

  await db
    .update(compGradeChangeLog)
    .set({ signatureState, signedAt: new Date() })
    .where(eq(compGradeChangeLog.id, changeId));

  // 已签 + 晋升/降职 → 更新员工职级
  if (signatureState === '已签' && change.toGrade && change.changeType !== '知悉' && change.changeType !== 'PIP告知') {
    await applyGradeChange(tenantId, change.employeeId, change.toGrade as CompLevel);
    return { ok: true, applied: true };
  }

  return { ok: true, applied: false };
}

/** 申诉 (none → open → resolved) */
export async function updateAppeal(
  tenantId: string,
  changeId: string,
  appealState: 'none' | 'open' | 'resolved',
): Promise<void> {
  await db
    .update(compGradeChangeLog)
    .set({ appealState })
    .where(
      and(
        eq(compGradeChangeLog.tenantId, tenantId),
        eq(compGradeChangeLog.id, changeId),
      ),
    );
}

/** 实际应用职级变更: 更新 employee_grade.currentLevel + baseWageSnapshot */
async function applyGradeChange(
  tenantId: string,
  employeeId: string,
  newLevel: CompLevel,
): Promise<void> {
  const [grade] = await db
    .select()
    .from(compEmployeeGrade)
    .where(
      and(
        eq(compEmployeeGrade.tenantId, tenantId),
        eq(compEmployeeGrade.employeeId, employeeId),
      ),
    )
    .limit(1);

  if (!grade) return;

  // 查新层级带宽的基本工资
  const [band] = await db
    .select()
    .from(compGradeBand)
    .where(
      and(
        eq(compGradeBand.tenantId, tenantId),
        eq(compGradeBand.jobClass, grade.jobClass),
        eq(compGradeBand.level, newLevel),
      ),
    )
    .limit(1);

  await db
    .update(compEmployeeGrade)
    .set({
      currentLevel: newLevel,
      baseWageSnapshot: band?.baseWage ?? grade.baseWageSnapshot,
    })
    .where(eq(compEmployeeGrade.id, grade.id));
}

/** 查询变更记录 */
export async function listGradeChanges(
  tenantId: string,
  employeeId?: string,
  signatureState?: string,
): Promise<GradeChangeRow[]> {
  const rows = await db
    .select()
    .from(compGradeChangeLog)
    .where(eq(compGradeChangeLog.tenantId, tenantId));

  return rows.filter(
    (r) =>
      (!employeeId || r.employeeId === employeeId) &&
      (!signatureState || r.signatureState === signatureState),
  );
}
