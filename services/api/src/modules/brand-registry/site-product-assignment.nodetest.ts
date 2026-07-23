import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePublicSlug, normalizeSiteCode, resolvePublicSiteTenant,
} from './site-product-assignment.service';

test('网站代码和公开 slug 统一转为小写', () => {
  assert.equal(normalizeSiteCode(' Rheem-CN '), 'rheem-cn');
  assert.equal(normalizePublicSlug(' PRO-TERRA-50 '), 'pro-terra-50');
});

test('网站代码和公开 slug 拒绝路径及空白字符', () => {
  assert.throws(() => normalizeSiteCode('../rheem'), /格式无效/);
  assert.throws(() => normalizePublicSlug('heat pump'), /小写字母/);
});

test('公开站点优先使用 SITE 前缀租户配置', () => {
  const previousSite = process.env.SITE_RHAUTT_GROUP_TENANT_ID;
  const previousBrand = process.env.RHAUTT_GROUP_TENANT_ID;
  process.env.SITE_RHAUTT_GROUP_TENANT_ID = '11111111-1111-4111-8111-111111111111';
  process.env.RHAUTT_GROUP_TENANT_ID = '22222222-2222-4222-8222-222222222222';
  try {
    assert.equal(resolvePublicSiteTenant('rhautt-group'), process.env.SITE_RHAUTT_GROUP_TENANT_ID);
  } finally {
    if (previousSite === undefined) delete process.env.SITE_RHAUTT_GROUP_TENANT_ID;
    else process.env.SITE_RHAUTT_GROUP_TENANT_ID = previousSite;
    if (previousBrand === undefined) delete process.env.RHAUTT_GROUP_TENANT_ID;
    else process.env.RHAUTT_GROUP_TENANT_ID = previousBrand;
  }
});
