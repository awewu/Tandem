/**
 * 详细图纸生成引擎 - 施工级设计图纸
 * 生成CAD级详细施工图纸，包含平面图、系统图、节点详图
 */

class DrawingEngine {
  constructor() {
    this.scale = 100; // 1:100 默认比例
    this.paperSize = 'A3'; // 默认图纸尺寸
    
    // 图层配置
    this.layers = {
      walls: { name: '墙体', color: '#000000', lineWidth: 0.5 },
      dimensions: { name: '尺寸标注', color: '#0066CC', lineWidth: 0.25 },
      ac_duct: { name: '空调风管', color: '#FF0000', lineWidth: 0.35 },
      ac_pipe: { name: '空调水管', color: '#00AA00', lineWidth: 0.35 },
      fresh_air: { name: '新风管路', color: '#0066FF', lineWidth: 0.35 },
      water_pipe: { name: '给水管路', color: '#00CCFF', lineWidth: 0.35 },
      heating: { name: '采暖管路', color: '#FF6600', lineWidth: 0.35 },
      equipment: { name: '设备', color: '#9900CC', lineWidth: 0.5 },
      text: { name: '文字标注', color: '#000000', lineWidth: 0.25 }
    };
  }

  /**
   * 生成完整施工图纸集
   */
  generateDrawingSet(projectData, designData) {
    const drawingSet = {
      projectInfo: {
        name: projectData.name,
        customer: projectData.customer,
        designer: projectData.designer,
        date: new Date().toISOString().split('T')[0],
        drawingNumber: `RHEEM-${Date.now().toString(36).toUpperCase()}`
      },
      drawings: []
    };

    // 1. 平面图
    drawingSet.drawings.push(this.generateFloorPlan(projectData, designData));

    // 2. 空调系统图
    if (designData.systems.includes('ac')) {
      drawingSet.drawings.push(this.generateACSystemDrawing(projectData, designData));
    }

    // 3. 新风系统图
    if (designData.systems.includes('fresh')) {
      drawingSet.drawings.push(this.generateFreshAirDrawing(projectData, designData));
    }

    // 4. 采暖系统图
    if (designData.systems.includes('heat')) {
      drawingSet.drawings.push(this.generateHeatingDrawing(projectData, designData));
    }

    // 5. 净水系统图
    if (designData.systems.includes('water')) {
      drawingSet.drawings.push(this.generateWaterDrawing(projectData, designData));
    }

    // 6. 设备定位图
    drawingSet.drawings.push(this.generateEquipmentLayout(projectData, designData));

    // 7. 节点详图
    drawingSet.drawings.push(this.generateDetailDrawings(projectData, designData));
    
    // 8. 管道轴测图（新增）
    drawingSet.drawings.push(this.generateIsometricPiping(projectData, designData));
    
    // 9. 电气系统图（新增）
    drawingSet.drawings.push(this.generateElectricalDiagram(projectData, designData));
    
    // 10. 系统原理图（新增）
    const systemTypes = designData.systems || [];
    if (systemTypes.includes('ac')) {
      drawingSet.drawings.push(this.generateACPrincipleDiagram(projectData, designData));
    }
    if (systemTypes.includes('water')) {
      drawingSet.drawings.push(this.generateWaterPrincipleDiagram(projectData, designData));
    }
    if (systemTypes.includes('heat')) {
      drawingSet.drawings.push(this.generateHeatingPrincipleDiagram(projectData, designData));
    }
    if (systemTypes.includes('fresh')) {
      drawingSet.drawings.push(this.generateFreshAirPrincipleDiagram(projectData, designData));
    }
    
    // 11. 管路走向图（新增）
    drawingSet.drawings.push(this.generatePipeRouting(projectData, designData));

    return drawingSet;
  }

  /**
   * 生成平面图
   */
  generateFloorPlan(project, design) {
    const rooms = project.rooms || this.generateDefaultRooms(project.area);
    
    return {
      type: 'floor_plan',
      name: '平面布置图',
      sheet: 'A3',
      scale: '1:100',
      content: {
        title: `${project.name} - 平面布置图`,
        rooms: rooms.map(room => ({
          id: room.id,
          name: room.name,
          bounds: this.calculateRoomBounds(room),
          walls: this.generateWalls(room),
          dimensions: this.generateDimensions(room),
          area: room.area
        })),
        equipment: this.positionEquipment(design.devices, rooms),
        annotations: this.generateAnnotations(rooms),
        legend: this.generateLegend(['ac', 'fresh', 'heat', 'water']),
        notes: [
          '1. 本图尺寸单位：mm',
          '2. 所有设备定位尺寸以建筑轴线为准',
          '3. 设备吊装需预留检修空间',
          '4. 具体安装高度参见设备详图'
        ]
      }
    };
  }

  /**
   * 生成空调系统图
   */
  generateACSystemDrawing(project, design) {
    const acDevices = design.devices.filter(d => d.category === '中央空调');
    
    return {
      type: 'ac_system',
      name: '空调系统图',
      sheet: 'A3',
      scale: '示意图',
      content: {
        title: `${project.name} - 空调系统图`,
        outdoorUnit: {
          position: '设备平台/阳台',
          model: acDevices.find(d => d.type === 'outdoor')?.model || 'RHEEM-120',
          connections: acDevices.filter(d => d.type === 'indoor').map((unit, i) => ({
            indoorUnit: `室内机-${i+1}`,
            refrigerantLines: {
              liquid: { size: 'Φ9.52mm', insulation: '15mm橡塑' },
              gas: { size: 'Φ15.88mm', insulation: '20mm橡塑' }
            },
            condensateDrain: { size: 'PVC-U Φ25mm', slope: '1%' },
            controlCable: 'RVVP 2×1.0mm²',
            powerCable: 'BV 3×4.0mm²'
          }))
        },
        indoorUnits: acDevices.filter(d => d.type === 'indoor').map((unit, i) => ({
          id: `IDU-${String(i+1).padStart(2, '0')}`,
          room: unit.room,
          model: unit.model,
          position: { x: unit.x, y: unit.y, z: unit.z },
          airflow: unit.airflow || 800,
          dimensions: unit.dimensions
        })),
        piping: {
          refrigerant: {
            totalLength: this.calculatePipeLength(acDevices),
            maxLength: 30,
            maxHeight: 10,
            bends: 4
          },
          condensate: {
            totalLength: this.calculatePipeLength(acDevices),
            drainPoint: '卫生间地漏'
          }
        },
        specifications: {
          coolingCapacity: design.coolingLoad,
          heatingCapacity: design.heatingLoad,
          totalPower: this.calculateTotalPower(acDevices),
          maxCurrent: this.calculateMaxCurrent(acDevices)
        }
      }
    };
  }

  /**
   * 生成新风系统图
   */
  generateFreshAirDrawing(project, design) {
    const freshDevices = design.devices.filter(d => d.category === '新风系统');
    
    return {
      type: 'fresh_air_system',
      name: '新风系统图',
      sheet: 'A3',
      scale: '示意图',
      content: {
        title: `${project.name} - 新风系统图`,
        hostUnit: freshDevices.find(d => d.type === 'host'),
        airflows: this.calculateAirflows(project.rooms),
        ductwork: {
          mainDuct: { size: '200×200mm', material: '镀锌钢板' },
          branchDucts: project.rooms.map((room, i) => ({
            room: room.name,
            size: 'Φ100mm',
            material: 'PE波纹管',
            airflow: room.airflow || 30,
            diffusers: room.diffusers || 1
          }))
        },
        outlets: this.calculateOutlets(project.rooms),
        specifications: {
          totalAirflow: this.calculateTotalAirflow(project.rooms),
          heatRecovery: freshDevices[0]?.specs?.heatRecovery || 78,
          pressure: 150, // Pa
          noise: 35 // dB
        }
      }
    };
  }

  /**
   * 生成采暖系统图
   */
  generateHeatingDrawing(project, design) {
    return {
      type: 'heating_system',
      name: '采暖系统图',
      sheet: 'A3',
      scale: '示意图',
      content: {
        title: `${project.name} - 采暖系统图`,
        heatSource: design.devices.find(d => d.category === '采暖系统'),
        distribution: {
          type: '地暖', // 或 'radiator'
          pipeSpacing: 200, // mm
          pipeMaterial: 'PE-RT',
          pipeDiameter: 'DN20',
          manifolds: this.calculateManifolds(project.rooms)
        },
        circuits: project.rooms.map((room, i) => ({
          circuit: i + 1,
          room: room.name,
          area: room.area,
          pipeLength: Math.round(room.area * 5),
          flowRate: this.calculateFlowRate(room.area)
        })),
        specifications: {
          heatingLoad: design.heatingLoad,
          supplyTemp: 45,
          returnTemp: 35,
          pressureDrop: 15 // kPa
        }
      }
    };
  }

  /**
   * 生成净水系统图
   */
  generateWaterDrawing(project, design) {
    const waterDevices = design.devices.filter(d => d.category === '净水系统');
    
    return {
      type: 'water_system',
      name: '净水系统图',
      sheet: 'A3',
      scale: '示意图',
      content: {
        title: `${project.name} - 净水系统图`,
        systemType: '全屋净水',
        devices: waterDevices.map(d => ({
          name: d.name,
          model: d.model,
          position: d.position,
          inletSize: d.inletSize || 'DN20',
          outletSize: d.outletSize || 'DN20',
          drainRequired: true
        })),
        piping: {
          inlet: { size: 'DN25', material: 'PPR' },
          outlet: { size: 'DN25', material: 'PPR' },
          drain: { size: 'DN50', material: 'PVC-U' }
        },
        specifications: {
          flowRate: waterDevices.reduce((sum, d) => sum + (d.specs?.flowRate || 100), 0),
          pressure: 0.3, // MPa
          stages: waterDevices.length
        }
      }
    };
  }

  /**
   * 生成设备定位图
   */
  generateEquipmentLayout(project, design) {
    return {
      type: 'equipment_layout',
      name: '设备定位图',
      sheet: 'A3',
      scale: '1:50',
      content: {
        title: `${project.name} - 设备定位图`,
        devices: design.devices.map(d => ({
          id: d.id,
          category: d.category,
          name: d.name,
          model: d.model,
          position: d.position,
          dimensions: d.dimensions,
          clearances: d.clearances,
          anchorPoints: this.calculateAnchorPoints(d),
          serviceAccess: this.calculateServiceAccess(d)
        })),
        dimensions: this.generateEquipmentDimensions(design.devices),
        elevations: this.generateElevations(design.devices),
        notes: [
          '1. 设备定位尺寸以建筑完成面为准',
          '2. 所有设备需预留检修空间',
          '3. 设备安装需符合厂家要求',
          '4. 具体安装方式参见设备说明书'
        ]
      }
    };
  }

  /**
   * 生成节点详图
   */
  generateDetailDrawings(project, design) {
    return {
      type: 'detail_drawings',
      name: '安装节点详图',
      sheet: 'A3',
      scale: '1:10 / 1:5',
      content: {
        title: `${project.name} - 安装节点详图`,
        details: [
          {
            id: 'D-01',
            name: '室内机吊装详图',
            scale: '1:10',
            description: '风管机吊装方式及减振措施',
            components: ['膨胀螺栓 M10', '吊杆 Φ10', '减震垫 20mm', '水平仪调整']
          },
          {
            id: 'D-02',
            name: '室外机安装详图',
            scale: '1:10',
            description: '室外机基础及固定方式',
            components: ['混凝土基础 200mm', '减震垫 15mm', '固定螺栓 M12', '防雨棚']
          },
          {
            id: 'D-03',
            name: '管道穿墙详图',
            scale: '1:5',
            description: '冷媒管、水管穿墙做法',
            components: ['PVC套管 DN100', '发泡胶填充', '防水封堵', '保温连续']
          },
          {
            id: 'D-04',
            name: '地暖分集水器安装详图',
            scale: '1:10',
            description: '分水器定位及管路连接',
            components: ['分水器箱体', '阀门', '压力表', '自动排气阀']
          },
          {
            id: 'D-05',
            name: '新风主机安装详图',
            scale: '1:10',
            description: '新风主机吊顶安装',
            components: ['吊杆 Φ10', '减振吊架', '检修口 400×400', '消音软管']
          }
        ]
      }
    };
  }

  // 辅助计算方法
  generateDefaultRooms(area) {
    const roomCount = Math.floor(area / 30);
    const rooms = [];
    const roomTypes = ['客厅', '主卧', '次卧', '书房', '餐厅', '厨房', '卫生间'];
    
    for (let i = 0; i < roomCount && i < roomTypes.length; i++) {
      rooms.push({
        id: `R-${String(i+1).padStart(2, '0')}`,
        name: roomTypes[i],
        area: Math.round(area / roomCount),
        width: 4,
        length: Math.round(area / roomCount / 4)
      });
    }
    
    return rooms;
  }

  calculateRoomBounds(room) {
    return {
      x: 0,
      y: 0,
      width: (room.width || 4) * 1000,
      height: (room.length || 5) * 1000
    };
  }

  generateWalls(room) {
    const w = (room.width || 4) * 1000;
    const h = (room.length || 5) * 1000;
    const thickness = 200;
    
    return [
      { start: [0, 0], end: [w, 0], thickness }, // 底
      { start: [w, 0], end: [w, h], thickness }, // 右
      { start: [w, h], end: [0, h], thickness }, // 顶
      { start: [0, h], end: [0, 0], thickness }  // 左
    ];
  }

  generateDimensions(room) {
    return [
      { type: 'width', value: (room.width || 4) * 1000, position: 'bottom' },
      { type: 'length', value: (room.length || 5) * 1000, position: 'right' }
    ];
  }

  positionEquipment(devices, rooms) {
    return devices.map((d, i) => ({
      ...d,
      room: rooms[i % rooms.length]?.name || '未分配',
      x: 2500,
      y: 2500
    }));
  }

  generateAnnotations(rooms) {
    return rooms.map(r => ({
      room: r.name,
      area: r.area,
      notes: [`面积: ${r.area}㎡`]
    }));
  }

  generateLegend(systems) {
    const legend = {};
    systems.forEach(sys => {
      if (this.layers[sys]) {
        legend[sys] = this.layers[sys];
      }
    });
    return legend;
  }

  calculatePipeLength(devices) {
    return devices.length * 12; // 估算
  }

  calculateTotalPower(devices) {
    return devices.reduce((sum, d) => sum + (d.power || 2), 0);
  }

  calculateMaxCurrent(devices) {
    const totalPower = this.calculateTotalPower(devices);
    return Math.round(totalPower * 1000 / 220);
  }

  calculateAirflows(rooms) {
    return rooms.map(r => ({
      room: r.name,
      supply: Math.round(r.area * 3),
      exhaust: Math.round(r.area * 2.5)
    }));
  }

  calculateTotalAirflow(rooms) {
    return rooms.reduce((sum, r) => sum + Math.round(r.area * 3), 0);
  }

  calculateOutlets(rooms) {
    return rooms.map(r => ({
      room: r.name,
      supply: 1,
      exhaust: r.name === '卫生间' ? 1 : 0
    }));
  }

  calculateManifolds(rooms) {
    const circuits = rooms.length;
    return {
      count: Math.ceil(circuits / 8),
      circuits: circuits,
      position: '厨房/卫生间吊顶'
    };
  }

  calculateFlowRate(area) {
    return Math.round(area * 0.1 * 10) / 10; // L/min
  }

  calculateAnchorPoints(device) {
    return [
      { x: 0, y: 0 },
      { x: device.dimensions?.width || 700, y: 0 },
      { x: 0, y: device.dimensions?.depth || 500 },
      { x: device.dimensions?.width || 700, y: device.dimensions?.depth || 500 }
    ];
  }

  calculateServiceAccess(device) {
    return {
      front: device.clearances?.front || 600,
      back: device.clearances?.back || 100,
      left: device.clearances?.side || 200,
      right: device.clearances?.side || 200,
      top: device.clearances?.top || 300
    };
  }

  generateEquipmentDimensions(devices) {
    return devices.map(d => ({
      id: d.id,
      width: d.dimensions?.width || 700,
      height: d.dimensions?.depth || 500,
      callout: `${d.name}\n${d.model}`
    }));
  }

  generateElevations(devices) {
    return devices.map(d => ({
      id: d.id,
      side: 'A-A',
      height: d.dimensions?.height || 250,
      zPosition: d.position?.z || 2500
    }));
  }
  
  /**
   * 生成管道轴测图 - 新增
   */
  generateIsometricPiping(project, design) {
    return {
      type: 'isometric_piping',
      name: '管道轴测图',
      sheet: 'A2',
      scale: '示意图',
      content: {
        title: `${project.name} - 管道轴测图`,
        description: '展示所有系统管路的立体走向和连接关系',
        systems: (design.systems || []).map(sys => ({
          type: sys,
          pipes: this.generatePipesForSystem(sys, project, design),
          valves: this.generateValvesForSystem(sys, project, design),
          fittings: this.generateFittingsForSystem(sys, project, design)
        })),
        intersections: this.detectIntersections(design.systems, project, design),
        legend: {
          colorCoding: this.layers,
          symbols: {
            valve: '阀门符号',
            elbow: '弯头符号',
            tee: '三通符号',
            reducer: '变径符号'
          }
        }
      }
    };
  }
  
  generatePipesForSystem(sysType, project, design) {
    // 根据系统类型生成管道数据
    const area = project.area || 120;
    return [
      {
        id: `${sysType}-main-1`,
        type: 'main',
        material: sysType === 'ac' ? '紫铜管' : 'PPR管',
        diameter: sysType === 'ac' ? 'Φ15.88' : 'DN25',
        length: area * 2,
        startPoint: { x: 0, y: 0, z: 2500 },
        endPoint: { x: 5000, y: 3000, z: 2500 },
        color: this.layers[sysType]?.color || '#000000'
      }
    ];
  }
  
  generateValvesForSystem(sysType, project, design) {
    return [
      { id: `${sysType}-valve-1`, type: '球阀', position: '入口', size: 'DN25' },
      { id: `${sysType}-valve-2`, type: '截止阀', position: '出口', size: 'DN25' }
    ];
  }
  
  generateFittingsForSystem(sysType, project, design) {
    return [
      { id: `${sysType}-elbow-1`, type: '90°弯头', count: 4 },
      { id: `${sysType}-tee-1`, type: '三通', count: 2 }
    ];
  }
  
  detectIntersections(systems, project, design) {
    // 检测管道交叉点
    return systems.length > 1 ? [
      { point: { x: 2500, y: 1500, z: 2500 }, systems: ['ac', 'water'], solution: '垂直交叉，空调在上' }
    ] : [];
  }
  
  /**
   * 生成电气系统图 - 新增
   */
  generateElectricalDiagram(project, design) {
    const totalPower = this.calculateTotalPower(design.devices);
    return {
      type: 'electrical_system',
      name: '电气系统图',
      sheet: 'A3',
      scale: '示意图',
      content: {
        title: `${project.name} - 电气系统图`,
        powerSupply: {
          input: 'AC 380V/220V 50Hz',
          mainSwitch: '总空开 63A 3P',
          distribution: [
            { circuit: 'AC-1', breaker: '32A', device: '室外机' },
            { circuit: 'AC-2', breaker: '16A', device: '室内机1' },
            { circuit: 'AC-3', breaker: '16A', device: '室内机2' },
            { circuit: 'HEAT-1', breaker: '20A', device: '壁挂炉' },
            { circuit: 'WATER-1', breaker: '16A', device: '热水器' },
            { circuit: 'FRESH-1', breaker: '10A', device: '新风机' }
          ]
        },
        loadCalculation: {
          totalPower: totalPower,
          demandFactor: 0.7,
          calculatedLoad: Math.round(totalPower * 0.7 * 100) / 100,
          current: Math.round(totalPower * 0.7 * 1000 / 220)
        },
        controlWiring: {
          signalType: 'RS485 / Modbus',
          devices: (design.devices || []).map(d => ({
            name: d.name,
            address: d.modbusAddress || '未分配',
            controlPoints: ['启停', '模式', '温度设定']
          }))
        }
      }
    };
  }
  
  /**
   * 生成空调系统原理图 - 新增
   */
  generateACPrincipleDiagram(project, design) {
    return {
      type: 'ac_principle_diagram',
      name: '空调系统原理图',
      sheet: 'A2',
      scale: '示意图',
      content: {
        title: `${project.name} - 空调系统原理图`,
        diagramType: '制冷循环原理图',
        components: {
          outdoorUnit: {
            name: '室外机',
            components: ['压缩机', '冷凝器', '膨胀阀', '风机'],
            connections: ['高压气管', '高压液管']
          },
          indoorUnits: (design.devices || []).filter(d => d.category === '中央空调' && d.type === 'indoor').map((u, i) => ({
            id: `IDU-${i + 1}`,
            name: u.name || `室内机${i + 1}`,
            components: ['蒸发器', '电子膨胀阀', '风机'],
            connections: ['低压气管', '低压液管']
          })),
          piping: {
            refrigerantLines: {
              highPressure: { gas: 'Φ15.88mm', liquid: 'Φ9.52mm' },
              lowPressure: { gas: 'Φ19.05mm', liquid: 'Φ12.7mm' }
            },
            insulation: '闭孔橡塑，厚度≥15mm'
          }
        },
        workingPrinciple: [
          '1. 压缩机将低温低压气态制冷剂压缩成高温高压气体',
          '2. 高温高压气体在室外机冷凝器中放热冷凝成液体',
          '3. 高压液体经膨胀阀节流降压成低温低压液体',
          '4. 低温低压液体在蒸发器中吸热气化，实现制冷',
          '5. 低温低压气体回到压缩机，完成循环'
        ],
        technicalSpecs: {
          refrigerant: 'R410A (环保制冷剂)',
          coolingCapacity: (design.coolingLoad || 12) + 'kW',
          eer: '3.5以上'
        }
      }
    };
  }
  
  /**
   * 生成水系统原理图 - 新增
   */
  generateWaterPrincipleDiagram(project, design) {
    return {
      type: 'water_principle_diagram',
      name: '水系统原理图',
      sheet: 'A2',
      scale: '示意图',
      content: {
        title: `${project.name} - 水系统原理图`,
        diagramType: '冷热水循环原理图',
        waterHeater: {
          type: '燃气/电热水器',
          capacity: '16L/min 或 80L储水',
          components: ['燃烧室', '换热器', '温控器', '安全阀']
        },
        piping: {
          hotWater: { size: 'DN20-25', material: 'PP-R S3.2级', temp: '50-60°C' },
          coldWater: { size: 'DN25', material: 'PP-R S4级', temp: '常温' },
          circulation: { size: 'DN20', material: 'PP-R', flow: '循环泵驱动' }
        },
        components: [
          { name: '冷水入口', type: '阀门', position: '入户' },
          { name: '前置过滤器', type: '净化', position: '入户后' },
          { name: '水表', type: '计量', position: '过滤后' },
          { name: '热水器', type: '加热', position: '设备平台' },
          { name: '热水分配', type: '分配', position: '分水器' }
        ],
        circulationSystem: {
          enabled: true,
          pumpType: '热水循环泵',
          trigger: '定时/温控/遥控',
          benefit: '即开即热，节水节能'
        }
      }
    };
  }
  
  /**
   * 生成采暖系统原理图 - 新增
   */
  generateHeatingPrincipleDiagram(project, design) {
    return {
      type: 'heating_principle_diagram',
      name: '采暖系统原理图',
      sheet: 'A2',
      scale: '示意图',
      content: {
        title: `${project.name} - 采暖系统原理图`,
        diagramType: '地暖/暖气片系统原理图',
        heatSource: {
          type: '燃气壁挂炉',
          power: '24-28kW',
          efficiency: '90%以上',
          components: ['燃烧器', '主换热器', '循环泵', '膨胀水箱']
        },
        distribution: {
          type: '地暖',
          manifolds: {
            count: design.rooms?.length || 4,
            location: '厨房/卫生间',
            features: ['流量计', '调节阀', '自动排气']
          }
        },
        circuits: (design.rooms || []).map((r, i) => ({
          circuit: i + 1,
          room: r.name,
          area: r.area,
          pipeLength: r.area * 5,
          flowRate: Math.round(r.area * 0.1 * 10) / 10
        })),
        workingPrinciple: [
          '1. 壁挂炉燃烧加热水至45-60°C',
          '2. 热水经分水器分配至各房间回路',
          '3. 热量通过地暖管向地面辐射',
          '4. 回水经集水器返回壁挂炉',
          '5. 膨胀水箱吸收系统水膨胀'
        ],
        technicalSpecs: {
          supplyTemp: '45-60°C',
          returnTemp: '35-45°C',
          pressureDrop: '<20kPa',
          pipeSpacing: '150-200mm'
        }
      }
    };
  }
  
  /**
   * 生成新风系统原理图 - 新增
   */
  generateFreshAirPrincipleDiagram(project, design) {
    return {
      type: 'fresh_air_principle_diagram',
      name: '新风系统原理图',
      sheet: 'A2',
      scale: '示意图',
      content: {
        title: `${project.name} - 新风系统原理图`,
        diagramType: '全热交换新风系统原理图',
        hostUnit: {
          type: '吊顶式全热交换机',
          airflow: '350m³/h',
          efficiency: '75%',
          components: ['送风机', '排风机', '热交换芯', '过滤器']
        },
        airflows: {
          outdoorAir: { path: '室外→主机→各房间', flow: '350m³/h', filtration: 'HEPA H13' },
          exhaustAir: { path: '厨卫→主机→室外', flow: '350m³/h', recovery: '热量回收75%' }
        },
        distribution: {
          mainDuct: { size: '200×200mm', material: '镀锌钢板', velocity: '<5m/s' },
          branchDucts: (design.rooms || []).map(r => ({
            room: r.name,
            size: 'Φ100-150mm',
            material: 'PE波纹管',
            diffuser: '150×150mm可调风口'
          }))
        },
        workingPrinciple: [
          '1. 室外新鲜空气经初效+HEPA过滤进入主机',
          '2. 排风经过滤网进入热交换芯',
          '3. 新风与排风在热交换芯进行热量交换',
          '4. 预热/预冷的新风送至各房间',
          '5. 排风带走室内污浊空气排出室外'
        ],
        technicalSpecs: {
          heatRecovery: '75%以上',
          noise: '<35dB(A)',
          filterGrade: 'HEPA H13',
          energySaving: '相比传统换气节能70%'
        }
      }
    };
  }
  
  /**
   * 生成管路走向图 - 新增
   */
  generatePipeRouting(project, design) {
    return {
      type: 'pipe_routing',
      name: '管路综合走向图',
      sheet: 'A2',
      scale: '1:100',
      content: {
        title: `${project.name} - 管路综合走向图`,
        description: '展示所有系统管路在建筑空间中的走向和安装位置',
        layers: {
          ceiling: {
            name: '吊顶层',
            systems: (design.systems || []).map(s => ({
              type: s,
              height: '2400-2600mm',
              routing: '沿梁底/吊顶内'
            }))
          },
          wall: {
            name: '墙体层',
            systems: [],
            routing: '竖向管井/墙内暗埋'
          },
          floor: {
            name: '地面层',
            systems: design.systems?.includes('heat') ? ['heating'] : [],
            routing: '地面下垫层内'
          }
        },
        routingPaths: (design.systems || []).map(s => ({
          system: s,
          path: this.calculateRoutingPath(s, project, design),
          clearances: this.calculateClearances(s),
          conflicts: []
        })),
        annotations: [
          '1. 所有管道沿建筑结构合理布置',
          '2. 管道交叉时遵循：风管>水管>电管',
          '3. 管道与结构保持安全距离',
          '4. 检修口位置需便于维护'
        ]
      }
    };
  }
  
  calculateRoutingPath(system, project, design) {
    const area = project.area || 120;
    // 简化的路径计算
    return [
      { x: 1000, y: 1000, z: 2500, type: '起点' },
      { x: area * 20, y: area * 15, z: 2500, type: '终点' }
    ];
  }
  
  calculateClearances(system) {
    const clearances = {
      ac: { min: 100, recommended: 150 },
      water: { min: 50, recommended: 80 },
      heat: { min: 0, recommended: 0 }, // 地暖无间隙要求
      fresh: { min: 80, recommended: 120 }
    };
    return clearances[system] || { min: 50, recommended: 80 };
  }
}

module.exports = DrawingEngine;
