/**
 * 设备安装位置智能验证与优化引擎
 * DevicePositioningEngine
 * 
 * 功能：
 * 1. 设备位置合规性验证（间距、检修空间、安装高度）
 * 2. 设备间碰撞检测与冲突解决
 * 3. 自动推荐最佳安装位置
 * 4. 负荷匹配验证（设备容量与房间需求）
 * 5. 生成安装位置优化报告
 */

class DevicePositioningEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'DevicePositioningEngine';
    
    // 设备安装规范数据库
    this.installationRules = {
      // 空调室外机
      ac_outdoor: {
        minWallDistance: 300,      // 距墙最小300mm（散热）
        minCeilingDistance: 500,   // 顶部最小500mm
        minGroundHeight: 100,      // 离地最小100mm（防积水）
        maxGroundHeight: 1500,     // 离地最大1500mm（便于维护）
        minSideClearance: 600,     // 侧面检修空间600mm
        minFrontClearance: 800,    // 正面检修空间800mm
        forbiddenAreas: ['厨房油烟区', '卫生间潮湿区', '卧室床头侧'],
        ventilationRequirement: '良好通风',
        noiseSensitive: true
      },
      
      // 空调室内机
      ac_indoor: {
        minWallDistance: 100,      // 距墙100mm（回风）
        minCeilingDistance: 50,    // 距吊顶50mm
        minGroundHeight: 2200,     // 离地最小2200mm（风管机）
        maxGroundHeight: 2800,     // 离地最大2800mm
        minFrontClearance: 400,    // 检修口400mm
        forbiddenAreas: ['床头正上方', '餐桌正上方', '灶台正上方'],
        airflowRequirement: '送风无遮挡',
        condensateDrainSlope: 0.01  // 排水坡度1%
      },
      
      // 壁挂炉
      boiler: {
        minWallDistance: 50,       // 背距墙50mm（挂钩）
        minSideClearance: 500,     // 侧面检修500mm
        minFrontClearance: 600,    // 正面操作600mm
        minCeilingDistance: 300,   // 顶部300mm
        minGroundHeight: 1200,     // 底部距地1200mm（便于观察）
        maxGroundHeight: 1600,     // 最高1600mm
        forbiddenAreas: ['卧室', '卫生间', '浴室', '封闭橱柜内'],
        ventilationRequirement: '强制通风',
        flueRequirement: '烟道直达室外',
        gasSafetyDistance: 300     // 距燃气管300mm
      },
      
      // 热水器
      water_heater: {
        minWallDistance: 50,
        minSideClearance: 300,
        minFrontClearance: 500,
        minCeilingDistance: 200,
        minGroundHeight: 1500,     // 半隐藏式安装
        maxGroundHeight: 1800,
        forbiddenAreas: ['淋浴区', '浴缸上方', '电器正上方'],
        ventilationRequirement: '通风良好',
        drainRequired: true
      },
      
      // 新风机
      fresh_air: {
        minWallDistance: 100,
        minSideClearance: 400,     // 检修侧
        minFrontClearance: 300,    // 滤网更换空间
        minCeilingDistance: 50,    // 吊顶安装
        preferredLocation: ['走廊吊顶', '阳台', '设备平台'],
        noiseControl: '<35dB at bedroom',
        filterAccess: '便于更换'
      },
      
      // 分水器
      manifold: {
        minWallDistance: 100,
        minFrontClearance: 400,    // 操作空间
        minGroundHeight: 300,      // 便于排水
        maxGroundHeight: 600,      // 便于操作
        preferredLocation: ['厨房', '卫生间干区', '设备间'],
        isolationRequired: true,     // 需与水路隔离
        drainRequired: true
      },
      
      // 净水设备
      water_purifier: {
        minWallDistance: 50,
        minFrontClearance: 300,    // 换滤芯空间
        minGroundHeight: 800,      // 橱柜内安装
        maxGroundHeight: 1500,
        forbiddenAreas: ['热源附近', '阳光直射'],
        drainRequired: true,        // 废水排放
        pressureRequirement: '0.1-0.4MPa'
      }
    };
    
    // 设备尺寸库（单位：mm）
    this.deviceDimensions = {
      ac_outdoor: { width: 900, height: 700, depth: 350 },
      ac_indoor: { width: 1100, height: 300, depth: 450 },
      boiler: { width: 400, height: 700, depth: 300 },
      water_heater: { width: 530, height: 330, depth: 170 },
      fresh_air: { width: 800, height: 600, depth: 280 },
      manifold: { width: 600, height: 400, depth: 150 },
      water_purifier: { width: 400, height: 450, depth: 200 }
    };
    
    // 房间负荷参考（W/㎡）
    this.loadReference = {
      bedroom: { cooling: 120, heating: 80 },
      livingRoom: { cooling: 150, heating: 100 },
      diningRoom: { cooling: 140, heating: 90 },
      kitchen: { cooling: 180, heating: 0 },
      bathroom: { cooling: 100, heating: 150 },
      study: { cooling: 130, heating: 85 }
    };
  }
  
  /**
   * 验证设备位置合理性
   * @param {Array} devices - 设备列表
   * @param {Object} roomData - 房间数据
   * @returns {Object} 验证结果
   */
  validateDevicePositions(devices, roomData) {
    const issues = [];
    const warnings = [];
    const validDevices = [];
    
    devices.forEach((device, index) => {
      const result = this.validateSingleDevice(device, roomData);
      
      if (result.errors.length > 0) {
        issues.push({
          deviceIndex: index,
          deviceName: device.name,
          deviceType: device.type,
          position: device.position,
          errors: result.errors
        });
      }
      
      if (result.warnings.length > 0) {
        warnings.push({
          deviceIndex: index,
          deviceName: device.name,
          warnings: result.warnings
        });
      }
      
      if (result.isValid) {
        validDevices.push({
          index,
          device,
          score: result.score
        });
      }
    });
    
    // 检查设备间冲突
    const conflicts = this.checkDeviceConflicts(devices);
    
    return {
      success: issues.length === 0,
      isValid: issues.length === 0,
      totalDevices: devices.length,
      validCount: validDevices.length,
      issueCount: issues.length,
      warningCount: warnings.length,
      conflictCount: conflicts.length,
      issues,
      warnings,
      conflicts,
      validDevices,
      overallScore: this.calculateOverallScore(devices, issues, warnings, conflicts),
      recommendations: this.generateRecommendations(issues, conflicts)
    };
  }
  
  /**
   * 验证单个设备位置
   */
  validateSingleDevice(device, roomData) {
    const rules = this.installationRules[device.type];
    const dimensions = this.deviceDimensions[device.type] || device.dimensions;
    
    if (!rules) {
      return {
        isValid: true,
        errors: [],
        warnings: [{ message: '无安装规范，请人工确认' }],
        score: 70
      };
    }
    
    const errors = [];
    const warnings = [];
    let score = 100;
    
    const pos = device.position;
    const room = roomData;
    
    // 1. 检查是否在房间范围内
    if (pos.x < 0 || pos.x > room.width || 
        pos.y < 0 || pos.y > room.length) {
      errors.push({
        type: 'out_of_bounds',
        message: '设备位置超出房间范围',
        severity: 'high'
      });
      score -= 30;
    }
    
    // 2. 检查距墙距离
    const wallDistances = {
      left: pos.x,
      right: room.width - pos.x,
      front: pos.y,
      back: room.length - pos.y
    };
    
    if (rules.minWallDistance) {
      const minDist = Math.min(...Object.values(wallDistances));
      if (minDist < rules.minWallDistance) {
        errors.push({
          type: 'wall_clearance',
          message: `距墙距离${minDist}mm不足，需≥${rules.minWallDistance}mm`,
          current: minDist,
          required: rules.minWallDistance,
          severity: 'high'
        });
        score -= 20;
      }
    }
    
    // 3. 检查安装高度
    if (rules.minGroundHeight && pos.z < rules.minGroundHeight) {
      errors.push({
        type: 'height_too_low',
        message: `安装高度${pos.z}mm过低，需≥${rules.minGroundHeight}mm`,
        current: pos.z,
        required: rules.minGroundHeight,
        severity: 'medium'
      });
      score -= 15;
    }
    
    if (rules.maxGroundHeight && pos.z > rules.maxGroundHeight) {
      errors.push({
        type: 'height_too_high',
        message: `安装高度${pos.z}mm过高，需≤${rules.maxGroundHeight}mm`,
        current: pos.z,
        required: rules.maxGroundHeight,
        severity: 'medium'
      });
      score -= 15;
    }
    
    // 4. 检查检修空间
    if (rules.minFrontClearance) {
      // 假设设备面向房间中心
      const centerX = room.width / 2;
      const centerY = room.length / 2;
      const frontDistance = Math.sqrt(
        Math.pow(centerX - pos.x, 2) + Math.pow(centerY - pos.y, 2)
      );
      
      if (frontDistance < rules.minFrontClearance) {
        warnings.push({
          type: 'service_access',
          message: `检修空间${Math.round(frontDistance)}mm可能不足，建议≥${rules.minFrontClearance}mm`,
          severity: 'low'
        });
        score -= 5;
      }
    }
    
    // 5. 检查禁区
    if (rules.forbiddenAreas && rules.forbiddenAreas.length > 0) {
      const isInForbiddenZone = this.checkForbiddenZone(device, roomData);
      if (isInForbiddenZone) {
        errors.push({
          type: 'forbidden_zone',
          message: `设备位于禁区：${rules.forbiddenAreas.join(', ')}`,
          severity: 'high'
        });
        score -= 25;
      }
    }
    
    // 6. 负荷匹配验证
    if (device.capacity && device.roomType) {
      const requiredLoad = this.calculateRequiredLoad(device.roomType, device.servedArea);
      const loadMatch = device.capacity / requiredLoad;
      
      if (loadMatch < 0.8) {
        errors.push({
          type: 'undersized',
          message: `设备容量不足，建议容量${requiredLoad}W，当前${device.capacity}W`,
          severity: 'high'
        });
        score -= 20;
      } else if (loadMatch > 1.5) {
        warnings.push({
          type: 'oversized',
          message: `设备容量偏大，可能能效降低`,
          severity: 'low'
        });
        score -= 5;
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score)
    };
  }
  
  /**
   * 检查设备间冲突
   */
  checkDeviceConflicts(devices) {
    const conflicts = [];
    
    for (let i = 0; i < devices.length; i++) {
      for (let j = i + 1; j < devices.length; j++) {
        const deviceA = devices[i];
        const deviceB = devices[j];
        
        const conflict = this.checkPairConflict(deviceA, deviceB);
        if (conflict) {
          conflicts.push({
            deviceA: { index: i, name: deviceA.name, type: deviceA.type },
            deviceB: { index: j, name: deviceB.name, type: deviceB.type },
            type: conflict.type,
            distance: conflict.distance,
            message: conflict.message,
            suggestion: conflict.suggestion
          });
        }
      }
    }
    
    return conflicts;
  }
  
  /**
   * 检查两个设备是否冲突
   */
  checkPairConflict(deviceA, deviceB) {
    const posA = deviceA.position;
    const posB = deviceB.position;
    
    // 计算实际距离
    const distance = Math.sqrt(
      Math.pow(posA.x - posB.x, 2) +
      Math.pow(posA.y - posB.y, 2) +
      Math.pow(posA.z - posB.z, 2)
    );
    
    // 获取设备尺寸
    const dimA = this.deviceDimensions[deviceA.type] || { width: 400, height: 400, depth: 400 };
    const dimB = this.deviceDimensions[deviceB.type] || { width: 400, height: 400, depth: 400 };
    
    // 最小安全间距
    const minClearance = 100; // 100mm
    const requiredDistance = (Math.max(dimA.width, dimA.depth) + Math.max(dimB.width, dimB.depth)) / 2 + minClearance;
    
    if (distance < requiredDistance) {
      return {
        type: 'spatial_conflict',
        distance: Math.round(distance),
        required: Math.round(requiredDistance),
        message: `${deviceA.name}与${deviceB.name}间距不足(${Math.round(distance)}mm < ${Math.round(requiredDistance)}mm)`,
        suggestion: `建议调整位置，保持至少${Math.round(requiredDistance)}mm间距`
      };
    }
    
    // 检查特殊冲突规则
    const specialConflict = this.checkSpecialConflicts(deviceA, deviceB, distance);
    if (specialConflict) {
      return specialConflict;
    }
    
    return null;
  }
  
  /**
   * 检查特殊冲突规则
   */
  checkSpecialConflicts(deviceA, deviceB, distance) {
    const typeA = deviceA.type;
    const typeB = deviceB.type;
    
    // 热源冲突
    const heatSources = ['boiler', 'water_heater', 'ac_outdoor'];
    const heatSensitive = ['ac_indoor', 'fresh_air', 'water_purifier'];
    
    if (heatSources.includes(typeA) && heatSensitive.includes(typeB) && distance < 1000) {
      return {
        type: 'thermal_conflict',
        distance: Math.round(distance),
        message: `${deviceA.name}热源过近，可能影响${deviceB.name}性能`,
        suggestion: '建议间距≥1000mm，或增加隔热措施'
      };
    }
    
    // 噪音冲突
    const noiseSources = ['ac_outdoor', 'fresh_air'];
    const noiseSensitive = ['bedroom', 'study'];
    
    if (noiseSources.includes(typeA) && deviceB.roomType && noiseSensitive.includes(deviceB.roomType) && distance < 1500) {
      return {
        type: 'noise_conflict',
        distance: Math.round(distance),
        message: `${deviceA.name}噪音可能影响${deviceB.roomType}`,
        suggestion: '建议增加隔音措施或调整位置'
      };
    }
    
    return null;
  }
  
  /**
   * 自动推荐最佳安装位置
   */
  recommendOptimalPosition(deviceType, roomData, existingDevices = []) {
    const rules = this.installationRules[deviceType];
    const dimensions = this.deviceDimensions[deviceType];
    
    if (!rules || !dimensions) {
      return {
        success: false,
        error: '未知设备类型，无法推荐位置'
      };
    }
    
    // 生成候选位置网格
    const candidates = this.generateCandidatePositions(roomData, dimensions, rules);
    
    // 评分排序
    const scored = candidates.map(pos => ({
      position: pos,
      score: this.scorePosition(pos, deviceType, roomData, existingDevices, rules)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    // 返回前3个最佳位置
    const top3 = scored.slice(0, 3);
    
    return {
      success: true,
      deviceType,
      room: roomData.name,
      recommendations: top3.map((item, index) => ({
        rank: index + 1,
        position: item.position,
        score: item.score,
        reasons: this.getPositionReasons(item.position, deviceType, roomData, rules)
      }))
    };
  }
  
  /**
   * 生成候选位置
   */
  generateCandidatePositions(room, dimensions, rules) {
    const positions = [];
    const step = 200; // 200mm间隔
    
    // 墙面安装位置（壁挂设备）
    if (rules.minGroundHeight > 1000) {
      // 四面墙
      for (let z = rules.minGroundHeight; z <= rules.maxGroundHeight; z += step) {
        // 左墙
        positions.push({ x: rules.minWallDistance || 100, y: room.length / 2, z });
        // 右墙
        positions.push({ x: room.width - (rules.minWallDistance || 100), y: room.length / 2, z });
        // 前墙
        positions.push({ x: room.width / 2, y: rules.minWallDistance || 100, z });
        // 后墙
        positions.push({ x: room.width / 2, y: room.length - (rules.minWallDistance || 100), z });
      }
    }
    
    // 吊顶安装位置
    if (rules.minGroundHeight >= 2200) {
      const ceilingHeight = 2800; // 默认层高
      for (let x = 500; x < room.width; x += step * 2) {
        for (let y = 500; y < room.length; y += step * 2) {
          positions.push({ x, y, z: ceilingHeight - (rules.minCeilingDistance || 50) });
        }
      }
    }
    
    // 地面/设备平台位置
    if (rules.maxGroundHeight < 500) {
      positions.push({ x: 800, y: 800, z: 200 }); // 阳台角
      positions.push({ x: room.width - 800, y: 800, z: 200 }); // 另一侧
      positions.push({ x: room.width / 2, y: 500, z: 200 }); // 中央靠前
    }
    
    return positions;
  }
  
  /**
   * 评分算法
   */
  scorePosition(position, deviceType, room, existingDevices, rules) {
    let score = 100;
    
    // 1. 距墙距离评分
    const wallDist = Math.min(
      position.x,
      room.width - position.x,
      position.y,
      room.length - position.y
    );
    if (rules.minWallDistance && wallDist < rules.minWallDistance) {
      score -= 30;
    } else if (wallDist > rules.minWallDistance * 2) {
      score += 10; // 空间充裕加分
    }
    
    // 2. 检修便利性评分
    const centerDist = Math.sqrt(
      Math.pow(position.x - room.width / 2, 2) +
      Math.pow(position.y - room.length / 2, 2)
    );
    score -= centerDist / 100; // 距中心越远扣分越少（靠边便于检修）
    
    // 3. 与现有设备距离评分
    existingDevices.forEach(existing => {
      const dist = Math.sqrt(
        Math.pow(position.x - existing.position.x, 2) +
        Math.pow(position.y - existing.position.y, 2)
      );
      if (dist < 500) {
        score -= 20; // 太近扣分
      } else if (dist > 1500) {
        score += 5; // 间距合理加分
      }
    });
    
    // 4. 功能区匹配
    if (rules.preferredLocation) {
      // 根据房间类型加分
      if (room.type === 'balcony' && rules.preferredLocation.includes('阳台')) {
        score += 20;
      }
      if (room.type === 'kitchen' && rules.preferredLocation.includes('厨房')) {
        score += 20;
      }
    }
    
    // 5. 美观性（居中对称加分）
    if (Math.abs(position.x - room.width / 2) < 300) {
      score += 5;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * 获取位置推荐理由
   */
  getPositionReasons(position, deviceType, room, rules) {
    const reasons = [];
    
    if (rules.minWallDistance && position.x >= rules.minWallDistance) {
      reasons.push('距墙距离合规，利于散热/安装');
    }
    
    if (rules.minFrontClearance) {
      reasons.push('前方空间充裕，便于检修维护');
    }
    
    if (room.type && rules.preferredLocation && 
        rules.preferredLocation.some(loc => loc.includes(room.type))) {
      reasons.push('位置与房间功能匹配');
    }
    
    reasons.push('符合人体工程学高度');
    
    return reasons;
  }
  
  /**
   * 计算房间所需负荷
   */
  calculateRequiredLoad(roomType, area) {
    const reference = this.loadReference[roomType];
    if (!reference) {
      return area * 120; // 默认值
    }
    
    return Math.max(reference.cooling, reference.heating) * area;
  }
  
  /**
   * 检查禁区
   */
  checkForbiddenZone(device, roomData) {
    // 简化实现，实际应根据房间功能分区判断
    const rules = this.installationRules[device.type];
    if (!rules || !rules.forbiddenAreas) return false;
    
    // 根据位置判断是否在禁区
    // 例如：床头侧、灶台上方等
    return false; // 默认不在禁区
  }
  
  /**
   * 计算综合评分
   */
  calculateOverallScore(devices, issues, warnings, conflicts) {
    let score = 100;
    
    // 错误扣分
    score -= issues.length * 15;
    
    // 警告扣分
    score -= warnings.length * 5;
    
    // 冲突扣分
    score -= conflicts.length * 10;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * 生成优化建议
   */
  generateRecommendations(issues, conflicts) {
    const recommendations = [];
    
    if (issues.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'position_adjustment',
        message: '存在严重位置问题，建议重新调整设备布局',
        action: '使用自动推荐功能获取最佳位置'
      });
    }
    
    if (conflicts.length > 0) {
      recommendations.push({
        priority: 'high',
        type: 'conflict_resolution',
        message: `检测到${conflicts.length}处设备冲突`,
        action: '调整冲突设备间距或更换安装位置'
      });
    }
    
    if (issues.length === 0 && conflicts.length === 0) {
      recommendations.push({
        priority: 'low',
        type: 'optimization',
        message: '当前布局合理，可考虑微调以提升美观性',
        action: '参考最佳实践对齐设备位置'
      });
    }
    
    return recommendations;
  }
  
  /**
   * 生成位置验证报告
   */
  generateValidationReport(devices, roomData) {
    const validation = this.validateDevicePositions(devices, roomData);
    const optimalPositions = devices.map(d => 
      this.recommendOptimalPosition(d.type, roomData, devices.filter(x => x !== d))
    );
    
    return {
      timestamp: new Date().toISOString(),
      project: roomData.name || '未命名项目',
      summary: {
        totalDevices: devices.length,
        validPositions: validation.validCount,
        issues: validation.issueCount,
        warnings: validation.warningCount,
        conflicts: validation.conflictCount,
        overallScore: validation.overallScore,
        status: validation.overallScore >= 90 ? 'excellent' : 
                validation.overallScore >= 70 ? 'acceptable' : 'needs_improvement'
      },
      validation,
      optimalPositions: optimalPositions.filter(r => r.success),
      exportFormats: ['PDF', 'Excel', 'AutoCAD'],
      nextSteps: validation.recommendations
    };
  }
  
  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      supportedDeviceTypes: Object.keys(this.installationRules),
      timestamp: new Date().toISOString()
    };
  }
}

// 导出
module.exports = DevicePositioningEngine;
