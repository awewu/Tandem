import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductCatalogController } from './product-catalog.controller';
import { SiteProductAssignmentController } from '../brand-registry/site-product-assignment.controller';
import { ROLES_KEY } from '../common/roles.decorator';

const WRITE_ROLES = ['platform_admin', 'hq_admin', 'brand_admin'];

function rolesFor(controller: Function, method: string): string[] {
  return Reflect.getMetadata(ROLES_KEY, controller.prototype[method]) || [];
}

test('product catalog create, update, and archive are restricted to product write roles', () => {
  for (const method of ['upsert', 'update', 'archive']) {
    assert.deepEqual(rolesFor(ProductCatalogController, method), WRITE_ROLES);
  }
});

test('site product assignment writes are restricted to product write roles', () => {
  for (const method of ['create', 'update', 'publish', 'hide', 'archive']) {
    assert.deepEqual(rolesFor(SiteProductAssignmentController, method), WRITE_ROLES);
  }
});

test('product CRUD and site shelf API surfaces have route ownership', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getRouteOwner } = require('../../../../../server/modules/routeOwnership');

  assert.equal(getRouteOwner('/api/v2/product-catalog/devices').owner, 'services/api/src/modules/product-catalog');
  assert.equal(getRouteOwner('/api/v2/brand-sites/rheem/product-assignments').owner, 'services/api/src/modules/brand-registry');
  assert.equal(getRouteOwner('/api/v2/sites/rheem/products').owner, 'services/api/src/modules/brand-registry public site catalog surface');
});
