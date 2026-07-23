// eslint-disable-next-line @typescript-eslint/no-var-requires
const RysnovaArtifactService = require('../../../../../server/modules/rysnova-bim/rysnova-bim-artifact.service');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MemoryArtifactStorageAdapter } = require('../../../../../server/modules/rysnova-bim/artifact-storage.adapter');

export const RYSNOVA_BOOT_SMOKE_SCOPE = {
  tenantId: 'boot-smoke-tenant',
  dealerId: 'boot-smoke-dealer',
  storeId: 'boot-smoke-store',
  userId: 'boot-smoke-designer',
  role: 'designer',
};

export const RYSNOVA_BOOT_SMOKE_CUSTOMER_ID = 'boot-smoke-customer';
export const RYSNOVA_BOOT_SMOKE_PROJECT_ID = 'boot-smoke-project';
export const RYSNOVA_BOOT_SMOKE_REQUIRED_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report',
] as const;

function bootSmokeSignoffPayload() {
  return {
    approvalMode: 'share-to-customer',
    shareToCustomer: true,
    customerId: RYSNOVA_BOOT_SMOKE_CUSTOMER_ID,
    tier: 'balanced',
    project: {
      name: 'Rysnova boot-smoke 客户签核七件套',
      city: '上海',
      area: 168,
      houseType: '大平层',
      contractId: 'CNT-LITH-BOOT-SMOKE-001',
    },
    pricing: {
      targetMarginRate: 0.26,
      minMarginRate: 0.18,
      taxRate: 0.09,
      financingMonths: 36,
    },
    systems: [
      { type: 'hot_water', name: 'Rheem 中央热水' },
      { type: 'heating', name: 'Ruud 低温采暖' },
      { type: 'water_treatment', name: 'Everhot 全屋净水' },
      { type: 'fresh_air', name: 'Ruud 新风' },
      { type: 'air', name: 'Ruud 全空气' },
      { type: 'smart_control', name: '智能控制' },
    ],
    result: {
      input: { area: 168, city: '上海', houseType: '大平层' },
      recommendation: { recommendedTier: 'balanced' },
      solutions: {
        balanced: {
          id: 'balanced',
          name: '均衡深化方案',
          systems: [
            { type: 'hot_water', name: 'Rheem 中央热水' },
            { type: 'heating', name: 'Ruud 低温采暖' },
            { type: 'water_treatment', name: 'Everhot 全屋净水' },
            { type: 'fresh_air', name: 'Ruud 新风' },
            { type: 'air', name: 'Ruud 全空气' },
            { type: 'smart_control', name: '智能控制' },
          ],
          estimatedTotal: 328000,
        },
      },
    },
  };
}

export async function createRysnovaBootSmokeArtifactService() {
  const memoryDb = { rysnovaBimArtifacts: [] };
  const storageAdapter = new MemoryArtifactStorageAdapter({ provider: 'boot-smoke-memory-object-storage' });
  const outboxService = { publish: async () => null };
  const service = new RysnovaArtifactService({
    memoryDb,
    storageAdapter,
    outboxService,
    forceMemoryMode: true,
  });

  await service.generateSignoffPackage(
    RYSNOVA_BOOT_SMOKE_SCOPE,
    RYSNOVA_BOOT_SMOKE_PROJECT_ID,
    bootSmokeSignoffPayload()
  );

  return service;
}
