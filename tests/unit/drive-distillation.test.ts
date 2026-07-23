/**
 * 组织云盘蒸馏扫描单测 (lib/drive/distillation.ts)
 *
 * 覆盖: 只扫共享面 (owner-only 跳过) / 文件夹跳过 / distillable=false 跳过 /
 *       幂等 (已有 pending 候选不重复) / 类型启发式推断。
 */
import { describe, it, expect } from 'vitest';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import type { DriveDistillationCandidate } from '@/lib/types/drive-distillation';
import { scanDistillableFiles, inferMemoryType } from '@/lib/drive/distillation';

function f(p: Partial<DriveFile> & { id: string }): DriveFile {
  const ts = '2026-01-01T00:00:00.000Z';
  return {
    id: p.id,
    name: p.name ?? p.id,
    mimeType: p.isFolder ? 'application/x-directory' : 'text/plain',
    size: p.size ?? 10,
    parentId: p.parentId ?? null,
    ownerId: p.ownerId ?? 'u_owner',
    tenantId: 'default',
    storageKey: p.storageKey ?? 'k',
    storageUrl: null,
    permissions: p.permissions ?? {},
    version: 1,
    isFolder: p.isFolder ?? false,
    nodeRole: p.nodeRole ?? null,
    distillable: p.distillable,
    createdAt: ts,
    updatedAt: ts,
  };
}

function makeDeps(files: DriveFile[], seed: DriveDistillationCandidate[] = []) {
  const candidates: DriveDistillationCandidate[] = [...seed];
  let n = 0;
  return {
    candidates,
    deps: {
      tenantId: 'default',
      listFiles: async () => files,
      listCandidates: async () => candidates,
      createCandidate: async (c: Omit<DriveDistillationCandidate, 'id'>) => {
        const created = { ...c, id: `cand_${++n}` };
        candidates.push(created);
        return created;
      },
      now: () => '2026-02-02T00:00:00.000Z',
    },
  };
}

describe('inferMemoryType', () => {
  it('按关键词推断; 默认 sop; 不自动 redline/value', () => {
    expect(inferMemoryType('销售规范.pdf')).toBe('sop');
    expect(inferMemoryType('客户案例.docx')).toBe('case');
    expect(inferMemoryType('Q1事故复盘.md')).toBe('lesson');
    expect(inferMemoryType('随手记.txt')).toBe('sop');
  });
});

describe('scanDistillableFiles', () => {
  it('共享文件产候选, owner-only 跳过, 文件夹跳过', async () => {
    const files = [
      f({ id: 'sharedDept', name: '销售规范.pdf', permissions: { read: ['dept:dept_a'] } }),
      f({ id: 'sharedAll', name: '公司手册.pdf', permissions: { read: ['all'] } }),
      f({ id: 'privateFile', name: '我的草稿.txt', permissions: { read: ['user:u_owner'] } }),
      f({ id: 'noPerm', name: '无权限继承.txt', permissions: {} }), // 继承空 = owner-only
      f({ id: 'folder', name: '文件夹', isFolder: true, permissions: { read: ['all'] } }),
    ];
    const { deps } = makeDeps(files);
    const r = await scanDistillableFiles(deps);
    const names = r.created.map((c) => c.sourceFileId).sort();
    expect(names).toEqual(['sharedAll', 'sharedDept']);
    expect(r.created.every((c) => c.status === 'pending')).toBe(true);
  });

  it('继承: 子文件继承父目录的 dept 共享 → 被扫', async () => {
    const files = [
      f({ id: 'deptRoot', name: 'A部门', isFolder: true, permissions: { read: ['dept:dept_a'] } }),
      f({ id: 'child', name: '流程文档.md', parentId: 'deptRoot', permissions: {} }),
    ];
    const { deps } = makeDeps(files);
    const r = await scanDistillableFiles(deps);
    expect(r.created.map((c) => c.sourceFileId)).toEqual(['child']);
  });

  it('distillable=false 跳过', async () => {
    const files = [f({ id: 'x', name: '规范.pdf', permissions: { read: ['all'] }, distillable: false })];
    const { deps } = makeDeps(files);
    const r = await scanDistillableFiles(deps);
    expect(r.created).toHaveLength(0);
    expect(r.skipped).toBe(1);
  });

  it('幂等: 已有 pending/promoted 候选的文件不重复; dismissed 可重扫', async () => {
    const files = [
      f({ id: 'a', name: '规范A.pdf', permissions: { read: ['all'] } }),
      f({ id: 'b', name: '规范B.pdf', permissions: { read: ['all'] } }),
    ];
    const seed: DriveDistillationCandidate[] = [
      { id: 'c1', tenantId: 'default', sourceFileId: 'a', sourceFileName: '规范A.pdf', suggestedType: 'sop', suggestedTitle: 'A', suggestedBody: '', rationale: '', status: 'pending', createdAt: '', updatedAt: '' },
      { id: 'c2', tenantId: 'default', sourceFileId: 'b', sourceFileName: '规范B.pdf', suggestedType: 'sop', suggestedTitle: 'B', suggestedBody: '', rationale: '', status: 'dismissed', createdAt: '', updatedAt: '' },
    ];
    const { deps } = makeDeps(files, seed);
    const r = await scanDistillableFiles(deps);
    // a 已 pending → 跳; b 是 dismissed → 可重扫
    expect(r.created.map((c) => c.sourceFileId)).toEqual(['b']);
  });
});
