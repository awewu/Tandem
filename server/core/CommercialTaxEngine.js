/**
 * 商用税费计算引擎
 * P1修复: 商用报价缺少增值税计算
 * 支持: 增值税(一般纳税人/小规模)、附加税、印花税
 */

class CommercialTaxEngine {
  constructor() {
    this.name = 'CommercialTaxEngine';
    this.version = '1.0.0';

    // 税率配置 (2026年标准)
    this.taxRates = {
      vat: {
        general: 0.13,        // 一般纳税人 13%
        small: 0.03,          // 小规模纳税人 3%
        construction: 0.09,   // 建筑服务 9%
        equipment: 0.13       // 设备销售 13%
      },
      surcharge: {
        cityMaintenance: 0.07,    // 城市维护建设税 7%
        educationSurcharge: 0.03, // 教育费附加 3%
        localEducation: 0.02      // 地方教育附加 2%
      },
      stampDuty: {
        constructionContract: 0.0003,  // 建设工程勘察设计合同 0.03%
        salesContract: 0.0003          // 购销合同 0.03%
      },
      incomeTax: {
        corporate: 0.25,      // 企业所得税 25%
        smallEnterprise: 0.20  // 小型微利企业 20%
      }
    };
  }

  /**
   * 计算商用项目完整税费
   * @param {Object} params - 报价参数
   * @param {number} params.equipmentAmount - 设备金额
   * @param {number} params.installationAmount - 安装金额
   * @param {number} params.designAmount - 设计金额
   * @param {string} params.taxpayerType - 纳税人类型 (general/small)
   * @param {string} params.projectType - 项目类型
   * @param {string} params.cityTier - 城市等级 (1/2/3)
   * @returns {Object} 完整税费计算结果
   */
  calculate(params) {
    const {
      equipmentAmount = 0,
      installationAmount = 0,
      designAmount = 0,
      taxpayerType = 'general',
      projectType = 'commercial',
      cityTier = '1'
    } = params;

    const subtotal = equipmentAmount + installationAmount + designAmount;

    // 1. 增值税计算
    const vat = this._calculateVAT({
      equipmentAmount,
      installationAmount,
      designAmount,
      taxpayerType
    });

    // 2. 附加税 (基于增值税额)
    const surcharge = this._calculateSurcharge(vat.totalVAT, cityTier);

    // 3. 印花税
    const stampDuty = this._calculateStampDuty({
      equipmentAmount,
      installationAmount,
      designAmount
    });

    // 4. 合计
    const totalTax = vat.totalVAT + surcharge.total + stampDuty.total;
    const totalWithTax = subtotal + totalTax;

    return {
      subtotal,
      tax: {
        vat,
        surcharge,
        stampDuty,
        total: totalTax,
        totalRate: subtotal > 0 ? (totalTax / subtotal * 100).toFixed(2) + '%' : '0%'
      },
      totalWithTax,
      breakdown: this._generateBreakdown({
        subtotal, vat, surcharge, stampDuty, totalTax, totalWithTax
      }),
      summary: {
        税前金额: subtotal.toFixed(2),
        增值税: vat.totalVAT.toFixed(2),
        附加税: surcharge.total.toFixed(2),
        印花税: stampDuty.total.toFixed(2),
        税费合计: totalTax.toFixed(2),
        税后总额: totalWithTax.toFixed(2),
        综合税负率: subtotal > 0 ? (totalTax / subtotal * 100).toFixed(2) + '%' : '0%'
      }
    };
  }

  _calculateVAT({ equipmentAmount, installationAmount, designAmount, taxpayerType }) {
    if (taxpayerType === 'small') {
      const totalAmount = equipmentAmount + installationAmount + designAmount;
      const vatAmount = totalAmount * this.taxRates.vat.small;
      return {
        items: [
          { name: '增值税(小规模)', rate: '3%', amount: vatAmount.toFixed(2) }
        ],
        totalVAT: vatAmount,
        taxpayerType: 'small'
      };
    }

    // 一般纳税人 - 分项计算
    const equipmentVAT = equipmentAmount * this.taxRates.vat.equipment;
    const installationVAT = installationAmount * this.taxRates.vat.construction;
    const designVAT = designAmount * this.taxRates.vat.general;

    const totalVAT = equipmentVAT + installationVAT + designVAT;

    return {
      items: [
        { name: '设备增值税', rate: '13%', base: equipmentAmount, amount: equipmentVAT.toFixed(2) },
        { name: '安装服务增值税', rate: '9%', base: installationAmount, amount: installationVAT.toFixed(2) },
        { name: '设计服务增值税', rate: '13%', base: designAmount, amount: designVAT.toFixed(2) }
      ],
      totalVAT,
      taxpayerType: 'general'
    };
  }

  _calculateSurcharge(vatAmount, cityTier) {
    // 城市维护建设税率根据城市等级不同
    const cityRate = cityTier === '1' ? 0.07 : (cityTier === '2' ? 0.05 : 0.01);

    const cityMaintenance = vatAmount * cityRate;
    const educationSurcharge = vatAmount * this.taxRates.surcharge.educationSurcharge;
    const localEducation = vatAmount * this.taxRates.surcharge.localEducation;

    const total = cityMaintenance + educationSurcharge + localEducation;

    return {
      items: [
        { name: '城市维护建设税', rate: (cityRate * 100) + '%', amount: cityMaintenance.toFixed(2) },
        { name: '教育费附加', rate: '3%', amount: educationSurcharge.toFixed(2) },
        { name: '地方教育附加', rate: '2%', amount: localEducation.toFixed(2) }
      ],
      total,
      cityTier
    };
  }

  _calculateStampDuty({ equipmentAmount, installationAmount, designAmount }) {
    const equipmentStamp = equipmentAmount * this.taxRates.stampDuty.salesContract;
    const constructionStamp = (installationAmount + designAmount) * this.taxRates.stampDuty.constructionContract;

    const total = equipmentStamp + constructionStamp;

    return {
      items: [
        { name: '购销合同印花税', rate: '0.03%', base: equipmentAmount, amount: equipmentStamp.toFixed(2) },
        { name: '建设合同印花税', rate: '0.03%', base: installationAmount + designAmount, amount: constructionStamp.toFixed(2) }
      ],
      total
    };
  }

  _generateBreakdown({ subtotal, vat, surcharge, stampDuty, totalTax, totalWithTax }) {
    const lines = [];

    lines.push({ category: '税前金额', items: [{ name: '合计', amount: subtotal.toFixed(2) }] });
    lines.push({ category: '增值税', items: vat.items });
    lines.push({ category: '附加税', items: surcharge.items });
    lines.push({ category: '印花税', items: stampDuty.items });
    lines.push({ category: '税费汇总', items: [
      { name: '税费合计', amount: totalTax.toFixed(2) },
      { name: '税后总额', amount: totalWithTax.toFixed(2) }
    ]});

    return lines;
  }

  /**
   * 生成家用报价 (不含税/含简易税)
   */
  calculateResidential(params) {
    const { totalAmount = 0 } = params;
    // 家用住宅一般不开票，或开普票(3%简易征收)
    const simpleVAT = totalAmount * 0.03;
    return {
      subtotal: totalAmount,
      noInvoice: { total: totalAmount, note: '不开票价格' },
      withInvoice: { total: totalAmount + simpleVAT, tax: simpleVAT, note: '含3%简易增值税' },
      summary: {
        不开票: totalAmount.toFixed(2),
        含票价: (totalAmount + simpleVAT).toFixed(2),
        税差: simpleVAT.toFixed(2)
      }
    };
  }
}

module.exports = CommercialTaxEngine;
