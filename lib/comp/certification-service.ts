/**
 * 技能认证服务 (PRD §5.2A) — 直连 typed 表
 *
 * 员工提交认证申请 (案例佐证/证书) → HR 审批 (通过/驳回)。
 * 认证锁定矩阵版本 (certifiedAgainstVersion), 不溯及既往。
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../infra/drizzle-client';
import {
  compGradeCertification,
  compMatrixVersion,
  compSkillDef,
} from '../infra/drizzle-schema';
import { audit } from '../audit/log';

export type CertificationStatus = '待认证' | '已认证' | '已驳回';

export interface SubmitCertificationInput {
  tenantId: string;
  employeeId: string;
  familyId: string;
  skillId: string;
  evidence: string;
}

export interface CertificationRow {
  id: string;
  employeeId: string;
  familyId: string;
  skillId: string;
  skillName: string;
  status: string;
  evidence: string | null;
  certifiedAt: Date | null;
  certifiedAgainstVersion: string;
}

/** 获取当前 published 版本 (无则取最新) */
async function currentVersionId(tenantId: string): Promise<string> {
  const rows = await db
    .select()
    .from(compMatrixVersion)
    .where(eq(compMatrixVersion.tenantId, tenantId));
  const published = rows.find((r) => r.status === 'published');
  if (published) return published.id;
  return rows[0]?.id ?? 'v1';
}

/** 列出某员工全部认证记录, 附技能名 */
export async function listCertifications(
  tenantId: string,
  employeeId: string,
  status?: CertificationStatus,
): Promise<CertificationRow[]> {
  const certRows = await db
    .select()
    .from(compGradeCertification)
    .where(
      and(
        eq(compGradeCertification.tenantId, tenantId),
        eq(compGradeCertification.employeeId, employeeId),
      ),
    );

  const filtered = status
    ? certRows.filter((r) => r.status === status)
    : certRows;

  const skillIds = Array.from(new Set(filtered.map((r) => r.skillId)));
  const skills = skillIds.length
    ? await db
        .select()
        .from(compSkillDef)
        .where(
          and(
            eq(compSkillDef.tenantId, tenantId),
            eq(compSkillDef.familyId, filtered[0]?.familyId ?? ''),
          ),
        )
    : [];
  const skillMap = new Map(skills.map((s) => [s.id, s.name]));

  return filtered.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    familyId: r.familyId,
    skillId: r.skillId,
    skillName: skillMap.get(r.skillId) ?? r.skillId,
    status: r.status,
    evidence: r.evidence,
    certifiedAt: r.certifiedAt,
    certifiedAgainstVersion: r.certifiedAgainstVersion,
  }));
}

/** 列出待审批的认证 (HR 用) */
export async function listPendingCertifications(
  tenantId: string,
): Promise<CertificationRow[]> {
  const rows = await db
    .select()
    .from(compGradeCertification)
    .where(
      and(
        eq(compGradeCertification.tenantId, tenantId),
        eq(compGradeCertification.status, '待认证'),
      ),
    );

  const skillIds = Array.from(new Set(rows.map((r) => r.skillId)));
  const skills = skillIds.length
    ? await db
        .select()
        .from(compSkillDef)
        .where(eq(compSkillDef.tenantId, tenantId))
    : [];
  const skillMap = new Map(skills.map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    familyId: r.familyId,
    skillId: r.skillId,
    skillName: skillMap.get(r.skillId) ?? r.skillId,
    status: r.status,
    evidence: r.evidence,
    certifiedAt: r.certifiedAt,
    certifiedAgainstVersion: r.certifiedAgainstVersion,
  }));
}

/** 按矩阵版本查询认证历史 (版本快照追溯) */
export async function listCertificationsByVersion(
  tenantId: string,
  versionId: string,
  employeeId?: string,
): Promise<CertificationRow[]> {
  const conditions = [
    eq(compGradeCertification.tenantId, tenantId),
    eq(compGradeCertification.certifiedAgainstVersion, versionId),
  ];
  if (employeeId) {
    conditions.push(eq(compGradeCertification.employeeId, employeeId));
  }

  const rows = await db
    .select()
    .from(compGradeCertification)
    .where(and(...conditions));

  const skillIds = Array.from(new Set(rows.map((r) => r.skillId)));
  const skills = skillIds.length
    ? await db
        .select()
        .from(compSkillDef)
        .where(eq(compSkillDef.tenantId, tenantId))
    : [];
  const skillMap = new Map(skills.map((s) => [s.id, s.name]));

  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    familyId: r.familyId,
    skillId: r.skillId,
    skillName: skillMap.get(r.skillId) ?? r.skillId,
    status: r.status,
    evidence: r.evidence,
    certifiedAt: r.certifiedAt,
    certifiedAgainstVersion: r.certifiedAgainstVersion,
  }));
}

/** 员工提交认证申请 */
export async function submitCertification(
  input: SubmitCertificationInput,
): Promise<{ id: string }> {
  const versionId = await currentVersionId(input.tenantId);
  const id = `cert_${input.tenantId}_${input.employeeId}_${input.skillId}_${versionId}`;

  await db
    .insert(compGradeCertification)
    .values({
      id,
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      familyId: input.familyId,
      skillId: input.skillId,
      status: '待认证',
      evidence: input.evidence,
      certifiedAgainstVersion: versionId,
    })
    .onConflictDoUpdate({
      target: compGradeCertification.id,
      set: {
        evidence: input.evidence,
        status: '待认证',
      },
    });

  await audit('comp.certification_submitted', input.employeeId, {
    targetId: id,
    targetType: 'comp_grade_certification',
    tenantId: input.tenantId,
    metadata: { skillId: input.skillId },
  });

  return { id };
}

/** HR 审批认证 (通过/驳回) */
export async function reviewCertification(
  tenantId: string,
  certId: string,
  approved: boolean,
  reviewerId: string,
): Promise<void> {
  const status: CertificationStatus = approved ? '已认证' : '已驳回';
  await db
    .update(compGradeCertification)
    .set({
      status,
      certifiedAt: approved ? new Date() : null,
    })
    .where(
      and(
        eq(compGradeCertification.tenantId, tenantId),
        eq(compGradeCertification.id, certId),
      ),
    );

  await audit(
    approved ? 'comp.certification_approved' : 'comp.certification_rejected',
    reviewerId,
    {
      targetId: certId,
      targetType: 'comp_grade_certification',
      tenantId,
    },
  );
}
