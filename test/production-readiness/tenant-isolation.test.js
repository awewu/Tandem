const BaseRepository = require('../../server/repositories/BaseRepository');

function chainableFind(result = []) {
  return {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result)
  };
}

function chainableOne(result = null) {
  return {
    lean: jest.fn().mockResolvedValue(result)
  };
}

describe('production tenant isolation repository contract', () => {
  test('tenant scope overrides any caller-supplied tenantId in findOne', async () => {
    const model = {
      findOne: jest.fn(() => chainableOne({ id: 'safe-record' }))
    };
    const repo = new BaseRepository(model);

    await repo.findOne({ tenantId: 'tenant-a' }, { tenantId: 'tenant-b', status: 'active' });

    expect(model.findOne).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', status: 'active' },
      undefined
    );
  });

  test('tenant scope overrides any caller-supplied tenantId in list and count', async () => {
    const findChain = chainableFind([{ id: 'record-a' }]);
    const model = {
      find: jest.fn(() => findChain),
      countDocuments: jest.fn().mockResolvedValue(1)
    };
    const repo = new BaseRepository(model);

    const result = await repo.list(
      { tenantId: 'tenant-a' },
      { tenantId: 'tenant-b', lifecycleStage: 'operating' },
      { page: 1, limit: 20 }
    );

    expect(model.find).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', lifecycleStage: 'operating' },
      undefined
    );
    expect(model.countDocuments).toHaveBeenCalledWith(
      { tenantId: 'tenant-a', lifecycleStage: 'operating' }
    );
    expect(result.pagination.total).toBe(1);
  });

  test('tenant scope overrides any caller-supplied tenantId in updateById', async () => {
    const model = {
      findOneAndUpdate: jest.fn(() => chainableOne({ id: 'record-a', status: 'updated' }))
    };
    const repo = new BaseRepository(model);

    await repo.updateById(
      { tenantId: 'tenant-a' },
      'record-1',
      { tenantId: 'tenant-b', status: 'updated' }
    );

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'record-1', tenantId: 'tenant-a' },
      expect.objectContaining({
        $set: expect.objectContaining({
          tenantId: 'tenant-a',
          status: 'updated',
          updatedAt: expect.any(Date)
        })
      }),
      expect.objectContaining({ new: true })
    );
  });

  test('tenant-scoped create always writes scope tenantId over payload tenantId', async () => {
    const model = {
      create: jest.fn(async items => items)
    };
    const repo = new BaseRepository(model);

    const result = await repo.create(
      { tenantId: 'tenant-a' },
      { tenantId: 'tenant-b', name: 'Dealer A' }
    );

    expect(model.create).toHaveBeenCalledWith(
      [{ tenantId: 'tenant-a', name: 'Dealer A' }],
      {}
    );
    expect(result.tenantId).toBe('tenant-a');
  });

  test('create and update reject missing tenant scope before model access', async () => {
    const model = {
      create: jest.fn(),
      findOneAndUpdate: jest.fn()
    };
    const repo = new BaseRepository(model);

    await expect(repo.create({}, { name: 'Dealer A' })).rejects.toThrow('tenantId is required');
    await expect(repo.updateById({}, 'record-1', { name: 'Dealer A' })).rejects.toThrow('tenantId is required');
    expect(model.create).not.toHaveBeenCalled();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
