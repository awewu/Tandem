/** JourneySimulator 单元测试 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const CustomerJourneyStore = require('../../server/core/CustomerJourneyStore');
const JourneySimulator = require('../../server/services/JourneySimulator');

describe('JourneySimulator', () => {
  let tmpPath, store;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), 'sim-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    store = new CustomerJourneyStore({ dbPath: tmpPath });
  });

  afterEach(() => { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); });

  it('CASES 10 个画像配置完整', () => {
    expect(JourneySimulator.CASES).toHaveLength(10);
    JourneySimulator.CASES.forEach(c => {
      expect(c.customer).toHaveProperty('name');
      expect(c.customer).toHaveProperty('phone');
      expect(c.customer).toHaveProperty('city');
      expect(c.profile).toHaveProperty('houseType');
      expect(c.profile).toHaveProperty('area');
      expect(c.profile).toHaveProperty('budget');
      expect(Array.isArray(c.painPoints)).toBe(true);
      expect(c.painPoints.length).toBeGreaterThan(0);
    });
  });

  it('runAll 写入 10 条 journey 到 store', () => {
    const result = JourneySimulator.runAll({ reset: true, store });
    expect(result.success).toBe(true);
    expect(result.executedCases).toBe(10);
    expect(store.list({}).length).toBe(10);
  });

  it('每条 journey 有 7 个阶段', () => {
    JourneySimulator.runAll({ reset: true, store });
    const items = store.list({});
    items.forEach(j => {
      expect(Object.keys(j.stages)).toHaveLength(7);
    });
  });

  it('每条 journey 有至少 9 条沟通记录', () => {
    JourneySimulator.runAll({ reset: true, store });
    const items = store.list({});
    items.forEach(j => {
      expect(j.communications.length).toBeGreaterThanOrEqual(9);
    });
  });

  it('每条 journey 时间线 >= 18 条', () => {
    JourneySimulator.runAll({ reset: true, store });
    const items = store.list({});
    items.forEach(j => {
      expect(j.timeline.length).toBeGreaterThanOrEqual(18);
    });
  });

  it('runSingleCase 返回的 journey 结构完整', () => {
    const j = JourneySimulator.runSingleCase(store, 0, JourneySimulator.CASES[0]);
    expect(j.caseId).toBeDefined();
    expect(j.customer.name).toBe('张建国');
    expect(j.profile.city || j.customer.city).toBeDefined();
    expect(j.stages).toBeDefined();
  });

  it('10 案例的合同总金额 > 0', () => {
    JourneySimulator.runAll({ reset: true, store });
    const stats = store.stats();
    expect(stats.totalContractAmount).toBeGreaterThan(0);
    expect(stats.totalContractValue).toBe(stats.totalContractAmount);  // 别名
  });

  it('reset=true 会清空旧数据', () => {
    // 先放一条垃圾数据
    store.create({ customer: { name: '旧数据', phone: '999' } });
    expect(store.list({}).length).toBe(1);
    JourneySimulator.runAll({ reset: true, store });
    // 旧数据被清除，只有 10 条新的
    expect(store.list({}).length).toBe(10);
    expect(store.list({ phone: '999' })).toHaveLength(0);
  });
});
