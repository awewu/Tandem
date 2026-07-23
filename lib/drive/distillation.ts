/**
 * 组织云盘 · AI 蒸馏扫描 (Phase D)
 *
 * 只扫【共享面】的工作文件 (有效 read 含 dept:/ministry:/role:/all), 显式跳过
 * owner-only 的 personal_home 内容 (尊重"仅本人可见"默认)。产出"蒸馏候选"草稿,
 * 供真人审阅后走 promotion-flow (proposer=本人)。AI 永不作 proposer (宪章 Rule A)。
 *
 * 纯逻辑 + 依赖注入 → 可独立单测, 不绑定 DB。
 */
import type { DriveFile } from '@/lib/types/feishu-catchup';
import type { MemoryType } from '@/lib/types/memory';
import type { DriveDistillationCandidate } from '@/lib/types/drive-distillation';
import { buildAncestorChain, resolveEffectivePermissions } from './acl';

export interface DistillationDeps {
  tenantId: string;
  listFiles: () => Promise<DriveFile[]>;
  listCandidates: () => Promise<DriveDistillationCandidate[]>;
  createCandidate: (c: Omit<DriveDistillationCandidate, 'id'>) => Promise<DriveDistillationCandidate>;
  now?: () => string;
}

export interface DistillationScanResult {
  created: DriveDistillationCandidate[];
  scanned: number;
  skipped: number;
}

/** 是否"共享面": 有效 read 含 all 或任一 dept:/ministry:/role: 主体 (owner-only 不算)。 */
function isShared(read: Set<string>): boolean {
  if (read.has('all')) return true;
  let shared = false;
  read.forEach((p) => {
    if (p.startsWith('dept:') || p.startsWith('ministry:') || p.startsWith('role:')) shared = true;
  });
  return shared;
}

/** 按文件名启发式推断记忆类型 (redline/value 属宪法级, 不自动推断以免误升级)。 */
export function inferMemoryType(name: string): MemoryType {
  if (/复盘|教训|lesson|retro|事故|故障/i.test(name)) return 'lesson';
  if (/案例|case|方案|复用/i.test(name)) return 'case';
  if (/规范|标准|流程|sop|制度|手册|指南/i.test(name)) return 'sop';
  return 'sop';
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/**
 * 扫描并产出蒸馏候选 (幂等: 已有 pending/promoted 候选的文件跳过)。
 */
export async function scanDistillableFiles(deps: DistillationDeps): Promise<DistillationScanResult> {
  const now = deps.now ?? (() => new Date().toISOString());
  const all = (await deps.listFiles()).filter((f) => !f.deletedAt);
  const byId = new Map(all.map((f) => [f.id, f]));

  const existing = await deps.listCandidates();
  const coveredFileIds = new Set(
    existing.filter((c) => c.status !== 'dismissed').map((c) => c.sourceFileId),
  );

  const created: DriveDistillationCandidate[] = [];
  let scanned = 0;
  let skipped = 0;

  for (const f of all) {
    if (f.isFolder) continue;
    if (f.distillable === false) { skipped++; continue; }
    const { read } = resolveEffectivePermissions(buildAncestorChain(f.id, byId));
    if (!isShared(read)) { skipped++; continue; } // owner-only / 私密工作内容 → 跳过
    if (coveredFileIds.has(f.id)) { skipped++; continue; }

    scanned++;
    const title = stripExt(f.name);
    const type = inferMemoryType(f.name);
    const ts = now();
    const candidate = await deps.createCandidate({
      tenantId: deps.tenantId,
      sourceFileId: f.id,
      sourceFileName: f.name,
      suggestedType: type,
      suggestedTitle: title,
      suggestedBody:
        `> 蒸馏候选 (AI 草稿, 请审阅补全后再提议入库)\n\n` +
        `来源: 工作云盘《${f.name}》\n\n` +
        `请提炼可复用的${type === 'lesson' ? '教训' : type === 'case' ? '案例' : 'SOP/规范'}要点:\n` +
        `- \n- \n- \n`,
      rationale: `该文件已在组织内共享 (非仅本人可见), 可能含可沉淀为组织记忆的工作产出。`,
      status: 'pending',
      promotionId: null,
      reviewedBy: null,
      createdAt: ts,
      updatedAt: ts,
    });
    created.push(candidate);
  }

  return { created, scanned, skipped };
}
