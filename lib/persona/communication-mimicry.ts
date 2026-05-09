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

  const router = getRouter();
  const styleHint = describeStyle(persona.styleProfile);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是 ${input.userId} 的沟通分身. 任务: 用其个人风格起草 ${input.context}.

风格特征:
${styleHint}

近期沟通示例:
${persona.styleProfile.communicationExamples.slice(0, 5).join('\n---\n')}

规则:
- 严格模仿语气 + 用词 + 句式
- 长度匹配场景 (chat 短 / email 中 / decision 详细)
- 输出纯文本, 不带任何 "AI 生成" 字样 (水印由系统自动添加)`,
    },
    {
      role: 'user',
      content: `场景: ${input.context}
受众: ${input.audience ?? '(未指定)'}
话题: ${input.topic}

请起草.`,
    },
  ];

  const res = await router.chat({
    scenario: 'persona_dialogue',
    temperature: 0.6,
    messages,
  });

  const draftText = typeof res.message.content === 'string' ? res.message.content : '';

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
