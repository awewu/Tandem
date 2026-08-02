/**
 * 任务承诺档位服务 (PRD §4.3 B轨) — 直连 typed 表
 *
 * 员工承接任务档位 A-G 升降留痕:
 *   proposed → approved → active → expired/rejected
 *   升档需理由 + 证据快照; 降档可自主或管理发起。
 *   生效后更新 comp_employee_grade.taskGear。
 */

import { and, eq, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compTaskCommitment,
  compEmployeeGrade,
  compGradeBand,
} from '../infra/drizzle-schema';
import type { TaskGear } from '../types/comp';

export interface CommitmentInput {
  tenantId: string;
  employeeId: string;
  familyId: string;
  cycle: string;
  commitmentType: 'annual' | 'quarterly' | 'half_year' | 'special';
  fromGear?: TaskGear;
  toGear: TaskGear;
  reason?: string;
  proposedBy: string;
  evidenceSnapshot?: unknown;
}

export interface CommitmentRow {
  id: string;
  tenantId: string;
  employeeId: string;
  familyId: string;
  cycle: string;
  commitmentType: string;
  fromGear: string | null;
  toGear: string;
  taskWageDelta: number;
  reason: string | null;
  status: string;
  proposedBy: string | null;
  approvedBy: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  evidenceSnapshot: unknown;
  createdAt: Date;
}

/** 计算任务工资增量 (toGear - fromGear 的带宽差) */
export async function calcTaskWageDelta(
  tenantId: string,
  jobClass: string,
  level: string,
  fromGear: TaskGear | null,
  toGear: TaskGear,
): Promise<number> {
  const [band] = await db
    .select()
    .from(compGradeBand)
    .where(
      and(
        eq(compGradeBand.tenantId, tenantId),
        eq(compGradeBand.jobClass, jobClass),
        eq(compGradeBand.level, level),
      ),
    )
    .limit(1);

  const gears = (band?.taskGears as Record<string, number> | undefined) ?? {};
  const fromWage = fromGear ? Number(gears[fromGear] ?? 0) : 0;
  const toWage = Number(gears[toGear] ?? band?.taskWageStd ?? 0);
  return toWage - fromWage;
}

/** 提交任务承诺申请 (proposed 状态) */
export async function proposeCommitment(input: CommitmentInput): Promise<{ id: string }> {
  const id = `commit_${input.tenantId}_${input.employeeId}_${input.cycle}_${Date.now()}`;

  // 查员工当前 jobClass + level 算 delta
  const [grade] = await db
    .select()
    .from(compEmployeeGrade)
    .where(
      and(
        eq(compEmployeeGrade.tenantId, input.tenantId),
        eq(compEmployeeGrade.employeeId, input.employeeId),
        isNull(compEmployeeGrade.effectiveTo),
      ),
    )
    .limit(1);

  const delta = grade
    ? await calcTaskWageDelta(input.tenantId, grade.jobClass, grade.currentLevel, input.fromGear ?? null, input.toGear)
    : 0;

  await db.insert(compTaskCommitment).values({
    id,
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    familyId: input.familyId,
    cycle: input.cycle,
    commitmentType: input.commitmentType,
    fromGear: input.fromGear ?? null,
    toGear: input.toGear,
    taskWageDelta: delta,
    reason: input.reason ?? null,
    status: 'proposed',
    proposedBy: input.proposedBy,
    evidenceSnapshot: input.evidenceSnapshot ?? {},
  });

  return { id };
}

/** 审批任务承诺 (proposed → approved, 同时更新员工 taskGear) */
export async function approveCommitment(
  tenantId: string,
  commitmentId: string,
  approverId: string,
): Promise<{ ok: boolean; taskWageDelta: number }> {
  const [commit] = await db
    .select()
    .from(compTaskCommitment)
    .where(
      and(
        eq(compTaskCommitment.tenantId, tenantId),
        eq(compTaskCommitment.id, commitmentId),
      ),
    )
    .limit(1);

  if (!commit) throw new Error('commitment not found');
  if (commit.status !== 'proposed') throw new Error(`cannot approve commitment in status ${commit.status}`);

  const now = new Date();

  await db
    .update(compTaskCommitment)
    .set({
      status: 'approved',
      approvedBy: approverId,
      effectiveFrom: now,
    })
    .where(eq(compTaskCommitment.id, commitmentId));

  // 更新员工当前档位
  await db
    .update(compEmployeeGrade)
    .set({ taskGear: commit.toGear })
    .where(
      and(
        eq(compEmployeeGrade.tenantId, tenantId),
        eq(compEmployeeGrade.employeeId, commit.employeeId),
        isNull(compEmployeeGrade.effectiveTo),
      ),
    );

  return { ok: true, taskWageDelta: commit.taskWageDelta };
}

/** 驳回 */
export async function rejectCommitment(
  tenantId: string,
  commitmentId: string,
): Promise<void> {
  await db
    .update(compTaskCommitment)
    .set({ status: 'rejected' })
    .where(
      and(
        eq(compTaskCommitment.tenantId, tenantId),
        eq(compTaskCommitment.id, commitmentId),
      ),
    );
}

/** 查询员工承诺记录 */
export async function listCommitments(
  tenantId: string,
  employeeId?: string,
  status?: string,
): Promise<CommitmentRow[]> {
  const rows = await db
    .select()
    .from(compTaskCommitment)
    .where(eq(compTaskCommitment.tenantId, tenantId));

  return rows.filter(
    (r) =>
      (!employeeId || r.employeeId === employeeId) &&
      (!status || r.status === status),
  );
}
