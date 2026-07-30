import test from 'node:test';
import assert from 'node:assert/strict';
import { requireProductWrite, resolveProductTenant } from './product-catalog-access';

const rheem = '4aee0000-0000-4000-8000-000000000001';
const ruud = '7aad0000-0000-4000-8000-000000000001';

test('品牌账号只能访问自己的产品租户', () => {
  const actor = { userId: 'brand-user', tenantId: rheem, role: 'brand_admin' };
  assert.equal(resolveProductTenant(actor), rheem);
  assert.equal(resolveProductTenant(actor, rheem), rheem);
  assert.throws(() => resolveProductTenant(actor, ruud), /不可跨品牌租户/);
});

test('总部角色可以显式切换品牌租户', () => {
  const actor = { userId: 'hq-user', tenantId: rheem, role: 'hq_admin' };
  assert.equal(resolveProductTenant(actor, ruud), ruud);
});

test('动态产品权限可以访问指定产品租户', () => {
  const actor = {
    userId: 'operator-user',
    tenantId: rheem,
    role: 'marketing_operator',
    permissions: ['product.catalog.view'],
  };
  assert.equal(resolveProductTenant(actor, ruud), ruud);
  assert.throws(
    () => resolveProductTenant({ userId: 'viewer-user', tenantId: rheem, role: 'viewer', permissions: [] }, ruud),
    /不可跨品牌租户/,
  );
});

test('只有产品管理角色可以写入', () => {
  assert.doesNotThrow(() => requireProductWrite({ userId: 'brand-user', tenantId: rheem, role: 'brand_admin' }));
  assert.doesNotThrow(() => requireProductWrite({
    userId: 'operator-user',
    tenantId: rheem,
    role: 'marketing',
    permissions: ['product.catalog.update'],
  }));
  assert.throws(() => requireProductWrite({ userId: 'sales-user', tenantId: rheem, role: 'sales' }), /无权维护/);
});

test('产品状态和归档写操作对只读角色 fail closed', () => {
  for (const role of ['brand_viewer', 'marketing', 'sales']) {
    assert.throws(
      () => requireProductWrite({ userId: `${role}-user`, tenantId: rheem, role }),
      /无权维护/
    );
  }
});
