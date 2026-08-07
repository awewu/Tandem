import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';
import { DealerSuccessSnapshotEntity, GrowthFunnelEventEntity } from './growth.entities';
import { CockpitService } from './cockpit.service';
import {
  GEO_ATTRIBUTED_CHANNELS, isGeoAttributed, normalizeLeadChannel,
} from './geo-attribution';

test('normalizeLeadChannel maps acquisition sources to honest channels', () => {
  assert.equal(normalizeLeadChannel({ source: 'chatgpt' }), 'geo');
  assert.equal(normalizeLeadChannel({ source: 'ai-engine referral' }), 'geo');
  assert.equal(normalizeLeadChannel({ source: '豆包' }), 'geo');
  assert.equal(normalizeLeadChannel({ source: 'rysnova-diagnosis' }), 'ai-diagnosis');
  assert.equal(normalizeLeadChannel({ source: '问诊' }), 'ai-diagnosis');
  assert.equal(normalizeLeadChannel({ source: 'referral' }), 'referral');
  assert.equal(normalizeLeadChannel({ source: 'douyin-ad' }), 'paid');
  assert.equal(normalizeLeadChannel({ source: null, campaign: 'spring-sale' }), 'paid');
  assert.equal(normalizeLeadChannel({ source: 'seo' }), 'organic');
  assert.equal(normalizeLeadChannel({ source: 'manual' }), 'manual');
  assert.equal(normalizeLeadChannel({ source: 'walk-in' }), 'other');
  assert.equal(normalizeLeadChannel(null), 'other');
});

test('GEO attributed set is exactly {geo, ai-diagnosis} and never fabricates', () => {
  assert.deepEqual(GEO_ATTRIBUTED_CHANNELS, ['geo', 'ai-diagnosis']);
  assert.ok(isGeoAttributed('geo'));
  assert.ok(isGeoAttributed('ai-diagnosis'));
  assert.equal(isGeoAttributed('referral'), false);
  assert.equal(isGeoAttributed('other'), false);
});

test('north star counts GEO-attributed high-intent leads as a real subset, never a null ratio', async () => {
  const funnel = new InMemoryRepository<any>().seed(
    { tenantId: 't1', stage: 'lead', channel: 'geo',          period: '2026-08', sourceEventId: 'e1' },
    { tenantId: 't1', stage: 'lead', channel: 'ai-diagnosis', period: '2026-08', sourceEventId: 'e2' },
    { tenantId: 't1', stage: 'lead', channel: 'referral',     period: '2026-08', sourceEventId: 'e3' },
    { tenantId: 't1', stage: 'lead', channel: null,           period: '2026-08', sourceEventId: 'e4' },
    { tenantId: 't1', stage: 'reach', channel: null,          period: '2026-08', sourceEventId: 'r1' },
    // 其它租户/周期不得串入
    { tenantId: 't2', stage: 'lead', channel: 'geo',          period: '2026-08', sourceEventId: 'x1' },
    { tenantId: 't1', stage: 'lead', channel: 'geo',          period: '2026-07', sourceEventId: 'y1' },
  );
  const dealers = new InMemoryRepository<any>();
  const { ds } = makeFakeDataSource([
    [GrowthFunnelEventEntity, funnel],
    [DealerSuccessSnapshotEntity, dealers],
  ]);
  const svc = new CockpitService(ds, {} as any);
  const ns: any = await svc.getNorthStar({ tenantId: 't1', userId: 'u1', role: 'admin' } as any, '2026-08');

  assert.equal(ns.highIntentLeads, 4);            // t1/2026-08 的四条 lead
  assert.equal(ns.geoAttributedLeads, 2);         // geo + ai-diagnosis
  assert.equal(ns.attributedLeads, 3);            // 4 - 1 未归因(null→other)
  assert.equal(ns.geoReach, 1);
  assert.equal(ns.geoAttributionRate, 50);        // 2/4，真实占比而非 lead/reach 比率
  const geoSlice = ns.channelBreakdown.find((c: any) => c.channel === 'geo');
  assert.equal(geoSlice.count, 1);
  const otherSlice = ns.channelBreakdown.find((c: any) => c.channel === 'other');
  assert.equal(otherSlice.count, 1);              // 未归因诚实计入 other，不算 GEO
});
