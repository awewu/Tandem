/**
 * 员工职级分配服务 (HR) —— 直连 typed 表
 *
 * HR 给员工定"岗族 × 岗类 × 层级 × 任务档", 落 comp_employee_grade。
 * baseWageSnapshot 取自带宽 (岗类×层级); certifiedAgainstVersion 取当前发布版本。
 */

import { createHash } from 'node:crypto';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compEmployeeGrade,
  compJobFamily,
  compGradeBand,
  compMatrixVersion,
  user as userTable,
} from '../infra/drizzle-schema';
import type { CompLevel, JobClass, TaskGear } from '../types/comp';

const gid = (tenantId: string, employeeId: string) =>
  'eg_' + createHash('sha1').update(`${tenantId}|${employeeId}`).digest('hex').slice(0, 16);

async function currentVersion(tenantId: string): Promise<string> {
  const [v] = await db
    .select()
    .from(compMatrixVersion)
    .where(and(eq(compMatrixVersion.tenantId, tenantId), eq(compMatrixVersion.status, 'published')))
    .orderBy(desc(compMatrixVersion.effectiveFrom))
    .limit(1);
  return v?.version ?? 'v2026.1';
}

export interface AssignableEmployee {
  id: string;
  name: string;
  email: string;
  hasGrade: boolean;
}

export async function listAssignableEmployees(tenantId: string): Promise<AssignableEmployee[]> {
  const users = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(and(eq(userTable.tenantId, tenantId), isNull(userTable.deletedAt), eq(userTable.disabled, false)));
  const grades = await db
    .select({ employeeId: compEmployeeGrade.employeeId })
    .from(compEmployeeGrade)
    .where(and(eq(compEmployeeGrade.tenantId, tenantId), isNull(compEmployeeGrade.effectiveTo)));
  const graded = new Set(grades.map((g) => g.employeeId));
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, hasGrade: graded.has(u.id) }));
}

export interface EmployeeGradeRow {
  employeeId: string;
  name: string;
  email: string;
  familyId: string;
  familyName: string;
  jobClass: string;
  currentLevel: string;
  taskGear: string;
  baseWageSnapshot: number;
}

export async function listEmployeeGrades(tenantId: string): Promise<EmployeeGradeRow[]> {
  const rows = await db
    .select({
      employeeId: compEmployeeGrade.employeeId,
      familyId: compEmployeeGrade.familyId,
      jobClass: compEmployeeGrade.jobClass,
      currentLevel: compEmployeeGrade.currentLevel,
      taskGear: compEmployeeGrade.taskGear,
      baseWageSnapshot: compEmployeeGrade.baseWageSnapshot,
      name: userTable.name,
      email: userTable.email,
      familyName: compJobFamily.name,
    })
    .from(compEmployeeGrade)
    .leftJoin(userTable, eq(userTable.id, compEmployeeGrade.employeeId))
    .leftJoin(compJobFamily, eq(compJobFamily.id, compEmployeeGrade.familyId))
    .where(and(eq(compEmployeeGrade.tenantId, tenantId), isNull(compEmployeeGrade.effectiveTo)));
  return rows.map((r) => ({
    employeeId: r.employeeId,
    name: r.name ?? r.employeeId,
    email: r.email ?? '',
    familyId: r.familyId,
    familyName: r.familyName ?? r.familyId,
    jobClass: r.jobClass,
    currentLevel: r.currentLevel,
    taskGear: r.taskGear,
    baseWageSnapshot: r.baseWageSnapshot,
  }));
}

export interface AssignInput {
  employeeId: string;
  familyId: string;
  jobClass: JobClass;
  level: CompLevel;
  taskGear: TaskGear;
  education?: string;
  experience?: string;
}

export async function assignGrade(tenantId: string, input: AssignInput): Promise<{ ok: true; baseWageSnapshot: number }> {
  const [fam] = await db
    .select()
    .from(compJobFamily)
    .where(and(eq(compJobFamily.tenantId, tenantId), eq(compJobFamily.id, input.familyId)))
    .limit(1);
  if (!fam) throw new Error('岗族不存在');

  const [band] = await db
    .select({ baseWage: compGradeBand.baseWage })
    .from(compGradeBand)
    .where(
      and(
        eq(compGradeBand.tenantId, tenantId),
        eq(compGradeBand.jobClass, input.jobClass),
        eq(compGradeBand.level, input.level),
      ),
    )
    .limit(1);
  const baseWageSnapshot = band?.baseWage ?? 0;
  const version = await currentVersion(tenantId);
  const id = gid(tenantId, input.employeeId);

  await db
    .insert(compEmployeeGrade)
    .values({
      id,
      tenantId,
      employeeId: input.employeeId,
      familyId: input.familyId,
      jobClass: input.jobClass,
      currentLevel: input.level,
      education: input.education ?? null,
      experience: input.experience ?? null,
      baseWageSnapshot,
      taskGear: input.taskGear,
      certifiedAgainstVersion: version,
    })
    .onConflictDoUpdate({
      target: compEmployeeGrade.id,
      set: {
        familyId: input.familyId,
        jobClass: input.jobClass,
        currentLevel: input.level,
        taskGear: input.taskGear,
        baseWageSnapshot,
        education: input.education ?? null,
        experience: input.experience ?? null,
        effectiveTo: null,
      },
    });

  return { ok: true, baseWageSnapshot };
}
