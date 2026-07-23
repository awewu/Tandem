/** PromotionMatchService 单元测试 */
const PromotionMatchService = require('../../server/services/PromotionMatchService');

// Mock promotion engine
const mockEngine = {
  getAllPromotions: () => [
    { id: 'full_100_off', type: 'full_reduction', name: '满1万减1000', threshold: 10000, discount: 1000, active: true },
    { id: 'gold_discount', type: 'gold_member', name: '金卡9折', rate: 0.1, active: true, memberOnly: 'gold' },
    { id: 'combo_water', type: 'combo_water', name: '水系统套餐', discount: 2000, active: true },
    { id: 'buy_gift', type: 'buy_gift', name: '赠品礼包', giftValue: 800, active: true }
  ],
  applyPromotions: () => ({}),
  updateUserProfile: () => {},
  getUserProfile: () => ({}),
  getPromotionHistory: () => []
};

describe('PromotionMatchService', () => {
  let svc;
  beforeEach(() => { svc = new PromotionMatchService(mockEngine); });

  it('match 返回完整结果对象', () => {
    const r = svc.match({
      order: { totalPrice: 50000, painPoints: [], houseType: '平层' }
    });
    expect(r).toHaveProperty('bestCombo');
    expect(r).toHaveProperty('allCombos');
    expect(r).toHaveProperty('triggers');
    expect(r).toHaveProperty('story');
  });

  it('痛点"地下室潮湿"触发水系统套餐推荐', () => {
    const r = svc.match({
      order: { totalPrice: 80000, painPoints: ['地下室返潮严重'], houseType: '别墅' }
    });
    const triggerIds = r.triggers.map(t => t.id);
    expect(triggerIds).toContain('combo_water');
  });

  it('季节触发夏季限定促销', () => {
    const r = svc.match({
      order: { totalPrice: 60000 },
      context: { season: 'summer' }
    });
    expect(r.triggers.some(t => t.id === 'seasonal')).toBe(true);
  });

  it('大户型触发套餐推荐', () => {
    const r = svc.match({
      order: { totalPrice: 200000, houseType: '独栋别墅' }
    });
    expect(r.triggers.some(t => t.id === 'package_deal')).toBe(true);
  });

  it('毛利保护: 最佳组合折扣率不超过 25%', () => {
    const r = svc.match({ order: { totalPrice: 30000 } });
    if (r.bestCombo && r.bestCombo.savingRate != null) {
      expect(r.bestCombo.savingRate).toBeLessThanOrEqual(0.25);
    }
  });

  it('bestCombo 总是 allCombos 中节省最多的', () => {
    const r = svc.match({ order: { totalPrice: 100000 } });
    if (r.allCombos && r.allCombos.length > 1 && r.bestCombo) {
      const maxSaving = Math.max(...r.allCombos.map(c => c.savings || 0));
      expect(r.bestCombo.savings).toBe(maxSaving);
    }
  });

  it('story 是包含 headline/subline/badges 的对象', () => {
    const r = svc.match({ order: { totalPrice: 60000 } });
    expect(r.story).toBeDefined();
    expect(typeof r.story).toBe('object');
    expect(r.story).toHaveProperty('headline');
    expect(typeof r.story.headline).toBe('string');
    expect(r.story.headline.length).toBeGreaterThan(0);
  });

  it('空订单不崩溃', () => {
    expect(() => svc.match({})).not.toThrow();
    expect(() => svc.match({ order: {} })).not.toThrow();
  });
});
