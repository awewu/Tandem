/**
 * DXF图纸解析服务
 * 使用dxf-parser库解析CAD图纸，提取房间信息和面积
 */

const DxfParser = require('dxf-parser');
const fs = require('fs');

class DXFParserService {
  constructor() {
    this.parser = new DxfParser();
  }

  /**
   * 解析DXF文件
   * @param {string|Buffer} filePath - 文件路径或Buffer
   * @returns {Promise<Object>} 解析结果
   */
  async parseDXF(filePath) {
    try {
      let dxfString;
      
      if (Buffer.isBuffer(filePath)) {
        dxfString = filePath.toString('utf-8');
      } else {
        dxfString = fs.readFileSync(filePath, 'utf-8');
      }

      const dxf = this.parser.parseSync(dxfString);
      
      // 提取房间信息
      const rooms = this.extractRooms(dxf);
      
      // 提取墙体信息
      const walls = this.extractWalls(dxf);
      
      // 计算总面积
      const totalArea = this.calculateTotalArea(rooms);
      
      // 提取尺寸信息
      const dimensions = this.extractDimensions(dxf);
      
      return {
        success: true,
        filename: typeof filePath === 'string' ? filePath : 'buffer.dxf',
        format: 'DXF',
        rooms,
        walls,
        totalArea,
        dimensions,
        raw: dxf
      };
    } catch (error) {
      console.error('DXF解析错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 提取房间信息
   * @param {Object} dxf - 解析后的DXF对象
   * @returns {Array} 房间列表
   */
  extractRooms(dxf) {
    const rooms = [];
    
    // 从INSERT实体中提取房间标记（通常是块引用）
    if (dxf.entities) {
      dxf.entities.forEach((entity, index) => {
        if (entity.type === 'INSERT') {
          const room = this.parseRoomFromInsert(entity);
          if (room) {
            rooms.push({
              id: `room_${index}`,
              ...room
            });
          }
        }
      });
    }

    // 如果没有找到房间，尝试从LWPOLYLINE提取封闭区域
    if (rooms.length === 0) {
      const polylineRooms = this.extractRoomsFromPolylines(dxf);
      rooms.push(...polylineRooms);
    }

    return rooms;
  }

  /**
   * 从INSERT实体解析房间
   * @param {Object} insert - INSERT实体
   * @returns {Object|null} 房间信息
   */
  parseRoomFromInsert(insert) {
    const blockName = insert.name || '';
    
    // 常见的房间块名称模式
    const roomPatterns = {
      '客厅': /客厅|living/i,
      '卧室': /卧室|主卧|次卧|bedroom/i,
      '厨房': /厨房|kitchen/i,
      '卫生间': /卫生间|厕所|bathroom|toilet/i,
      '书房': /书房|study/i,
      '餐厅': /餐厅|dining/i,
      '阳台': /阳台|balcony/i
    };

    let roomType = 'other';
    let roomName = blockName;

    for (const [name, pattern] of Object.entries(roomPatterns)) {
      if (pattern.test(blockName)) {
        roomType = name;
        roomName = name;
        break;
      }
    }

    return {
      name: roomName,
      type: this.getRoomTypeCode(roomType),
      area: 0, // 需要计算
      position: insert.position || [0, 0, 0],
      blockName: blockName
    };
  }

  /**
   * 从多段线提取房间
   * @param {Object} dxf - 解析后的DXF对象
   * @returns {Array} 房间列表
   */
  extractRoomsFromPolylines(dxf) {
    const rooms = [];
    const polylines = [];

    if (dxf.entities) {
      dxf.entities.forEach((entity, index) => {
        if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
          const vertices = this.getPolylineVertices(entity);
          if (vertices.length >= 3) {
            const area = this.calculatePolygonArea(vertices);
            if (area > 1) { // 大于1平方米的封闭区域
              polylines.push({
                id: `room_${index}`,
                vertices,
                area,
                entity
              });
            }
          }
        }
      });
    }

    // 按面积排序，过滤掉小面积（可能是家具而非房间）
    polylines.sort((a, b) => b.area - a.area);
    
    // 取前8个最大的封闭区域作为房间
    const topPolylines = polylines.slice(0, 8);
    
    topPolylines.forEach((poly, index) => {
      rooms.push({
        id: poly.id,
        name: this.guessRoomNameByArea(poly.area, index),
        type: this.guessRoomTypeByArea(poly.area, index),
        area: Math.round(poly.area * 100) / 100,
        vertices: poly.vertices,
        isPolyline: true
      });
    });

    return rooms;
  }

  /**
   * 获取多段线顶点
   * @param {Object} entity - 多段线实体
   * @returns {Array} 顶点数组
   */
  getPolylineVertices(entity) {
    if (entity.vertices) {
      return entity.vertices.map(v => [v.x, v.y]);
    }
    return [];
  }

  /**
   * 计算多边形面积
   * @param {Array} vertices - 顶点数组
   * @returns {number} 面积（平方米）
   */
  calculatePolygonArea(vertices) {
    if (vertices.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i][0] * vertices[j][1];
      area -= vertices[j][0] * vertices[i][1];
    }
    
    area = Math.abs(area) / 2;
    
    // 假设单位是毫米，转换为平方米
    return area / 1000000;
  }

  /**
   * 根据面积猜测房间名称
   * @param {number} area - 面积
   * @param {number} index - 索引
   * @returns {string} 房间名称
   */
  guessRoomNameByArea(area, index) {
    if (index === 0 && area > 20) return '客厅';
    if (area > 15) return `卧室${index}`;
    if (area > 8) return `卧室${index}`;
    if (area > 5) return '卫生间';
    if (area > 3) return '阳台';
    return `区域${index + 1}`;
  }

  /**
   * 根据面积猜测房间类型
   * @param {number} area - 面积
   * @param {number} index - 索引
   * @returns {string} 房间类型代码
   */
  guessRoomTypeByArea(area, index) {
    if (index === 0 && area > 20) return 'living_room';
    if (area > 8) return 'bedroom';
    if (area > 5) return 'bathroom';
    if (area > 3) return 'balcony';
    return 'other';
  }

  /**
   * 获取房间类型代码
   * @param {string} type - 类型名称
   * @returns {string} 类型代码
   */
  getRoomTypeCode(type) {
    const typeMap = {
      '客厅': 'living_room',
      '卧室': 'bedroom',
      '厨房': 'kitchen',
      '卫生间': 'bathroom',
      '书房': 'study',
      '餐厅': 'dining',
      '阳台': 'balcony',
      'other': 'other'
    };
    return typeMap[type] || 'other';
  }

  /**
   * 提取墙体信息
   * @param {Object} dxf - 解析后的DXF对象
   * @returns {Array} 墙体列表
   */
  extractWalls(dxf) {
    const walls = [];

    if (dxf.entities) {
      dxf.entities.forEach((entity, index) => {
        // 从LINE实体提取墙体
        if (entity.type === 'LINE') {
          walls.push({
            id: `wall_${index}`,
            start: [entity.vertices[0].x, entity.vertices[0].y],
            end: [entity.vertices[1].x, entity.vertices[1].y],
            thickness: entity.thickness || 200,
            type: 'line'
          });
        }
        
        // 从LWPOLYLINE提取墙体
        if (entity.type === 'LWPOLYLINE') {
          const vertices = this.getPolylineVertices(entity);
          for (let i = 0; i < vertices.length - 1; i++) {
            walls.push({
              id: `wall_${index}_${i}`,
              start: vertices[i],
              end: vertices[i + 1],
              thickness: entity.thickness || 200,
              type: 'polyline_segment'
            });
          }
        }
      });
    }

    return walls;
  }

  /**
   * 计算总面积
   * @param {Array} rooms - 房间列表
   * @returns {number} 总面积
   */
  calculateTotalArea(rooms) {
    return rooms.reduce((total, room) => total + (room.area || 0), 0);
  }

  /**
   * 提取尺寸标注
   * @param {Object} dxf - 解析后的DXF对象
   * @returns {Array} 尺寸列表
   */
  extractDimensions(dxf) {
    const dimensions = [];

    if (dxf.entities) {
      dxf.entities.forEach((entity, index) => {
        if (entity.type === 'DIMENSION') {
          dimensions.push({
            id: `dim_${index}`,
            type: entity.dimensionType,
            text: entity.text,
            value: this.parseDimensionValue(entity.text),
            position: entity.anchorPoint
          });
        }
      });
    }

    return dimensions;
  }

  /**
   * 解析尺寸数值
   * @param {string} text - 尺寸文本
   * @returns {number} 数值
   */
  parseDimensionValue(text) {
    if (!text) return 0;
    const match = text.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }

  /**
   * 计算采暖负荷
   * @param {Object} dxfData - DXF解析数据
   * @param {Object} params - 计算参数
   * @returns {Object} 负荷计算结果
   */
  calculateHeatingLoad(dxfData, params = {}) {
    const { rooms, totalArea } = dxfData;
    const { 
      climateZone = 'cold', // 气候区
      insulation = 'good', // 保温情况
      floorHeight = 2.8    // 层高
    } = params;

    // 基础热负荷指标 (W/㎡)
    const baseLoadFactors = {
      'cold': { 'good': 80, 'average': 100, 'poor': 120 },
      'moderate': { 'good': 60, 'average': 80, 'poor': 100 },
      'warm': { 'good': 40, 'average': 60, 'poor': 80 }
    };

    const baseFactor = baseLoadFactors[climateZone]?.[insulation] || 80;
    
    // 层高修正
    const heightFactor = floorHeight / 2.8;
    
    const roomLoads = rooms.map(room => {
      const roomLoad = room.area * baseFactor * heightFactor;
      return {
        roomId: room.id,
        roomName: room.name,
        area: room.area,
        heatingLoad: Math.round(roomLoad),
        coolingLoad: Math.round(roomLoad * 0.7) // 制冷负荷约为采暖的70%
      };
    });

    const totalHeatingLoad = roomLoads.reduce((sum, r) => sum + r.heatingLoad, 0);
    const totalCoolingLoad = roomLoads.reduce((sum, r) => sum + r.coolingLoad, 0);

    return {
      roomLoads,
      totalHeatingLoad,
      totalCoolingLoad,
      totalArea,
      averageLoadPerSqm: Math.round(totalHeatingLoad / totalArea),
      parameters: { climateZone, insulation, floorHeight }
    };
  }

  /**
   * 获取解析统计信息
   * @param {Object} dxfData - DXF解析数据
   * @returns {Object} 统计信息
   */
  getStatistics(dxfData) {
    const { rooms, walls, dimensions } = dxfData;
    
    return {
      roomCount: rooms.length,
      wallCount: walls.length,
      dimensionCount: dimensions.length,
      totalArea: dxfData.totalArea,
      roomTypes: this.countRoomTypes(rooms),
      averageRoomArea: rooms.length > 0 ? dxfData.totalArea / rooms.length : 0
    };
  }

  /**
   * 统计房间类型
   * @param {Array} rooms - 房间列表
   * @returns {Object} 类型统计
   */
  countRoomTypes(rooms) {
    const counts = {};
    rooms.forEach(room => {
      const type = room.type || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }
}

module.exports = new DXFParserService();
