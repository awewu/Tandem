/**
 * Organization · 组织实体 (借鉴企业微信「上下游」供应链模型)
 *
 * 企业微信把"人"分四种身份, 不是一套登录走天下:
 *   - 内部成员      — 本企业员工, 组织架构内
 *   - 上下游        — 供应链伙伴 (经销商/门店/供应商), 由上游企业单向管理
 *   - 互联企业      — 集团关联公司, 双向可见
 *   - 外部联系人    — CRM 式客户联系人
 *
 * Tandem 落地 (本期: anchor + downstream + individual):
 *   - anchor      上游本部 (你自己的公司, 单例, 固定 id)
 *   - downstream  下游企业 (经销商/供应商; 挂在 anchor 下形成供应链树)
 *   - individual  个人下游 (没有企业微信的小经销商, 用个人微信/手机加入)
 *
 * 关键边界: 下游成员只看上下游工作台, 看不到上游内部组织;
 *           内部员工眼里下游是"外部"。这条边界由 roles + membershipType 共同兜底。
 */

export type OrganizationType = 'anchor' | 'downstream' | 'individual';

export type OrganizationCategory =
  | 'dealer'       // 经销商
  | 'supplier'     // 供应商
  | 'store'        // 门店 / 加盟商
  | 'contractor'   // 承包商 / 乙方
  | 'partner';     // 一般合作伙伴

export type OrganizationStatus = 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  /** 下游组织挂在哪个上游 (anchor) 下; anchor 自身为 null */
  parentOrgId?: string | null;
  /** 下游分类 (anchor 不需要) */
  category?: OrganizationCategory;
  /** 多租户隔离 (与 user.tenantId 对齐) */
  tenantId: string;
  status: OrganizationStatus;
  createdAt: string;
  /** 建立此下游关系的上游管理员 userId */
  createdBy?: string;
}

/**
 * 成员身份类型 — 决定一个 user 与组织的关系, 进而决定可见边界。
 *   internal             正式员工 (anchor 内)
 *   upstream_downstream  下游企业成员 (有企业微信的经销商/供应商员工)
 *   individual           个人下游 (个人微信/手机加入的小经销商)
 *   linked               互联企业成员 (集团关联, 预留)
 *   pending              已登录但尚未归属任何组织 (待上游/管理员分配) — 最小权限隔离态
 */
export type MembershipType =
  | 'internal'
  | 'upstream_downstream'
  | 'individual'
  | 'linked'
  | 'pending';

/**
 * 默认上游本部组织 id (单上游部署).
 * 固定常量 → bootstrap 幂等创建 + 历史 default 租户用户回填时可确定性引用。
 */
export const ANCHOR_ORG_ID = 'org_anchor_default';

/** 内部成员身份 (走 anchor 全功能) */
export function isInternalMembership(t?: MembershipType): boolean {
  return t === 'internal';
}

/** 外部 / 上下游成员身份 (走 /hub 受限工作台) */
export function isExternalMembership(t?: MembershipType): boolean {
  return t === 'upstream_downstream' || t === 'individual';
}

/** 尚未归属组织 (待分配, 最小权限) */
export function isPendingMembership(t?: MembershipType): boolean {
  return t === undefined || t === 'pending';
}
