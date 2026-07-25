/**
 * PMS (项目报备全生命周期管理系统) · 类型定义 SSOT
 *
 * 定位: 商用/轻商设备项目管理 (项目型 L2C + 经销商 DMS + 资产型售后 FSM)
 * 业务: 报备 → 跟进 → 成交/丢单 → 设备交付 → 经销商施工/调试/维保回报
 * 边界: PMS 主要使用方 = 经销商(外部); Tandem = 内部管理系统
 *
 * KvStore collections: 31 个 (pms_* 前缀)
 */

// ============================================================================
// 核心实体 (一期 MVP)
// ============================================================================

export interface Opportunity {
  id: string;
  tenantId: string;
  orgId: string; // 经销商组织 ID (下游 org)

  // === 报备信息 ===
  reportedBy: string; // 报备人 userId
  reportedAt: string;
  dealerOrgId: string; // 一级经销商 ID
  secondaryDealerOrgId?: string; // 二级经销商 ID (可选)

  // === 项目基本信息 ===
  projectName: string; // 项目名称 (含地名+单位+性质+用水类型)
  projectType: 'new_construction' | 'renovation' | 'replacement' | 'maintenance';
  customerName: string; // 终端客户名称
  customerContact: string; // 联系人
  customerPhone: string; // 联系电话
  customerAddress: string; // 项目地址
  customerType?: 'hotel' | 'factory' | 'school' | 'apartment' | 'hospital' | 'government' | 'other';
  contactPerson: string; // 联系人 (兼容旧字段)
  contactPhone: string; // 联系电话 (兼容旧字段)
  address: string; // 项目地址 (兼容旧字段)
  addressGeo?: { lat: number; lng: number }; // 地理坐标 (查重用)
  estimatedAmount: number; // 预估金额
  expectedCloseDate: string; // 预计成交日期
  productRequirements: string; // 产品需求描述

  // === 产品明细 ===
  productItems: ProductItem[];
  totalAmount: number; // 总金额

  // === 阶段与状态 ===
  stage: OpportunityStage; // 当前阶段
  status: 'active' | 'won' | 'lost' | 'duplicate' | 'cancelled' | 'archived';
  stageEnteredAt: string; // 进入当前阶段时间
  lastFollowUpAt?: string; // 最后跟进时间

  // === 查重 ===
  dedupeKey: string; // 查重键 (customerName + address hash)
  duplicateCheckId?: string; // 关联查重记录 ID
  isDuplicate: boolean; // 是否撞单
  duplicateStatus?: 'pending' | 'questioned' | 'arbitrating' | 'resolved';

  // === 审批 ===
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;

  // === 结果跟踪 ===
  wonAt: string | null; // 赢单时间
  lostAt: string | null; // 丢单时间
  lostReason: string | null; // 丢单原因
  publicPoolEntryAt: string | null; // 进入公海池时间

  // === 90 天管控 ===
  daysSinceLastFollowUp?: number; // 未跟进天数
  warningLevel?: 'none' | 'yellow' | 'red'; // 预警级别 (75天黄, 90天红)
  cancelledAt?: string; // 取消时间 (90天超期)
  recoveredAt?: string; // 恢复时间 (7天内)
  releasedToPoolAt?: string; // 释放到公海时间 (二次超期)

  // === 元数据 ===
  source?: 'ys' | 'manual' | 'import'; // 数据来源
  sourceRefId?: string; // 源系统 ID (YS 同步)
  archivedAt?: string; // 软删除
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStage =
  | 'reported' // 报备
  | 'following' // 跟进中
  | 'quoted' // 已报价
  | 'contracted' // 已签约
  | 'delivered' // 已交付
  | 'closed' // 已结案
  | 'visit' // 拜访
  | 'proposal' // 方案
  | 'bidding' // 招标
  | 'quote' // 报价
  | 'negotiation' // 谈判
  | 'contract' // 签约
  | 'delivery' // 设备交付
  | 'won' // 赢单(归档)
  | 'lost'; // 丢单(归因)

export interface ProductItem {
  productId?: string; // 产品目录 ID (导入后关联)
  productModel: string; // 产品型号
  productName: string; // 产品名称
  quantity: number; // 数量
  unitPrice: number; // 单价
  amount: number; // 小计
  // === BOM (三期) ===
  bomItems?: BomItem[]; // 子部件
  // === 计划量 vs 实际量 (三期) ===
  plannedQuantity?: number; // 计划交付量
  actualDeliveredQuantity?: number; // 实际交付量
}

export interface FollowUpRecord {
  id: string;
  tenantId: string;
  orgId: string;
  opportunityId: string;
  userId: string; // 跟进人
  stage: OpportunityStage; // 跟进时所处阶段
  content: string; // 跟进内容
  nextSteps?: string; // 下一步计划
  attachments?: string[]; // 附件 URL
  followedAt: string;
  createdAt: string;
}

export interface DuplicateCheck {
  id: string;
  tenantId: string;
  opportunityId: string | null; // 新报备商机 ID (查重时为 null)
  // === 查重输入 ===
  customerName: string;
  customerAddress: string;
  projectName: string;
  customerPhone: string;
  // === 查重结果 ===
  status: 'pass' | 'warning' | 'duplicate';
  matchedOpportunities: string[]; // 匹配到的商机 ID
  matchDetails: Array<{
    opportunityId: string;
    dimensions: string[];
    similarity: number;
  }>;
  // === 审核 ===
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  // === 元数据 ===
  checkedAt: string;
  checkedBy: string;
}

export interface DuplicateScore {
  customerName: number; // 0-25
  address: number; // 0-25 (500米内)
  contactPhone: number; // 0-20
  projectName: number; // 0-15 (语义相似度)
  productOverlap: number; // 0-15
  total: number; // 0-100
  level: 'high' | 'medium' | 'low';
}

export interface PriceApplication {
  id: string;
  tenantId: string;
  orgId: string;
  opportunityId: string;
  appliedBy: string; // 申请人
  productItems: ProductItem[]; // 申请价格的产品
  requestedDiscount: number; // 申请折扣 %
  reason: string; // 申请理由
  // === 审批 ===
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  // === 审批后价格 ===
  approvedPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  tenantId: string;
  orgId: string;
  opportunityId: string;
  // === 合同信息 ===
  contractNumber: string; // 合同编号
  signedBy: string; // 签约人 (经销商)
  signedWithCustomer: string; // 终端客户名称
  signedAt: string; // 签约日期
  totalAmount: number; // 合同金额
  productItems: ProductItem[];
  // === 审批 ===
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  // === 交付 ===
  deliveryOrderId?: string; // 关联交付工单 ID (合同生效后自动创建)
  // === 元数据 ===
  attachments?: string[]; // 合同附件
  createdAt: string;
  updatedAt: string;
}

export interface PublicPoolEntry {
  id: string;
  tenantId: string;
  opportunityId: string;
  releasedAt: string; // 释放到公海时间
  releasedReason: 'ninety_day_timeout' | 'manual_release' | 'dealer_inactive';
  protectionPeriod?: number; // 保护期 (天)
  protectionExpiresAt?: string; // 保护期到期时间
  claimedBy: string | null; // 认领人
  claimedAt: string | null; // 认领时间
  status: 'available' | 'claimed' | 'expired';
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  orgId: string;
  entityType: 'opportunity' | 'price_application' | 'contract' | 'qualification' | 'delivery_design';
  entityId: string;
  requestedBy: string;
  approvalLevel: number; // 审批级别 (1/2/3...)
  approvers: string[]; // 审批人 userIds
  status: 'pending' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 预警与推送 (二期)
// ============================================================================

export interface AlertMessage {
  id: string;
  tenantId: string;
  orgId: string;
  // === 预警信息 ===
  type: 'stage_timeout' | 'ninety_day_warning' | 'maintenance_due' | 'qualification_expiring' | 'production_capacity';
  severity: 'info' | 'warning' | 'critical';
  entityType: 'opportunity' | 'delivery_order' | 'maintenance' | 'qualification' | 'production_forecast';
  entityId: string;
  message: string;
  // === 推送 ===
  targetRole: string; // 目标角色
  targetUserIds?: string[]; // 目标用户 (角色解析后)
  channels: NotificationChannel[]; // 推送渠道
  sentAt?: string;
  // === 升级阶梯 ===
  escalationLevel: number; // 升级级别 (0=初始, 1/2/3=逐级升级)
  escalatedTo?: string; // 升级到的角色
  escalatedAt?: string;
  // === 处理 ===
  status: 'pending' | 'sent' | 'acted' | 'escalated' | 'expired';
  actedBy?: string; // 处理人
  actedAt?: string;
  createdAt: string;
}

export type NotificationChannel = 'im' | 'wechat' | 'sms' | 'email';

export interface NotificationRule {
  id: string;
  tenantId: string;
  // === 规则 ===
  alertType: AlertMessage['type'];
  targetRole: string; // 接收角色
  channels: NotificationChannel[]; // 推送渠道
  // === SLA 与升级 ===
  slaMinutes?: number; // SLA 时限 (分钟)
  escalateToRole?: string; // 超时升级到的角色
  // === 去重与聚合 ===
  dedupeWindow?: number; // 去重窗口 (分钟)
  digestMode?: 'none' | 'daily' | 'weekly'; // 静默聚合模式
  // === 元数据 ===
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 经销商组织与资质 (一期 + 三期)
// ============================================================================

export interface DealerOrgProfile {
  id: string;
  tenantId: string;
  orgId: string; // 关联 Organization ID
  // === 经销商信息 ===
  level: 'tier1' | 'tier2'; // 一级/二级
  parentDealerId: string | null; // 一级经销商 ID (二级经销商必填)
  region: string; // 区域
  // === 联系信息 ===
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  businessLicense: string | null;
  // === 状态 ===
  status: 'active' | 'suspended';
  // === 元数据 ===
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface DealerQualification {
  id: string;
  tenantId: string;
  dealerOrgId: string;
  // === 资质信息 ===
  type: 'business_license' | 'tax_registration' | 'iso_cert' | 'safety_cert' | 'other';
  certNumber: string; // 证书编号
  issuer: string; // 发证机构
  issuedAt: string;
  expiresAt: string | null;
  fileUrl: string | null;
  // === 状态 ===
  status: 'valid' | 'expired' | 'revoked';
  // === 元数据 ===
  uploadedAt: string;
  uploadedBy: string;
}

export interface DealerMemberSummary {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  dealerOrgId: string;
  joinedAt: string;
}

// ============================================================================
// 设备交付 (三期)
// ============================================================================

export interface DeliveryOrder {
  id: string;
  tenantId: string;
  orgId: string;
  contractId: string; // 关联合同
  // === 交付信息 ===
  stage: 'pending' | 'in_progress' | 'completed';
  scheduledStartDate: string;
  scheduledEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  installationAddress: string;
  contactPerson: string;
  contactPhone: string;
  completionRate: number; // 0-100
  // === 元数据 ===
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface DeliveryTask {
  id: string;
  tenantId: string;
  orgId: string;
  deliveryOrderId: string;
  // === 任务信息 ===
  type: 'design' | 'production' | 'shipping' | 'installation' | 'commissioning' | 'handover';
  assignedTo: string; // userId or orgId
  assigneeType: 'internal' | 'dealer' | 'service_provider';
  description: string;
  dueDate?: string;
  // === 状态 ===
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
  completedBy?: string;
  completedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  // === 元数据 ===
  createdAt: string;
  updatedAt: string;
}

export interface AcceptanceRecord {
  id: string;
  tenantId: string;
  orgId: string;
  deliveryOrderId: string;
  // === 验收信息 ===
  acceptedBy: string; // 经销商验收人
  acceptedAt: string;
  acceptanceType: 'arrival' | 'installation' | 'commissioning';
  result: 'pass' | 'fail' | 'conditional_pass';
  // === 资质校验 ===
  requiredQualifications?: string[]; // 需要的资质类型
  qualificationCheckPassed: boolean;
  // === 终端客户签认 ===
  endCustomerName?: string;
  endCustomerSignedBy?: string;
  endCustomerSignedAt?: string;
  // === 元数据 ===
  notes?: string;
  attachments?: string[];
  createdAt: string;
}

export interface CommissioningRecord {
  id: string;
  tenantId: string;
  orgId: string;
  deliveryOrderId: string;
  // === 调试信息 ===
  commissionedBy: string; // 调试人 (经销商/服务商)
  commissionedAt: string;
  equipmentSNs?: string[]; // 关联设备 SN 码
  // === 资质校验 ===
  requiredQualifications?: string[];
  qualificationCheckPassed: boolean;
  // === 调试结果 ===
  result: 'pass' | 'fail' | 'conditional_pass';
  testResults?: Record<string, any>; // 测试数据
  // === 元数据 ===
  notes?: string;
  attachments?: string[];
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  tenantId: string;
  orgId: string;
  deliveryOrderId?: string;
  equipmentSNId?: string; // 关联设备 SN
  // === 维保信息 ===
  type: 'routine' | 'repair' | 'emergency' | 'inspection' | 'amc'; // amc = 年度维保合同
  reportedBy: string; // 报修人 (经销商/终端客户)
  reportedAt: string;
  description: string;
  // === 执行 ===
  assignedTo: string; // 经销商/服务商
  assigneeType: 'dealer' | 'service_provider';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  // === 资质校验 ===
  requiredQualifications?: string[];
  qualificationCheckPassed: boolean;
  // === 厂家售后支持 ===
  factorySupportRequested: boolean;
  factorySupportRequestedAt?: string;
  factorySupportProvidedBy?: string;
  factorySupportProvidedAt?: string;
  // === 终端客户反馈 ===
  customerFeedbackId?: string;
  customerSatisfaction?: number; // 1-5
  // === 元数据 ===
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServiceProviderAssignment {
  id: string;
  tenantId: string;
  orgId: string; // 经销商 orgId
  deliveryOrderId?: string;
  maintenanceRecordId?: string;
  // === 委托信息 ===
  serviceProviderOrgId: string; // 服务商组织 ID
  taskType: 'installation' | 'commissioning' | 'maintenance';
  reason: string; // 委托理由 (如: 经销商无资质)
  // === 状态 ===
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  acceptedBy?: string;
  acceptedAt?: string;
  completedAt?: string;
  rejectionReason?: string;
  // === 元数据 ===
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 设备 SN 码 (三期 + 四期)
// ============================================================================

export interface EquipmentSN {
  id: string;
  tenantId: string;
  // === SN 码信息 ===
  snCode: string; // 序列号 (唯一)
  productId?: string; // 产品目录 ID
  productModel: string;
  batchNumber?: string; // 生产批次号
  manufacturedAt?: string; // 生产日期
  // === 资产层级 (父子 SN) ===
  parentSNId: string | null; // 父设备 SN ID (机组→部件)
  childSNIds?: string[]; // 子设备 SN ID 列表
  // === 交付关联 ===
  deliveryOrderId: string | null;
  opportunityId?: string;
  dealerOrgId?: string;
  // === 安装信息 ===
  installedAt?: string;
  installedLocation?: string;
  installedBy?: string; // 安装人 (经销商/服务商)
  endCustomerName?: string;
  endCustomerContact?: string;
  // === 质保 ===
  warrantyStartsAt?: string;
  warrantyEndsAt?: string;
  warrantyStatus?: 'active' | 'expired' | 'void';
  // === 维修历史 ===
  maintenanceRecordIds?: string[];
  partsReplacements?: PartsReplacement[];
  // === 召回 ===
  recallIds?: string[]; // 关联召回 ID
  // === 元数据 ===
  source?: 'mes' | 'import' | 'manual'; // 数据来源
  sourceRefId?: string;
  status: 'in_stock' | 'shipped' | 'installed' | 'in_service' | 'decommissioned';
  createdAt: string;
  updatedAt: string;
}

export interface PartsReplacement {
  replacedAt: string;
  partModel: string;
  partSN?: string;
  replacedBy: string; // 维修人
  maintenanceRecordId?: string;
}

export interface EquipmentTelemetry {
  id: string;
  tenantId: string;
  equipmentSNId: string;
  snCode: string;
  // === 遥测数据 ===
  timestamp: string;
  metrics: Record<string, number>; // 温度/压力/流量/功率等
  // === 告警 ===
  alerts?: {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    triggeredAt: string;
  }[];
  // === 自动工单 ===
  autoMaintenanceRecordId?: string; // 告警自动创建的维保工单
  createdAt: string;
}

// ============================================================================
// 渠道返利 (三期)
// ============================================================================

export interface RebatePolicy {
  id: string;
  tenantId: string;
  // === 规则 ===
  name: string;
  dealerLevel: 'primary' | 'secondary' | 'all';
  productCategories?: string[]; // 适用产品品类
  // === 阶梯 ===
  tiers: {
    minAmount: number; // 最低金额
    maxAmount?: number; // 最高金额 (可选, 最后一档无上限)
    rebateRate: number; // 返利率 %
  }[];
  // === 结算周期 ===
  settlementPeriod: 'monthly' | 'quarterly' | 'yearly';
  // === 元数据 ===
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RebateAccrual {
  id: string;
  tenantId: string;
  dealerOrgId: string;
  policyId: string;
  // === 计提信息 ===
  period: string; // 周期 (YYYY-MM / YYYY-Q1 / YYYY)
  totalSalesAmount: number; // 销售总额
  rebateRate: number; // 命中的返利率
  rebateAmount: number; // 返利金额
  // === 结算 ===
  status: 'accrued' | 'approved' | 'paid' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  rejectionReason?: string;
  // === 元数据 ===
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 经销商在线订货 (三期)
// ============================================================================

export interface DealerOrder {
  id: string;
  tenantId: string;
  dealerOrgId: string;
  // === 订货信息 ===
  orderNumber: string;
  productItems: ProductItem[];
  totalAmount: number;
  orderType: 'stock' | 'project'; // 备货 / 项目订货
  relatedOpportunityId?: string; // 关联商机 (项目订货)
  // === 状态 ===
  status: 'draft' | 'submitted' | 'confirmed' | 'shipped' | 'received' | 'cancelled';
  submittedAt?: string;
  confirmedBy?: string; // 瑞美确认人
  confirmedAt?: string;
  shippedAt?: string;
  trackingNumber?: string;
  receivedBy?: string; // 经销商收货人
  receivedAt?: string;
  // === 元数据 ===
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CPQ / BOM 级报价 (三期)
// ============================================================================

export interface BomItem {
  id: string;
  parentProductModel: string; // 所属机组型号
  componentModel: string; // 子部件型号
  componentName: string;
  quantity: number; // 单机用量
  unitPrice: number; // 部件单价
  amount: number; // = quantity * unitPrice
  // === 配置化 ===
  isOptional?: boolean; // 可选件 (选配)
  isSelected?: boolean; // 本次是否选中
  configGroup?: string; // 互斥配置组 (同组只能选一)
  constraints?: string[]; // 约束条件 (如: 选A必选B)
}

// ============================================================================
// 甲方免登录触点 (四期)
// ============================================================================

export interface CustomerFeedback {
  id: string;
  tenantId: string;
  equipmentSNId?: string;
  snCode?: string;
  // === 反馈信息 ===
  feedbackType: 'repair_request' | 'satisfaction' | 'complaint' | 'inquiry';
  customerName: string;
  customerPhone: string;
  description: string;
  // === 满意度 ===
  satisfactionScore?: number; // 1-5
  // === 处理 ===
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved';
  assignedTo?: string; // 经销商/服务商
  resolvedAt?: string;
  // === 自动转工单 ===
  autoMaintenanceRecordId?: string;
  // === 元数据 ===
  submittedAt: string;
  submittedVia: 'qr_code' | 'web' | 'phone' | 'wechat';
  createdAt: string;
}

// ============================================================================
// 经销商价值层 (四期)
// ============================================================================

export interface DuplicateAppeal {
  id: string;
  tenantId: string;
  orgId: string;
  duplicateCheckId: string;
  opportunityId: string;
  // === 申诉信息 ===
  appealedBy: string;
  appealedAt: string;
  reason: string;
  evidence?: string[]; // 凭证 (时间戳/聊天记录/合同草稿)
  // === 仲裁 ===
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  arbitratedBy?: string; // 销售管理部
  arbitratedAt?: string;
  arbitrationResult?: string;
  // === 元数据 ===
  createdAt: string;
  updatedAt: string;
}

export interface DealerHealthScore {
  id: string;
  tenantId: string;
  dealerOrgId: string;
  // === 评分周期 ===
  period: string; // YYYY-QX
  // === 综合分 ===
  score: number; // 0-100
  // === 多维评分 ===
  dimensions: {
    compliance: number; // 资质合规
    performance: number; // 业绩达成
    service: number; // 服务质量
    cooperation: number; // 协作配合
  };
  // === 扣分明细 ===
  deductions: Array<{
    dimension: string;
    reason: string;
    points: number;
  }>;
  // === 元数据 ===
  calculatedAt: string;
}

// ============================================================================
// 业绩管理系统 (四期)
// ============================================================================

export interface PerformanceTarget {
  id: string;
  tenantId: string;
  // === 目标维度 ===
  dimension: 'region' | 'channel' | 'product_line' | 'dealer_org' | 'sales_person';
  dimensionValue: string; // 区域名/渠道名/产品线/经销商ID/销售人员ID
  // === 周期 ===
  period: string; // YYYY-MM / YYYY-Q1 / YYYY
  periodType: 'monthly' | 'quarterly' | 'yearly';
  // === 目标值 ===
  targetAmount: number; // 目标金额
  targetCount?: number; // 目标数量 (可选)
  // === 实际值 (快照回填) ===
  actualAmount?: number;
  actualCount?: number;
  achievementRate?: number; // 达成率 %
  // === 同比环比 ===
  yoyGrowth?: number; // 同比增长 %
  momGrowth?: number; // 环比增长 %
  // === 元数据 ===
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandGenLead {
  id: string;
  tenantId: string;
  orgId: string;
  // === 线索信息 ===
  leadSource: 'inbound' | 'outbound' | 'referral' | 'event' | 'partner' | 'existing';
  leadName: string;
  contactPerson: string;
  contactPhone: string;
  company?: string;
  // === 需求 ===
  demandDescription?: string;
  estimatedAmount?: number;
  estimatedTimeline?: string;
  // === 转化 ===
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  convertedToOpportunityId?: string; // 转化为商机 ID
  convertedAt?: string;
  lostReason?: string;
  // === 跟进 ===
  assignedTo?: string;
  lastContactedAt?: string;
  // === 元数据 ===
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeyProductCampaign {
  id: string;
  tenantId: string;
  // === 活动信息 ===
  productModel: string; // 主推产品型号
  productName: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  // === 目标 ===
  targetAmount: number;
  targetCount?: number;
  // === 策略 ===
  strategy?: string; // 推广策略描述
  incentives?: string; // 激励措施
  // === 进展 (按区域/经销商) ===
  progressByRegion?: Record<string, { amount: number; count: number }>;
  progressByDealer?: Record<string, { amount: number; count: number }>;
  // === 实际达成 ===
  actualAmount?: number;
  actualCount?: number;
  achievementRate?: number;
  // === 状态 ===
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  // === 元数据 ===
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 产品目录 + 客户体系 (导入驱动, 不写死)
// ============================================================================

export interface ProductCatalog {
  id: string;
  tenantId: string;
  // === 骨架字段 (导入时填充) ===
  series: string; // 产品系列 (如: 热水器/热泵/太阳能)
  seriesCode?: string; // 系列编码 (导入系统标识)
  model: string; // 产品型号
  modelCode?: string; // 型号编码
  category?: string; // 品类 (如: 即热式/储水式/商用)
  specification?: string; // 规格 (如: 12kW/150L)
  unit?: string; // 单位 (台/套)
  // === 价格 ===
  listPrice?: number; // 标准价 (从 YS 或导入)
  costPrice?: number; // 成本价 (内部, 经销商不可见)
  minPrice?: number; // 最低价 (折扣底线)
  // === BOM ===
  bomItems?: BomItem[]; // 子部件 (CPQ 用)
  // === 关联 ===
  parentModel?: string; // 父型号 (机组→部件)
  attributes?: Record<string, string>; // 扩展属性 (导入系统自定义字段)
  // === 元数据 ===
  source?: 'ys' | 'import' | 'manual'; // 数据来源
  sourceRefId?: string; // 源系统 ID
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAccount {
  id: string;
  tenantId: string;
  // === 骨架字段 (导入时填充) ===
  name: string; // 客户名称
  externalCode?: string; // 外部系统编码
  type?: 'hotel' | 'factory' | 'school' | 'apartment' | 'hospital' | 'government' | 'other';
  // === 层级 ===
  parentAccountId?: string; // 父客户 (集团→分店)
  level?: number; // 层级深度
  // === 关联 ===
  region?: string; // 区域
  channel?: string; // 渠道
  dealerOrgId?: string; // 关联经销商
  // === 扩展 ===
  attributes?: Record<string, string>; // 导入系统自定义字段
  // === 元数据 ===
  source?: 'ys' | 'import' | 'manual';
  sourceRefId?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// AI 报价推荐 (三期, 预留接口)
// ============================================================================

export interface QuoteRecommendation {
  id: string;
  tenantId: string;
  opportunityId?: string; // 关联商机
  // === 客户需求 ===
  customerRequirements: {
    scenario?: string; // 应用场景 (酒店/公寓/工厂...)
    demandPoints?: number; // 需求点数 (用水点)
    flowRate?: number; // 需求流量 (L/min)
    temperatureRange?: string; // 温度需求
    budget?: number; // 预算
    region?: string; // 区域 (影响物流/安装)
    otherConstraints?: string; // 其他约束
  };
  // === AI 推荐 ===
  recommendations: {
    productId: string; // 产品目录 ID
    productModel: string;
    quantity: number;
    unitPrice: number; // 建议单价
    totalPrice: number;
    matchScore: number; // 匹配度 0-100
    matchReasons: string[]; // 推荐理由
    alternatives?: {
      // 对比选择
      productId: string;
      productModel: string;
      pros: string[];
      cons: string[];
      priceDelta: number; // 价差
    }[];
  }[];
  // === 元数据 ===
  aiModel?: string; // 使用的 AI 模型
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 分析体系 (四期)
// ============================================================================

export interface ComparisonResult {
  dimension: string;
  dimensionValue: string;
  target: number;
  actual: number;
  variance: number; // 差异
  varianceRate: number; // 差异率 %
  yoyGrowth?: number;
  momGrowth?: number;
  // === AI 归因 ===
  aiAttribution?: {
    primaryReasons: string[];
    suggestedActions: string[];
    confidence: number; // 0-100
  };
}

// ============================================================================
// 项目型销售骨架 (Phase 1) · 项目为核心对象 + 决策链 + 规格指定矩阵
// ============================================================================

/** 项目生命周期阶段 (工程项目型) */
export type ProjectStage =
  | 'lead' // 线索/立项
  | 'design' // 设计选型 (争取品牌指定)
  | 'tender' // 招投标
  | 'awarded' // 中标
  | 'delivery' // 交付
  | 'warranty' // 质保
  | 'closed' // 结案
  | 'lost'; // 丢标

export type ProjectStatus = 'active' | 'won' | 'lost' | 'archived';

export type ProjectType = 'new_construction' | 'renovation' | 'replacement' | 'expansion';

export interface Project {
  id: string;
  tenantId: string;
  orgId: string;
  projectCode: string; // 项目编号 (租户内唯一)
  projectName: string;
  projectType: ProjectType;
  customerName?: string;
  customerAccountId?: string;
  region?: string;
  channel?: string;
  address?: string;
  addressGeo?: { lat: number; lng: number };
  designInstitute?: string; // 设计院
  stage: ProjectStage;
  status: ProjectStatus;
  estimatedValue?: number;
  ownerId?: string; // 项目负责人
  expectedTenderDate?: string;
  expectedAwardDate?: string;
  detectedAt?: string; // 项目发现日期
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** 干系人角色 (决策链) */
export type StakeholderRole =
  | 'owner' // 甲方/业主
  | 'architect' // 设计院
  | 'design_engineer' // 设计工程师 (specifier)
  | 'general_contractor' // 总包
  | 'installer' // 安装商 (真正的买家)
  | 'distributor' // 经销商
  | 'consultant' // 顾问/审图
  | 'other';

export type StakeholderInfluence = 'high' | 'medium' | 'low';

export interface ProjectStakeholder {
  id: string;
  tenantId: string;
  projectId: string;
  role: StakeholderRole;
  name: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  influence: StakeholderInfluence;
  isChampion: boolean; // 内线/支持者
  isEconomicBuyer: boolean; // 经济决策人
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** 我方品牌在某设备族的指定状态 */
export type SpecBrandStatus =
  | 'not_specified' // 未指定
  | 'basis_of_design' // 设计基准 (最强)
  | 'specified' // 已指定
  | 'alternate' // 备选/入围
  | 'substituted' // 被替换
  | 'lost'; // 丢失

export type SpecStage = 'design' | 'tender' | 'awarded';

export interface SpecPosition {
  id: string;
  tenantId: string;
  projectId: string;
  equipmentFamily: string; // 设备族 (冷水机组/空调箱/热泵/防火阀...)
  ourBrandStatus: SpecBrandStatus;
  ourProductSeriesCode?: string;
  ourProductModel?: string;
  competitorBrand?: string;
  competitorModel?: string;
  estimatedValue?: number;
  specStage: SpecStage;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** 决策链完整度诊断 (MEDDICC 内核, 纯函数产出) */
export interface DecisionChainHealth {
  totalStakeholders: number;
  presentRoles: StakeholderRole[];
  missingCriticalRoles: StakeholderRole[]; // owner/design_engineer/installer 缺失
  hasChampion: boolean;
  hasEconomicBuyer: boolean;
  completeness: number; // 0-100
}

/** 规格指定盘面汇总 (spec-in 战况) */
export interface SpecCoverage {
  totalPositions: number;
  wonValue: number; // basis_of_design + specified 的预算合计
  atRiskValue: number; // alternate 的预算合计
  lostValue: number; // substituted + lost 的预算合计
  totalValue: number;
  specWinRate: number; // wonValue / totalValue %
  atRiskCount: number;
}

// ============================================================================
// 招投标 + 提交物 (Phase 2)
// ============================================================================

export type TenderType = 'open' | 'invited' | 'competitive_negotiation' | 'single_source';
export type TenderStatus = 'preparing' | 'submitted' | 'opened' | 'won' | 'lost';

export interface Tender {
  id: string;
  tenantId: string;
  projectId: string;
  tenderNo?: string;
  tenderName: string;
  tenderType: TenderType;
  status: TenderStatus;
  bidAmount?: number; // 我方投标报价
  budgetAmount?: number; // 招标控制价
  publishedAt?: string;
  submitDeadline?: string;
  submittedAt?: string;
  openedAt?: string;
  winnerName?: string;
  ourRank?: number;
  result?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type SubmittalDocType =
  | 'drawing'
  | 'spec'
  | 'technical_proposal'
  | 'commercial_bid'
  | 'qualification'
  | 'other';
export type SubmittalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'revision_required';

export interface Submittal {
  id: string;
  tenantId: string;
  projectId: string;
  tenderId?: string;
  docType: SubmittalDocType;
  title: string;
  version: number;
  fileUrl?: string;
  status: SubmittalStatus;
  submittedTo?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  supersedesId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PerformanceDashboard {
  period: string;
  periodType: 'monthly' | 'quarterly' | 'yearly';
  // === 总览 ===
  overall: {
    targetAmount: number;
    actualAmount: number;
    achievementRate: number;
    yoyGrowth: number;
    momGrowth: number;
  };
  // === 分维度 ===
  byRegion: ComparisonResult[];
  byChannel: ComparisonResult[];
  byProductLine: ComparisonResult[];
  byDealer: ComparisonResult[];
  // === 线索开发 ===
  demandGenFunnel: {
    stage: string;
    count: number;
    conversionRate: number;
  }[];
  // === 主推产品 ===
  keyProductProgress: {
    productModel: string;
    targetAmount: number;
    actualAmount: number;
    achievementRate: number;
  }[];
  // === 预警 ===
  alerts: {
    dimension: string;
    dimensionValue: string;
    severity: 'warning' | 'critical';
    message: string;
  }[];
}
