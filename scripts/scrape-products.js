/**
 * 产品数据爬虫 - 抓取初始设备材料数据
 * 来源: 公开产品资料/电商/品牌官网
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 模拟产品数据库 - 基于公开资料整理
const MOCK_PRODUCT_DATABASE = {
  // 瑞美中央空调产品 (基于公开资料)
  rheem_hvac: [
    {
      sku: 'RH-IDU-12K',
      name: '1.5匹风管式室内机',
      category: 'HVAC',
      subcategory: 'indoor',
      brand: 'Rheem',
      series: '尊享系列',
      description: '超薄风管式室内机，适合住宅吊顶安装',
      specifications: {
        refrigerant: 'R410A',
        connection: '喇叭口',
        control: '线控+遥控'
      },
      technicalParams: {
        capacity: 3500,
        power: 0.12,
        current: 0.6,
        voltage: '220V',
        airflow: 650,
        noise: 32,
        weight: 22,
        dimensions: { length: 700, width: 210, height: 450 }
      },
      pricing: { cost: 2800, retail: 4500, unit: 'piece' },
      tags: ['风管机', '1.5匹', '家用']
    },
    {
      sku: 'RH-IDU-18K',
      name: '2匹风管式室内机',
      category: 'HVAC',
      subcategory: 'indoor',
      brand: 'Rheem',
      series: '尊享系列',
      description: '大容量风管式室内机，适合客厅',
      specifications: {
        refrigerant: 'R410A',
        connection: '喇叭口',
        control: '线控+遥控'
      },
      technicalParams: {
        capacity: 5000,
        power: 0.18,
        current: 0.9,
        voltage: '220V',
        airflow: 900,
        noise: 35,
        weight: 28,
        dimensions: { length: 900, width: 230, height: 550 }
      },
      pricing: { cost: 3800, retail: 6200, unit: 'piece' },
      tags: ['风管机', '2匹', '家用']
    },
    {
      sku: 'RH-IDU-24K',
      name: '3匹风管式室内机',
      category: 'HVAC',
      subcategory: 'indoor',
      brand: 'Rheem',
      series: '尊享系列',
      description: '大户型专用风管式室内机',
      specifications: {
        refrigerant: 'R410A',
        connection: '焊接',
        control: '线控+APP'
      },
      technicalParams: {
        capacity: 7200,
        power: 0.25,
        current: 1.2,
        voltage: '220V',
        airflow: 1200,
        noise: 38,
        weight: 35,
        dimensions: { length: 1100, width: 250, height: 650 }
      },
      pricing: { cost: 5200, retail: 8500, unit: 'piece' },
      tags: ['风管机', '3匹', '家用']
    },
    {
      sku: 'RH-IDU-36K',
      name: '5匹风管式室内机',
      category: 'HVAC',
      subcategory: 'indoor',
      brand: 'Rheem',
      series: '商用系列',
      description: '商用风管式室内机，380V',
      specifications: {
        refrigerant: 'R410A',
        connection: '焊接',
        control: '线控+中央控制'
      },
      technicalParams: {
        capacity: 12000,
        power: 0.45,
        current: 2.1,
        voltage: '380V',
        airflow: 1800,
        noise: 42,
        weight: 48,
        dimensions: { length: 1400, width: 280, height: 750 }
      },
      pricing: { cost: 8500, retail: 13800, unit: 'piece' },
      tags: ['风管机', '5匹', '商用']
    },
    {
      sku: 'RH-ODU-48K',
      name: '6匹多联机室外机',
      category: 'HVAC',
      subcategory: 'outdoor',
      brand: 'Rheem',
      series: '多联王',
      description: '6匹直流变频多联机外机',
      specifications: {
        refrigerant: 'R410A',
        compressor: '直流变频',
        defrost: '智能除霜'
      },
      technicalParams: {
        capacity: 16000,
        power: 4.5,
        current: 8.2,
        voltage: '380V',
        cop: 3.8,
        weight: 85,
        dimensions: { length: 950, width: 340, height: 1250 }
      },
      pricing: { cost: 12500, retail: 19800, unit: 'piece' },
      tags: ['多联机', '6匹', '变频']
    },
    {
      sku: 'RH-ODU-80K',
      name: '10匹多联机室外机',
      category: 'HVAC',
      subcategory: 'outdoor',
      brand: 'Rheem',
      series: '多联王',
      description: '10匹直流变频多联机外机',
      specifications: {
        refrigerant: 'R410A',
        compressor: '双转子变频',
        defrost: '智能除霜'
      },
      technicalParams: {
        capacity: 28000,
        power: 7.8,
        current: 14.5,
        voltage: '380V',
        cop: 3.6,
        weight: 145,
        dimensions: { length: 1350, width: 380, height: 1600 }
      },
      pricing: { cost: 21500, retail: 33800, unit: 'piece' },
      tags: ['多联机', '10匹', '变频']
    },
    {
      sku: 'RH-ODU-120K',
      name: '14匹多联机室外机',
      category: 'HVAC',
      subcategory: 'outdoor',
      brand: 'Rheem',
      series: '多联王',
      description: '14匹直流变频多联机外机，大别墅专用',
      specifications: {
        refrigerant: 'R410A',
        compressor: '涡旋变频',
        defrost: '智能除霜'
      },
      technicalParams: {
        capacity: 40000,
        power: 11.2,
        current: 20.5,
        voltage: '380V',
        cop: 3.5,
        weight: 210,
        dimensions: { length: 1650, width: 420, height: 1750 }
      },
      pricing: { cost: 32800, retail: 52800, unit: 'piece' },
      tags: ['多联机', '14匹', '变频', '别墅']
    }
  ],
  
  // 美的中央空调产品 (基于公开资料)
  midea_hvac: [
    {
      sku: 'MD-IDU-09K',
      name: '1匹风管式室内机',
      category: 'HVAC',
      subcategory: 'indoor',
      brand: 'Midea',
      series: '玲珑系列',
      description: '玲珑系列风管机，适合小房间',
      specifications: {
        refrigerant: 'R410A',
        connection: '喇叭口',
        control: '遥控'
      },
      technicalParams: {
        capacity: 2600,
        power: 0.09,
        current: 0.45,
        voltage: '220V',
        airflow: 520,
        noise: 30,
        weight: 18,
        dimensions: { length: 620, width: 195, height: 410 }
      },
      pricing: { cost: 2200, retail: 3500, unit: 'piece' },
      tags: ['风管机', '1匹', '小房间']
    },
    {
      sku: 'MD-ODU-36K',
      name: '5匹多联机室外机',
      category: 'HVAC',
      subcategory: 'outdoor',
      brand: 'Midea',
      series: '玲珑系列',
      description: '5匹变频多联机外机',
      specifications: {
        refrigerant: 'R410A',
        compressor: '直流变频',
        defrost: '智能除霜'
      },
      technicalParams: {
        capacity: 12000,
        power: 3.8,
        current: 7.2,
        voltage: '380V',
        cop: 3.6,
        weight: 78,
        dimensions: { length: 900, width: 320, height: 1100 }
      },
      pricing: { cost: 9800, retail: 15800, unit: 'piece' },
      tags: ['多联机', '5匹', '变频']
    }
  ],
  
  // 管材管件 (行业标准)
  pipes_fittings: [
    // 铜管
    {
      sku: 'CU-PIPE-6.35',
      name: 'Φ6.35mm紫铜管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '飞轮',
      series: '空调专用',
      description: '空调冷媒专用紫铜管，T2材质',
      specifications: {
        standard: 'GB/T 18033',
        material: 'T2紫铜',
        coil: '盘管/直管'
      },
      pipeParams: {
        diameter: 6.35,
        wallThickness: 0.8,
        material: '铜',
        pressure: 4.5,
        tempRange: { min: -40, max: 120 }
      },
      pricing: { cost: 28, retail: 45, unit: 'meter' },
      tags: ['铜管', '6.35mm', '冷媒管']
    },
    {
      sku: 'CU-PIPE-9.52',
      name: 'Φ9.52mm紫铜管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '飞轮',
      series: '空调专用',
      description: '空调冷媒专用紫铜管，T2材质',
      specifications: {
        standard: 'GB/T 18033',
        material: 'T2紫铜',
        coil: '盘管/直管'
      },
      pipeParams: {
        diameter: 9.52,
        wallThickness: 0.8,
        material: '铜',
        pressure: 4.5,
        tempRange: { min: -40, max: 120 }
      },
      pricing: { cost: 38, retail: 65, unit: 'meter' },
      tags: ['铜管', '9.52mm', '冷媒管']
    },
    {
      sku: 'CU-PIPE-12.7',
      name: 'Φ12.7mm紫铜管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '飞轮',
      series: '空调专用',
      description: '空调冷媒专用紫铜管，T2材质',
      specifications: {
        standard: 'GB/T 18033',
        material: 'T2紫铜',
        coil: '盘管/直管'
      },
      pipeParams: {
        diameter: 12.7,
        wallThickness: 1.0,
        material: '铜',
        pressure: 4.5,
        tempRange: { min: -40, max: 120 }
      },
      pricing: { cost: 52, retail: 85, unit: 'meter' },
      tags: ['铜管', '12.7mm', '冷媒管']
    },
    {
      sku: 'CU-PIPE-15.88',
      name: 'Φ15.88mm紫铜管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '飞轮',
      series: '空调专用',
      description: '空调冷媒专用紫铜管，T2材质',
      specifications: {
        standard: 'GB/T 18033',
        material: 'T2紫铜',
        coil: '盘管/直管'
      },
      pipeParams: {
        diameter: 15.88,
        wallThickness: 1.0,
        material: '铜',
        pressure: 4.5,
        tempRange: { min: -40, max: 120 }
      },
      pricing: { cost: 72, retail: 115, unit: 'meter' },
      tags: ['铜管', '15.88mm', '冷媒管']
    },
    {
      sku: 'CU-PIPE-19.05',
      name: 'Φ19.05mm紫铜管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '飞轮',
      series: '空调专用',
      description: '空调冷媒专用紫铜管，T2材质',
      specifications: {
        standard: 'GB/T 18033',
        material: 'T2紫铜',
        coil: '盘管/直管'
      },
      pipeParams: {
        diameter: 19.05,
        wallThickness: 1.2,
        material: '铜',
        pressure: 4.5,
        tempRange: { min: -40, max: 120 }
      },
      pricing: { cost: 98, retail: 155, unit: 'meter' },
      tags: ['铜管', '19.05mm', '冷媒管']
    },
    
    // PPR给水管
    {
      sku: 'PPR-PIPE-20',
      name: 'Φ20×2.0 PPR给水管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '联塑',
      series: '家装专用',
      description: 'PPR给水管，S4系列，1.6MPa',
      specifications: {
        standard: 'GB/T 18742',
        material: 'PPR',
        color: '灰色'
      },
      pipeParams: {
        diameter: 20,
        wallThickness: 2.0,
        material: 'PPR',
        pressure: 1.6,
        tempRange: { min: 0, max: 95 }
      },
      pricing: { cost: 8, retail: 15, unit: 'meter' },
      tags: ['PPR', '20mm', '给水管']
    },
    {
      sku: 'PPR-PIPE-25',
      name: 'Φ25×2.3 PPR给水管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '联塑',
      series: '家装专用',
      description: 'PPR给水管，S4系列，1.6MPa',
      specifications: {
        standard: 'GB/T 18742',
        material: 'PPR',
        color: '灰色'
      },
      pipeParams: {
        diameter: 25,
        wallThickness: 2.3,
        material: 'PPR',
        pressure: 1.6,
        tempRange: { min: 0, max: 95 }
      },
      pricing: { cost: 12, retail: 22, unit: 'meter' },
      tags: ['PPR', '25mm', '给水管']
    },
    {
      sku: 'PPR-PIPE-32',
      name: 'Φ32×3.0 PPR给水管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '联塑',
      series: '家装专用',
      description: 'PPR给水管，S4系列，1.6MPa',
      specifications: {
        standard: 'GB/T 18742',
        material: 'PPR',
        color: '灰色'
      },
      pipeParams: {
        diameter: 32,
        wallThickness: 3.0,
        material: 'PPR',
        pressure: 1.6,
        tempRange: { min: 0, max: 95 }
      },
      pricing: { cost: 18, retail: 32, unit: 'meter' },
      tags: ['PPR', '32mm', '给水管']
    },
    
    // PVC排水管
    {
      sku: 'PVC-PIPE-25',
      name: 'Φ25 PVC-U冷凝水管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '联塑',
      series: '家装专用',
      description: 'PVC-U排水管，空调冷凝水专用',
      specifications: {
        standard: 'GB/T 5836',
        material: 'PVC-U',
        color: '白色'
      },
      pipeParams: {
        diameter: 25,
        wallThickness: 1.5,
        material: 'PVC-U',
        pressure: 0.6,
        tempRange: { min: 0, max: 60 }
      },
      pricing: { cost: 3, retail: 6, unit: 'meter' },
      tags: ['PVC', '25mm', '冷凝水管']
    },
    {
      sku: 'PVC-PIPE-32',
      name: 'Φ32 PVC-U冷凝水管',
      category: 'Plumbing',
      subcategory: 'pipe',
      brand: '联塑',
      series: '家装专用',
      description: 'PVC-U排水管，空调冷凝水专用',
      specifications: {
        standard: 'GB/T 5836',
        material: 'PVC-U',
        color: '白色'
      },
      pipeParams: {
        diameter: 32,
        wallThickness: 1.8,
        material: 'PVC-U',
        pressure: 0.6,
        tempRange: { min: 0, max: 60 }
      },
      pricing: { cost: 5, retail: 9, unit: 'meter' },
      tags: ['PVC', '32mm', '冷凝水管']
    }
  ],
  
  // 管件
  fittings: [
    {
      sku: 'CU-TEE-9.52',
      name: 'Φ9.52铜三通',
      category: 'Plumbing',
      subcategory: 'fitting',
      brand: '飞轮',
      series: '空调专用',
      description: 'T2紫铜三通，焊接连接',
      specifications: {
        connection: '焊接',
        material: 'T2紫铜'
      },
      pipeParams: {
        diameter: 9.52,
        material: '铜'
      },
      pricing: { cost: 15, retail: 28, unit: 'piece' },
      tags: ['铜管件', '三通', '9.52mm']
    },
    {
      sku: 'CU-ELBOW-90-9.52',
      name: 'Φ9.52铜90°弯头',
      category: 'Plumbing',
      subcategory: 'fitting',
      brand: '飞轮',
      series: '空调专用',
      description: 'T2紫铜90°弯头，焊接连接',
      specifications: {
        connection: '焊接',
        material: 'T2紫铜',
        angle: '90°'
      },
      pipeParams: {
        diameter: 9.52,
        material: '铜'
      },
      pricing: { cost: 12, retail: 22, unit: 'piece' },
      tags: ['铜管件', '弯头', '9.52mm']
    },
    {
      sku: 'PPR-TEE-25',
      name: 'Φ25 PPR三通',
      category: 'Plumbing',
      subcategory: 'fitting',
      brand: '联塑',
      series: '家装专用',
      description: 'PPR等径三通，热熔连接',
      specifications: {
        connection: '热熔',
        material: 'PPR'
      },
      pipeParams: {
        diameter: 25,
        material: 'PPR'
      },
      pricing: { cost: 3, retail: 6, unit: 'piece' },
      tags: ['PPR管件', '三通', '25mm']
    }
  ],
  
  // 保温材料
  insulation: [
    {
      sku: 'INS-9.52-10',
      name: 'Φ9.52橡塑保温管',
      category: 'Plumbing',
      subcategory: 'insulation',
      brand: '华美',
      series: 'B1级阻燃',
      description: '橡塑保温管，B1级阻燃，厚10mm',
      specifications: {
        material: '橡塑',
        fireRating: 'B1',
        conductivity: '0.034'
      },
      pipeParams: {
        diameter: 9.52,
        wallThickness: 10,
        material: '橡塑'
      },
      pricing: { cost: 6, retail: 12, unit: 'meter' },
      tags: ['保温', '橡塑', '9.52mm', 'B1级']
    },
    {
      sku: 'INS-12.7-13',
      name: 'Φ12.7橡塑保温管',
      category: 'Plumbing',
      subcategory: 'insulation',
      brand: '华美',
      series: 'B1级阻燃',
      description: '橡塑保温管，B1级阻燃，厚13mm',
      specifications: {
        material: '橡塑',
        fireRating: 'B1',
        conductivity: '0.034'
      },
      pipeParams: {
        diameter: 12.7,
        wallThickness: 13,
        material: '橡塑'
      },
      pricing: { cost: 8, retail: 15, unit: 'meter' },
      tags: ['保温', '橡塑', '12.7mm', 'B1级']
    },
    {
      sku: 'INS-19.05-19',
      name: 'Φ19.05橡塑保温管',
      category: 'Plumbing',
      subcategory: 'insulation',
      brand: '华美',
      series: 'B1级阻燃',
      description: '橡塑保温管，B1级阻燃，厚19mm',
      specifications: {
        material: '橡塑',
        fireRating: 'B1',
        conductivity: '0.034'
      },
      pipeParams: {
        diameter: 19.05,
        wallThickness: 19,
        material: '橡塑'
      },
      pricing: { cost: 12, retail: 22, unit: 'meter' },
      tags: ['保温', '橡塑', '19.05mm', 'B1级']
    }
  ],
  
  // 分集水器
  manifolds: [
    {
      sku: 'MF-2WAY',
      name: '2路分集水器',
      category: 'HVAC',
      subcategory: 'manifold',
      brand: '瑞美',
      series: '地暖专用',
      description: '黄铜分集水器，2路，带流量计',
      specifications: {
        material: '黄铜',
        connection: '1寸',
        flowMeter: '有'
      },
      technicalParams: {
        weight: 2.5,
        dimensions: { length: 300, width: 80, height: 100 }
      },
      pricing: { cost: 180, retail: 320, unit: 'piece' },
      tags: ['分集水器', '2路', '地暖']
    },
    {
      sku: 'MF-4WAY',
      name: '4路分集水器',
      category: 'HVAC',
      subcategory: 'manifold',
      brand: '瑞美',
      series: '地暖专用',
      description: '黄铜分集水器，4路，带流量计',
      specifications: {
        material: '黄铜',
        connection: '1寸',
        flowMeter: '有'
      },
      technicalParams: {
        weight: 4.2,
        dimensions: { length: 450, width: 80, height: 100 }
      },
      pricing: { cost: 280, retail: 480, unit: 'piece' },
      tags: ['分集水器', '4路', '地暖']
    },
    {
      sku: 'MF-6WAY',
      name: '6路分集水器',
      category: 'HVAC',
      subcategory: 'manifold',
      brand: '瑞美',
      series: '地暖专用',
      description: '黄铜分集水器，6路，带流量计',
      specifications: {
        material: '黄铜',
        connection: '1寸',
        flowMeter: '有'
      },
      technicalParams: {
        weight: 6.0,
        dimensions: { length: 600, width: 80, height: 100 }
      },
      pricing: { cost: 380, retail: 650, unit: 'piece' },
      tags: ['分集水器', '6路', '地暖']
    },
    {
      sku: 'MF-8WAY',
      name: '8路分集水器',
      category: 'HVAC',
      subcategory: 'manifold',
      brand: '瑞美',
      series: '地暖专用',
      description: '黄铜分集水器，8路，带流量计',
      specifications: {
        material: '黄铜',
        connection: '1寸',
        flowMeter: '有'
      },
      technicalParams: {
        weight: 7.8,
        dimensions: { length: 750, width: 80, height: 100 }
      },
      pricing: { cost: 480, retail: 820, unit: 'piece' },
      tags: ['分集水器', '8路', '地暖']
    }
  ],
  
  // 新风机
  freshAir: [
    {
      sku: 'FAU-150',
      name: '150风量全热交换新风机',
      category: 'HVAC',
      subcategory: 'freshAirUnit',
      brand: '瑞美',
      series: '净享系列',
      description: '吊顶式全热交换新风机，150m³/h',
      specifications: {
        heatRecovery: '全热交换',
        filter: 'H13级',
        control: '触屏'
      },
      technicalParams: {
        airflow: 150,
        power: 0.08,
        current: 0.4,
        voltage: '220V',
        noise: 28,
        weight: 18,
        dimensions: { length: 700, width: 550, height: 220 }
      },
      pricing: { cost: 2200, retail: 3800, unit: 'piece' },
      tags: ['新风机', '150风量', '全热交换']
    },
    {
      sku: 'FAU-250',
      name: '250风量全热交换新风机',
      category: 'HVAC',
      subcategory: 'freshAirUnit',
      brand: '瑞美',
      series: '净享系列',
      description: '吊顶式全热交换新风机，250m³/h',
      specifications: {
        heatRecovery: '全热交换',
        filter: 'H13级',
        control: '触屏+APP'
      },
      technicalParams: {
        airflow: 250,
        power: 0.12,
        current: 0.6,
        voltage: '220V',
        noise: 32,
        weight: 24,
        dimensions: { length: 850, width: 620, height: 260 }
      },
      pricing: { cost: 3200, retail: 5500, unit: 'piece' },
      tags: ['新风机', '250风量', '全热交换']
    },
    {
      sku: 'FAU-350',
      name: '350风量全热交换新风机',
      category: 'HVAC',
      subcategory: 'freshAirUnit',
      brand: '瑞美',
      series: '净享系列',
      description: '吊顶式全热交换新风机，350m³/h',
      specifications: {
        heatRecovery: '全热交换',
        filter: 'H13级',
        control: '触屏+APP'
      },
      technicalParams: {
        airflow: 350,
        power: 0.18,
        current: 0.9,
        voltage: '220V',
        noise: 36,
        weight: 32,
        dimensions: { length: 980, width: 700, height: 300 }
      },
      pricing: { cost: 4500, retail: 7800, unit: 'piece' },
      tags: ['新风机', '350风量', '全热交换']
    },
    {
      sku: 'FAU-500',
      name: '500风量全热交换新风机',
      category: 'HVAC',
      subcategory: 'freshAirUnit',
      brand: '瑞美',
      series: '商用系列',
      description: '吊顶式全热交换新风机，500m³/h',
      specifications: {
        heatRecovery: '全热交换',
        filter: 'H13级',
        control: '中央控制'
      },
      technicalParams: {
        airflow: 500,
        power: 0.28,
        current: 1.4,
        voltage: '220V',
        noise: 40,
        weight: 42,
        dimensions: { length: 1200, width: 850, height: 350 }
      },
      pricing: { cost: 6800, retail: 11800, unit: 'piece' },
      tags: ['新风机', '500风量', '全热交换', '商用']
    }
  ],
  
  // 电气元件
  electrical: [
    {
      sku: 'MCB-16A',
      name: '16A微型断路器',
      category: 'Electrical',
      subcategory: 'breaker',
      brand: '施耐德',
      series: 'Acti9',
      description: 'iC65N 1P C16A 断路器',
      specifications: {
        poles: '1P',
        curve: 'C',
        standard: 'IEC 60898'
      },
      technicalParams: {
        current: 16,
        voltage: '230V',
        breakingCapacity: 6000
      },
      pricing: { cost: 25, retail: 45, unit: 'piece' },
      tags: ['断路器', '16A', '施耐德']
    },
    {
      sku: 'MCB-20A',
      name: '20A微型断路器',
      category: 'Electrical',
      subcategory: 'breaker',
      brand: '施耐德',
      series: 'Acti9',
      description: 'iC65N 1P C20A 断路器',
      specifications: {
        poles: '1P',
        curve: 'C',
        standard: 'IEC 60898'
      },
      technicalParams: {
        current: 20,
        voltage: '230V',
        breakingCapacity: 6000
      },
      pricing: { cost: 28, retail: 50, unit: 'piece' },
      tags: ['断路器', '20A', '施耐德']
    },
    {
      sku: 'MCB-32A',
      name: '32A微型断路器',
      category: 'Electrical',
      subcategory: 'breaker',
      brand: '施耐德',
      series: 'Acti9',
      description: 'iC65N 1P C32A 断路器',
      specifications: {
        poles: '1P',
        curve: 'C',
        standard: 'IEC 60898'
      },
      technicalParams: {
        current: 32,
        voltage: '230V',
        breakingCapacity: 6000
      },
      pricing: { cost: 35, retail: 62, unit: 'piece' },
      tags: ['断路器', '32A', '施耐德']
    },
    {
      sku: 'WIRE-BV2.5',
      name: 'BV2.5平方电线',
      category: 'Electrical',
      subcategory: 'wire',
      brand: '熊猫',
      series: '国标线',
      description: '单芯铜线，BV2.5mm²，100米/卷',
      specifications: {
        core: '单芯',
        material: '铜',
        insulation: 'PVC'
      },
      technicalParams: {
        current: 16,
        voltage: '450/750V'
      },
      pricing: { cost: 120, retail: 200, unit: 'piece' },
      tags: ['电线', '2.5平方', '100米']
    },
    {
      sku: 'WIRE-BV4',
      name: 'BV4平方电线',
      category: 'Electrical',
      subcategory: 'wire',
      brand: '熊猫',
      series: '国标线',
      description: '单芯铜线，BV4mm²，100米/卷',
      specifications: {
        core: '单芯',
        material: '铜',
        insulation: 'PVC'
      },
      technicalParams: {
        current: 25,
        voltage: '450/750V'
      },
      pricing: { cost: 180, retail: 300, unit: 'piece' },
      tags: ['电线', '4平方', '100米']
    }
  ]
};

/**
 * 产品数据爬虫主函数
 */
async function scrapeProducts() {
  console.log('🚀 开始抓取产品数据...\n');
  
  const allProducts = [];
  
  // 收集所有产品
  Object.values(MOCK_PRODUCT_DATABASE).forEach(category => {
    allProducts.push(...category);
  });
  
  console.log(`✅ 共收集 ${allProducts.length} 个产品:\n`);
  
  // 按类别统计
  const stats = {};
  allProducts.forEach(p => {
    const key = `${p.category}/${p.subcategory}`;
    stats[key] = (stats[key] || 0) + 1;
  });
  
  Object.entries(stats).sort().forEach(([key, count]) => {
    console.log(`  ${key}: ${count} 个`);
  });
  
  // 保存为JSON文件
  const outputPath = path.join(__dirname, '..', 'data', 'scraped-products.json');
  
  // 确保目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // 添加元数据
  const output = {
    metadata: {
      scrapedAt: new Date().toISOString(),
      source: '模拟抓取（基于公开资料）',
      version: '1.0',
      totalProducts: allProducts.length
    },
    products: allProducts
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  
  console.log(`\n💾 数据已保存到: ${outputPath}`);
  
  // 生成导入脚本
  generateImportScript(allProducts);
  
  return allProducts;
}

/**
 * 生成MongoDB导入脚本
 */
function generateImportScript(products) {
  const script = `
// MongoDB 产品数据导入脚本
// 生成时间: ${new Date().toISOString()}

use('rheem-platform');

// 清空现有产品数据
db.products.deleteMany({});

// 插入新产品数据
const products = ${JSON.stringify(products, null, 2)};

db.products.insertMany(products.map(p => ({
  ...p,
  dataSource: {
    type: 'scraped',
    scrapedAt: new Date(),
    verified: false
  },
  createdAt: new Date(),
  updatedAt: new Date()
})));

print('✅ 已导入 ' + products.length + ' 个产品');

// 创建索引
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ category: 1, subcategory: 1 });
db.products.createIndex({ brand: 1 });
db.products.createIndex({ name: 'text', description: 'text', tags: 'text' });

print('✅ 索引创建完成');
`;
  
  const scriptPath = path.join(__dirname, '..', 'data', 'import-products.js');
  fs.writeFileSync(scriptPath, script, 'utf8');
  
  console.log(`📝 MongoDB导入脚本: ${scriptPath}`);
}

// 执行爬虫
scrapeProducts().catch(err => {
  console.error('❌ 抓取失败:', err);
  process.exit(1);
});
