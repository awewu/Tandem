/**
 * 6大系统一键计算引擎测试
 * 立即执行验证
 */

const OneClickCalculationEngine = require('../server/core/OneClickCalculationEngine');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  瑞美6大系统一键计算引擎 - 立即执行测试');
console.log('═══════════════════════════════════════════════════════════\n');

const engine = new OneClickCalculationEngine();

// 测试案例1: 标准住宅
const testCase1 = {
  projectName: '测试项目-标准住宅',
  buildingType: '普通住宅',
  area: 120,
  city: '北京',
  climateZone: '夏热冬冷',
  people: 4,
  bedrooms: 3,
  bathrooms: 2,
  enableDOAS: false,
  hasRadiant: false
};

// 测试案例2: 别墅+DOAS
const testCase2 = {
  projectName: '测试项目-高端别墅',
  buildingType: '别墅',
  area: 300,
  city: '上海',
  climateZone: '夏热冬冷',
  people: 6,
  bedrooms: 5,
  bathrooms: 4,
  enableDOAS: true,
  hasRadiant: true
};

async function runTest(testCase, caseName) {
  console.log(`\n📋 ${caseName}`);
  console.log('─'.repeat(60));
  console.log(`项目: ${testCase.projectName}`);
  console.log(`类型: ${testCase.buildingType} | ${testCase.area}㎡ | ${testCase.city}`);
  console.log('─'.repeat(60));
  
  const startTime = Date.now();
  
  try {
    const result = await engine.calculateAll(testCase);
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`\n✅ 计算成功 (${duration}ms)`);
      console.log('\n📊 计算结果:');
      
      const data = result.data;
      
      // 热水系统
      if (data.systems.hotwater) {
        console.log(`\n  🔥 热水系统`);
        console.log(`     日用水量: ${data.systems.hotwater.demand.dailyWater} L/d`);
        console.log(`     设计热负荷: ${data.systems.hotwater.heat.load} kW`);
        console.log(`     设备: ${data.systems.hotwater.equipment.description}`);
        console.log(`     费用: ¥${data.systems.hotwater.cost.total.toLocaleString()}`);
      }
      
      // 净水系统
      if (data.systems.water) {
        console.log(`\n  💧 净水系统`);
        console.log(`     系统类型: ${data.systems.water.treatment.type}`);
        console.log(`     过滤级数: ${data.systems.water.treatment.stages.join(' → ')}`);
        console.log(`     费用: ¥${data.systems.water.cost.total.toLocaleString()}`);
      }
      
      // 新风系统
      if (data.systems.freshair) {
        console.log(`\n  💨 新风系统`);
        console.log(`     新风量: ${data.systems.freshair.freshAir.total} m³/h`);
        console.log(`     热回收: ${data.systems.freshair.heatRecovery.type} SRE${data.systems.freshair.heatRecovery.sre}`);
        console.log(`     费用: ¥${data.systems.freshair.cost.total.toLocaleString()}`);
      }
      
      // 制冷系统
      if (data.systems.cooling) {
        console.log(`\n  ❄️ 制冷系统`);
        console.log(`     冷负荷: ${data.systems.cooling.load.total} W`);
        console.log(`     设计负荷: ${data.systems.cooling.load.design} W`);
        console.log(`     设备: ${data.systems.cooling.equipment.model}`);
        console.log(`     费用: ¥${data.systems.cooling.cost.total.toLocaleString()}`);
      }
      
      // DOAS系统
      if (data.systems.doas) {
        console.log(`\n  🌡️ DOAS系统`);
        console.log(`     送风温度: ${data.systems.doas.design.supplyTemp}℃`);
        console.log(`     热回收: SRE${data.systems.doas.heatRecovery.sre} LRE${data.systems.doas.heatRecovery.lre}`);
        console.log(`     ASHRAE合规: ${data.systems.doas.compliance.overall ? '✓ 合规' : '✗ 不合规'}`);
        console.log(`     费用: ¥${data.systems.doas.cost.total.toLocaleString()}`);
      }
      
      // 供暖系统
      if (data.systems.heating) {
        console.log(`\n  🔥 供暖系统`);
        console.log(`     热负荷: ${data.systems.heating.load.total} W`);
        console.log(`     地暖管: ${data.systems.heating.floorHeating.pipeLength}m @ ${data.systems.heating.floorHeating.pipeSpacing}`);
        console.log(`     分集水器: ${data.systems.heating.floorHeating.circuits}路`);
        console.log(`     费用: ¥${data.systems.heating.cost.total.toLocaleString()}`);
      }
      
      // 控制系统
      if (data.systems.control) {
        console.log(`\n  ⚙️ 控制系统`);
        console.log(`     控制点位: ${data.systems.control.points.total}个`);
        console.log(`     策略: ${data.systems.control.strategies.join(', ')}`);
        console.log(`     费用: ¥${data.systems.control.cost.total.toLocaleString()}`);
      }
      
      // 汇总
      console.log(`\n💰 费用汇总`);
      console.log(`   设备费用: ¥${data.summary.cost.equipment.toLocaleString()}`);
      console.log(`   安装费用: ¥${data.summary.cost.installation.toLocaleString()}`);
      console.log(`   总费用: ¥${data.summary.cost.total.toLocaleString()}`);
      
      return true;
    } else {
      console.log(`\n❌ 计算失败: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`\n❌ 测试异常: ${error.message}`);
    console.log(error.stack);
    return false;
  }
}

// 运行测试
async function main() {
  console.log(`引擎版本: ${engine.version}`);
  console.log(`构建日期: ${engine.buildDate}`);
  console.log(`支持系统: ${engine.systems.join(', ')}`);
  
  let passed = 0;
  let failed = 0;
  
  // 测试1: 标准住宅
  const result1 = await runTest(testCase1, '测试案例1: 标准住宅(120㎡)');
  result1 ? passed++ : failed++;
  
  // 测试2: 别墅+DOAS
  const result2 = await runTest(testCase2, '测试案例2: 别墅+DOAS(300㎡)');
  result2 ? passed++ : failed++;
  
  // 汇总
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  总测试数: 2`);
  console.log(`  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  通过率: ${(passed / 2 * 100).toFixed(0)}%`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

main();
