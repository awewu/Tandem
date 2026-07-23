/**
 * 水路系统默认设备模板目录
 *
 * 定位：把原本硬编码在 WaterSystemEngine 中的品牌/型号/价格模板抽出为数据，
 * 使引擎可通过 deviceCatalog 参数注入真实产品数据（来自 product-catalog）。
 *
 * 注意：本文件仍含默认占位（无品牌指向），不代表最终推荐；正式上线应通过
 * DesignService 从 product-catalog 拉取真实产品并覆盖此目录。
 */

const DEFAULT_CATALOG = {
  // 冷水入户设备
  coldWater: {
    mainValve: {
      name: '入户总阀',
      type: '球阀',
      diameter: 'DN25-DN32',
      material: '铜/不锈钢',
    },
    pressureReducingValve: {
      name: '减压阀',
      type: '可调式减压阀',
      range: '0.1-0.3MPa',
      brand: null,
    },
    waterMeter: {
      name: '水表',
      type: '智能远传水表',
      diameter: 'DN20-DN25',
      features: ['远程抄表', '漏水报警'],
    },
  },

  // 热水系统设备
  hotWater: {
    central: {
      type: '燃气壁挂炉(系统炉)',
      brands: [],
      features: ['带热水循环', '智能恒温', '分区控制'],
      estimatedPrice: '15000-25000元',
    },
    instant: {
      type: '燃气热水器',
      capacityMap: {
        '一居': '13L/min',
        '二居': '16L/min',
        '三居': '16-20L/min',
        '四居': '20-24L/min',
        '别墅': '24L/min以上',
      },
      brands: [],
      features: ['零冷水', '恒温', '防冻'],
      estimatedPrice: '3000-8000元',
    },
  },

  // 软水系统设备
  softener: {
    premium: {
      tier: 'premium',
      name: '中央软水机（旗舰款）',
      model: null,
      type: '智能离子交换软水机',
      features: [
        '智能再生：根据实际用水量自动触发再生，节省盐耗',
        'APP远程监控：水质状态、盐量提醒、用水统计',
        '干式盐箱：防止盐桥，维护更简单',
        '漏水保护：内置漏水检测，自动切断水源',
        '大流量设计：满足3-5个用水点同时使用',
      ],
      advantage: '与热水器、壁挂炉联动，智能协调软水供应',
      warranty: '5年整机质保',
    },
    standard: {
      tier: 'standard',
      name: '中央软水机（标准款）',
      model: null,
      type: '时间流量双控软水机',
      features: [
        '双控触发：时间+流量双重控制，精准再生',
        '缺盐提醒：盐量低于20%时自动提醒',
        '旁通设计：维护时仍可正常用水',
        '食品级树脂：NSF认证，安全健康',
      ],
      warranty: '3年整机质保',
    },
    alternative: {
      tier: 'alternative',
      name: '其他品牌软水机',
      brands: [],
      type: '离子交换软水机',
      note: '如客户有品牌偏好，可提供指定品牌软水机',
    },
  },

  // 净水系统设备
  pureWater: {
    preFilter: {
      stage: 1,
      name: '前置过滤器',
      function: '过滤泥沙、铁锈',
      precision: '40-100μm',
      brands: [],
      price: '500-1500元',
    },
    centralFilter: {
      stage: 2,
      name: '中央净水机',
      function: '去除余氯、有机物',
      media: 'KDF+活性炭',
      brands: [],
      price: '3000-8000元',
    },
    roSystem: {
      type: 'ro_plus_line',
      name: 'RO净水器+管线机组合',
      description: '传统方案：RO净水机提供直饮水，管线机提供即热功能',
      components: [
        {
          name: 'RO反渗透净水器',
          function: '直饮净化',
          technology: 'RO膜过滤，过滤精度0.0001μm',
          flowRate: '1.5-2L/min',
          brands: [],
          price: '2000-6000元',
        },
        {
          name: '管线机',
          function: '即热饮水',
          features: '多档温控（常温/45℃/55℃/85℃/100℃）',
          installation: '壁挂式/台式',
          brands: [],
          price: '1500-3000元',
        },
      ],
      totalPrice: '3500-9000元',
      pros: ['技术成熟', '品牌选择多', '可分开安装'],
      cons: ['需要两台设备', '管线机需单独接水', '占用更多空间'],
    },
    allInOne: {
      type: 'all_in_one',
      name: '净热一体机',
      description: '净水+加热一体化，节省空间，即滤即热',
      isRecommended: true,
      components: [
        {
          name: '净热一体机',
          model: null,
          function: '净水+即热一体化',
          technology: 'RO反渗透 + 厚膜即热技术',
          features: [
            '多档温度：常温/45℃冲奶/55℃蜂蜜/85℃泡茶/100℃沸水',
            '大流量：2-3L/min，3秒接满一杯',
            '智能TDS显示，实时监测水质',
            '一级水效，废水比2:1',
            '超薄机身，节省橱柜空间',
            '滤芯寿命智能提醒',
          ],
          filtration: '5级过滤：PP棉+活性炭+RO膜+后置活性炭+UV抑菌',
          certifications: ['NSF认证', '涉水批件', '一级水效'],
          price: '8000-15000元',
          advantage: '百年热水技术+净水技术融合',
        },
      ],
      totalPrice: '8000-15000元',
      pros: [
        '一台设备完成净水+加热',
        '节省橱柜空间',
        '即滤即热，拒绝千滚水',
        '多档温控，满足全家需求',
      ],
      cons: ['价格较高', '需要专业安装'],
    },
  },

  // 厨房用水点补充
  kitchen: {
    softenerConnection: {
      name: '中央软水机连接厨房',
      function: '软化洗涤用水，保护洗碗机、热水器',
      benefit: '餐具无水垢，延长电器寿命',
    },
    smallHeater: {
      name: '小厨宝（可选）',
      function: '厨房即热用水',
      capacity: '6-10L',
      price: '500-1500元',
    },
  },

  // 管材与循环泵默认值
  pipe: {
    defaultMaterial: 'PP-R',
    economicVelocity: { min: 0.6, max: 1.2 },
    standardDiameters: [15, 20, 25, 32, 40, 50, 63, 75, 90, 110],
  },

  circulation: {
    pump: { head: '3-5m', power: '60-120W' },
    insulation: { material: '橡塑', thickness: '20mm' },
  },
};

module.exports = { DEFAULT_CATALOG };
