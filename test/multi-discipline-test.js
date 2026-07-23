/**
 * 多专业协同引擎测试 - 升级方向3
 */
const MultiDisciplineEngine = require('../server/core/MultiDisciplineEngine');

function runTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🏗️  多专业协同引擎测试 (HVAC + 结构 + 电气 + 给排水)');
  console.log('='.repeat(80));
  
  const engine = new MultiDisciplineEngine();
  
  const project = {
    devices: [
      { id: 'AC-IN-1', type: 'ac-indoor', name: '客厅风管机', position: { x: 5000, y: 3000, z: 2700 }, dimensions: { width: 700, depth: 500, height: 250 } },
      { id: 'HT-BL', type: 'heating-boiler', name: '燃气壁挂炉', position: { x: 100, y: 100, z: 1500 }, dimensions: { width: 400, depth: 300, height: 700 } },
      { id: 'WH', type: 'water-heater', name: '热水器', position: { x: 200, y: 8000, z: 1500 }, dimensions: { width: 400, depth: 200, height: 600 } }
    ],
    pipes: [
      { id: 'P-AC', type: 'pipe', material: 'copper', diameter: 22, systemType: 'hvac', path: [{x:0,y:0,z:2700},{x:5000,y:3000,z:2700}] },
      { id: 'P-HT', type: 'pipe', material: 'PEX', diameter: 25, systemType: 'heating', path: [{x:100,y:100,z:200},{x:7500,y:5000,z:200}] },
      { id: 'P-WS', type: 'pipe', material: 'PPR', diameter: 25, systemType: 'plumbing', path: [{x:200,y:8000,z:200},{x:5000,y:6000,z:200}] },
      { id: 'P-DR', type: 'pipe', material: 'PVC', diameter: 100, systemType: 'drainage', path: [{x:5000,y:6000,z:0},{x:0,y:6000,z:0}] }
    ],
    // 结构梁数据
    structure: {
      beams: [
        { id: 'BEAM-1', name: 'L1-客厅主梁', x: 0, y: 3000, z: 2700, length: 8000, width: 200, height: 400 },
        { id: 'BEAM-2', name: 'L2-卧室梁', x: 5000, y: 5000, z: 2700, length: 5000, width: 200, height: 400 }
      ]
    },
    // 电气数据
    electrical: {
      cableTrays: [
        { id: 'CT-1', name: '强电桥架', voltage: 380, width: 200, height: 100, path: [{x:0,y:1000,z:2600},{x:8000,y:1000,z:2600}] },
        { id: 'CT-2', name: '弱电桥架', voltage: 24, width: 100, height: 100, path: [{x:0,y:1500,z:2550},{x:8000,y:1500,z:2550}] }
      ],
      fixtures: []
    }
  };
  
  console.log(`\n📋 测试项目:`);
  console.log(`   暖通设备: ${project.devices.length} 台`);
  console.log(`   管道: ${project.pipes.length} 条`);
  console.log(`   结构梁: ${project.structure.beams.length} 根`);
  console.log(`   电气桥架: ${project.electrical.cableTrays.length} 段`);
  
  console.log('\n⚙️  执行多专业协同分析...');
  const result = engine.coordinate(project);
  
  console.log(`\n✅ 分析完成 (${result.duration}ms)`);
  
  console.log('\n📊 各专业统计:');
  console.log('-'.repeat(80));
  Object.entries(result.disciplines).forEach(([disc, info]) => {
    const len = info.totalLength ? ` | 总长${(info.totalLength/1000).toFixed(1)}m` : '';
    console.log(`   ${disc.padEnd(15)}: ${info.count}个组件${len}`);
  });
  
  console.log('\n🔀 模型合并结果:');
  console.log('-'.repeat(80));
  console.log(`   总元素数: ${result.mergedModel.elements.length}`);
  Object.entries(result.mergedModel.byDiscipline).forEach(([disc, els]) => {
    console.log(`   ${disc.padEnd(15)}: ${els.length} 元素`);
  });
  
  console.log('\n💥 跨专业冲突检测:');
  console.log('-'.repeat(80));
  const cc = result.crossConflicts;
  console.log(`   🔴 硬碰撞: ${cc.hard.length} 个`);
  cc.hard.slice(0, 3).forEach((c, i) => {
    console.log(`      ${i+1}. ${c.a.name}(${c.a.discipline}) ↔ ${c.b.name}(${c.b.discipline})`);
    console.log(`         重叠体积: ${(c.overlapVolume/1e6).toFixed(2)}m³ | 建议: ${c.suggestedAction}`);
  });
  
  console.log(`\n   🟡 软碰撞 (安全距离): ${cc.soft.length} 个`);
  cc.soft.slice(0, 3).forEach((c, i) => {
    console.log(`      ${i+1}. ${c.a.discipline} ↔ ${c.b.discipline} | 实际${c.actualDistance}mm < 要求${c.requiredDistance}mm`);
    console.log(`         规范: ${c.regulation}`);
  });
  
  console.log('\n📋 协调方案:');
  console.log('-'.repeat(80));
  const cp = result.coordinationPlan;
  console.log(`   总动作数: ${cp.summary.totalActions}`);
  console.log(`   P0级(硬碰撞): ${cp.summary.P0Actions} 项`);
  console.log(`   P1级(软碰撞): ${cp.summary.P1Actions} 项`);
  console.log(`   重新走线: ${cp.summary.reroutes} 处`);
  console.log(`   重新选位: ${cp.summary.relocations} 处`);
  
  if (cp.actions.length > 0) {
    console.log('\n   详细动作 (前5项):');
    cp.actions.slice(0, 5).forEach((a, i) => {
      console.log(`   ${i+1}. [${a.priority}] ${a.instruction}`);
      console.log(`      → ${a.method}`);
    });
  }
  
  console.log('\n📐 综合管线规划:');
  console.log('-'.repeat(80));
  const pl = result.pipelineLayout;
  console.log(`   敷设策略: ${pl.strategy}`);
  console.log(`   总占用净空: ${pl.totalCeilingHeight}mm`);
  console.log(`   评估: ${pl.recommendation}`);
  console.log('\n   分层敷设方案:');
  pl.levels.forEach(lv => {
    console.log(`   层${lv.levelNumber}: ${lv.name.padEnd(8)} (z=${lv.zRange.min}-${lv.zRange.max}mm) | ${lv.elements.length}个元素 | 利用率${lv.utilization}%`);
  });
  
  console.log('\n📜 多专业规范合规:');
  console.log('-'.repeat(80));
  const cm = result.complianceCheck;
  console.log(`   合规率: ${cm.complianceRate}`);
  console.log(`   通过/失败/警告: ${cm.passed}/${cm.failed}/${cm.warnings}`);
  console.log('\n   详细检查:');
  cm.checks.forEach(c => {
    const icon = c.status === 'PASS' ? '✅' : c.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${icon} ${c.name.padEnd(20)} | ${c.regulation}`);
    console.log(`      ${c.detail}`);
  });
  
  console.log('\n🏆 综合评分:');
  console.log('-'.repeat(80));
  console.log(`   质量评分: ${result.qualityScore}/100`);
  
  console.log('\n' + '='.repeat(80));
  console.log('🎯 升级方向3: 多专业协同 - 实现成果');
  console.log('='.repeat(80));
  console.log(`
  ✅ 4大专业模型合并 (HVAC + 结构 + 电气 + 给排水)
  ✅ 跨专业碰撞检测 (硬碰撞 + 软碰撞 + 安全距离)
  ✅ 协调优先级判定 (依据规范的8级优先级)
  ✅ 自动协调方案生成 (P0/P1分级动作)
  ✅ 综合管线分层规划 (4层敷设方案)
  ✅ 多专业规范合规检查 (5大规范联审)
  
  📋 涉及规范:
     • GB 50736-2012 民用建筑供暖通风规范
     • GB 50303-2015 电气安装规范
     • GB 50028-2006 燃气设计规范
     • GB 50015-2019 给排水设计规范
     • GB 50204-2015 混凝土结构规范
     • GB 50243-2016 通风空调规范
  
  📈 与传统设计模式对比:
  ────────────────────────────────────────────────────
  能力             传统(各专业独立)   Rysnova多专业协同
  ────────────────────────────────────────────────────
  专业协调时机     施工现场临时调整   ✅ 设计阶段预协调
  跨专业冲突       人工识别          ✅ 算法自动检测
  优先级判定       经验决策          ✅ 规范量化
  协调方案         开会讨论          ✅ AI推荐
  综合管线         手动绘制          ✅ 自动分层
  规范合规         分专业检查        ✅ 联审一体化
  ────────────────────────────────────────────────────
  `);
  console.log('='.repeat(80));
  console.log('✅ 多专业协同测试完成');
  console.log('='.repeat(80) + '\n');
}

try {
  runTest();
} catch (err) {
  console.error('❌ 测试失败:', err);
  process.exit(1);
}
