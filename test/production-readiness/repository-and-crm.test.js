const BaseRepository = require('../../server/repositories/BaseRepository');
const CrmService = require('../../server/modules/crm/crm.service');
const CryptoService = require('../../server/modules/security/crypto.service');

describe('production repository and crm service', () => {
  test('BaseRepository injects tenant scope into queries', () => {
    const model = {
      findOne: jest.fn(() => ({ lean: jest.fn() }))
    };
    const repo = new BaseRepository(model);
    repo.findOne({ tenantId: 'tenant-a' }, { status: 'active' });
    expect(model.findOne).toHaveBeenCalledWith({ status: 'active', tenantId: 'tenant-a' }, undefined);
  });

  test('BaseRepository create always uses scope tenant over payload tenant', async () => {
    const model = {
      create: jest.fn(async items => items)
    };
    const repo = new BaseRepository(model);

    const result = await repo.create(
      { tenantId: 'tenant-a' },
      { tenantId: 'tenant-b', status: 'draft' }
    );

    expect(model.create).toHaveBeenCalledWith([
      { tenantId: 'tenant-a', status: 'draft' }
    ], {});
    expect(result.tenantId).toBe('tenant-a');
  });

  test('BaseRepository update cannot move documents across tenants', async () => {
    const lean = jest.fn();
    const model = {
      findOneAndUpdate: jest.fn(() => ({ lean }))
    };
    const repo = new BaseRepository(model);

    await repo.updateById(
      { tenantId: 'tenant-a' },
      'artifact-1',
      {
        tenantId: 'tenant-b',
        status: 'shared',
        $set: {
          tenantId: 'tenant-c',
          objectKey: 'tenant-a/project/artifact.json'
        },
        $setOnInsert: {
          tenantId: 'tenant-d',
          createdBy: 'user-1'
        }
      }
    );

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'artifact-1', tenantId: 'tenant-a' },
      expect.objectContaining({
        $set: expect.objectContaining({
          tenantId: 'tenant-a',
          status: 'shared',
          objectKey: 'tenant-a/project/artifact.json',
          updatedAt: expect.any(Date)
        }),
        $setOnInsert: { createdBy: 'user-1' }
      }),
      { new: true }
    );
    const update = model.findOneAndUpdate.mock.calls[0][1];
    expect(update.tenantId).toBeUndefined();
    expect(update.$setOnInsert.tenantId).toBeUndefined();
    expect(update.$set.tenantId).toBe('tenant-a');
  });

  test('BaseRepository rejects tenant-scoped query without tenantId', async () => {
    const repo = new BaseRepository({ findOne: jest.fn() });
    await expect(repo.findOne({}, {})).rejects.toThrow('tenantId is required');
  });

  test('CrmService hashes phone deterministically and masks phone', () => {
    const crm = new CrmService({
      phoneSecret: 'test-secret',
      piiEncryptionSecret: 'unit-test-pii-secret'
    });
    expect(crm.hashPhone('13800000000')).toBe(crm.hashPhone('138 0000 0000'));
    const encrypted = crm.encryptPhoneForNow('13800000000');
    expect(encrypted).toMatch(/^v1:aes-256-gcm:/);
    expect(encrypted).not.toContain('13800000000');
    expect(crm.maskPhone(encrypted)).toBe('138****0000');
  });

  test('CrmService keeps legacy base64 phone masking fallback while new writes are encrypted', () => {
    const crm = new CrmService({
      phoneSecret: 'test-secret',
      piiEncryptionSecret: 'unit-test-pii-secret'
    });

    const legacyBase64Phone = Buffer.from('13900001111').toString('base64');

    expect(crm.maskPhone(legacyBase64Phone)).toBe('139****1111');
    expect(crm.cryptoService.isEncryptedValue(legacyBase64Phone)).toBe(false);
  });

  test('CryptoService migrates DataEncryption AES-256-GCM behavior into target security module', () => {
    const cryptoService = new CryptoService({
      secret: 'unit-test-pii-secret',
      randomBytes: (size) => Buffer.alloc(size, 7)
    });

    const encrypted = cryptoService.encryptText('13800000000');
    expect(encrypted).toMatch(/^v1:aes-256-gcm:/);
    expect(encrypted).not.toContain('13800000000');
    expect(cryptoService.decryptText(encrypted)).toBe('13800000000');

    const tampered = encrypted.replace(/[0-9a-f]$/, char => (char === '0' ? '1' : '0'));
    expect(cryptoService.decryptText(tampered)).toBeNull();
  });
});
