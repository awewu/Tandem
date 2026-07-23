/**
 * 34个城市气候数据完整测试
 * 验证所有城市数据准确性和计算正确性
 */

const OneClickCalculationEngine = require('../server/core/OneClickCalculationEngine');
const InputValidator = require('../server/core/InputValidator');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  34个城市气候数据完整测试');
console.log('═══════════════════════════════════════════════════════════\n');

const engine = new OneClickCalculationEngine();
const validator = new InputValidator();

// 34个城市列表
const cities = {
  一线城市: ['北京', '上海', '广州', '深圳'],
  新一线城市: ['成都', '杭州', '重庆', '武汉', '西安', '苏州', '南京', '长沙', '天津', '郑州', '东莞', '青岛', '昆明', '宁波', '合肥'],
  二线城市: ['无锡', '佛山', '沈阳', '大连', '厦门', '济南', '福州', '温州', '哈尔滨', '长春', '石家庄', '南宁', '贵阳', '南昌', '兰州']
};

let passed = 0;
let failed = 0;

// 测试每个城市
async function testCity(cityName, category) {
  try {
    // 验证城市在验证器中
    const validResult = validator.validate({ city: cityName, area: 120 });
    if (!validResult.valid) {
      throw new Error(`验证器不支持: ${validResult.errors.join(', ')}`);
    }
    
    // 验证城市在气候数据中
    const climateData = engine.climateData[cityName];
    if (!climateData) {
      throw new Error('气候数据缺失');
    }
    
    // 验证气候数据完整性
    const requiredFields = ['summerTemp', 'winterTemp', 'heatingFactor', 'coldWaterTemp', 'climateZone', 'region'];
    for (const field of requiredFields) {
      if (climateData[field] === undefined) {
        throw new Error(`气候数据缺少字段: ${field}`);
      }
    }
    
    // 执行计算
    const result = await engine.calculateAll({
      projectName: `${cityName}测试项目`,
      area: 120,
      city: cityName,
      people: 4,
      bedrooms: 3
    });
    
    if (!result.success) {
      throw new Error(`计算失败: ${result.error}`);
    }
    
    // 验证计算结果
    const data = result.data;
    if (data.project.city !== cityName) {
      throw new Error('城市名称不匹配');
    }
    
    if (!data.summary || data.summary.cost.total <= 0) {
      throw new Error('费用计算异常');
    }
    
    console.log(`✅ ${category} - ${cityName}: 通过 (${data.summary.cost.total.toLocaleString()}元)`);
    return true;
    
  } catch (error) {
    console.log(`❌ ${category} - ${cityName}: 失败 - ${error.message}`);
    return false;
  }
}

// 主测试流程
async function runAllTests() {
  console.log(`城市总数: ${Object.values(cities).flat().length}个\n`);
  
  for (const [category, cityList] of Object.entries(cities)) {
    console.log(`\n【${category}】(${cityList.length}个城市)`);
    console.log('─'.repeat(60));
    
    for (const city of cityList) {
      const success = await testCity(city, category);
      if (success) passed++;
      else failed++;
    }
  }
  
  // 输出统计
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  总城市数: ${passed + failed}`);
  console.log(`  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  // 气候区统计
  console.log('\n  气候区分布:');
  const zoneCount = {};
  Object.values(engine.climateData).forEach(data => {
    zoneCount[data.climateZone] = (zoneCount[data.climateZone] || 0) + 1;
  });
  Object.entries(zoneCount).forEach(([zone, count]) => {
    console.log(`    ${zone}: ${count}个城市`);
  });
  
  // 区域分布
  console.log('\n  地理区域分布:');
  const regionCount = {};
  Object.values(engine.climateData).forEach(data => {
    regionCount[data.region] = (regionCount[data.region] || 0) + 1;
  });
  Object.entries(regionCount).forEach(([region, count]) => {
    console.log(`    ${region}: ${count}个城市`);
  });
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
