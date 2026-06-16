/**
 * Communication Mimicry · 沟通风格模仿
 *
 * 在 Persona 进入 deputy / partner 阶段时启用.
 *
 * 流程:
 *   1. 收集老板近 30 天 IM 消息 + 邮件 + 议事室发言 (ORIGIN 层)
 *   2. LLM 抽取风格特征 (语气, 用词, 句式, 决策模式)
 *   3. 生成代发草稿时使用风格 prompt
 *   4. 任何代发都打水印 (isProxy=true, proxyType='persona')
 *   5. 24h 否决窗口 (员工本人可撤回)
 *
 * 反 AI 欺诈守门:
 *   - 用户主动 opt-in 才启用
 *   - 任何代发先邮件提醒员工本人
 *   - 高敏内容 (薪资 / 投诉 / 法律) → 强制员工亲自处理
 */

import { getStore } from '../storage/repository';
import { getRouter } from '../boot';
import type { StyleProfile } from '../types/persona';
import type { ChatMessage } from '../taf/provider/types';

export interface MimicryInput {
  userId: string;
  /** 触发场景: chat / email / meeting / decision */
  context: 'chat' | 'email' | 'meeting' | 'decision';
  /** 原始话题 / 提示 */
  topic: string;
  /** 收件人 / 受众 (用于调整语气) */
  audience?: string;
  /** 是否高敏 (强制 opt-out) */
  sensitive?: boolean;
}

export interface MimicryDraft {
  draftText: string;
  styleNotes: string[];
  watermark: { isProxy: true; proxyType: 'persona'; proxyForUserId: string; proxySignedAt: string };
  /** 强制需要员工本人审核 */
  requiresHumanApproval: true;
}

export const SENSITIVE_KEYWORDS = [
  '薪资',
  '工资',
  '奖金',
  '裁员',
  '辞退',
  '法律',
  '诉讼',
  '客户投诉',
  '股权',
  'salary',
  'fire',
  'lawsuit',
];

export async function mimicCommunication(input: MimicryInput): Promise<MimicryDraft> {
  // 高敏直接拒绝
  const isSensitive =
    input.sensitive ||
    SENSITIVE_KEYWORDS.some((kw) => input.topic.toLowerCase().includes(kw.toLowerCase()));
  if (isSensitive) {
    throw new Error('高敏内容禁止 AI 代笔, 请员工本人处理');
  }

  const store = getStore();
  const list = await store.personas.list({ userId: input.userId } as never);
  const persona = list[0];
  if (!persona) throw new Error(`Persona for ${input.userId} not found`);

  if (persona.stage !== 'deputy' && persona.stage !== 'partner') {
    throw new Error(`Persona stage ${persona.stage} 不允许风格模仿, 至少 deputy 阶段`);
  }

  // §T15 baseline-guard: 代行沟通必须经组织记忆基线校验
  let baselineContext = '';
  try {
    const { checkBaseline } = await import('../memory/baseline-guard');
    const guard = await checkBaseline({
      intent: `代行沟通(${input.context}): ${input.topic}`,
      actorUserId: input.userId,
      agentKind: 'persona',
      toolName: 'persona.communication-mimicry',
      payload: { context: input.context, audience: input.audience },
    });
    if (guard.verdict === 'HARD_BLOCK') {
      // 通知治理委员会
      try {
        const { emit } = await import('../workflows/engine');
        await emit({
          type: 'workflow.custom',
          payload: {
            customType: 'persona.mimicry.blocked',
            actorUserId: input.userId,
            context: input.context,
            topic: input.topic,
            reason: guard.reasons.join('; '),
            hits: guard.hits.slice(0, 5).map((h) => ({
              memoryId: h.memoryId,
              title: h.title,
              ownershipLevel: h.ownershipLevel,
            })),
            checkId: guard.checkId,
          },
        });
      } catch {
        /* workflow 失败不再升级, baseline-guard 已 audit */
      }
      const hitTitles = guard.hits.slice(0, 3).map((h) => h.title).join(', ') || '未指明';
      throw new Error(
        `代行沟通被组织记忆基线阻断 (checkId: ${guard.checkId}). 命中: ${hitTitles}. 请员工本人处理.`
      );
    }
    if (guard.verdict === 'SOFT_WARN' && guard.contextToInject) {
      baselineContext = guard.contextToInject;
    }
  } catch (err) {
    // 如果 err 是基线阻断本身, 透传; 否则 fail-open (记日志, 不阻断)
    if (err instanceof Error && err.message.includes('基线阻断')) throw err;
    // eslint-disable-next-line no-console
    console.warn('[mimicry] baseline-guard 调用失败, fail-open:', (err as Error).message);
  }

  const router = getRouter();
  const styleHint = describeStyle(persona.styleProfile);

  const systemBase = `你是 ${input.userId} 的沟通分身. 任务: 用其个人风格起草 ${input.context}.

风格特征:
${styleHint}

近期沟通示例:
${persona.styleProfile.communicationExamples.slice(0, 5).join('\n---\n')}

规则:
- 严格模仿语气 + 用词 + 句式
- 长度匹配场景 (chat 短 / email 中 / decision 详细)
- 输出纯文本, 不带任何 "AI 生成" 字样 (水印由系统自动添加)`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: baselineContext
        ? `${baselineContext}\n\n---\n\n${systemBase}\n- 必须遵守上方的组织记忆基线`
        : systemBase,
    },
    {
      role: 'user',
      content: `场景: ${input.context}
受众: ${input.audience ?? '(未指定)'}
话题: ${input.topic}

请起草.`,
    },
  ];

  // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: communication-mimicry 是风格模仿辅助函数，被 governedChat 上游调用；迁移会造成套娃
  const res = await router.chat({
    scenario: 'persona_dialogue',
    temperature: 0.6,
    messages,
  });

  const draftText = typeof res.message.content === 'string' ? res.message.content : '';

  // 写入统一 ProxyAction (drafted: 等员工确认才发出)
  try {
    const { createProxyAction } = await import('./proxy-actions');
    await createProxyAction({
      userId: input.userId,
      personaId: persona.id,
      tenantId: 'default',
      kind: 'communication',
      zone: 'yellow',
      title: `[草稿] ${input.context} · ${input.topic}`,
      body: draftText,
      refType: 'communication',
      initialStatus: 'drafted',
      metadata: { audience: input.audience, context: input.context, topic: input.topic },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[mimicry] failed to record ProxyAction', err);
  }

  return {
    draftText,
    styleNotes: ['基于近 30 天通讯记录', `风格: ${persona.styleProfile.communicationStyle}`],
    watermark: {
      isProxy: true,
      proxyType: 'persona',
      proxyForUserId: input.userId,
      proxySignedAt: new Date().toISOString(),
    },
    requiresHumanApproval: true,
  };
}

function describeStyle(style: StyleProfile): string {
  return [
    `决策速度: ${style.decisionSpeed}`,
    `风险偏好: ${(style.riskAppetite * 100).toFixed(0)}%`,
    `沟通风格: ${style.communicationStyle}`,
    `偏好选项: ${style.preferredOptions.slice(-5).join(', ')}`,
  ].join('\n');
}
