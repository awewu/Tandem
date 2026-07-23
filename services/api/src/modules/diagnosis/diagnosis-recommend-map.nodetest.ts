import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendCriteria, resolveDiagnosisBrandTenants } from './diagnosis-recommend-map';

test('diagnosis product recommendation is limited to the opened brand tenants', () => {
  assert.deepEqual(resolveDiagnosisBrandTenants().map((scope) => scope.brand), ['rheem', 'ruud', 'everhot']);
  assert.deepEqual(resolveDiagnosisBrandTenants(['ruud', 'unknown']).map((scope) => scope.brand), ['ruud']);
});

test('diagnosis recommendation criteria prefers diagnosed systems and pain points', () => {
  const criteria = buildRecommendCriteria(
    {
      home: { area: 260, type: 'villa' },
      systems: ['hot_water'],
      painPoints: ['h_01'],
    },
    {
      recommendedTierId: 'premium',
      diagnosis: {
        systems: ['heating', 'air'],
        painPoints: ['t_01'],
      },
    },
  );

  assert.deepEqual(criteria.segments, ['villa']);
  assert.deepEqual(criteria.personas, ['premium_upgrade']);
  assert.deepEqual(criteria.systems, ['heating', 'air']);
  assert.deepEqual(criteria.painPoints, ['t_01']);
});
