const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

const energyDatabase = {
  '五恒系统': {
    heatingConsumption: 45,
    coolingConsumption: 55,
    ventilationConsumption: 12,
    hotWaterConsumption: 35,
    copHeating: 3.8,
    copCooling: 4.2,
    renewableRatio: 0.35,
    peakLoadRatio: 0.65
  },
  '地暖系统': {
    heatingConsumption: 78,
    coolingConsumption: 0,
    ventilationConsumption: 0,
    hotWaterConsumption: 40,
    copHeating: 2.5,
    copCooling: 0,
    renewableRatio: 0.15,
    peakLoadRatio: 0.85
  },
  '中央空调': {
    heatingConsumption: 92,
    coolingConsumption: 88,
    ventilationConsumption: 0,
    hotWaterConsumption: 0,
    copHeating: 3.0,
    copCooling: 3.2,
    renewableRatio: 0.05,
    peakLoadRatio: 0.90
  },
  '传统空调+地暖': {
    heatingConsumption: 95,
    coolingConsumption: 85,
    ventilationConsumption: 0,
    hotWaterConsumption: 45,
    copHeating: 2.8,
    copCooling: 3.0,
    renewableRatio: 0.08,
    peakLoadRatio: 0.92
  },
  '新风系统': {
    heatingConsumption: 0,
    coolingConsumption: 0,
    ventilationConsumption: 8,
    hotWaterConsumption: 0,
    copHeating: 0,
    copCooling: 0,
    renewableRatio: 0,
    peakLoadRatio: 0.50
  }
};

const carbonFactors = {
  electricity: 0.5703,
  naturalGas: 0.202,
  coal: 0.315,
  renewable: 0.02
};

const energyPrices = {
  electricity: {
    residential: { peak: 0.617, valley: 0.307, average: 0.548 },
    commercial: { peak: 0.989, valley: 0.495, average: 0.867 }
  },
  naturalGas: 3.5,
  heating: 30
};

function calculateAnnualEnergy(systemType, area, city = '北京') {
  const data = energyDatabase[systemType] || energyDatabase['中央空调'];
  const climateFactors = {
    '北京': { heating: 1.2, cooling: 1.0 },
    '上海': { heating: 0.8, cooling: 1.3 },
    '广州': { heating: 0.3, cooling: 1.6 },
    '成都': { heating: 0.9, cooling: 1.1 },
    '哈尔滨': { heating: 1.8, cooling: 0.5 },
    '武汉': { heating: 1.0, cooling: 1.4 }
  };
  const climate = climateFactors[city] || climateFactors['北京'];
  const heatingEnergy = (data.heatingConsumption * climate.heating * area) / (data.copHeating || 1);
  const coolingEnergy = (data.coolingConsumption * climate.cooling * area) / (data.copCooling || 1);
  const ventilationEnergy = data.ventilationConsumption * area;
  const hotWaterEnergy = data.hotWaterConsumption * area / 3;
  const total = heatingEnergy + coolingEnergy + ventilationEnergy + hotWaterEnergy;

  return {
    heating: Math.round(heatingEnergy),
    cooling: Math.round(coolingEnergy),
    ventilation: Math.round(ventilationEnergy),
    hotWater: Math.round(hotWaterEnergy),
    total: Math.round(total),
    breakdown: {
      heatingPercent: Math.round((heatingEnergy / total) * 100),
      coolingPercent: Math.round((coolingEnergy / total) * 100),
      otherPercent: Math.round(((ventilationEnergy + hotWaterEnergy) / total) * 100)
    }
  };
}

function calculateCarbonEmissions(systemType, annualEnergy, area) {
  const data = energyDatabase[systemType] || energyDatabase['中央空调'];
  const renewableEnergy = annualEnergy.total * data.renewableRatio;
  const gridEnergy = annualEnergy.total - renewableEnergy;
  const directEmissions = {
    electricity: gridEnergy * carbonFactors.electricity,
    renewable: renewableEnergy * carbonFactors.renewable
  };
  const embodiedCarbon = {
    '五恒系统': 8500,
    '地暖系统': 3200,
    '中央空调': 4800,
    '传统空调+地暖': 5800,
    '新风系统': 1200
  };
  const systemLifespan = 15;
  const annualEmbodied = (embodiedCarbon[systemType] || 4000) / systemLifespan;
  const annualMaintenance = (embodiedCarbon[systemType] || 4000) * 0.02;
  const totalAnnual = directEmissions.electricity + directEmissions.renewable + annualEmbodied + annualMaintenance;

  return {
    annualTotal: Math.round(totalAnnual),
    perSquareMeter: Math.round((totalAnnual / area) * 100) / 100,
    breakdown: {
      directUsage: Math.round(directEmissions.electricity),
      embodied: Math.round(annualEmbodied),
      maintenance: Math.round(annualMaintenance),
      renewableOffset: Math.round(-renewableEnergy * (carbonFactors.electricity - carbonFactors.renewable))
    },
    lifecycle: {
      '5years': Math.round(totalAnnual * 5 + (embodiedCarbon[systemType] || 4000) * 0.3),
      '10years': Math.round(totalAnnual * 10 + (embodiedCarbon[systemType] || 4000) * 0.6),
      '15years': Math.round(totalAnnual * 15 + (embodiedCarbon[systemType] || 4000))
    }
  };
}

function calculateEnergyCost(annualEnergy, userType = 'residential') {
  const prices = energyPrices.electricity[userType] || energyPrices.electricity.residential;
  const peakEnergy = annualEnergy.total * 0.6;
  const valleyEnergy = annualEnergy.total * 0.4;
  const peakCost = peakEnergy * prices.peak;
  const valleyCost = valleyEnergy * prices.valley;
  const averageCost = annualEnergy.total * prices.average;

  return {
    annual: Math.round(averageCost),
    monthly: Math.round(averageCost / 12),
    optimized: {
      annual: Math.round(peakCost + valleyCost),
      monthly: Math.round((peakCost + valleyCost) / 12),
      savings: Math.round(averageCost - (peakCost + valleyCost))
    },
    unitCost: Math.round((averageCost / annualEnergy.total) * 100) / 100
  };
}

function generateRecommendations(systemType, efficiencyScore, annualEnergy) {
  const recommendations = [];
  if (efficiencyScore < 70) {
    recommendations.push({
      type: 'upgrade',
      priority: 'high',
      title: '考虑升级为五恒系统',
      description: '可节省约35%的能源消耗',
      potentialSavings: Math.round(annualEnergy.total * 0.35)
    });
  }
  if (annualEnergy.heating > annualEnergy.cooling * 2) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      title: '优化保温性能',
      description: '加强门窗保温可降低采暖能耗20%',
      potentialSavings: Math.round(annualEnergy.heating * 0.2)
    });
  }
  recommendations.push({
    type: 'behavior',
    priority: 'low',
    title: '使用峰谷电价',
    description: '合理安排高耗能设备使用时间',
    potentialSavings: Math.round(annualEnergy.total * 0.08)
  });
  return recommendations;
}

function getSystemDescription(system) {
  const descriptions = {
    '五恒系统': '恒温、恒湿、恒氧、恒洁、恒静，综合能效最高',
    '地暖系统': '舒适采暖，适合寒冷地区',
    '中央空调': '冷暖一体，适用范围广',
    '传统空调+地暖': '常规组合方案',
    '新风系统': '空气质量优化，能耗较低'
  };
  return descriptions[system] || '标准暖通系统';
}

function getSystemEfficiency(system) {
  const efficiency = {
    '五恒系统': { rating: 'A+', score: 95 },
    '地暖系统': { rating: 'B+', score: 75 },
    '中央空调': { rating: 'B', score: 70 },
    '传统空调+地暖': { rating: 'C', score: 60 },
    '新风系统': { rating: 'A', score: 88 }
  };
  return efficiency[system] || { rating: 'C', score: 60 };
}

function createEnergyCarbonRouter() {
  const router = express.Router();

  router.post('/api/energy/analysis', (req, res) => {
    try {
      const { systemType, area, city, userType = 'residential' } = req.body || {};
      if (!systemType || !area) {
        return res.status(400).json({ success: false, message: '缺少必要参数: systemType, area' });
      }
      const annualEnergy = calculateAnnualEnergy(systemType, area, city);
      const carbonEmissions = calculateCarbonEmissions(systemType, annualEnergy, area);
      const energyCost = calculateEnergyCost(annualEnergy, userType);
      const efficiencyScore = Math.max(0, Math.min(100, 100 - (annualEnergy.total / area - 50) * 0.5));
      const rating = efficiencyScore >= 90 ? 'A+' : efficiencyScore >= 80 ? 'A' : efficiencyScore >= 70 ? 'B' : efficiencyScore >= 60 ? 'C' : 'D';

      res.json({
        success: true,
        data: {
          systemType,
          area,
          city,
          annualEnergy,
          carbonEmissions,
          energyCost,
          efficiency: {
            score: Math.round(efficiencyScore),
            rating,
            kwhPerSqm: Math.round((annualEnergy.total / area) * 10) / 10,
            comparisonToNational: Math.round((100 - (annualEnergy.total / area) / 120 * 100) * 10) / 10
          },
          recommendations: generateRecommendations(systemType, efficiencyScore, annualEnergy)
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/energy/compare', (req, res) => {
    try {
      const { solutions, area, city, userType = 'residential' } = req.body || {};
      if (!solutions || !Array.isArray(solutions) || solutions.length < 2) {
        return res.status(400).json({ success: false, message: '请提供至少两个方案进行对比' });
      }
      const comparison = solutions.map(systemType => {
        const annualEnergy = calculateAnnualEnergy(systemType, area, city);
        const carbonEmissions = calculateCarbonEmissions(systemType, annualEnergy, area);
        const energyCost = calculateEnergyCost(annualEnergy, userType);
        return {
          systemType,
          annualEnergy,
          carbonEmissions,
          energyCost,
          efficiencyScore: Math.max(0, Math.min(100, 100 - (annualEnergy.total / area - 50) * 0.5))
        };
      });
      const bestEnergy = comparison.reduce((best, current) => current.annualEnergy.total < best.annualEnergy.total ? current : best);
      const bestCarbon = comparison.reduce((best, current) => current.carbonEmissions.annualTotal < best.carbonEmissions.annualTotal ? current : best);
      const bestCost = comparison.reduce((best, current) => current.energyCost.annual < best.energyCost.annual ? current : best);
      const baseline = comparison[0];
      const differences = comparison.map(item => ({
        systemType: item.systemType,
        energyDiff: Math.round(((item.annualEnergy.total - baseline.annualEnergy.total) / baseline.annualEnergy.total) * 100),
        carbonDiff: Math.round(((item.carbonEmissions.annualTotal - baseline.carbonEmissions.annualTotal) / baseline.carbonEmissions.annualTotal) * 100),
        costDiff: Math.round(((item.energyCost.annual - baseline.energyCost.annual) / baseline.energyCost.annual) * 100)
      }));

      res.json({
        success: true,
        data: {
          comparison,
          winners: {
            energyEfficiency: { systemType: bestEnergy.systemType, value: bestEnergy.annualEnergy.total, unit: 'kWh/年' },
            carbonReduction: { systemType: bestCarbon.systemType, value: bestCarbon.carbonEmissions.annualTotal, unit: 'kg CO2/年' },
            costEffective: { systemType: bestCost.systemType, value: bestCost.energyCost.annual, unit: '元/年' }
          },
          differences,
          analysisPeriod: '15年生命周期',
          totalSavings: {
            vsBaseline: {
              energy: Math.round((baseline.annualEnergy.total - bestEnergy.annualEnergy.total) * 15),
              carbon: Math.round((baseline.carbonEmissions.annualTotal - bestCarbon.carbonEmissions.annualTotal) * 15),
              cost: Math.round((baseline.energyCost.annual - bestCost.energyCost.annual) * 15)
            }
          }
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/carbon/calculate', (req, res) => {
    try {
      const { systemType, area, city, years = 15 } = req.body || {};
      if (!systemType || !area) {
        return res.status(400).json({ success: false, message: '缺少必要参数' });
      }
      const annualEnergy = calculateAnnualEnergy(systemType, area, city);
      const carbon = calculateCarbonEmissions(systemType, annualEnergy, area);
      const baselineEnergy = calculateAnnualEnergy('传统空调+地暖', area, city);
      const baselineCarbon = calculateCarbonEmissions('传统空调+地暖', baselineEnergy, area);
      const reduction = {
        annual: baselineCarbon.annualTotal - carbon.annualTotal,
        total: (baselineCarbon.annualTotal - carbon.annualTotal) * years,
        percent: Math.round(((baselineCarbon.annualTotal - carbon.annualTotal) / baselineCarbon.annualTotal) * 100)
      };
      const treeEquivalent = Math.round(reduction.annual / 18);
      const carEquivalent = Math.round(reduction.annual / 2000);

      res.json({
        success: true,
        data: {
          systemType,
          area,
          years,
          carbonEmissions: carbon,
          reduction: {
            vsTraditional: reduction,
            treeEquivalent: `${treeEquivalent}棵/年`,
            carEquivalent: `减少${carEquivalent}辆燃油车年排放`
          },
          offsets: {
            canOffset: reduction.annual > 0,
            suggestions: reduction.annual > 0
              ? [`相当于种植${treeEquivalent}棵树`, '建议选择低碳建材', '可参与碳交易获得收益']
              : ['该方案碳排放较高，建议优化']
          },
          compliance: {
            meets2030Target: reduction.percent >= 30,
            meets2060Target: reduction.percent >= 80,
            carbonNeutralPossible: reduction.percent >= 90
          }
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/energy/systems', (req, res) => {
    res.json({
      success: true,
      data: Object.keys(energyDatabase).map(system => ({
        name: system,
        description: getSystemDescription(system),
        efficiency: getSystemEfficiency(system)
      }))
    });
  });

  router.post('/api/energy/realtime', (req, res) => {
    try {
      const { systemType, area, duration = 'day' } = req.body || {};
      const baseConsumption = energyDatabase[systemType] || energyDatabase['中央空调'];
      const dailyTotal = (baseConsumption.heatingConsumption + baseConsumption.coolingConsumption + baseConsumption.ventilationConsumption) * area / 365;
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const peakFactor = (hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22) ? 1.5 : 0.8;
        const randomFactor = 0.9 + Math.random() * 0.2;
        return {
          hour,
          consumption: Math.round((dailyTotal / 24) * peakFactor * randomFactor * 10) / 10,
          cost: Math.round(((dailyTotal / 24) * peakFactor * randomFactor * 0.548) * 100) / 100
        };
      });

      res.json({
        success: true,
        data: {
          duration,
          hourlyData,
          summary: {
            totalConsumption: Math.round(hourlyData.reduce((sum, h) => sum + h.consumption, 0) * 10) / 10,
            totalCost: Math.round(hourlyData.reduce((sum, h) => sum + h.cost, 0) * 100) / 100,
            peakHour: hourlyData.reduce((max, h) => h.consumption > max.consumption ? h : max, hourlyData[0]).hour,
            offPeakConsumption: Math.round(hourlyData.filter(h => h.hour < 7 || h.hour > 22).reduce((sum, h) => sum + h.consumption, 0) * 10) / 10
          },
          alerts: hourlyData.some(h => h.consumption > (dailyTotal / 24) * 2) ? ['检测到异常高能耗时段'] : []
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createEnergyCarbonRouter;
module.exports.energyDatabase = energyDatabase;
module.exports.calculateAnnualEnergy = calculateAnnualEnergy;
module.exports.calculateCarbonEmissions = calculateCarbonEmissions;
module.exports.calculateEnergyCost = calculateEnergyCost;
