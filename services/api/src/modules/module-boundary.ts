export const apiModuleBoundary = [
  'auth',
  'tenant',
  'crm',
  'diagnosis',
  'product-catalog',
  'quote',
  'design',
  'rysnova-bim',
  'ai-design',
  'delivery',
  'lifecycle',
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
  aftersales: {
    name: 'aftersales',
    apiNamespace: '/api/v2/aftersales',
    owner: 'customer-project-lifecycle-director',
    productSurface: 'dealer service tickets, dispatch, and warranty ledger (after-sales)',
    dataStores: ['postgresql'],
    requiresTenantScope: true,
    requiresAuditLog: true,
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
    owner: 'solution-design-rysnova-bim-director',
    productSurface: 'Rheem, Ruud, Everhot product catalog, SKUs, price books, and system packs',
    dataStores: ['postgresql', 'redis'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  quote: {
    name: 'quote',
    apiNamespace: '/api/v2/quote',
    owner: 'quote-cost-governor',
    productSurface: 'BOM, cost, tax, margin, promotion, quotation, and contract-ready offer',
    dataStores: ['postgresql', 'mongodb', 'redis'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  design: {
    name: 'design',
    apiNamespace: '/api/v2/design',
    owner: 'solution-design-rysnova-bim-director',
    productSurface: 'designer workbench, 2D layout, equipment placement, and customer sharing',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  'rysnova-bim': {
    name: 'rysnova-bim',
    apiNamespace: '/api/v2/rysnova-bim',
    owner: 'solution-design-rysnova-bim-director',
    productSurface: 'Rysnova BIM, drawings, schematics, standards checks, and engineering artifacts',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  'ai-design': {
    name: 'ai-design',
    apiNamespace: '/api/v2/ai-design',
    owner: 'solution-design-rysnova-bim-director',
    productSurface: 'AI design engine, rule automation, LLM orchestration, and trust-state proposals',
    dataStores: ['postgresql', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  delivery: {
    name: 'delivery',
    apiNamespace: '/api/v2/delivery',
    owner: 'customer-project-lifecycle-director',
    productSurface: 'construction milestones, material movement, acceptance, and settlement',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  lifecycle: {
    name: 'lifecycle',
    apiNamespace: '/api/v2/lifecycle',
    owner: 'iot-lifecycle-architect',
    productSurface: 'installed assets, warranties, service tickets, and IoT lifecycle handoff',
    dataStores: ['postgresql', 'mongodb', 'temporal-outbox'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true,
    iotBoundary: 'lifecycle_handoff_only'
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
    productSurface: 'release evidence, quality findings, agent progress, and control-plane governance',
    dataStores: ['postgresql', 'mongodb', 'object-storage'],
    requiresTenantScope: true,
    requiresAuditLog: true,
    requiresOpenApiContract: true,
    writeApisRequireOutbox: true
  },
  'file-artifact': {
    name: 'file-artifact',
    apiNamespace: '/api/v2/file-artifact',
    owner: 'rysnova-bim-engineering-builder',
    productSurface: 'object storage metadata, PDFs, drawings, BIM assets, renderings, and acceptance photos',
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
