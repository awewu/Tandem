/**
 * 项目数据管理器 - 紧急修复版
 * 解决当前数据链断点问题，实现以项目为中心的数据管理
 * @version 1.0.0 - 紧急修复
 */

class ProjectDataManager {
  constructor() {
    this.projectId = this.getProjectIdFromUrl();
    this.currentUser = this.loadCurrentUser();
    this.syncQueue = [];
    this.init();
  }

  init() {
    // 页面加载时自动恢复项目数据
    if (this.projectId) {
      console.log(`[PDM] 初始化项目: ${this.projectId}`);
      this.loadProjectData();
    }
  }

  // ==================== 核心方法 ====================

  /**
   * 从URL获取项目ID
   */
  getProjectIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('projectId');
  }

  /**
   * 加载当前用户信息
   */
  loadCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch (e) {
      return { id: 'guest', role: 'visitor' };
    }
  }

  /**
   * 获取/创建项目数据
   */
  getProjectData() {
    if (!this.projectId) {
      console.warn('[PDM] 无项目ID，请使用 ProjectNavigator 导航');
      return null;
    }

    const key = `project_${this.projectId}`;
    const data = localStorage.getItem(key);

    if (data) {
      return JSON.parse(data);
    }

    // 如果本地没有，创建新项目结构
    const newProject = {
      id: this.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'new',
      customer: {},
      diagnosis: {},
      design: {},
      quotation: {},
      construction: {},
      timeline: []
    };

    this.saveProjectData(newProject);
    return newProject;
  }

  /**
   * 保存项目数据
   */
  saveProjectData(data) {
    if (!this.projectId) return false;

    const key = `project_${this.projectId}`;
    data.updatedAt = new Date().toISOString();
    data._lastModifiedBy = this.currentUser.id;

    localStorage.setItem(key, JSON.stringify(data));

    // 添加到同步队列
    this.queueForSync(data);

    console.log(`[PDM] 项目数据已保存: ${this.projectId}`);
    return true;
  }

  /**
   * 更新项目某个模块的数据
   * @param {string} section - 模块名: customer/diagnosis/design/quotation/construction
   * @param {object} data - 模块数据
   */
  updateSection(section, data) {
    const project = this.getProjectData();
    if (!project) return false;

    project[section] = {
      ...data,
      _updatedAt: new Date().toISOString()
    };

    // 添加时间线记录
    this.addTimelineRecord(section, data);

    this.saveProjectData(project);

    // 广播更新
    this.broadcastUpdate(section, data);

    return true;
  }

  /**
   * 获取项目某个模块的数据
   */
  getSection(section) {
    const project = this.getProjectData();
    return project ? project[section] : null;
  }

  // ==================== 数据关联方法 ====================

  /**
   * 关联客户信息
   */
  linkCustomer(customerData) {
    return this.updateSection('customer', {
      id: customerData.id,
      name: customerData.name,
      phone: customerData.phone,
      area: customerData.area,
      rooms: customerData.rooms,
      address: customerData.address,
      budget: customerData.budget
    });
  }

  /**
   * 关联AI问诊结果
   */
  linkDiagnosis(diagnosisData) {
    return this.updateSection('diagnosis', {
      painPoints: diagnosisData.painPoints || [],
      matchedSystems: diagnosisData.matchedSystems || [],
      recommendations: diagnosisData.recommendations || [],
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 关联设计方案
   */
  linkDesign(designData) {
    return this.updateSection('design', {
      templateId: designData.templateId,
      templateName: designData.templateName,
      floorplan: designData.floorplan,
      equipment: designData.equipment,
      drawings: designData.drawings,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 关联报价信息
   */
  linkQuotation(quotationData) {
    return this.updateSection('quotation', {
      items: quotationData.items || [],
      subtotal: quotationData.subtotal,
      discount: quotationData.discount,
      total: quotationData.total,
      status: quotationData.status || 'draft',
      timestamp: new Date().toISOString()
    });
  }

  // ==================== 辅助方法 ====================

  /**
   * 添加时间线记录
   */
  addTimelineRecord(action, data) {
    const project = this.getProjectData();
    if (!project.timeline) {
      project.timeline = [];
    }

    project.timeline.push({
      action,
      timestamp: new Date().toISOString(),
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      note: this.getActionNote(action, data)
    });
  }

  getActionNote(action, data) {
    const notes = {
      customer: `关联客户: ${data.name || data.id}`,
      diagnosis: `完成AI问诊，识别${data.painPoints?.length || 0}个痛点`,
      design: `生成设计方案: ${data.templateName || ''}`,
      quotation: `生成报价，总价: ¥${data.total || 0}`,
      construction: `开始施工: ${data.siteId || ''}`,
      contract: '签订合同',
      completed: '项目完成'
    };
    return notes[action] || `更新: ${action}`;
  }

  /**
   * 队列同步到后端
   */
  queueForSync(data) {
    this.syncQueue.push({
      projectId: this.projectId,
      data,
      timestamp: Date.now()
    });

    // 防抖同步
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncToServer(), 3000);
  }

  /**
   * 同步到后端
   */
  async syncToServer() {
    if (this.syncQueue.length === 0) return;

    const items = [...this.syncQueue];
    this.syncQueue = [];

    try {
      const response = await fetch('/api/projects/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (response.ok) {
        console.log(`[PDM] 同步成功: ${items.length}条`);
      } else {
        // 同步失败，重新入队
        this.syncQueue.push(...items);
      }
    } catch (e) {
      console.warn('[PDM] 同步失败，稍后重试:', e);
      this.syncQueue.push(...items);
    }
  }

  /**
   * 广播更新（跨页面通信）
   */
  broadcastUpdate(section, data) {
    // 使用 BroadcastChannel（如果支持）
    if (window.BroadcastChannel) {
      const channel = new BroadcastChannel('project_updates');
      channel.postMessage({
        projectId: this.projectId,
        section,
        data,
        timestamp: Date.now()
      });
    }

    // 触发自定义事件
    window.dispatchEvent(new CustomEvent('projectDataUpdated', {
      detail: { projectId: this.projectId, section, data }
    }));
  }

  // ==================== 快捷方法 ====================

  /**
   * 生成项目编号
   */
  static generateProjectId() {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `PRJ-${year}-${random}`;
  }

  /**
   * 创建新项目
   */
  static createProject(customerData) {
    const projectId = this.generateProjectId();
    const project = {
      id: projectId,
      customer: customerData,
      status: 'new',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(`project_${projectId}`, JSON.stringify(project));
    console.log(`[PDM] 创建新项目: ${projectId}`);

    return projectId;
  }
}

/**
 * 项目导航器 - 解决页面跳转数据传递问题
 */
class ProjectNavigator {
  /**
   * 智能跳转到指定页面
   * @param {string} page - 目标页面URL
   * @param {object} options - 选项
   */
  static goTo(page, options = {}) {
    const {
      projectId,
      newWindow = false,
      preserveData = true
    } = options;

    // 构建URL
    const url = new URL(page, window.location.origin);
    if (projectId) {
      url.searchParams.set('projectId', projectId);
    }

    // 预加载数据到新页面
    if (preserveData && projectId) {
      const projectData = localStorage.getItem(`project_${projectId}`);
      if (projectData) {
        sessionStorage.setItem(`preload_${projectId}`, projectData);
      }
    }

    // 执行跳转
    if (newWindow) {
      window.open(url.toString(), '_blank');
    } else {
      window.location.href = url.toString();
    }
  }

  /**
   * 页面初始化时调用
   */
  static initPage() {
    const projectId = new URLSearchParams(location.search).get('projectId');
    if (!projectId) return null;

    // 尝试从sessionStorage恢复预加载数据
    const preloaded = sessionStorage.getItem(`preload_${projectId}`);
    if (preloaded) {
      sessionStorage.removeItem(`preload_${projectId}`);

      // 合并到localStorage（确保数据不丢失）
      const existing = localStorage.getItem(`project_${projectId}`);
      if (existing) {
        const merged = { ...JSON.parse(existing), ...JSON.parse(preloaded) };
        localStorage.setItem(`project_${projectId}`, JSON.stringify(merged));
      } else {
        localStorage.setItem(`project_${projectId}`, preloaded);
      }

      console.log(`[Navigator] 恢复项目数据: ${projectId}`);
    }

    return projectId;
  }

  /**
   * 获取项目数据（快捷方法）
   */
  static getProjectData(projectId) {
    const id = projectId || new URLSearchParams(location.search).get('projectId');
    if (!id) return null;

    const data = localStorage.getItem(`project_${id}`);
    return data ? JSON.parse(data) : null;
  }
}

/**
 * 数据迁移工具 - 将旧的分散数据迁移到新的项目中心格式
 */
class DataMigrationTool {
  /**
   * 执行数据迁移
   */
  static migrate() {
    console.log('[Migration] 开始数据迁移...');

    // 1. 检查是否有旧数据
    const oldKeys = [
      'currentSolution',
      'currentDesign',
      'currentFloorPlan',
      'aiDiagnosisResult',
      'rheem-quotes'
    ];

    // 2. 尝试创建项目并迁移数据
    const projectId = ProjectDataManager.generateProjectId();
    const pdm = new ProjectDataManager();

    // 迁移AI问诊结果
    const diagnosis = localStorage.getItem('aiDiagnosisResult');
    if (diagnosis) {
      pdm.linkDiagnosis(JSON.parse(diagnosis));
      console.log('[Migration] 已迁移AI问诊数据');
    }

    // 迁移设计方案
    const design = localStorage.getItem('currentDesign');
    if (design) {
      pdm.linkDesign(JSON.parse(design));
      console.log('[Migration] 已迁移设计方案');
    }

    // 迁移户型数据
    const floorPlan = localStorage.getItem('currentFloorPlan');
    if (floorPlan) {
      const fp = JSON.parse(floorPlan);
      pdm.updateSection('floorplan', fp);
      console.log('[Migration] 已迁移户型数据');
    }

    console.log(`[Migration] 迁移完成，项目ID: ${projectId}`);
    return projectId;
  }
}

// ==================== 自动初始化 ====================

// 页面加载时自动执行
document.addEventListener('DOMContentLoaded', () => {
  // 初始化导航器
  const projectId = ProjectNavigator.initPage();

  if (projectId) {
    // 创建全局PDM实例
    window.pdm = new ProjectDataManager();

    // 触发项目就绪事件
    window.dispatchEvent(new CustomEvent('projectReady', {
      detail: { projectId, data: window.pdm.getProjectData() }
    }));
  }
});

// 导出全局变量
window.ProjectDataManager = ProjectDataManager;
window.ProjectNavigator = ProjectNavigator;
window.DataMigrationTool = DataMigrationTool;
