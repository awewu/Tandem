/**
 * P3 前沿升级单测 · 纯函数部分 (IPIGUARD DAG 校验/环检测)
 * 注: PaCoRe / Agent Teams 是编排层 (需真 LLM/store), 属 backlog 级 opt-in, 此处只测 DAG 确定性核心。
 */
import { describe, it, expect } from 'vitest';
import { validateDagStep, hasCycle, type ToolDag } from '@/lib/agent-runtime/tool-dag';

describe('P3 #21 IPIGUARD 工具 DAG', () => {
  const dag: ToolDag = {
    nodes: [
      { tool: 'okr.read', dependsOn: [], readOnly: true },
      { tool: 'kr.checkin', dependsOn: ['okr.read'], readOnly: false },
    ],
  };

  it('前置未满足 → 拒绝', () => {
    const v = validateDagStep(dag, 'kr.checkin', []);
    expect(v.allowed).toBe(false);
    expect(v.missingDeps).toContain('okr.read');
  });

  it('前置已满足 → 放行', () => {
    const v = validateDagStep(dag, 'kr.checkin', ['okr.read']);
    expect(v.allowed).toBe(true);
  });

  it('无依赖节点 → 直接放行', () => {
    expect(validateDagStep(dag, 'okr.read', []).allowed).toBe(true);
  });

  it('不在 DAG 内 + 允许只读扩展 → 放行 (node expansion)', () => {
    const v = validateDagStep(dag, 'memory.search', [], { allowReadOnlyExpansion: true });
    expect(v.allowed).toBe(true);
    expect(v.reason).toContain('node expansion');
  });

  it('不在 DAG 内 + 禁止扩展 → 拒绝', () => {
    const v = validateDagStep(dag, 'memory.search', [], { allowReadOnlyExpansion: false });
    expect(v.allowed).toBe(false);
  });

  it('名称宽松匹配 (子串)', () => {
    const v = validateDagStep(dag, 'kr.checkin', ['okr_read']);
    expect(v.allowed).toBe(true);
  });

  it('hasCycle: 无环 DAG → false', () => {
    expect(hasCycle(dag)).toBe(false);
  });

  it('hasCycle: 有环 → true', () => {
    const cyclic: ToolDag = {
      nodes: [
        { tool: 'a', dependsOn: ['b'] },
        { tool: 'b', dependsOn: ['a'] },
      ],
    };
    expect(hasCycle(cyclic)).toBe(true);
  });
});
