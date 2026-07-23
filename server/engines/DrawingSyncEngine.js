/**
 * 【改图联动同步引擎 - BE-Engine-Agent-1修复】
 * 实现双模式实时同步功能
 */

const EventEmitter = require('events');

class DrawingSyncEngine extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // 会话管理
    this.changes = new Map(); // 变更记录
    this.connections = new Map(); // WebSocket连接
    this.initialized = false;
  }

  // 初始化同步引擎
  async initialize() {
    console.log('🔄 初始化改图联动同步引擎...');
    this.initialized = true;
    console.log('✅ 改图联动同步引擎初始化完成');
    return true;
  }

  // 创建同步会话
  createSession(sessionId, designerId, clientId) {
    const session = {
      id: sessionId,
      designerId,
      clientId,
      createdAt: new Date().toISOString(),
      status: 'active',
      lastSync: null,
      drawing: {
        devices: [],
        layout: {},
        annotations: []
      }
    };
    
    this.sessions.set(sessionId, session);
    console.log(`✅ 创建同步会话: ${sessionId}`);
    return session;
  }

  // 设计师推送变更
  async pushChanges(sessionId, designerId, changes) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    if (session.designerId !== designerId) {
      throw new Error('无权操作此会话');
    }

    // 记录变更
    const changeRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: changes.type, // 'device_add', 'device_move', 'layout_update', 'annotation'
      data: changes.data,
      designerId
    };

    // 更新会话图纸
    this.applyChanges(session.drawing, changes);
    
    // 存储变更历史
    if (!this.changes.has(sessionId)) {
      this.changes.set(sessionId, []);
    }
    this.changes.get(sessionId).push(changeRecord);

    // 实时推送到客户端
    await this.broadcastToClient(sessionId, changeRecord);

    session.lastSync = new Date().toISOString();
    
    console.log(`🔄 推送变更: ${changes.type} → 客户${session.clientId}`);
    return changeRecord;
  }

  // 应用变更到图纸
  applyChanges(drawing, changes) {
    switch (changes.type) {
      case 'device_add':
        drawing.devices.push(changes.data);
        break;
      case 'device_move':
        const device = drawing.devices.find(d => d.id === changes.data.deviceId);
        if (device) {
          device.position = changes.data.position;
        }
        break;
      case 'device_remove':
        drawing.devices = drawing.devices.filter(d => d.id !== changes.data.deviceId);
        break;
      case 'layout_update':
        drawing.layout = { ...drawing.layout, ...changes.data };
        break;
      case 'annotation':
        drawing.annotations.push(changes.data);
        break;
    }
  }

  // 广播到客户端
  async broadcastToClient(sessionId, change) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // 模拟WebSocket推送
    const message = {
      type: 'drawing_update',
      sessionId,
      change,
      timestamp: new Date().toISOString()
    };

    console.log(`📡 广播到客户${session.clientId}:`, message.type);
    
    // 触发事件供前端监听
    this.emit('client_update', message);
    
    return message;
  }

  // 客户端获取最新图纸
  async getDrawing(sessionId, clientId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    if (session.clientId !== clientId) {
      throw new Error('无权查看此会话');
    }

    return {
      drawing: session.drawing,
      lastSync: session.lastSync,
      sessionId
    };
  }

  // 获取变更历史
  getChangeHistory(sessionId, since = null) {
    const changes = this.changes.get(sessionId) || [];
    if (!since) return changes;
    
    return changes.filter(c => new Date(c.timestamp) > new Date(since));
  }

  // 结束会话
  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedAt = new Date().toISOString();
      console.log(`🏁 结束会话: ${sessionId}`);
    }
    return session;
  }

  // 获取活跃会话
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  // 统计信息
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeSessions: this.getActiveSessions().length,
      totalChanges: Array.from(this.changes.values()).reduce((sum, arr) => sum + arr.length, 0)
    };
  }
}

// 导出单例
module.exports = DrawingSyncEngine;
