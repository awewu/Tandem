/**
 * DXF Parser - CAD图纸导入引擎
 * 基于 dxf-parser 库实现DXF文件解析
 */

const DxfParser = require('dxf-parser')
const THREE = require('three')

class CADImporterEngine {
  constructor() {
    this.parser = new DxfParser()
    this.supportedEntities = ['LINE', 'CIRCLE', 'ARC', 'LWPOLYLINE', 'TEXT', 'DIMENSION']
  }

  /**
   * 解析DXF文件
   * @param {ArrayBuffer|Buffer} fileBuffer - DXF文件内容
   * @returns {Object} 解析后的图纸数据
   */
  async parseDXF(fileBuffer) {
    try {
      const dxfString = fileBuffer.toString('utf-8')
      const dxf = this.parser.parseSync(dxfString)
      
      // 提取关键信息
      const result = {
        header: this.extractHeader(dxf.header),
        layers: this.extractLayers(dxf.tables?.layer || {}),
        entities: this.extractEntities(dxf.entities),
        blocks: dxf.blocks || {},
        statistics: {
          totalEntities: dxf.entities?.length || 0,
          supportedEntities: 0,
          unsupportedEntities: 0,
          bounds: this.calculateBounds(dxf.entities)
        }
      }

      // 转换为three.js格式 (用于3D渲染)
      result.threeJSObjects = this.convertToThreeJS(result.entities)
      
      // 提取户型信息
      result.roomProfile = this.extractRoomProfile(result)

      console.log(`[CADImporter] 解析成功: ${result.statistics.totalEntities} 个实体`)
      return result
      
    } catch (error) {
      console.error('[CADImporter] DXF解析失败:', error)
      throw new Error(`DXF解析失败: ${error.message}`)
    }
  }

  /**
   * 提取图层信息
   */
  extractLayers(layerTable) {
    const layers = []
    if (layerTable && layerTable.layers) {
      for (const [name, layer] of Object.entries(layerTable.layers)) {
        layers.push({
          name: name,
          color: layer.color,
          visible: layer.visible !== false,
          frozen: layer.frozen || false
        })
      }
    }
    return layers
  }

  /**
   * 提取实体并分类
   */
  extractEntities(entities) {
    if (!entities) return []
    
    const result = {
      lines: [],
      circles: [],
      arcs: [],
      polylines: [],
      texts: [],
      dimensions: [],
      walls: [], // 识别为墙体的线段
      windows: [], // 识别为窗户的实体
      doors: [] // 识别为门的实体
    }

    for (const entity of entities) {
      const type = entity.type
      
      switch (type) {
        case 'LINE':
          const line = this.parseLine(entity)
          result.lines.push(line)
          // 墙体检测逻辑
          if (this.isWallCandidate(line)) {
            result.walls.push({ ...line, type: 'wall' })
          }
          break
          
        case 'CIRCLE':
          result.circles.push(this.parseCircle(entity))
          break
          
        case 'ARC':
          result.arcs.push(this.parseArc(entity))
          break
          
        case 'LWPOLYLINE':
        case 'POLYLINE':
          const polyline = this.parsePolyline(entity)
          result.polylines.push(polyline)
          // 门窗检测
          if (this.isWindowCandidate(polyline)) {
            result.windows.push({ ...polyline, type: 'window' })
          } else if (this.isDoorCandidate(polyline)) {
            result.doors.push({ ...polyline, type: 'door' })
          }
          break
          
        case 'TEXT':
        case 'MTEXT':
          result.texts.push(this.parseText(entity))
          break
          
        case 'DIMENSION':
          result.dimensions.push(this.parseDimension(entity))
          break
      }
    }

    return result
  }

  /**
   * 解析线段
   */
  parseLine(entity) {
    return {
      type: 'line',
      start: { x: entity.startPoint.x, y: entity.startPoint.y, z: entity.startPoint.z || 0 },
      end: { x: entity.endPoint.x, y: entity.endPoint.y, z: entity.endPoint.z || 0 },
      layer: entity.layer,
      color: entity.color,
      length: Math.sqrt(
        Math.pow(entity.endPoint.x - entity.startPoint.x, 2) +
        Math.pow(entity.endPoint.y - entity.startPoint.y, 2)
      )
    }
  }

  /**
   * 解析圆
   */
  parseCircle(entity) {
    return {
      type: 'circle',
      center: { x: entity.center.x, y: entity.center.y, z: entity.center.z || 0 },
      radius: entity.radius,
      layer: entity.layer,
      color: entity.color
    }
  }

  /**
   * 解析圆弧
   */
  parseArc(entity) {
    return {
      type: 'arc',
      center: { x: entity.center.x, y: entity.center.y, z: entity.center.z || 0 },
      radius: entity.radius,
      startAngle: entity.startAngle,
      endAngle: entity.endAngle,
      layer: entity.layer
    }
  }

  /**
   * 解析多段线
   */
  parsePolyline(entity) {
    return {
      type: 'polyline',
      vertices: entity.vertices?.map(v => ({
        x: v.x,
        y: v.y,
        z: v.z || 0,
        bulge: v.bulge || 0
      })) || [],
      closed: entity.closed || false,
      layer: entity.layer,
      color: entity.color,
      area: this.calculatePolylineArea(entity.vertices)
    }
  }

  /**
   * 解析文本
   */
  parseText(entity) {
    return {
      type: 'text',
      text: entity.text || entity.mtext?.text || '',
      position: { x: entity.position?.x || 0, y: entity.position?.y || 0 },
      height: entity.textHeight || entity.height || 12,
      layer: entity.layer
    }
  }

  /**
   * 解析尺寸标注
   */
  parseDimension(entity) {
    return {
      type: 'dimension',
      value: entity.text || '',
      position: { x: entity.position?.x || 0, y: entity.position?.y || 0 },
      layer: entity.layer
    }
  }

  /**
   * 判断是否为墙体候选
   * 墙体特征: 较长、直线、在特定图层
   */
  isWallCandidate(line) {
    const minWallLength = 1000 // 1米 = 1000mm (DXF通常使用毫米)
    const wallLayerPatterns = ['WALL', '墙', '墙体', 'W']
    
    const isLongEnough = line.length >= minWallLength
    const isWallLayer = wallLayerPatterns.some(pattern => 
      line.layer?.toUpperCase().includes(pattern)
    )
    
    return isLongEnough || isWallLayer
  }

  /**
   * 判断是否为窗户候选
   */
  isWindowCandidate(polyline) {
    // 窗户特征: 矩形、中等面积、特定图层
    const area = polyline.area || 0
    const isRectangle = this.isRectangle(polyline.vertices)
    const isWindowSize = area >= 0.5 && area <= 5 // 0.5-5平方米
    
    const windowLayerPatterns = ['WINDOW', '窗', '窗户', 'WIN']
    const isWindowLayer = windowLayerPatterns.some(pattern =>
      polyline.layer?.toUpperCase().includes(pattern)
    )
    
    return (isRectangle && isWindowSize) || isWindowLayer
  }

  /**
   * 判断是否为门候选
   */
  isDoorCandidate(polyline) {
    const area = polyline.area || 0
    const isRectangle = this.isRectangle(polyline.vertices)
    const isDoorSize = area >= 1.5 && area <= 3 // 1.5-3平方米
    
    const doorLayerPatterns = ['DOOR', '门', 'DOOR']
    const isDoorLayer = doorLayerPatterns.some(pattern =>
      polyline.layer?.toUpperCase().includes(pattern)
    )
    
    return (isRectangle && isDoorSize) || isDoorLayer
  }

  /**
   * 判断是否为矩形
   */
  isRectangle(vertices) {
    if (!vertices || vertices.length !== 4) return false
    
    // 计算边长
    const edges = []
    for (let i = 0; i < 4; i++) {
      const p1 = vertices[i]
      const p2 = vertices[(i + 1) % 4]
      edges.push(Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)))
    }
    
    // 矩形特征: 对边相等
    const tolerance = 0.1
    return Math.abs(edges[0] - edges[2]) < tolerance && 
           Math.abs(edges[1] - edges[3]) < tolerance
  }

  /**
   * 计算多段线面积
   */
  calculatePolylineArea(vertices) {
    if (!vertices || vertices.length < 3) return 0
    
    let area = 0
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length
      area += vertices[i].x * vertices[j].y
      area -= vertices[j].x * vertices[i].y
    }
    
    return Math.abs(area) / 2 / 1000000 // 转换为平方米
  }

  /**
   * 计算边界框
   */
  calculateBounds(entities) {
    if (!entities || entities.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
    }

    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity

    for (const entity of entities) {
      const points = this.getEntityPoints(entity)
      for (const p of points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
    }

    return {
      minX, minY, maxX, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    }
  }

  /**
   * 获取实体的所有点
   */
  getEntityPoints(entity) {
    const points = []
    
    switch (entity.type) {
      case 'LINE':
        points.push(entity.startPoint, entity.endPoint)
        break
      case 'CIRCLE':
      case 'ARC':
        points.push(entity.center)
        break
      case 'LWPOLYLINE':
      case 'POLYLINE':
        points.push(...(entity.vertices || []))
        break
      case 'TEXT':
      case 'MTEXT':
        points.push(entity.position || entity.insert)
        break
    }
    
    return points
  }

  /**
   * 提取文件头信息
   */
  extractHeader(header) {
    return {
      version: header?.version || 'Unknown',
      units: header?.insunits || 0, // 插入单位
      createdBy: header?.creator || 'Unknown',
      lastSavedBy: header?.lastSavedBy || 'Unknown'
    }
  }

  /**
   * 转换为three.js对象
   */
  convertToThreeJS(entities) {
    const objects = []
    const group = new THREE.Group()

    // 转换墙体
    for (const wall of entities.walls || []) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(wall.start.x, wall.start.y, 0),
        new THREE.Vector3(wall.end.x, wall.end.y, 0)
      ])
      const material = new THREE.LineBasicMaterial({ color: 0x8B4513, linewidth: 3 })
      const line = new THREE.Line(geometry, material)
      group.add(line)
    }

    // 转换窗户
    for (const window of entities.windows || []) {
      if (window.vertices && window.vertices.length >= 4) {
        const shape = new THREE.Shape()
        shape.moveTo(window.vertices[0].x, window.vertices[0].y)
        for (let i = 1; i < window.vertices.length; i++) {
          shape.lineTo(window.vertices[i].x, window.vertices[i].y)
        }
        shape.closePath()
        
        const geometry = new THREE.ShapeGeometry(shape)
        const material = new THREE.MeshBasicMaterial({ 
          color: 0x87CEEB, 
          transparent: true, 
          opacity: 0.5 
        })
        const mesh = new THREE.Mesh(geometry, material)
        group.add(mesh)
      }
    }

    // 转换门
    for (const door of entities.doors || []) {
      if (door.vertices && door.vertices.length >= 4) {
        const shape = new THREE.Shape()
        shape.moveTo(door.vertices[0].x, door.vertices[0].y)
        for (let i = 1; i < door.vertices.length; i++) {
          shape.lineTo(door.vertices[i].x, door.vertices[i].y)
        }
        shape.closePath()
        
        const geometry = new THREE.ShapeGeometry(shape)
        const material = new THREE.MeshBasicMaterial({ color: 0xD2691E })
        const mesh = new THREE.Mesh(geometry, material)
        group.add(mesh)
      }
    }

    return group
  }

  /**
   * 从CAD数据提取户型信息
   */
  extractRoomProfile(parsedData) {
    const bounds = parsedData.statistics.bounds
    const area = (bounds.width * bounds.height) / 1000000 // 平方米
    
    // 识别房间数量 (通过墙体围合区域)
    const roomCount = this.estimateRoomCount(parsedData.entities.walls)
    
    return {
      area: Math.round(area * 100) / 100,
      width: Math.round(bounds.width / 1000 * 100) / 100, // 米
      height: Math.round(bounds.height / 1000 * 100) / 100, // 米
      roomCount: roomCount,
      floorCount: 1, // 默认单层
      orientation: 'unknown', // 需要用户指定
      windows: parsedData.entities.windows?.length || 0,
      doors: parsedData.entities.doors?.length || 0,
      hasCADData: true
    }
  }

  /**
   * 估算房间数量
   */
  estimateRoomCount(walls) {
    if (!walls || walls.length < 4) return 1
    
    // 简化算法: 根据墙体数量估算
    // 一般每个房间4-6段墙体
    const estimatedRooms = Math.floor(walls.length / 5)
    return Math.max(1, Math.min(estimatedRooms, 10)) // 限制在1-10之间
  }

  /**
   * 生成简化版户型图数据 (用于前端展示)
   */
  generateFloorPlanData(parsedData) {
    return {
      bounds: parsedData.statistics.bounds,
      walls: parsedData.entities.walls,
      windows: parsedData.entities.windows,
      doors: parsedData.entities.doors,
      texts: parsedData.entities.texts,
      dimensions: parsedData.entities.dimensions,
      roomProfile: parsedData.roomProfile,
      threeJSData: parsedData.threeJSObjects.toJSON()
    }
  }
}

module.exports = CADImporterEngine
