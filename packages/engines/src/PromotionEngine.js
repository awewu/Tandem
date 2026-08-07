/**
 * 促销引擎 (M7) - PromotionEngine
 * 实现价格促销、裂变促销、会员营销、产品促销等多种促销策略
 */

class PromotionEngine {
  constructor() {
    this.promotionRules = {
      // 价格促销
      pricePromotions: [
        { id: 'first_order', type: 'first_order', name: '首单红包', discount: 500, description: '新客户首单立减500元' },
        { id: 'full_reduction', type: 'full_reduction', threshold: 50000, discount: 5000, description: '满5万减5000' },
        { id: 'gradient_discount', type: 'gradient_discount', tiers: [{ amount: 20000, rate: 0.95 }, { amount: 50000, rate: 0.9 }] },
        { id: 'buy_gift', type: 'buy_gift', threshold: 30000, gift: '净水器滤芯', giftValue: 500, description: '满3万送净水器滤芯' },
        { id: 'package_deal', type: 'package_deal', systems: 6, discount: 10000, description: '六系统套餐优惠1万' },
        { id: 'limited_time', type: 'limited_time', startDate: '2026-04-01', endDate: '2026-04-30', discount: 0.9, description: '4月限时9折' },
        { id: 'lottery', type: 'lottery', prize: ['免单', '500元', '200元'], description: '下单抽奖，最高免单' },
        { id: 'holiday', type: 'holiday', holiday: '五一', discount: 0.92, description: '五一劳动节92折' },
        { id: 'deposit_expansion', type: 'deposit_expansion', deposit: 100, value: 500, description: '100元定金抵扣500元' },
        { id: 'low_price_high_value', type: 'low_price_high_value', pay: 16000, value: 20000, description: '花16000元买价值20000元商品' }
      ],

      // 裂变促销
      viralPromotions: [
        { id: 'share_moments', type: 'share_moments', likes: 20, reward: 200, description: '朋友圈点赞20个返200元' },
        { id: 'share_groups', type: 'share_groups', groups: 10, reward: 300, description: '转发10个社群返300元' },
        { id: 'refer_friends', type: 'refer_friends', friends: 3, reward: 500, description: '拉3个好友返500元' },
        { id: 'share_friends', type: 'share_friends', friends: 3, reward: 10, friends5: 5, reward5: 25, description: '转发3个好友送10元，5个好友送25元' },
        { id: 'bargain', type: 'bargain', initialPrice: 10000, targetPrice: 8000, description: '让好友帮忙砍价至8000元' },
        { id: 'group_buy', type: 'group_buy', tiers: [{ people: 30, price: 29900 }, { people: 50, price: 28900 }, { people: 100, price: 27900 }] },
        { id: 'old_referral', type: 'old_referral', commission: 0.05, description: '老客户推荐新客户返5%佣金' },
        { id: 'viral_task', type: 'viral_task', tasks: [{ people: 5, reward: 100 }, { people: 10, reward: 200 }, { people: 20, reward: 500 }], description: '拉5人返100，10人返200，20人返500' },
        { id: 'game_activity', type: 'game_activity', teamSize: 3, description: '组队抽奖，3人一队' },
        { id: 'red_packet', type: 'red_packet', fixedText: '瑞美舒适家居', reward: 50, description: '转发朋友圈返50元现金红包' }
      ],

      // 会员营销
      memberPromotions: [
        { id: 'silver_member', type: 'member', level: 'silver', discount: 0.98, description: '银卡会员98折' },
        { id: 'gold_member', type: 'member', level: 'gold', discount: 0.95, description: '金卡会员95折' },
        { id: 'diamond_member', type: 'member', level: 'diamond', discount: 0.92, description: '钻石会员92折' },
        { id: 'birthday_privilege', type: 'birthday', discount: 0.9, description: '生日当天9折' },
        { id: 'points_redeem', type: 'points', points: 1000, discount: 200, description: '1000积分兑换200元优惠券' }
      ],

      // 产品促销
      productPromotions: [
        { id: 'new_product', type: 'new_product', products: ['智能新风系统'], discount: 0.9, description: '新品上市9折' },
        { id: 'hot_product', type: 'hot_product', products: ['中央空调'], discount: 0.88, description: '爆品特价88折' },
        { id: 'seasonal', type: 'seasonal', season: 'summer', products: ['中央空调'], discount: 0.88, description: '夏季空调88折' },
        { id: 'seasonal_winter', type: 'seasonal', season: 'winter', products: ['中央热水系统'], discount: 0.88, description: '冬季暖气88折' },
        { id: 'clearance', type: 'clearance', products: ['旧款新风系统'], discount: 0.75, description: '换季清仓75折' },
        { id: 'combo', type: 'combo', combo: ['中央空调', '新风系统'], discount: 0.85, description: '空调+新风套餐85折' },
        { id: 'combo_water', type: 'combo', combo: ['中央热水系统', '全屋净水系统'], discount: 0.85, description: '热水+净水套餐85折' }
      ]
    };

    this.userProfiles = new Map(); // 用户档案
    this.promotionHistory = new Map(); // 促销历史
  }

  /**
   * 应用促销
   */
  applyPromotions(order, userProfile) {
    const applicablePromotions = [];
    let totalDiscount = 0;

    // 1. 价格促销
    const priceDiscount = this.applyPricePromotions(order, userProfile);
    if (priceDiscount) {
      applicablePromotions.push(priceDiscount);
      totalDiscount += priceDiscount.discount;
    }

    // 2. 裂变促销
    const viralDiscount = this.applyViralPromotions(order, userProfile);
    if (viralDiscount) {
      applicablePromotions.push(viralDiscount);
      totalDiscount += viralDiscount.discount;
    }

    // 3. 会员促销
    const memberDiscount = this.applyMemberPromotions(order, userProfile);
    if (memberDiscount) {
      applicablePromotions.push(memberDiscount);
      totalDiscount += memberDiscount.discount;
    }

    // 4. 产品促销
    const productDiscount = this.applyProductPromotions(order, userProfile);
    if (productDiscount) {
      applicablePromotions.push(productDiscount);
      totalDiscount += productDiscount.discount;
    }

    return {
      applicablePromotions,
      totalDiscount,
      finalPrice: order.totalPrice - totalDiscount
    };
  }

  /**
   * 应用价格促销
   */
  applyPricePromotions(order, userProfile) {
    // 检查首单
    if (!userProfile.hasOrdered) {
      return {
        id: 'first_order',
        name: '首单红包',
        discount: 500,
        description: '新客户首单立减500元'
      };
    }

    // 检查满减
    if (order.totalPrice >= 50000) {
      return {
        id: 'full_reduction',
        name: '满减优惠',
        discount: 5000,
        description: '满5万减5000'
      };
    }

    // 检查梯度折扣
    if (order.totalPrice >= 20000) {
      const gradientRule = this.promotionRules.pricePromotions.find(p => p.id === 'gradient_discount');
      const tier = gradientRule.tiers.find(t => order.totalPrice >= t.amount) || gradientRule.tiers[0];
      const discount = Math.round(order.totalPrice * (1 - tier.rate));
      return {
        id: 'gradient_discount',
        name: '梯度折扣',
        discount: discount,
        description: order.totalPrice >= 50000 ? '满5万9折' : '满2万95折'
      };
    }

    // 检查买赠
    if (order.totalPrice >= 30000) {
      const buyGiftRule = this.promotionRules.pricePromotions.find(p => p.id === 'buy_gift');
      return {
        id: 'buy_gift',
        name: '买赠优惠',
        discount: buyGiftRule.giftValue,
        description: `满3万送${buyGiftRule.gift}`
      };
    }

    // 检查套餐
    if (order.systemCount >= 6) {
      const packageRule = this.promotionRules.pricePromotions.find(p => p.id === 'package_deal');
      return {
        id: 'package_deal',
        name: '套餐优惠',
        discount: packageRule.discount,
        description: '六系统套餐优惠1万'
      };
    }

    // 检查限时
    const now = new Date();
    const limitedTimeRule = this.promotionRules.pricePromotions.find(p => p.id === 'limited_time');
    if (limitedTimeRule) {
      const startDate = new Date(limitedTimeRule.startDate);
      const endDate = new Date(limitedTimeRule.endDate);
      if (now >= startDate && now <= endDate) {
        const discount = Math.round(order.totalPrice * (1 - limitedTimeRule.discount));
        return {
          id: 'limited_time',
          name: '限时优惠',
          discount: discount,
          description: limitedTimeRule.description
        };
      }
    }

    return null;
  }

  /**
   * 应用裂变促销
   */
  applyViralPromotions(order, userProfile) {
    if (userProfile.sharedMoments && userProfile.sharedMoments.likes >= 20) {
      const rule = this.promotionRules.viralPromotions.find(p => p.id === 'share_moments');
      return {
        id: 'share_moments',
        name: '朋友圈分享',
        discount: rule.reward,
        description: rule.description
      };
    }

    if (userProfile.sharedGroups && userProfile.sharedGroups.count >= 10) {
      const rule = this.promotionRules.viralPromotions.find(p => p.id === 'share_groups');
      return {
        id: 'share_groups',
        name: '社群分享',
        discount: rule.reward,
        description: rule.description
      };
    }

    if (userProfile.referredFriends && userProfile.referredFriends.count >= 3) {
      const rule = this.promotionRules.viralPromotions.find(p => p.id === 'refer_friends');
      return {
        id: 'refer_friends',
        name: '拉好友',
        discount: rule.reward,
        description: rule.description
      };
    }

    return null;
  }

  /**
   * 应用会员促销
   */
  applyMemberPromotions(order, userProfile) {
    if (userProfile.memberLevel) {
      const memberRules = this.promotionRules.memberPromotions;
      const rule = memberRules.find(r => r.level === userProfile.memberLevel);
      if (rule) {
        return {
          id: rule.id,
          name: rule.name,
          discount: Math.round(order.totalPrice * (1 - rule.discount)),
          description: rule.description
        };
      }
    }

    // 检查生日特权
    if (userProfile.birthday) {
      const today = new Date();
      const birthday = new Date(userProfile.birthday);
      if (today.getMonth() === birthday.getMonth() && today.getDate() === birthday.getDate()) {
        const rule = this.promotionRules.memberPromotions.find(p => p.id === 'birthday_privilege');
        return {
          id: 'birthday_privilege',
          name: '生日特权',
          discount: Math.round(order.totalPrice * (1 - rule.discount)),
          description: rule.description
        };
      }
    }

    return null;
  }

  /**
   * 应用产品促销
   */
  applyProductPromotions(order, userProfile) {
    const products = order.products ? order.products.map(p => p.name) : [];

    // 检查套餐
    if (products.includes('中央空调') && products.includes('新风系统')) {
      const rule = this.promotionRules.productPromotions.find(p => p.id === 'combo');
      return {
        id: 'combo',
        name: '组合套餐',
        discount: Math.round(order.totalPrice * (1 - rule.discount)),
        description: rule.description
      };
    }

    if (products.includes('中央热水系统') && products.includes('全屋净水系统')) {
      const rule = this.promotionRules.productPromotions.find(p => p.id === 'combo_water');
      return {
        id: 'combo_water',
        name: '水系统套餐',
        discount: Math.round(order.totalPrice * (1 - rule.discount)),
        description: rule.description
      };
    }

    // 检查新品
    if (products.includes('智能新风系统')) {
      const rule = this.promotionRules.productPromotions.find(p => p.id === 'new_product');
      return {
        id: 'new_product',
        name: '新品优惠',
        discount: Math.round(order.totalPrice * (1 - rule.discount)),
        description: rule.description
      };
    }

    // 检查季节促销
    const month = new Date().getMonth() + 1;
    if (month >= 6 && month <= 8 && products.includes('中央空调')) {
      const rule = this.promotionRules.productPromotions.find(p => p.id === 'seasonal');
      return {
        id: 'seasonal',
        name: '夏季促销',
        discount: Math.round(order.totalPrice * (1 - rule.discount)),
        description: rule.description
      };
    }

    if (month >= 11 || month <= 2 && products.includes('中央热水系统')) {
      const rule = this.promotionRules.productPromotions.find(p => p.id === 'seasonal_winter');
      return {
        id: 'seasonal_winter',
        name: '冬季促销',
        discount: Math.round(order.totalPrice * (1 - rule.discount)),
        description: rule.description
      };
    }

    return null;
  }

  /**
   * 获取所有可用促销
   */
  getAllPromotions() {
    return {
      pricePromotions: this.promotionRules.pricePromotions,
      viralPromotions: this.promotionRules.viralPromotions,
      memberPromotions: this.promotionRules.memberPromotions,
      productPromotions: this.promotionRules.productPromotions
    };
  }

  /**
   * 更新用户档案
   */
  updateUserProfile(userId, profile) {
    this.userProfiles.set(userId, profile);
  }

  /**
   * 获取用户档案
   */
  getUserProfile(userId) {
    return this.userProfiles.get(userId) || {};
  }

  /**
   * 记录促销历史
   */
  recordPromotionHistory(userId, promotion) {
    if (!this.promotionHistory.has(userId)) {
      this.promotionHistory.set(userId, []);
    }
    this.promotionHistory.get(userId).push({
      ...promotion,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 获取促销历史
   */
  getPromotionHistory(userId) {
    return this.promotionHistory.get(userId) || [];
  }
}

module.exports = PromotionEngine;
