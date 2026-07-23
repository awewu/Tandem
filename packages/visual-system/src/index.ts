export const visualSurfaceModes = {
  publicPortal: 'consumer-portal',
  consumerDiagnosis: 'consumer-consultation',
  customerPortal: 'customer-lifecycle',
  dealerWorkbench: 'enterprise-workbench',
  designerWorkbench: 'enterprise-design-tool',
  rysnovaBimWorkbench: 'engineering-workbench'
} as const;

export const visualSystemStatus = {
  platform: 'Rhautt Nexus / 瑞合数智枢纽',
  status: 'scaffold-only',
  note: 'Target visual-system package for C-end, enterprise, and Rysnova UI/VI separation.'
} as const;
