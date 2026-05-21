/**
 * KPI · 公司底线 + 全维度健康监控系统 (与 TTI 双轨)
 *
 * 见 docs/CHARTER-KPI-TTI.md §2.
 *
 * 与 TTI/OKR 完全分离:
 *   - 周期: 财年 (年度)
 *   - 强制达成 (top-down)
 *   - 数据三通道: A 管理设置 + B ERP 采集 + C 财务/HR/内勤人工补录
 *   - 个人/被考核人/直属主管/高管 都不能改 actuals
 *
 * 双 scope (CHARTER §2.0):
 *   - `bonus`   : 与奖金挂钩, 进 9-box 纵轴, 计入年终绩效系数
 *   - `monitor` : 仅监控公司运行健康度, 不挂奖金, 不进 9-box
 *
 * 科目体系动态可扩展 (CHARTER §2.4): KpiSubject 树, HR/财务可增删改
 *
 * 命名前缀: `Kpi*`
 * API: `/api/kpi/*` + `/api/kpi/analytics/*` + `/api/kpi/manual-entry` + `/api/kpi/{import,export}`
 */

// ---------------------------------------------------------------------------
// 周期 (财年, 年度)
// ---------------------------------------------------------------------------

export type KpiCycleStatus = 'draft' | 'active' | 'closed';

export interface KpiCycle {
  id: string;
  /** 财年, e.g. 2026 */
  fiscalYear: number;
  /** 周期名, e.g. "FY2026" */
  name: string;
  /** ISO 8601 */
  startDate: string;
  endDate: string;
  status: KpiCycleStatus;
  /** 多租户 */
  tenantId: string;
  /** 周期一旦 active, targets 锁死 (CHARTER §2.3) */
  targetsLockedAt?: string;
  /** 创建人 (HR / 高管) */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 科目主数据 (KpiSubject) · 动态可扩展树
// ---------------------------------------------------------------------------

/**
 * KPI 科目 (会计意义的 account/subject), 用于公司全维度健康度建模.
 *
 * 三层默认结构 (可按需调整):
 *   一级 (level=1): 营收 / 成本 / 利润 / 现金流 / 客户 / 合规 / 质量 / 效率 / ...
 *   二级 (level=2): 营收 → 主营业务收入 / 其他业务收入 / ...
 *   三级 (level=3): 主营业务收入 → 产品 A 收入 / 产品 B 收入 / 服务收入 / ...
 *
 * HR / 财务 / 高管可在 `/admin/kpi/subjects` 增删改 (动态优化).
 * 软删除 (`active=false`), 保留历史 KPI 引用完整性.
 */
export interface KpiSubject {
  id: string;
  /** 父科目 ID. null = 一级科目 */
  parentId?: string;
  /** 业务编码, e.g. "REV-001" "REV-001-A". 用于 Excel 导入匹配. */
  code: string;
  /** 显示名, e.g. "营收" "主营业务收入" */
  name: string;
  /** 描述 (可选, 解释科目含义/计算口径) */
  description?: string;
  /** 层级 (1/2/3, 与 parentId 联动校验) */
  level: number;
  /** 默认 scope (新建 Kpi 时的默认值, 实例可覆盖) */
  defaultScope: 'bonus' | 'monitor';
  /** 默认单位 */
  defaultUnit?: string;
  /** 默认度量类型 */
  defaultMeasureType: 'numeric' | 'percentage' | 'currency' | 'count';
  /** 软删除. false = 历史保留但不可新建 KPI 引用 */
  active: boolean;
  /** 多租户 */
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// KPI 指标 (单个)
// ---------------------------------------------------------------------------

export type KpiLevel = 'company' | 'department' | 'individual';

export type KpiDataSource = 'erp' | 'manual' | 'pending';

export type KpiMeasureType = 'numeric' | 'percentage' | 'currency' | 'count';

/**
 * KPI 双 scope (CHARTER §2.0):
 *   - `bonus`   : 与奖金挂钩 (affectsCompensation=true), 进 9-box 纵轴
 *   - `monitor` : 仅监控公司运行健康度, 不影响奖金, 不进 9-box
 *
 * 公司需要全维度数据 (monitor) 但只对关键 KPI (bonus) 与奖金挂钩.
 * 两类 KPI 数据采集逻辑 (三通道) 完全相同, 仅消费侧分流.
 */
export type KpiScope = 'bonus' | 'monitor';

export interface Kpi {
  id: string;
  cycleId: string;
  /** 引用 KpiSubject (取代 v1 硬枚举 category) */
  subjectId: string;
  /** 层级: 公司 → 部门 → 个人 (三层 cascade) */
  level: KpiLevel;
  /** 父级 KPI (公司 ← 部门 ← 个人, cascade 拆解依赖) */
  parentKpiId?: string;
  /** 被考核人/部门 ID. scope=monitor 时常为公司主体, 非个人 */
  assigneeId: string;
  /** 部门 ID (level=department 必填; level=individual 时记所属部门便于 rollup) */
  departmentId?: string;
  title: string;
  description?: string;
  measureType: KpiMeasureType;
  /** 起始值 (年初) */
  startValue: number;
  /** 目标值 (年终, 周期 active 后锁) */
  targetValue: number;
  /** 实际值 (累计) — 仅通道 B (ERP) 或 C (人工补录) 可改, 任何人均不能直接编辑 */
  currentValue: number;
  /** 单位, e.g. "元", "%", "次" */
  unit?: string;
  /** 权重 (奖金计算用, 0-100). scope=monitor 时忽略此字段 */
  weight: number;
  /** 当前数据来源 (UI 显示徽标用) */
  dataSource: KpiDataSource;
  /**
   * Scope 决定是否参与奖金计算 (CHARTER §2.0):
   *   - bonus   : 进 9-box 纵轴 + bonus-calc 引擎
   *   - monitor : 仅入健康度看板, 不影响奖金
   *
   * 注意: scope 不可在周期 active 后修改, 防止奖金口径漂移.
   */
  scope: KpiScope;
  /** 多租户 */
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 派生函数: KPI 是否与奖金挂钩 (替代 v1 写死 affectsCompensation: true).
 * 与 TTI 的 `affectsCompensation: false` 对称.
 * CHARTER §4 铁律: 修改此函数需走议事室 ≥ Lv2 签批.
 */
export function affectsCompensation(kpi: Pick<Kpi, 'scope'>): boolean {
  return kpi.scope === 'bonus';
}

// ---------------------------------------------------------------------------
// Check-in (季度/月度快照, 只读)
// ---------------------------------------------------------------------------

export interface KpiCheckIn {
  id: string;
  kpiId: string;
  /** 快照时点 ISO */
  asOf: string;
  /** 快照时的累计 actual */
  cumulativeValue: number;
  /** 本期增量 (与上一次 check-in 的差) */
  delta: number;
  /** 数据来源 */
  source: KpiDataSource;
  /** 备注 (评论, 不影响数值) */
  note?: string;
  /** 创建人 (system 或 finance/HR userId) */
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 每日/每周快照 (供分析: YTD / 环比 / 趋势)
// ---------------------------------------------------------------------------

export interface KpiSnapshot {
  id: string;
  kpiId: string;
  /** 快照日期 (YYYY-MM-DD, 每日一条) */
  date: string;
  /** 该日累计 actual */
  cumulativeValue: number;
  source: KpiDataSource;
  /** 多维分解 (可选, e.g. 按客户/产品/渠道) */
  breakdown?: Record<string, number>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 人工补录记录 (通道 C, 审计专用)
// ---------------------------------------------------------------------------

export interface KpiManualEntry {
  id: string;
  kpiId: string;
  /** 操作人 (财务/HR/部门内勤 userId) */
  operatorId: string;
  /** 操作人角色 (用于 audit log 可读性) */
  operatorRole: 'finance' | 'hr' | 'internal_staff';
  /** 写入前的 cumulativeValue */
  fromValue: number;
  /** 写入后的 cumulativeValue */
  toValue: number;
  /** 必填: 为何 ERP 不能采集 (CHARTER §2.1) */
  reason: string;
  /** 可选: 证据材料链接 (调研报告 PDF, 内部周报 URL 等) */
  evidenceUrl?: string;
  /** 多租户 */
  tenantId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 完成率 / 颜色规则 (与 TTI 完全不同语义)
// ---------------------------------------------------------------------------

/**
 * KPI 完成率: (currentValue - startValue) / (targetValue - startValue), 0-1.
 * 与 TTI 的 60-70% 健康规则不同: KPI 100% 才算合格.
 */
export function computeKpiCompletion(kpi: Pick<Kpi, 'startValue' | 'targetValue' | 'currentValue'>): number {
  const range = kpi.targetValue - kpi.startValue;
  if (range === 0) return kpi.currentValue >= kpi.targetValue ? 1 : 0;
  const r = (kpi.currentValue - kpi.startValue) / range;
  return Math.max(0, Math.min(1.5, r)); // 允许超额 (最高 150% 用于 bonus 系数)
}

/**
 * KPI 颜色规则:
 *   - >= 1.0  : green   (达标)
 *   - >= 0.85 : yellow  (接近但未达, 需关注)
 *   - < 0.85  : red     (不达, 不发奖金)
 * 比 TTI 严格 (TTI 是 60-70% 绿).
 */
export function kpiCompletionColor(rate: number): 'green' | 'yellow' | 'red' {
  if (rate >= 1.0) return 'green';
  if (rate >= 0.85) return 'yellow';
  return 'red';
}

/**
 * Cascade 一致性: 子 KPI targets 之和应等于父 KPI target (允许 ±1% 浮动).
 * 用于 HR setup 页 cascade 校验 (CHARTER §2.2 体系目标同步).
 */
export function isCascadeConsistent(
  parentTarget: number,
  childrenTargets: number[],
  toleranceRatio = 0.01,
): boolean {
  if (childrenTargets.length === 0) return true;
  const sum = childrenTargets.reduce((acc, v) => acc + v, 0);
  const tolerance = Math.abs(parentTarget) * toleranceRatio;
  return Math.abs(sum - parentTarget) <= tolerance;
}
