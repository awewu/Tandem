/**
 * CADEntityRecognizer - CAD实体识别器
 * 自动识别墙体、门窗、房间等户型元素
 * 
 * Vibe Coding生成 - 2026-04-06 Session 4
 * 自然语言需求: 完善CAD导入，自动识别墙体门窗并生成户型
 */

class CADEntityRecognizer {
  constructor(options = {}) {
    this.wallThickness = options.wallThickness || 0.2; // 默认墙厚20cm
    this.doorWidth = options.doorWidth || 0.9; // 默认门宽90cm
    this.windowHeight = options.windowHeight || 1.5; // 默认窗高1.5m
    this.scaleFactor = options.scaleFactor || 1; // 缩放因子
  }

  /**
   * 分析CAD实体并识别户型元素
   * @param {Object} parsedDXF - DXF解析结果
   * @returns {Object} 识别后的户型数据
   */
  analyze(parsedDXF) {
    console.log('[CADEntityRecognizer] 开始分析CAD实体...');
    
    const entities = parsedDXF.entities || [];
    const result = {
      walls: [],
      doors: [],
      windows: [],
      rooms: [],
      dimensions: [],
      metadata: {
        totalEntities: entities.length,
        recognizedWalls: 0,
        recognizedDoors: 0,
        recognizedWindows: 0,
        recognizedRooms: 0
      }
    };

    // 1. 识别墙体 (连续线段或闭合多段线)
    result.walls = this.recognizeWalls(entities);
    result.metadata.recognizedWalls = result.walls.length;

    // 2. 识别门窗 (特定尺寸或标记的实体)
    const openings = this.recognizeOpenings(entities, result.walls);
    result.doors = openings.doors;
    result.windows = openings.windows;
    result.metadata.recognizedDoors = result.doors.length;
    result.metadata.recognizedWindows = result.windows.length;

    // 3. 识别房间 (闭合空间)
    result.rooms = this.recognizeRooms(result.walls, result.doors, result.windows);
    result.metadata.recognizedRooms = result.rooms.length;

    // 4. 识别尺寸标注
    result.dimensions = this.recognizeDimensions(entities);

    // 5. 生成户型轮廓
    result.floorPlan = this.generateFloorPlan(result);

    console.log('[CADEntityRecognizer] 分析完成:');
    console.log(`  - 墙体: ${result.metadata.recognizedWalls}`);
    console.log(`  - 门: ${result.metadata.recognizedDoors}`);
    console.log(`  - 窗: ${result.metadata.recognizedWindows}`);
    console.log(`  - 房间: ${result.metadata.recognizedRooms}`);

    return result;
  }

  /**
   * 识别墙体
   */
  recognizeWalls(entities) {
    const walls = [];
    const lines = entities.lines || [];
    const polylines = entities.polylines || [];

    // 分析连续线段形成墙体
    const wallSegments = this.findConnectedLines(lines);
    
    for (const segment of wallSegments) {
      const wall = this.createWallFromSegment(segment);
      if (wall.length > 0.5) { // 过滤太短的对象
        walls.push(wall);
      }
    }

    // 分析多段线墙体
    for (const polyline of polylines) {
      const wall = this.createWallFromPolyline(polyline);
      if (wall) {
        walls.push(wall);
      }
    }

    return walls;
  }

  /**
   * 找连续的线段
   */
  findConnectedLines(lines) {
    const segments = [];
    const used = new Set();

    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;

      const segment = [lines[i]];
      used.add(i);

      let currentEnd = lines[i].end;
      let found = true;

      while (found) {
        found = false;
        for (let j = 0; j < lines.length; j++) {
          if (used.has(j)) continue;

          const line = lines[j];
          const dist = this.pointDistance(currentEnd, line.start);
          
          if (dist < 0.1) { // 10cm容差
            segment.push(line);
            used.add(j);
            currentEnd = line.end;
            found = true;
            break;
          }
        }
      }

      if (segment.length >= 1) {
        segments.push(segment);
      }
    }

    return segments;
  }

  /**
   * 从线段创建墙体
   */
  createWallFromSegment(segment) {
    const start = segment[0].start;
    const end = segment[segment.length - 1].end;
    const length = this.pointDistance(start, end);
    
    return {
      id: `wall-${Math.random().toString(36).substr(2, 9)}`,
      type: 'wall',
      start,
      end,
      length: Math.round(length * 100) / 100,
      thickness: this.wallThickness,
      segments: segment.length,
      orientation: this.calculateOrientation(start, end)
    };
  }

  /**
   * 从多段线创建墙体
   */
  createWallFromPolyline(polyline) {
    if (!polyline.vertices || polyline.vertices.length < 2) return null;

    const start = polyline.vertices[0];
    const end = polyline.vertices[polyline.vertices.length - 1];
    
    // 计算总长度
    let totalLength = 0;
    for (let i = 0; i < polyline.vertices.length - 1; i++) {
      totalLength += this.pointDistance(
        polyline.vertices[i],
        polyline.vertices[i + 1]
      );
    }

    return {
      id: `wall-poly-${Math.random().toString(36).substr(2, 9)}`,
      type: 'wall',
      start,
      end,
      length: Math.round(totalLength * 100) / 100,
      thickness: polyline.width || this.wallThickness,
      vertices: polyline.vertices.length,
      isClosed: polyline.isClosed
    };
  }

  /**
   * 识别门窗洞口
   */
  recognizeOpenings(entities, walls) {
    const result = { doors: [], windows: [] };
    const arcs = entities.arcs || [];
    const circles = entities.circles || [];
    const lines = entities.lines || [];

    // 1. 基于弧线识别门 (通常门是弧线或特定标记)
    for (const arc of arcs) {
      const door = this.analyzeArcAsDoor(arc, walls);
      if (door) {
        result.doors.push(door);
      }
    }

    // 2. 基于线段缺口识别门/窗
    const gaps = this.findWallGaps(walls, lines);
    
    for (const gap of gaps) {
      const opening = this.classifyOpening(gap);
      if (opening.type === 'door') {
        result.doors.push(opening);
      } else if (opening.type === 'window') {
        result.windows.push(opening);
      }
    }

    // 3. 基于特定标记识别 (文字标注)
    const texts = entities.texts || [];
    for (const text of texts) {
      const opening = this.analyzeTextMarking(text, walls);
      if (opening) {
        if (opening.type === 'door') {
          result.doors.push(opening);
        } else if (opening.type === 'window') {
          result.windows.push(opening);
        }
      }
    }

    return result;
  }

  /**
   * 分析弧线是否为门
   */
  analyzeArcAsDoor(arc, walls) {
    // 检查弧线是否连接墙体
    const arcCenter = arc.center;
    const radius = arc.radius;
    
    // 门弧线通常半径在70-100cm
    if (radius < 0.7 || radius > 1.2) return null;

    // 检查弧线是否紧邻墙体
    const nearWall = walls.find(wall => {
      const dist = this.pointToLineDistance(arcCenter, wall.start, wall.end);
      return dist < radius + 0.2;
    });

    if (!nearWall) return null;

    return {
      id: `door-${Math.random().toString(36).substr(2, 9)}`,
      type: 'door',
      subtype: 'swing', // 平开门
      center: arcCenter,
      radius,
      angle: { start: arc.startAngle, end: arc.endAngle },
      wall: nearWall.id,
      width: Math.round(radius * 100) / 100,
      direction: this.calculateDoorDirection(arc, nearWall)
    };
  }

  /**
   * 找墙体缺口
   */
  findWallGaps(walls, lines) {
    const gaps = [];

    for (const wall of walls) {
      // 找与墙体相交或靠近的短线段
      const candidates = lines.filter(line => {
        const lineLength = this.pointDistance(line.start, line.end);
        const distToWall = Math.min(
          this.pointToLineDistance(line.start, wall.start, wall.end),
          this.pointToLineDistance(line.end, wall.start, wall.end)
        );
        
        // 缺口特征: 短距离(0.5-2m)，靠近墙体
        return lineLength >= 0.5 && lineLength <= 2.5 && distToWall < 0.3;
      });

      for (const line of candidates) {
        const length = this.pointDistance(line.start, line.end);
        
        gaps.push({
          position: { start: line.start, end: line.end },
          length: Math.round(length * 100) / 100,
          wall: wall.id
        });
      }
    }

    return gaps;
  }

  /**
   * 分类洞口是门还是窗
   */
  classifyOpening(gap) {
    const length = gap.length;
    
    // 基于尺寸分类
    if (length >= 0.7 && length <= 1.2) {
      // 门宽通常在70-120cm
      return {
        id: `door-gap-${Math.random().toString(36).substr(2, 9)}`,
        type: 'door',
        subtype: 'passage',
        position: gap.position,
        width: length,
        wall: gap.wall,
        height: 2.1 // 标准门高
      };
    } else if (length >= 0.6 && length <= 2.5) {
      // 窗宽通常在60-250cm
      return {
        id: `window-${Math.random().toString(36).substr(2, 9)}`,
        type: 'window',
        subtype: 'regular',
        position: gap.position,
        width: length,
        wall: gap.wall,
        height: this.windowHeight,
        sillHeight: 0.9 // 窗台高度90cm
      };
    }

    return { type: 'unknown', ...gap };
  }

  /**
   * 分析文字标记
   */
  analyzeTextMarking(text, walls) {
    const content = text.text?.toLowerCase() || '';
    const position = text.position;

    // 找最近的墙体
    const nearestWall = walls.reduce((nearest, wall) => {
      const dist = this.pointToLineDistance(position, wall.start, wall.end);
      return dist < nearest.dist ? { wall, dist } : nearest;
    }, { wall: null, dist: Infinity });

    if (nearestWall.dist > 2) return null; // 太远了

    // 门标记
    if (content.includes('门') || content.includes('door') || content.includes('d')) {
      return {
        id: `door-mark-${Math.random().toString(36).substr(2, 9)}`,
        type: 'door',
        subtype: 'marked',
        marking: text.text,
        position,
        wall: nearestWall.wall.id
      };
    }

    // 窗标记
    if (content.includes('窗') || content.includes('window') || content.includes('w')) {
      return {
        id: `window-mark-${Math.random().toString(36).substr(2, 9)}`,
        type: 'window',
        subtype: 'marked',
        marking: text.text,
        position,
        wall: nearestWall.wall.id
      };
    }

    return null;
  }

  /**
   * 识别房间 (闭合空间分析)
   */
  recognizeRooms(walls, doors, windows) {
    const rooms = [];
    
    // 简化处理: 基于墙体围成的矩形区域识别房间
    const wallGroups = this.groupWallsByEnclosure(walls);
    
    for (let i = 0; i < wallGroups.length; i++) {
      const group = wallGroups[i];
      const room = this.analyzeRoomSpace(group, doors, windows);
      
      if (room && room.area > 5) { // 过滤太小的空间
        room.id = `room-${(i + 1).toString().padStart(2, '0')}`;
        room.name = this.guessRoomName(room, doors, windows);
        rooms.push(room);
      }
    }

    return rooms;
  }

  /**
   * 按围合关系分组墙体
   */
  groupWallsByEnclosure(walls) {
    // 简化: 基于空间邻近度分组
    const groups = [];
    const used = new Set();

    for (const wall of walls) {
      if (used.has(wall.id)) continue;

      const group = [wall];
      used.add(wall.id);

      // 找与当前墙体相连的其他墙体
      const connected = walls.filter(w => 
        !used.has(w.id) && this.areWallsConnected(wall, w)
      );

      group.push(...connected);
      connected.forEach(w => used.add(w.id));

      groups.push(group);
    }

    return groups;
  }

  /**
   * 判断两个墙体是否相连
   */
  areWallsConnected(wall1, wall2) {
    const tolerance = 0.2; // 20cm容差
    
    const start1 = wall1.start;
    const end1 = wall1.end;
    const start2 = wall2.start;
    const end2 = wall2.end;

    // 检查端点是否重合
    return (
      this.pointDistance(start1, start2) < tolerance ||
      this.pointDistance(start1, end2) < tolerance ||
      this.pointDistance(end1, start2) < tolerance ||
      this.pointDistance(end1, end2) < tolerance
    );
  }

  /**
   * 分析房间空间
   */
  analyzeRoomSpace(wallGroup, doors, windows) {
    // 计算边界框
    const allPoints = wallGroup.flatMap(w => [w.start, w.end]);
    const bounds = this.calculateBounds(allPoints);

    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const area = width * height;

    // 找房间的门和窗
    const roomDoors = doors.filter(d => 
      this.isOpeningInRoom(d, bounds)
    );
    
    const roomWindows = windows.filter(w => 
      this.isOpeningInRoom(w, bounds)
    );

    return {
      area: Math.round(area * 100) / 100,
      width: Math.round(width * 100) / 100,
      height: Math.round(height * 100) / 100,
      bounds,
      walls: wallGroup.map(w => w.id),
      doors: roomDoors.map(d => d.id),
      windows: roomWindows.map(w => w.id),
      doorCount: roomDoors.length,
      windowCount: roomWindows.length
    };
  }

  /**
   * 判断洞口是否在房间内
   */
  isOpeningInRoom(opening, bounds) {
    const pos = opening.position || opening.center;
    if (!pos) return false;

    return (
      pos.x >= bounds.minX && pos.x <= bounds.maxX &&
      pos.y >= bounds.minY && pos.y <= bounds.maxY
    );
  }

  /**
   * 猜测房间名称
   */
  guessRoomName(room, doors, windows) {
    const { area, doorCount, windowCount } = room;

    // 基于特征猜测房间类型
    if (area > 30 && doorCount >= 2) {
      return '客厅';
    } else if (area > 15 && area < 30 && doorCount === 1) {
      return '卧室';
    } else if (area < 10 && doorCount === 1 && windowCount === 0) {
      return '卫生间';
    } else if (area < 8 && doorCount === 1) {
      return '厨房';
    } else if (doorCount === 0) {
      return '储藏室';
    }

    return `房间${room.id}`;
  }

  /**
   * 识别尺寸标注
   */
  recognizeDimensions(entities) {
    const dimensions = [];
    const texts = entities.texts || [];
    
    // 找数字+单位的标注
    for (const text of texts) {
      const content = text.text || '';
      
      // 匹配尺寸模式: 数字+单位或纯数字
      const dimensionMatch = content.match(/(\d+(?:\.\d+)?)\s*(m|米|mm|cm)?/);
      
      if (dimensionMatch) {
        const value = parseFloat(dimensionMatch[1]);
        const unit = dimensionMatch[2] || 'm';
        
        dimensions.push({
          id: `dim-${Math.random().toString(36).substr(2, 9)}`,
          value,
          unit,
          originalText: content,
          position: text.position,
          // 转换为标准单位(米)
          normalizedValue: unit === 'mm' ? value / 1000 : 
                           unit === 'cm' ? value / 100 : value
        });
      }
    }

    return dimensions;
  }

  /**
   * 生成户型数据
   */
  generateFloorPlan(recognitionResult) {
    const { walls, doors, windows, rooms, dimensions } = recognitionResult;

    // 计算总面积
    const totalArea = rooms.reduce((sum, r) => sum + r.area, 0);

    // 找主要朝向
    const orientation = this.determineOrientation(walls);

    return {
      totalArea: Math.round(totalArea * 100) / 100,
      roomCount: rooms.length,
      doorCount: doors.length,
      windowCount: windows.length,
      orientation,
      estimatedRooms: rooms.map(r => ({
        name: r.name,
        area: r.area,
        width: r.width,
        height: r.height
      })),
      summary: {
        hasLivingRoom: rooms.some(r => r.name === '客厅'),
        hasBedroom: rooms.some(r => r.name.includes('卧室')),
        hasKitchen: rooms.some(r => r.name === '厨房'),
        hasBathroom: rooms.some(r => r.name === '卫生间'),
        totalWallLength: Math.round(
          walls.reduce((sum, w) => sum + w.length, 0) * 100
        ) / 100
      }
    };
  }

  /**
   * 确定户型朝向
   */
  determineOrientation(walls) {
    // 简化: 基于主要墙体方向判断
    const horizontalWalls = walls.filter(w => 
      Math.abs(w.start.y - w.end.y) < 0.1
    );
    
    const verticalWalls = walls.filter(w => 
      Math.abs(w.start.x - w.end.x) < 0.1
    );

    // 通常南北向是主要的
    if (horizontalWalls.length > verticalWalls.length) {
      return 'south'; // 南向
    } else {
      return 'east'; // 东向或西向
    }
  }

  // 辅助方法
  pointDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  pointToLineDistance(point, lineStart, lineEnd) {
    const A = lineEnd.y - lineStart.y;
    const B = lineStart.x - lineEnd.x;
    const C = lineEnd.x * lineStart.y - lineStart.x * lineEnd.y;
    
    return Math.abs(A * point.x + B * point.y + C) / Math.sqrt(A * A + B * B);
  }

  calculateOrientation(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    if (Math.abs(angle) < 45) return 'horizontal';
    if (Math.abs(angle) > 135) return 'horizontal';
    return 'vertical';
  }

  calculateDoorDirection(arc, wall) {
    // 简化: 基于弧线角度判断开启方向
    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    
    if (midAngle > 0 && midAngle < 180) {
      return 'inward';
    } else {
      return 'outward';
    }
  }

  calculateBounds(points) {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  /**
   * 获取识别统计
   */
  getStats() {
    return {
      confidence: 'medium',
      recognizedElements: ['walls', 'doors', 'windows', 'rooms'],
      limitations: [
        '复杂户型可能需要人工校验',
        '标注识别依赖文字清晰度',
        '弧形墙体识别精度有限'
      ]
    };
  }
}

module.exports = CADEntityRecognizer;
