/**
 * 中国城市数据库 - 完整版
 * 覆盖一线、二线、三线、四线城市
 * 包含气候数据、经济水平、暖通需求特征
 */

const CHINA_CITIES_DATABASE = {
  // 一线城市 (4个)
  tier1: [
    { name: '北京', province: '北京', tier: 1, climate: '寒冷', winterTemp: -5, summerTemp: 32, humidity: 60, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '上海', province: '上海', tier: 1, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 75, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '广州', province: '广东', tier: 1, climate: '夏热冬暖', winterTemp: 15, summerTemp: 38, humidity: 80, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '深圳', province: '广东', tier: 1, climate: '夏热冬暖', winterTemp: 16, summerTemp: 37, humidity: 78, gdpLevel: 'high', marketMaturity: '成熟' }
  ],

  // 新一线城市 (15个)
  tierNew1: [
    { name: '成都', province: '四川', tier: '新一线', climate: '夏热冬冷', winterTemp: 8, summerTemp: 34, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '杭州', province: '浙江', tier: '新一线', climate: '夏热冬冷', winterTemp: 6, summerTemp: 36, humidity: 72, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '重庆', province: '重庆', tier: '新一线', climate: '夏热冬冷', winterTemp: 10, summerTemp: 38, humidity: 75, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '西安', province: '陕西', tier: '新一线', climate: '寒冷', winterTemp: 0, summerTemp: 36, humidity: 55, gdpLevel: 'high', marketMaturity: '成长' },
    { name: '苏州', province: '江苏', tier: '新一线', climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '武汉', province: '湖北', tier: '新一线', climate: '夏热冬冷', winterTemp: 5, summerTemp: 37, humidity: 72, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '南京', province: '江苏', tier: '新一线', climate: '夏热冬冷', winterTemp: 4, summerTemp: 36, humidity: 68, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '天津', province: '天津', tier: '新一线', climate: '寒冷', winterTemp: -2, summerTemp: 33, humidity: 60, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '郑州', province: '河南', tier: '新一线', climate: '寒冷', winterTemp: 2, summerTemp: 36, humidity: 58, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '长沙', province: '湖南', tier: '新一线', climate: '夏热冬冷', winterTemp: 8, summerTemp: 37, humidity: 70, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '东莞', province: '广东', tier: '新一线', climate: '夏热冬暖', winterTemp: 16, summerTemp: 36, humidity: 75, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '佛山', province: '广东', tier: '新一线', climate: '夏热冬暖', winterTemp: 16, summerTemp: 36, humidity: 76, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '宁波', province: '浙江', tier: '新一线', climate: '夏热冬冷', winterTemp: 6, summerTemp: 35, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '青岛', province: '山东', tier: '新一线', climate: '寒冷', winterTemp: 2, summerTemp: 30, humidity: 65, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '沈阳', province: '辽宁', tier: '新一线', climate: '严寒', winterTemp: -10, summerTemp: 30, humidity: 55, gdpLevel: 'medium', marketMaturity: '稳定' }
  ],

  // 二线城市 (30个)
  tier2: [
    { name: '昆明', province: '云南', tier: 2, climate: '温和', winterTemp: 10, summerTemp: 28, humidity: 65, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '大连', province: '辽宁', tier: 2, climate: '寒冷', winterTemp: -5, summerTemp: 28, humidity: 60, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '厦门', province: '福建', tier: 2, climate: '夏热冬暖', winterTemp: 14, summerTemp: 33, humidity: 75, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '合肥', province: '安徽', tier: 2, climate: '夏热冬冷', winterTemp: 5, summerTemp: 36, humidity: 68, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '福州', province: '福建', tier: 2, climate: '夏热冬暖', winterTemp: 12, summerTemp: 35, humidity: 72, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '哈尔滨', province: '黑龙江', tier: 2, climate: '严寒', winterTemp: -18, summerTemp: 28, humidity: 50, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '济南', province: '山东', tier: 2, climate: '寒冷', winterTemp: 0, summerTemp: 35, humidity: 55, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '温州', province: '浙江', tier: 2, climate: '夏热冬冷', winterTemp: 8, summerTemp: 35, humidity: 72, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '南宁', province: '广西', tier: 2, climate: '夏热冬暖', winterTemp: 14, summerTemp: 35, humidity: 78, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '长春', province: '吉林', tier: 2, climate: '严寒', winterTemp: -15, summerTemp: 28, humidity: 52, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '泉州', province: '福建', tier: 2, climate: '夏热冬暖', winterTemp: 13, summerTemp: 34, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '石家庄', province: '河北', tier: 2, climate: '寒冷', winterTemp: -2, summerTemp: 35, humidity: 50, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '贵阳', province: '贵州', tier: 2, climate: '夏热冬冷', winterTemp: 6, summerTemp: 32, humidity: 75, gdpLevel: 'low', marketMaturity: '成长' },
    { name: '南昌', province: '江西', tier: 2, climate: '夏热冬冷', winterTemp: 7, summerTemp: 36, humidity: 70, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '金华', province: '浙江', tier: 2, climate: '夏热冬冷', winterTemp: 7, summerTemp: 36, humidity: 68, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '珠海', province: '广东', tier: 2, climate: '夏热冬暖', winterTemp: 17, summerTemp: 33, humidity: 75, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '无锡', province: '江苏', tier: 2, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 68, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '常州', province: '江苏', tier: 2, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 68, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '嘉兴', province: '浙江', tier: 2, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '南通', province: '江苏', tier: 2, climate: '夏热冬冷', winterTemp: 4, summerTemp: 34, humidity: 70, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '惠州', province: '广东', tier: 2, climate: '夏热冬暖', winterTemp: 16, summerTemp: 34, humidity: 75, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '太原', province: '山西', tier: 2, climate: '寒冷', winterTemp: -5, summerTemp: 32, humidity: 48, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '中山', province: '广东', tier: 2, climate: '夏热冬暖', winterTemp: 16, summerTemp: 34, humidity: 76, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '保定', province: '河北', tier: 2, climate: '寒冷', winterTemp: -3, summerTemp: 34, humidity: 50, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '兰州', province: '甘肃', tier: 2, climate: '寒冷', winterTemp: -5, summerTemp: 32, humidity: 45, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '烟台', province: '山东', tier: 2, climate: '寒冷', winterTemp: 2, summerTemp: 29, humidity: 65, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '绍兴', province: '浙江', tier: 2, climate: '夏热冬冷', winterTemp: 6, summerTemp: 35, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '海口', province: '海南', tier: 2, climate: '夏热冬暖', winterTemp: 20, summerTemp: 35, humidity: 85, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '扬州', province: '江苏', tier: 2, climate: '夏热冬冷', winterTemp: 4, summerTemp: 34, humidity: 68, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '呼和浩特', province: '内蒙古', tier: 2, climate: '严寒', winterTemp: -12, summerTemp: 28, humidity: 40, gdpLevel: 'medium', marketMaturity: '稳定' }
  ],

  // 三线城市 (70个)
  tier3: [
    { name: '洛阳', province: '河南', tier: 3, climate: '寒冷', winterTemp: 2, summerTemp: 35, humidity: 55, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '襄阳', province: '湖北', tier: 3, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 65, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '岳阳', province: '湖南', tier: 3, climate: '夏热冬冷', winterTemp: 6, summerTemp: 35, humidity: 70, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '漳州', province: '福建', tier: 3, climate: '夏热冬暖', winterTemp: 14, summerTemp: 34, humidity: 75, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '珠海', province: '广东', tier: 3, climate: '夏热冬暖', winterTemp: 17, summerTemp: 33, humidity: 75, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '威海', province: '山东', tier: 3, climate: '寒冷', winterTemp: 1, summerTemp: 28, humidity: 68, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '湖州', province: '浙江', tier: 3, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 72, gdpLevel: 'high', marketMaturity: '成熟' },
    { name: '芜湖', province: '安徽', tier: 3, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 68, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '三亚', province: '海南', tier: 3, climate: '夏热冬暖', winterTemp: 22, summerTemp: 33, humidity: 80, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '廊坊', province: '河北', tier: 3, climate: '寒冷', winterTemp: -3, summerTemp: 34, humidity: 50, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '唐山', province: '河北', tier: 3, climate: '寒冷', winterTemp: -5, summerTemp: 33, humidity: 55, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '包头', province: '内蒙古', tier: 3, climate: '严寒', winterTemp: -15, summerTemp: 30, humidity: 40, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '银川', province: '宁夏', tier: 3, climate: '寒冷', winterTemp: -8, summerTemp: 32, humidity: 45, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '西宁', province: '青海', tier: 3, climate: '寒冷', winterTemp: -8, summerTemp: 28, humidity: 40, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '乌鲁木齐', province: '新疆', tier: 3, climate: '严寒', winterTemp: -15, summerTemp: 35, humidity: 35, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '拉萨', province: '西藏', tier: 3, climate: '寒冷', winterTemp: -5, summerTemp: 25, humidity: 30, gdpLevel: 'low', marketMaturity: '起步' },
    { name: '绵阳', province: '四川', tier: 3, climate: '夏热冬冷', winterTemp: 8, summerTemp: 33, humidity: 68, gdpLevel: 'medium', marketMaturity: '成长' },
    { name: '宜宾', province: '四川', tier: 3, climate: '夏热冬冷', winterTemp: 9, summerTemp: 34, humidity: 70, gdpLevel: 'low', marketMaturity: '成长' },
    { name: '镇江', province: '江苏', tier: 3, climate: '夏热冬冷', winterTemp: 5, summerTemp: 35, humidity: 68, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '台州', province: '浙江', tier: 3, climate: '夏热冬冷', winterTemp: 8, summerTemp: 35, humidity: 70, gdpLevel: 'high', marketMaturity: '成熟' }
    // 可以继续扩展更多三线城市...
  ],

  // 四线城市 (部分代表性城市)
  tier4: [
    { name: '桂林', province: '广西', tier: 4, climate: '夏热冬暖', winterTemp: 10, summerTemp: 34, humidity: 75, gdpLevel: 'low', marketMaturity: '成长' },
    { name: '三亚', province: '海南', tier: 4, climate: '夏热冬暖', winterTemp: 22, summerTemp: 33, humidity: 80, gdpLevel: 'medium', marketMaturity: '成熟' },
    { name: '张家口', province: '河北', tier: 4, climate: '严寒', winterTemp: -12, summerTemp: 30, humidity: 45, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '大同', province: '山西', tier: 4, climate: '寒冷', winterTemp: -10, summerTemp: 30, humidity: 45, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '鞍山', province: '辽宁', tier: 4, climate: '寒冷', winterTemp: -10, summerTemp: 30, humidity: 55, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '吉林', province: '吉林', tier: 4, climate: '严寒', winterTemp: -18, summerTemp: 28, humidity: 50, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '齐齐哈尔', province: '黑龙江', tier: 4, climate: '严寒', winterTemp: -20, summerTemp: 28, humidity: 48, gdpLevel: 'low', marketMaturity: '稳定' },
    { name: '大庆', province: '黑龙江', tier: 4, climate: '严寒', winterTemp: -18, summerTemp: 29, humidity: 50, gdpLevel: 'medium', marketMaturity: '稳定' },
    { name: '景德镇', province: '江西', tier: 4, climate: '夏热冬冷', winterTemp: 6, summerTemp: 35, humidity: 70, gdpLevel: 'low', marketMaturity: '成长' },
    { name: '连云港', province: '江苏', tier: 4, climate: '夏热冬冷', winterTemp: 3, summerTemp: 33, humidity: 68, gdpLevel: 'low', marketMaturity: '成长' }
    // 可以继续扩展...
  ]
};

/**
 * 获取城市列表
 * @param {string} tier - 城市级别: 'tier1', 'tier2', 'tier3', 'tier4', 'all'
 * @returns {Array} 城市列表
 */
function getCities(tier = 'all') {
  if (tier === 'all') {
    return [
      ...CHINA_CITIES_DATABASE.tier1,
      ...CHINA_CITIES_DATABASE.tierNew1,
      ...CHINA_CITIES_DATABASE.tier2,
      ...CHINA_CITIES_DATABASE.tier3,
      ...CHINA_CITIES_DATABASE.tier4
    ];
  }
  return CHINA_CITIES_DATABASE[tier] || [];
}

/**
 * 根据气候类型获取城市
 * @param {string} climateType - 气候类型
 * @returns {Array} 城市列表
 */
function getCitiesByClimate(climateType) {
  const allCities = getCities('all');
  return allCities.filter(city => city.climate === climateType);
}

/**
 * 获取城市气候特征
 * @param {string} cityName - 城市名称
 * @returns {Object} 气候数据
 */
function getCityClimate(cityName) {
  const allCities = getCities('all');
  return allCities.find(city => city.name === cityName) || null;
}

/**
 * 根据城市推荐暖通方案
 * @param {string} cityName - 城市名称
 * @returns {Object} 推荐方案
 */
function getHVACRecommendation(cityName) {
  const city = getCityClimate(cityName);
  if (!city) return null;

  const recommendations = {
    heating: false,
    cooling: false,
    freshAir: false,
    humidification: false,
    dehumidification: false,
    systems: []
  };

  // 根据气候推荐系统
  if (city.winterTemp < 5) {
    recommendations.heating = true;
    recommendations.systems.push('采暖系统', '地暖');
  }

  if (city.summerTemp > 30) {
    recommendations.cooling = true;
    recommendations.systems.push('中央空调');
  }

  if (city.humidity > 70) {
    recommendations.dehumidification = true;
    recommendations.systems.push('新风除湿', '除湿系统');
  }

  if (city.humidity < 40) {
    recommendations.humidification = true;
    recommendations.systems.push('加湿系统');
  }

  if (city.climate === '夏热冬冷' || city.climate === '寒冷') {
    recommendations.freshAir = true;
    recommendations.systems.push('新风系统');
  }

  // 高GDP城市推荐高端方案
  if (city.gdpLevel === 'high' && city.marketMaturity === '成熟') {
    recommendations.systems.push('五恒系统', '智能家居');
  }

  return {
    city: cityName,
    climate: city.climate,
    recommendations,
    estimatedLoad: {
      heating: city.winterTemp < 5 ? Math.round((20 - city.winterTemp) * 50) : 0,
      cooling: city.summerTemp > 30 ? Math.round((city.summerTemp - 26) * 30) : 0
    }
  };
}

module.exports = {
  CHINA_CITIES_DATABASE,
  getCities,
  getCitiesByClimate,
  getCityClimate,
  getHVACRecommendation
};
