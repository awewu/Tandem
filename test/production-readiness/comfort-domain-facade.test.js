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
      'quote-costing',
      'lifecycle-iot'
    ];

    expect(COMFORT_DOMAIN_FACADES.map(facade => facade.id)).toEqual(required);

    for (const facade of COMFORT_DOMAIN_FACADES) {
      expect(facade.owner).toBeTruthy();
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

  test('inventory exposes production maturity summary for harnesses and admin review', () => {
    const inventory = getComfortDomainInventory();

    expect(inventory.total).toBe(8);
    expect(inventory.production).toBeGreaterThanOrEqual(2);
    expect(inventory.productionCandidate).toBeGreaterThanOrEqual(5);
    expect(inventory.plannedInterface).toBe(0);
  });
});
