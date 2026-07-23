/**
 * 改图联动同步引擎 - WebSocket实时协作
 * 实现设计师与客户之间的实时方案同步
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class CollaborationSyncEngine extends EventEmitter {
  constructor(server) {
    super();
    this.wss = new WebSocket.Server({ server });
    this.rooms = new Map(); // 房间管理
    this.users = new Map(); // 用户连接管理
    this.operationQueue = new Map(); // 操作队列
    this.versionControl = new Map(); // 版本控制
    
    this.init();
  }

  init() {
    this.wss.on('connection', (ws, req) => {
      console.log('[Sync] 新连接建立');
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(ws, message);
        } catch (err) {
          console.error('[Sync] 消息解析错误:', err);
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('[Sync] WebSocket错误:', err);
      });

      // 发送连接成功确认
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        serverVersion: '1.0.0'
      }));
    });

    console.log('[Sync] 改图联动同步引擎已启动');
  }

  // 处理消息
  handleMessage(ws, message) {
    const { type, payload, roomId, userId } = message;

    switch (type) {
      case 'join':
        this.handleJoinRoom(ws, roomId, userId, payload);
        break;
      case 'leave':
        this.handleLeaveRoom(ws, roomId, userId);
        break;
      case 'operation':
        this.handleOperation(roomId, userId, payload);
        break;
      case 'cursor':
        this.broadcastCursor(roomId, userId, payload);
        break;
      case 'selection':
        this.broadcastSelection(roomId, userId, payload);
        break;
      case 'requestSync':
        this.handleSyncRequest(ws, roomId, userId);
        break;
      case 'chat':
        this.broadcastChat(roomId, userId, payload);
        break;
      default:
        console.warn('[Sync] 未知消息类型:', type);
    }
  }

  // 加入房间
  handleJoinRoom(ws, roomId, userId, payload) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        users: new Map(),
        operations: [],
        version: 0,
        createdAt: new Date().toISOString()
      });
    }

    const room = this.rooms.get(roomId);
    room.users.set(userId, {
      ws,
      role: payload.role || 'viewer', // designer, client, viewer
      name: payload.name || '匿名用户',
      joinedAt: new Date().toISOString(),
      cursor: null,
      selection: null
    });

    // 存储用户连接
    this.users.set(userId, { ws, roomId });

    // 通知房间内其他用户
    this.broadcastToRoom(roomId, {
      type: 'userJoined',
      userId,
      userName: payload.name,
      role: payload.role,
      timestamp: new Date().toISOString()
    }, userId);

    // 发送当前房间状态给新用户
    ws.send(JSON.stringify({
      type: 'roomState',
      roomId,
      version: room.version,
      userCount: room.users.size,
      users: Array.from(room.users.entries()).map(([id, u]) => ({
        id,
        name: u.name,
        role: u.role
      }))
    }));

    console.log(`[Sync] 用户 ${userId} 加入房间 ${roomId}`);
  }

  // 离开房间
  handleLeaveRoom(ws, roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(userId);
      
      // 如果房间空了，保留一段时间
      if (room.users.size === 0) {
        setTimeout(() => {
          if (room.users.size === 0) {
            this.rooms.delete(roomId);
            console.log(`[Sync] 房间 ${roomId} 已清理`);
          }
        }, 300000); // 5分钟后清理
      }
    }

    this.users.delete(userId);

    this.broadcastToRoom(roomId, {
      type: 'userLeft',
      userId,
      timestamp: new Date().toISOString()
    });

    console.log(`[Sync] 用户 ${userId} 离开房间 ${roomId}`);
  }

  // 处理操作
  handleOperation(roomId, userId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(userId);
    if (!user || user.role === 'viewer') {
      // 观众不能修改
      user.ws.send(JSON.stringify({
        type: 'error',
        error: 'Viewer cannot edit'
      }));
      return;
    }

    // 生成操作ID
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const operation = {
      id: operationId,
      userId,
      userName: user.name,
      type: payload.opType, // add, delete, modify, move
      target: payload.target, // device, layout, setting
      data: payload.data,
      timestamp: new Date().toISOString(),
      version: ++room.version
    };

    // 保存操作
    room.operations.push(operation);
    
    // 保留最近100条操作
    if (room.operations.length > 100) {
      room.operations.shift();
    }

    // 广播给房间内其他用户
    this.broadcastToRoom(roomId, {
      type: 'operation',
      operation
    }, userId);

    console.log(`[Sync] 操作 ${operationId} 已同步到房间 ${roomId}`);
  }

  // 广播光标位置
  broadcastCursor(roomId, userId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(userId);
    if (user) {
      user.cursor = payload;
    }

    this.broadcastToRoom(roomId, {
      type: 'cursor',
      userId,
      userName: user?.name,
      cursor: payload,
      timestamp: new Date().toISOString()
    }, userId);
  }

  // 广播选择状态
  broadcastSelection(roomId, userId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(userId);
    if (user) {
      user.selection = payload;
    }

    this.broadcastToRoom(roomId, {
      type: 'selection',
      userId,
      userName: user?.name,
      selection: payload,
      timestamp: new Date().toISOString()
    }, userId);
  }

  // 处理同步请求
  handleSyncRequest(ws, roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', error: 'Room not found' }));
      return;
    }

    // 发送最新方案状态
    ws.send(JSON.stringify({
      type: 'fullSync',
      roomId,
      version: room.version,
      operations: room.operations.slice(-20), // 最近20条操作
      timestamp: new Date().toISOString()
    }));
  }

  // 广播聊天消息
  broadcastChat(roomId, userId, payload) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(userId);

    this.broadcastToRoom(roomId, {
      type: 'chat',
      userId,
      userName: user?.name,
      message: payload.message,
      timestamp: new Date().toISOString()
    });
  }

  // 广播给房间内所有用户
  broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const data = JSON.stringify(message);
    
    room.users.forEach((user, uid) => {
      if (uid !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(data);
      }
    });
  }

  // 处理断开连接
  handleDisconnect(ws) {
    // 查找并清理断开的用户
    this.users.forEach((user, userId) => {
      if (user.ws === ws) {
        this.handleLeaveRoom(ws, user.roomId, userId);
      }
    });
  }

  // 获取房间统计
  getRoomStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: this.users.size,
      rooms: Array.from(this.rooms.entries()).map(([id, room]) => ({
        id,
        userCount: room.users.size,
        version: room.version,
        createdAt: room.createdAt
      }))
    };
  }
}

module.exports = CollaborationSyncEngine;
