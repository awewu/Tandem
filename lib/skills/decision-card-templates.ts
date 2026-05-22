/**
 * 议事室决策卡模板 · S2
 *
 * 给定一个 skill template 名 (如 'role-transfer'), 返回预填的议事室启动参数.
 * 由 /api/convergence 在收到 ?template=xxx 时调用.
 *
 * 模板池在 skills/decision-card-template/SKILL.md 里有人类可读版本.
 * 此文件是机器执行版本.
 */

export type TemplateId =
  | 'bonus-distribute'
  | 'role-transfer'
  | 'promotion'
  | 'risk-burnout'
  | 'must-intervene'
  | 'product-decision';

export interface TemplateContext {
  /** 焦点员工 (调岗 / 升职 / 干预类必填) */
  subjectUserId?: string;
  subjectName?: string;
  /** 9-box cell (调岗类自动填) */
  nineBoxCell?: string;
  /** 周期 (奖金类自动填) */
  cycleId?: string;
  /** 自由文本上下文 */
  description?: string;
}

export interface DecisionCardDraft {
  title: string;
  description: string;
  /** Q2 KR 软绑定: 9-box 联动决策一般无 KR, 用 reason */
  noKrReason: string;
  /** Hint 给议事室 orchestrator 生成 3+1 选项的方向 */
  optionHints: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  /** 建议时限 (天) */
  timelineDays: number;
  decisionClass: 'simple' | 'complex' | 'strategic';
}

const TEMPLATES: Record<TemplateId, (ctx: TemplateContext) => DecisionCardDraft> = {
  'bonus-distribute': (ctx) => ({
    title: `Q4 奖金分配方案 (${ctx.cycleId ?? '未指定周期'})`,
    description: '团队奖金池分配讨论. 重点: 是否引入 stretch goal 系数 vs 严格按完成率发.',
    noKrReason: '奖金分配是元决策, 跨多 KR; 用议事室协议形成 3+1 方案',
    optionHints: {
      A: 'SOP: 严格按 weightedCompletion × baseBonus, 1:1 比例',
      B: 'AGENT: 引入 stretch goal 系数 (高 KPI 1.2x, 低 0.8x)',
      C: 'HISTORICAL: 参考去年同周期的分配比例与离职率反应',
      D: '员工原创 (强制 human only)',
    },
    timelineDays: 7,
    decisionClass: 'strategic',
  }),

  'role-transfer': (ctx) => ({
    title: `${ctx.subjectName ?? ctx.subjectUserId ?? '某员工'} 调岗讨论`,
    description: `9-box 落点: ${ctx.nineBoxCell ?? 'mismatch'}. ${ctx.description ?? ''}`,
    noKrReason: `9-box 联动调岗讨论: ${ctx.nineBoxCell ?? 'mismatch'} 落点, 跨 KR 元决策`,
    optionHints: {
      A: 'SOP: 走 HR 标准调岗流程, 同 level 平调',
      B: 'AGENT: AI 推荐 3 个匹配岗位 (基于技能图谱 + TTI 方向)',
      C: 'HISTORICAL: 类似画像员工调岗后 6 月表现',
      D: '员工原创: 留任 + 重塑职责 (需员工本人参与议事室)',
    },
    timelineDays: 21,
    decisionClass: 'strategic',
  }),

  promotion: (ctx) => ({
    title: `${ctx.subjectName ?? ctx.subjectUserId ?? '某员工'} 升职讨论`,
    description: `9-box: ${ctx.nineBoxCell ?? 'star'}. ${ctx.description ?? ''}`,
    noKrReason: '升职是 strategic 元决策, 不挂单一 KR',
    optionHints: {
      A: 'SOP: 走标准 promotion package',
      B: 'AGENT: 风险评估 (peer 反馈 / 离职风险 / 同 level 比较)',
      C: 'HISTORICAL: 类似背景人升职后 6 月表现',
      D: '员工原创: 增扩责任不升 title (lateral growth)',
    },
    timelineDays: 30,
    decisionClass: 'strategic',
  }),

  'risk-burnout': (ctx) => ({
    title: `${ctx.subjectName ?? ctx.subjectUserId ?? '某员工'} 倦怠风险干预`,
    description: `9-box: risk_burnout (高 KPI + 低 TTI). 长期重复劳动倦怠风险. ${ctx.description ?? ''}`,
    noKrReason: '倦怠干预是 wellbeing 类元决策, 跨多 KR',
    optionHints: {
      A: 'SOP: 强制休假 + 调整 KPI target',
      B: 'AGENT: 推荐挑战项目让 TTI 起来',
      C: 'HISTORICAL: 类似情形改善案例',
      D: '员工原创: 自主提议 (注意信任铁律 §3.3)',
    },
    timelineDays: 14,
    decisionClass: 'complex',
  }),

  'must-intervene': (ctx) => ({
    title: `${ctx.subjectName ?? ctx.subjectUserId ?? '某员工'} 双低干预`,
    description: `9-box: must_intervene (低 KPI + 低 TTI). ${ctx.description ?? ''}`,
    noKrReason: '严重绩效问题, 跨 KR 元决策, 走议事室 (不走主管单方决定)',
    optionHints: {
      A: 'SOP: PIP (Performance Improvement Plan) 90 天',
      B: 'AGENT: 转岗到更适合岗位 (基于技能图谱)',
      C: 'HISTORICAL: 离职辅导 + 软着陆',
      D: '员工原创 (员工本人必须参与议事室)',
    },
    timelineDays: 7,
    decisionClass: 'strategic',
  }),

  'product-decision': (ctx) => ({
    title: ctx.description?.slice(0, 60) ?? '产品决策',
    description: ctx.description ?? '产品方向 / 上线 / 砍掉 / Pivot 决策',
    noKrReason: '产品决策跨多 KR, 走议事室协议形成 3+1 方案',
    optionHints: {
      A: 'SOP: 走标准发布流程',
      B: 'AGENT: AI 数据驱动方案',
      C: 'HISTORICAL: 类似产品决策结果',
      D: '员工原创 (差异化路径)',
    },
    timelineDays: 14,
    decisionClass: 'complex',
  }),
};

export function applyTemplate(id: TemplateId, ctx: TemplateContext = {}): DecisionCardDraft | null {
  const fn = TEMPLATES[id];
  return fn ? fn(ctx) : null;
}

export function listTemplates(): { id: TemplateId; description: string }[] {
  return [
    { id: 'bonus-distribute', description: '奖金分配争议' },
    { id: 'role-transfer', description: '调岗讨论 (9-box mismatch)' },
    { id: 'promotion', description: '升职讨论 (9-box star)' },
    { id: 'risk-burnout', description: '倦怠风险干预 (9-box risk_burnout)' },
    { id: 'must-intervene', description: '双低干预 (9-box must_intervene)' },
    { id: 'product-decision', description: '产品方向 / 上线 / 砍掉决策' },
  ];
}
