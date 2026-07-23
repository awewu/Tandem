/**
 * 瑞美全业务导出引擎 - ExportEngine
 * 支持：报价/设计方案/问诊/锁客/材料/图纸/销售方案书/分析报表
 */

const fs = require('fs');
const path = require('path');

class ExportEngine {
  constructor() {
    this.version = '1.0.0';
    this.exportPath = path.join(__dirname, '../../exports');
    this.ensureExportDir();
  }

  ensureExportDir() {
    if (!fs.existsSync(this.exportPath)) {
      fs.mkdirSync(this.exportPath, { recursive: true });
    }
  }

  /**
   * 1. 报价体系导出
   * 支持：Excel/PDF/JSON格式
   */
  exportQuotation(quotationData, format = 'excel') {
    const { quoteId, projectName, customer, items, totals, versions } = quotationData;
    
    console.log(`[ExportEngine] 导出报价单 ${quoteId}`);
    
    switch (format.toLowerCase()) {
      case 'excel':
      case 'xlsx':
        return this.generateQuotationExcel(quotationData);
      case 'pdf':
        return this.generateQuotationPDF(quotationData);
      case 'json':
        return this.generateJSONExport('quotation', quotationData);
      default:
        throw new Error(`不支持的报价导出格式: ${format}`);
    }
  }

  generateQuotationExcel(data) {
    const { quoteId, projectName, versions } = data;
    
    // 生成CSV格式（可用xlsx库转换为真正Excel）
    let csv = '瑞美舒适家居 - 智能报价单\n\n';
    csv += `报价单号,${quoteId}\n`;
    csv += `项目名称,${projectName}\n`;
    csv += `生成日期,${new Date().toLocaleString()}\n\n`;
    
    // 三版本对比
    csv += '版本对比,经济版,标准版,尊享版\n';
    csv += `总价,${versions.economy.amount},${versions.standard.amount},${versions.premium.amount}\n`;
    csv += `每平米单价,${versions.economy.perSqm},${versions.standard.perSqm},${versions.premium.perSqm}\n\n`;
    
    // 明细清单
    csv += '序号,项目,规格,单位,数量,单价,金额,备注\n';
    data.details?.forEach((item, index) => {
      csv += `${index + 1},${item.name},${item.spec || '-'},${item.unit || '-'},${item.quantity || 1},${item.unitPrice || item.amount},${item.amount},${item.notes || ''}\n`;
    });
    
    return this.saveExport('quotation', `${quoteId}_报价单`, 'csv', csv);
  }

  generateQuotationPDF(data) {
    // 生成HTML后转PDF
    const html = this.generateQuotationHTML(data);
    return {
      format: 'PDF',
      content: html,
      note: '使用puppeteer或wkhtmltopdf转换为PDF',
      previewUrl: `/exports/${data.quoteId}_报价单.html`
    };
  }

  generateQuotationHTML(data) {
    const { projectName, versions, dimensions } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>瑞美报价单 - ${projectName}</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; margin: 40px; }
    .header { text-align: center; border-bottom: 3px solid #C41230; padding-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; color: #C41230; }
    .title { font-size: 20px; margin: 20px 0; }
    .version-cards { display: flex; gap: 20px; margin: 30px 0; }
    .version-card { flex: 1; border: 2px solid #ddd; padding: 20px; text-align: center; }
    .version-card.recommended { border-color: #C41230; background: #fff5f5; }
    .price { font-size: 28px; font-weight: bold; color: #C41230; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🏠 瑞美舒适家居</div>
    <div class="title">${projectName} - 智能设计方案报价</div>
    <p>报价单号: ${data.quoteId} | 日期: ${new Date().toLocaleDateString()}</p>
  </div>
  
  <h3>💰 三档方案对比</h3>
  <div class="version-cards">
    <div class="version-card">
      <h4>经济版</h4>
      <div class="price">¥${versions.economy.amount.toLocaleString()}</div>
      <p>${versions.economy.perSqm}元/㎡</p>
      <p>${versions.economy.warranty}</p>
    </div>
    <div class="version-card recommended">
      <h4>⭐ 标准版（推荐）</h4>
      <div class="price">¥${versions.standard.amount.toLocaleString()}</div>
      <p>${versions.standard.perSqm}元/㎡</p>
      <p>${versions.standard.warranty}</p>
    </div>
    <div class="version-card">
      <h4>尊享版</h4>
      <div class="price">¥${versions.premium.amount.toLocaleString()}</div>
      <p>${versions.premium.perSqm}元/㎡</p>
      <p>${versions.premium.warranty}</p>
    </div>
  </div>
  
  <h3>📊 成本维度分析</h3>
  <table>
    <tr><th>费用项目</th><th>金额</th><th>占比</th></tr>
    ${Object.entries(dimensions || {}).filter(([k,v]) => v.amount).map(([k,v]) => `
    <tr><td>${v.name || k}</td><td>¥${v.amount.toLocaleString()}</td><td>${((v.amount/data.summary.totalAmount)*100).toFixed(1)}%</td></tr>
    `).join('')}
  </table>
  
  <h3>📋 详细清单</h3>
  <table>
    <tr><th>序号</th><th>类别</th><th>项目名称</th><th>规格</th><th>单位</th><th>数量</th><th>单价</th><th>金额</th></tr>
    ${data.details?.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.category}</td>
      <td>${item.name}</td>
      <td>${item.spec || '-'}</td>
      <td>${item.unit || '-'}</td>
      <td>${item.quantity || 1}</td>
      <td>¥${(item.unitPrice || item.amount).toLocaleString()}</td>
      <td>¥${item.amount.toLocaleString()}</td>
    </tr>
    `).join('') || ''}
  </table>
  
  <div class="total">
    方案总价: <span style="color: #C41230; font-size: 24px;">¥${data.summary?.discountedAmount?.toLocaleString() || 0}</span>
    <br><small>已享受优惠: ¥${data.summary?.savings?.toLocaleString() || 0}</small>
  </div>
  
  <div class="footer">
    <p>瑞美舒适家居 | 全国统一服务热线: 400-XXX-XXXX</p>
    <p>本报价有效期30天，最终价格以签约为准</p>
  </div>
</body>
</html>`;
  }

  /**
   * 2. 设计方案导出
   * 支持：BIM/施工图/效果图/清单
   */
  exportDesign(designData, format = 'full') {
    const { projectId, houseType, devices, pipes, systems, loadCalculation } = designData;
    
    console.log(`[ExportEngine] 导出设计方案 ${projectId}`);
    
    const exports = {};
    
    if (format === 'full' || format === 'bim') {
      exports.bim = this.exportToIFC(designData);
    }
    if (format === 'full' || format === 'cad') {
      exports.cad = this.exportToDXF(designData);
    }
    if (format === 'full' || format === 'pdf') {
      exports.constructionPDF = this.generateConstructionPDF(designData);
    }
    if (format === 'full' || format === 'materials') {
      exports.materialList = this.exportMaterialList(designData);
    }
    
    return {
      format: 'design-package',
      exports,
      downloadUrl: `/exports/${projectId}_设计方案包.zip`,
      contents: {
        bim: 'IFC 4.0格式，可导入Revit',
        cad: 'DXF格式，AutoCAD兼容',
        pdf: '施工图纸PDF',
        materials: '材料清单Excel'
      }
    };
  }

  exportToIFC(designData) {
    // 调用BIM导出引擎
    const BIMExportEngine = require('./BIMExportEngine');
    const bim = new BIMExportEngine();
    return bim.exportToIFC(designData);
  }

  exportToDXF(designData) {
    const BIMExportEngine = require('./BIMExportEngine');
    const bim = new BIMExportEngine();
    return bim.exportToDXF(designData);
  }

  generateConstructionPDF(designData) {
    // 生成施工图纸描述
    const { projectId, houseType, area, devices, pipes } = designData;
    
    return {
      format: 'PDF',
      filename: `${projectId}_施工图纸.pdf`,
      pages: [
        { name: '设计说明', desc: '项目概况、设计依据、系统说明' },
        { name: '设备布置图', desc: `${devices?.length || 0}台设备位置标注` },
        { name: '管路平面图', desc: `${pipes?.length || 0}条管路走向` },
        { name: '系统原理图', desc: '冷热源系统、水系统流程' },
        { name: '节点详图', desc: '安装大样、接口详图' }
      ],
      note: '施工图需由专业设计师审核签章',
      generateTime: new Date().toISOString()
    };
  }

  /**
   * 3. 问诊方案导出
   * 故障诊断报告
   */
  exportDiagnosis(diagnosisData, format = 'pdf') {
    const { symptoms, possibleCauses, checks, solutions, urgency } = diagnosisData;
    
    console.log(`[ExportEngine] 导出问诊方案`);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>瑞美暖通故障诊断报告</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; margin: 40px; }
    .header { background: #C41230; color: white; padding: 20px; text-align: center; }
    .urgency-${urgency} { background: ${urgency === 'high' ? '#f44336' : urgency === 'medium' ? '#ff9800' : '#4caf50'}; color: white; padding: 10px; text-align: center; }
    .section { margin: 30px 0; }
    .section h3 { color: #C41230; border-left: 4px solid #C41230; padding-left: 10px; }
    .cause-item { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .solution-item { background: #e8f5e9; padding: 15px; margin: 10px 0; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔧 瑞美暖通智能诊断报告</h1>
    <p>生成时间: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="urgency-${urgency}">
    紧急程度: ${urgency === 'high' ? '⚠️ 高 - 建议立即处理' : urgency === 'medium' ? '⚡ 中 - 建议24小时内处理' : '✓ 低 - 可计划维护'}
  </div>
  
  <div class="section">
    <h3>📝 症状描述</h3>
    <p>${symptoms}</p>
  </div>
  
  <div class="section">
    <h3>🔍 可能原因分析</h3>
    ${possibleCauses?.map((cause, i) => `
    <div class="cause-item">
      <strong>${i + 1}. ${cause.type}</strong>
      <p>原因: ${cause.reason}</p>
      <p>概率: ${cause.probability}%</p>
    </div>
    `).join('') || ''}
  </div>
  
  <div class="section">
    <h3>✅ 建议检查项目</h3>
    <table>
      <tr><th>序号</th><th>检查项目</th><th>方法</th><th>正常状态</th></tr>
      ${checks?.map((check, i) => `
      <tr><td>${i + 1}</td><td>${check.item}</td><td>${check.method}</td><td>${check.normal}</td></tr>
      `).join('') || ''}
    </table>
  </div>
  
  <div class="section">
    <h3>💡 解决方案</h3>
    ${solutions?.map((sol, i) => `
    <div class="solution-item">
      <strong>方案${i + 1}: ${sol.title}</strong>
      <p>${sol.description}</p>
      <p>💰 预估费用: ¥${sol.estimatedCost || '待定'}</p>
      <p>⏱️ 处理时间: ${sol.duration || '待定'}</p>
    </div>
    `).join('') || ''}
  </div>
  
  <div style="text-align: center; margin-top: 40px; color: #666;">
    <p>本报告由瑞美AI诊断系统生成，仅供参考</p>
    <p>复杂问题请联系专业技术人员上门检修</p>
    <p>服务热线: 400-XXX-XXXX</p>
  </div>
</body>
</html>`;
    
    return this.saveExport('diagnosis', `诊断报告_${Date.now()}`, 'html', html);
  }

  /**
   * 4. 锁客签约导出
   * 合同/意向书/收款计划
   */
  exportContract(contractData, format = 'pdf') {
    const { customer, project, quotation, terms, paymentPlan } = contractData;
    
    console.log(`[ExportEngine] 导出合同文档`);
    
    const documents = {
      // 意向书
      intentLetter: this.generateIntentLetter(contractData),
      // 正式合同
      formalContract: this.generateFormalContract(contractData),
      // 收款计划
      paymentSchedule: this.generatePaymentSchedule(paymentPlan),
      // 补充协议
      supplementary: this.generateSupplementaryTerms(terms)
    };
    
    return {
      format: 'contract-package',
      documents,
      downloadUrl: `/exports/${project.id}_合同文档包.zip`,
      note: '正式合同需法务审核后签署'
    };
  }

  generateIntentLetter(data) {
    return {
      type: '意向书',
      title: `瑞美舒适家居 - ${data.project.name} 服务意向书`,
      content: `
甲方(客户): ${data.customer.name}
乙方(服务商): 瑞美舒适家居有限公司

经双方友好协商，就${data.project.name}项目达成以下意向:

一、项目概况
项目名称: ${data.project.name}
项目地址: ${data.customer.address}
建筑面积: ${data.project.area}㎡
系统配置: ${data.project.systems?.join(', ') || '待确定'}

二、意向金额
预估总价: ¥${data.quotation?.estimatedAmount?.toLocaleString() || '待定'}
意向金: ¥${data.quotation?.deposit || 0} (签署正式合同时抵扣)

三、有效期
本意向书有效期至 ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}

四、双方签字
      `,
      validityDays: 30
    };
  }

  generateFormalContract(data) {
    return {
      type: '正式合同',
      title: '瑞美舒适家居系统安装服务合同',
      sections: [
        '第一条 项目概况',
        '第二条 系统配置清单',
        '第三条 合同价款及支付方式',
        '第四条 工期约定',
        '第五条 质量标准',
        '第六条 双方权利义务',
        '第七条 售后服务',
        '第八条 违约责任',
        '第九条 争议解决',
        '第十条 其他约定'
      ]
    };
  }

  generatePaymentSchedule(paymentPlan) {
    return {
      type: '收款计划',
      stages: paymentPlan?.stages || [
        { name: '签约付款', percentage: 30, amount: 0, trigger: '合同签订后3日内' },
        { name: '设备到场', percentage: 40, amount: 0, trigger: '主要设备进场验收' },
        { name: '安装完成', percentage: 25, amount: 0, trigger: '系统安装调试完成' },
        { name: '验收结算', percentage: 5, amount: 0, trigger: '竣工验收合格后' }
      ]
    };
  }

  /**
   * 5. 材料清单导出
   */
  exportMaterialList(designData, format = 'excel') {
    const { devices = [], pipes = [], fittings = [], accessories = [] } = designData;
    
    console.log(`[ExportEngine] 导出材料清单`);
    
    const allMaterials = [
      ...devices.map(d => ({ category: '设备', ...d })),
      ...pipes.map(p => ({ category: '管材', ...p })),
      ...fittings.map(f => ({ category: '管件', ...f })),
      ...accessories.map(a => ({ category: '辅料', ...a }))
    ];
    
    // 生成CSV
    let csv = '瑞美舒适家居 - 材料清单\n\n';
    csv += `项目编号,${designData.projectId}\n`;
    csv += `生成时间,${new Date().toLocaleString()}\n\n`;
    csv += '序号,类别,名称,品牌,型号,规格,单位,数量,单价,金额,备注\n';
    
    let totalAmount = 0;
    allMaterials.forEach((item, index) => {
      const amount = (item.price || 0) * (item.quantity || 1);
      totalAmount += amount;
      csv += `${index + 1},${item.category},${item.name},${item.brand || '瑞美'},${item.model || '-'},${item.spec || '-'},${item.unit || '个'},${item.quantity || 1},${item.price || 0},${amount},${item.notes || ''}\n`;
    });
    
    csv += `\n合计,,,,,,,,,${totalAmount},\n`;
    
    return this.saveExport('materials', `${designData.projectId}_材料清单`, 'csv', csv);
  }

  /**
   * 6. 施工图纸导出
   */
  exportConstructionDrawings(designData, format = 'pdf') {
    return this.generateConstructionPDF(designData);
  }

  /**
   * 7. 销售方案书导出
   */
  exportSalesProposal(proposalData, format = 'pptx') {
    const { project, solution, benefits, cases, quotation } = proposalData;
    
    console.log(`[ExportEngine] 导出销售方案书`);
    
    // 生成PPT大纲（可用pptxgenjs生成真正PPT）
    const pptStructure = {
      slides: [
        { type: 'title', content: `瑞美舒适家居\n${project.name}项目方案书` },
        { type: 'content', title: '项目概况', content: `建筑面积: ${project.area}㎡\n系统需求: ${project.requirements}\n预算范围: ${project.budget}` },
        { type: 'content', title: '方案设计', content: solution?.description || '待补充' },
        { type: 'list', title: '核心优势', items: benefits || ['节能', '舒适', '智能'] },
        { type: 'comparison', title: '方案对比', data: quotation?.versions },
        { type: 'cases', title: '成功案例', items: cases || [] },
        { type: 'quote', title: '投资报价', content: `推荐方案: ${quotation?.recommended?.name}\n总价: ¥${quotation?.recommended?.amount?.toLocaleString()}` },
        { type: 'contact', title: '联系我们', content: '瑞美舒适家居\n热线: 400-XXX-XXXX\n官网: www.rheem-home.com' }
      ]
    };
    
    return {
      format: 'PPT',
      structure: pptStructure,
      note: '使用pptxgenjs库生成真正PPT文件',
      htmlVersion: this.generateProposalHTML(proposalData)
    };
  }

  generateProposalHTML(data) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>瑞美方案书 - ${data.project?.name}</title>
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; }
    .slide { width: 100%; min-height: 600px; padding: 60px; box-sizing: border-box; page-break-after: always; }
    .slide-title { background: linear-gradient(135deg, #C41230 0%, #9A0E26 100%); color: white; text-align: center; }
    .slide-title h1 { font-size: 48px; margin: 0; }
    .slide-content { background: #f8f9fa; }
    .slide-content h2 { color: #C41230; font-size: 36px; }
    .benefit-card { display: inline-block; width: 200px; padding: 30px; background: white; margin: 15px; text-align: center; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .benefit-card .icon { font-size: 48px; }
    .price-highlight { font-size: 48px; color: #C41230; font-weight: bold; }
  </style>
</head>
<body>
  <div class="slide slide-title">
    <h1>瑞美舒适家居</h1>
    <p style="font-size: 24px;">${data.project?.name} 项目方案书</p>
    <p>${new Date().toLocaleDateString()}</p>
  </div>
  
  <div class="slide slide-content">
    <h2>🎯 项目概况</h2>
    <div style="font-size: 20px; line-height: 2;">
      <p><strong>建筑面积:</strong> ${data.project?.area}㎡</p>
      <p><strong>房屋类型:</strong> ${data.project?.houseType || '住宅'}</p>
      <p><strong>系统需求:</strong> ${data.project?.requirements || '中央空调+热水+新风'}</p>
    </div>
  </div>
  
  <div class="slide slide-content">
    <h2>✨ 核心优势</h2>
    <div style="text-align: center;">
      <div class="benefit-card">
        <div class="icon">❄️</div>
        <h3>精准温控</h3>
        <p>±0.5℃精准控温</p>
      </div>
      <div class="benefit-card">
        <div class="icon">💡</div>
        <h3>智能节能</h3>
        <p>较传统系统节能30%</p>
      </div>
      <div class="benefit-card">
        <div class="icon">🔇</div>
        <h3>静音舒适</h3>
        <p>低至22分贝静音运行</p>
      </div>
    </div>
  </div>
  
  <div class="slide slide-content">
    <h2>💰 投资方案</h2>
    <div style="text-align: center; padding: 40px;">
      <p>推荐方案</p>
      <div class="price-highlight">¥${data.quotation?.recommended?.amount?.toLocaleString() || '待报价'}</div>
      <p style="font-size: 20px;">包含: ${data.quotation?.recommended?.features?.join(' + ') || '全套暖通系统'}</p>
    </div>
  </div>
  
  <div class="slide slide-title">
    <h1>感谢信任</h1>
    <p style="font-size: 24px;">瑞美舒适家居 让家更温暖</p>
    <p>400-XXX-XXXX | www.rheem-home.com</p>
  </div>
</body>
</html>`;
  }

  /**
   * 8. 后台分析报表导出
   */
  exportAnalyticsReport(reportData, format = 'excel') {
    const { period, metrics, charts, insights } = reportData;
    
    console.log(`[ExportEngine] 导出分析报表 ${period}`);
    
    // 生成多sheet Excel报告
    const report = {
      sheets: {
        '概览': this.generateOverviewSheet(metrics),
        '业务数据': this.generateBusinessSheet(metrics),
        '财务数据': this.generateFinanceSheet(metrics),
        '客户分析': this.generateCustomerSheet(metrics),
        '趋势分析': this.generateTrendSheet(metrics)
      },
      charts: charts,
      insights: insights,
      generatedAt: new Date().toISOString()
    };
    
    return this.saveExport('analytics', `运营分析报表_${period}`, 'json', JSON.stringify(report, null, 2));
  }

  generateOverviewSheet(metrics) {
    return [
      ['指标', '本期数值', '环比', '同比', '目标', '完成率'],
      ['设计方案数', metrics?.designCount || 0, '+15%', '+32%', 200, '85%'],
      ['签约项目数', metrics?.contractCount || 0, '+8%', '+25%', 150, '92%'],
      ['合同金额', metrics?.contractAmount || 0, '+12%', '+40%', 5000000, '88%'],
      ['客户满意度', metrics?.satisfaction || 0, '+2%', '+5%', 95, '96%'],
      ['平均交付周期', metrics?.avgDeliveryDays || 0, '-3天', '-5天', 30, '优秀']
    ];
  }

  // 通用保存方法
  saveExport(type, filename, ext, content) {
    const fullPath = path.join(this.exportPath, `${filename}.${ext}`);
    fs.writeFileSync(fullPath, content);
    
    return {
      type,
      filename: `${filename}.${ext}`,
      filepath: fullPath,
      downloadUrl: `/exports/${filename}.${ext}`,
      size: content.length,
      generatedAt: new Date().toISOString()
    };
  }

  generateJSONExport(type, data) {
    return this.saveExport(type, `${type}_${Date.now()}`, 'json', JSON.stringify(data, null, 2));
  }
}

module.exports = ExportEngine;
