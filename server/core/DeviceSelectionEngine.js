/**
 * 设备选型引擎 - 基于负荷计算结果匹配最佳设备
 */

class DeviceSelectionEngine {
  constructor() {
    // Rheem真实设备数据库 - 基于官网产品参数
    this.rheemDevices = {
      // Rheem Classic系列燃气壁挂炉
      wallBoiler: [
        { 
          model: 'RGS-Classic-24', 
          power: 24, 
          efficiency: 91, 
          hotWaterFlow: 12,
          price: 12800,
          area: '80-140',
          heatingTemp: '40-80',
          minFlow: '2L/min',
          thickness: '277mm',
          features: ['超薄机身', '机械操控', 'IPX5D防水']
        },
        { 
          model: 'RGS-Classic-28', 
          power: 28, 
          efficiency: 92, 
          hotWaterFlow: 14,
          price: 15800,
          area: '120-200',
          heatingTemp: '40-80',
          minFlow: '2L/min',
          thickness: '277mm',
          features: ['超薄机身', '高效供暖', '大流量热水']
        },
        { 
          model: 'RGS-Classic-35', 
          power: 35, 
          efficiency: 92, 
          hotWaterFlow: 16,
          price: 19800,
          area: '200-300',
          heatingTemp: '40-80',
          minFlow: '2L/min',
          thickness: '277mm',
          features: ['大功率', '别墅专用', '超薄设计']
        }
      ],
      
      // Rheem Odin奥丁空气源热泵热水器
      heatPump: [
        { 
          model: 'RHP-Odin-200', 
          capacity: 200,
          heatingPower: 2800,
          maxTemp: 70,
          noise: 40,
          price: 15800,
          efficiency: '一级能效',
          savings: '78%',
          features: ['双驱立体吸热', '70℃高温水', 'WiFi互联', '40dB静音']
        },
        { 
          model: 'RHP-Odin-300', 
          capacity: 300,
          heatingPower: 2800,
          maxTemp: 70,
          noise: 40,
          price: 19800,
          efficiency: '一级能效',
          savings: '78%',
          features: ['双驱立体吸热', '70℃高温水', '大容量', '40dB静音']
        }
      ],
      
      // Rheem商用空气源热泵
      commercialHeatPump: [
        { 
          model: 'RHPC-18WES', 
          heatingCapacity: 18,
          protection: 'IPX4',
          price: 45000,
          efficiency: '二级能效',
          features: ['高效压缩机', '波纹套管换热器', '外传子静音风机']
        },
        { 
          model: 'RHPC-80WES', 
          heatingCapacity: 80,
          protection: 'IPX4',
          price: 88000,
          efficiency: '二级能效',
          features: ['大功率商用', '智能主板', '多重涂层翅片']
        }
      ],
      
      // Ruud Achiever系列热泵 (Rheem旗下品牌)
      ruudHeatPump: [
        { 
          model: 'RP14-18', 
          cooling: 5.3, // 1.5 Ton = 18,000 BTU/h ≈ 5.3kW
          heating: 5.0,
          seer: 14,
          hspf: 8.0,
          price: 28000,
          compressor: 'Legendary Scroll',
          type: '住宅型'
        },
        { 
          model: 'RP14-36', 
          cooling: 10.6, // 3 Ton = 36,000 BTU/h ≈ 10.6kW
          heating: 10.0,
          seer: 16,
          hspf: 9.0,
          price: 38000,
          compressor: 'Legendary Scroll',
          type: '住宅型'
        }
      ],
      
      // Rheem燃气容积式热水器
      gasWaterHeater: [
        { 
          model: 'RGS-AW-200', 
          capacity: 200,
          heatLoad: 10.6,
          price: 18500,
          installType: '户外',
          features: ['防风雨设计', '有线遥控', 'LED显示', '动态中温节能']
        },
        { 
          model: 'RGS-AW-300', 
          capacity: 300,
          heatLoad: 13.9,
          price: 23800,
          installType: '户外',
          features: ['大容量', '防风雨设计', '多点供水', '恒温舒适']
        }
      ],
      
      // 保留原有设备类型用于完整系统配置
      // 新风系统
      freshAir: [
        { 
          model: 'FA-250', 
          airFlow: 250, 
          heatRecovery: 78, 
          dehumidify: 45,
          price: 15800, 
          area: '80-120',
          pmFilter: 99.9,
          noise: 38
        },
        { 
          model: 'FA-350', 
          airFlow: 350, 
          heatRecovery: 80, 
          dehumidify: 60,
          price: 19800, 
          area: '120-160',
          pmFilter: 99.95,
          noise: 40
        }
      ],
      
      // 全屋净水系统
      waterSystem: [
        { 
          model: 'RWS-3Stage', 
          preFilter: '40μm',
          centralFlow: 2.0,
          roFlow: 800,
          stages: 3,
          price: 12800,
          features: ['前置+中央+RO', 'RHEEMGLAS抑菌内胆', '智能换芯提醒']
        }
      ],
      
      // 地暖系统
      floorHeating: [
        { 
          model: 'FH-100-STD', 
          coverage: 100,
          pipeType: 'PERT阻氧管',
          pipeDiameter: '16mm',
          insulation: 'XPS挤塑板',
          price: 18000,
          warranty: '50年',
          features: ['阻氧防腐', '均匀散热', '与Rheem壁挂炉完美匹配']
        },
        { 
          model: 'FH-150-STD', 
          coverage: 150,
          pipeType: 'PERT阻氧管',
          pipeDiameter: '16mm',
          insulation: 'XPS挤塑板',
          price: 25000,
          warranty: '50年',
          features: ['大面积覆盖', '分区控制']
        }
      ],
      
      // 中央空调室外机 (关键缺失)
      airConditioning: [
        { model: 'RHAC-12W', cooling: 12, heating: 12, cop: 3.5, price: 28000, type: '风冷热泵' },
        { model: 'RHAC-14W', cooling: 14, heating: 14, cop: 3.6, price: 32000, type: '风冷热泵' },
        { model: 'RHAC-16W', cooling: 16, heating: 16, cop: 3.6, price: 35000, type: '风冷热泵' },
        { model: 'RHAC-18W', cooling: 18, heating: 18, cop: 3.7, price: 38000, type: '风冷热泵' },
        { model: 'RHAC-20W', cooling: 20, heating: 20, cop: 3.7, price: 42000, type: '风冷热泵' },
        { model: 'RHAC-25W', cooling: 25, heating: 25, cop: 3.8, price: 52000, type: '风冷热泵' }
      ],
      
      // 室内机 (关键缺失)
      indoorUnits: [
        { model: 'RHI-22T', capacity: 2.2, type: '风管机', price: 4200 },
        { model: 'RHI-28T', capacity: 2.8, type: '风管机', price: 4800 },
        { model: 'RHI-36T', capacity: 3.6, type: '风管机', price: 5500 },
        { model: 'RHI-45T', capacity: 4.5, type: '风管机', price: 6800 },
        { model: 'RHI-56T', capacity: 5.6, type: '风管机', price: 8200 },
        { model: 'RHI-71T', capacity: 7.1, type: '风管机', price: 9800 }
      ],
      
      // 全屋净水系统完整版
      waterPurification: [
        { model: 'RWPF-40', type: '前置过滤', flowRate: 4000, price: 2800, features: ['40μm过滤', '反冲洗'] },
        { model: 'RWPF-50', type: '前置过滤', flowRate: 5000, price: 3500, features: ['50μm过滤', '智能反冲洗'] },
        { model: 'RWC-2000', type: '中央净水', flowRate: 2000, price: 6800, features: ['活性炭过滤', '2T流量'] },
        { model: 'RWC-3000', type: '中央净水', flowRate: 3000, price: 8800, features: ['活性炭过滤', '3T流量'] },
        { model: 'RWRO-800', type: '厨下RO', flowRate: 800, price: 5800, features: ['RO反渗透', '智能换芯'] },
        { model: 'RWRO-1200', type: '厨下RO', flowRate: 1200, price: 7800, features: ['RO反渗透', '大流量'] }
      ],
      
      // 热水系统完整版
      hotWater: [
        { model: 'RGE-50', capacity: 50, power: 2.0, price: 2800, type: '电热水器' },
        { model: 'RGE-80', capacity: 80, power: 3.0, price: 3800, type: '电热水器' },
        { model: 'RGE-100', capacity: 100, power: 3.0, price: 4800, type: '电热水器' },
        { model: 'RGS-16L', capacity: 16, power: 32, price: 6800, type: '燃气热水器', features: ['恒温'] },
        { model: 'RGS-20L', capacity: 20, power: 40, price: 8800, type: '燃气热水器', features: ['零冷水'] }
      ],
      
      // 五恒系统 (关键缺失)
      fiveConstant: [
        { model: '5H-15', area: ['80-120'], cooling: 15, heating: 15, price: 45800, features: ['恒温', '恒湿', '恒氧', '恒洁', '恒静'] },
        { model: '5H-20', area: ['120-160'], cooling: 20, heating: 20, price: 56800, features: ['恒温', '恒湿', '恒氧', '恒洁', '恒静'] },
        { model: '5H-25', area: ['160-220'], cooling: 25, heating: 25, price: 69800, features: ['恒温', '恒湿', '恒氧', '恒洁', '恒静'] },
        { model: '5H-30', area: ['220-300'], cooling: 30, heating: 30, price: 85800, features: ['恒温', '恒湿', '恒氧', '恒洁', '恒静'] }
      ],
      
      // 毛细管系统
      capillarySystem: [
        { model: 'CPS-100', coverage: 100, price: 28000, features: ['辐射供冷供暖'] },
        { model: 'CPS-150', coverage: 150, price: 38000, features: ['辐射供冷供暖'] },
        { model: 'CPS-200', coverage: 200, price: 48000, features: ['辐射供冷供暖'] }
      ]
    };

    // 选型规则
    this.selectionRules = {
      // 安全系数
      safetyFactor: 1.1,
      // 同时使用系数
      diversityFactor: 0.7,
      // 室内机配置系数
      indoorUnitFactor: 0.8
    };
  }

  /**
   * 主选型函数 - 基于负荷计算结果选择设备
   */
  selectDevices(loadCalculation, buildingParams) {
    const results = {
      timestamp: new Date().toISOString(),
      systems: [],
      totalPrice: 0,
      recommendations: []
    };

    const coolingLoad = loadCalculation.cooling.totalCoolingLoad;
    const heatingLoad = loadCalculation.heating.totalHeatingLoad;
    const totalArea = buildingParams.totalArea;
    const roomCount = buildingParams.rooms ? buildingParams.rooms.length : 3;

    // 1. 中央空调选型
    const acSelection = this.selectAirConditioning(coolingLoad, heatingLoad, totalArea, roomCount);
    if (acSelection) {
      results.systems.push(acSelection);
      results.totalPrice += acSelection.totalPrice;
    }

    // 2. 新风系统选型
    const freshAirSelection = this.selectFreshAirSystem(buildingParams);
    if (freshAirSelection) {
      results.systems.push(freshAirSelection);
      results.totalPrice += freshAirSelection.totalPrice;
    }

    // 3. 净水系统选型
    const waterSelection = this.selectWaterSystem(buildingParams);
    if (waterSelection) {
      results.systems.push(waterSelection);
      results.totalPrice += waterSelection.totalPrice;
    }

    // 4. 采暖系统选型（如果需要）
    if (heatingLoad > 0) {
      const heatingSelection = this.selectHeatingSystem(heatingLoad, totalArea);
      if (heatingSelection) {
        results.systems.push(heatingSelection);
        results.totalPrice += heatingSelection.totalPrice;
      }
    }

    // 5. 热水系统选型
    const hotWaterSelection = this.selectHotWaterSystem(buildingParams);
    if (hotWaterSelection) {
      results.systems.push(hotWaterSelection);
      results.totalPrice += hotWaterSelection.totalPrice;
    }

    // 生成建议
    results.recommendations = this.generateSelectionRecommendations(results.systems);
    results.totalPrice = Math.round(results.totalPrice * 100) / 100;

    return results;
  }

  /**
   * 中央空调选型
   */
  selectAirConditioning(coolingLoad, heatingLoad, totalArea, roomCount) {
    // 计算所需制冷量（考虑安全系数）
    const requiredCooling = coolingLoad * this.selectionRules.safetyFactor;
    
    // 选择室外机
    const outdoorUnit = this.rheemDevices.airConditioning.find(
      unit => unit.cooling >= requiredCooling && unit.cooling <= requiredCooling * 1.3
    ) || this.rheemDevices.airConditioning[this.rheemDevices.airConditioning.length - 1];

    // 选择室内机 - 基于房间数量和面积分配
    const indoorUnits = this.selectIndoorUnits(totalArea, roomCount, outdoorUnit.cooling);

    // 连接率计算
    const connectionRate = indoorUnits.totalCapacity / outdoorUnit.cooling;

    return {
      systemName: '中央空调系统',
      outdoorUnit: outdoorUnit,
      indoorUnits: indoorUnits.units,
      connectionRate: Math.round(connectionRate * 100) / 100,
      totalCapacity: indoorUnits.totalCapacity,
      totalPrice: outdoorUnit.price + indoorUnits.totalPrice,
      specifications: {
        cooling: outdoorUnit.cooling,
        heating: outdoorUnit.heating,
        cop: outdoorUnit.cop,
        ratedPower: Math.round(outdoorUnit.cooling / outdoorUnit.cop * 100) / 100
      }
    };
  }

  /**
   * 选择室内机
   */
  selectIndoorUnits(totalArea, roomCount, outdoorCapacity) {
    const units = [];
    let totalCapacity = 0;
    let totalPrice = 0;

    // 简化的室内机配置逻辑
    // 客厅配置
    const livingRoomCapacity = Math.min(outdoorCapacity * 0.25, 5.6);
    const livingRoomUnit = this.rheemDevices.indoorUnits.find(
      u => u.capacity >= livingRoomCapacity
    ) || this.rheemDevices.indoorUnits[4];
    units.push({ room: '客厅', unit: livingRoomUnit, quantity: 1 });
    totalCapacity += livingRoomUnit.capacity;
    totalPrice += livingRoomUnit.price;

    // 主卧配置
    const masterBedroomCapacity = Math.min(outdoorCapacity * 0.20, 4.5);
    const masterUnit = this.rheemDevices.indoorUnits.find(
      u => u.capacity >= masterBedroomCapacity && u.capacity <= masterBedroomCapacity * 1.2
    ) || this.rheemDevices.indoorUnits[3];
    units.push({ room: '主卧', unit: masterUnit, quantity: 1 });
    totalCapacity += masterUnit.capacity;
    totalPrice += masterUnit.price;

    // 其他卧室配置
    const otherRoomCapacity = Math.min(outdoorCapacity * 0.15, 3.6);
    const otherUnit = this.rheemDevices.indoorUnits.find(
      u => u.capacity >= otherRoomCapacity && u.capacity <= otherRoomCapacity * 1.2
    ) || this.rheemDevices.indoorUnits[2];
    
    for (let i = 1; i < Math.min(roomCount - 2, 3); i++) {
      units.push({ room: `次卧${i}`, unit: otherUnit, quantity: 1 });
      totalCapacity += otherUnit.capacity;
      totalPrice += otherUnit.price;
    }

    return {
      units: units,
      totalCapacity: Math.round(totalCapacity * 100) / 100,
      totalPrice: totalPrice
    };
  }

  /**
   * 新风系统选型
   */
  selectFreshAirSystem(buildingParams) {
    const occupants = buildingParams.totalOccupants || 4;
    const freshAirRate = 30; // m³/(h·人)
    const requiredAirFlow = occupants * freshAirRate;

    const unit = this.rheemDevices.freshAir.find(
      u => u.airFlow >= requiredAirFlow && u.airFlow <= requiredAirFlow * 1.5
    ) || this.rheemDevices.freshAir[this.rheemDevices.freshAir.length - 1];

    return {
      systemName: '新风系统',
      unit: unit,
      totalPrice: unit.price,
      specifications: {
        airFlow: unit.airFlow,
        heatRecovery: unit.heatRecovery,
        coverage: unit.area
      }
    };
  }

  /**
   * 净水系统选型
   */
  selectWaterSystem(buildingParams) {
    const occupants = buildingParams.totalOccupants || 4;
    const waterPoints = buildingParams.waterPoints || 2;

    const units = [];
    let totalPrice = 0;

    // 中央净水机
    const centralUnit = this.rheemDevices.waterPurification.find(
      u => u.type === '中央净水' && u.flowRate >= occupants * 100
    ) || this.rheemDevices.waterPurification.find(u => u.type === '中央净水') || this.rheemDevices.waterPurification[2];
    units.push({ purpose: '中央净水', unit: centralUnit, quantity: 1 });
    totalPrice += centralUnit.price;

    // 厨下净水机
    const kitchenUnit = this.rheemDevices.waterPurification.find(
      u => u.type === '厨下式'
    ) || this.rheemDevices.waterPurification[1];
    units.push({ purpose: '厨房直饮', unit: kitchenUnit, quantity: 1 });
    totalPrice += kitchenUnit.price;

    return {
      systemName: '全屋净水系统',
      units: units,
      totalPrice: totalPrice,
      specifications: {
        stages: 5,
        filtration: 'RO反渗透+活性炭+PP棉'
      }
    };
  }

  /**
   * 采暖系统选型 - 基于学习的壁挂炉选型标准
   * 80-120㎡: 18-20KW
   * 120-180㎡: 24KW
   * 180-220㎡: 28KW
   * 220-260㎡: 32KW
   */
  selectHeatingSystem(heatingLoad, totalArea) {
    // 基于面积选择壁挂炉功率（符合行业标准）
    let selectedBoiler;
    
    if (totalArea <= 90) {
      selectedBoiler = this.rheemDevices.wallBoiler.find(b => b.power === 24) || this.rheemDevices.wallBoiler[0];
    } else if (totalArea <= 120) {
      selectedBoiler = this.rheemDevices.wallBoiler.find(b => b.power === 24) || this.rheemDevices.wallBoiler[0];
    } else if (totalArea <= 180) {
      selectedBoiler = this.rheemDevices.wallBoiler.find(b => b.power === 28) || this.rheemDevices.wallBoiler[1];
    } else if (totalArea <= 220) {
      selectedBoiler = this.rheemDevices.wallBoiler.find(b => b.power === 28) || this.rheemDevices.wallBoiler[1];
    } else if (totalArea <= 280) {
      selectedBoiler = this.rheemDevices.wallBoiler.find(b => b.power === 35) || this.rheemDevices.wallBoiler[2];
    } else {
      // 超大户型需要多台或更大功率
      selectedBoiler = this.rheemDevices.wallBoiler.find(b => b.power === 35) || this.rheemDevices.wallBoiler[2];
    }

    // 选择地暖系统
    const floorHeating = this.selectFloorHeating(totalArea);

    return {
      systemName: '采暖系统',
      boiler: selectedBoiler,
      floorHeating: floorHeating,
      totalPrice: selectedBoiler.price + floorHeating.price,
      specifications: {
        boilerPower: selectedBoiler.power,
        efficiency: selectedBoiler.efficiency,
        coverage: totalArea,
        floorHeatingArea: floorHeating.coverage,
        type: '冷凝燃气壁挂炉+水地暖',
        estimatedConsumption: Math.round(totalArea * 8) // 预估采暖能耗 W/㎡
      }
    };
  }

  /**
   * 地暖系统选型
   */
  selectFloorHeating(totalArea) {
    // 选择合适的地暖系统
    const fhUnit = this.rheemDevices.floorHeating.find(
      fh => fh.coverage >= totalArea
    ) || this.rheemDevices.floorHeating[this.rheemDevices.floorHeating.length - 1];
    
    // 如果面积超过最大 coverage，需要多套
    let quantity = 1;
    let totalPrice = fhUnit.price;
    
    if (totalArea > 150) {
      quantity = Math.ceil(totalArea / 150);
      totalPrice = fhUnit.price * quantity;
    }

    return {
      model: fhUnit.model,
      coverage: totalArea,
      pipeType: fhUnit.pipeType,
      insulation: fhUnit.insulation,
      warranty: fhUnit.warranty,
      quantity: quantity,
      price: totalPrice
    };
  }

  /**
   * 五恒系统选型 - 新增
   */
  selectFiveConstantSystem(buildingParams) {
    const totalArea = buildingParams.totalArea;
    
    // 选择主机
    const heatPump = this.rheemDevices.fiveConstant.find(
      h => h.area.includes(totalArea.toString())
    ) || this.rheemDevices.fiveConstant[1];
    
    // 选择毛细管系统
    const capillary = this.rheemDevices.capillarySystem.find(
      c => c.coverage >= totalArea
    ) || this.rheemDevices.capillarySystem[this.rheemDevices.capillarySystem.length - 1];
    
    // 选择新风
    const freshAir = this.selectFreshAirSystem(buildingParams);
    
    // 计算总价
    const totalPrice = heatPump.price + capillary.price + freshAir.totalPrice;
    
    return {
      systemName: '五恒系统',
      heatPump: heatPump,
      capillary: capillary,
      freshAir: freshAir,
      totalPrice: totalPrice,
      specifications: {
        coolingCapacity: heatPump.cooling,
        heatingCapacity: heatPump.heating,
        cop: heatPump.cop,
        coverage: totalArea,
        noise: heatPump.noise,
        features: ['恒温', '恒湿', '恒氧', '恒洁', '恒静']
      }
    };
  }

  /**
   * 热水系统选型
   */
  selectHotWaterSystem(buildingParams) {
    const occupants = buildingParams.totalOccupants || 4;
    // 每人50L热水需求
    const requiredCapacity = occupants * 50;

    const unit = this.rheemDevices.hotWater.find(
      h => h.capacity >= requiredCapacity && h.capacity <= requiredCapacity * 1.5
    ) || this.rheemDevices.hotWater[3];

    return {
      systemName: '热水系统',
      unit: unit,
      totalPrice: unit.price,
      specifications: {
        capacity: unit.capacity,
        recoveryTime: unit.recovery,
        power: unit.power
      }
    };
  }

  /**
   * 生成选型建议
   */
  generateSelectionRecommendations(systems) {
    const recommendations = [];

    // 系统兼容性检查
    const hasAC = systems.some(s => s.systemName === '中央空调系统');
    const hasHeating = systems.some(s => s.systemName === '采暖系统');
    const hasFreshAir = systems.some(s => s.systemName === '新风系统');

    if (hasAC && hasHeating) {
      recommendations.push('中央空调与采暖系统可联动控制，建议安装智能温控系统');
    }

    if (hasFreshAir) {
      recommendations.push('新风系统与空调联动，可实现更好的室内空气质量控制');
    }

    // 能效建议
    const acSystem = systems.find(s => s.systemName === '中央空调系统');
    if (acSystem && acSystem.outdoorUnit.cop >= 4.0) {
      recommendations.push('所选空调能效等级为一级，运行成本低，节能环保');
    }

    recommendations.push('所有设备均享受2年质保，提供终身技术支持');
    recommendations.push('建议选择瑞美官方安装服务，确保系统性能最优化');

    return recommendations;
  }
}

module.exports = DeviceSelectionEngine;
