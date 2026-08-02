const COMFORT_DOMAIN_FACADES = [
  {
    id: 'hot-water',
    name: 'Central Hot Water',
    owner: 'server/modules/comfort-domain/hot-water',
    status: 'production-candidate',
    routes: ['/api/hotwater', '/api/design/water-system', '/api/standards/hot-water-compliance'],
    engines: ['waterSystem', 'standards'],
    standards: ['GB 55020-2021', 'ASHRAE 188-2018'],
    outputs: ['hot-water-sizing', 'recirculation-layout', 'safety-compliance', 'equipment-pack'],
    iotBridge: ['water-heater-device-id', 'temperature-setpoint', 'leak-alert', 'maintenance-alert']
  },
  {
    id: 'heating',
    name: 'Hydronic Heating',
    owner: 'server/modules/comfort-domain/heating',
    status: 'production-candidate',
    routes: ['/api/design/heating-system', '/api/load-calculation', '/api/device-selection'],
    engines: ['heatingSystem', 'loadCalculationV3', 'deviceSelection'],
    standards: ['GB 55015-2021', 'GB 50736-2012', 'ASHRAE 55-2023'],
    outputs: ['heating-load', 'terminal-selection', 'hydronic-loop', 'energy-summary'],
    iotBridge: ['zone-id', 'supply-temperature', 'heating-mode', 'fault-code']
  },
  {
    id: 'water-quality',
    name: 'Water Quality',
    owner: 'server/modules/comfort-domain/water-quality',
    status: 'production-candidate',
    routes: ['/api/design/water-system', '/api/package'],
    engines: ['waterSystem', 'deviceSelection'],
    standards: ['GB 5749-2022', 'GB 55020-2021'],
    outputs: ['point-of-entry-filtering', 'point-of-use-filtering', 'replacement-plan'],
    iotBridge: ['filter-life', 'tds-reading', 'service-ticket']
  },
  {
    id: 'fresh-air-doas',
    name: 'Fresh Air And DOAS',
    owner: 'server/modules/comfort-domain/fresh-air-doas',
    status: 'production-candidate',
    routes: ['/api/design/fresh-air-pro', '/api/design/doas', '/api/doas/validate', '/api/doas/report'],
    engines: ['freshAirPro', 'doasCompliance'],
    standards: ['GB 55015-2021', 'ASHRAE 62.1-2022', 'ASHRAE 62.2-2022'],
    outputs: ['ventilation-rate', 'heat-recovery-check', 'filtration-grade', 'iaq-compliance-report'],
    iotBridge: ['co2', 'pm25', 'filter-status', 'ventilation-mode']
  },
  {
    id: 'air-conditioning',
    name: 'Air Conditioning',
    owner: 'server/modules/comfort-domain/air-conditioning',
    status: 'production-candidate',
    routes: ['/api/design/air-conditioning', '/api/load-calculation', '/api/air-control'],
    engines: ['airConditioning', 'loadCalculationV3'],
    standards: ['GB 55015-2021', 'ASHRAE 55-2023', 'ASHRAE 90.1-2022'],
    outputs: ['cooling-load', 'indoor-unit-match', 'airflow-balance', 'energy-summary'],
    iotBridge: ['thermostat-id', 'cooling-mode', 'runtime-hours', 'fault-code']
  },
  {
    id: 'smart-control',
    name: 'Smart Control',
    owner: 'server/modules/comfort-domain/smart-control',
    status: 'production-candidate',
    routes: ['/api/econet', '/api/supreme/iot/devices', '/api/lifecycle'],
    engines: ['econetSystem', 'smartBrain', 'iotPlatform'],
    standards: ['Matter 1.5', 'OpenTelemetry signals'],
    outputs: ['device-registry', 'control-capability-map', 'service-alert-policy'],
    iotBridge: ['home-id', 'device-id', 'capability', 'telemetry-stream']
  },
  {
    id: 'quote-costing',
    name: 'Quote, BOM And Costing',
    owner: 'server/modules/comfort-domain/quote-costing',
    status: 'production',
    routes: ['/api/quotation-v2/from-bom', '/api/quotation-v2/generate', '/api/promotions', '/api/pricing'],
    engines: ['quotationV2', 'promotion', 'econetPricing'],
    standards: ['dealer-margin-policy', 'tax-and-risk-assumption-policy'],
    outputs: ['bom-normalization', 'direct-cost', 'labor-cost', 'tax', 'risk-reserve', 'margin-guard', 'customer-total'],
    iotBridge: ['accepted-quote-id', 'asset-entitlement', 'service-plan']
  },
  {
    id: 'lifecycle-iot',
    name: 'Lifecycle IoT Care',
    owner: 'server/modules/lifecycle',
    status: 'production',
    routes: ['/api/v2/lifecycle', '/api/v2/analytics/overview', '/api/tech-support'],
    engines: ['lifecycle', 'analytics', 'techSupport'],
    standards: ['SLA policy', 'warranty policy', 'tenant scope policy'],
    outputs: ['handover-record', 'installed-asset', 'warranty-state', 'service-ticket', 'tenant-analytics'],
    iotBridge: ['home-id', 'installed-device-id', 'owner-user-id', 'maintenance-schedule']
  }
];

function getComfortDomainFacade(id) {
  return COMFORT_DOMAIN_FACADES.find(facade => facade.id === id) || null;
}

function getComfortDomainInventory() {
  return {
    total: COMFORT_DOMAIN_FACADES.length,
    production: COMFORT_DOMAIN_FACADES.filter(facade => facade.status === 'production').length,
    productionCandidate: COMFORT_DOMAIN_FACADES.filter(facade => facade.status === 'production-candidate').length,
    plannedInterface: COMFORT_DOMAIN_FACADES.filter(facade => facade.status === 'planned-interface').length,
    domains: COMFORT_DOMAIN_FACADES.map(facade => ({
      id: facade.id,
      owner: facade.owner,
      status: facade.status,
      routeCount: facade.routes.length,
      engineCount: facade.engines.length,
      outputCount: facade.outputs.length,
      iotBridgeCount: facade.iotBridge.length
    }))
  };
}

module.exports = {
  COMFORT_DOMAIN_FACADES,
  getComfortDomainFacade,
  getComfortDomainInventory
};
