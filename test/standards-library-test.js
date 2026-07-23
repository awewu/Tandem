/**
 * 专业标准库测试 - 热水(国标+欧美) + DOAS专项
 */
const ProfessionalStandardsLibrary = require('../server/core/ProfessionalStandardsLibrary');

console.log('\n' + '='.repeat(80));
console.log('📜 专业规范标准库测试 - 热水 + DOAS');
console.log('='.repeat(80));

const lib = new ProfessionalStandardsLibrary();

// ========== 列出全部标准 ==========
console.log('\n📚 全部标准清单:');
console.log('-'.repeat(80));
const list = lib.listAllStandards();

console.log(`\n🚿 热水标准 (${list.hotWater.china.length + list.hotWater.international.length}项):`);
console.log('   国标 (China GB/JG/CJJ):');
list.hotWater.china.forEach(s => console.log(`     ✓ ${s}`));
console.log('   国际标准 (ASHRAE/UPC/NSF/EN/ISO):');
list.hotWater.international.forEach(s => console.log(`     ✓ ${s}`));

console.log(`\n🌬️  DOAS标准 (${list.doas.core.length + list.doas.supporting.length}项):`);
console.log('   核心标准:');
list.doas.core.forEach(s => console.log(`     ✓ ${s}`));
console.log('   配套标准:');
list.doas.supporting.forEach(s => console.log(`     ✓ ${s}`));

console.log(`\n📊 合计: ${list.total} 项专业标准`);

// ========== 热水合规测试 ==========
console.log('\n\n📋 测试1: 高端别墅热水系统合规检查');
console.log('-'.repeat(80));

const hwDesign = {
  buildingType: 'residential',
  population: 5,
  dailyUsage: 320,           // 5人×60L = 300L
  supplyTemp: 65,             // GB 50015要求60-75°C
  pressureTest: true,
  storageTemp: 60,            // ASHRAE 188关键
  distributionTemp: 55,
  returnTemp: 51,
  insulationR: 4.5,           // ASHRAE 90.1
  scaldProtection: true,      // UPC防烫
  nsfCertified: true,         // NSF 61
  thermalDisinfection: true,  // ASHRAE 188
  deadLegRemoved: true,
  solarSystem: true,
  solarFraction: 0.55,
  heatPumpWaterHeater: true,
  cop: 3.2
};

const hwResult = lib.checkHotWaterCompliance(hwDesign);

console.log(`\n   📊 国标检查 (${hwResult.china.checks.length}项):`);
hwResult.china.checks.forEach((c, i) => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} [${c.regulation}] ${c.name}`);
  if (c.detail) console.log(`      ${c.detail}`);
});

console.log(`\n   🌍 国际标准检查 (${hwResult.international.checks.length}项):`);
hwResult.international.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} [${c.regulation}] ${c.name}`);
  if (c.detail) console.log(`      ${c.detail}`);
});

console.log(`\n   🦠 军团菌风险检查 (ASHRAE 188-2018) - 健康关键:`);
hwResult.legionellaRisk.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  const sev = c.severity ? ` [${c.severity}]` : '';
  console.log(`   ${icon}${sev} ${c.name}: ${c.requirement}`);
});

console.log(`\n   🏆 综合结果:`);
console.log(`      合规率: ${hwResult.summary.complianceRate}`);
console.log(`      评分: ${hwResult.summary.score}/100`);
console.log(`      等级: ${hwResult.summary.grade}`);
console.log(`      通过/警告/失败: ${hwResult.summary.passed}/${hwResult.summary.warnings}/${hwResult.summary.failed}`);

// ========== DOAS合规测试 ==========
console.log('\n\n📋 测试2: 高端商业建筑DOAS系统合规检查');
console.log('-'.repeat(80));

const doasDesign = {
  spaceType: 'office',
  occupancy: 50,
  area: 500,                  // m²
  outdoorAirflow: 280,         // L/s (Voz = 2.5×50 + 0.3×500 = 275)
  zoneEffectiveness: 0.85,
  sfp: 1.3,                    // 比风机功率
  sre: 78,                     // 显热回收
  lre: 65,                     // 潜热回收
  mervRating: 14,              // MERV14
  epm1: 65,                    // ePM1效率
  co2Monitoring: true,
  pm25Monitoring: true,
  demandControlVentilation: true,
  economizer: true,
  supplyAirReset: true,
  dxDoas: true,
  ieer: 14.5
};

const doasResult = lib.checkDOASCompliance(doasDesign);

console.log(`\n   ✈️  通风量(ASHRAE 62.1):`);
doasResult.ventilation.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} ${c.name}: ${c.detail || c.requirement}`);
});

console.log(`\n   ⚡ 能效(ASHRAE 90.1 + AHRI 920):`);
doasResult.energy.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} ${c.name}: 实际${c.actual} (要求${c.requirement})`);
});

console.log(`\n   🌫️  IAQ室内空气品质:`);
doasResult.iaq.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} ${c.name}`);
});

console.log(`\n   🛡️  过滤(ASHRAE 52.2 + ISO 16890):`);
doasResult.filtration.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} ${c.name}: ${c.detail || ''}`);
});

console.log(`\n   ♻️  热回收:`);
doasResult.heatRecovery.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  const crit = c.critical ? ' [关键]' : '';
  console.log(`   ${icon}${crit} ${c.name}: ${c.detail || c.requirement}`);
});

console.log(`\n   🎛️  控制系统(Guideline 36):`);
doasResult.controls.checks.forEach(c => {
  const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`   ${icon} ${c.name}`);
});

console.log(`\n   🏆 综合结果:`);
console.log(`      合规率: ${doasResult.summary.complianceRate}`);
console.log(`      评分: ${doasResult.summary.score}/100`);
console.log(`      等级: ${doasResult.summary.grade}`);
console.log(`      可申请认证:`);
doasResult.summary.certifications.forEach(c => console.log(`        🎖️  ${c}`));

// ========== 总结 ==========
console.log('\n' + '='.repeat(80));
console.log('🎯 标准体系补强成果');
console.log('='.repeat(80));

const summary = lib.healthCheck();
console.log(`
  📚 标准库总览:
     总计: ${summary.totalStandards} 项专业标准
     
  🚿 热水标准 (${summary.hotWaterStandards.china + summary.hotWaterStandards.international}项):
     ├─ 国标 GB/JG/CJJ: ${summary.hotWaterStandards.china}项
     │   GB 50015-2019 (建筑给水排水)
     │   GB 50736-2012 (供暖通风空调)
     │   GB 50242-2002 (施工质量验收)
     │   GB 50364-2018 (太阳能热水)
     │   JGJ 142-2012 (辐射供暖)
     │   CJJ/T 81-2013 (城镇供热直埋)
     │   GB/T 18713-2002 (太阳能验收)
     │
     └─ 国际标准: ${summary.hotWaterStandards.international}项
         ASHRAE 90.1-2022 (能效)
         ASHRAE 188-2018 (军团菌防控) ★关键
         UPC (美国管道规范)
         IPC (国际管道规范)
         NSF/ANSI 61 (饮用水材料) ★关键
         NSF/ANSI 372 (无铅认证)
         NSF/ANSI 5 (商用热水设备)
         EN 12828 (欧洲采暖)
         EN 806-1~5 (欧洲饮用水)
         ISO 9459-2 (太阳能测试)
         EN 16147 (热泵热水器)
         ASHRAE 90.2 (住宅能效)
  
  🌬️  DOAS标准 (${summary.doasStandards.core + summary.doasStandards.supporting}项):
     ├─ 核心标准: ${summary.doasStandards.core}项
     │   ASHRAE 62.1-2022 (通风+IAQ) ★关键
     │   ASHRAE 90.1-2022 (DOAS能效)
     │   ASHRAE 189.1-2020 (绿色建筑)
     │   ASHRAE Guideline 36-2021 (控制序列)
     │   AHRI 920-2020 (DX-DOAS认证) ★关键
     │
     └─ 配套标准: ${summary.doasStandards.supporting}项
         ASHRAE 55-2020 (热舒适)
         ASHRAE 52.2-2017 (MERV过滤)
         ISO 16890-1 (国际过滤)
         GB 50736-2012 (中国新风)
         GB/T 51141-2015 (绿改评价)
         EN 16798-3 (欧洲DOAS)
         EN 308 (欧洲热交换器)

  📈 标准体系完整性提升:
  ─────────────────────────────────────────────
                v7.0           v8.0(本次)
  热水(国标)     2项   →     7项   (+250%)
  热水(国际)     0项   →     12项  (新增)
  DOAS核心       2项   →     5项   (+150%)
  DOAS配套       1项   →     7项   (+600%)
  总计           ~13项 →     31项  (+138%)
  ─────────────────────────────────────────────
`);

console.log('='.repeat(80));
console.log('✅ 标准体系补强测试完成');
console.log('='.repeat(80) + '\n');
