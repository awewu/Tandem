/**
 * 绩效—薪酬一体化模块 · 领域类型
 *
 * 设计文档: docs/PERFORMANCE-MODULE-PRD.md
 * 源数据表: docs/薪酬结构总表.xlsx · docs/各职能岗位技能工资对应表.xlsx · docs/各职能岗位技能等级.xlsx
 *
 * 反禀赋核心: 固定月薪 = 基本(你是谁) + 技能(Σ已认证技能定价) + 任务(承接担当A-G档)。
 * 技能工资不是拍脑袋带宽, 而是"该等级必备技能定价之和"(§4.1)。
 */

/** 岗类 (薪酬总表最左列 Ⅰ/Ⅱ/Ⅲ类) */
export type JobClass = 'I' | 'II' | 'III';

/** 技能/职级等级列。注意: 各岗族天花板差异化, 并非都到 L5。 */
export type CompLevel = 'L1' | 'L1A' | 'L2' | 'L3' | 'L4' | 'L5';

/** 五大职能板块 */
export type FunctionBoard = 'HR' | 'FIN' | 'MFG' | 'RND' | 'MKT';

/** 序列映射 (四族人格中的白领/销售序列) */
export type CompSequence = 'AIP' | 'MIP' | 'SIP';

/** 技能认证的证据类型 (标准来源) */
export type EvidenceSource = '案例佐证' | '市场定价';

/** 任务工资承接档位 (薪酬总表 A-G 7 档, 以"调整级差"步进) */
export type TaskGear = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** 全部等级顺序 (用于比较高低 / 天花板判定) */
export const COMP_LEVEL_ORDER: CompLevel[] = ['L1', 'L1A', 'L2', 'L3', 'L4', 'L5'];

// ---------------------------------------------------------------------------
// 配置表 (policy-as-data, 随 matrixVersion 版本化)
// ---------------------------------------------------------------------------

/** 岗族 (comp_job_family) */
export interface JobFamily {
  id: string;
  tenantId: string;
  board: FunctionBoard;
  name: string;
  jobClass: JobClass;
  sequence: CompSequence;
  /** 该岗族可达等级 (天花板差异化, 如出纳仅 ['L1']) */
  reachableLevels: CompLevel[];
  matrixVersion: string;
}

/** 技能定义 + 定价 (comp_skill_def) */
export interface SkillDef {
  id: string;
  tenantId: string;
  familyId: string;
  name: string;
  /** 技能工资标准 (元) */
  skillWage: number;
  /** 在哪些等级为必备 (V 标记) */
  requiredAt: CompLevel[];
  source: EvidenceSource;
  matrixVersion: string;
}

/** 薪酬总表行 (comp_grade_band): 岗类 × 层级 → 固定月薪三段 */
export interface GradeBand {
  id: string;
  tenantId: string;
  jobClass: JobClass;
  level: CompLevel;
  familyId: string;
  education: string;
  experience: string;
  /** 基本工资 = f(学历, 经验区间) */
  baseWage: number;
  /**
   * 技能工资"派生缓存" (非真源)。权威值恒 = Σ comp_skill_def.skillWage(requiredAt ∋ level)。
   * HR 改价后重算刷新; 读性能用。
   */
  skillWageCached: number;
  /** 缓存重算时间戳 */
  skillWageComputedAt?: number | null;
  taskRatio: number;
  /** 任务工资标准值 (对应 A-G 中的标准档) */
  taskWageStd: number;
  skillStep: number;
  taskStep: number;
  /** 调整级差 (A-G 相邻档差额) */
  adjustStep: number;
  /** 7 档任务工资 A-G */
  taskGears: Record<TaskGear, number>;
  /** 对应岗位 (助理/初级/中级/高级/总工程师) */
  title: string;
  monthly: number;
  annual: number;
  /** 占比 (基本·技能·任务), 三者之和 = 1 */
  ratio: { base: number; skill: number; task: number };
  matrixVersion: string;
}

/** 技能矩阵版本 (comp_matrix_version, §5.2B) */
export interface CompMatrixVersion {
  id: string;
  tenantId: string;
  version: string;
  effectiveFrom: number;
  publishedBy: string;
  changelog: string;
  status: 'draft' | 'published' | 'archived';
}

// ---------------------------------------------------------------------------
// 员工状态表
// ---------------------------------------------------------------------------

/** 员工当前定位 (comp_employee_grade) */
export interface EmployeeGrade {
  id: string;
  tenantId: string;
  employeeId: string;
  familyId: string;
  jobClass: JobClass;
  currentLevel: CompLevel;
  education: string;
  experience: string;
  baseWageSnapshot: number;
  taskGear: TaskGear;
  effectiveFrom: number;
  effectiveTo?: number | null;
  certifiedAgainstVersion: string;
}

/** 技能认证 (comp_grade_certification, §5.1) */
export interface GradeCertification {
  id: string;
  tenantId: string;
  employeeId: string;
  familyId: string;
  skillId: string;
  status: '已认证' | '待认证';
  /** 证据 (案例/证书附件引用) */
  evidence?: string;
  certifiedAt?: number | null;
  certifiedAgainstVersion: string;
}

/** 职级/PIP 变更 + Acknowledgement 链 (comp_grade_change_log, §6) */
export interface GradeChangeLog {
  id: string;
  tenantId: string;
  employeeId: string;
  nodeId: string;
  cycle: string;
  changeType: '知悉' | 'PIP告知' | '降职生效' | '职级晋升' | '任务承接';
  fromGrade?: CompLevel | null;
  toGrade?: CompLevel | null;
  /** 冻结当时依据数据 */
  evidenceSnapshot: unknown;
  signatureState: '待签' | '已签' | '拒签' | '逾期视同送达';
  signedAt?: number | null;
  appealState?: 'none' | 'open' | 'resolved';
}

// ---------------------------------------------------------------------------
// 过程与结算表
// ---------------------------------------------------------------------------

/** B轨承接记录 (comp_task_commitment): 年度/季度/半年/特殊申请加档留痕 */
export interface TaskCommitment {
  id: string;
  tenantId: string;
  employeeId: string;
  familyId: string;
  cycle: string;
  commitmentType: 'annual' | 'quarterly' | 'half_year' | 'special';
  fromGear?: TaskGear | null;
  toGear: TaskGear;
  taskWageDelta: number;
  reason?: string;
  status: 'proposed' | 'approved' | 'active' | 'expired' | 'rejected';
  proposedBy?: string;
  approvedBy?: string;
  effectiveFrom?: number | null;
  effectiveTo?: number | null;
  evidenceSnapshot: unknown;
}

/** 述职/九宫格结果 (comp_grade_review): OKR潜力轴 × KPI绩效轴 + 三源分快照 */
export interface GradeReview {
  id: string;
  tenantId: string;
  employeeId: string;
  cycle: string;
  reviewType: 'quarterly_checkin' | 'half_year' | 'annual';
  okrPotentialScore?: number | null;
  kpiPerformanceScore?: number | null;
  /** 九宫格潜力轴 1..3 */
  nineBoxRow?: number | null;
  /** 九宫格绩效轴 1..3 */
  nineBoxCol?: number | null;
  selfScore?: number | null;
  peerScore?: number | null;
  managerScore?: number | null;
  sourceWeights: { self: number; peer: number; manager: number };
  /** 软引用 review360 (三源他评复用) */
  review360CycleId?: string | null;
  outcome?: 'promote' | 'hold' | 'watch' | 'pip' | 'demote' | null;
  snapshot: unknown;
}

/** 预算池配置 (comp_budget_pool): LIP 池 + 硬悬崖预算截断 (政策 RH-HR-A01) */
export interface BudgetPool {
  id: string;
  tenantId: string;
  /** 软引用组织架构 department */
  departmentId: string;
  period: string;
  poolType: 'lip' | 'department';
  /** 部门基数 (FP&A 提前测算) */
  baseAmount: number;
  hardCliff: boolean;
  budgetCeiling?: number | null;
  qualityCoefficient: number;
  attendanceBasis?: string;
  params: unknown;
  status: 'draft' | 'active' | 'closed';
}

/** 月度/周期结算 (comp_monthly_settlement) */
export interface MonthlySettlement {
  id: string;
  tenantId: string;
  employeeId: string;
  period: string;
  baseWage: number;
  skillWage: number;
  taskWage: number;
  performance: number;
  attendance: number;
  coefficient: number;
  /** 硬闸门标记 (安全一票否决 / 出勤) */
  gateFlags: unknown;
  basisSnapshot: unknown;
  status: 'draft' | 'reviewed' | 'paid';
}
