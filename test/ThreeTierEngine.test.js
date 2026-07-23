/**
 * ThreeTierEngine 单元测试
 * 验证契约稳定性与一致性（同输入→同输出）
 */

const ThreeTierEngine = require('../server/core/ThreeTierEngine');

describe('ThreeTierEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ThreeTierEngine();
  });

  describe('generate() - 核心契约', () => {
    test('应返回三档方案且结构符合契约', () => {
      const result = engine.generate({
        area: 120,
        city: '上海',
        budget: '标准型',
        painPoints: ['冬天冷', '夏天热']
      });

      expect(result.version).toBe('1.0.0');
      expect(result.generatedAt).toBeTruthy();
      expect(result.tiers).toHaveProperty('basic');
      expect(result.tiers).toHaveProperty('comfort');
      expect(result.tiers).toHaveProperty('premium');

      ['basic', 'comfort', 'premium'].forEach(k => {
        expect(result.tiers[k]).toHaveProperty('tier', k);
        expect(result.tiers[k]).toHaveProperty('name');
        expect(result.tiers[k]).toHaveProperty('totalPrice');
        expect(typeof result.tiers[k].totalPrice).toBe('number');
        expect(result.tiers[k]).toHaveProperty('systems');
        expect(Array.isArray(result.tiers[k].systems)).toBe(true);
        expect(result.tiers[k]).toHaveProperty('valueProposition');
        expect(result.tiers[k]).toHaveProperty('roi');
      });
    });

    test('comfort档默认 recommended=true', () => {
      const result = engine.generate({ area: 100 });
      expect(result.tiers.comfort.recommended).toBe(true);
    });

    test('价格应满足 basic < comfort < premium', () => {
      const result = engine.generate({
        area: 120, city: '上海', budget: '标准型',
        painPoints: ['冬天冷', '夏天热', '空气差']
      });
      expect(result.tiers.basic.totalPrice).toBeLessThan(result.tiers.comfort.totalPrice);
      expect(result.tiers.comfort.totalPrice).toBeLessThan(result.tiers.premium.totalPrice);
    });

    test('同样输入应产出一致的套餐价（确定性）', () => {
      const input = { area: 100, city: '上海', painPoints: ['冬天冷'] };
      const r1 = engine.generate(input);
      const r2 = engine.generate(input);
      expect(r1.packagePricing.basic.subtotal).toEqual(r2.packagePricing.basic.subtotal);
      expect(r1.packagePricing.comfort.perSqm).toEqual(r2.packagePricing.comfort.perSqm);
      expect(r1.tiers.basic.totalPrice).toEqual(r2.tiers.basic.totalPrice);
    });
  });

  describe('generate() - 参数校验', () => {
    test('缺少 area 应抛异常', () => {
      expect(() => engine.generate({})).toThrow(/area.*必填/);
    });

    test('area=0 应抛异常', () => {
      expect(() => engine.generate({ area: 0 })).toThrow(/area.*必填/);
    });

    test('面积 60㎡ 自动推断为"一居"', () => {
      const r = engine.generate({ area: 55 });
      expect(r.input.houseType).toBe('一居');
    });

    test('面积 250㎡ 自动推断为"别墅"', () => {
      const r = engine.generate({ area: 250 });
      expect(r.input.houseType).toBe('别墅');
    });
  });

  describe('packagePricing - 套餐定价', () => {
    test('一线城市(上海)系数 1.10', () => {
      const r = engine.generate({ area: 100, city: '上海' });
      expect(r.packagePricing.basic.cityFactor).toBe(1.10);
      expect(r.packagePricing.basic.perSqm).toBe(Math.round(899 * 1.10));  // 989
    });

    test('二线城市(杭州)系数 1.05', () => {
      const r = engine.generate({ area: 100, city: '杭州' });
      expect(r.packagePricing.basic.cityFactor).toBe(1.05);
    });

    test('其他城市系数 1.0', () => {
      const r = engine.generate({ area: 100, city: '淄博' });
      expect(r.packagePricing.basic.cityFactor).toBe(1.0);
      expect(r.packagePricing.basic.perSqm).toBe(899);
    });

    test('subtotal = perSqm * area', () => {
      const r = engine.generate({ area: 90, city: '上海' });
      const pkg = r.packagePricing.comfort;
      expect(pkg.subtotal).toBe(pkg.perSqm * pkg.area);
    });
  });

  describe('quickQuote() - 简化入口', () => {
    test('仅需 area 返回套餐价', () => {
      const r = engine.quickQuote({ area: 100, city: '上海' });
      expect(r.packagePricing).toBeDefined();
      expect(r.packagePricing.basic.subtotal).toBeGreaterThan(0);
    });

    test('缺 area 应抛异常', () => {
      expect(() => engine.quickQuote({})).toThrow();
    });
  });

  describe('recommendation - 推荐逻辑', () => {
    test('经济型预算应推荐 basic', () => {
      const r = engine.generate({ area: 80, budget: '经济型' });
      expect(r.recommendation.recommendedTier).toBe('basic');
    });

    test('标准型+温和痛点应推荐 comfort', () => {
      const r = engine.generate({ area: 120, budget: '标准型', painPoints: ['水温不稳'] });
      expect(r.recommendation.recommendedTier).toBe('comfort');
    });

    test('豪华型预算应推荐 premium', () => {
      const r = engine.generate({ area: 200, budget: '豪华型' });
      expect(r.recommendation.recommendedTier).toBe('premium');
    });
  });
});
