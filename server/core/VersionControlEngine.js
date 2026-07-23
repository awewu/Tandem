/**
 * Agent-5: 版本控制与改图联动引擎
 * 一小时冲刺开发 - 历史版本管理
 * 
 * 覆盖PRD新增P0需求：
 * - 改图联动同步
 * - 历史版本保存（最多10条）
 * - 撤销/恢复操作
 * - 联动范围：设备/管路/户型修改自动同步
 */

class VersionControlEngine {
  constructor(maxHistory = 10) {
    this.maxHistory = maxHistory;
    this.versions = new Map(); // projectId -> versions[]
    this.currentIndex = new Map(); // projectId -> currentIndex
    
    // 联动配置
    this.linkageRules = {
      'device.change': ['layout3D', 'piping', 'quotation', 'materialList'],
      'piping.change': ['drawings', 'quotation', 'materialList'],
      'roomProfile.change': ['loadCalculation', 'deviceSelection', 'layout3D', 'piping', 'quotation'],
      'system.add': ['layout3D', 'piping', 'quotation', 'drawings'],
      'system.remove': ['layout3D', 'piping', 'quotation', 'drawings']
    };
  }

  /**
   * 创建新版本
   */
  createVersion(projectId, data, changeType, changeDescription) {
    if (!this.versions.has(projectId)) {
      this.versions.set(projectId, []);
      this.currentIndex.set(projectId, -1);
    }
    
    const projectVersions = this.versions.get(projectId);
    const currentIdx = this.currentIndex.get(projectId);
    
    // 如果在历史中间，删除后面的版本
    if (currentIdx < projectVersions.length - 1) {
      projectVersions.splice(currentIdx + 1);
    }
    
    // 创建新版本
    const version = {
      id: `v-${Date.now()}`,
      timestamp: new Date().toISOString(),
      data: JSON.parse(JSON.stringify(data)), // 深拷贝
      changeType,
      changeDescription,
      index: projectVersions.length
    };
    
    projectVersions.push(version);
    
    // 限制历史数量
    if (projectVersions.length > this.maxHistory) {
      projectVersions.shift();
      // 重新计算index
      projectVersions.forEach((v, i) => v.index = i);
    }
    
    this.currentIndex.set(projectId, projectVersions.length - 1);
    
    return version;
  }

  /**
   * 撤销操作
   */
  undo(projectId) {
    const currentIdx = this.currentIndex.get(projectId);
    if (currentIdx <= 0) {
      return { success: false, error: '已经是第一个版本，无法撤销' };
    }
    
    this.currentIndex.set(projectId, currentIdx - 1);
    const version = this.versions.get(projectId)[currentIdx - 1];
    
    return {
      success: true,
      data: version.data,
      version,
      remainingUndo: currentIdx - 1,
      remainingRedo: this.versions.get(projectId).length - (currentIdx - 1) - 1
    };
  }

  /**
   * 恢复操作
   */
  redo(projectId) {
    const currentIdx = this.currentIndex.get(projectId);
    const versions = this.versions.get(projectId);
    
    if (currentIdx >= versions.length - 1) {
      return { success: false, error: '已经是最新版本，无法恢复' };
    }
    
    this.currentIndex.set(projectId, currentIdx + 1);
    const version = versions[currentIdx + 1];
    
    return {
      success: true,
      data: version.data,
      version,
      remainingUndo: currentIdx + 1,
      remainingRedo: versions.length - (currentIdx + 1) - 1
    };
  }

  /**
   * 获取版本历史
   */
  getVersionHistory(projectId) {
    const versions = this.versions.get(projectId) || [];
    const currentIdx = this.currentIndex.get(projectId) || -1;
    
    return versions.map((v, idx) => ({
      id: v.id,
      timestamp: v.timestamp,
      changeType: v.changeType,
      changeDescription: v.changeDescription,
      index: idx,
      isCurrent: idx === currentIdx
    }));
  }

  /**
   * 回滚到指定版本
   */
  rollbackToVersion(projectId, versionIndex) {
    const versions = this.versions.get(projectId);
    if (!versions || versionIndex < 0 || versionIndex >= versions.length) {
      return { success: false, error: '版本不存在' };
    }
    
    this.currentIndex.set(projectId, versionIndex);
    const version = versions[versionIndex];
    
    return {
      success: true,
      data: version.data,
      version,
      message: `已回滚到版本 ${versionIndex + 1}: ${version.changeDescription}`
    };
  }

  /**
   * 改图联动 - 计算需要同步的模块
   */
  calculateLinkage(changeType) {
    return this.linkageRules[changeType] || [];
  }

  /**
   * 执行改图联动
   */
  executeLinkage(projectId, changeType, changeData, currentData) {
    const affectedModules = this.calculateLinkage(changeType);
    const results = {
      changeType,
      affectedModules,
      updates: {},
      timestamp: new Date().toISOString()
    };
    
    // 根据变更类型执行相应的联动逻辑
    switch (changeType) {
      case 'device.change':
        results.updates = this.linkageDeviceChange(changeData, currentData);
        break;
      case 'piping.change':
        results.updates = this.linkagePipingChange(changeData, currentData);
        break;
      case 'roomProfile.change':
        results.updates = this.linkageRoomProfileChange(changeData, currentData);
        break;
      case 'system.add':
      case 'system.remove':
        results.updates = this.linkageSystemChange(changeType, changeData, currentData);
        break;
      default:
        break;
    }
    
    // 创建新版本
    const newData = { ...currentData, ...results.updates };
    const version = this.createVersion(
      projectId,
      newData,
      changeType,
      changeData.description || `${changeType} 变更`
    );
    
    results.version = version;
    
    return results;
  }

  /**
   * 设备变更联动
   */
  linkageDeviceChange(changeData, currentData) {
    const updates = {};
    
    // 更新3D布局
    if (currentData.layout3D) {
      updates.layout3D = {
        ...currentData.layout3D,
        devices: changeData.devices || currentData.layout3D.devices
      };
    }
    
    // 更新管路
    if (currentData.piping) {
      updates.piping = this.recalculatePiping(changeData.devices, currentData.piping);
    }
    
    // 更新报价
    if (currentData.quotation) {
      updates.quotation = this.recalculateQuotation(changeData.devices, currentData.quotation);
    }
    
    // 更新材料清单
    if (currentData.materialList) {
      updates.materialList = this.recalculateMaterialList(changeData.devices, currentData.materialList);
    }
    
    return updates;
  }

  /**
   * 管路变更联动
   */
  linkagePipingChange(changeData, currentData) {
    const updates = {};
    
    // 更新图纸
    if (currentData.drawings) {
      updates.drawings = {
        ...currentData.drawings,
        pipingPlan: changeData.piping || currentData.drawings.pipingPlan
      };
    }
    
    // 更新报价（管路耗材）
    if (currentData.quotation) {
      updates.quotation = this.recalculatePipingCost(changeData.piping, currentData.quotation);
    }
    
    // 更新材料清单
    if (currentData.materialList) {
      updates.materialList = this.recalculatePipingMaterials(changeData.piping, currentData.materialList);
    }
    
    return updates;
  }

  /**
   * 户型变更联动（重新计算所有）
   */
  linkageRoomProfileChange(changeData, currentData) {
    const updates = {};
    
    // 重新计算负荷
    updates.loadCalculation = this.recalculateLoad(changeData.roomProfile);
    
    // 重新选型
    updates.deviceSelection = this.reselectDevices(changeData.roomProfile, updates.loadCalculation);
    
    // 更新3D布局
    updates.layout3D = this.regenerateLayout(changeData.roomProfile, updates.deviceSelection);
    
    // 更新管路
    updates.piping = this.recalculatePiping(updates.deviceSelection, currentData.piping);
    
    // 更新报价
    updates.quotation = this.recalculateQuotation(updates.deviceSelection, currentData.quotation);
    
    return updates;
  }

  /**
   * 系统增删联动
   */
  linkageSystemChange(changeType, changeData, currentData) {
    const updates = {};
    const systems = changeType === 'system.add' 
      ? [...(currentData.systems || []), changeData.system]
      : (currentData.systems || []).filter(s => s.id !== changeData.systemId);
    
    updates.systems = systems;
    
    // 重新生成3D布局
    updates.layout3D = this.regenerateLayout(currentData.roomProfile, systems);
    
    // 重新计算管路
    updates.piping = this.recalculatePiping(systems, currentData.piping);
    
    // 重新计算报价
    updates.quotation = this.recalculateQuotation(systems, currentData.quotation);
    
    // 更新图纸
    updates.drawings = this.regenerateDrawings(systems, currentData.drawings);
    
    return updates;
  }

  // 辅助计算函数（简化版）
  recalculateLoad(roomProfile) {
    return {
      heatingLoad: roomProfile.area * 80,
      coolingLoad: roomProfile.area * 150,
      hotWaterLoad: (roomProfile.occupants || 1) * 2000,
      calculatedAt: new Date().toISOString()
    };
  }

  reselectDevices(roomProfile, loadData) {
    // 简化版设备选型逻辑
    return {
      systems: [],
      selectedAt: new Date().toISOString()
    };
  }

  regenerateLayout(roomProfile, devices) {
    return {
      roomProfile,
      devices,
      generatedAt: new Date().toISOString()
    };
  }

  recalculatePiping(devices, currentPiping) {
    return {
      ...currentPiping,
      recalculatedAt: new Date().toISOString()
    };
  }

  recalculateQuotation(devices, currentQuotation) {
    return {
      ...currentQuotation,
      recalculatedAt: new Date().toISOString()
    };
  }

  recalculateMaterialList(devices, currentList) {
    return {
      ...currentList,
      recalculatedAt: new Date().toISOString()
    };
  }

  recalculatePipingCost(piping, currentQuotation) {
    return {
      ...currentQuotation,
      pipingCost: piping.length * 50, // 简化计算
      recalculatedAt: new Date().toISOString()
    };
  }

  recalculatePipingMaterials(piping, currentList) {
    return {
      ...currentList,
      pipingMaterials: piping.materials || [],
      recalculatedAt: new Date().toISOString()
    };
  }

  regenerateDrawings(systems, currentDrawings) {
    return {
      ...currentDrawings,
      updatedAt: new Date().toISOString()
    };
  }
}

module.exports = VersionControlEngine;
