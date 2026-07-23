/**
 * AI匹配引擎 (AIMatchingEngine)
 * 基于痛点标签和户型条件，AI强制推荐系统
 */

class AIMatchingEngine {
  constructor() {
    this.rules = [
      { trigger: 'tag_11(热水等待)', recommend: '中央热水系统', confidence: 0.95 },
      { trigger: 'tag_22(潮湿)', recommend: '新风除湿系统', confidence: 0.92 },
      { trigger: 'tag_33(水质)', recommend: '全屋净水系统', confidence: 0.94 },
      { trigger: 'tag_01(温差大)', recommend: '五恒恒温系统', confidence: 0.91 },
      { trigger: 'tag_02(西晒)', recommend: '中央空调系统', confidence: 0.93 },
      { trigger: 'tag_44(省心)', recommend: '全屋总包服务', confidence: 0.90 }
    ];
  }

  /**
   * 匹配系统
   */
  matchSystems(painDiagnosis, roomProfile) {
    const matchedSystems = [];
    
    this.rules.forEach(rule => {
      if (this.shouldApplyRule(rule, painDiagnosis, roomProfile)) {
        matchedSystems.push({
          name: rule.recommend,
          confidence: rule.confidence,
          reason: rule.trigger
        });
      }
    });
    
    return matchedSystems;
  }

  /**
   * 判断是否应用规则
   */
  shouldApplyRule(rule, painDiagnosis, roomProfile) {
    if (!painDiagnosis || !painDiagnosis.allTags) return false;
    
    return painDiagnosis.allTags.some(tag => 
      tag.id.includes(rule.trigger.match(/tag_\d+/)[0])
    );
  }
}

module.exports = AIMatchingEngine;