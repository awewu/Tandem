/**
 * Quote Engine - 报价引擎
 * 生成专业HVAC系统报价单
 */

class QuoteEngine {
  constructor() {
    this.version = '1.0.0';
    this.name = 'QuoteEngine';
  }

  generate(params) {
    const { design, devices, services = [] } = params;
    
    // 基础价格计算
    const deviceCost = this.calculateDeviceCost(devices);
    const installationCost = this.calculateInstallationCost(design);
    const serviceCost = this.calculateServiceCost(services);
    
    const subtotal = deviceCost + installationCost + serviceCost;
    const tax = subtotal * 0.13; // 13%增值税
    const total = subtotal + tax;
    
    return {
      quoteId: `QT${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary: {
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        total: Math.round(total),
        currency: 'CNY'
      },
      details: {
        devices: {
          items: devices || [],
          total: Math.round(deviceCost)
        },
        installation: {
          description: design ? '标准安装' : '基础安装',
          total: Math.round(installationCost)
        },
        services: {
          items: services,
          total: Math.round(serviceCost)
        }
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      terms: '报价有效期30天，最终价格以合同为准'
    };
  }

  calculateDeviceCost(devices) {
    if (!devices || !Array.isArray(devices)) return 0;
    return devices.reduce((sum, device) => {
      return sum + (device.price || 0) * (device.quantity || 1);
    }, 0);
  }

  calculateInstallationCost(design) {
    if (!design) return 5000;
    const area = design.area || 100;
    return area * 150; // 150元/平米安装费
  }

  calculateServiceCost(services) {
    if (!services || !Array.isArray(services)) return 0;
    const servicePrices = {
      'design': 3000,
      'consulting': 1000,
      'maintenance_1y': 2000,
      'maintenance_3y': 5000
    };
    
    return services.reduce((sum, service) => {
      return sum + (servicePrices[service] || 1000);
    }, 0);
  }

  healthCheck() {
    return {
      status: 'ok',
      name: this.name,
      version: this.version,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = QuoteEngine;
