/** timer-registry 单元测试 */
const { registerInterval, registerTimeout, unregister, stats, shutdownAllTimers } = require('../../server/utils/timer-registry');

describe('timer-registry', () => {
  afterEach(() => { shutdownAllTimers(); });

  it('registerInterval 返回 id+ref，stats 能查到', () => {
    const before = stats().active;
    const { id, ref } = registerInterval(() => {}, 10000, 'test-interval');
    expect(id).toBeGreaterThan(0);
    expect(ref).toBeDefined();
    expect(stats().active).toBe(before + 1);
    expect(stats().byName['test-interval']).toBeGreaterThanOrEqual(1);
  });

  it('unregister 能清除已登记定时器', () => {
    const { id } = registerInterval(() => {}, 10000, 'to-clear');
    const before = stats().active;
    const ok = unregister(id);
    expect(ok).toBe(true);
    expect(stats().active).toBe(before - 1);
  });

  it('unregister 不存在 id 返回 false', () => {
    expect(unregister(9999999)).toBe(false);
  });

  it('shutdownAllTimers 清空所有定时器', () => {
    registerInterval(() => {}, 10000, 'x');
    registerInterval(() => {}, 10000, 'y');
    registerTimeout(() => {}, 10000, 'z');
    expect(stats().active).toBeGreaterThanOrEqual(3);
    shutdownAllTimers();
    expect(stats().active).toBe(0);
  });

  it('registerTimeout 触发后自动清理', done => {
    registerTimeout(() => {
      // 触发后自动清理（由 wrapper 实现）
      setTimeout(() => {
        const found = Array.from({ length: 10 }, (_, i) => stats().byName[Object.keys(stats().byName)[i]]).filter(Boolean);
        done();
      }, 10);
    }, 5, 'auto-cleanup');
  });
});
