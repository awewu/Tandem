/**
 * PMS 只读感知 skills · 中央 AI 的"销售之眼" (S1)
 *
 * 破除"中央 AI 感知不到销售真值"的 CRM 孤岛: 让中央 AI 按需查全公司销售管道/项目
 * 健康度 + 最紧急异常, 走 cockpit 同一真值装配 (assembleCockpit, company scope),
 * 而非静态文本。镜像 lib/taf/skills/builtin.ts 的 okr.health_digest "眼睛"模式。
 *
 * 纪律: 绿区 · 代行允许 · 纯只读 (不写任何业务真值)。
 *
 * 接线 (待完成, 见文件末尾 TODO):
 *   1. builtin.ts registerBuiltinSkills() 注册 PmsPipelineDigestSkill
 *   2. company-brain-perception.ts PERCEPTION_TOOLSET 加 'pms.pipeline_digest'
 */

import type { Skill } from './registry';

export const PmsPipelineDigestSkill: Skill<{ limit?: number }, unknown> = {
  id: 'pms.pipeline_digest',
  description:
    '全公司销售(PMS)管道与项目健康速览: 加权管道/赢单率/赢单额 + 最紧急的销售/财务异常 (停滞项目/招标临近/spec-in被替换风险/合同审批积压/业绩目标缺口), 用于"销售盘子怎么样/哪些项目在流血"',
  tags: ['pms', '销售', '商机', '管道', '项目', '赢单率', '异常', '经销商', '招投标'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 400,
  schema: {
    type: 'function',
    function: {
      name: 'pms_pipeline_digest',
      description: '查全公司销售管道与项目异常健康度 (加权管道/赢单率/赢单额 + 最紧急的销售与财务异常)',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回异常条数 (默认 8)' },
        },
      },
    },
  },
  async execute({ limit = 8 }, ctx) {
    const { assembleCockpit } = await import('../../pms/cockpit-service');
    const c = await assembleCockpit({ tenantId: ctx.tenantId, scope: 'company' });
    const topExceptions = c.exceptions.slice(0, limit).map((e) => ({
      severity: e.severity,
      category: e.category,
      title: e.title,
      detail: e.detail,
      amount: e.amount,
    }));
    return {
      ok: true,
      data: {
        sales: c.sales,
        finance: c.finance,
        counts: c.counts,
        topExceptions,
        funnel: c.projectFunnel.filter((f) => f.count > 0),
      },
      tokensUsed: 150 + topExceptions.length * 30,
    };
  },
};
