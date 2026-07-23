const {
  COMFORT_DOMAIN_FACADES,
  getComfortDomainFacade,
  getComfortDomainInventory
} = require('../../server/modules/comfort-domain/comfortDomainFacade');

describe('comfort-home domain facade registry', () => {
  test('covers every core comfort-home system with owner, standards, outputs, and IoT bridge fields', () => {
    const required = [
      'hot-water',
      'heating',
      'water-quality',
      'fresh-air-doas',
      'air-conditioning',
      'smart-control',
      'drawing-bim',
      'quote-costing',
      'lifecycle-iot'
    ];

    expect(COMFORT_DOMAIN_FACADES.map(facade => facade.id)).toEqual(required);

    for (const facade of COMFORT_DOMAIN_FACADES) {
      expect(facade.owner).toMatch(/^server\/modules\//);
      expect(facade.routes.length).toBeGreaterThanOrEqual(2);
      expect(facade.engines.length).toBeGreaterThanOrEqual(2);
      expect(facade.standards.length).toBeGreaterThanOrEqual(1);
      expect(facade.outputs.length).toBeGreaterThanOrEqual(3);
      expect(facade.iotBridge.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('keeps quote costing and lifecycle IoT as production contracts', () => {
    expect(getComfortDomainFacade('quote-costing')).toEqual(expect.objectContaining({
      status: 'production',
      routes: expect.arrayContaining(['/api/quotation-v2/from-bom']),
      outputs: expect.arrayContaining(['margin-guard', 'customer-total'])
    }));

    expect(getComfortDomainFacade('lifecycle-iot')).toEqual(expect.objectContaining({
      status: 'production',
      routes: expect.arrayContaining(['/api/v2/lifecycle']),
      iotBridge: expect.arrayContaining(['installed-device-id', 'maintenance-schedule'])
    }));
  });

  test('keeps Rysnova drawing and BIM production facade on v2 artifact contracts', () => {
    expect(getComfortDomainFacade('drawing-bim')).toEqual(expect.objectContaining({
      status: 'production',
      routes: expect.arrayContaining([
        '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts',
        '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
        '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
        '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
        '/api/v2/rysnova-bim/projects/{projectId}/deepening-package'
      ]),
      outputs: expect.arrayContaining([
        'principle-diagram',
        'construction-drawing',
        'bim-model',
        'bom',
        'quantity-takeoff',
        'standards-check',
        'customer-report'
      ])
    }));
    expect(getComfortDomainFacade('drawing-bim').routes).not.toContain('/api/rysnova-bim/generate-deliverables');
  });

  test('inventory exposes production maturity summary for harnesses and admin review', () => {
    const inventory = getComfortDomainInventory();

    expect(inventory.total).toBe(9);
    expect(inventory.production).toBeGreaterThanOrEqual(2);
    expect(inventory.productionCandidate).toBeGreaterThanOrEqual(5);
    expect(inventory.domains.find(domain => domain.id === 'drawing-bim').outputCount).toBeGreaterThanOrEqual(5);
  });
});
