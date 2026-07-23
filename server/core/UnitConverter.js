/**
 * UnitConverter - 公制/英制单位自动切换引擎
 * V9 Sprint 5 核心交付物
 * 
 * HVAC专用单位转换: 温度、面积、体积流量、压力、功率、管径等
 */

class UnitConverter {
  constructor(system = 'metric') {
    this.version = '9.0.0';
    this.name = 'UnitConverter';
    this.system = system; // 'metric' | 'imperial'
    
    this.conversions = {
      // 温度
      temperature: {
        metric: { unit: '°C', label: '摄氏度' },
        imperial: { unit: '°F', label: 'Fahrenheit' },
        toImperial: (c) => c * 9/5 + 32,
        toMetric: (f) => (f - 32) * 5/9
      },
      temperatureDelta: {
        metric: { unit: '°C', label: '温差(℃)' },
        imperial: { unit: '°F', label: 'Delta °F' },
        toImperial: (dc) => dc * 9/5,
        toMetric: (df) => df * 5/9
      },
      // 长度
      length: {
        metric: { unit: 'm', label: '米' },
        imperial: { unit: 'ft', label: 'feet' },
        toImperial: (m) => m * 3.28084,
        toMetric: (ft) => ft / 3.28084
      },
      diameter: {
        metric: { unit: 'mm', label: '毫米' },
        imperial: { unit: 'in', label: 'inches' },
        toImperial: (mm) => mm / 25.4,
        toMetric: (inch) => inch * 25.4
      },
      // 面积
      area: {
        metric: { unit: 'm²', label: '平方米' },
        imperial: { unit: 'sq.ft', label: 'square feet' },
        toImperial: (m2) => m2 * 10.7639,
        toMetric: (sqft) => sqft / 10.7639
      },
      // 体积
      volume: {
        metric: { unit: 'L', label: '升' },
        imperial: { unit: 'gal', label: 'gallons' },
        toImperial: (l) => l * 0.264172,
        toMetric: (gal) => gal / 0.264172
      },
      // 体积流量
      volumeFlow: {
        metric: { unit: 'm³/h', label: '立方米/时' },
        imperial: { unit: 'CFM', label: 'CFM' },
        toImperial: (m3h) => m3h * 0.58858,
        toMetric: (cfm) => cfm / 0.58858
      },
      waterFlow: {
        metric: { unit: 'm³/h', label: '立方米/时' },
        imperial: { unit: 'GPM', label: 'GPM' },
        toImperial: (m3h) => m3h * 4.40287,
        toMetric: (gpm) => gpm / 4.40287
      },
      // 压力
      pressure: {
        metric: { unit: 'kPa', label: '千帕' },
        imperial: { unit: 'psi', label: 'PSI' },
        toImperial: (kpa) => kpa * 0.145038,
        toMetric: (psi) => psi / 0.145038
      },
      pressurePa: {
        metric: { unit: 'Pa', label: '帕斯卡' },
        imperial: { unit: 'inWG', label: 'in.WG' },
        toImperial: (pa) => pa * 0.00401865,
        toMetric: (inwg) => inwg / 0.00401865
      },
      // 功率/负荷
      power: {
        metric: { unit: 'W', label: '瓦' },
        imperial: { unit: 'BTU/h', label: 'BTU/h' },
        toImperial: (w) => w * 3.41214,
        toMetric: (btu) => btu / 3.41214
      },
      powerKW: {
        metric: { unit: 'kW', label: '千瓦' },
        imperial: { unit: 'ton', label: 'Ton(冷吨)' },
        toImperial: (kw) => kw / 3.517,
        toMetric: (ton) => ton * 3.517
      },
      // 能耗密度
      eui: {
        metric: { unit: 'kWh/m²·year', label: '千瓦时/平方米·年' },
        imperial: { unit: 'kBTU/sq.ft·year', label: 'kBTU/sq.ft·yr' },
        toImperial: (kwh_m2) => kwh_m2 * 0.316998,
        toMetric: (kbtu_sqft) => kbtu_sqft / 0.316998
      },
      // 负荷密度
      loadDensity: {
        metric: { unit: 'W/m²', label: '瓦/平方米' },
        imperial: { unit: 'BTU/h·sq.ft', label: 'BTU/h·sq.ft' },
        toImperial: (wm2) => wm2 * 0.316998,
        toMetric: (btu_sqft) => btu_sqft / 0.316998
      },
      // 速度
      velocity: {
        metric: { unit: 'm/s', label: '米/秒' },
        imperial: { unit: 'ft/min', label: 'FPM' },
        toImperial: (ms) => ms * 196.85,
        toMetric: (fpm) => fpm / 196.85
      },
      // 传热系数
      uValue: {
        metric: { unit: 'W/(m²·K)', label: '传热系数' },
        imperial: { unit: 'BTU/(h·ft²·°F)', label: 'U-factor' },
        toImperial: (u) => u * 0.176110,
        toMetric: (u) => u / 0.176110
      }
    };
  }

  /**
   * 设置单位制
   */
  setSystem(system) {
    if (system === 'metric' || system === 'imperial') {
      this.system = system;
      return true;
    }
    return false;
  }

  /**
   * 转换值
   */
  convert(value, type, toSystem = null) {
    const target = toSystem || this.system;
    const conv = this.conversions[type];
    if (!conv) return { value, unit: '?', error: `未知类型: ${type}` };

    if (target === 'imperial') {
      return {
        value: Math.round(conv.toImperial(value) * 100) / 100,
        unit: conv.imperial.unit,
        label: conv.imperial.label,
        original: { value, unit: conv.metric.unit }
      };
    } else {
      return {
        value: Math.round(conv.toMetric(value) * 100) / 100,
        unit: conv.metric.unit,
        label: conv.metric.label,
        original: { value, unit: conv.imperial.unit }
      };
    }
  }

  /**
   * 获取当前系统的单位
   */
  getUnit(type) {
    const conv = this.conversions[type];
    if (!conv) return '?';
    return this.system === 'imperial' ? conv.imperial.unit : conv.metric.unit;
  }

  /**
   * 批量转换 (用于整个负荷计算结果)
   */
  convertLoadResult(result) {
    if (this.system === 'metric') return result; // 内部全用公制
    return {
      ...result,
      peakCooling: this.convert(result.peakCooling || 0, 'power'),
      peakHeating: this.convert(result.peakHeating || 0, 'power'),
      peakCoolingDensity: this.convert(result.peakCoolingW_m2 || 0, 'loadDensity'),
      peakHeatingDensity: this.convert(result.peakHeatingW_m2 || 0, 'loadDensity'),
      annualCooling: { value: result.annualCoolingkWh, unit: 'kWh' },
      annualHeating: { value: result.annualHeatingkWh, unit: 'kWh' },
      area: this.convert(result.area || 0, 'area'),
      eui: this.convert(result.EUI || 0, 'eui'),
      unitSystem: 'imperial'
    };
  }

  /**
   * DN管径 ↔ NPS对照
   */
  convertPipeSize(dn) {
    const dnToNPS = { 15: '1/2"', 20: '3/4"', 25: '1"', 32: '1-1/4"', 40: '1-1/2"', 50: '2"', 65: '2-1/2"', 80: '3"', 100: '4"', 125: '5"', 150: '6"', 200: '8"', 250: '10"', 300: '12"' };
    return { dn: `DN${dn}`, nps: dnToNPS[dn] || `~${Math.round(dn/25.4)}"` };
  }

  health() {
    return {
      engine: this.name, version: this.version,
      system: this.system,
      supportedTypes: Object.keys(this.conversions),
      capabilities: ['公制/英制切换', 'HVAC专用单位', 'DN/NPS管径对照', '批量转换', '负荷结果转换']
    };
  }
}

module.exports = UnitConverter;
