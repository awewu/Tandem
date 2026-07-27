import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rankProductRecommendationCandidates,
  resolveRecommendationSystems,
  scoreProductRecommendation,
} from './product-catalog-recommend';

test('recommendation scoring infers hot-water products from diagnosis pain ids', () => {
  const score = scoreProductRecommendation({
    sku: 'RHEEM-CN-39',
    name: '百年经典立式电热水器',
    brand: 'rheem',
    category: 'water-heating',
    positioning: {},
  }, {
    painPoints: ['h_01'],
    segments: ['home'],
  });

  assert.equal(resolveRecommendationSystems({ painPoints: ['h_01'] }).includes('hot_water'), true);
  assert.equal(score.score > 0, true);
  assert.equal(score.signals.includes('system:hot_water'), true);
});

test('recommendation scoring prefers heating products for heating system demand', () => {
  const heating = scoreProductRecommendation({
    sku: 'EVERHOT-CN-10009',
    name: '恒热智能壁挂炉',
    brand: 'everhot',
    category: 'heating-boiler',
    positioning: {},
  }, {
    systems: ['heating'],
  });
  const water = scoreProductRecommendation({
    sku: 'RHEEM-CN-39',
    name: '百年经典立式电热水器',
    brand: 'rheem',
    category: 'water-heating',
    positioning: {},
  }, {
    systems: ['heating'],
  });

  assert.equal(heating.score > water.score, true);
  assert.equal(heating.signals.includes('system:heating'), true);
});

test('recommendation scoring does not classify fresh air or controls as heating', () => {
  const freshAir = scoreProductRecommendation({
    sku: 'EVERFRESH-PRO',
    name: 'EverFresh Pro commercial fresh air unit',
    brand: 'everhot',
    category: 'heating-cooling',
    positioning: { targetSegments: ['commercial'], channels: ['dealer'] },
  }, {
    systems: ['heating'],
    segments: ['commercial'],
    channels: ['dealer'],
  });
  const control = scoreProductRecommendation({
    sku: 'EVERCONTROL',
    name: 'EverControl building smart control system',
    brand: 'everhot',
    category: 'heating-cooling',
    positioning: { targetSegments: ['commercial'], channels: ['dealer'] },
  }, {
    systems: ['heating'],
    segments: ['commercial'],
    channels: ['dealer'],
  });

  assert.equal(freshAir.signals.includes('system:heating'), false);
  assert.equal(control.signals.includes('system:heating'), false);
});

test('recommendation ranking excludes scored products that do not match requested systems', () => {
  const products = [
    {
      id: 'fresh-air',
      tenantId: 'rhautt_shared',
      sku: 'EVERFRESH-PRO',
      name: 'EverFresh Pro commercial fresh air unit',
      brand: 'everhot',
      category: 'heating-cooling',
      status: 'active',
      spec: {},
      positioning: { targetSegments: ['commercial'], channels: ['dealer'] },
      assetRefs: [],
      meta: { everhot: { slug: 'everfresh-pro', name: 'EverFresh Pro commercial fresh air unit' } },
    },
    {
      id: 'control',
      tenantId: 'rhautt_shared',
      sku: 'EVERCONTROL',
      name: 'EverControl building smart control system',
      brand: 'everhot',
      category: 'heating-cooling',
      status: 'active',
      spec: {},
      positioning: { targetSegments: ['commercial'], channels: ['dealer'] },
      assetRefs: [],
      meta: { everhot: { slug: 'evercontrol', name: 'EverControl building smart control system' } },
    },
    {
      id: 'boiler',
      tenantId: 'rhautt_shared',
      sku: 'EVERHOT-BOILER',
      name: 'Everhot commercial heating boiler',
      brand: 'everhot',
      category: 'heating-boiler',
      status: 'active',
      spec: {},
      positioning: { targetSegments: ['commercial'], channels: ['dealer'] },
      assetRefs: [],
      meta: { everhot: { slug: 'everhot-boiler', name: 'Everhot commercial heating boiler' } },
    },
  ];
  const result = rankProductRecommendationCandidates(products, {
    segments: ['commercial'],
    channels: ['dealer'],
    systems: ['heating'],
  });

  assert.deepEqual(result.map((item) => item.p.sku), ['EVERHOT-BOILER']);
});
