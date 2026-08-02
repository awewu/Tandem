/**
 * lib/agent-runtime/agent-team.ts · P3 #20 Agent Teams 多 agent 协作
 *
 * 前沿 (Claude Code Agent Teams, Anthropic 2026): 复杂任务拆成**按技术域**分工的多个
 * subagent (各自独立 context, 结果汇报回主 agent), 而非按业务角色分。适合有依赖的协作。
 *
 * TandemAI 翻译 (hierarchical topology 的落地): 把一个复杂任务分解为若干**独立子任务**,
 * 每个子任务用一次 runToolLoop 独立收集/推理 (隔离 context), 最后 lead 综合。
 *
 * 诚实边界 (backlog 级, 默认不接主链路): token 成本 ~Nx + 编排复杂度。仅在**显式复杂任务**用。
 * fail-soft: 任一子 agent 失败不影响其余; 全失败返回错误说明。
 */

import { runToolLoop, type ToolLoopResult } from './tool-loop';
import { logger } from '@/lib/infra/logger';
import type { ScenarioTag } from '@/lib/taf/provider/types';

export interface TeamMember {
  /** 成员名 (技术/职能域, 如 data_collection / analysis / recommendation) */
  name: string;
  /** 该成员的系统提示 (职责定义) */
  systemPrompt: string;
  /** 该成员可用的只读工具白名单 */
  toolset: string[];
  /** 分配给该成员的子任务 (由 lead 分解得到) */
  subtask: string;
}

export interface AgentTeamInput {
  /** 顶层任务 */
  task: string;
  /** 团队成员 (2-4 个; 各自独立 context) */
  members: TeamMember[];
  /** lead 综合用的系统提示 */
  leadSystemPrompt: string;
  actorUserId: string;
  isProxy?: boolean;
  tenantId?: string;
  scenario?: ScenarioTag;
  maxRoundsPerMember?: number;
  maxTokensPerMember?: number;
  feature?: string;
}

export interface AgentTeamResult {
  /** lead 综合后的最终交付 */
  deliverable: string;
  /** 各成员子结果 (观测/调试) */
  members: Array<{ name: string; subtask: string; result: ToolLoopResult }>;
  totalTokensUsed: number;
  totalLatencyMs: number;
}

/**
 * 运行 agent team: 各成员独立并行跑子任务, lead 综合。opt-in, 成本 ~Nx。
 */
export async function runAgentTeam(input: AgentTeamInput): Promise<AgentTeamResult> {
  const members = input.members.slice(0, 4);
  const started = Date.now();

  const settled = await Promise.allSettled(
    members.map((m) =>
      runToolLoop({
        systemPrompt: m.systemPrompt,
        userQuery: m.subtask,
        toolset: m.toolset,
        scenario: input.scenario ?? 'tool_use',
        actorUserId: input.actorUserId,
        isProxy: input.isProxy ?? false,
        tenantId: input.tenantId ?? 'default',
        maxRounds: input.maxRoundsPerMember ?? 4,
        maxTokens: input.maxTokensPerMember ?? 900,
        feature: input.feature ? `${input.feature}.team_${m.name}` : `team_${m.name}`,
      }),
    ),
  );

  const memberResults: AgentTeamResult['members'] = [];
  let totalTokensUsed = 0;
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === 'fulfilled') {
      memberResults.push({ name: members[i].name, subtask: members[i].subtask, result: s.value });
      totalTokensUsed += s.value.totalTokensUsed;
    } else {
      logger.warn({ member: members[i].name, err: String(s.reason) }, '[agent-team] member failed (fail-soft)');
    }
  }

  if (memberResults.length === 0) {
    return {
      deliverable: '(团队各成员均失败, 无法综合交付。)',
      members: [],
      totalTokensUsed,
      totalLatencyMs: Date.now() - started,
    };
  }

  // lead 综合各成员产出为最终交付
  let deliverable = memberResults.map((m) => `【${m.name}】${m.result.finalMessage}`).join('\n\n');
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();
    const block = memberResults
      .map((m) => `## ${m.name} (子任务: ${m.subtask})\n${m.result.finalMessage}`)
      .join('\n\n');
    const reply = await router.chat({
      messages: [
        { role: 'system', content: `${input.leadSystemPrompt}\n\n你是团队 lead。下面是各成员对分工子任务的独立产出。请综合成一份连贯、去重、可执行的最终交付。` },
        { role: 'user', content: `顶层任务: ${input.task}\n\n成员产出:\n${block}\n\n最终交付:` },
      ],
      scenario: input.scenario ?? 'reasoning_complex',
      maxTokens: input.maxTokensPerMember ?? 1200,
      metadata: { userId: input.actorUserId, feature: input.feature ? `${input.feature}.team_lead` : 'team_lead' },
    });
    const text = typeof reply.message.content === 'string' ? reply.message.content : '';
    if (text.trim()) deliverable = text;
    totalTokensUsed += reply.usage?.totalTokens ?? 0;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[agent-team] lead synthesis failed, returning concatenated results');
  }

  return {
    deliverable,
    members: memberResults,
    totalTokensUsed,
    totalLatencyMs: Date.now() - started,
  };
}
