const WebSocket = require('ws')
const http = require('http')

class YjsCollaborationEngine {
  constructor(port = 5002) {
    this.port = port
    this.sessions = new Map()
    this.clients = new Map()
    this.drawings = new Map() // 存储绘图数据
    this.server = null
    this.wss = null
  }

  start() {
    this.server = http.createServer()
    this.wss = new WebSocket.Server({ server: this.server })

    this.wss.on('connection', (ws, req) => {
      const sessionId = req.url.slice(1) || 'default'
      console.log(`[Yjs] 新连接: ${sessionId}`)
      
      if (!this.clients.has(sessionId)) {
        this.clients.set(sessionId, new Map())
        this.drawings.set(sessionId, [])
      }
      
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      this.clients.get(sessionId).set(clientId, ws)
      
      // 发送历史绘图数据给新客户端
      const history = this.drawings.get(sessionId) || []
      ws.send(JSON.stringify({
        type: 'init',
        clientId: clientId,
        history: history,
        clients: this.clients.get(sessionId).size
      }))

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data)
          this.handleMessage(sessionId, clientId, message)
        } catch (error) {
          console.error('[Yjs] 消息解析失败:', error)
        }
      })

      ws.on('close', () => {
        const clients = this.clients.get(sessionId)
        if (clients) {
          clients.delete(clientId)
          if (clients.size === 0) {
            this.clients.delete(sessionId)
            this.drawings.delete(sessionId)
          }
        }
        this.broadcast(sessionId, {
          type: 'client-left',
          clientId: clientId,
          timestamp: Date.now()
        }, clientId)
      })
    })

    // 错误监听
    this.wss.on('error', (err) => {
      console.error('[Yjs] WebSocket服务器错误:', err.message)
    })

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Yjs协作服务器端口 ${this.port} 已被占用，跳过启动`)
      } else {
        console.error('[Yjs] HTTP服务器错误:', err.message)
      }
    })

    this.server.listen(this.port, () => {
      console.log(`✅ Yjs协作服务器: ws://localhost:${this.port}`)
    })

    return this
  }

  handleMessage(sessionId, clientId, message) {
    const { type, data } = message
    
    switch (type) {
      case 'draw':
        // 保存绘图操作
        const drawOp = {
          id: `op-${Date.now()}`,
          clientId,
          data,
          timestamp: Date.now()
        }
        this.drawings.get(sessionId).push(drawOp)
        // 广播给其他客户端
        this.broadcast(sessionId, {
          type: 'draw',
          operation: drawOp
        }, clientId)
        break
        
      case 'clear':
        this.drawings.set(sessionId, [])
        this.broadcast(sessionId, { type: 'clear' }, clientId)
        break
        
      case 'cursor':
        // 光标位置不保存，只广播
        this.broadcast(sessionId, {
          type: 'cursor',
          clientId,
          position: data
        }, clientId)
        break
        
      default:
        this.broadcast(sessionId, message, clientId)
    }
  }

  broadcast(sessionId, message, excludeClientId = null) {
    const clients = this.clients.get(sessionId)
    if (!clients) return

    const payload = JSON.stringify(message)
    
    for (const [clientId, ws] of clients) {
      if (clientId !== excludeClientId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload)
      }
    }
  }

  getActiveSessions() {
    return Array.from(this.sessions.keys())
  }

  getStats() {
    let totalClients = 0
    let totalDrawings = 0
    for (const [sessionId, clients] of this.clients) {
      totalClients += clients.size
      totalDrawings += this.drawings.get(sessionId)?.length || 0
    }
    return {
      activeSessions: this.clients.size,
      connectedClients: totalClients,
      totalOperations: totalDrawings
    }
  }

  stop() {
    if (this.wss) this.wss.close()
    if (this.server) this.server.close()
  }
}

module.exports = YjsCollaborationEngine
