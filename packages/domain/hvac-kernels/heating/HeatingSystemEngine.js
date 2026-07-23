/**
 * 采暖系统设计引擎 (Heating System Design Engine)
 * 负责地暖/暖气片系统的设计计算
 * 参考开源项目: SpiralFloorHeating, system-for-underfloor-heating
 */

class HeatingSystemEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'HeatingSystemEngine';
    
    // 采暖设计参数
    this.DESIGN_PARAMS = {
      indoorTemp: 20, // °C 室内设计温度
      supplyTemp: 45, // °C 供水温度
      returnTemp: 35, // °C 回水温度
      tempDiff: 10, // K 供回水温差
      floorResistance: 0.1 // m²K/W 地板热阻
    };
    
    // 单位面积热负荷 (W/m²)
    this.HEAT_LOAD_PER_AREA = {
      '住宅-节能': 40,
      '住宅-普通': 60,
      '住宅-老旧': 80,
      '商业-办公': 70,
      '商业-商场': 100
    };
    
    // 地暖管间距 (mm)
    this.PIPE_SPACING = {
      '外墙区': 150,
      '内墙区': 200,
      '中心区': 250
    };
  }

  /**
   * 主入口: 生成采暖系统设计方案
   */
  generateDesign(params) {
    const {
      houseType,      // 户型
      area,           // 建筑面积
      floorArea,      // 实际采暖面积
      floors,         // 楼层数
      insulation,     // 保温情况: '好', '中', '差'
      hasUnderfloor,  // 是否有地暖
      hasRadiator,    // 是否有暖气片
      heatSource,     // 热源: '燃气壁挂炉', '集中供暖', '热泵'
      city            // 城市
    } = params;

    console.log(`[HeatingSystemEngine] 开始设计: ${houseType} ${area}m²`);

    // 1. 计算热负荷
    const heatLoad = this.calculateHeatLoad(area, floorArea, insulation, city);
    
    // 2. 选择热源设备
    const heatSourceDesign = this.selectHeatSource(heatLoad, heatSource, houseType);
    
    // 3. 设计地暖系统 (如果有)
    const underfloorSystem = hasUnderfloor ? 
      this.designUnderfloorSystem(floorArea, heatLoad, houseType) : null;
    
    // 4. 设计暖气片系统 (如果有)
    const radiatorSystem = hasRadiator ?
      this.designRadiatorSystem(floorArea, heatLoad, houseType) : null;
    
    // 5. 设计混装系统 (如果都有)
    const hybridSystem = (hasUnderfloor && hasRadiator) ?
      this.designHybridSystem(underfloorSystem, radiatorSystem, heatLoad) : null;

    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      input: params,
      heatLoad,
      heatSource: heatSourceDesign,
      systems: {
        underfloor: underfloorSystem,
        radiator: radiatorSystem,
        hybrid: hybridSystem
      },
      control: this.designControlSystem(hasUnderfloor, hasRadiator),
      summary: this.generateSummary(heatLoad, heatSourceDesign, underfloorSystem, radiatorSystem)
    };
  }

  /**
   * 计算采暖热负荷
   * 简化算法: Q = q × A × f1 × f2 × f3
   * q: 单位面积热指标
   * A: 建筑面积
   * f1: 朝向修正
   * f2: 楼层修正
   * f3: 保温修正
   */
  calculateHeatLoad(area, floorArea, insulation, city) {
    // 基础热指标
    const baseLoad = this.HEAT_LOAD_PER_AREA['住宅-普通']; // 60 W/m²
    
    // 保温修正系数
    const insulationFactor = {
      '好': 0.8,
      '中': 1.0,
      '差': 1.3
    }[insulation] || 1.0;
    
    // 城市气候修正 (简化)
    const cityFactor = this.getCityClimateFactor(city);
    
    // 计算总热负荷
    const totalLoad = floorArea * baseLoad * insulationFactor * cityFactor;
    
    // 计算单位面积负荷
    const loadPerArea = totalLoad / floorArea;
    
    return {
      totalLoad: Math.round(totalLoad), // W
      loadPerArea: Math.round(loadPerArea), // W/m²
      floorArea,
      baseLoad,
      factors: {
        insulation: insulationFactor,
        city: cityFactor
      },
      estimated: true
    };
  }

  /**
   * 获取城市气候修正系数
   */
  getCityClimateFactor(city) {
    const cityFactors = {
      '北京': 1.0,
      '天津': 0.95,
      '上海': 0.85,
      '南京': 0.85,
      '杭州': 0.85,
      '武汉': 0.9,
      '西安': 1.05,
      '哈尔滨': 1.3,
      '长春': 1.25,
      '沈阳': 1.15,
      '大连': 1.0,
      '青岛': 0.95,
      '济南': 1.0,
      '郑州': 0.95,
      '石家庄': 1.05,
      '太原': 1.1,
      '兰州': 1.15,
      '银川': 1.2,
      '西宁': 1.25,
      '乌鲁木齐': 1.3,
      '成都': 0.8,
      '重庆': 0.75,
      '昆明': 0.65,
      '贵阳': 0.8,
      '南宁': 0.65,
      '广州': 0.6,
      '深圳': 0.55,
      '福州': 0.65,
      '厦门': 0.6,
      '海口': 0.5
    };
    return cityFactors[city] || 1.0;
  }

  /**
   * 选择热源设备
   */
  selectHeatSource(heatLoad, heatSourceType, houseType) {
    const { totalLoad } = heatLoad;
    const safetyFactor = 1.2; // 安全系数
    const requiredPower = (totalLoad / 1000) * safetyFactor; // kW
    
    if (heatSourceType === '燃气壁挂炉') {
      return this.selectGasBoiler(requiredPower, houseType);
    } else if (heatSourceType === '集中供暖') {
      return {
        type: '集中供暖',
        interface: '地暖混水中心或暖气片直接连接',
        notes: '需确认小区供暖压力和温度是否满足需求',
        estimatedCost: '5000-15000元 (接口设备)'
      };
    } else if (heatSourceType === '热泵') {
      return this.selectHeatPump(requiredPower, houseType);
    }
    
    return this.selectGasBoiler(requiredPower, houseType); // 默认
  }

  /**
   * 选择燃气壁挂炉
   */
  selectGasBoiler(requiredPower, houseType) {
    // 壁挂炉功率档次
    const boilerSizes = [
      { power: 18, range: '50-80m²' },
      { power: 24, range: '80-120m²' },
      { power: 28, range: '120-160m²' },
      { power: 32, range: '160-200m²' },
      { power: 36, range: '200-250m²' },
      { power: 40, range: '250m²以上' }
    ];
    
    const selected = boilerSizes.find(b => b.power >= requiredPower) || 
                     boilerSizes[boilerSizes.length - 1];
    
    return {
      type: '燃气壁挂炉',
      subtype: '系统炉(带热水)',
      power: `${selected.power} kW`,
      suitableRange: selected.range,
      efficiency: '一级能效(>95%)',
      brands: {
        '德系': ['博世', '威能', '菲斯曼'],
        '日系': ['林内', '能率'],
        '国产': ['海尔', '美的', '万家乐']
      },
      features: ['冷凝技术', '智能控制', '分段燃烧', 'WiFi连接'],
      estimatedPrice: '10000-30000元',
      notes: `计算热负荷: ${Math.round(requiredPower / 1.2)}kW × 1.2 = ${Math.round(requiredPower)}kW`
    };
  }

  /**
   * 选择热泵
   */
  selectHeatPump(requiredPower, houseType) {
    const heatPumpTypes = [
      { type: '空气源热泵', cop: 3.0, price: '20000-50000元', notes: '适合南方地区' },
      { type: '地源热泵', cop: 4.5, price: '80000-150000元', notes: '需打井,适合别墅' },
      { type: '水源热泵', cop: 4.0, price: '50000-100000元', notes: '需水源条件' }
    ];
    
    const recommended = heatPumpTypes[0]; // 默认推荐空气源
    
    return {
      type: '热泵',
      subtype: recommended.type,
      heatingPower: `${Math.ceil(requiredPower)} kW`,
      cop: recommended.cop,
      estimatedCOP: {
        '名义COP': recommended.cop,
        '冬季平均': recommended.cop * 0.8,
        '极端天气': recommended.cop * 0.6
      },
      brands: ['约克', '特灵', '麦克维尔', '格力', '美的'],
      estimatedPrice: recommended.price,
      notes: recommended.notes,
      runningCost: '约为燃气采暖的60-70%'
    };
  }

  /**
   * 设计地暖系统
   * 参考: SpiralFloorHeating算法
   */
  designUnderfloorSystem(floorArea, heatLoad, houseType) {
    const { loadPerArea, totalLoad } = heatLoad;
    
    // 1. 管路布局设计
    const pipeLayout = this.designPipeLayout(floorArea, houseType);
    
    // 2. 分水器选型
    const manifold = this.selectManifold(pipeLayout.circuits);
    
    // 3. 水力计算
    const hydraulic = this.calculateHydraulics(pipeLayout, totalLoad);
    
    // 4. 温度场分析
    const temperature = this.analyzeTemperature(loadPerArea);
    
    return {
      type: '地暖系统',
      coverage: Math.round(floorArea * 0.7), // 实际铺设面积约70%
      pipeLayout,
      manifold,
      hydraulic,
      temperature,
      materials: this.selectUnderfloorMaterials(),
      installation: this.generateInstallationNotes()
    };
  }

  /**
   * 设计管路布局
   * 使用螺旋算法
   */
  designPipeLayout(floorArea, houseType) {
    // 划分房间
    const rooms = this.divideRooms(floorArea, houseType);
    
    // 每个房间的回路设计
    const circuits = rooms.map(room => {
      const spacing = this.PIPE_SPACING[room.zoneType] || 200;
      const pipeLength = this.calculatePipeLength(room.area, spacing);
      
      return {
        room: room.name,
        area: room.area,
        spacing: `${spacing}mm`,
        pipeLength: Math.round(pipeLength),
        pipeDiameter: '16mm',
        turns: Math.ceil(pipeLength / (room.width * 2)), // 估算回路数
        pattern: '螺旋形', // 或 '回字形'
        heatOutput: Math.round(room.area * 60) // 假设60W/m²
      };
    });
    
    // 总管路长度
    const totalPipeLength = circuits.reduce((sum, c) => sum + c.pipeLength, 0);
    
    return {
      rooms,
      circuits,
      totalPipeLength,
      pipeDiameter: '16mm (PE-RT)',
      pipeMaterial: 'PE-RT或PE-Xa',
      estimatedLoops: circuits.length
    };
  }

  /**
   * 划分房间
   */
  divideRooms(floorArea, houseType) {
    const roomConfigs = {
      '一居': [
        { name: '客厅', area: floorArea * 0.35, width: 4, zoneType: '外墙区' },
        { name: '卧室', area: floorArea * 0.25, width: 3.5, zoneType: '外墙区' },
        { name: '厨房', area: floorArea * 0.15, width: 2.5, zoneType: '中心区' },
        { name: '卫生间', area: floorArea * 0.1, width: 2, zoneType: '中心区' }
      ],
      '二居': [
        { name: '客厅', area: floorArea * 0.3, width: 4.5, zoneType: '外墙区' },
        { name: '主卧', area: floorArea * 0.2, width: 3.8, zoneType: '外墙区' },
        { name: '次卧', area: floorArea * 0.15, width: 3.2, zoneType: '内墙区' },
        { name: '厨房', area: floorArea * 0.12, width: 2.8, zoneType: '中心区' },
        { name: '卫生间', area: floorArea * 0.08, width: 2.2, zoneType: '中心区' }
      ],
      '三居': [
        { name: '客厅', area: floorArea * 0.25, width: 5, zoneType: '外墙区' },
        { name: '主卧', area: floorArea * 0.18, width: 4, zoneType: '外墙区' },
        { name: '次卧1', area: floorArea * 0.12, width: 3.5, zoneType: '外墙区' },
        { name: '次卧2', area: floorArea * 0.12, width: 3.5, zoneType: '内墙区' },
        { name: '厨房', area: floorArea * 0.1, width: 3, zoneType: '中心区' },
        { name: '卫生间1', area: floorArea * 0.07, width: 2.5, zoneType: '中心区' },
        { name: '卫生间2', area: floorArea * 0.06, width: 2.2, zoneType: '中心区' }
      ],
      '四居': [
        { name: '客厅', area: floorArea * 0.22, width: 5.5, zoneType: '外墙区' },
        { name: '主卧', area: floorArea * 0.16, width: 4.5, zoneType: '外墙区' },
        { name: '次卧1', area: floorArea * 0.11, width: 3.8, zoneType: '外墙区' },
        { name: '次卧2', area: floorArea * 0.11, width: 3.8, zoneType: '内墙区' },
        { name: '书房', area: floorArea * 0.09, width: 3.2, zoneType: '内墙区' },
        { name: '厨房', area: floorArea * 0.09, width: 3.5, zoneType: '中心区' },
        { name: '卫生间1', area: floorArea * 0.06, width: 2.8, zoneType: '中心区' },
        { name: '卫生间2', area: floorArea * 0.06, width: 2.5, zoneType: '中心区' }
      ]
    };
    
    return roomConfigs[houseType] || roomConfigs['三居'];
  }

  /**
   * 计算管路长度 (螺旋算法)
   * L = A / (spacing × 0.001) + margin
   */
  calculatePipeLength(area, spacing) {
    const spacingM = spacing / 1000; // mm to m
    const baseLength = area / spacingM;
    const margin = 2 * Math.sqrt(area); // 余量 (连接部分)
    return baseLength + margin;
  }

  /**
   * 选择分水器
   */
  selectManifold(circuits) {
    const loopCount = circuits.length;
    
    return {
      type: '智能分水器',
      loops: loopCount,
      material: '黄铜镀镍',
      features: [
        '流量计显示',
        '电动调节阀',
        '温度传感器接口',
        '自动排气',
        '泄水功能'
      ],
      brands: ['卡莱菲', '嘉科米尼', '欧文托普', '曼瑞德'],
      estimatedPrice: `${1500 + loopCount * 300}元`,
      installation: '建议安装在厨房或卫生间吊顶内'
    };
  }

  /**
   * 水力计算
   */
  calculateHydraulics(pipeLayout, totalLoad) {
    const { totalPipeLength } = pipeLayout;
    const circuits = pipeLayout.circuits;
    
    // 计算流量需求
    // Q = P / (c × Δt)  c=4.187 kJ/(kg·K), Δt=10K
    const flowRate = (totalLoad / 1000) / (4.187 * 10) * 3600; // kg/h = L/h
    const flowPerCircuit = flowRate / circuits.length;
    
    // 估算压降 (简化)
    const pressureDropPerCircuit = 10; // kPa (假设)
    const totalPressureDrop = pressureDropPerCircuit * 1.5; // 考虑最不利回路
    
    return {
      totalFlowRate: `${Math.round(flowRate)} L/h`,
      flowPerCircuit: `${Math.round(flowPerCircuit)} L/h`,
      flowPerCircuitLs: `${(flowPerCircuit / 3600).toFixed(3)} L/s`,
      pressureDrop: `${totalPressureDrop} kPa`,
      pumpHead: `${totalPressureDrop + 20} kPa`, // 加余量
      circulationPump: {
        type: '屏蔽式循环泵',
        power: '60-100W',
        speed: '3档可调',
        brands: ['格兰富', '威乐', '新沪']
      }
    };
  }

  /**
   * 温度场分析
   */
  analyzeTemperature(loadPerArea) {
    // 地表温度计算
    // 经验: 负荷60W/m²时,地表温度约28-29°C
    const floorSurfaceTemp = 20 + (loadPerArea / 60) * 9; // °C
    
    return {
      floorSurfaceTemp: `${Math.round(floorSurfaceTemp)}°C`,
      supplyTemp: `${this.DESIGN_PARAMS.supplyTemp}°C`,
      returnTemp: `${this.DESIGN_PARAMS.returnTemp}°C`,
      meanTemp: `${(this.DESIGN_PARAMS.supplyTemp + this.DESIGN_PARAMS.returnTemp) / 2}°C`,
      tempDiff: `${this.DESIGN_PARAMS.tempDiff}K`,
      notes: '地表温度应在29°C以下，确保舒适性'
    };
  }

  /**
   * 选择地暖材料
   */
  selectUnderfloorMaterials() {
    return {
      pipe: {
        material: 'PE-RT或PE-Xa',
        diameter: '16mm × 2.0mm',
        brands: ['瑞好', '乔治费歇尔', '伟星', '日丰'],
        lifespan: '50年'
      },
      insulation: {
        material: 'XPS挤塑板',
        thickness: '20-30mm',
        density: '≥35kg/m³',
        brands: ['陶氏', '欧文斯科宁', '国产优质']
      },
      reflectiveFilm: {
        material: '镜面铝箔',
        thickness: '0.2mm',
        function: '反射热量向上'
      },
      manifold: {
        material: '黄铜',
        features: ['流量计', '调节阀']
      }
    };
  }

  /**
   * 生成安装说明
   */
  generateInstallationNotes() {
    return {
      steps: [
        '清理地面，铺设保温板',
        '铺设反射膜',
        '安装分水器',
        '盘管铺设（螺旋形）',
        '固定管路（卡钉固定）',
        '压力测试（0.6MPa，24小时）',
        '浇筑混凝土垫层',
        '养护（7天以上）'
      ],
      keyPoints: [
        '避免管路交叉重叠',
        '每个回路长度控制在60-80m',
        '外墙区加密铺设',
        '门槛处设伸缩缝'
      ],
      estimatedTime: '3-5天',
      estimatedCost: '150-250元/m²'
    };
  }

  /**
   * 设计暖气片系统
   */
  designRadiatorSystem(floorArea, heatLoad, houseType) {
    const { loadPerArea, totalLoad } = heatLoad;
    const rooms = this.divideRooms(floorArea, houseType);
    
    // 为每个房间设计暖气片
    const radiators = rooms
      .filter(r => r.name.includes('卧') || r.name.includes('客') || r.name.includes('书'))
      .map(room => {
        const roomLoad = room.area * loadPerArea * 1.1; // 10%余量
        const radiator = this.selectRadiator(roomLoad, room.name);
        
        return {
          room: room.name,
          heatLoad: `${Math.round(roomLoad)} W`,
          ...radiator,
          position: this.suggestRadiatorPosition(room.name)
        };
      });
    
    // 计算总散热片数
    const totalSections = radiators.reduce((sum, r) => sum + r.sections, 0);
    
    return {
      type: '暖气片系统',
      radiators,
      totalSections,
      totalHeatOutput: radiators.reduce((sum, r) => sum + parseInt(r.heatOutput), 0),
      pipeSystem: this.designRadiatorPiping(radiators.length),
      estimatedCost: `${totalSections * 80 + radiators.length * 500}元`
    };
  }

  /**
   * 选择暖气片
   */
  selectRadiator(heatLoad, roomName) {
    // 暖气片散热功率 (标准工况: 供75/回65/室温20)
    const sectionPower = 150; // W/片 (600mm高)
    const sections = Math.ceil(heatLoad / sectionPower);
    
    // 实际工况修正 (供55/回45/室温20)
    const actualPower = sectionPower * 0.6; // 低温工况修正
    const actualSections = Math.ceil(heatLoad / actualPower);
    
    return {
      type: '钢制板式散热器',
      height: '600mm',
      sections: actualSections,
      heatOutput: `${actualSections * actualPower} W`,
      brands: ['森德', '意乐', 'HM', '努奥罗'],
      connection: '底进底出',
      valves: ['温控阀', '截止阀', '排气阀'],
      estimatedPrice: `${actualSections * 80}元`
    };
  }

  /**
   * 建议安装位置
   */
  suggestRadiatorPosition(roomName) {
    const positions = {
      '客厅': '窗户下方或外墙内侧',
      '主卧': '窗户下方',
      '次卧': '窗户下方或门旁边',
      '书房': '外墙内侧'
    };
    return positions[roomName] || '窗户下方';
  }

  /**
   * 设计暖气片管路系统
   */
  designRadiatorPiping(radiatorCount) {
    return {
      system: '双管异程式',
      pipes: {
        supply: 'PP-R DN25',
        return: 'PP-R DN25',
        branches: 'PP-R DN20'
      },
      balancing: '每组装平衡阀',
      estimatedLength: `${radiatorCount * 15}m`
    };
  }

  /**
   * 设计混装系统控制
   */
  designHybridSystem(underfloor, radiator, heatLoad) {
    return {
      type: '地暖+暖气片混装',
      zoning: {
        underfloor: '客厅、卧室',
        radiator: '卫生间、厨房、书房'
      },
      control: {
        type: '分区温控',
        zones: [
          { name: '地暖区', temp: '20°C', actuator: '电热执行器' },
          { name: '暖气区', temp: '22°C', actuator: '温控阀' }
        ],
        central: '智能壁挂炉联动'
      },
      notes: '地暖供水45°C，暖气片需55-60°C，需混水中心'
    };
  }

  /**
   * 设计控制系统
   */
  designControlSystem(hasUnderfloor, hasRadiator) {
    const controls = [];
    
    if (hasUnderfloor) {
      controls.push({
        type: '地暖温控',
        components: ['分水器', '温控面板', '电热执行器'],
        features: ['分室控制', '周编程', 'APP控制'],
        brands: ['曼瑞德', '卡莱菲', '国产智能']
      });
    }
    
    if (hasRadiator) {
      controls.push({
        type: '暖气温控',
        components: ['温控阀', '恒温阀头'],
        features: ['自动恒温', '节能20-30%'],
        brands: ['丹佛斯', '卡莱菲', '国产']
      });
    }
    
    controls.push({
      type: '壁挂炉控制',
      components: ['室内温控器', '室外传感器'],
      features: ['气候补偿', '远程控制', '故障诊断'],
      brands: ['原厂配套', '第三方智能']
    });
    
    return controls;
  }

  /**
   * 生成设计摘要
   */
  generateSummary(heatLoad, heatSource, underfloor, radiator) {
    return {
      totalHeatLoad: `${heatLoad.totalLoad} W`,
      heatSource: heatSource.type,
      systems: [],
      estimatedInvestment: 0,
      estimatedAnnualCost: 0
    };
  }

  /**
   * 健康检查
   */
  healthCheck() {
    return {
      status: 'ok',
      version: this.version,
      name: this.name,
      timestamp: new Date().toISOString()
    };
  }
}

// 导出
module.exports = { HeatingSystemEngine };
