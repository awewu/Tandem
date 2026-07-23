/**
 * 【WebSocket服务器 - 改图联动同步】
 * 端口: 3001
 * 功能: 实时协作、光标同步、聊天、变更推送
 */

const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const DrawingSyncEngine = require('./server/engines/DrawingSyncEngine');

class WebSocketServer {
  constructor(port = 3001) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Map(); // clientId -> WebSocket
    this.sessions = new Map(); // sessionId -> { designerWs, customerWs, metadata }
    this.drawingEngine = DrawingSyncEngine;
  }

  async start() {
    // 创建HTTP服务器
    this.server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('WebSocket Drawing Sync Server Running');
    });

    // 创建WebSocket服务器
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws/drawing-sync'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        this.server.removeListener('error', onError);
        this.server.removeListener('listening', onListening);
        this.wss.removeListener('error', onError);
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        try { this.wss.close(); } catch (_) {}
        try { this.server.close(); } catch (_) {}
        reject(error);
      };
      const onError = (error) => {
        fail(error);
      };
      const onListening = () => {
        if (settled) return;
        settled = true;
        cleanup();
        console.log(`✅ WebSocket Drawing Sync Server running on port ${this.port}`);
        console.log(`📡 WebSocket path: ws://localhost:${this.port}/ws/drawing-sync`);
        resolve();
      };

      this.server.once('error', onError);
      this.wss.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.port);
    });

    // 初始化绘图同步引擎
    await this.drawingEngine.initialize();
  }

  handleConnection(ws, req) {
    const clientId = uuidv4();
    console.log(`🔗 Client connected: ${clientId}`);

    // 存储客户端连接
    this.clients.set(clientId, {
      ws,
      id: clientId,
      connectedAt: new Date(),
      role: null, // 'designer' or 'customer'
      sessionId: null
    });

    // 监听消息
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Message parse error:', error);
      }
    });

    // 监听断开
    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    // 发送欢迎消息
    this.sendToClient(clientId, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString()
    });
  }

  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`📨 Message from ${clientId}:`, message.type);

    switch (message.type) {
      case 'join_session':
        this.handleJoinSession(clientId, message);
        break;

      case 'cursor_move':
        this.handleCursorMove(clientId, message);
        break;

      case 'design_change':
        this.handleDesignChange(clientId, message);
        break;

      case 'chat_message':
        this.handleChatMessage(clientId, message);
        break;

      case 'sync_request':
        this.handleSyncRequest(clientId, message);
        break;

      case 'undo':
        this.handleUndo(clientId, message);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  handleJoinSession(clientId, message) {
    const client = this.clients.get(clientId);
    const { sessionId, role } = message;

    client.role = role;
    client.sessionId = sessionId;

    // 创建或加入会话
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date(),
        designerWs: null,
        customerWs: null,
        metadata: message.metadata || {}
      });

      // 在DrawingSyncEngine中创建会话
      this.drawingEngine.createSession(sessionId, clientId, null);
    }

    const session = this.sessions.get(sessionId);

    // 根据角色分配WebSocket
    if (role === 'designer') {
      session.designerWs = client.ws;
    } else if (role === 'customer') {
      session.customerWs = client.ws;
      // 更新DrawingSyncEngine会话
      const engineSession = this.drawingEngine.sessions.get(sessionId);
      if (engineSession) {
        engineSession.clientId = clientId;
      }
    }

    // 通知其他参与者
    this.broadcastToSession(sessionId, {
      type: 'user_joined',
      clientId,
      role,
      timestamp: new Date().toISOString()
    }, clientId);

    this.sendToClient(clientId, {
      type: 'session_joined',
      sessionId,
      participants: this.getSessionParticipants(sessionId),
      timestamp: new Date().toISOString()
    });

    console.log(`✅ ${role} joined session ${sessionId}`);
  }

  handleCursorMove(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.sessionId) return;

    // 广播光标位置给对方
    this.broadcastToSession(client.sessionId, {
      type: 'cursor_move',
      x: message.x,
      y: message.y,
      from: client.role,
      timestamp: new Date().toISOString()
    }, clientId);
  }

  handleDesignChange(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.sessionId || client.role !== 'designer') return;

    // 推送到DrawingSyncEngine
    this.drawingEngine.pushChanges(client.sessionId, clientId, message);

    // 广播给客户
    const session = this.sessions.get(client.sessionId);
    if (session && session.customerWs) {
      this.sendToWebSocket(session.customerWs, {
        type: 'design_change',
        change: message,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🎨 Design change pushed to customer`);
  }

  handleChatMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.sessionId) return;

    // 广播聊天消息
    this.broadcastToSession(client.sessionId, {
      type: 'chat_message',
      message: message.message,
      from: client.role,
      timestamp: new Date().toISOString()
    });
  }

  handleSyncRequest(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.sessionId) return;

    // 从DrawingSyncEngine获取最新图纸
    try {
      const drawing = this.drawingEngine.getDrawing(client.sessionId, clientId);
      
      this.sendToClient(clientId, {
        type: 'sync_response',
        drawing,
        timestamp: new Date().toISOString()
      });

      console.log(`🔄 Sync sent to ${client.role}`);
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  handleUndo(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client.sessionId || client.role !== 'designer') return;

    // 获取变更历史
    const history = this.drawingEngine.getChangeHistory(client.sessionId);
    const lastChange = history[history.length - 2]; // 获取倒数第二个变更

    if (lastChange) {
      this.broadcastToSession(client.sessionId, {
        type: 'undo_action',
        undoChange: lastChange,
        timestamp: new Date().toISOString()
      });

      console.log(`↩️ Undo action broadcasted`);
    }
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`🔌 Client disconnected: ${clientId}`);

    if (client.sessionId) {
      // 通知会话中的其他参与者
      this.broadcastToSession(client.sessionId, {
        type: 'user_left',
        clientId,
        role: client.role,
        timestamp: new Date().toISOString()
      });

      // 更新会话
      const session = this.sessions.get(client.sessionId);
      if (session) {
        if (client.role === 'designer') {
          session.designerWs = null;
        } else if (client.role === 'customer') {
          session.customerWs = null;
        }
      }
    }

    this.clients.delete(clientId);
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  sendToWebSocket(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToSession(sessionId, message, excludeClientId = null) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const recipients = [];
    if (session.designerWs) recipients.push(session.designerWs);
    if (session.customerWs) recipients.push(session.customerWs);

    recipients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  getSessionParticipants(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const participants = [];
    if (session.designerWs) {
      const designer = Array.from(this.clients.values()).find(c => c.ws === session.designerWs);
      if (designer) participants.push({ id: designer.id, role: 'designer' });
    }
    if (session.customerWs) {
      const customer = Array.from(this.clients.values()).find(c => c.ws === session.customerWs);
      if (customer) participants.push({ id: customer.id, role: 'customer' });
    }

    return participants;
  }

  getStats() {
    return {
      connectedClients: this.clients.size,
      activeSessions: this.sessions.size,
      drawingEngineStats: this.drawingEngine.getStats()
    };
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      console.log('WebSocket server stopped');
    }
    if (this.server) {
      this.server.close();
      console.log('HTTP server stopped');
    }
  }
}

// 启动服务器
if (require.main === module) {
  const wsServer = new WebSocketServer(3001);
  wsServer.start().catch((error) => {
    console.error('WebSocket server failed to start:', error.message);
    process.exit(1);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    wsServer.stop();
    process.exit(0);
  });
}

module.exports = WebSocketServer;
