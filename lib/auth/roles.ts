/**
 * Roles SSOT · 全代码唯一角色枚举来源
 *
 * 设计:
 *   - 内部角色: 公司员工/管理层, 默认可访问全部三板块 (事半/拿捏/搭子)
 *   - 外部角色: 客户/合作伙伴/承包商, 受 lib/auth/module-scope.ts 限制 — 默认拒绝事半
 *   - 系统角色: 仅 bootstrap / 测试 / demo fallback 使用
 *
 * 任何 role 字符串新增, 必须先来这个文件登记. 禁止散落字面量.
 */

export const INTERNAL_ROLES = [
  'owner',     // 公司主, env bootstrap 创建, 不可降级
  'admin',     // IT/系统管理员
  'manager',   // 主管 / 管理层
  'employee',  // 普通员工 (默认)
  'steward',   // HR / 数据管家 (绩效数据治理 · 兼治理审核)
  'champion',  // 业务冠军 / 推广大使
  'exec',      // 职能高管 (CMO/CSO/CFO 等) · 只读全景经营视图, 不含管理写权
  'intranet_editor', // 仅管理企业内网内容，不授予其它后台权限
  'finance',   // 财务 (KPI 通道 C 补录: 财务口径指标 · CHARTER-KPI §2.4)
  'internal_staff', // 内勤 (KPI 通道 C 补录: ERP 未覆盖的人工指标)
] as const;

export const EXTERNAL_ROLES = [
  'guest',     // 临时访客 (短期, 只读)
  'partner',   // 长期合作伙伴 / 客户接口人
  'contractor',// 承包商 / 乙方 (按项目)
  'dealer_sales',  // 经销商业务员 (PMS 报备/跟进)
  'dealer_admin',  // 经销商管理员 (PMS 全权限)
] as const;

export const ROLES = [...INTERNAL_ROLES, ...EXTERNAL_ROLES] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type ExternalRole = (typeof EXTERNAL_ROLES)[number];
export type Role = (typeof ROLES)[number];

const INTERNAL_SET: ReadonlySet<string> = new Set(INTERNAL_ROLES);
const EXTERNAL_SET: ReadonlySet<string> = new Set(EXTERNAL_ROLES);
const ROLES_SET: ReadonlySet<string> = new Set(ROLES);

export function isRole(s: string): s is Role {
  return ROLES_SET.has(s);
}

export function isInternalRole(s: string): s is InternalRole {
  return INTERNAL_SET.has(s);
}

export function isExternalRole(s: string): s is ExternalRole {
  return EXTERNAL_SET.has(s);
}

/** 任一 role 是外部角色 → 该用户被视为外部协作者 (走 module-scope 限制) */
export function hasExternalRole(roles: readonly string[]): boolean {
  return roles.some((r) => EXTERNAL_SET.has(r));
}

/** 任一 role 是内部角色 → 该用户被视为正式员工 */
export function hasInternalRole(roles: readonly string[]): boolean {
  // 动态角色由数据库维护，不会出现在编译期枚举中。只要不是明确的外部
  // 角色，就按内部角色处理；角色分配接口会保证编码确实存在且已启用。
  return roles.some((r) => INTERNAL_SET.has(r) || !EXTERNAL_SET.has(r));
}

/** Demo / 测试 fallback 用的全角色集 (生产不可达) */
export const DEMO_FULL_ROLES: Role[] = [
  'admin',
  'manager',
  'employee',
  'champion',
  'steward',
];

/** SSO 自助注册默认角色 (公司邮箱白名单激活) */
export const DEFAULT_EMPLOYEE_ROLES: Role[] = ['employee'];

/** Owner bootstrap 默认角色 */
export const OWNER_BOOTSTRAP_ROLES: Role[] = ['owner', 'admin'];

/** 外部申请审批默认角色 (Owner 可在审批时改写) */
export const DEFAULT_EXTERNAL_ROLES: Role[] = ['guest'];

/** 一段中文标签, 用于 admin UI 展示 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: '公司主',
  admin: '系统管理员',
  manager: '主管',
  employee: '员工',
  steward: 'HR / 管家',
  champion: '推广大使',
  exec: '职能高管',
  intranet_editor: '内网内容编辑',
  finance: '财务',
  internal_staff: '内勤',
  guest: '访客',
  partner: '合作伙伴',
  contractor: '承包商',
  dealer_sales: '经销商业务员',
  dealer_admin: '经销商管理员',
};

// ---------------------------------------------------------------------------
// 语义化权限角色组 (SSOT) · 端点禁止再手卷字面量, 一律引用这些常量
// ---------------------------------------------------------------------------

/**
 * 数据管家级特权组: owner + admin + steward.
 * 用于"超出本人范围的敏感数据访问/治理":
 *   - 隐私揭示 (privacy redactor → admin scope)
 *   - 读他人 Persona 画像 / 训练上下文
 *   - 360 全量可见 (看所有评价)
 *   - Skill 治理审核 (governance review)
 * 注: 'hr' / 'governance' 旧字面量统一收敛到 steward (steward 定义即 HR/数据管家).
 */
export const DATA_STEWARD_ROLES: Role[] = ['owner', 'admin', 'steward'];

/** 企业内网内容管理：数据管家 + 推广大使 + 专职内网编辑。 */
export const INTRANET_EDITOR_ROLES: Role[] = [
  ...DATA_STEWARD_ROLES,
  'champion',
  'intranet_editor',
];

/**
 * PMS 管理写权组: owner + admin + manager + steward.
 * 用于"需要写/裁决的管理动作": 信息管理岗工作台(deal-desk)撞单仲裁/报备审核 · AI质量评估台(eval)读数.
 */
export const PMS_MANAGEMENT_ROLES: Role[] = ['owner', 'admin', 'manager', 'steward'];

/**
 * PMS 选型规则集维护组: 管理写权组 + 推广大使(champion, 通常挂"研"/产品口).
 * 选型规则一经发布即改变全体经销商推荐结果, 属治理敏感写操作 → 排除普通 employee。
 */
export const PMS_SELECTOR_MAINTAINER_ROLES: Role[] = [...PMS_MANAGEMENT_ROLES, 'champion'];

/**
 * PMS 全公司经营视图(只读)组: 管理写权组 + 职能高管(exec) + 财务(finance).
 * 用于"看全公司驾驶舱/分析全景但不必拿管理写权":
 *   - exec (CMO/CSO 等): 需要全景销售+财务异常, 但不给 deal-desk 裁决权.
 *   - finance: 财务口径本就应看公司级财务异常(合同积压/业绩缺口), 修正其此前被排除的矛盾.
 * 驾驶舱只读(POST 405), 故授予 company scope 不带来任何写副作用.
 */
export const PMS_COMPANY_VIEW_ROLES: Role[] = [...PMS_MANAGEMENT_ROLES, 'exec', 'finance'];

/**
 * Memory 治理工作台角色组 (宪章 §8 升级/降级签批): 数据管家组 + 管理层 + 职能高管.
 * 用于 /api/tandem/memory 的 promotion / downgrade / list 端点的浏览与裁决门禁.
 * 纯外部协作者 (guest/partner/contractor/dealer_*) 一律无权进入知识治理.
 * 注: 具体"签字角色 (ceo/clevel/team_leader/…)"的身份匹配由 promotion-flow.authorizeSignerRole 二次校验.
 */
export const MEMORY_GOVERNANCE_ROLES: Role[] = [...DATA_STEWARD_ROLES, 'manager', 'exec'];
