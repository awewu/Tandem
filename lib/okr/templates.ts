/**
 * OKR 模板库 — 内置经典场景
 *
 * 来源：Google Re:Work / Tita 模板库 / WorkBoard / Profit.co 案例
 * 模板用途：新建周期初期，团队不知道写什么的时候快速起草。
 *
 * 模板包含：
 *   - Objective 标题 + 描述
 *   - 推荐 KR（含类型、起始/目标值、单位）
 *   - 推荐 Initiative（行动项）
 *   - 标签（用于过滤分类）
 */

import type { KRType } from '../store';

export interface KRTemplate {
  title: string;
  type: KRType;
  startValue: number;
  targetValue: number;
  unit: string;
  weight: number;
  initiatives?: string[];
}

export interface OKRTemplate {
  id: string;
  category: 'sales' | 'product' | 'engineering' | 'hr' | 'marketing' | 'ops' | 'finance' | 'leadership';
  title: string;
  description: string;
  /** 启发来源 */
  source?: string;
  tags: string[];
  keyResults: KRTemplate[];
}

export const OKR_TEMPLATES: OKRTemplate[] = [
  // ===== 销售 =====
  {
    id: 'sales-arr',
    category: 'sales',
    title: '加速年度经常性收入（ARR）增长',
    description: '通过提升客户获取效率与续约质量，把 ARR 从去年水平提升到新高。',
    source: 'Salesforce / SaaStr 经典 OKR',
    tags: ['增长', '北极星', '收入'],
    keyResults: [
      { title: 'ARR 从 1000 万增长到 1500 万', type: 'numeric', startValue: 1000, targetValue: 1500, unit: '万元', weight: 50, initiatives: ['启动企业大客户专项', '签约 5 个 KA 客户'] },
      { title: '续约率从 85% 提升到 92%', type: 'percentage', startValue: 85, targetValue: 92, unit: '%', weight: 30, initiatives: ['搭建 CSM 团队', '建立健康度评分模型'] },
      { title: '新签客户平均合同金额从 5 万提升到 8 万', type: 'numeric', startValue: 5, targetValue: 8, unit: '万元', weight: 20 },
    ],
  },
  {
    id: 'sales-pipeline',
    category: 'sales',
    title: '建设可预测的销售管道',
    description: '让销售收入可预测、可复制。',
    tags: ['销售', '流程'],
    keyResults: [
      { title: 'Pipeline 覆盖率 ≥ 4×（季度目标 vs 在管漏斗）', type: 'numeric', startValue: 2, targetValue: 4, unit: 'x', weight: 40 },
      { title: '从 Lead 到成交平均周期 ≤ 60 天', type: 'numeric', startValue: 90, targetValue: 60, unit: '天', weight: 30 },
      { title: '销售预测准确率 ≥ 85%', type: 'percentage', startValue: 60, targetValue: 85, unit: '%', weight: 30 },
    ],
  },

  // ===== 产品 =====
  {
    id: 'product-retention',
    category: 'product',
    title: '把核心用户的留存做到行业第一梯队',
    description: '通过 onboarding、推荐、唤醒三条主线提升次日/七日/三十日留存。',
    source: 'Reforge "Retention OKR"',
    tags: ['留存', '增长', '北极星'],
    keyResults: [
      { title: '次日留存（D1）从 35% 提升到 50%', type: 'percentage', startValue: 35, targetValue: 50, unit: '%', weight: 35, initiatives: ['优化新手引导', '首日激活推送'] },
      { title: '七日留存（D7）从 18% 提升到 28%', type: 'percentage', startValue: 18, targetValue: 28, unit: '%', weight: 35 },
      { title: '三十日留存（D30）从 8% 提升到 14%', type: 'percentage', startValue: 8, targetValue: 14, unit: '%', weight: 30 },
    ],
  },
  {
    id: 'product-nps',
    category: 'product',
    title: '提升产品 NPS 与口碑',
    description: '把推荐者比例做上去，把贬损者比例打下来。',
    tags: ['NPS', '满意度'],
    keyResults: [
      { title: 'NPS 从 25 提升到 45', type: 'numeric', startValue: 25, targetValue: 45, unit: '分', weight: 50 },
      { title: '贬损者比例从 18% 降至 8%', type: 'percentage', startValue: 18, targetValue: 8, unit: '%', weight: 30 },
      { title: '受邀朋友的注册转化 ≥ 30%', type: 'percentage', startValue: 0, targetValue: 30, unit: '%', weight: 20 },
    ],
  },

  // ===== 工程 =====
  {
    id: 'eng-reliability',
    category: 'engineering',
    title: '把系统可用性提升到 99.95%',
    description: '通过容灾、监控、混沌工程建立强韧性。',
    source: 'Google SRE OKR 模板',
    tags: ['可靠性', 'SRE'],
    keyResults: [
      { title: '生产环境可用性 ≥ 99.95%', type: 'percentage', startValue: 99.5, targetValue: 99.95, unit: '%', weight: 40 },
      { title: 'P0 事故 MTTR ≤ 30 分钟', type: 'numeric', startValue: 90, targetValue: 30, unit: '分钟', weight: 30 },
      { title: '完成 4 次混沌演练并修复全部高危问题', type: 'milestone', startValue: 0, targetValue: 100, unit: '%', weight: 30, initiatives: ['搭建 chaos mesh', '设计灾难剧本'] },
    ],
  },
  {
    id: 'eng-velocity',
    category: 'engineering',
    title: '提升研发交付效率（DORA 指标）',
    description: '让团队进入"精英"梯队（DORA Elite）。',
    source: 'DORA / Accelerate',
    tags: ['交付效率', 'DORA'],
    keyResults: [
      { title: '部署频率 ≥ 每天 1 次', type: 'numeric', startValue: 0.2, targetValue: 1, unit: '次/天', weight: 25 },
      { title: '从代码合入到上线 ≤ 24 小时', type: 'numeric', startValue: 168, targetValue: 24, unit: '小时', weight: 25 },
      { title: '变更失败率 ≤ 5%', type: 'percentage', startValue: 15, targetValue: 5, unit: '%', weight: 25 },
      { title: '故障恢复时间 ≤ 1 小时', type: 'numeric', startValue: 4, targetValue: 1, unit: '小时', weight: 25 },
    ],
  },

  // ===== HR =====
  {
    id: 'hr-retention',
    category: 'hr',
    title: '建设可持续的人才梯队',
    description: '降低关键岗位流失率，提升内部晋升占比。',
    tags: ['人才', '组织'],
    keyResults: [
      { title: '关键岗位主动离职率 ≤ 5%', type: 'percentage', startValue: 12, targetValue: 5, unit: '%', weight: 40 },
      { title: '管理岗内部晋升比例 ≥ 60%', type: 'percentage', startValue: 30, targetValue: 60, unit: '%', weight: 30 },
      { title: 'eNPS（员工净推荐值）≥ 40', type: 'numeric', startValue: 15, targetValue: 40, unit: '分', weight: 30 },
    ],
  },

  // ===== 营销 =====
  {
    id: 'marketing-leads',
    category: 'marketing',
    title: '建设可预测的营销获客引擎',
    description: '把营销贡献的 SQL（合格销售线索）做大、做精。',
    tags: ['获客', 'SQL'],
    keyResults: [
      { title: '营销贡献 SQL 数从 200 提升到 500/月', type: 'numeric', startValue: 200, targetValue: 500, unit: '条/月', weight: 40 },
      { title: 'MQL → SQL 转化率 ≥ 25%', type: 'percentage', startValue: 12, targetValue: 25, unit: '%', weight: 30 },
      { title: '内容栏目订阅人数从 5000 增长到 15000', type: 'numeric', startValue: 5000, targetValue: 15000, unit: '人', weight: 30 },
    ],
  },

  // ===== 运营 =====
  {
    id: 'ops-efficiency',
    category: 'ops',
    title: '提升运营自动化与效率',
    description: '把人力密集的环节自动化，让团队专注高杠杆动作。',
    tags: ['运营', '自动化'],
    keyResults: [
      { title: '工单自动化处理率 ≥ 70%', type: 'percentage', startValue: 30, targetValue: 70, unit: '%', weight: 40 },
      { title: '人均服务客户数从 200 提升到 400', type: 'numeric', startValue: 200, targetValue: 400, unit: '个', weight: 30 },
      { title: '客户满意度（CSAT）≥ 92%', type: 'percentage', startValue: 85, targetValue: 92, unit: '%', weight: 30 },
    ],
  },

  // ===== 财务 =====
  {
    id: 'finance-cash',
    category: 'finance',
    title: '改善现金流健康度',
    description: '保证 18 个月以上现金跑道。',
    tags: ['财务', '现金'],
    keyResults: [
      { title: '现金跑道 ≥ 18 个月', type: 'numeric', startValue: 12, targetValue: 18, unit: '个月', weight: 40 },
      { title: '应收账款周转天数 ≤ 45 天', type: 'numeric', startValue: 75, targetValue: 45, unit: '天', weight: 30 },
      { title: '毛利率从 55% 提升到 65%', type: 'percentage', startValue: 55, targetValue: 65, unit: '%', weight: 30 },
    ],
  },

  // ===== 领导力 =====
  {
    id: 'leadership-strategy',
    category: 'leadership',
    title: '把组织拉齐到一致的战略方向',
    description: 'CEO/创始人级别的对齐性 OKR。',
    tags: ['战略', '对齐'],
    keyResults: [
      { title: '完成 4 次全员战略沟通（全员对齐度 ≥ 90%）', type: 'milestone', startValue: 0, targetValue: 100, unit: '%', weight: 30 },
      { title: '部门级 OKR 与公司级 OKR 对齐率 100%', type: 'percentage', startValue: 60, targetValue: 100, unit: '%', weight: 40 },
      { title: '高管 360 度评估平均分 ≥ 4.2 / 5', type: 'numeric', startValue: 3.5, targetValue: 4.2, unit: '分', weight: 30 },
    ],
  },
];

export const TEMPLATE_CATEGORIES: { value: OKRTemplate['category']; label: string }[] = [
  { value: 'sales', label: '销售' },
  { value: 'product', label: '产品' },
  { value: 'engineering', label: '工程' },
  { value: 'marketing', label: '营销' },
  { value: 'ops', label: '运营' },
  { value: 'hr', label: '人力资源' },
  { value: 'finance', label: '财务' },
  { value: 'leadership', label: '领导力' },
];
