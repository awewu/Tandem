/**
 * Construction Manager - 施工全流程管理系统
 * 进度/质量/安全/人员/物料 五位一体管理
 */

const { EventEmitter } = require('events');

class ConstructionManager extends EventEmitter {
  constructor(db, config = {}) {
    super();
    
    this.name = 'ConstructionManager';
    this.version = '2.0.0';
    this.db = db;
    
    // 施工阶段定义
    this.constructionPhases = [
      { id: 'preparation', name: '前期准备', duration: 1, order: 1 },
      { id: 'delivery', name: '材料进场', duration: 1, order: 2 },
      { id: 'installation', name: '设备安装', duration: 5, order: 3 },
      { id: 'piping', name: '管路施工', duration: 4, order: 4 },
      { id: 'electrical', name: '电气施工', duration: 2, order: 5 },
      { id: 'testing', name: '调试验收', duration: 2, order: 6 },
      { id: 'training', name: '客户培训', duration: 0.5, order: 7 },
      { id: 'completion', name: '竣工交付', duration: 0.5, order: 8 }
    ];
    
    // 质量检查项库
    this.qualityChecklist = {
      installation: [
        { id: 'Q001', item: '设备基础稳固', standard: '水平度≤2mm/m', method: '水平仪检测' },
        { id: 'Q002', item: '设备减震措施', standard: '减震垫厚度≥10mm', method: '目视检查' },
        { id: 'Q003', item: '设备接地', standard: '接地电阻≤4Ω', method: '接地电阻测试' }
      ],
      piping: [
        { id: 'Q101', item: '管道坡度', standard: '冷凝水管坡度≥1%', method: '水平仪检测' },
        { id: 'Q102', item: '保温完整', standard: '保温厚度≥20mm', method: '游标卡尺' },
        { id: 'Q103', item: '管路试压', standard: '水压试验0.8MPa无渗漏', method: '压力测试' }
      ],
      electrical: [
        { id: 'Q201', item: '线缆规格', standard: '符合设计要求', method: '对照图纸' },
        { id: 'Q202', item: '绝缘测试', standard: '绝缘电阻≥0.5MΩ', method: '兆欧表测试' }
      ]
    };
    
    // 安全检查项
    this.safetyChecklist = [
      { id: 'S001', category: '个人防护', item: '安全帽佩戴', required: true },
      { id: 'S002', category: '个人防护', item: '安全带使用', required: true },
      { id: 'S003', category: '现场安全', item: '临边防护', required: true },
      { id: 'S004', category: '现场安全', item: '电气安全', required: true },
      { id: 'S005', category: '消防安全', item: '灭火器配备', required: true },
      { id: 'S006', category: '消防安全', item: '动火作业许可', required: true }
    ];
    
    this.initialize();
  }

  initialize() {
    this.emit('init', { name: this.name, version: this.version });
    console.log('[ConstructionManager] 施工管理系统初始化完成');
  }

  // ===== 施工计划管理 =====
  
  async createConstructionPlan(projectId, planData) {
    // 自动计算施工计划
    const autoSchedule = this.generateSchedule(planData.area || 100);
    
    const construction = await this.db.createConstruction(projectId, {
      plan: {
        estimatedStart: planData.startDate,
        estimatedEnd: this.calculateEndDate(planData.startDate, autoSchedule.totalDays),
        phases: autoSchedule.phases,
        totalDays: autoSchedule.totalDays
      },
      teams: planData.teams || [],
      materials: {
        bom: planData.materials || []
      }
    });
    
    this.emit('construction:plan:created', construction);
    return construction;
  }

  generateSchedule(area) {
    // 基于面积估算工期
    const baseDays = 7;
    const areaFactor = Math.max(0, (area - 100) / 100);
    const totalDays = Math.ceil(baseDays + areaFactor * 3);
    
    const phases = this.constructionPhases.map(phase => ({
      ...phase,
      plannedStart: null,
      plannedEnd: null,
      actualStart: null,
      actualEnd: null,
      status: 'pending', // pending, in_progress, completed, delayed
      progress: 0
    }));
    
    return { phases, totalDays };
  }

  async startPhase(constructionId, phaseId, startDate = new Date().toISOString()) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const phase = construction.plan.phases.find(p => p.id === phaseId);
    if (!phase) return null;
    
    phase.actualStart = startDate;
    phase.status = 'in_progress';
    
    construction.status = 'in_progress';
    construction.updatedAt = new Date().toISOString();
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('phase:started', { constructionId, phaseId, startDate });
    return construction;
  }

  async completePhase(constructionId, phaseId, endDate = new Date().toISOString()) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const phase = construction.plan.phases.find(p => p.id === phaseId);
    if (!phase) return null;
    
    phase.actualEnd = endDate;
    phase.status = 'completed';
    phase.progress = 100;
    
    // 检查是否延期
    if (phase.plannedEnd && new Date(endDate) > new Date(phase.plannedEnd)) {
      phase.status = 'delayed';
    }
    
    construction.updatedAt = new Date().toISOString();
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    // 自动开启下一阶段
    const nextPhase = construction.plan.phases.find(p => p.order === phase.order + 1);
    if (nextPhase && nextPhase.status === 'pending') {
      await this.startPhase(constructionId, nextPhase.id);
    }
    
    this.emit('phase:completed', { constructionId, phaseId, endDate });
    return construction;
  }

  async updatePhaseProgress(constructionId, phaseId, progress) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const phase = construction.plan.phases.find(p => p.id === phaseId);
    if (!phase) return null;
    
    phase.progress = Math.min(100, Math.max(0, progress));
    
    // 计算整体进度
    const totalProgress = construction.plan.phases.reduce((sum, p) => sum + p.progress, 0);
    construction.overallProgress = totalProgress / construction.plan.phases.length;
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('progress:updated', { constructionId, phaseId, progress: phase.progress });
    return construction;
  }

  // ===== 甘特图生成 =====
  
  async generateGanttChart(constructionId) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const phases = construction.plan.phases.map(phase => {
      const start = phase.actualStart || phase.plannedStart;
      const end = phase.actualEnd || phase.plannedEnd;
      
      return {
        id: phase.id,
        name: phase.name,
        start,
        end,
        progress: phase.progress,
        status: phase.status,
        duration: start && end ? 
          Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) : 
          phase.duration,
        dependencies: phase.order > 1 ? [construction.plan.phases[phase.order - 2].id] : []
      };
    });
    
    // 关键路径计算（简化版）
    const criticalPath = this.calculateCriticalPath(phases);
    
    return {
      projectId: construction.projectId,
      constructionId,
      phases,
      criticalPath,
      startDate: phases[0]?.start,
      endDate: phases[phases.length - 1]?.end,
      overallProgress: construction.overallProgress || 0
    };
  }

  calculateCriticalPath(phases) {
    // 简化实现，返回所有阶段作为关键路径
    return phases
      .filter(p => ['in_progress', 'delayed'].includes(p.status))
      .map(p => p.id);
  }

  // ===== 质量管理 =====
  
  async getQualityChecklist(phase) {
    return this.qualityChecklist[phase] || [];
  }

  async submitQualityInspection(constructionId, inspectionData) {
    const inspection = {
      id: `QI-${Date.now()}`,
      ...inspectionData,
      timestamp: new Date().toISOString(),
      status: inspectionData.passed ? 'passed' : 'failed'
    };
    
    await this.db.addQualityInspection(constructionId, inspection);
    
    // 如果检查未通过，创建整改任务
    if (!inspection.passed) {
      await this.createRectificationTask(constructionId, inspection);
    }
    
    this.emit('quality:inspection', inspection);
    return inspection;
  }

  async createRectificationTask(constructionId, inspection) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const task = {
      id: `RECT-${Date.now()}`,
      type: 'rectification',
      relatedInspection: inspection.id,
      description: `整改: ${inspection.item}`,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1天
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    if (!construction.quality.issues) construction.quality.issues = [];
    construction.quality.issues.push(task);
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('rectification:created', task);
    return task;
  }

  async completeRectification(constructionId, taskId) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const task = construction.quality.issues?.find(t => t.id === taskId);
    if (!task) return null;
    
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('rectification:completed', { constructionId, taskId });
    return task;
  }

  // ===== 安全管理 =====
  
  async getSafetyChecklist() {
    return this.safetyChecklist;
  }

  async submitSafetyInspection(constructionId, inspectionData) {
    const inspection = {
      id: `SI-${Date.now()}`,
      ...inspectionData,
      timestamp: new Date().toISOString(),
      status: inspectionData.passed ? 'passed' : 'failed'
    };
    
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.safety.inspections) construction.safety.inspections = [];
    construction.safety.inspections.push(inspection);
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    // 如果安全检查未通过，发出警告
    if (!inspection.passed) {
      this.emit('safety:warning', { constructionId, inspection });
    }
    
    this.emit('safety:inspection', inspection);
    return inspection;
  }

  async recordIncident(constructionId, incidentData) {
    const incident = {
      id: `INC-${Date.now()}`,
      ...incidentData,
      timestamp: new Date().toISOString(),
      status: 'reported' // reported, investigating, resolved, closed
    };
    
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.safety.incidents) construction.safety.incidents = [];
    construction.safety.incidents.push(incident);
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('safety:incident', incident);
    return incident;
  }

  // ===== 人员管理 =====
  
  async assignTeam(constructionId, teamData) {
    const team = {
      id: `TEAM-${Date.now()}`,
      ...teamData,
      members: teamData.members || [],
      assignedAt: new Date().toISOString()
    };
    
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.personnel) construction.personnel = {};
    if (!construction.personnel.teams) construction.personnel.teams = [];
    
    construction.personnel.teams.push(team);
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('team:assigned', { constructionId, team });
    return team;
  }

  async recordAttendance(constructionId, workerId, attendanceData) {
    const record = {
      id: `ATT-${Date.now()}`,
      workerId,
      date: attendanceData.date || new Date().toISOString().split('T')[0],
      checkIn: attendanceData.checkIn,
      checkOut: attendanceData.checkOut,
      hours: this.calculateWorkHours(attendanceData.checkIn, attendanceData.checkOut),
      location: attendanceData.location
    };
    
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.personnel) construction.personnel = {};
    if (!construction.personnel.attendance) construction.personnel.attendance = [];
    
    construction.personnel.attendance.push(record);
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    return record;
  }

  calculateWorkHours(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(`2000-01-01T${checkIn}`);
    const end = new Date(`2000-01-01T${checkOut}`);
    return Math.max(0, (end - start) / (1000 * 60 * 60));
  }

  // ===== 物料管理 =====
  
  async createBOM(constructionId, bomData) {
    const bom = {
      id: `BOM-${Date.now()}`,
      items: bomData.items.map(item => ({
        ...item,
        id: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      })),
      totalCost: bomData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      createdAt: new Date().toISOString()
    };
    
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.materials) construction.materials = {};
    construction.materials.bom = bom;
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('bom:created', { constructionId, bom });
    return bom;
  }

  async recordMaterialDelivery(constructionId, deliveryData) {
    const delivery = {
      id: `DEL-${Date.now()}`,
      ...deliveryData,
      timestamp: new Date().toISOString(),
      status: 'received' // received, inspected, accepted, rejected
    };
    
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.materials) construction.materials = {};
    if (!construction.materials.deliveries) construction.materials.deliveries = [];
    
    construction.materials.deliveries.push(delivery);
    this.db.memoryStore.constructions.set(constructionId, construction);
    
    this.emit('material:delivered', delivery);
    return delivery;
  }

  async updateInventory(constructionId, inventoryData) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    if (!construction.materials) construction.materials = {};
    construction.materials.inventory = inventoryData;
    
    this.db.memoryStore.constructions.set(constructionId, construction);
    return inventoryData;
  }

  // ===== 智能预警 =====
  
  async checkScheduleRisk(constructionId) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const risks = [];
    const today = new Date();
    
    for (const phase of construction.plan.phases) {
      if (phase.status === 'in_progress' && phase.plannedEnd) {
        const plannedEnd = new Date(phase.plannedEnd);
        const daysRemaining = Math.ceil((plannedEnd - today) / (1000 * 60 * 60 * 24));
        const daysNeeded = Math.ceil(phase.duration * (1 - phase.progress / 100));
        
        if (daysNeeded > daysRemaining) {
          risks.push({
            phase: phase.id,
            name: phase.name,
            severity: daysNeeded - daysRemaining > 2 ? 'high' : 'medium',
            daysDelayed: daysNeeded - daysRemaining,
            message: `${phase.name}预计延期${daysNeeded - daysRemaining}天`
          });
        }
      }
    }
    
    // 发出预警
    if (risks.length > 0) {
      this.emit('schedule:risk', { constructionId, risks });
    }
    
    return risks;
  }

  // ===== 报表与统计 =====
  
  async getConstructionReport(constructionId) {
    const construction = this.db.memoryStore.constructions.get(constructionId);
    if (!construction) return null;
    
    const gantt = await this.generateGanttChart(constructionId);
    const risks = await this.checkScheduleRisk(constructionId);
    
    return {
      summary: {
        status: construction.status,
        overallProgress: construction.overallProgress || 0,
        startDate: gantt.startDate,
        endDate: gantt.endDate,
        daysElapsed: this.calculateDaysElapsed(gantt.startDate),
        daysRemaining: this.calculateDaysRemaining(gantt.endDate)
      },
      phases: gantt.phases,
      quality: {
        totalInspections: construction.quality?.inspections?.length || 0,
        passed: construction.quality?.inspections?.filter(i => i.status === 'passed').length || 0,
        failed: construction.quality?.inspections?.filter(i => i.status === 'failed').length || 0,
        openIssues: construction.quality?.issues?.filter(i => i.status !== 'completed').length || 0
      },
      safety: {
        totalInspections: construction.safety?.inspections?.length || 0,
        incidents: construction.safety?.incidents?.length || 0
      },
      personnel: {
        teams: construction.personnel?.teams?.length || 0,
        workers: construction.personnel?.teams?.reduce((sum, t) => sum + (t.members?.length || 0), 0) || 0
      },
      materials: {
        bomItems: construction.materials?.bom?.items?.length || 0,
        totalCost: construction.materials?.bom?.totalCost || 0,
        delivered: construction.materials?.deliveries?.length || 0
      },
      risks
    };
  }

  calculateDaysElapsed(startDate) {
    if (!startDate) return 0;
    return Math.floor((Date.now() - new Date(startDate)) / (1000 * 60 * 60 * 24));
  }

  calculateDaysRemaining(endDate) {
    if (!endDate) return 0;
    return Math.max(0, Math.ceil((new Date(endDate) - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  calculateEndDate(startDate, days) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  // ===== 健康检查 =====
  
  async healthCheck() {
    return {
      name: this.name,
      version: this.version,
      status: 'healthy',
      phases: this.constructionPhases.length,
      activeConstructions: Array.from(this.db.memoryStore.constructions?.values() || [])
        .filter(c => c.status === 'in_progress').length,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ConstructionManager;
