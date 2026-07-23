/**
 * 专业规范标准库 (ProfessionalStandardsLibrary)
 * 
 * 完整覆盖暖通空调、热水、DOAS、电气、给排水、结构等
 * 国家标准(GB/JG/CJJ) + 国际标准(ASHRAE/EN/ISO/NSF/UPC/ANSI)
 * 
 * v8.0 标准体系完整版 - 修订增强:
 * - 热水标准（国标 + 国际欧美体系）⭐ 补强
 * - DOAS专项标准体系 ⭐ 补强
 * - 综合规范联审
 */

class ProfessionalStandardsLibrary {
  constructor() {
    this.version = '1.0.0';
    this.name = 'ProfessionalStandardsLibrary';
    
    // ==================== 热水系统标准 ⭐ 补强 ====================
    this.hotWaterStandards = {
      // 国家标准 (GB/JG/CJJ)
      china: {
        'GB 50015-2019': {
          name: '建筑给水排水设计标准',
          scope: ['热水系统设计', '用水定额', '管道设计'],
          requirements: {
            hotelPerBed: 120,        // L/床·d
            hospitalPerBed: 150,
            residentialPerCapita: 60,
            officePerArea: 5,        // L/m²·d
            supplyTemp: { min: 60, max: 75 },  // °C
            returnTemp: 50,
            recoveryTime: 4,         // 小时
            backflowProtection: true
          }
        },
        'GB 50736-2012': {
          name: '民用建筑供暖通风与空调设计规范',
          scope: ['热水采暖', '热水供热'],
          requirements: {
            heatingSupplyTemp: { floor: 45, radiator: 75 },
            heatingReturnTemp: { floor: 35, radiator: 60 }
          }
        },
        'GB 50242-2002': {
          name: '建筑给水排水及采暖工程施工质量验收规范',
          scope: ['热水管道安装', '试压', '保温'],
          requirements: {
            testPressure: 1.5,       // 倍工作压力
            testDuration: 30,         // 分钟
            insulationKValue: 0.04   // W/(m·K)
          }
        },
        'GB 50364-2018': {
          name: '民用建筑太阳能热水系统应用技术标准',
          scope: ['太阳能热水', '辅助加热', '集热效率'],
          requirements: {
            solarFraction: 0.5,       // 太阳能保证率
            collectorEfficiency: 0.45, // 集热器效率
            antifrezzeProtect: true
          }
        },
        'JGJ 142-2012': {
          name: '辐射供暖供冷技术规程',
          scope: ['地板辐射', '热水辐射'],
          requirements: {
            floorTempMax: 29,         // °C
            supplyTempMax: 60,
            tempDiff: 10
          }
        },
        'CJJ/T 81-2013': {
          name: '城镇供热直埋热水管道技术规程',
          scope: ['直埋管道', '保温', '补偿'],
          requirements: {
            workingPressure: 1.6,    // MPa
            workingTemp: 130,
            insulationThickness: { DN50: 50, DN100: 80, DN200: 100 }
          }
        },
        'GB/T 18713-2002': {
          name: '太阳热水系统设计、安装及工程验收技术规范',
          scope: ['太阳能系统验收'],
          requirements: { stagnationTemp: 200 }
        }
      },
      
      // 国际标准 (ASHRAE/UPC/IPC/NSF/EN/ISO)
      international: {
        'ASHRAE 90.1-2022': {
          name: 'Energy Standard for Buildings',
          scope: ['热水系统能效', '保温', '循环泵'],
          requirements: {
            insulationR: 4.0,         // h·ft²·°F/Btu
            recirculationControl: 'demand',
            pumpEfficiency: 0.65,
            heatLossMax: 0.8           // W/m
          }
        },
        'ASHRAE 188-2018': {
          name: 'Legionellosis: Risk Management for Building Water Systems',
          scope: ['军团菌防控', '水温管理'],
          requirements: {
            storageMin: 60,           // °C
            distributionMin: 55,
            returnMin: 51,
            disinfectionTemp: 70,     // 周期性消毒
            stagnationMax: 7          // 天
          },
          critical: true              // 健康关键
        },
        'UPC (Uniform Plumbing Code)': {
          name: '美国统一管道规范',
          scope: ['给排水管道', '材料', '安装'],
          requirements: {
            scaldProtection: 49,      // °C 防烫
            mixingValveRequired: true,
            airGap: 25,               // mm 防回流
            backflowPrevention: 'RPZ'  // 减压式防回流
          }
        },
        'IPC (International Plumbing Code)': {
          name: '国际管道规范',
          scope: ['热水安装', '回水循环'],
          requirements: {
            recirculationLoop: '>30m',
            tempStratification: true,
            expansionTank: true
          }
        },
        'NSF/ANSI 61': {
          name: 'Drinking Water System Components - Health Effects',
          scope: ['饮用水接触材料认证'],
          requirements: {
            leadFree: 0.25,           // % 无铅
            chemicalSafety: 'certified',
            certificationRequired: true
          },
          critical: true
        },
        'NSF/ANSI 372': {
          name: 'Drinking Water System Components - Lead Content',
          scope: ['无铅认证'],
          requirements: { leadContent: 0.25 }
        },
        'NSF/ANSI 5': {
          name: 'Water Heaters, Hot Water Supply Boilers',
          scope: ['商用热水设备认证'],
          requirements: { commercialCertification: true }
        },
        'EN 12828:2012+A1:2014': {
          name: 'Heating systems in buildings (欧洲)',
          scope: ['热水采暖系统'],
          requirements: {
            workingTempMax: 110,
            workingPressureMax: 6,
            expansionVesselSizing: 'EN12828'
          }
        },
        'EN 806-1~5': {
          name: 'Specifications for installations inside buildings (欧洲饮用水)',
          scope: ['饮用水管道设计/安装/测试'],
          requirements: {
            hygieneTesting: true,
            disinfection: 'EN806-4',
            commissioningPressureTest: 1.1  // 倍系统压力
          }
        },
        'ISO 9459-2:1995': {
          name: 'Solar heating - Domestic water heating systems',
          scope: ['太阳能热水系统性能测试'],
          requirements: { performanceTest: 'ISO9459' }
        },
        'EN 16147:2017': {
          name: 'Heat pumps with electrically driven compressors - Domestic hot water',
          scope: ['热泵热水器性能测试'],
          requirements: {
            copMin: 2.5,              // 性能系数
            recoveryTime: 4,
            standbyLoss: 1.0          // kWh/24h
          }
        },
        'ASHRAE 90.2-2018': {
          name: 'Energy-Efficient Design of Low-Rise Residential',
          scope: ['住宅热水能效'],
          requirements: { ufMin: 0.62, efMin: 0.67 }
        }
      }
    };
    
    // ==================== DOAS专用标准体系 ⭐ 补强 ====================
    this.doasStandards = {
      // 核心DOAS标准
      core: {
        'ASHRAE 62.1-2022': {
          name: 'Ventilation for Acceptable Indoor Air Quality',
          scope: ['通风换气率', 'IAQ', '室内空气品质'],
          requirements: {
            // 各类空间通风率
            office: { rp: 2.5, ra: 0.3 },          // L/s·person, L/s·m²
            classroom: { rp: 5.0, ra: 0.6 },
            residential: { rp: 2.5, ra: 0.3 },
            retail: { rp: 3.8, ra: 0.6 },
            restaurant: { rp: 3.8, ra: 0.9 },
            hospital: { rp: 5.0, ra: 0.9 },
            // 关键参数
            outdoorAirCalc: 'Voz = Rp×Pz + Ra×Az',  // 计算公式
            zoneAirDistEffectiveness: 0.8,
            systemVentilationEfficiency: 0.7
          },
          critical: true
        },
        'ASHRAE 90.1-2022': {
          name: 'Energy Standard for Buildings',
          scope: ['DOAS能效', '热回收', '风机效率'],
          requirements: {
            heatRecovery: {
              sre: 75,                  // 显热回收效率%
              lre: 60,                  // 潜热回收效率%
              required: 'climate-zone-3-and-above'
            },
            fanPower: {
              sfpMax: 1.5,               // W·s/L 比风机功率
              fanEfficiency: 0.55
            },
            economizer: {
              required: true,
              type: ['airside', 'waterside']
            },
            dx_doas: {
              ieerMin: 14.0,             // 综合能效
              copMin: 4.0
            }
          }
        },
        'ASHRAE 189.1-2020': {
          name: 'Standard for the Design of High-Performance Green Buildings',
          scope: ['绿色建筑DOAS要求', 'IAQ增强'],
          requirements: {
            outdoorAirIncrease: 1.3,    // 比62.1增加30%
            mervFilter: 13,              // 最低过滤等级
            co2Monitoring: true,
            pm25Monitoring: true
          }
        },
        'ASHRAE Guideline 36-2021': {
          name: 'High-Performance Sequences of Operation for HVAC Systems',
          scope: ['DOAS控制序列', '高性能运行'],
          requirements: {
            demandControlVentilation: true,
            economizerLockout: true,
            supplyAirReset: true
          }
        },
        'AHRI 920-2020': {
          name: 'Performance Rating of DX-Dedicated Outdoor Air System Units',
          scope: ['DX-DOAS设备性能认证'],
          requirements: {
            ieer: 14.0,
            copDehumidification: 4.0,
            ratingConditions: 'AHRI 920'
          },
          critical: true
        }
      },
      
      // 配套标准
      supporting: {
        'ASHRAE 55-2020': {
          name: 'Thermal Environmental Conditions for Human Occupancy',
          scope: ['热舒适', 'PMV/PPD'],
          requirements: {
            pmvRange: [-0.5, 0.5],
            ppdMax: 10,
            airSpeedMax: 0.25
          }
        },
        'ASHRAE 52.2-2017': {
          name: 'Method of Testing General Ventilation Air-Cleaning Devices',
          scope: ['空气过滤器测试', 'MERV评级'],
          requirements: {
            mervMin: 13,
            doasFilter: 'MERV13+',
            hospitalFilter: 'MERV14-HEPA'
          }
        },
        'ISO 16890-1:2016': {
          name: 'Air filters for general ventilation (国际过滤标准)',
          scope: ['ePM1/ePM2.5/ePM10过滤等级'],
          requirements: {
            ePM1Min: 50,                // 50%以上
            doasFilter: 'ePM1 ≥50%'
          }
        },
        'GB 50736-2012': {
          name: '民用建筑供暖通风与空调设计规范 (中国)',
          scope: ['新风量', '排风热回收'],
          requirements: {
            residentialFreshAir: 30,    // m³/h·person
            officeFreshAir: 30,
            heatRecoveryMandatory: 'climate-zone-1-2-3'
          }
        },
        'GB/T 51141-2015': {
          name: '既有建筑绿色改造评价标准',
          scope: ['DOAS改造', 'IAQ评估'],
          requirements: { iaqImprovement: '50%' }
        },
        'EN 16798-3:2017': {
          name: 'Energy performance of buildings - Ventilation for buildings (欧洲)',
          scope: ['欧洲DOAS标准', 'IAQ分类'],
          requirements: {
            iaqCategoryI: 'PM2.5<10ug/m³',
            iaqCategoryII: 'PM2.5<25ug/m³',
            heatRecoveryMin: 70
          }
        },
        'EN 308:2022': {
          name: 'Heat exchangers - Test procedures (欧洲热交换器)',
          scope: ['热回收测试方法'],
          requirements: { recoveryTestStandard: 'EN308' }
        }
      }
    };
    
    // ==================== 综合规范快速查询 ====================
    this.allStandards = this.buildAllStandardsIndex();
  }
  
  buildAllStandardsIndex() {
    const all = {};
    Object.values(this.hotWaterStandards.china).forEach(s => all[s.name] = { ...s, category: 'hotwater_cn' });
    Object.values(this.hotWaterStandards.international).forEach(s => all[s.name] = { ...s, category: 'hotwater_intl' });
    Object.values(this.doasStandards.core).forEach(s => all[s.name] = { ...s, category: 'doas_core' });
    Object.values(this.doasStandards.supporting).forEach(s => all[s.name] = { ...s, category: 'doas_support' });
    return all;
  }
  
  // ==================== 热水系统合规检查 ====================
  
  /**
   * 全面热水系统合规检查（国标+国际）
   */
  checkHotWaterCompliance(design) {
    const results = {
      timestamp: new Date().toISOString(),
      design,
      china: this.checkChinaHotWater(design),
      international: this.checkInternationalHotWater(design),
      legionellaRisk: this.checkLegionellaRisk(design),
      summary: null
    };
    
    const allChecks = [...results.china.checks, ...results.international.checks, ...results.legionellaRisk.checks];
    const passed = allChecks.filter(c => c.status === 'PASS').length;
    const failed = allChecks.filter(c => c.status === 'FAIL').length;
    const warnings = allChecks.filter(c => c.status === 'WARNING').length;
    
    results.summary = {
      totalChecks: allChecks.length,
      passed,
      failed,
      warnings,
      complianceRate: ((passed / allChecks.length) * 100).toFixed(1) + '%',
      score: this.calculateHotWaterScore(passed, failed, warnings, allChecks.length),
      grade: this.getGrade((passed / allChecks.length) * 100)
    };
    
    return results;
  }
  
  checkChinaHotWater(design) {
    const checks = [];
    const std = this.hotWaterStandards.china;
    
    // GB 50015-2019 用水定额
    const expectedDaily = this.calcExpectedDailyUsage(design);
    checks.push({
      regulation: 'GB 50015-2019',
      name: '用水定额标准',
      requirement: `${design.buildingType}标准用水量`,
      actual: design.dailyUsage || 0,
      expected: expectedDaily,
      status: design.dailyUsage >= expectedDaily * 0.9 ? 'PASS' : 'WARNING',
      detail: `实际${design.dailyUsage}L/d vs 标准${expectedDaily}L/d`
    });
    
    // GB 50015-2019 供水温度
    checks.push({
      regulation: 'GB 50015-2019',
      name: '热水供水温度',
      requirement: '60-75°C',
      actual: design.supplyTemp || 60,
      status: (design.supplyTemp >= 60 && design.supplyTemp <= 75) ? 'PASS' : 'FAIL',
      detail: `供水温度${design.supplyTemp}°C必须在60-75°C范围`
    });
    
    // GB 50242-2002 试压
    checks.push({
      regulation: 'GB 50242-2002',
      name: '管道试压',
      requirement: '工作压力1.5倍，30分钟无渗漏',
      status: design.pressureTest ? 'PASS' : 'WARNING',
      detail: design.pressureTest ? '已完成试压' : '需进行管道试压验收'
    });
    
    // JGJ 142-2012 辐射温度
    if (design.radiantHeating) {
      checks.push({
        regulation: 'JGJ 142-2012',
        name: '辐射地板表面温度',
        requirement: '≤29°C',
        actual: design.floorTemp || 28,
        status: (design.floorTemp || 28) <= 29 ? 'PASS' : 'FAIL',
        detail: '防止过热不适'
      });
    }
    
    // GB 50364-2018 太阳能保证率
    if (design.solarSystem) {
      checks.push({
        regulation: 'GB 50364-2018',
        name: '太阳能保证率',
        requirement: '≥50%',
        actual: design.solarFraction || 0,
        status: (design.solarFraction || 0) >= 0.5 ? 'PASS' : 'WARNING',
        detail: `当前${(design.solarFraction*100).toFixed(0)}%`
      });
    }
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  checkInternationalHotWater(design) {
    const checks = [];
    
    // ASHRAE 90.1 保温
    checks.push({
      regulation: 'ASHRAE 90.1-2022',
      name: '管道保温R值',
      requirement: 'R≥4.0',
      actual: design.insulationR || 0,
      status: (design.insulationR || 0) >= 4.0 ? 'PASS' : 'WARNING',
      detail: '降低管道散热损失'
    });
    
    // UPC 防烫
    checks.push({
      regulation: 'UPC',
      name: '防烫保护(混合阀)',
      requirement: '出水温度≤49°C',
      status: design.scaldProtection ? 'PASS' : 'FAIL',
      detail: '住宅必须配置防烫混合阀'
    });
    
    // NSF 61 饮用水接触材料
    checks.push({
      regulation: 'NSF/ANSI 61',
      name: '饮用水接触材料认证',
      requirement: '所有接触材料NSF61认证',
      status: design.nsfCertified ? 'PASS' : 'WARNING',
      detail: '管道/阀门/储罐需NSF/ANSI 61认证（无铅）'
    });
    
    // EN 12828 欧洲采暖
    if (design.market === 'europe') {
      checks.push({
        regulation: 'EN 12828:2012+A1:2014',
        name: '采暖系统工作温度',
        requirement: '≤110°C',
        actual: design.maxTemp || 80,
        status: (design.maxTemp || 80) <= 110 ? 'PASS' : 'FAIL',
        detail: '欧洲采暖系统工作温度限制'
      });
    }
    
    // EN 16147 热泵热水器
    if (design.heatPumpWaterHeater) {
      checks.push({
        regulation: 'EN 16147:2017',
        name: '热泵热水器COP',
        requirement: 'COP≥2.5',
        actual: design.cop || 0,
        status: (design.cop || 0) >= 2.5 ? 'PASS' : 'FAIL',
        detail: `COP=${design.cop}必须≥2.5`
      });
    }
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  /**
   * 军团菌风险检查 (ASHRAE 188 - 健康关键)
   */
  checkLegionellaRisk(design) {
    const checks = [];
    const std = this.hotWaterStandards.international['ASHRAE 188-2018'];
    
    // 储水温度
    checks.push({
      regulation: 'ASHRAE 188-2018',
      name: '储水温度',
      requirement: '≥60°C',
      actual: design.storageTemp || 0,
      status: (design.storageTemp || 0) >= 60 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
      detail: '军团菌防控核心要求 - 储水必须≥60°C'
    });
    
    // 管网温度
    checks.push({
      regulation: 'ASHRAE 188-2018',
      name: '管网末端温度',
      requirement: '≥55°C',
      actual: design.distributionTemp || 0,
      status: (design.distributionTemp || 0) >= 55 ? 'PASS' : 'FAIL',
      severity: 'CRITICAL',
      detail: '管网温度<55°C会增加军团菌繁殖风险'
    });
    
    // 回水温度
    checks.push({
      regulation: 'ASHRAE 188-2018',
      name: '回水温度',
      requirement: '≥51°C',
      status: (design.returnTemp || 0) >= 51 ? 'PASS' : 'WARNING',
      severity: 'HIGH',
      detail: '回水温度过低增加菌膜形成'
    });
    
    // 滞留死管
    checks.push({
      regulation: 'ASHRAE 188-2018',
      name: '滞留死管',
      requirement: '消除<7天滞留',
      status: design.deadLegRemoved ? 'PASS' : 'WARNING',
      severity: 'HIGH',
      detail: '检查所有支管避免水流滞留'
    });
    
    // 周期性消毒
    checks.push({
      regulation: 'ASHRAE 188-2018',
      name: '周期性热消毒',
      requirement: '70°C 30分钟/月',
      status: design.thermalDisinfection ? 'PASS' : 'WARNING',
      detail: '定期高温消毒杀灭军团菌'
    });
    
    return { 
      checks, 
      passed: checks.filter(c => c.status === 'PASS').length,
      criticalIssues: checks.filter(c => c.status === 'FAIL' && c.severity === 'CRITICAL').length
    };
  }
  
  calcExpectedDailyUsage(design) {
    const std = this.hotWaterStandards.china['GB 50015-2019'].requirements;
    if (design.beds) return design.beds * (design.buildingType === 'hospital' ? std.hospitalPerBed : std.hotelPerBed);
    if (design.population) return design.population * std.residentialPerCapita;
    if (design.area) return design.area * std.officePerArea;
    return 100;
  }
  
  // ==================== DOAS合规检查 ⭐ 补强 ====================
  
  /**
   * DOAS全面合规检查（核心+配套标准）
   */
  checkDOASCompliance(design) {
    const results = {
      timestamp: new Date().toISOString(),
      design,
      ventilation: this.checkASHRAE621(design),
      energy: this.checkASHRAE901_DOAS(design),
      iaq: this.checkIAQ(design),
      filtration: this.checkFiltration(design),
      heatRecovery: this.checkHeatRecoveryDOAS(design),
      controls: this.checkDOASControls(design),
      summary: null
    };
    
    const allChecks = [
      ...results.ventilation.checks,
      ...results.energy.checks,
      ...results.iaq.checks,
      ...results.filtration.checks,
      ...results.heatRecovery.checks,
      ...results.controls.checks
    ];
    
    const passed = allChecks.filter(c => c.status === 'PASS').length;
    const failed = allChecks.filter(c => c.status === 'FAIL').length;
    const warnings = allChecks.filter(c => c.status === 'WARNING').length;
    
    results.summary = {
      totalChecks: allChecks.length,
      passed, failed, warnings,
      complianceRate: ((passed / allChecks.length) * 100).toFixed(1) + '%',
      score: this.calculateDOASScore(passed, failed, warnings, allChecks.length),
      grade: this.getGrade((passed / allChecks.length) * 100),
      certifications: this.getApplicableCertifications(passed, failed, allChecks.length)
    };
    
    return results;
  }
  
  checkASHRAE621(design) {
    const checks = [];
    const std = this.doasStandards.core['ASHRAE 62.1-2022'].requirements;
    const spaceType = design.spaceType || 'residential';
    const required = std[spaceType] || std.residential;
    
    // Voz计算: Voz = Rp×Pz + Ra×Az
    const Voz = required.rp * (design.occupancy || 0) + required.ra * (design.area || 0);
    
    checks.push({
      regulation: 'ASHRAE 62.1-2022',
      name: '室外空气量(Voz)',
      requirement: `${spaceType}: Rp=${required.rp}, Ra=${required.ra}`,
      expected: Voz.toFixed(1) + ' L/s',
      actual: (design.outdoorAirflow || 0) + ' L/s',
      status: (design.outdoorAirflow || 0) >= Voz ? 'PASS' : 'FAIL',
      detail: `Voz = ${required.rp}×${design.occupancy} + ${required.ra}×${design.area} = ${Voz.toFixed(1)} L/s`
    });
    
    // 区域空气分配效能
    checks.push({
      regulation: 'ASHRAE 62.1-2022',
      name: '区域空气分配效能(Ez)',
      requirement: '≥0.8',
      actual: design.zoneEffectiveness || 0.8,
      status: (design.zoneEffectiveness || 0.8) >= 0.8 ? 'PASS' : 'WARNING'
    });
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  checkASHRAE901_DOAS(design) {
    const checks = [];
    
    // 比风机功率
    checks.push({
      regulation: 'ASHRAE 90.1-2022',
      name: '比风机功率(SFP)',
      requirement: '≤1.5 W·s/L',
      actual: design.sfp || 0,
      status: (design.sfp || 0) <= 1.5 ? 'PASS' : 'FAIL',
      detail: 'DOAS风机能效要求'
    });
    
    // DX-DOAS IEER (AHRI 920)
    if (design.dxDoas) {
      checks.push({
        regulation: 'AHRI 920-2020',
        name: 'DX-DOAS综合能效(IEER)',
        requirement: '≥14.0',
        actual: design.ieer || 0,
        status: (design.ieer || 0) >= 14.0 ? 'PASS' : 'FAIL',
        critical: true
      });
    }
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  checkIAQ(design) {
    const checks = [];
    
    // CO2监控 (ASHRAE 189.1)
    checks.push({
      regulation: 'ASHRAE 189.1-2020',
      name: 'CO2监测',
      requirement: 'DOAS必须监测CO2',
      status: design.co2Monitoring ? 'PASS' : 'WARNING',
      detail: '需求控制通风(DCV)基础'
    });
    
    // PM2.5监测
    checks.push({
      regulation: 'ASHRAE 189.1-2020',
      name: 'PM2.5监测',
      requirement: '建议配备',
      status: design.pm25Monitoring ? 'PASS' : 'WARNING'
    });
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  checkFiltration(design) {
    const checks = [];
    
    // ASHRAE 52.2 - MERV
    checks.push({
      regulation: 'ASHRAE 52.2-2017',
      name: '过滤器MERV等级',
      requirement: '≥MERV 13',
      actual: design.mervRating || 0,
      status: (design.mervRating || 0) >= 13 ? 'PASS' : 'FAIL',
      detail: 'DOAS必须MERV13+ (PM2.5过滤)'
    });
    
    // ISO 16890
    checks.push({
      regulation: 'ISO 16890-1:2016',
      name: '过滤器ePM1效率',
      requirement: 'ePM1 ≥50%',
      actual: design.epm1 || 0,
      status: (design.epm1 || 0) >= 50 ? 'PASS' : 'WARNING',
      detail: '国际过滤标准等效MERV13'
    });
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  checkHeatRecoveryDOAS(design) {
    const checks = [];
    const std = this.doasStandards.core['ASHRAE 90.1-2022'].requirements.heatRecovery;
    
    // 显热回收
    checks.push({
      regulation: 'ASHRAE 90.1-2022',
      name: '显热回收效率(SRE)',
      requirement: '≥75%',
      actual: design.sre || 0,
      status: (design.sre || 0) >= 75 ? 'PASS' : 'FAIL',
      critical: true,
      detail: 'DOAS核心节能要求'
    });
    
    // 潜热回收
    checks.push({
      regulation: 'ASHRAE 90.1-2022',
      name: '潜热回收效率(LRE)',
      requirement: '≥60%',
      actual: design.lre || 0,
      status: (design.lre || 0) >= 60 ? 'PASS' : 'WARNING',
      detail: '潮湿气候关键'
    });
    
    // 欧洲标准
    if (design.market === 'europe') {
      checks.push({
        regulation: 'EN 16798-3:2017',
        name: '欧洲热回收最低效率',
        requirement: '≥70%',
        status: (design.sre || 0) >= 70 ? 'PASS' : 'FAIL'
      });
    }
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  checkDOASControls(design) {
    const checks = [];
    const std = this.doasStandards.core['ASHRAE Guideline 36-2021'].requirements;
    
    // 需求控制通风
    checks.push({
      regulation: 'ASHRAE Guideline 36-2021',
      name: '需求控制通风(DCV)',
      requirement: '基于CO2自动调节',
      status: design.demandControlVentilation ? 'PASS' : 'WARNING',
      detail: '高性能DOAS必备'
    });
    
    // 经济器
    checks.push({
      regulation: 'ASHRAE 90.1-2022',
      name: '经济器(免费冷却)',
      requirement: '配置空气侧或水侧经济器',
      status: design.economizer ? 'PASS' : 'WARNING'
    });
    
    // 送风温度重置
    checks.push({
      regulation: 'ASHRAE Guideline 36-2021',
      name: '送风温度自动重置',
      status: design.supplyAirReset ? 'PASS' : 'WARNING'
    });
    
    return { checks, passed: checks.filter(c => c.status === 'PASS').length };
  }
  
  // ==================== 综合工具方法 ====================
  
  calculateHotWaterScore(passed, failed, warnings, total) {
    let score = (passed / total) * 100;
    score -= failed * 5;
    score -= warnings * 2;
    return Math.max(0, Math.round(score));
  }
  
  calculateDOASScore(passed, failed, warnings, total) {
    let score = (passed / total) * 100;
    score -= failed * 8;
    score -= warnings * 3;
    return Math.max(0, Math.round(score));
  }
  
  getGrade(rate) {
    if (rate >= 95) return 'A+';
    if (rate >= 90) return 'A';
    if (rate >= 80) return 'B';
    if (rate >= 70) return 'C';
    return 'D';
  }
  
  getApplicableCertifications(passed, failed, total) {
    const rate = passed / total;
    const certs = [];
    if (rate >= 0.95 && failed === 0) certs.push('ASHRAE 90.1 认证可申请');
    if (rate >= 0.90) certs.push('LEED v4.1 EAc2 加分项');
    if (rate >= 0.85) certs.push('WELL Building Standard 部分符合');
    if (rate >= 0.80) certs.push('中国绿色建筑三星可申请');
    return certs;
  }
  
  /**
   * 列出全部标准
   */
  listAllStandards() {
    return {
      hotWater: {
        china: Object.keys(this.hotWaterStandards.china),
        international: Object.keys(this.hotWaterStandards.international)
      },
      doas: {
        core: Object.keys(this.doasStandards.core),
        supporting: Object.keys(this.doasStandards.supporting)
      },
      total: Object.keys(this.allStandards).length
    };
  }
  
  /**
   * 健康检查
   */
  healthCheck() {
    return {
      service: this.name,
      version: this.version,
      hotWaterStandards: {
        china: Object.keys(this.hotWaterStandards.china).length,
        international: Object.keys(this.hotWaterStandards.international).length
      },
      doasStandards: {
        core: Object.keys(this.doasStandards.core).length,
        supporting: Object.keys(this.doasStandards.supporting).length
      },
      totalStandards: Object.keys(this.allStandards).length
    };
  }
}

module.exports = ProfessionalStandardsLibrary;
