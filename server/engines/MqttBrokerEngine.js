/**
 * MQTT Broker Engine - Full Implementation
 * Econet智能设备联动完整实现
 */

const net = require('net')
const http = require('http')
const WebSocket = require('ws')

class MqttBrokerEngine {
  constructor(options = {}) {
    this.port = options.port || 1883
    this.wsPort = options.wsPort || 1884
    
    this.devices = new Map()
    this.automationRules = []
    this.subscriptions = new Map()
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      clientsConnected: 0,
      clientsDisconnected: 0
    }
    
    this.tcpServer = null
    this.wsServer = null
    this.httpServer = null
  }

  start() {
    this.tcpServer = net.createServer((socket) => {
      this.handleClient(socket, 'tcp')
    })
    
    // 添加错误监听，防止端口冲突导致崩溃
    this.tcpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ MQTT TCP端口 ${this.port} 已被占用，跳过启动`)
      } else {
        console.error('[MQTT] TCP服务器错误:', err.message)
      }
    })
    
    this.tcpServer.listen(this.port, () => {
      console.log(`✅ MQTT Broker TCP: mqtt://localhost:${this.port}`)
    })

    this.httpServer = http.createServer()
    this.wsServer = new WebSocket.Server({ server: this.httpServer })
    
    // WebSocket服务器错误监听
    this.wsServer.on('error', (err) => {
      console.error('[MQTT] WebSocket服务器错误:', err.message)
    })
    
    // WebSocket服务器错误监听
    this.httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ MQTT WebSocket端口 ${this.wsPort} 已被占用，跳过启动`)
      } else {
        console.error('[MQTT] WebSocket服务器错误:', err.message)
      }
    })
    
    this.wsServer.on('connection', (ws, req) => {
      this.handleClient(ws, 'websocket')
    })
    
    this.httpServer.listen(this.wsPort, () => {
      console.log(`✅ MQTT Broker WebSocket: ws://localhost:${this.wsPort}`)
    })

    this.addDefaultRules()
    console.log('✅ MQTT Broker 完整版已启动')
    return this
  }

  handleClient(client, type) {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    let deviceId = null
    
    console.log(`[MQTT] ${type}客户端连接: ${clientId}`)
    this.stats.clientsConnected++

    const onData = (data) => {
      try {
        const packet = this.parsePacket(data)
        this.handlePacket(client, packet, deviceId, (id) => { deviceId = id })
      } catch (error) {
        console.error('[MQTT] 包解析错误:', error)
      }
    }

    if (type === 'tcp') {
      client.on('data', onData)
      client.on('close', () => this.handleDisconnect(clientId, deviceId))
    } else {
      client.on('message', (data) => onData(data))
      client.on('close', () => this.handleDisconnect(clientId, deviceId))
    }

    this.sendConnack(client, type)
  }

  parsePacket(data) {
    const str = data.toString()
    try {
      const json = JSON.parse(str)
      return {
        type: json.type || 'publish',
        topic: json.topic,
        payload: json.payload,
        clientId: json.clientId
      }
    } catch {
      return { type: 'publish', payload: str }
    }
  }

  handlePacket(client, packet, deviceId, setDeviceId) {
    switch (packet.type) {
      case 'connect':
        if (packet.deviceId && this.validateDevice(packet.deviceId)) {
          setDeviceId(packet.deviceId)
          this.devices.set(packet.deviceId, {
            id: packet.deviceId,
            client: client,
            connectedAt: new Date(),
            lastSeen: new Date(),
            status: 'online',
            type: packet.deviceType || 'unknown'
          })
        }
        break
      case 'subscribe':
        if (packet.topic) {
          if (!this.subscriptions.has(packet.topic)) {
            this.subscriptions.set(packet.topic, new Set())
          }
          this.subscriptions.get(packet.topic).add(client)
        }
        break
      case 'publish':
        this.stats.messagesReceived++
        if (packet.topic && packet.payload) {
          this.handlePublish(packet.topic, packet.payload, deviceId)
        }
        break
    }
  }

  handlePublish(topic, payload, deviceId) {
    if (deviceId && this.devices.has(deviceId)) {
      const device = this.devices.get(deviceId)
      device.lastSeen = new Date()
      device.lastPayload = payload
    }
    this.checkAutomationRules(topic, payload, deviceId)
    const subscribers = this.subscriptions.get(topic)
    if (subscribers) {
      const message = JSON.stringify({ topic, payload, timestamp: Date.now(), deviceId })
      subscribers.forEach(client => {
        if (client.readyState === WebSocket.OPEN || client.writable) {
          client.write ? client.write(message) : client.send(message)
          this.stats.messagesSent++
        }
      })
    }
  }

  checkAutomationRules(topic, payload, deviceId) {
    this.automationRules.forEach(rule => {
      if (this.evaluateRule(rule, topic, payload, deviceId)) {
        this.executeAction(rule.action, deviceId)
      }
    })
  }

  evaluateRule(rule, topic, payload, deviceId) {
    const { condition } = rule
    if (condition.topic && !topic.includes(condition.topic)) return false
    if (condition.deviceId && condition.deviceId !== deviceId) return false
    if (condition.field && condition.operator !== undefined) {
      const value = payload[condition.field]
      switch (condition.operator) {
        case '>': return value > condition.value
        case '<': return value < condition.value
        case '>=': return value >= condition.value
        case '==': return value == condition.value
      }
    }
    return true
  }

  executeAction(action, triggerDeviceId) {
    switch (action.type) {
      case 'control':
        this.sendControlCommand(action.deviceId, action.command)
        break
      case 'publish':
        this.handlePublish(action.topic, action.payload, 'system')
        break
    }
  }

  addDefaultRules() {
    this.addAutomationRule({
      name: '低温自动供暖',
      condition: { topic: 'temperature', field: 'value', operator: '<', value: 18 },
      action: { type: 'control', deviceId: 'econet-thermostat-001', command: { mode: 'heating', targetTemp: 22 } }
    })
    this.addAutomationRule({
      name: '高温自动制冷',
      condition: { topic: 'temperature', field: 'value', operator: '>', value: 26 },
      action: { type: 'control', deviceId: 'econet-thermostat-001', command: { mode: 'cooling', targetTemp: 24 } }
    })
  }

  addAutomationRule(rule) {
    rule.id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    rule.createdAt = new Date()
    rule.enabled = true
    this.automationRules.push(rule)
    return rule.id
  }

  validateDevice(deviceId) {
    return deviceId.startsWith('econet-')
  }

  sendControlCommand(deviceId, command) {
    const device = this.devices.get(deviceId)
    if (device && device.client) {
      const message = JSON.stringify({ type: 'control', command, timestamp: Date.now() })
      if (device.client.readyState === WebSocket.OPEN) {
        device.client.send(message)
      } else if (device.client.writable) {
        device.client.write(message)
      }
    }
  }

  sendConnack(client, type) {
    const response = JSON.stringify({ type: 'connack', returnCode: 0 })
    if (type === 'websocket') client.send(response)
    else client.write(response)
  }

  handleDisconnect(clientId, deviceId) {
    this.stats.clientsDisconnected++
    if (deviceId && this.devices.has(deviceId)) {
      const device = this.devices.get(deviceId)
      device.status = 'offline'
      device.lastSeen = new Date()
    }
  }

  getDevices() {
    return Array.from(this.devices.values()).map(d => ({
      id: d.id, status: d.status, type: d.type,
      connectedAt: d.connectedAt, lastSeen: d.lastSeen
    }))
  }

  getStats() {
    return {
      ...this.stats,
      activeDevices: this.devices.size,
      automationRules: this.automationRules.length
    }
  }

  stop() {
    if (this.tcpServer) this.tcpServer.close()
    if (this.httpServer) this.httpServer.close()
  }
}

module.exports = MqttBrokerEngine
