export const productBoundaries = {
  platformName: 'Rhautt Nexus / 瑞合数智枢纽',
  groupExpression: 'Rhautt Comfort / 瑞合瑞德暖通科技集团',
  groupExpressionBoundary: '不是软件名',
  consumerSystemBrand: '瑞诺瓦',
  equipmentBrands: ['Rheem', 'Ruud', 'Everhot'],
  iotBoundary: 'lifecycle_handoff_only'
} as const;

export const targetBackendModules = [
  'auth',
  'tenant',
  'crm',
  'diagnosis',
  'product-catalog',
  'quote',
  'design',
  'rysnova-bim',
  'delivery',
  'lifecycle',
  'analytics',
  'governance',
  'file-artifact',
  'notification',
  'workflow'
] as const;

/**
 * Shared HVAC calculation kernels exposed by this domain package.
 *
 * Pure-function engines (single source of truth, mirrored as thin re-exports
 * in server/core for the current CommonJS runtime). Future-state NestJS modules
 * import them via `@rhautt-nexus/domain/hvac-kernels`.
 */
export const hvacKernels = [
  'hot-water',
  'heating',
  'air-conditioning',
  'fresh-air',
  'load-calculation',
  'hydraulic',
  'quotation'
] as const;
