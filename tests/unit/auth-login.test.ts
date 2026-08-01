import { beforeEach, describe, expect, it } from 'vitest';

import { AuthError, login } from '@/lib/auth/native';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { getStore, setStore } from '@/lib/storage/repository';

describe('native auth login', () => {
  beforeEach(() => {
    setStore(createInMemoryStore());
  });

  it('reports imported users without a password hash clearly and does not lock them', async () => {
    const store = getStore();
    const user = await store.auth.users.create({
      email: 'imported@example.com',
      name: 'Imported User',
      roles: ['employee'],
    });
    await store.auth.users.update(user.id, {
      failedLoginCount: 6,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    await expect(login({ email: user.email, password: 'anything' })).rejects.toMatchObject({
      code: 'password_not_initialized',
      message: '账号已创建但尚未初始化密码，请联系管理员重置密码',
      httpStatus: 409,
    } satisfies Partial<AuthError>);

    const after = await store.auth.users.findById(user.id);
    expect(after?.failedLoginCount).toBe(6);
    expect(after?.lockedUntil).toBeTruthy();
  });
});
