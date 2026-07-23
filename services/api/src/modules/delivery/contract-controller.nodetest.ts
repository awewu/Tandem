import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractController } from './contract.controller';

test('contracts compatibility routes use the Nest contract and construction services', async () => {
  const contract = {
    sign: async () => ({ id: 'contract-1', status: 'signed' }),
    get: async () => ({ id: 'contract-1', status: 'signed' }),
  } as any;
  const construction = {
    createProjectForContract: async () => ({ project: { id: 'delivery-1' }, created: true }),
  } as any;
  const controller = new ContractController(contract, construction);
  const request = { user: { tenantId: 'tenant-1', userId: 'user-1' } };

  assert.deepEqual(await controller.signature(request, 'contract-1', {}), { id: 'contract-1', status: 'signed' });
  assert.deepEqual(await controller.deliveryStart(request, 'contract-1', {}), {
    contract: { id: 'contract-1', status: 'signed' },
    delivery: { project: { id: 'delivery-1' }, created: true },
  });
});
