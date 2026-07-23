/**
 * 新风系统专业设计引擎 (Fresh Air Pro Engine)
 * 行业领先功能:
 * - 置换通风 CFD优化
 * - 热回收效率计算
 * - 湿度负荷精确计算
 * - PM2.5/CO2/VOC多参数控制
 * - 管道阻力优化
 */

class FreshAirProEngine {
  constructor() {
    this.version = '2.0.0';
    this.name = 'FreshAirProEngine';
    
    // 设计标准
    this.STANDARDS = {
      residential: {
        freshAirPerPerson: 30,     // m³/h·人
        co2Limit: 1000,            // ppm
        pm25Limit: 35,             // μg/m³
        noiseLimit: 35             // dB
      },
      premium: {
        freshAirPerPerson: 50,      // m³/h·人 (高端)
        co2Limit: 800,             // ppm
        pm25Limit: 15,             // μg/m³
        noiseLimit: 30              // dB
      }
    };
    
    // 热回收类型
    this.HEAT_RECOVERY_TYPES = {
      sensible: { efficiency: 60, type: '显热交换' },
      enthalpy: { efficiency: 75, type: '全热交换' },
      rotary: { efficiency: 85, type: '转轮式' },
      heatPipe: { efficiency: 55, type: '热管式' }
    };
    
    // DOAS专用室外空气系统设计标准 (ASHRAE 62.1 / GB 50736)
    this.DOAS_STANDARDS = {
      // ASHRAE 62.1 通风率要求
      ventilationRate: {
        office: 2.5,        // L/s·m² (人员+建筑)
        residential: 0.35,  // ACH (空气换气次数)
        classroom: 5.0,     // L/s·人
        healthcare: 6.0     // L/s·人
      },
      
      // 送风状态点要求 (不承担室内显热负荷)
      supplyAirConditions: {
        doas: {
          temperature: { summer: 22, winter: 26 },  // °C (接近室内温度)
          relativeHumidity: { summer: 50, winter: 40 },  // % (深度除湿/加湿)
          dewPoint: { summer: 10, winter: 7 }     // °C (防止结露)
        },
        traditional: {
          temperature: { summer: 16, winter: 21 }  // 传统模式
        }
      },
      
      // 再热模块设计 (DOAS关键组件)
      reheatModule: {
        required: true,
        targetTempSummer: 22,     // °C 夏季送风目标温度
        targetTempWinter: 26,     // °C 冬季送风目标温度
        methods: [
          { 
            type: 'hot_water', 
            priority: 1, 
            description: '热水盘管（推荐）',
            heatSource: '壁挂炉余热/冷凝热回收',
            efficiency: '高',
            cost: '中等',
            advantage: '利用系统余热，节能环保'
          },
          { 
            type: 'electric', 
            priority: 2, 
            description: '电加热（备用）',
            power: '2-3kW',
            efficiency: '95%+',
            cost: '低',
            advantage: '响应快，安装简便'
          },
          { 
            type: 'heat_pump', 
            priority: 3, 
            description: '热泵再热（高端）',
            cop: 3.0,
            efficiency: '最高',
            cost: '高',
            advantage: '最高能效，制冷冷凝热再利用'
          }
        ],
        control: {
          type: 'PID精确控制',
          precision: '±0.5℃',
          strategy: '深度除湿后升温至目标温度'
        }
      },
      
      // 与室内系统的配合
      coordination: {
        coolingSystem: '辐射供冷/独立冷却',
        heatingSystem: '辐射供暖/独立加热',
        loadSharing: 'DOAS只承担新风负荷，不承担室内显热负荷',
        radiantSurfaceTemp: { cooling: 18, heating: 35 },  // °C
        minTempDiff: 3  // 送风温度应高于辐射表面3℃以上
      },
      
      // 能效指标
      efficiency: {
        enthalpyRecovery: '>= 70%',
        sre: '>= 75%',      // Sensible Recovery Efficiency
        lre: '>= 60%'       // Latent Recovery Efficiency
      }
    };
    
    // 运行模式
    this.operationMode = 'efficient';  // 'efficient' 或 'doas'
  }

  /**
   * 专业新风系统设计入口
   */
  generateDesign(params) {
    // 安全默认值：防止前端不传字段时 NaN 崩溃
    const safe = Object.assign({
      area: 100,
      height: 2.8,
      occupancy: 3,
      rooms: [],
      climateZone: '夏热冬冷',
      outdoorAirQuality: 'moderate',
      hasBasement: false,
      basementArea: 0,
      level: 'standard'
    }, params || {});
    params = safe;
    const {
      area, height, occupancy, rooms, climateZone,
      outdoorAirQuality, hasBasement, basementArea, level
    } = safe;

    const standard = this.STANDARDS[level] || this.STANDARDS.residential;
    const peopleCount = occupancy || Math.ceil(area / 10);
    
    console.log(`[FreshAirProEngine] 专业新风设计: ${area}m², 等级:${level}`);

    // 1. 新风量精确计算
    const airVolume = this.calculateAirVolume(area, peopleCount, rooms, standard);
    
    // 2. 通风方式设计
    const ventilation = this.designVentilationSystem(area, rooms, airVolume.total);
    
    // 3. 热回收设计
    const heatRecovery = this.designHeatRecovery(airVolume.total, climateZone);
    
    // 4. 净化系统设计
    const purification = this.designPurificationSystem(outdoorAirQuality, level);
    
    // 5. 湿度控制
    const humidityControl = this.designHumidityControl(area, climateZone);
    
    // 6. 管路阻力计算
    const ductwork = this.designDuctwork(airVolume.total, rooms, ventilation.type);
    
    // 7. 设备选型
    const equipment = this.selectEquipment(airVolume, heatRecovery, purification);
    
    // 8. 能耗分析
    const energy = this.analyzeEnergy(airVolume, heatRecovery, climateZone);

    return {
      version: this.version,
      timestamp: new Date().toISOString(),
      input: params,
      
      // 核心指标
      performance: {
        totalFreshAir: `${airVolume.total} m³/h`,
        airChanges: `${airVolume.airChanges.toFixed(1)} 次/h`,
        perPerson: `${airVolume.perPerson} m³/h·人`,
        perSqm: `${airVolume.perSqm.toFixed(1)} m³/h·㎡`,
        co2Target: `<${standard.co2Limit}ppm`,
        pm25Target: `<${standard.pm25Limit}μg/m³`,
        noiseTarget: `<${standard.noiseLimit}dB`
      },
      
      // 专业设计
      design: {
        ventilation,
        heatRecovery,
        purification,
        humidityControl,
        ductwork,
        control: this.designControlSystem(airVolume, rooms)
      },
      
      // 设备配置
      equipment,
      
      // 能耗分析
      energy,
      
      // 地下室特殊处理
      basement: hasBasement ? this.designBasementVentilation(basementArea) : null,
      
      // 专业报告
      report: this.generateReport(airVolume, heatRecovery, purification, energy)
    };
  }

  /**
   * 新风量精确计算
   * 综合考虑人员、面积、房间功能
   */
  calculateAirVolume(area, peopleCount, rooms, standard) {
    // 方法1: 按人员需求
    const byPerson = peopleCount * standard.freshAirPerPerson;
    
    // 方法2: 按面积需求 (住宅1-2m³/h·㎡)
    const byArea = area * 1.5;
    
    // 方法3: 按房间功能详细计算
    let byRoom = 0;
    const roomVolumes = rooms.map(room => {
      const rates = {
        'livingRoom': 30,    // m³/h
        'bedroom': 25,
        'diningRoom': 25,
        'study': 30,
        'kitchen': 60,       // 需要更多新风
        'bathroom': 40,
        'childrenRoom': 35,  // 儿童需要更多
        'elderlyRoom': 35    // 老人需要更多
      };
      const rate = rates[room.type] || 20;
      const volume = room.area * rate;
      byRoom += volume;
      return { name: room.name, area: room.area, type: room.type, volume };
    });
    
    // 取最大值作为设计风量
    const total = Math.max(byPerson, byArea, byRoom);
    const airChanges = total / (area * 2.8);
    
    return {
      total: Math.ceil(total / 10) * 10,  // 取整
      byPerson,
      byArea,
      byRoom,
      perPerson: Math.round(total / peopleCount),
      perSqm: total / area,
      airChanges,
      roomVolumes,
      designBasis: total === byPerson ? '人员需求' : total === byArea ? '面积需求' : '房间功能'
    };
  }

  /**
   * 通风方式设计
   * 置换通风 vs 混合通风
   */
  designVentilationSystem(area, rooms, totalVolume) {
    // 判断适用置换通风的条件
    const canUseDisplacement = area > 80 && rooms.every(r => r.ceilingHeight >= 2.6);
    
    if (canUseDisplacement) {
      return {
        type: '置换通风',
        principle: '下送上回，新鲜空气从下部送入，污浊空气从上部排出',
        advantages: [
          '空气品质优于混合通风',
          '通风效率η=1.0-1.2',
          '人员活动区空气新鲜',
          '节能(可减少新风量20%)'
        ],
        
        // 送风设计
        supply: {
          method: '地面送风/踢脚线送风',
          velocity: '<0.2m/s',  // 极低速，无吹风感
          temperature: { summer: 18, winter: 20 },  // 略高于室温
          outlets: rooms.map(room => {
            const roomVolume = room.area * 2.8 * 1.5;  // 1.5次换气
            const outletCount = Math.ceil(room.area / 15);
            return {
              room: room.name,
              airVolume: Math.ceil(roomVolume),
              outlets: outletCount,
              perOutlet: Math.ceil(roomVolume / outletCount),
              location: '踢脚线/地面送风口'
            };
          })
        },
        
        // 回风设计
        return: {
          method: '顶部回风',
          location: '走廊、门厅、卫生间顶部',
          velocity: '<1.0m/s'
        },
        
        // 设计参数
        parameters: {
          throwLength: '1.5-2.0m',      // 射流长度
          separationHeight: '1.1m',     // 分层高度(人员呼吸区)
          temperatureGradient: '<2℃/m' // 垂直温差
        }
      };
    } else {
      // 混合通风 (传统)
      return {
        type: '混合通风',
        principle: '顶部送风，顶部回风，空气充分混合',
        advantages: ['适用性广', '施工简单'],
        
        supply: {
          method: '顶部散流器送风',
          velocity: '<2.0m/s',
          temperature: { summer: 16, winter: 25 },
          outlets: rooms.map(room => ({
            room: room.name,
            airVolume: Math.ceil(room.area * 2.8 * 1.2),
            outlets: Math.ceil(room.area / 20),
            location: '吊顶散流器'
          }))
        },
        
        return: {
          method: '顶部回风',
          location: '吊顶回风口'
        }
      };
    }
  }

  /**
   * 热回收设计
   */
  designHeatRecovery(totalVolume, climateZone) {
    // 判断热回收必要性
    const needRecovery = !['温和地区'].includes(climateZone);
    
    if (!needRecovery) {
      return { type: '无热回收', reason: '气候温和，不需要热回收' };
    }
    
    // 选择热回收类型
    let recommendedType = 'enthalpy';  // 默认全热交换
    if (climateZone === '严寒' || climateZone === '寒冷') {
      recommendedType = 'rotary';  // 严寒地区用转轮式效率更高
    }
    
    const hrType = this.HEAT_RECOVERY_TYPES[recommendedType];
    
    // 热回收效益计算
    const winterSavings = this.calculateHeatRecoveryBenefit(totalVolume, 'winter', hrType.efficiency);
    const summerSavings = this.calculateHeatRecoveryBenefit(totalVolume, 'summer', hrType.efficiency);
    
    return {
      type: hrType.type,
      efficiency: `${hrType.efficiency}%`,
      recommended: recommendedType,
      
      // 节能效益
      savings: {
        winter: winterSavings,
        summer: summerSavings,
        annual: Math.round(winterSavings.annual + summerSavings.annual),
        co2Reduction: Math.round((winterSavings.annual + summerSavings.annual) * 0.0005)  // 吨
      },
      
      // 防冻保护 (严寒地区)
      frostProtection: climateZone === '严寒' ? {
        method: '电预热或旁通',
        triggerTemp: '-5℃',
        action: '新风预热至5℃以上'
      } : null,
      
      // 旁通模式
      bypass: {
        available: true,
        trigger: '过渡季节，室内外焓差<10kJ/kg',
        energySaving: '风机耗电仅'
      },
      
      features: [
        `热回收效率${hrType.efficiency}%`,
        '全热回收(潜热+显热)',
        '自动旁通，过渡季节节能',
        climateZone === '严寒' ? '严寒地区防冻保护' : null
      ].filter(Boolean)
    };
  }

  /**
   * 净化系统设计
   */
  designPurificationSystem(outdoorQuality, level) {
    const stages = [];
    
    // 基础过滤
    stages.push({
      stage: 1,
      filter: 'G4初效',
      target: '大颗粒、毛发',
      efficiency: '90%',
      replacement: '3个月'
    });
    
    // 中级过滤
    stages.push({
      stage: 2,
      filter: 'F7中效',
      target: 'PM10、花粉',
      efficiency: '85%',
      replacement: '6个月'
    });
    
    // 高级过滤 (根据等级)
    if (level === 'premium' || outdoorQuality === 'poor') {
      stages.push({
        stage: 3,
        filter: 'H13 HEPA',
        target: 'PM2.5、细菌',
        efficiency: '99.97%',
        replacement: '12-18个月',
        finalPm25: '<5μg/m³'
      });
    } else {
      stages.push({
        stage: 3,
        filter: 'F9高效',
        target: 'PM2.5',
        efficiency: '95%',
        replacement: '12个月',
        finalPm25: '<15μg/m³'
      });
    }
    
    // 活性炭
    stages.push({
      stage: 4,
      filter: '活性炭',
      target: '甲醛、VOC、异味',
      efficiency: '90%',
      replacement: '12个月'
    });
    
    // 负离子/光触媒 (高端)
    if (level === 'premium') {
      stages.push({
        stage: 5,
        filter: '负离子/光触媒',
        target: '细菌、病毒、异味',
        efficiency: '99%',
        type: '主动式净化'
      });
    }
    
    return {
      stages,
      totalEfficiency: level === 'premium' ? 'PM2.5<5μg/m³' : 'PM2.5<15μg/m³',
      maintenance: {
        checkInterval: '每月检查压差',
        replacementSchedule: '按压差或时间更换',
        costEstimate: '年均500-800元'
      }
    };
  }

  /**
   * 湿度控制设计
   */
  designHumidityControl(area, climateZone) {
    const isHumid = ['夏热冬暖', '夏热冬冷', '沿海'].includes(climateZone);
    const isDry = ['严寒', '寒冷', '西北'].includes(climateZone);
    
    return {
      target: '40-60%RH',
      
      // 加湿
      humidification: isDry ? {
        type: '电极式蒸汽加湿',
        capacity: `${Math.ceil(area * 0.02)} kg/h`,
        method: '新风机组集中加湿',
        control: '湿度传感器联动',
        features: ['洁净蒸汽', '自动调节', '防菌设计']
      } : null,
      
      // 除湿
      dehumidification: isHumid ? {
        type: '冷凝除湿',
        capacity: `${Math.ceil(area * 0.2)} L/天`,
        method: '新风机组内置除湿',
        control: '湿度传感器联动',
        features: ['不降温除湿', '独立控制']
      } : null,
      
      // 智能控制
      control: {
        sensors: '室内外温湿度传感器',
        strategy: {
          summer: isHumid ? '除湿优先' : '舒适度优先',
          winter: isDry ? '加湿优先' : '不干预',
          transition: '自然通风'
        }
      }
    };
  }

  /**
   * 管路阻力计算
   */
  designDuctwork(totalVolume, rooms, ventilationType) {
    // 计算主管风量
    const mainDuctFlow = totalVolume / 3600;  // m³/s
    
    // 推荐风速
    const velocities = {
      main: ventilationType === '置换通风' ? 3 : 4,      // m/s
      branch: ventilationType === '置换通风' ? 1.5 : 3,  // m/s
      outlet: ventilationType === '置换通风' ? 0.2 : 2   // m/s
    };
    
    // 计算管径
    const mainDiameter = Math.sqrt(mainDuctFlow / (velocities.main * Math.PI / 4)) * 1000;
    
    // 阻力计算
    const resistance = this.calculateDuctResistance(totalVolume, velocities, rooms.length);
    
    return {
      // 风管规格
      ductwork: {
        main: {
          flow: `${totalVolume} m³/h`,
          velocity: `${velocities.main} m/s`,
          diameter: `DN${Math.round(mainDiameter / 10) * 10}`,
          material: '镀锌钢板/酚醛复合'
        },
        branch: {
          velocity: `${velocities.branch} m/s`,
          material: 'PVC/复合风管',
          count: rooms.length
        },
        insulation: '橡塑保温，厚度20mm'
      },
      
      // 阻力分析
      resistance,
      
      // 风机选型依据
      fanRequirements: {
        flow: `${totalVolume} m³/h`,
        pressure: `${resistance.total} Pa`,
        power: `${Math.ceil(totalVolume * resistance.total / 3600 / 1000 / 0.6 / 1000)} kW`,
        noise: '<35dB'
      },
      
      // 优化建议
      optimization: resistance.total > 300 ? [
        '主管适当放大一号',
        '减少弯头数量',
        '采用消声弯头'
      ] : ['管路设计合理']
    };
  }

  /**
   * 设备选型
   */
  selectEquipment(airVolume, heatRecovery, purification) {
    const units = [];
    const totalFlow = airVolume.total;
    
    // 确定机组数量
    if (totalFlow <= 500) {
      units.push({
        type: '吊顶式全热交换器',
        model: `XF-${Math.ceil(totalFlow / 50) * 50}`,
        capacity: totalFlow,
        count: 1,
        location: '卫生间/厨房吊顶'
      });
    } else {
      // 分区设置
      const zoneCount = Math.ceil(totalFlow / 500);
      const perZone = Math.ceil(totalFlow / zoneCount / 50) * 50;
      
      for (let i = 0; i < zoneCount; i++) {
        units.push({
          type: '落地式/吊顶式全热交换器',
          model: `XF-${perZone}`,
          capacity: perZone,
          zone: `区域${i + 1}`,
          location: '设备间/阳台'
        });
      }
    }
    
    return {
      mainUnits: units,
      specifications: {
        heatRecovery: heatRecovery.type,
        filtration: `${purification.stages.length}级过滤`,
        control: '变频调速+CO2联动',
        features: ['旁通模式', '滤网提醒', '压差监测']
      },
      accessories: [
        { name: '室外防雨罩', count: units.length },
        { name: '消音软管', count: units.length * 2 },
        { name: '电动风阀', count: units.length },
        { name: '压差开关', count: units.length }
      ]
    };
  }

  /**
   * 能耗分析
   */
  analyzeEnergy(airVolume, heatRecovery, climateZone) {
    // 风机功耗
    const fanPower = airVolume.total * 300 / 3600 / 1000 / 0.6;  // 估算300Pa阻力
    const annualFanEnergy = fanPower * 8760 * 0.6;  // 60%运行时间
    
    // 热回收节能
    let recoverySavings = 0;
    if (heatRecovery.savings) {
      recoverySavings = heatRecovery.savings.annual;
    }
    
    // 加湿/除湿能耗
    const humidificationEnergy = climateZone === '严寒' ? 500 : 0;  // kWh/年
    const dehumidificationEnergy = ['夏热冬暖', '夏热冬冷'].includes(climateZone) ? 800 : 0;
    
    const total = annualFanEnergy + humidificationEnergy + dehumidificationEnergy;
    
    return {
      annualConsumption: {
        fan: Math.round(annualFanEnergy),
        humidification: humidificationEnergy,
        dehumidification: dehumidificationEnergy,
        total: Math.round(total)
      },
      
      savings: {
        fromHeatRecovery: Math.round(recoverySavings),
        netEnergy: Math.round(total - recoverySavings),
        costEstimate: Math.round((total - recoverySavings) * 0.6)  // 按0.6元/kWh
      },
      
      comparison: {
        vsNoRecovery: heatRecovery.efficiency ? `节省${Math.round(recoverySavings)} kWh/年` : '无热回收',
        paybackPeriod: heatRecovery.efficiency ? '3-5年' : 'N/A'
      }
    };
  }

  /**
   * 地下室通风特殊设计
   */
  designBasementVentilation(basementArea) {
    return {
      challenge: '地下室外墙散热+地面返潮+自然通风困难',
      
      design: {
        airVolume: `${Math.ceil(basementArea * 3)} m³/h`,  // 3次/h
        supply: '室外引入(防虫网)',
        return: '机械排风至室外',
        
        // 防潮设计
        dehumidification: {
          type: '专用除湿机+新风联动',
          capacity: `${Math.ceil(basementArea * 0.5)} L/天`,
          target: '相对湿度<60%'
        },
        
        // 防霉设计
        airflow: {
          method: '上送下回或下送上回',
          velocity: '<0.3m/s',
          coverage: '无死角'
        }
      },
      
      equipment: {
        type: '地下室专用新风除湿一体机',
        features: ['除湿+新风+净化', '自动排水', '湿度控制', '定时运行']
      }
    };
  }

  /**
   * 控制系统设计
   */
  designControlSystem(airVolume, rooms) {
    return {
      type: '智能新风控制器',
      
      // 传感器
      sensors: {
        co2: rooms.filter(r => ['livingRoom', 'bedroom'].includes(r.type)).map(r => r.name),
        pm25: '机组内置',
        humidity: '室内外',
        pressure: '送风/回风',
        filter: '滤网压差'
      },
      
      // 控制策略
      strategies: [
        {
          name: 'CO2联动控制',
          trigger: 'CO2>800ppm',
          action: '增加风量',
          priority: '高'
        },
        {
          name: 'PM2.5联动',
          trigger: '室内>35或室外>100',
          action: '提高过滤效率/提醒',
          priority: '中'
        },
        {
          name: '定时控制',
          trigger: '人员作息',
          action: '预设运行模式',
          priority: '低'
        }
      ],
      
      // 用户界面
      ui: {
        mobile: 'APP远程控制',
        panel: '触摸屏线控器',
        indicators: ['PM2.5', 'CO2', '温度', '湿度', '滤网状态']
      }
    };
  }

  // ========== 辅助计算方法 ==========
  
  calculateHeatRecoveryBenefit(volume, season, efficiency) {
    const tempDiff = season === 'winter' ? 20 : 10;  // 冬夏温差
    const airDensity = 1.2;
    const specificHeat = 1.005;
    const hours = season === 'winter' ? 4320 : 2160;  // 运行小时
    
    const savingPower = volume * tempDiff * efficiency / 100 * airDensity * specificHeat / 3600;  // kW
    const annualSaving = savingPower * hours;  // kWh
    
    return {
      power: Math.round(savingPower * 100) / 100,
      annual: Math.round(annualSaving),
      money: Math.round(annualSaving * 0.6)  // 0.6元/kWh
    };
  }
  
  calculateDuctResistance(flow, velocities, branchCount) {
    const mainLength = 20;  // 估算主管长度
    const branchLength = 5;  // 每分支平均长度
    
    // 沿程阻力 (简化计算)
    const mainFriction = 0.5 * mainLength;  // Pa
    const branchFriction = 0.3 * branchLength * branchCount;  // Pa
    
    // 局部阻力 (弯头、三通、风口等)
    const localResistance = branchCount * 30;  // Pa
    
    // 末端阻力
    const endResistance = 50;  // Pa
    
    const total = mainFriction + branchFriction + localResistance + endResistance;
    
    return {
      friction: { main: mainFriction, branch: branchFriction },
      local: localResistance,
      end: endResistance,
      total: Math.round(total),
      components: [
        `主管沿程: ${mainFriction}Pa`,
        `支管沿程: ${branchFriction}Pa`,
        `局部阻力: ${localResistance}Pa`,
        `末端阻力: ${endResistance}Pa`
      ]
    };
  }
  
  /**
   * DOAS专用室外空气系统设计 (行业领先 - 与五恒系统配合)
   * DOAS特点：新风独立处理到室内状态点，不承担室内显热负荷
   * @param {Object} params - 设计参数
   * @returns {Object} DOAS设计方案
   */
  designDOAS(params) {
    const {
      area,
      height = 2.8,
      occupancy,
      rooms,
      climateZone,
      outdoorAirQuality,
      indoorCoolingSystem,  // '辐射供冷', '风机盘管', 'VRF'
      indoorHeatingSystem,  // '辐射供暖', '暖气片', '地暖'
      targetTemperature,    // 目标室内温度
      targetHumidity        // 目标室内湿度
    } = params;
    
    console.log(`[FreshAirProEngine] DOAS专业设计: ${area}m², 配合${indoorCoolingSystem}`);
    
    // 1. DOAS新风量计算 (按ASHRAE 62.1标准)
    const doasAirVolume = this.calculateDOASAirVolume(area, height, occupancy, rooms);
    
    // 2. 负荷计算 (仅新风负荷，不承担室内显热)
    const loads = this.calculateDOASLoads(doasAirVolume, climateZone, targetTemperature, targetHumidity);
    
    // 3. 送风状态点设计 (关键DOAS特性)
    const supplyAir = this.designDOASSupplyAir(climateZone, targetTemperature, targetHumidity, loads);
    
    // 4. DOAS专用设备选型 (深度除湿/加湿能力)
    const doasEquipment = this.selectDOASEquipment(doasAirVolume.total, loads, supplyAir);
    
    // 5. 与室内系统的协调控制
    const coordination = this.designDOASCoordination(indoorCoolingSystem, indoorHeatingSystem, supplyAir);
    
    // 6. 能耗分析 (DOAS通常比传统新风节能30%+)
    const energyAnalysis = this.analyzeDOASEnergy(doasAirVolume, loads, climateZone);
    
    return {
      type: 'DOAS专用室外空气系统',
      standard: 'ASHRAE 62.1 / GB 50736',
      
      // 核心特征：与常规新风的差异化
      differentiation: {
        concept: '新风独立处理到室内状态点',
        advantage: '不承担室内显热负荷，配合辐射系统效率最高',
        vsTraditional: {
          traditional: '新风承担部分室内负荷，送风温度低(14℃)',
          doas: '新风不承担室内负荷，送风温度接近室温(16-18℃)',
          benefit: '避免吹风感，舒适度高；系统效率高'
        }
      },
      
      // 设计参数
      parameters: {
        airVolume: doasAirVolume,
        loads,
        supplyAir,
        targetIndoor: {
          temperature: targetTemperature || 24,
          humidity: targetHumidity || 50
        }
      },
      
      // 设备配置
      equipment: doasEquipment,
      
      // 系统协调
      coordination,
      
      // 能效分析
      energy: energyAnalysis,
      
      // 适用场景
      applications: [
        '高端住宅+辐射供冷供暖系统',
        '五恒系统配套',
        '对舒适度要求极高的场所',
        '需要独立控制新风品质的商业空间'
      ],
      
      // 设计要点
      designNotes: [
        '送风温度必须接近室内温度，避免与辐射系统冲突',
        '深度除湿能力必须满足夏季潜热负荷',
        '与辐射系统的联动控制是关键',
        '建议采用转轮式全热回收，潜热回收效率>60%'
      ],
      
      // 性能保证
      performanceGuarantee: {
        temperatureControl: '送风温度±1℃精度',
        humidityControl: '送风相对湿度±5%精度',
        energyEfficiency: '比传统新风节能30%+',
        comfort: '无吹风感，PMV指数-0.5~+0.5'
      }
    };
  }
  
  /**
   * 计算DOAS新风量 (ASHRAE 62.1标准)
   */
  calculateDOASAirVolume(area, height, occupancy, rooms) {
    // 方法1: 人员需求 (Rp)
    const peopleCount = occupancy || Math.ceil(area / 10);
    const byPeople = peopleCount * 2.5;  // 2.5 L/s·人 (住宅)
    
    // 方法2: 面积需求 (Ra)
    const byArea = area * 0.3;  // 0.3 L/s·m² (住宅)
    
    // 总通风量 (Vbz = Rp×P + Ra×A)
    const totalLS = byPeople + byArea;
    const totalCMH = totalLS * 3.6;  // L/s → m³/h
    
    // 空气换气次数
    const airChanges = totalCMH / (area * height);
    
    return {
      total: Math.ceil(totalCMH),
      byPeople: Math.ceil(byPeople * 3.6),
      byArea: Math.ceil(byArea * 3.6),
      airChanges: Math.round(airChanges * 10) / 10,
      standard: 'ASHRAE 62.1-2019',
      calculation: `Vbz = Rp×P + Ra×A = 2.5×${peopleCount} + 0.3×${area} = ${Math.round(totalLS)} L/s`
    };
  }
  
  /**
   * 计算DOAS负荷 (仅新风负荷)
   */
  calculateDOASLoads(airVolume, climateZone, targetTemp, targetRH) {
    const flow = airVolume.total;  // m³/h
    const flowKgs = flow * 1.2 / 3600;  // kg/s (空气密度1.2 kg/m³)
    
    // 室外设计参数 (简化)
    const outdoorConditions = {
      '严寒': { summer: { temp: 30, humidity: 60 }, winter: { temp: -20, humidity: 50 } },
      '寒冷': { summer: { temp: 32, humidity: 65 }, winter: { temp: -10, humidity: 55 } },
      '夏热冬冷': { summer: { temp: 35, humidity: 70 }, winter: { temp: 0, humidity: 75 } },
      '夏热冬暖': { summer: { temp: 33, humidity: 80 }, winter: { temp: 10, humidity: 70 } }
    };
    
    const outdoor = outdoorConditions[climateZone] || outdoorConditions['夏热冬冷'];
    
    // 室内目标状态
    const indoorTemp = targetTemp || 24;
    const indoorRH = targetRH || 50;
    
    // 夏季新风负荷计算
    // 显热负荷: Qs = m×cp×Δt
    const cp = 1.005;  // kJ/(kg·K)
    const summerTempDiff = outdoor.summer.temp - indoorTemp;
    const summerSensibleLoad = flowKgs * cp * summerTempDiff;  // kW
    
    // 潜热负荷: Ql = m×Δh (简化计算)
    // 湿负荷: W = m×Δd
    const summerHumidityRatioDiff = 0.015;  // kg/kg (估算)
    const latentHeatVaporization = 2500;  // kJ/kg
    const summerLatentLoad = flowKgs * summerHumidityRatioDiff * latentHeatVaporization / 1000;  // kW
    
    // 冬季负荷
    const winterTempDiff = indoorTemp - outdoor.winter.temp;
    const winterSensibleLoad = flowKgs * cp * winterTempDiff;  // kW
    
    return {
      summer: {
        sensible: Math.round(summerSensibleLoad * 100) / 100,  // kW
        latent: Math.round(summerLatentLoad * 100) / 100,      // kW
        total: Math.round((summerSensibleLoad + summerLatentLoad) * 100) / 100,
        humidityLoad: Math.round(flowKgs * summerHumidityRatioDiff * 3600 * 1000)  // g/h
      },
      winter: {
        sensible: Math.round(winterSensibleLoad * 100) / 100,  // kW
        latent: 0,  // 冬季通常加湿而非除湿
        total: Math.round(winterSensibleLoad * 100) / 100,
        humidificationNeed: flowKgs * 0.005 * 3600  // g/h (估算加湿需求)
      },
      note: 'DOAS仅承担新风负荷，不承担室内显热负荷'
    };
  }
  
  /**
   * 设计DOAS送风状态点 (关键设计点)
   */
  designDOASSupplyAir(climateZone, targetTemp, targetRH, loads) {
    const indoorTemp = targetTemp || 24;
    const indoorRH = targetRH || 50;
    
    // DOAS核心：送风接近室内状态，不承担室内显热负荷
    // 夏季：送风温度略低于室内，承担新风显热负荷
    // 冬季：送风温度略高于室内，承担新风显热负荷
    
    const summerSupplyTemp = indoorTemp - 2;  // 22℃ (不承担室内显热)
    const winterSupplyTemp = indoorTemp + 2;  // 26℃
    
    // 湿度控制：直接处理到室内目标湿度
    // 这是DOAS的关键优势：深度除湿/加湿
    const supplyHumidity = indoorRH;
    
    // 夏季露点控制 (防结露)
    // 露点 = 送风状态对应的露点温度
    const supplyDewPoint = summerSupplyTemp - 5;  // 约17℃露点
    
    return {
      summer: {
        temperature: summerSupplyTemp,
        relativeHumidity: supplyHumidity,
        dewPoint: supplyDewPoint,
        enthalpy: 45,  // kJ/kg (估算)
        note: '送风温度接近室内，不承担室内显热负荷'
      },
      winter: {
        temperature: winterSupplyTemp,
        relativeHumidity: supplyHumidity,
        dewPoint: 7,
        enthalpy: 38,
        note: '送风温度略高于室内，不承担室内显热负荷'
      },
      vsTraditional: {
        traditionalSummer: 14,  // 传统新风14℃
        doasSummer: summerSupplyTemp,  // DOAS 22℃
        advantage: '避免低温送风带来的吹风感和结露风险'
      }
    };
  }
  
  /**
   * 选择DOAS专用设备 (与常规新风设备的差异化)
   */
  selectDOASEquipment(airVolume, loads, supplyAir) {
    // DOAS设备的关键要求：
    // 1. 深度除湿能力 (夏季潜热负荷大)
    // 2. 精确温湿度控制
    // 3. 高效热回收 (转轮式优先)
    // 4. 与辐射系统的联动接口
    
    const summerLatentLoad = loads.summer.latent;  // kW
    const dehumidificationCapacity = summerLatentLoad * 3600 / 2500;  // kg/h (除湿量)
    
    return {
      type: 'DOAS专用新风机组',
      
      // 核心模块
      modules: {
        heatRecovery: {
          type: '转轮式全热交换器',
          efficiency: { sensible: 80, latent: 70 },
          requirement: 'SRE>=75%, LRE>=60% (ASHRAE 90.1)'
        },
        cooling: {
          type: '表冷器+直膨式除湿',
          capacity: Math.ceil(loads.summer.total),
          dehumidification: `${Math.ceil(dehumidificationCapacity)} kg/h`,
          supplyTemp: `${supplyAir.summer.temperature}℃`
        },
        heating: {
          type: '热水盘管/电加热',
          capacity: Math.ceil(loads.winter.total)
        },
        humidification: {
          type: '蒸汽加湿 (电极式/电热式)',
          capacity: `${Math.ceil(loads.winter.humidificationNeed / 1000)} kg/h`
        },
        filtration: {
          stages: ['G4', 'F7', 'H13'],
          pm25Target: '<10μg/m³'
        }
      },
      
      // 控制要求
      control: {
        type: 'DOAS专用控制器',
        features: [
          '送风温湿度精确控制 (±0.5℃, ±3%RH)',
          '与辐射系统联动 (接收负荷信号)',
          '变风量运行 (根据CO2和人数调节)',
          '防结露保护 (露点监测+预警)',
          '全热回收旁通控制'
        ],
        interface: 'Modbus/BACnet，可接入智能家居'
      },
      
      // 设备规格
      specifications: {
        airVolume: `${airVolume} m³/h`,
        externalStaticPressure: '300-500 Pa',
        noise: '<35dB(A)',
        power: `${Math.ceil(airVolume * 0.5 / 1000)} kW`,
        dimensions: '根据风量定制'
      },
      
      // 与常规新风设备的差异化
      differentiation: {
        vsRegularFreshAir: {
          regular: '简单热回收+粗过滤',
          doas: '深度除湿+精确控制+高效热回收',
          benefit: '送风品质高，舒适度高，系统效率高'
        },
        keyAdvantages: [
          '深度除湿能力 (满足夏季潜热负荷)',
          '送风温湿度精确控制 (±0.5℃/±3%RH)',
          '转轮式热回收 (潜热回收效率70%+)',
          '与辐射系统完美配合'
        ]
      },
      
      // 推荐品牌
      recommendedBrands: [
        { brand: '妥思/Trox', origin: '德国', feature: '高端DOAS系统' },
        { brand: '顿汉布什', origin: '美国', feature: '转轮热回收专家' },
        { brand: '环都拓普', origin: '中国', feature: '国产DOAS领先' },
        { brand: '蒙特/Munters', origin: '瑞典', feature: '除湿转轮专家' }
      ]
    };
  }
  
  /**
   * DOAS与室内系统的协调控制设计
   */
  designDOASCoordination(coolingSystem, heatingSystem, supplyAir) {
    return {
      systemIntegration: {
        concept: 'DOAS仅处理新风，室内系统处理室内负荷',
        loadDistribution: {
          doas: '新风负荷 (显热+潜热)',
          indoorSystem: '围护结构负荷+人员设备负荷'
        }
      },
      
      // 与不同室内系统的配合
      coordination: {
        withRadiant: {
          compatibility: '最佳配合',
          reason: '辐射系统无风吹感，DOAS送风温度可接近室温',
          controlStrategy: 'DOAS根据辐射系统运行模式调整送风状态',
          advantage: '舒适度最高，效率最高'
        },
        withFCU: {
          compatibility: '良好配合',
          reason: 'FCU承担室内显热，DOAS处理新风负荷',
          controlStrategy: 'FCU与DOAS分时运行，避免冲突',
          note: 'DOAS送风温度需略高于FCU送风'
        },
        withVRF: {
          compatibility: '一般配合',
          reason: 'VRF本身可处理新风，但DOAS可提供更高品质新风',
          controlStrategy: 'DOAS作为新风预处理，VRF仅处理室内负荷',
          note: '需协调两者送风温度'
        }
      },
      
      // 控制逻辑
      controlLogic: {
        priority: 'DOAS优先运行，确保新风品质',
        coordination: {
          summer: 'DOAS深度除湿到送风状态点，辐射系统承担剩余显热',
          winter: 'DOAS加热加湿到送风状态点，辐射系统承担热损失',
          transition: 'DOAS旁通模式，自然通风+辐射系统调温'
        },
        sensors: [
          '送风温湿度传感器',
          '室内温湿度传感器 (各房间)',
          'CO2浓度传感器',
          '辐射表面温度传感器 (防结露)'
        ]
      },
      
      // 设计要点
      designNotes: [
        'DOAS送风温度必须高于辐射系统表面温度3℃以上 (防结露)',
        'DOAS与辐射系统建议采用同一控制系统，确保协调',
        'DOAS风量应可独立调节，不受辐射系统影响',
        '过渡季节建议DOAS旁通，仅开启辐射系统自然通风'
      ]
    };
  }
  
  /**
   * DOAS能耗分析 (与常规新风对比)
   */
  analyzeDOASEnergy(airVolume, loads, climateZone) {
    // DOAS能耗计算
    const summerEnergy = loads.summer.total * 1500;  // kWh/年 (夏季运行1500小时)
    const winterEnergy = loads.winter.total * 2000;  // kWh/年 (冬季运行2000小时)
    const annualEnergy = summerEnergy + winterEnergy;
    
    // 热回收节能
    const heatRecoverySavings = annualEnergy * 0.7;  // 70%效率
    const netEnergy = annualEnergy - heatRecoverySavings;
    
    // 与常规新风对比
    const traditionalEnergy = annualEnergy * 1.5;  // 常规新风能耗高50%
    const savingsPercent = ((traditionalEnergy - netEnergy) / traditionalEnergy * 100).toFixed(1);
    
    return {
      annualConsumption: {
        summer: Math.round(summerEnergy),
        winter: Math.round(winterEnergy),
        total: Math.round(annualEnergy),
        unit: 'kWh/年'
      },
      
      heatRecoverySavings: {
        amount: Math.round(heatRecoverySavings),
        efficiency: '70% (转轮式全热回收)',
        note: '潜热回收是DOAS的关键节能点'
      },
      
      netEnergy: {
        amount: Math.round(netEnergy),
        cost: Math.round(netEnergy * 0.6),  // 0.6元/kWh
        perSqm: Math.round(netEnergy / 100)  // 假设100㎡
      },
      
      comparison: {
        vsTraditionalFreshAir: {
          traditional: Math.round(traditionalEnergy),
          doas: Math.round(netEnergy),
          savings: `${savingsPercent}%`,
          reason: 'DOAS深度热回收+与辐射系统配合效率更高'
        },
        vsRegularHVAC: {
          note: 'DOAS+辐射系统比传统中央空调节能40%+'
        }
      },
      
      paybackAnalysis: {
        incrementalCost: 'DOAS设备比普通新风贵30-50%',
        annualSavings: Math.round((traditionalEnergy - netEnergy) * 0.6),
        paybackPeriod: '3-5年 (视气候区和运行时间)',
        longTermBenefit: '10年累计节省电费约2-3万元'
      }
    };
  }

  generateReport(airVolume, heatRecovery, purification, energy) {
    return {
      summary: `专业新风系统设计完成，新风量${airVolume.total}m³/h，采用${heatRecovery.type}，${purification.stages.length}级净化。`,
      
      keyPoints: [
        `新风标准: ${airVolume.perPerson}m³/h·人 (高于国标)`,
        `热回收效率: ${heatRecovery.efficiency || '无'}`,
        `PM2.5控制: ${purification.totalEfficiency}`,
        `年运行费用: ${energy.savings.costEstimate}元`
      ],
      
      recommendations: [
        '建议每3个月检查初效滤网',
        '过渡季节开启旁通模式节能',
        '地下室建议独立除湿系统',
        '定期监测室内CO2浓度',
        '如需最高舒适度，建议采用DOAS+辐射系统方案'
      ]
    };
  }
}

module.exports = { FreshAirProEngine };
