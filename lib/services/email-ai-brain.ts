/**
 * Tandem AI Email Brain · 企业邮箱智能沉淀与分析引擎
 * 
 * 性质: 宪章核心配套实现 — 将全量邮箱内容升级为企业 AI 的"长期记忆底座"与"战略扫描仪"。
 * 
 * 闭环逻辑 (飞轮 A+B):
 *   1. 提取 (Ingestion): 后台 Worker / Webhook 拉取到 EmailMessage。
 *   2. 消化 (Digestion): 经由 DeepSeek R1 进行摘要、情感提取、风险合规扫描（如泄密/飞单/严重客诉）。
 *   3. 规整 (Structuring): 抽取 Action Items (待办/死线)，存入 Origins 层，并建立与 OKR 的语义关联。
 *   4. 反哺 (Promotion): 识别为高价值的 SOP/案例后，自动触发 proposePromotion 进入三级签批，反哺中央大脑。
 */

import { audit } from '../audit/log';
import { getStore } from '../storage/repository';
import type { EmailMessage } from '../integrations/email-tier1';

export interface EmailActionItem {
  task: string;
  deadline?: string;
  owner?: string;
}

export interface SuggestedCalendarEvent {
  title: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endDate?: string;   // YYYY-MM-DD
  endTime?: string;   // HH:MM
  isAllDay?: boolean;
  type: 'meeting' | 'deadline' | 'reminder';
  location?: string;
  description?: string;
}

export interface EmailDigestResult {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'critical';
  keywords: string[];
  actionItems: EmailActionItem[];
  category: 'sop' | 'case' | 'lesson' | 'agreement' | 'operational';
  securityRiskDetected: boolean;
  riskDetails?: string;
  suggestedEvents?: SuggestedCalendarEvent[];
}

/**
 * 核心方法: 调用 AI 对邮件进行深度消化，提取结构化标签与风险指标
 */
export async function digestEmailMessage(
  email: EmailMessage,
  actorUserId: string
): Promise<EmailDigestResult> {
  const emailContent = `
发件人: ${email.from}
收件人: ${email.to.join(', ')}
日期: ${email.date}
主题: ${email.subject}
正文:
${email.textBody || email.htmlBody || '(无正文)'}
`;

  const systemPrompt = `
你是一个部署在企业私有云内部的 Tandem AI 邮件中枢脑。
你负责审计、分析并总结企业往来邮件，为组织提取隐性知识与行动项。
请严格输出 JSON 格式，不要包含 Markdown 代码块（如 \`\`\`json\`），直接以 { 开始，以 } 结束。
JSON 字段必须为：
{
  "summary": "不超过150字的精简摘要",
  "sentiment": "positive" | "neutral" | "negative" | "critical" (严重客诉/冲突/危机选 critical),
  "keywords": ["关键词1", "关键词2"],
  "category": "sop" (流程规范) | "case" (历史案例) | "lesson" (教训反思) | "agreement" (协议共识) | "operational" (日常事务),
  "actionItems": [
    { "task": "具体待办描述", "deadline": "格式为 YYYY-MM-DD，若无写 null", "owner": "预计负责人邮箱，若无写 null" }
  ],
  "securityRiskDetected": false,
  "riskDetails": "检测到风险的简要细节，若无写 null",
  "suggestedEvents": [
    { "title": "会议或截止日标题", "startDate": "YYYY-MM-DD", "startTime": "HH:MM(可选)", "endDate": "YYYY-MM-DD(可选)", "endTime": "HH:MM(可选)", "isAllDay": false, "type": "meeting" | "deadline" | "reminder", "location": "地点(可选)", "description": "描述(可选)" }
  ]
}

suggestedEvents 规则：
- 如果邮件中明确提到了会议时间、截止日、提醒事项，提取出来
- 会议 type=meeting, 截止日 type=deadline, 提醒 type=reminder
- 无时间信息则 suggestedEvents 为空数组 []
- 不要编造不存在的时间
`;

  try {
    // 导入 TAF 路由器
    const { createDefaultRouter } = await import('../taf');
    const router = createDefaultRouter();

    const response = await router.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: emailContent },
      ],
      scenario: 'reasoning_complex',
    });

    const content = response.message.content;
    const text = typeof content === 'string' ? content : '{}';
    const digest: EmailDigestResult = JSON.parse(text);

    return {
      summary: digest.summary || '无摘要',
      sentiment: digest.sentiment || 'neutral',
      keywords: digest.keywords || [],
      category: digest.category || 'operational',
      actionItems: digest.actionItems || [],
      securityRiskDetected: !!digest.securityRiskDetected,
      riskDetails: digest.riskDetails || undefined,
      suggestedEvents: digest.suggestedEvents || [],
    };
  } catch (err) {
    // LLM 调用失败兜底
    return {
      summary: `[兜底摘要] 邮件主题: ${email.subject}`,
      sentiment: 'neutral',
      keywords: ['邮件', '待处理'],
      category: 'operational',
      actionItems: [],
      securityRiskDetected: false,
      suggestedEvents: [],
    };
  }
}

/**
 * 闭环归档: 将邮件写入 Origins 原始材料层，并在必要时自动提议升级为中央 Memory
 */
export async function ingestEmailIntoCorporateMemory(
  email: EmailMessage,
  digest: EmailDigestResult,
  ownerId: string
): Promise<{ originId: string; promotionId?: string }> {
  const store = getStore();
  const now = new Date().toISOString();

  // 1) 写入原始物料 Material (作为知识的基座 Origins/Materials)
  const material = await store.materials.create({
    type: 'project_doc', // 暂用 project_doc 作为存储类型，标明来源为邮件
    title: `[邮件归档] ${email.subject}`,
    body: {
      source: 'email',
      uid: email.uid,
      from: email.from,
      to: email.to,
      date: email.date,
      text: email.textBody || email.htmlBody || '',
      digest,
    },
    originRefs: [`email:${email.uid}`],
    participants: [ownerId],
    visibility: 'team' as const,
    createdBy: ownerId,
    createdAt: now,
    updatedAt: now,
  });

  // 2) 风险与异常审计 (Steward 一秒卡点)
  if (digest.sentiment === 'critical' || digest.securityRiskDetected) {
    await audit('email.security_conflict_detected', ownerId, {
      targetId: material.id,
      targetType: 'material',
      metadata: {
        subject: email.subject,
        sentiment: digest.sentiment,
        riskDetails: digest.riskDetails,
        from: email.from,
      },
    });
  }

  // 3) 飞轮反哺自动触发 (飞轮 A 闭环): 如果识别为高价值的 SOP、案例、反思，自动提交 Propose 升级
  let promotionId: string | undefined;
  if (['sop', 'case', 'lesson', 'agreement'].includes(digest.category)) {
    try {
      const { proposePromotion } = await import('../memory/promotion-flow');
      const promotion = await proposePromotion({
        materialId: material.id,
        proposedType: digest.category as any,
        proposedTitle: email.subject,
        proposedBody: `【邮件 AI 归档摘要】\n${digest.summary}\n\n【提取关键词】\n${digest.keywords.join(', ')}\n\n【邮件原文摘要】\n${(email.textBody || '').slice(0, 500)}`,
        proposerId: ownerId,
        level: 'dept', // 默认推荐部门级，由部门领导与 Steward 审阅后，正式沉淀
      });
      promotionId = promotion.id;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[email-brain] Auto-promotion trigger failed:', err);
    }
  }

  return { originId: material.id, promotionId };
}
