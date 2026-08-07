export const apiModuleBoundary = [
  'auth',
  'tenant',
  'crm',
  'diagnosis',
  'product-catalog',
  'analytics',
  'governance',
  'file-artifact',
  'site-materials',
  'notification',
  'workflow',
  'compliance',
  'mdm',
  'growth',
  'entitlement',
  'cdp',
  'insight',
  'channel',
  'positioning',
  'gtmplan',
  'content',
  'activation',
  'metrics'
] as const;

// 客户赋能(独立产品线)模块：已从营销中台停挂载(目录留存·代码保留·可逆)，营销中台不暴露其 API，
// 对营销中台边界视为 planned(非活跃)；接缝 dispatch(线索派单) 仍留营销中台。
export const plannedApiInterfaces = [
  'quote',
  'design',
  'contracts',
  'bim',
  'delivery',
  'lifecycle',
  'aftersales'
] as const;

export type ApiModuleName = typeof apiModuleBoundary[number];

export interface ApiModuleBoundarySpec {
  name: ApiModuleName;
  apiNamespace: `/api/v2/${string}`;
  apiNamespaces?: `/api/v2/${string}`[];
  owner: string;
  productSurface: string;
  dataStores: string[];
  requiresTenantScope: boolean;
  requiresAuditLog: boolean;
  requiresOpenApiContract: boolean;
  writeApisRequireOutbox: boolean;
  iotBoundary?: 'lifecycle_handoff_only';
}

export const apiModuleBoundarySpecs: Record<ApiModuleName, ApiModuleBoundarySpec> = {
  auth: {
    name: 'auth',
    apiNamespace: '/api/v2/auth',
    owner: 'backend-platform-builder',
    productSurface: 'employees, dealers, customers, and headquarters login',
    dataStores: ['postgresql', 'redis'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  entitlement: {
    name: 'entitlement',
    apiNamespace: '/api/v2/entitlement',
    owner: 'backend-platform-builder',
    productSurface: 'commercial module subscription and per-tenant entitlement',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  cdp: {
    name: 'cdp',
    apiNamespace: '/api/v2/cdp',
    owner: 'data-platform-architect',
    productSurface: 'end-user unified profile, segmentation, and PIPL consent ledger',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  insight: {
    name: 'insight',
    apiNamespace: '/api/v2/insight',
    owner: 'data-platform-architect',
    productSurface: 'market insight and category-axis competitor intelligence (SoV, signals)',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  channel: {
    name: 'channel',
    apiNamespace: '/api/v2/channel',
    owner: 'backend-platform-builder',
    productSurface: 'channel/partner marketing: recruitment, tiering/certification, rebate (margin-gated), performance',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  positioning: {
    name: 'positioning',
    apiNamespace: '/api/v2/positioning',
    owner: 'brand-experience-architect',
    productSurface: 'brand messaging house per brand x category (promise, pillars, proof points, differentiation)',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  gtmplan: {
    name: 'gtmplan',
    apiNamespace: '/api/v2/gtmplan',
    owner: 'backend-platform-builder',
    productSurface: 'GTM planning: campaign budget/spend/MROI and three-tier OKR',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  content: {
    name: 'content',
    apiNamespace: '/api/v2/content',
    owner: 'brand-experience-architect',
    productSurface: 'content factory: brief to draft to review to publish, fact-grounded and compliance-gated',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  activation: {
    name: 'activation',
    apiNamespace: '/api/v2/activation',
    owner: 'backend-platform-builder',
    productSurface: 'promotion/activation: coupon, groupon, flashsale, fission, referral programs and participation',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  metrics: {
    name: 'metrics',
    apiNamespace: '/api/v2/metrics',
    owner: 'data-platform-architect',
    productSurface: 'metrics semantic layer: RLS read-model rollups + multi-touch attribution (replaces live OLTP aggregation)',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: false,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  tenant: {
    name: 'tenant',
    apiNamespace: '/api/v2/tenants',
    apiNamespaces: ['/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores'],
    owner: 'data-platform-architect',
    productSurface: 'multi-tenant dealer, store, staff, and headquarters scope',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  crm: {
    name: 'crm',
    apiNamespace: '/api/v2/crm',
    owner: 'backend-platform-builder',
    productSurface: 'customers, opportunities, interactions, and sales follow-up',
    dataStores: ['postgresql', 'mongodb'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  diagnosis: {
    name: 'diagnosis',
    apiNamespace: '/api/v2/diagnosis',
    owner: 'customer-project-lifecycle-director',
    productSurface: '瑞诺瓦 AI 问诊, pain capture, recommendation, and customer report',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  'product-catalog': {
    name: 'product-catalog',
    apiNamespace: '/api/v2/product-catalog',
    owner: 'product-domain-critic',
    productSurface: 'Rheem, Ruud, Everhot product catalog, SKUs, price books, and system packs',
    dataStores: ['postgresql', 'redis'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  analytics: {
    name: 'analytics',
    apiNamespace: '/api/v2/analytics',
    owner: 'orchestrator-chief',
    productSurface: 'headquarters rollup, dealer analytics, funnel, margin, and quality views',
    dataStores: ['postgresql', 'redis'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  governance: {
    name: 'governance',
    apiNamespace: '/api/v2/governance',
    owner: 'orchestrator-chief',
    productSurface: 'audit-log persistence and control-plane governance boundaries',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  'file-artifact': {
    name: 'file-artifact',
    apiNamespace: '/api/v2/file-artifact',
    owner: 'backend-platform-builder',
    productSurface: 'object storage metadata, PDFs, quotations, site media, and acceptance photos',
    dataStores: ['postgresql', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  'site-materials': {
    name: 'site-materials',
    apiNamespace: '/api/v2/site-materials',
    owner: 'brand-experience',
    productSurface: 'brand site local materials, Everhot banner carousel, and public preview assets',
    dataStores: ['filesystem', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: false
  },
  notification: {
    name: 'notification',
    apiNamespace: '/api/v2/notification',
    owner: 'backend-platform-builder',
    productSurface: 'customer, dealer, staff, and workflow notifications',
    dataStores: ['postgresql', 'redis', 'temporal-outbox'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  workflow: {
    name: 'workflow',
    apiNamespace: '/api/v2/workflow',
    owner: 'backend-platform-builder',
    productSurface: 'Temporal workflows, outbox delivery, retry, replay, and dead-letter operations',
    dataStores: ['postgresql', 'temporal-outbox'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  compliance: {
    name: 'compliance',
    apiNamespace: '/api/v2/compliance',
    owner: 'security-supply-chain',
    productSurface: 'PIPL consent, withdrawal, data retention policy, and PII encryption (等保2.0/PIPL/数据安全法)',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  mdm: {
    name: 'mdm',
    apiNamespace: '/api/v2/mdm',
    owner: 'data-platform-architect',
    productSurface: 'cross-board master data (global_product_id), single-writer reconciliation, and the outbox event bus',
    dataStores: ['postgresql', 'temporal-outbox'],
    requiresTenantScope: false,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  growth: {
    name: 'growth',
    apiNamespace: '/api/v2/growth',
    owner: 'orchestrator-chief',
    productSurface: '增长中枢 / Nexus Growth: opinion radar, copy copilot, GEO analyzer, and campaign ops (HQ marketing control plane)',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  }
};

export const targetApiSourceContract = {
  platform: 'Rhautt Nexus / 瑞合数智枢纽',
  framework: 'NestJS',
  httpAdapter: 'Fastify',
  architecture: 'DDD modular monolith',
  moduleCount: apiModuleBoundary.length,
  productionClaim: false,
  completionRule: 'source contract only until dependencies install and runtime boot proof passes'
} as const;

export function getApiModuleBoundary(name: ApiModuleName): ApiModuleBoundarySpec {
  return apiModuleBoundarySpecs[name];
}
