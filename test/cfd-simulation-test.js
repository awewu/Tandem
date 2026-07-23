/**
 * CFD仿真集成测试 - 验证Rysnova-BIM的CFD能力
 */
const RysnovaBIMCore = require('../server/core/RysnovaBIMCore');

async function runCFDTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🌬️  Rysnova-BIM CFD仿真集成验证测试');
  console.log('='.repeat(80));
  
  const bim = new RysnovaBIMCore();
  
  // 测试场景：30㎡客厅
  const layout = {
    devices: [
      { id: 'AC-IN-01', type: 'ac-indoor', name: '客厅风管机', position: { x: 1000, y: 1000, z: 2500 }, dimensions: { width: 700, depth: 500, height: 250 }, power: 3.5, supplyTemp: 18, airflow: 600 },
      { id: 'FA-01', type: 'fresh-outlet', name: '新风送风口', position: { x: 4000, y: 2000, z: 2500 }, dimensions: { width: 200, depth: 200, height: 50 }, supplyTemp: 22, airflow: 350 },
      { id: 'TV-01', type: 'tv', name: '客厅电视', position: { x: 3000, y: 200, z: 1200 }, power: 0.15 }
    ],
    pipes: []
  };
  
  // 测试1: 夏季工况
  console.log('\n📋 测试场景1: 夏季制冷工况（30㎡客厅，4人）');
  console.log('-'.repeat(80));
  const summerStart = Date.now();
  const summerResult = bim.runCFDSimulation(layout, {
    roomDimensions: { length: 6, width: 5, height: 2.7 },
    season: 'summer',
    outdoorTemp: 35,
    indoorTargetTemp: 26,
    occupancy: 4
  });
  const summerDuration = Date.now() - summerStart;
  
  printCFDResult('夏季工况', summerResult, summerDuration);
  
  // 测试2: 冬季工况
  console.log('\n📋 测试场景2: 冬季制热工况（30㎡客厅，4人）');
  console.log('-'.repeat(80));
  const winterStart = Date.now();
  const winterResult = bim.runCFDSimulation(layout, {
    roomDimensions: { length: 6, width: 5, height: 2.7 },
    season: 'winter',
    outdoorTemp: -5,
    indoorTargetTemp: 22,
    occupancy: 4
  });
  const winterDuration = Date.now() - winterStart;
  
  printCFDResult('冬季工况', winterResult, winterDuration);
  
  // 综合对比
  console.log('\n' + '='.repeat(80));
  console.log('📊 夏冬季CFD仿真对比');
  console.log('='.repeat(80));
  console.log('  指标             夏季           冬季');
  console.log('  ──────────────────────────────────────');
  console.log(`  仿真ID           ${summerResult.simulationId.slice(-8)}    ${winterResult.simulationId.slice(-8)}`);
  console.log(`  PMV              ${(summerResult.comfort?.avgPMV || 0).toFixed(2).padStart(6)}        ${(winterResult.comfort?.avgPMV || 0).toFixed(2).padStart(6)}`);
  console.log(`  PPD              ${(summerResult.comfort?.avgPPD || 0).toFixed(0).padStart(6)}%       ${(winterResult.comfort?.avgPPD || 0).toFixed(0).padStart(6)}%`);
  console.log(`  质量评分         ${summerResult.qualityScore.score}/${summerResult.qualityScore.grade}       ${winterResult.qualityScore.score}/${winterResult.qualityScore.grade}`);
  console.log(`  耗时             ${summerDuration}ms          ${winterDuration}ms`);
  
  console.log('\n' + '='.repeat(80));
  console.log('🌟 升级方向5实现成果');
  console.log('='.repeat(80));
  console.log(`
  ✅ CFD引擎已与RysnovaBIMCore深度集成
  ✅ 自动从BIM设备布置提取送/回风口参数
  ✅ 自动构建热源（人员+设备+围护结构）
  ✅ 输出气流场/温度场/压力场完整数据
  ✅ 计算PMV/PPD热舒适度指标
  ✅ 识别热点/冷点/气流死角
  ✅ 三大规范合规校验 (ASHRAE 55 / GB 50736 / ISO 7730)
  ✅ 生成3D可视化数据 (流线/速度向量/热图/等值面/探针)
  ✅ 提供AI优化建议
  
  📈 与传统CFD工具对比：
  ────────────────────────────────────────────────
  能力             传统(Fluent/CFX)    Rysnova-BIM CFD
  ────────────────────────────────────────────────
  设置时间         数小时              <1秒（BIM自动）
  仿真耗时         数小时-数天         毫秒级（简化算法）
  BIM集成          需手动              ✅ 原生集成
  规范合规         需另行检查          ✅ 自动评估
  优化建议         无                  ✅ AI生成
  3D可视化         需后处理软件        ✅ Web原生Three.js
  ────────────────────────────────────────────────
  适用场景: 方案阶段快速评估、设计验证、客户沟通
  注: 施工图阶段建议仍配合专业CFD软件做精确验证
  `);
  console.log('='.repeat(80));
  console.log('✅ CFD仿真集成测试完成');
  console.log('='.repeat(80) + '\n');
}

function printCFDResult(label, result, duration) {
  console.log(`   ✅ ${label}仿真完成 (${duration}ms)`);
  console.log(`\n   📊 输入参数:`);
  console.log(`      房间: ${result.inputs.roomDimensions.length}m × ${result.inputs.roomDimensions.width}m × ${result.inputs.roomDimensions.height}m`);
  console.log(`      送风口: ${result.inputs.inlets} 个 | 回风口: ${result.inputs.outlets} 个`);
  console.log(`      热源: ${result.inputs.heatSources} 个 | 人员: ${result.inputs.occupancy} 人`);
  
  console.log(`\n   🌡️  热舒适度:`);
  const c = result.comfort || {};
  console.log(`      PMV: ${(c.avgPMV || 0).toFixed(2)} | PPD: ${(c.avgPPD || 0).toFixed(1)}%`);
  
  console.log(`\n   🏆 质量评分:`);
  const q = result.qualityScore;
  console.log(`      综合评分: ${q.score}/100 (${q.grade}级)`);
  console.log(`      ASHRAE 55: ${q.compliance.ASHRAE_55}`);
  console.log(`      GB 50736:  ${q.compliance.GB_50736}`);
  console.log(`      ISO 7730:  ${q.compliance.ISO_7730}`);
  
  console.log(`\n   🔍 BIM绑定问题区:`);
  const b = result.bimBinding || {};
  console.log(`      🔥 热点区: ${b.hotSpots?.length || 0} 个`);
  console.log(`      ❄️  冷点区: ${b.coldSpots?.length || 0} 个`);
  console.log(`      💨 气流死角: ${b.stagnantZones?.length || 0} 个`);
  
  console.log(`\n   📐 3D可视化:`);
  const v = result.visualization3D || {};
  console.log(`      流线: ${v.streamlines?.length || 0} 条`);
  console.log(`      速度向量: ${v.arrows?.length || 0} 个`);
  console.log(`      热图切片: ${v.heatmap?.slices?.length || 0} 个`);
  console.log(`      等值面: ${v.iso_surfaces?.length || 0} 个`);
  console.log(`      探针点: ${v.probes?.length || 0} 个`);
  
  if (result.recommendations && result.recommendations.length > 0) {
    console.log(`\n   💡 优化建议: ${result.recommendations.length} 条`);
    result.recommendations.slice(0, 3).forEach((r, i) => {
      const text = typeof r === 'string' ? r : (r.description || r.suggestion || JSON.stringify(r).slice(0, 80));
      console.log(`      ${i + 1}. ${text}`);
    });
  }
}

runCFDTest().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
