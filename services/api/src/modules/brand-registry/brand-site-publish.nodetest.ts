import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BrandPublishExecutionError,
  createBrandPublishPlan,
  executeBrandPublishPlan,
  requireBrandPublishWrite,
  resolveBrandPublishCapability,
} from './brand-site-publish.service';

const everhot = {
  id: 'site-everhot',
  code: 'everhot',
  appKey: 'everhot-cn',
  deliveryType: 'self_hosted' as const,
  status: 'active' as const,
  deletedAt: null,
};
const user = { userId: 'brand-user', tenantId: 'tenant-brand', role: 'brand_admin' };

test('发布能力按品牌配置解析，未配置品牌明确 unsupported', () => {
  assert.equal(resolveBrandPublishCapability(everhot).supported, true);
  const rheem = resolveBrandPublishCapability({ ...everhot, code: 'rheem', appKey: 'rheem-cn' });
  assert.equal(rheem.supported, false);
  assert.match(rheem.reason, /尚未配置/);
  const external = resolveBrandPublishCapability({ ...everhot, deliveryType: 'external' });
  assert.equal(external.supported, false);
  assert.match(external.reason, /外部托管/);
});

test('品牌发布服务层对只读角色 fail closed', () => {
  assert.doesNotThrow(() => requireBrandPublishWrite(user));
  assert.throws(
    () => requireBrandPublishWrite({ role: 'brand_viewer' }),
    /无品牌发布权限/,
  );
});

test('静态备份计划只执行所选品牌的受控服务端脚本并汇总日志', async () => {
  const plan = createBrandPublishPlan(everhot, user, {
    workspaceRoot: 'D:/workspace',
    apiBase: 'http://nexus.test/api/v2',
    productTenantId: 'tenant-products',
  });
  const calls: Array<{ file: string; args: string[] }> = [];
  const result = await executeBrandPublishPlan(plan, async (file, args) => {
    calls.push({ file, args });
    return { stdout: `完成 ${calls.length}`, stderr: '' };
  });

  assert.equal(calls.length, 2);
  assert.equal(calls.every((call) => call.file === process.execPath), true);
  assert.match(calls[0].args[0], /fetch-products-from-nexus\.mjs$/);
  assert.match(calls[1].args[0], /fetch-product-images-from-dam\.mjs$/);
  assert.deepEqual(calls[1].args.slice(-2), ['--tenant', 'tenant-products']);
  assert.equal(result.ok, true);
  assert.match(result.log, /刷新公开产品数据/);
  assert.match(result.log, /完成 2/);
});

test('脚本失败保留服务端执行日志', async () => {
  const plan = createBrandPublishPlan(everhot, user, { workspaceRoot: 'D:/workspace' });
  await assert.rejects(
    () => executeBrandPublishPlan(plan, async () => {
      const error = Object.assign(new Error('script failed'), { stderr: 'network unavailable' });
      throw error;
    }),
    (error: BrandPublishExecutionError) => {
      assert.match(error.log, /script failed/);
      assert.match(error.log, /network unavailable/);
      return true;
    },
  );
});
