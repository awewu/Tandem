const SystemPacksService = require('../../server/modules/system-packs/system-packs.service');
const { REQUIRED_STANDARDS_COVERAGE_DOMAINS } = require('../../server/modules/system-packs/rheemSystemPacks');

describe('Rheem plug-and-play system packs', () => {
  test('contains Rheem anchor packs for hot water, heating, and whole-air systems', () => {
    const service = new SystemPacksService();
    const packs = service.list();

    expect(packs.map(pack => pack.id)).toEqual(expect.arrayContaining([
      'rheem-central-hot-water',
      'rheem-heating',
      'rheem-whole-air',
      'rheem-smart-control'
    ]));
  });

  test('composes selected packs with smart control and lifecycle handover', () => {
    const service = new SystemPacksService();
    const composition = service.compose({
      selectedPackIds: ['rheem-central-hot-water', 'rheem-heating', 'rheem-whole-air']
    });

    expect(composition.packs.map(pack => pack.id)).toContain('rheem-smart-control');
    expect(composition.iot.handoverRequired).toBe(true);
    expect(composition.iot.lifecycleBridge).toBe('/api/v2/lifecycle/handover');
    expect(composition.deliverables).toEqual(expect.arrayContaining([
      '热水负荷计算',
      '采暖热负荷计算',
      '冷热负荷计算',
      'IoT 设备绑定清单'
    ]));
    expect(composition.standards.map(s => s.code)).toEqual(expect.arrayContaining([
      'GB 55015',
      'GB 55020',
      'GB 50015',
      'GB 50736',
      'GB/T 18883',
      'GB/T 22239'
    ]));
    expect(composition.standardsEvidence.mandatoryBlockers).toEqual(expect.arrayContaining([
      'GB 55015',
      'GB 55020'
    ]));
    expect(composition.standardsEvidence.advisoryOptimizations).toEqual(expect.arrayContaining([
      'ASHRAE 55',
      'Matter'
    ]));
    expect(composition.standardsEvidence.hierarchy.map(level => level.level)).toEqual(['L1', 'L2', 'L3']);
    expect(composition.standardsCoverage.map(item => item.domain)).toEqual(expect.arrayContaining(REQUIRED_STANDARDS_COVERAGE_DOMAINS));
    expect(composition.standardsEvidence.coverage.status).toBe('complete');
    expect(composition.standardsEvidence.coverage.missingRequiredDomains).toEqual([]);
  });

  test('exposes standards coverage that Rysnova can bind into design, quote, and lifecycle outputs', () => {
    const service = new SystemPacksService();
    const composition = service.compose({
      selectedPackIds: ['rheem-central-hot-water', 'rheem-heating', 'rheem-whole-air']
    });

    for (const domain of REQUIRED_STANDARDS_COVERAGE_DOMAINS) {
      const coverage = composition.standardsCoverage.find(item => item.domain === domain);
      expect(coverage).toEqual(expect.objectContaining({
        domain,
        requiredFor: expect.any(Array),
        primaryStandards: expect.any(Array),
        softwareChecks: expect.any(Array),
        deliverableEvidence: expect.any(Array),
        quoteImpact: expect.any(Array),
        lifecycleHandoffImpact: expect.any(Array),
        packIds: expect.any(Array)
      }));
      expect(coverage.requiredFor.length).toBeGreaterThan(0);
      expect(coverage.primaryStandards.length).toBeGreaterThan(0);
      expect(coverage.softwareChecks.length).toBeGreaterThan(0);
      expect(coverage.deliverableEvidence.length).toBeGreaterThan(0);
      expect(coverage.quoteImpact.length).toBeGreaterThan(0);
      expect(coverage.lifecycleHandoffImpact.length).toBeGreaterThan(0);
      expect(coverage.packIds.length).toBeGreaterThan(0);
    }

    const hotWaterSafety = composition.standardsCoverage.find(item => item.domain === 'hot-water-safety');
    expect(hotWaterSafety.primaryStandards).toEqual(expect.arrayContaining(['GB 55020', 'GB 50015']));
    expect(hotWaterSafety.softwareChecks).toEqual(expect.arrayContaining(['circulationLoop', 'antiScald']));
    expect(hotWaterSafety.quoteImpact).toEqual(expect.arrayContaining(['循环泵']));

    const smartInteroperability = composition.standardsCoverage.find(item => item.domain === 'smart-interoperability');
    expect(smartInteroperability.primaryStandards).toEqual(expect.arrayContaining(['GB/T 22239', 'Matter', 'MQTT']));
    expect(smartInteroperability.lifecycleHandoffImpact).toEqual(expect.arrayContaining(['remote_control', 'service_ticket']));
  });

  test('recommends Rheem packs from house context and pain points', () => {
    const service = new SystemPacksService();
    const recommendation = service.recommend({
      houseType: '别墅',
      area: 260,
      bathrooms: 4,
      hasBathtub: true,
      hasElderly: true,
      painPoints: ['热水等待久', '冬季采暖不均', '空气质量差']
    });

    expect(recommendation.packs.map(pack => pack.id)).toEqual(expect.arrayContaining([
      'rheem-central-hot-water',
      'rheem-heating',
      'rheem-whole-air'
    ]));
  });
});
