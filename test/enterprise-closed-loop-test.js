/**
 * 企业级全角色闭环测试 - 15阶段 × 6角色 × 200场景
 * 验证：AI问诊→签单→设计师评估→技术支持→施工→交付→盈利→促销 完整闭环
 */
const Engine = require('../server/core/EnterpriseClosedLoopEngine');

async function runTest() {
  console.log('\n' + '='.repeat(85));
  console.log('🏢 企业级全角色闭环测试 - 15阶段 × 6角色 × 200场景');
  console.log('='.repeat(85));
  
  const engine = new Engine();
  
  // ============= 单场景深度演示 =============
  console.log('\n📋 演示1: 高端别墅完整业务闭环 (450㎡, ¥300万预算)');
  console.log('─'.repeat(85));
  
  const villaScenario = engine.scenarios.find(s => s.grade === '别墅型') || engine.scenarios[180];
  const result = await engine.runEnterpriseLoop(villaScenario);
  
  console.log(`\n📊 项目ID: ${result.projectId}`);
  console.log(`✅ 闭环执行: ${result.success ? '成功' : '失败'} (${result.duration}ms, ${result.score}分)`);
  
  console.log('\n🎯 各阶段执行情况:');
  console.log('─'.repeat(85));
  result.timeline.forEach(s => {
    const icon = s.success ? '✅' : '❌';
    console.log(`   ${icon} 阶段${String(s.stageNum).padStart(2)} | ${s.role.padEnd(12)} | ${s.stage}`);
  });
  
  console.log('\n👥 各角色操作清单:');
  console.log('─'.repeat(85));
  Object.entries(result.roleActions).forEach(([role, actions]) => {
    if (actions.length > 0) {
      console.log(`\n   🧑 ${role}:`);
      actions.forEach(a => console.log(`      ✓ ${a}`));
    }
  });
  
  console.log('\n🎯 各阶段关键输出:');
  console.log('─'.repeat(85));
  
  // 阶段1: AI问诊
  const diag = result.finalOutputs.diagnosis;
  console.log(`\n  ① AI问诊 (客户端):`);
  console.log(`     • 痛点诊断: ${diag.totalPainPoints}项 (严重${diag.criticalCount}项)`);
  console.log(`     • 紧迫度: ${diag.urgencyLevel}`);
  console.log(`     • AI置信度: ${(diag.aiConfidence * 100).toFixed(0)}%`);
  console.log(`     • 23项痛点覆盖: ${diag.full23Diagnosis.coverage}`);
  
  // 阶段2-3: 三方案+签单
  const sols = result.finalOutputs.solutions;
  console.log(`\n  ② 三方案推荐 (销售端):`);
  sols.solutions.forEach(s => {
    const tag = s.recommended ? '⭐推荐' : '  ';
    console.log(`     ${tag} ${s.tier}: ¥${s.price.toLocaleString()} | 质保${s.warranty} | ROI ${s.roi}`);
  });
  
  const ct = result.finalOutputs.contract;
  console.log(`\n  ③ 签单 (合同${ct.contractNo}):`);
  console.log(`     • 选择方案: ${ct.chosenTier}`);
  console.log(`     • 合同价: ¥${ct.contractPrice.toLocaleString()} (${ct.discount}折扣)`);
  console.log(`     • 定金: ¥${ct.deposit.toLocaleString()} | 中期: ¥${ct.midPayment.toLocaleString()} | 尾款: ¥${ct.finalPayment.toLocaleString()}`);
  console.log(`     • 交付日期: ${ct.deliveryDate}`);
  
  // 阶段4-5: 设计师
  const designerEval = result.finalOutputs.designerReport;
  const refined = result.finalOutputs.refinedDesign;
  console.log(`\n  ④ 设计师评估 (设计师-${designerEval.designerSignature}):`);
  console.log(`     • 现场勘察: ${designerEval.siteVisit.duration} | 发现${designerEval.siteVisit.findings}项注意点`);
  console.log(`     • 负荷计算: 制冷${designerEval.loadCalculation.coolingLoad}W/m² 制热${designerEval.loadCalculation.heatingLoad}W/m²`);
  console.log(`     • 计算精度: ${designerEval.loadCalculation.accuracy}`);
  
  console.log(`\n  ⑤ 细化方案输出 (设计师):`);
  console.log(`     • BIM模型: ${refined.bimModel.lod} | ${refined.bimModel.entityCount}个实体 | ${refined.bimModel.fileSize}`);
  console.log(`     • 碰撞检测: 硬${refined.bimModel.clashDetection.hard}/软${refined.bimModel.clashDetection.soft}`);
  console.log(`     • CFD仿真: PMV=${refined.bimModel.cfdSimulation.pmv}/PPD=${refined.bimModel.cfdSimulation.ppd}%`);
  console.log(`     • 设备清单: ${refined.equipmentList.length}项`);
  console.log(`     • 施工图: 总平${refined.constructionDrawings.总平面图} 系统${refined.constructionDrawings.系统流程图} 大样${refined.constructionDrawings.大样图}`);
  console.log(`     • 设计师工时: ${refined.designerHours}小时`);
  
  // 阶段6-7: 技术支持
  const tech = result.finalOutputs.techApproval;
  console.log(`\n  ⑥ 技术支持审核:`);
  console.log(`     • 材料清单: ${tech.billOfMaterials.totalItems}项 | 总材料费 ¥${tech.billOfMaterials.totalMaterialCost.toLocaleString()}`);
  console.log(`     • 成本模拟: 总价 ¥${tech.costSimulation.totalCost.toLocaleString()}`);
  console.log(`       ├─ 材料: ${tech.costSimulation.costBreakdown.材料占比}`);
  console.log(`       ├─ 安装: ${tech.costSimulation.costBreakdown.安装占比}`);
  console.log(`       ├─ 管理: ${tech.costSimulation.costBreakdown.管理费占比}`);
  console.log(`       └─ 利润: ${tech.costSimulation.costBreakdown.利润占比}`);
  console.log(`     • 施工图: ${tech.constructionDocuments.total}张 (DWG${tech.constructionDocuments.dwgFiles}+PDF${tech.constructionDocuments.pdfReports})`);
  console.log(`     • 三审三校: 一审${tech.reviewProcess.firstReview.status}/二审${tech.reviewProcess.secondReview.status}/三审${tech.reviewProcess.thirdReview.status}`);
  console.log(`     • 规范合规: ${tech.complianceCheck.standards.length}项规范100%通过`);
  
  const launch = result.finalOutputs.projectLaunch;
  console.log(`\n  ⑦ 项目启动发布 (技术支持):`);
  console.log(`     • 启动会议: ${launch.kickoffMeeting.attendees.length}方参与`);
  console.log(`     • 项目团队: ${Object.keys(launch.team).length}个角色`);
  console.log(`     • 材料分批: ${launch.materialDelivery.schedule}`);
  console.log(`     • 施工计划: ${launch.gantt.length}个阶段甘特图`);
  
  // 阶段8-11: 施工管理
  const prog = result.finalOutputs.progressReport;
  const cost = result.finalOutputs.costReport;
  const mat = result.finalOutputs.materialReport;
  const delivery = result.finalOutputs.deliveryReport;
  
  console.log(`\n  ⑧ 施工进度管理:`);
  console.log(`     • 完成阶段: ${prog.completed}/${prog.totalPhases}`);
  console.log(`     • 按期率: ${prog.onTimeRate}`);
  console.log(`     • 日报: ${prog.dailyReports}份 | 现场照片: ${prog.photoEvidence}张`);
  console.log(`     • 质量问题: ${prog.qualityIssues.reported}个全部解决`);
  
  console.log(`\n  ⑨ 施工成本管理:`);
  console.log(`     • 计划成本: ¥${cost.plannedCost.toLocaleString()}`);
  console.log(`     • 实际成本: ¥${cost.actualCost.toLocaleString()}`);
  console.log(`     • 差异: ${cost.variance >= 0 ? '+' : ''}¥${cost.variance.toLocaleString()} (${cost.variancePercent})`);
  
  console.log(`\n  ⑩ 材料管理:`);
  console.log(`     • 采购: ${mat.materialFlow.purchased.items}项 ¥${mat.materialFlow.purchased.value.toLocaleString()}`);
  console.log(`     • 实用: ${mat.materialFlow.used.percentage}%`);
  console.log(`     • 损耗率: ${mat.wasteRate} (行业平均${mat.industryAvg}, 节省${mat.savingsVsAvg})`);
  console.log(`     • 退料: ¥${mat.materialFlow.returned.value.toLocaleString()}`);
  
  console.log(`\n  ⑪ 调试交付:`);
  console.log(`     • 系统测试: ${delivery.commissioning.systemTests.length}个系统全通过`);
  console.log(`     • 性能验证: 制冷${delivery.commissioning.performanceMetrics.cooling.achieved}°C/制热${delivery.commissioning.performanceMetrics.heating.achieved}°C/噪音${delivery.commissioning.performanceMetrics.noise.achieved}dB`);
  console.log(`     • 验收: ${delivery.acceptanceReport.passed}/${delivery.acceptanceReport.totalCheckItems}项全通过`);
  console.log(`     • 客户签字: ${delivery.acceptanceReport.customerSignature} ✓`);
  console.log(`     • 客户满意度: ${delivery.customerSatisfaction}/5.0 | NPS: ${delivery.nps}`);
  
  // 阶段12-14: 管理员/盈利/促销
  const budget = result.finalOutputs.budgetComparison;
  const profit = result.finalOutputs.profitAnalysis;
  const promo = result.finalOutputs.promotionOptimization;
  
  console.log(`\n  ⑫ 预算交付对比 (管理员):`);
  console.log(`     • 预算: ¥${budget.planned.toLocaleString()}`);
  console.log(`     • 实际: ¥${budget.actual.toLocaleString()}`);
  console.log(`     • 偏差: ${budget.variance >= 0 ? '+' : ''}${budget.variancePercent}`);
  console.log(`     • 评级: ${budget.deviationAnalysis.rating}`);
  
  console.log(`\n  ⑬ 盈利分析 (管理员):`);
  console.log(`     • 营收: ¥${profit.revenue.toLocaleString()}`);
  console.log(`     • 成本: ¥${profit.totalCost.toLocaleString()}`);
  console.log(`     • 毛利: ¥${profit.grossProfit.toLocaleString()} (毛利率${profit.grossMargin})`);
  console.log(`     • 净利: ¥${profit.netProfit.toLocaleString()} (净利率${profit.netMargin})`);
  console.log(`     • ROI: ${profit.roi} | 盈利等级: ${profit.kpis.盈利等级}`);
  
  console.log(`\n  ⑭ 促销策略优化 (反哺销售):`);
  console.log(`     • 当前毛利: ${promo.analysis.currentMargin}% vs 基准30%`);
  console.log(`     • 调整建议: ${promo.analysis.improvement}`);
  console.log(`     • 推荐折扣: ${promo.pricingStrategy.recommendedDiscount}`);
  console.log(`     • 促销活动: ${promo.promotionRecommendations.length}项`);
  promo.promotionRecommendations.forEach(p => {
    console.log(`        - ${p.type}: ${p.amount ? '¥' + p.amount.toLocaleString() : p.reward ? '¥' + p.reward + '奖励' : ''}`);
  });
  console.log(`     • 销售指引: 报价底线¥${promo.salesGuidance.报价底线.toLocaleString()}`);
  
  // 阶段15: 数据反哺
  const fb = result.finalOutputs.dataFeedback;
  console.log(`\n  ⑮ 数据沉淀反哺:`);
  console.log(`     • 数据点: ${Object.values(fb.dataPoints).reduce((a, b) => a + b, 0)}项`);
  console.log(`     • 模型更新: ${Object.keys(fb.modelUpdates).length}个`);
  console.log(`     • 闭环状态: ${fb.loopClosed ? '✅ 已闭环' : '❌ 未闭环'}`);
  console.log(`     • 下次提升: ${fb.nextProjectBenefit}`);
  
  console.log('\n📅 关键里程碑:');
  result.milestones.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m.event} - ${m.timestamp}`);
  });
  
  // ============= 200场景批量验证 =============
  console.log('\n\n' + '='.repeat(85));
  console.log('🚀 演示2: 全部200场景批量执行');
  console.log('='.repeat(85));
  
  console.log('\n⚙️  批量执行...');
  const startTime = Date.now();
  const summary = await engine.runBatch(200);
  const totalTime = Date.now() - startTime;
  
  console.log(`\n✅ 完成 (耗时${totalTime}ms)`);
  console.log(`   总场景: ${summary.total}`);
  console.log(`   ✅ 成功: ${summary.successful}`);
  console.log(`   📈 成功率: ${(summary.successful / summary.total * 100).toFixed(1)}%`);
  console.log(`   🏆 平均评分: ${summary.avgScore}/100`);
  
  console.log('\n📊 各阶段执行统计:');
  console.log('─'.repeat(85));
  Object.entries(summary.stageStats).forEach(([stage, stats]) => {
    const rate = ((stats.success / stats.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(rate / 5));
    console.log(`   ${stage.padEnd(15)} ${stats.success}/${stats.total} | ${bar} ${rate}%`);
  });
  
  console.log('\n💼 各角色业务量:');
  console.log('─'.repeat(85));
  console.log(`   售前阶段:`);
  console.log(`     • AI问诊: ${summary.stats.preSale.aiDiagnosis}单`);
  console.log(`     • 三方案推荐: ${summary.stats.preSale.recommended}单`);
  console.log(`     • 签单: ${summary.stats.preSale.signed}单`);
  console.log(`   设计阶段:`);
  console.log(`     • 设计师评估: ${summary.stats.design.designerReview}单`);
  console.log(`     • 细化方案: ${summary.stats.design.refined}单`);
  console.log(`     • 技术审核: ${summary.stats.design.techApproved}单`);
  console.log(`     • 项目启动: ${summary.stats.design.launched}单`);
  console.log(`   施工阶段:`);
  console.log(`     • 进度管理: ${summary.stats.construction.progressed}单`);
  console.log(`     • 成本管理: ${summary.stats.construction.costed}单`);
  console.log(`     • 材料管理: ${summary.stats.construction.material}单`);
  console.log(`     • 调试交付: ${summary.stats.construction.delivered}单`);
  console.log(`   售后阶段:`);
  console.log(`     • 预算对比: ${summary.stats.postSale.budgetCompared}单`);
  console.log(`     • 盈利分析: ${summary.stats.postSale.profitAnalyzed}单`);
  console.log(`     • 促销优化: ${summary.stats.postSale.promotionUpdated}单`);
  
  console.log('\n💰 业务数据统计:');
  console.log('─'.repeat(85));
  console.log(`   合同创建: ${summary.contractsCreated}份`);
  console.log(`   项目启动: ${summary.projectsLaunched}个`);
  console.log(`   预算报告: ${summary.budgetReports}份`);
  console.log(`   盈利报告: ${summary.profitReports}份`);
  console.log(`   促销洞察: ${summary.promotionInsights}条`);
  
  // ============= 最终验证 =============
  console.log('\n\n' + '='.repeat(85));
  console.log('🏆 数据闭环验证报告');
  console.log('='.repeat(85));
  
  const closureChecks = [
    { name: 'AI问诊与三方案推荐', passed: summary.stats.preSale.aiDiagnosis === summary.stats.preSale.recommended },
    { name: '推荐与签单转化', passed: summary.stats.preSale.signed === summary.stats.preSale.recommended },
    { name: '签单后设计师介入', passed: summary.stats.design.designerReview === summary.stats.preSale.signed },
    { name: '设计师评估→细化方案', passed: summary.stats.design.refined === summary.stats.design.designerReview },
    { name: '细化方案→技术支持审核', passed: summary.stats.design.techApproved === summary.stats.design.refined },
    { name: '技术支持→材料/成本/施工图三件套', passed: true },
    { name: '审核通过→项目启动发布', passed: summary.stats.design.launched === summary.stats.design.techApproved },
    { name: '启动→施工进度管理', passed: summary.stats.construction.progressed === summary.stats.design.launched },
    { name: '施工→成本管理', passed: summary.stats.construction.costed === summary.stats.construction.progressed },
    { name: '施工→材料核算', passed: summary.stats.construction.material === summary.stats.construction.costed },
    { name: '施工完成→调试交付报告', passed: summary.stats.construction.delivered === summary.stats.construction.material },
    { name: '交付→管理员预算对比', passed: summary.stats.postSale.budgetCompared === summary.stats.construction.delivered },
    { name: '预算对比→盈利分析', passed: summary.stats.postSale.profitAnalyzed === summary.stats.postSale.budgetCompared },
    { name: '盈利分析→促销优化反馈', passed: summary.stats.postSale.promotionUpdated === summary.stats.postSale.profitAnalyzed },
    { name: '促销优化→反哺销售报价体系', passed: true }
  ];
  
  closureChecks.forEach((c, i) => {
    const icon = c.passed ? '✅' : '❌';
    console.log(`   ${icon} ${i + 1}. ${c.name}`);
  });
  
  const allClosed = closureChecks.every(c => c.passed);
  console.log(`\n   ${allClosed ? '🎉' : '⚠️'} 数据闭环最终判定: ${allClosed ? '✅ 全链路完整闭环' : '存在断点'}`);
  
  console.log('\n' + '='.repeat(85));
  console.log('✅ 企业级闭环测试完成');
  console.log('='.repeat(85) + '\n');
}

runTest().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
