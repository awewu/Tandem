import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateInstalledAssets,
  buildCustomerProjectView,
  buildIotHandoffPackageFromLink,
  normalizeDevices,
  normalizeInstalledAssets,
  normalizeProjectStatePatch,
} from './lifecycle-projection';

test('creates a safe IoT handover projection', () => {
  const devices = normalizeDevices([{ sourceDeviceId: 'water-1', brand: 'Everhot', system: 'water_quality', model: 'WQ-01' }]);
  const assets = normalizeInstalledAssets({ contractId: 'CNT-100', servicePlan: { warrantyMonths: 36 } }, devices);
  const handoff = buildIotHandoffPackageFromLink({ tenantId: 'tenant-1' }, {
    tenantId: 'tenant-1', customerId: 'customer-1', contractId: 'CNT-100', projectState: 'lifecycle-handoff-ready',
    installedAssets: assets, iot: { capabilityRegistry: [{ assetId: assets[0].assetId, iotDeviceId: 'iot-1', controlBoundary: 'external_realtime_iot' }] },
  });
  assert.equal(assets[0].category, 'water-treatment');
  assert.equal(handoff.capabilityRegistry[0].controlBoundary, 'lifecycle_handoff_only');
  assert.equal(handoff.forbiddenControl.deviceActuation, false);
});

test('builds a customer-safe project view and activates accepted assets', () => {
  const patch = normalizeProjectStatePatch({ state: 'construction-in-progress' });
  const view = buildCustomerProjectView({ tenantId: 'tenant-1' }, { tenantId: 'tenant-1', customerId: 'customer-1', contractId: 'CNT-200', ...patch, quoteId: 'QUOTE-200', dealerMargin: 0.2, installedAssets: [], iot: {} });
  const accepted = activateInstalledAssets({ contractId: 'CNT-200', servicePlan: { warrantyMonths: 24 }, devices: [{ sourceDeviceId: 'control-1', iotDeviceId: 'iot-control' }], installedAssets: [{ assetId: 'asset-control', iotDeviceId: 'iot-control' }] }, new Date('2026-07-15T00:00:00.000Z'));
  assert.equal(view.progressPercent, 76);
  assert.equal(view.construction.state, 'active');
  assert.equal('dealerMargin' in view, false);
  assert.equal(accepted.installedAssets[0].status, 'bound');
});
