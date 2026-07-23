/**
 * 经销商报价引擎
 * 三档报价体系：基础型/标准型/豪华型
 * 测算真实材料成本 + 合理利润率
 */

// 报价方案类型
export type QuotationType = 'basic' | 'standard' | 'premium';

// 材料成本项
export interface MaterialCost {
  category: string;           // 分类：设备/管材/阀门/辅材
  name: string;             // 材料名称
  model: string;            // 型号规格
  brand: string;            // 品牌
  unit: string;             // 单位
  quantity: number;         // 数量
  unitCost: number;         // 单价（进货成本）
  unitPrice: number;        // 销售单价
  totalCost: number;        // 总成本
  totalPrice: number;       // 总价
  description?: string;      // 说明
}

// 人工成本项
export interface LaborCost {
  item: string;             // 施工项目
  unit: string;             // 单位
  quantity: number;         // 数量
  unitPrice: number;        // 单价
  totalPrice: number;       // 总价
  description?: string;      // 说明
}

// 报价方案
export interface QuotationScheme {
  type: QuotationType;
  name: string;
  description: string;
  matchRate: number;        // 客户匹配度
  selectRate: number;       // 历史选择率
  
  // 成本构成
  materialCosts: MaterialCost[];
  laborCosts: LaborCost[];
  otherCosts: { name: string; amount: number }[];
  
  // 汇总
  totalMaterialCost: number;    // 材料总成本
  totalLaborCost: number;     // 人工总成本
  totalOtherCost: number;     // 其他费用
  totalCost: number;          // 总成本
  
  // 报价
  profitMargin: number;       // 利润率
  totalPrice: number;         // 总报价
  unitPrice: number;          // 单位造价（元/客房或元/床位）
  
  // 性价比说明
  roiAnalysis: string;        // ROI分析
  paybackPeriod: number;      // 投资回收期（年）
  annualSaving: number;       // 年节省费用
}

// 三档报价配置
const QUOTATION_CONFIG: Record<QuotationType, {
  name: string;
  description: string;
  profitMargin: number;       // 利润率
  matchRate: number;          // 客户匹配度
  selectRate: number;         // 历史选择率
  equipmentBrand: string[];    // 可选品牌
  features: string[];         // 方案特点
}> = {
  basic: {
    name: '基础型方案',
    description: '经济实用，满足基本需求',
    profitMargin: 0.15,         // 15%利润率
    matchRate: 25,
    selectRate: 32,
    equipmentBrand: ['国产一线', '合资品牌'],
    features: [
      '常规空气能热泵',
      '标准储热水箱',
      '基本控制系统',
      '2年质保',
    ],
  },
  standard: {
    name: '标准型方案',
    description: '高性价比，品质与价格平衡',
    profitMargin: 0.22,         // 22%利润率
    matchRate: 68,
    selectRate: 68,
    equipmentBrand: ['合资品牌', '进口品牌'],
    features: [
      '高效空气能热泵（COP≥4.0）',
      '保温储热水箱（不锈钢内胆）',
      '智能控制系统',
      '3年质保',
      '免费年度巡检',
    ],
  },
  premium: {
    name: '豪华型方案',
    description: '高端配置，全气候适应',
    profitMargin: 0.28,         // 28%利润率
    matchRate: 15,
    selectRate: 15,
    equipmentBrand: ['进口品牌', '高端品牌'],
    features: [
      '超低温空气能热泵（-30℃稳定运行）',
      '承压储热水箱（搪瓷内胆）',
      'AI智能控制系统',
      '太阳能辅助加热',
      '5年质保',
      '终身技术支持',
      '远程监控服务',
    ],
  },
};

// 材料价格库（真实成本价，经销商进货价）
const MATERIAL_PRICE_LIBRARY: Record<string, { cost: number; price: number; unit: string }> = {
  // 主机设备
  'air-pump-19kw': { cost: 18000, price: 28000, unit: '台' },
  'air-pump-38kw': { cost: 32000, price: 48000, unit: '台' },
  'air-pump-low-19kw': { cost: 22000, price: 32000, unit: '台' },
  'air-pump-low-38kw': { cost: 38000, price: 55000, unit: '台' },
  'air-pump-ultra-30kw': { cost: 35000, price: 45000, unit: '台' },
  'solar-collector': { cost: 800, price: 1200, unit: '组' },
  
  // 储热水箱
  'tank-open-500L': { cost: 2500, price: 3800, unit: '个' },
  'tank-open-1000L': { cost: 4500, price: 6800, unit: '个' },
  'tank-open-2000L': { cost: 8000, price: 12000, unit: '个' },
  'tank-press-500L': { cost: 3800, price: 5800, unit: '个' },
  'tank-press-1000L': { cost: 6500, price: 9800, unit: '个' },
  
  // 管材管件
  'pipe-ppr-dn25': { cost: 8, price: 12, unit: '米' },
  'pipe-ppr-dn32': { cost: 12, price: 18, unit: '米' },
  'pipe-ppr-dn40': { cost: 18, price: 28, unit: '米' },
  'pipe-ppr-dn50': { cost: 28, price: 42, unit: '米' },
  'insulation-dn25': { cost: 3, price: 5, unit: '米' },
  'insulation-dn32': { cost: 4, price: 6, unit: '米' },
  
  // 阀门
  'valve-gate-dn25': { cost: 35, price: 55, unit: '个' },
  'valve-gate-dn32': { cost: 48, price: 75, unit: '个' },
  'valve-check-dn25': { cost: 28, price: 45, unit: '个' },
  'valve-mix': { cost: 180, price: 280, unit: '个' },
  
  // 循环泵
  'pump-circulation-small': { cost: 450, price: 680, unit: '台' },
  'pump-circulation-medium': { cost: 680, price: 980, unit: '台' },
  'pump-circulation-large': { cost: 950, price: 1350, unit: '台' },
  
  // 控制系统
  'control-basic': { cost: 800, price: 1200, unit: '套' },
  'control-smart': { cost: 1500, price: 2200, unit: '套' },
  'control-ai': { cost: 2800, price: 4200, unit: '套' },
  
  // 辅材
  'fitting-elbow': { cost: 3, price: 5, unit: '个' },
  'fitting-tee': { cost: 5, price: 8, unit: '个' },
  'fitting-reducer': { cost: 6, price: 10, unit: '个' },
  'hanger': { cost: 8, price: 12, unit: '套' },
};

// 人工成本库
const LABOR_COST_LIBRARY: Record<string, { price: number; unit: string }> = {
  'install-equipment': { price: 800, unit: '台' },
  'install-tank': { price: 600, unit: '个' },
  'pipe-install-dn25': { price: 15, unit: '米' },
  'pipe-install-dn32': { price: 18, unit: '米' },
  'pipe-install-dn40': { price: 22, unit: '米' },
  'insulation': { price: 8, unit: '米' },
  'electrical': { price: 2000, unit: '项' },
  'debug': { price: 1500, unit: '项' },
};

export class QuotationEngine {
  /**
   * 生成三档报价方案
   */
  generateQuotationSchemes(
    equipmentPower: number,      // 设备功率需求(kW)
    storageVolume: number,      // 储水箱容积(L)
    pipeLength: number,         // 管道长度(估算)
    unitCount: number,          // 单位数(客房/床位)
    buildingType: string        // 建筑类型
  ): QuotationScheme[] {
    const schemes: QuotationScheme[] = [];
    
    for (const type of ['basic', 'standard', 'premium'] as QuotationType[]) {
      const scheme = this.generateSingleScheme(
        type,
        equipmentPower,
        storageVolume,
        pipeLength,
        unitCount,
        buildingType
      );
      schemes.push(scheme);
    }
    
    return schemes;
  }
  
  private generateSingleScheme(
    type: QuotationType,
    equipmentPower: number,
    storageVolume: number,
    pipeLength: number,
    unitCount: number,
    buildingType: string
  ): QuotationScheme {
    const config = QUOTATION_CONFIG[type];
    
    // 1. 生成材料清单
    const materialCosts = this.generateMaterialList(
      type,
      equipmentPower,
      storageVolume,
      pipeLength
    );
    
    // 2. 生成人工清单
    const laborCosts = this.generateLaborList(
      type,
      equipmentPower,
      storageVolume,
      pipeLength
    );
    
    // 3. 计算汇总
    const totalMaterialCost = materialCosts.reduce((sum, m) => sum + m.totalCost, 0);
    const totalLaborCost = laborCosts.reduce((sum, l) => sum + l.totalPrice, 0);
    
    // 其他费用（运输、管理、税费等）
    const otherCosts = [
      { name: '运输费', amount: Math.round(totalMaterialCost * 0.02) },
      { name: '管理费', amount: Math.round(totalMaterialCost * 0.03) },
      { name: '税费', amount: 0 }, // 报价不含税，需注明
    ];
    const totalOtherCost = otherCosts.reduce((sum, o) => sum + o.amount, 0);
    
    const totalCost = totalMaterialCost + totalLaborCost + totalOtherCost;
    
    // 4. 计算报价
    const totalPrice = Math.round(totalCost * (1 + config.profitMargin));
    const unitPrice = Math.round(totalPrice / unitCount);
    
    // 5. ROI分析（基于年节能效益）
    const annualSaving = this.calculateAnnualSaving(type, equipmentPower);
    const paybackPeriod = totalPrice / (annualSaving * (1 + config.profitMargin));
    
    // ROI分析文案
    const roiAnalysis = this.generateROIAnalysis(type, annualSaving, paybackPeriod);
    
    return {
      type,
      name: config.name,
      description: config.description,
      matchRate: config.matchRate,
      selectRate: config.selectRate,
      materialCosts,
      laborCosts,
      otherCosts,
      totalMaterialCost,
      totalLaborCost,
      totalOtherCost,
      totalCost,
      profitMargin: config.profitMargin,
      totalPrice,
      unitPrice,
      roiAnalysis,
      paybackPeriod: Math.round(paybackPeriod * 10) / 10,
      annualSaving,
    };
  }
  
  /**
   * 生成材料清单
   */
  private generateMaterialList(
    type: QuotationType,
    equipmentPower: number,
    storageVolume: number,
    pipeLength: number
  ): MaterialCost[] {
    const materials: MaterialCost[] = [];
    
    // 1. 主机设备选型
    const equipmentQty = Math.ceil(equipmentPower / 38); // 38kW为单机最大功率
    const equipmentCode = this.selectEquipment(type, equipmentPower);
    const equipmentPrice = MATERIAL_PRICE_LIBRARY[equipmentCode];
    
    materials.push({
      category: '设备',
      name: '空气源热泵主机',
      model: this.getEquipmentModel(type, equipmentPower),
      brand: type === 'basic' ? '国产一线品牌' : type === 'standard' ? '合资品牌' : '进口高端品牌',
      unit: equipmentPrice.unit,
      quantity: equipmentQty,
      unitCost: equipmentPrice.cost,
      unitPrice: equipmentPrice.price,
      totalCost: equipmentPrice.cost * equipmentQty,
      totalPrice: equipmentPrice.price * equipmentQty,
      description: `制热量${equipmentPower}kW`,
    });
    
    // 备用机组（标准型和豪华型）
    if (type !== 'basic' && equipmentQty >= 2) {
      materials.push({
        category: '设备',
        name: '备用空气源热泵主机',
        model: this.getEquipmentModel(type, equipmentPower / equipmentQty),
        brand: type === 'standard' ? '合资品牌' : '进口高端品牌',
        unit: equipmentPrice.unit,
        quantity: 1,
        unitCost: equipmentPrice.cost,
        unitPrice: equipmentPrice.price,
        totalCost: equipmentPrice.cost,
        totalPrice: equipmentPrice.price,
        description: 'N+1备份配置',
      });
    }
    
    // 2. 储热水箱
    const tankCode = this.selectTank(type, storageVolume);
    const tankPrice = MATERIAL_PRICE_LIBRARY[tankCode];
    const tankQty = Math.ceil(storageVolume / this.getTankVolume(tankCode));
    
    materials.push({
      category: '设备',
      name: '储热水箱',
      model: this.getTankModel(type, storageVolume),
      brand: '定制',
      unit: tankPrice.unit,
      quantity: tankQty,
      unitCost: tankPrice.cost,
      unitPrice: tankPrice.price,
      totalCost: tankPrice.cost * tankQty,
      totalPrice: tankPrice.price * tankQty,
      description: `总容积${storageVolume}L`,
    });
    
    // 3. 太阳能辅助（仅豪华型）
    if (type === 'premium') {
      const solarArea = Math.ceil(storageVolume / 50); // 50L热水/㎡集热器
      const solarQty = Math.ceil(solarArea / 2); // 每组2㎡
      const solarPrice = MATERIAL_PRICE_LIBRARY['solar-collector'];
      
      materials.push({
        category: '设备',
        name: '平板太阳能集热器',
        model: '2㎡/组',
        brand: '进口品牌',
        unit: solarPrice.unit,
        quantity: solarQty,
        unitCost: solarPrice.cost,
        unitPrice: solarPrice.price,
        totalCost: solarPrice.cost * solarQty,
        totalPrice: solarPrice.price * solarQty,
        description: `集热面积${solarArea}㎡`,
      });
    }
    
    // 4. 管材（按估算长度）
    const pipeSizes = [
      { code: 'pipe-ppr-dn25', percent: 0.4, length: pipeLength * 0.4 },
      { code: 'pipe-ppr-dn32', percent: 0.35, length: pipeLength * 0.35 },
      { code: 'pipe-ppr-dn40', percent: 0.25, length: pipeLength * 0.25 },
    ];
    
    for (const pipe of pipeSizes) {
      const price = MATERIAL_PRICE_LIBRARY[pipe.code];
      materials.push({
        category: '管材',
        name: 'PPR给水管',
        model: pipe.code.split('-').pop()?.toUpperCase(),
        brand: '国产优质',
        unit: price.unit,
        quantity: Math.round(pipe.length),
        unitCost: price.cost,
        unitPrice: price.price,
        totalCost: price.cost * Math.round(pipe.length),
        totalPrice: price.price * Math.round(pipe.length),
      });
    }
    
    // 5. 保温
    for (const pipe of pipeSizes) {
      const insulationCode = `insulation-${pipe.code.split('-').pop()}`;
      if (MATERIAL_PRICE_LIBRARY[insulationCode]) {
        const price = MATERIAL_PRICE_LIBRARY[insulationCode];
        materials.push({
          category: '保温',
          name: '橡塑保温棉',
          model: `${pipe.code.split('-').pop()?.toUpperCase()} 20mm厚`,
          brand: '国产优质',
          unit: price.unit,
          quantity: Math.round(pipe.length),
          unitCost: price.cost,
          unitPrice: price.price,
          totalCost: price.cost * Math.round(pipe.length),
          totalPrice: price.price * Math.round(pipe.length),
        });
      }
    }
    
    // 6. 阀门
    const valveQty = Math.ceil(pipeLength / 20); // 每20米一个阀门
    const valvePrice = MATERIAL_PRICE_LIBRARY['valve-gate-dn32'];
    materials.push({
      category: '阀门',
      name: '闸阀',
      model: 'DN32',
      brand: '国产优质',
      unit: valvePrice.unit,
      quantity: valveQty,
      unitCost: valvePrice.cost,
      unitPrice: valvePrice.price,
      totalCost: valvePrice.cost * valveQty,
      totalPrice: valvePrice.price * valveQty,
    });
    
    // 7. 循环泵
    const pumpQty = Math.ceil(equipmentPower / 20);
    const pumpCode = pumpQty <= 2 ? 'pump-circulation-small' : 
                     pumpQty <= 4 ? 'pump-circulation-medium' : 'pump-circulation-large';
    const pumpPrice = MATERIAL_PRICE_LIBRARY[pumpCode];
    
    materials.push({
      category: '设备',
      name: '热水循环泵',
      model: type === 'premium' ? '变频型' : '定频型',
      brand: type === 'basic' ? '国产' : '格兰富/威乐',
      unit: pumpPrice.unit,
      quantity: pumpQty,
      unitCost: pumpPrice.cost,
      unitPrice: pumpPrice.price,
      totalCost: pumpPrice.cost * pumpQty,
      totalPrice: pumpPrice.price * pumpQty,
    });
    
    // 8. 控制系统
    const controlCode = type === 'basic' ? 'control-basic' : 
                        type === 'standard' ? 'control-smart' : 'control-ai';
    const controlPrice = MATERIAL_PRICE_LIBRARY[controlCode];
    
    materials.push({
      category: '设备',
      name: '智能控制系统',
      model: type === 'premium' ? 'AI控制+远程监控' : type === 'standard' ? '智能控制' : '基础控制',
      brand: '定制',
      unit: controlPrice.unit,
      quantity: 1,
      unitCost: controlPrice.cost,
      unitPrice: controlPrice.price,
      totalCost: controlPrice.cost,
      totalPrice: controlPrice.price,
    });
    
    return materials;
  }
  
  /**
   * 生成人工清单
   */
  private generateLaborList(
    type: QuotationType,
    equipmentPower: number,
    storageVolume: number,
    pipeLength: number
  ): LaborCost[] {
    const labors: LaborCost[] = [];
    
    // 设备数量
    const equipmentQty = Math.ceil(equipmentPower / 38);
    const tankQty = Math.ceil(storageVolume / 2000);
    
    // 1. 设备安装
    const installPrice = LABOR_COST_LIBRARY['install-equipment'];
    labors.push({
      item: '热泵主机安装',
      unit: installPrice.unit,
      quantity: equipmentQty,
      unitPrice: installPrice.price,
      totalPrice: installPrice.price * equipmentQty,
    });
    
    // 2. 水箱安装
    const tankPrice = LABOR_COST_LIBRARY['install-tank'];
    labors.push({
      item: '储热水箱安装',
      unit: tankPrice.unit,
      quantity: tankQty,
      unitPrice: tankPrice.price,
      totalPrice: tankPrice.price * tankQty,
    });
    
    // 3. 管道安装（分段计算）
    const pipeSizes = [
      { length: pipeLength * 0.4, price: LABOR_COST_LIBRARY['pipe-install-dn25'] },
      { length: pipeLength * 0.35, price: LABOR_COST_LIBRARY['pipe-install-dn32'] },
      { length: pipeLength * 0.25, price: LABOR_COST_LIBRARY['pipe-install-dn40'] },
    ];
    
    for (const pipe of pipeSizes) {
      labors.push({
        item: `管道安装 ${pipe.price.unit.replace('米', '').toUpperCase()}`,
        unit: pipe.price.unit,
        quantity: Math.round(pipe.length),
        unitPrice: pipe.price.price,
        totalPrice: pipe.price.price * Math.round(pipe.length),
      });
    }
    
    // 4. 保温安装
    const insulationPrice = LABOR_COST_LIBRARY['insulation'];
    labors.push({
      item: '管道保温',
      unit: insulationPrice.unit,
      quantity: Math.round(pipeLength),
      unitPrice: insulationPrice.price,
      totalPrice: insulationPrice.price * Math.round(pipeLength),
    });
    
    // 5. 电气安装
    const electricalPrice = LABOR_COST_LIBRARY['electrical'];
    labors.push({
      item: '电气控制安装',
      unit: electricalPrice.unit,
      quantity: 1,
      unitPrice: type === 'premium' ? electricalPrice.price * 1.5 : electricalPrice.price,
      totalPrice: type === 'premium' ? electricalPrice.price * 1.5 : electricalPrice.price,
    });
    
    // 6. 系统调试
    const debugPrice = LABOR_COST_LIBRARY['debug'];
    labors.push({
      item: '系统调试',
      unit: debugPrice.unit,
      quantity: 1,
      unitPrice: debugPrice.price,
      totalPrice: debugPrice.price,
      description: '含水质检测',
    });
    
    return labors;
  }
  
  /**
   * 计算年节能效益
   */
  private calculateAnnualSaving(type: QuotationType, equipmentPower: number): number {
    // 年运行小时数（酒店为例）
    const annualHours = 365 * 18; // 每天18小时运行
    
    // COP值
    const cop = type === 'basic' ? 3.5 : type === 'standard' ? 4.0 : 4.2;
    
    // 电加热对比（COP=0.95）
    const electricityCOP = 0.95;
    
    // 电价（商业电价）
    const electricityPrice = 0.8; // 元/kWh
    
    // 年耗热量
    const annualHeat = equipmentPower * annualHours;
    
    // 空气能年电费
    const airSourceCost = annualHeat / cop * electricityPrice;
    
    // 电加热年电费
    const electricCost = annualHeat / electricityCOP * electricityPrice;
    
    // 年节省
    return Math.round(electricCost - airSourceCost);
  }
  
  /**
   * 生成ROI分析文案
   */
  private generateROIAnalysis(type: QuotationType, annualSaving: number, paybackPeriod: number): string {
    if (type === 'basic') {
      return `采用常规空气能技术，相比电加热年节省约${(annualSaving / 10000).toFixed(1)}万元，投资回收期约${paybackPeriod.toFixed(1)}年。`;
    } else if (type === 'standard') {
      return `采用高效空气能技术，COP≥4.0，相比电加热年节省约${(annualSaving / 10000).toFixed(1)}万元，投资回收期约${paybackPeriod.toFixed(1)}年，性价比最优。`;
    } else {
      return `采用超低温空气能+太阳能辅助，COP≥4.2，相比电加热年节省约${(annualSaving / 10000).toFixed(1)}万元，虽然投资回收期约${paybackPeriod.toFixed(1)}年，但可获得最佳使用体验和最长使用寿命。`;
    }
  }
  
  // 辅助方法
  private selectEquipment(type: QuotationType, power: number): string {
    if (type === 'basic') {
      return power <= 20 ? 'air-pump-19kw' : 'air-pump-38kw';
    } else if (type === 'standard') {
      return power <= 20 ? 'air-pump-low-19kw' : 'air-pump-low-38kw';
    } else {
      return 'air-pump-ultra-30kw';
    }
  }
  
  private getEquipmentModel(type: QuotationType, power: number): string {
    if (type === 'basic') {
      return power <= 20 ? '常温型 19kW' : '常温型 38kW';
    } else if (type === 'standard') {
      return power <= 20 ? '低温型 19kW' : '低温型 38kW';
    } else {
      return '超低温型 30kW';
    }
  }
  
  private selectTank(type: QuotationType, volume: number): string {
    const isPressurized = type === 'premium';
    
    if (volume <= 500) {
      return isPressurized ? 'tank-press-500L' : 'tank-open-500L';
    } else if (volume <= 1000) {
      return isPressurized ? 'tank-press-1000L' : 'tank-open-1000L';
    } else {
      return isPressurized ? 'tank-press-1000L' : 'tank-open-2000L';
    }
  }
  
  private getTankModel(type: QuotationType, volume: number): string {
    const isPressurized = type === 'premium';
    const tankVol = volume <= 500 ? '500L' : volume <= 1000 ? '1000L' : '2000L';
    const innerTank = type === 'basic' ? '不锈钢' : type === 'standard' ? '304不锈钢' : '搪瓷内胆';
    
    return `${isPressurized ? '承压式' : '开式'} ${tankVol} ${innerTank}`;
  }
  
  private getTankVolume(code: string): number {
    if (code.includes('500')) return 500;
    if (code.includes('1000')) return 1000;
    if (code.includes('2000')) return 2000;
    return 1000;
  }
}

// 导出单例
export const quotationEngine = new QuotationEngine();
