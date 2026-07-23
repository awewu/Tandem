/** CustomerJourneyStore (JSON 版) 单元测试 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const CustomerJourneyStore = require('../../server/core/CustomerJourneyStore');

describe('CustomerJourneyStore', () => {
  let tmpPath;
  let store;

  beforeEach(() => {
    tmpPath = path.join(os.tmpdir(), 'journey-test-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.json');
    store = new CustomerJourneyStore({ dbPath: tmpPath });
  });

  afterEach(() => {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  });

  it('create 新客户带有 7 阶段占位', () => {
    const j = store.create({ customer: { name: '测试', phone: '13800000000' } });
    expect(j.caseId).toBeDefined();
    expect(j.currentStage).toBe('diagnosis');
    expect(j.status).toBe('active');
    expect(Object.keys(j.stages)).toHaveLength(7);
    expect(j.stages.diagnosis.status).toBe('pending');
  });

  it('updateStage 完成后 currentStage 推进到下一个', () => {
    const j = store.create({ customer: { name: 'A' } });
    store.updateStage(j.caseId, 'diagnosis', { status: 'completed', responsible: '销售' });
    const updated = store.get(j.caseId);
    expect(updated.stages.diagnosis.status).toBe('completed');
    expect(updated.stages.diagnosis.completedAt).toBeDefined();
    expect(updated.currentStage).toBe('lockin');  // 自动推进
  });

  it('updateStage 非法 stage 抛错', () => {
    const j = store.create({ customer: { name: 'A' } });
    expect(() => store.updateStage(j.caseId, 'invalid', {})).toThrow(/Invalid stage/);
  });

  it('addCommunication 追加到 communications + timeline', () => {
    const j = store.create({ customer: { name: 'B' } });
    store.addCommunication(j.caseId, { channel: '微信', content: '测试' });
    const after = store.get(j.caseId);
    expect(after.communications).toHaveLength(1);
    expect(after.communications[0].channel).toBe('微信');
    expect(after.timeline.length).toBeGreaterThanOrEqual(2);  // create + comm
  });

  it('list 支持 phone 筛选', () => {
    store.create({ customer: { name: 'A', phone: '111' } });
    store.create({ customer: { name: 'B', phone: '222' } });
    expect(store.list({ phone: '111' })).toHaveLength(1);
    expect(store.list({ phone: '222' })).toHaveLength(1);
    expect(store.list({})).toHaveLength(2);
  });

  it('list 支持 q 模糊搜索', () => {
    store.create({ customer: { name: '张三', phone: '13800' } });
    store.create({ customer: { name: '李四', phone: '13900' } });
    expect(store.list({ q: '张' })).toHaveLength(1);
    expect(store.list({ q: '138' })).toHaveLength(1);
  });

  it('stats 返回 totalContractValue 别名 (P1 修复)', () => {
    const j = store.create({ customer: { name: 'A' } });
    store.updateStage(j.caseId, 'deal', { status: 'completed', data: { finalAmount: 100000 } });
    const s = store.stats();
    expect(s.totalJourneys).toBe(1);
    expect(s.totalContractAmount).toBe(100000);
    expect(s.totalContractValue).toBe(100000);  // 别名
  });

  it('close 将状态改为 closed-won', () => {
    const j = store.create({ customer: { name: 'A' } });
    store.close(j.caseId, 'closed-won', '成交');
    expect(store.get(j.caseId).status).toBe('closed-won');
  });

  it('持久化: 重新实例化后能读回数据', () => {
    store.create({ customer: { name: '持久化测试' } });
    const store2 = new CustomerJourneyStore({ dbPath: tmpPath });
    const items = store2.list({});
    expect(items).toHaveLength(1);
    expect(items[0].customer.name).toBe('持久化测试');
  });
});
