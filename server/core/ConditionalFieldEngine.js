/**
 * Agent-3: 字段条件显示逻辑引擎
 * 一小时冲刺开发 - 条件字段显示控制
 * 
 * 覆盖PRD新增P0需求：
 * - tag_01: 仅地上层数≥2层可勾选
 * - tag_02: 仅勾选"大面积落地窗"或"西晒"可勾选
 * - tag_11: 仅卫生间总数≥2个可勾选
 * - tag_12: 仅卫生间≥2个或浴缸≥1个可勾选
 * - tag_22: 地下室默认补充
 * - tag_33: 母婴默认补充
 */

class ConditionalFieldEngine {
  constructor() {
    // 条件规则配置
    this.conditionalRules = {
      // 温度体感痛点条件
      'tag_01': {
        description: '楼层多→上下楼层温差大',
        condition: (roomProfile) => (roomProfile.floors || 0) >= 2,
        message: '仅地上层数≥2层时可勾选此痛点'
      },
      'tag_02': {
        description: '落地窗/西晒→夏热冬冷能耗高',
        condition: (roomProfile) => {
          const features = roomProfile.keyFeatures || [];
          return features.includes('大面积落地窗') || features.includes('西晒');
        },
        message: '仅勾选"大面积落地窗"或"西晒"时可勾选此痛点'
      },
      
      // 热水用水痛点条件
      'tag_11': {
        description: '远端龙头/浴缸放冷水久',
        condition: (roomProfile) => (roomProfile.bathrooms || 0) >= 2,
        message: '仅卫生间总数≥2个时可勾选此痛点'
      },
      'tag_12': {
        description: '多点同时洗澡→水温波动',
        condition: (roomProfile) => {
          return (roomProfile.bathrooms || 0) >= 2 || (roomProfile.bathtubs || 0) >= 1;
        },
        message: '仅卫生间≥2个或浴缸≥1个时可勾选此痛点'
      },
      
      // AI隐性痛点识别规则
      'ai_rules': {
        // 别墅/叠拼默认补充
        'tag_01': {
          condition: (roomProfile) => {
            const type = roomProfile.propertyType;
            return type === '独栋' || type === '叠拼' || (roomProfile.floors || 0) >= 3;
          },
          reason: '检测到您的户型为别墅/叠拼，可能存在楼层温差问题',
          canCancel: true
        },
        'tag_11': {
          condition: (roomProfile) => {
            const type = roomProfile.propertyType;
            return type === '独栋' || type === '叠拼';
          },
          reason: '检测到您的户型为别墅/叠拼，可能存在远端热水等待问题',
          canCancel: true
        },
        
        // 西晒/落地窗默认补充
        'tag_02': {
          condition: (roomProfile) => {
            const features = roomProfile.keyFeatures || [];
            return features.includes('大面积落地窗') || features.includes('西晒');
          },
          reason: '检测到您勾选了落地窗/西晒，可能存在夏热冬冷问题',
          canCancel: true
        },
        
        // 地下室默认补充
        'tag_22': {
          condition: (roomProfile) => {
            return (roomProfile.basement || '无') !== '无' && (roomProfile.basementArea || 0) > 0;
          },
          reason: '检测到您有地下室，可能存在潮湿发霉问题',
          canCancel: true
        },
        
        // 母婴默认补充
        'tag_33': {
          condition: (roomProfile) => roomProfile.hasInfant === true,
          reason: '检测到您有婴幼儿，可能需要专属洁净用水',
          canCancel: true
        },
        
        // 老人默认补充
        'tag_03': {
          condition: (roomProfile) => roomProfile.hasElderly === true,
          reason: '检测到您有老人同住，可能存在空调直吹不适问题',
          canCancel: true
        }
      }
    };
  }

  /**
   * 检查单个tag是否可用
   */
  checkTagAvailable(tagId, roomProfile) {
    const rule = this.conditionalRules[tagId];
    if (!rule) {
      return { available: true, message: null };
    }
    
    const available = rule.condition(roomProfile);
    return {
      available,
      message: available ? null : rule.message,
      description: rule.description
    };
  }

  /**
   * 批量检查所有tag的可用性
   */
  checkAllTagsAvailability(roomProfile, selectedTags = []) {
    const tagCategories = {
      temperature: ['tag_01', 'tag_02', 'tag_03', 'tag_04', 'tag_05'],
      hotWater: ['tag_11', 'tag_12', 'tag_13', 'tag_14', 'tag_15'],
      humidity: ['tag_21', 'tag_22', 'tag_23', 'tag_24', 'tag_25'],
      waterQuality: ['tag_31', 'tag_32', 'tag_33', 'tag_34'],
      hassleFree: ['tag_41', 'tag_42', 'tag_43', 'tag_44']
    };
    
    const result = {};
    
    Object.keys(tagCategories).forEach(category => {
      result[category] = tagCategories[category].map(tagId => {
        const check = this.checkTagAvailable(tagId, roomProfile);
        return {
          tagId,
          ...check,
          selected: selectedTags.includes(tagId)
        };
      });
    });
    
    return result;
  }

  /**
   * AI隐性痛点识别
   */
  aiRecognizeHiddenPainPoints(roomProfile, manuallySelectedTags = []) {
    const aiRules = this.conditionalRules.ai_rules;
    const recommendations = [];
    
    Object.keys(aiRules).forEach(tagId => {
      // 如果用户已手动选择，不再推荐
      if (manuallySelectedTags.includes(tagId)) return;
      
      const rule = aiRules[tagId];
      if (rule.condition(roomProfile)) {
        recommendations.push({
          tagId,
          reason: rule.reason,
          canCancel: rule.canCancel,
          confidence: this.calculateConfidence(tagId, roomProfile)
        });
      }
    });
    
    return {
      recommendations,
      total: recommendations.length,
      accuracy: this.calculateAccuracy(recommendations)
    };
  }

  /**
   * 计算推荐置信度
   */
  calculateConfidence(tagId, roomProfile) {
    // 基于户型特征计算置信度
    let confidence = 0.90; // 基础90%
    
    // 根据户型类型调整
    const type = roomProfile.propertyType;
    if (type === '独栋' || type === '联排') {
      confidence += 0.05;
    }
    
    // 根据楼层数调整
    if ((roomProfile.floors || 0) >= 3) {
      confidence += 0.03;
    }
    
    // 根据特殊特征调整
    if (tagId === 'tag_02') {
      const features = roomProfile.keyFeatures || [];
      if (features.includes('西晒') && features.includes('大面积落地窗')) {
        confidence += 0.05;
      }
    }
    
    return Math.min(confidence, 0.98);
  }

  /**
   * 计算整体识别精度
   */
  calculateAccuracy(recommendations) {
    if (recommendations.length === 0) return 1.0;
    
    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;
    return avgConfidence;
  }

  /**
   * 验证户型档案字段合法性
   */
  validateRoomProfile(roomProfile) {
    const errors = [];
    
    // 房屋业态
    const validTypes = ['平层', '大平层', '叠拼', '联排', '独栋'];
    if (!validTypes.includes(roomProfile.propertyType)) {
      errors.push({ field: 'propertyType', message: '请选择有效的房屋业态' });
    }
    
    // 建筑面积
    if (!roomProfile.area || roomProfile.area < 50 || roomProfile.area > 1000) {
      errors.push({ field: 'area', message: '请输入有效面积（50-1000㎡）' });
    }
    
    // 地上层数
    if (!roomProfile.floors || roomProfile.floors < 1 || roomProfile.floors > 5) {
      errors.push({ field: 'floors', message: '请输入有效层数（1-5层）' });
    }
    
    // 地下室
    if (roomProfile.basement && roomProfile.basement !== '无') {
      if (!roomProfile.basementArea || roomProfile.basementArea < 10 || roomProfile.basementArea > 500) {
        errors.push({ field: 'basementArea', message: '请输入有效地下室面积（10-500㎡）' });
      }
    }
    
    // 常住人数
    if (!roomProfile.occupants || roomProfile.occupants < 1 || roomProfile.occupants > 10) {
      errors.push({ field: 'occupants', message: '请输入有效人数（1-10人）' });
    }
    
    // 卫生间总数
    if (!roomProfile.bathrooms || roomProfile.bathrooms < 1 || roomProfile.bathrooms > 10) {
      errors.push({ field: 'bathrooms', message: '请输入有效卫生间数量（1-10个）' });
    }
    
    // 浴缸点位
    if (roomProfile.bathtubs !== undefined) {
      if (roomProfile.bathtubs < 0 || roomProfile.bathtubs > 5) {
        errors.push({ field: 'bathtubs', message: '请输入有效浴缸点位（0-5个）' });
      }
      if (roomProfile.bathtubs > roomProfile.bathrooms) {
        errors.push({ field: 'bathtubs', message: '浴缸点位不可大于卫生间总数' });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 生成前端可用的字段状态配置
   */
  generateFieldStateConfig(roomProfile) {
    return {
      // 标签可用性
      tags: this.checkAllTagsAvailability(roomProfile),
      
      // AI推荐
      aiRecommendations: this.aiRecognizeHiddenPainPoints(roomProfile),
      
      // 字段验证
      validation: this.validateRoomProfile(roomProfile),
      
      // 字段默认值
      defaults: {
        tag_01: { disabled: (roomProfile.floors || 0) < 2 },
        tag_02: { 
          disabled: !((roomProfile.keyFeatures || []).includes('大面积落地窗') || 
                      (roomProfile.keyFeatures || []).includes('西晒')) 
        },
        tag_11: { disabled: (roomProfile.bathrooms || 0) < 2 },
        tag_12: { 
          disabled: (roomProfile.bathrooms || 0) < 2 && (roomProfile.bathtubs || 0) < 1 
        }
      }
    };
  }
}

module.exports = ConditionalFieldEngine;
