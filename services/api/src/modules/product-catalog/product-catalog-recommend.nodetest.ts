import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecommendationSystems, scoreProductRecommendation } from './product-catalog-recommend';

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
