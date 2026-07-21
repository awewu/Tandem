/**
 * 业务红线硬拒清单 (回答三档 · 第三档) · 2026-07
 *
 * 与 STRATEGIC_RED_LINES (lib/product/manifesto.ts) 的区别:
 *   - STRATEGIC_RED_LINES: 产品/战略方向红线 (集成飞书、服务政企…), 约束的是路线图/PR。
 *   - HARD_REFUSE_TOPICS:   业务回答红线, 约束的是 AI 对员工的回答内容 —— 命中即硬拒转人工,
 *     AI 不得代替人给出结论 (薪资/裁员/法律/对外承诺/资金条款…)。
 *
 * 用途: 中央 AI / 搭子 回答编排入口做一次确定性 (无 LLM) 快检, 命中直接转人工话术 + audit。
 *
 * ⚠️ 清单由 Owner 维护 —— 下面 DEFAULT_HARD_REFUSE_TOPICS 是出厂兜底 (代码内置),
 *    生产环境优先读数据库 (Admin 录入页 /admin/hard-refuse 热更新, 见 hard-refuse-service.ts)。
 *    DB 无记录时回落到本兜底清单, 保证任何环境都有基本红线保护。
 */

export interface HardRefuseTopic {
  /** 主题 id (审计用) */
  id: string;
  /** 给员工看的中文主题名 */
  label: string;
  /** 命中关键词 (任一命中即触发; 建议用最具体的词, 避免误伤) */
  keywords: string[];
  /** 转人工指引 (告诉员工该找谁/走什么流程) */
  redirect: string;
}

/**
 * §出厂兜底 · 业务红线主题清单 (民营企业·产研销 通用初版)
 * 补充规则: keywords 用最具体的词 (避免误伤); redirect 指向真实流程/角色。
 * 生产可在 /admin/hard-refuse 覆盖此清单 (存 DB, 热更新)。
 */
export const DEFAULT_HARD_REFUSE_TOPICS: HardRefuseTopic[] = [
  {
    id: 'compensation',
    label: '薪资 / 调薪 / 个人薪酬',
    keywords: [
      '涨薪', '调薪', '加薪', '降薪', '调整薪资', '薪资调整', '我的工资', '我的薪资', '我的薪水',
      '我工资', '工资多少', '薪酬方案', '薪资方案', '发多少钱', '给我多少钱', '底薪', '定薪', '核薪',
      '年终奖', '年终奖金', '奖金多少', '提成比例', '提成方案', '绩效工资', '绩效系数', '股权激励',
      '期权', '几个点', '发不发年终', '工资倒挂', '薪资倒挂', '薪资保密',
    ],
    redirect: '涉及个人薪酬/奖金/股权属人力与管理层决策, 请走 1:1 或联系 HR / 你的直属主管, 我不能替公司给薪资承诺。',
  },
  {
    id: 'layoff',
    label: '裁员 / 解雇 / 辞退 / 用工去留',
    keywords: [
      '裁员', '裁人', '裁掉', '解雇', '辞退', '开除', '被优化', '优化掉', '劝退', '末位淘汰', '淘汰谁',
      '要不要辞', '该不该开', '让谁走', '砍掉团队', '砍编制', '缩编', '解除劳动合同', '不续签',
      'n+1', 'n加1', '赔偿方案', '经济补偿金', '离职谈判',
    ],
    redirect: '涉及裁员/解雇/用工去留属管理层与法务决策, 请走正式流程 (HR + 法务), 我不能替公司判定人员去留。',
  },
  {
    id: 'legal',
    label: '法律 / 合规 / 诉讼定性',
    keywords: [
      '是否违法', '违不违法', '合不合法', '合法吗', '会不会坐牢', '犯不犯法', '算不算犯罪', '起诉',
      '诉讼', '打官司', '仲裁', '违约责任', '法律责任', '法律风险', '赔不赔', '要不要赔', '偷税', '漏税',
      '避税', '逃税', '行贿', '受贿', '回扣合不合规', '侵权吗', '专利侵权', '商业机密泄露', '举报',
    ],
    redirect: '涉及法律定性/合规判定请咨询法务或专业律师, 我不能提供有法律效力的结论。',
  },
  {
    id: 'external_commitment',
    label: '对外承诺 / 合同条款 / 报价',
    keywords: [
      '对客户承诺', '给客户保证', '向客户保证', '答应客户', '承诺交付', '交付承诺', '保证交期',
      '合同条款', '签合同', '签不签', '这单签吗', '对外报价', '报价多少', '给多少折扣', '打几折',
      '账期', '付款条件', '违约金', '赔付条款', '独家代理', '对外口径', '对媒体说', '对客户口径',
    ],
    redirect: '对外承诺/合同条款/报价折扣需经授权人 + 商务 + 法务确认, 我不能替公司对外承诺。',
  },
  {
    id: 'funds',
    label: '资金 / 付款 / 报销 / 预算定夺',
    keywords: [
      '打款', '转账', '付款给', '把钱打给', '批这笔钱', '批款', '这笔能报', '报销这笔', '能不能报销',
      '动用资金', '资金审批', '预算审批', '批预算', '超预算', '走账', '过账', '垫付', '预付款',
      '采购审批', '这单采购', '要不要买', '批采购', '发票怎么开', '开票',
    ],
    redirect: '涉及资金动用/付款/报销/采购审批请走财务流程与授权审批, 我不能替公司批款或定报销。',
  },
  {
    id: 'personnel_evaluation',
    label: '人员考评 / 晋升 / 定级',
    keywords: [
      '给谁打绩效', '绩效打几分', '定几级', '晋升谁', '该不该升', '提拔谁', '转正吗', '要不要转正',
      '定级', '职级怎么定', '打c还是b', '打不打c', '考评结果', '谁更该升',
    ],
    redirect: '绩效评定/晋升定级属管理层与 HR 校准会决策, 请走正式考评流程, 我不能替公司给个人考评结论。',
  },
];

/** 兼容旧引用: 默认清单别名 (纯函数快检时的兜底数据源) */
export const HARD_REFUSE_TOPICS = DEFAULT_HARD_REFUSE_TOPICS;

/** DB 持久化记录 (Admin 录入页写入; KvStore collection = hard_refuse_config) */
export interface HardRefuseConfigRecord {
  /** 固定 id = `hard_refuse_${tenantId}` */
  id: string;
  tenantId: string;
  /** 是否启用红线硬拒 (关闭则全部放行, 便于紧急临时停用) */
  enabled: boolean;
  /** 主题清单 (覆盖 DEFAULT_HARD_REFUSE_TOPICS) */
  topics: HardRefuseTopic[];
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HardRefuseResult {
  hit: boolean;
  topicId?: string;
  label?: string;
  redirect?: string;
}

/**
 * 对一段文本按给定主题清单做确定性红线快检 (无 LLM 调用) —— 纯函数, 可注入 DB 清单.
 */
export function matchHardRefuseWith(text: string, topics: HardRefuseTopic[]): HardRefuseResult {
  const q = (text ?? '').toLowerCase();
  if (!q.trim()) return { hit: false };
  for (const topic of topics) {
    for (const kw of topic.keywords) {
      const k = kw.trim().toLowerCase();
      if (k && q.includes(k)) {
        return { hit: true, topicId: topic.id, label: topic.label, redirect: topic.redirect };
      }
    }
  }
  return { hit: false };
}

/**
 * 对一段文本 (通常是员工提问) 做确定性红线快检 (用出厂兜底清单, 无 IO).
 * 生产入口应优先用 hard-refuse-service.ts 的 matchHardRefuseLive (读 DB).
 */
export function matchHardRefuse(text: string): HardRefuseResult {
  return matchHardRefuseWith(text, DEFAULT_HARD_REFUSE_TOPICS);
}
