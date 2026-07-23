/**
 * 瑞美专业PPT导出引擎 - PPTExportEngine v2.0
 * 支持酷炫动画、专业模板、品牌定制
 */

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

class PPTExportEngine {
  constructor() {
    this.version = '2.0.0';
    this.exportPath = path.join(__dirname, '../../exports/ppt');
    this.templatesPath = path.join(__dirname, '../../templates/ppt');
    this.ensureDirectories();
    
    // 瑞美品牌色彩
    this.brandColors = {
      primary: 'C41230',      // 瑞美红
      secondary: '8B0D24',    // 深红
      accent: 'FFD700',       // 金色
      dark: '1A1A2E',         // 深蓝黑
      light: 'F5F5F5',        // 浅灰
      white: 'FFFFFF',
      text: '333333',
      gray: '666666'
    };
    
    // 动画效果库
    this.animations = {
      fadeIn: { type: 'fade', speed: 'fast' },
      slideIn: { type: 'slide', direction: 'fromRight', speed: 'medium' },
      zoomIn: { type: 'zoom', speed: 'medium' },
      flyIn: { type: 'fly', direction: 'fromBottom', speed: 'fast' },
      pulse: { type: 'pulse', speed: 'slow' }
    };
  }

  ensureDirectories() {
    [this.exportPath, this.templatesPath].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 导出专业方案PPT
   * @param {Object} solutionData - 方案数据
   * @param {Object} options - 导出选项
   * @returns {Promise<Object>} 导出结果
   */
  async exportSolutionPPT(solutionData, options = {}) {
    const {
      projectName = '瑞美舒适家居方案',
      customerName = '尊贵的客户',
      houseInfo = {},
      selectedPainPoints = [],
      recommendedSolutions = [],
      sixSystems = [],
      quotation = {},
      timestamp = new Date().toISOString()
    } = solutionData;

    console.log(`[PPTExportEngine] 开始生成专业PPT: ${projectName}`);

    // 创建PPT实例
    const pptx = new PptxGenJS();
    
    // 设置PPT元数据
    pptx.author = '瑞美舒适家居';
    pptx.company = 'Rheem China';
    pptx.subject = `${projectName} - 智能暖通解决方案`;
    pptx.title = projectName;
    pptx.revision = '1';

    // 设置默认布局
    pptx.layout = 'LAYOUT_16x9';

    // 定义母版
    this.defineMasterSlide(pptx);

    // 生成各页幻灯片
    await this.generateCoverSlide(pptx, { projectName, customerName, timestamp });
    await this.generateCompanyIntroSlide(pptx);
    await this.generateProjectOverviewSlide(pptx, { houseInfo, customerName });
    await this.generatePainPointsSlide(pptx, { selectedPainPoints });
    await this.generateSixSystemsSlide(pptx, { sixSystems });
    await this.generateSolutionsSlide(pptx, { recommendedSolutions });
    await this.generateQuotationSlide(pptx, { quotation });
    await this.generateBenefitsSlide(pptx);
    await this.generateCasesSlide(pptx);
    await this.generateServiceSlide(pptx);
    await this.generateContactSlide(pptx, { customerName });

    // 保存文件
    const fileName = `瑞美方案_${customerName}_${new Date().toISOString().split('T')[0]}.pptx`;
    const filePath = path.join(this.exportPath, fileName);
    
    await pptx.writeFile({ fileName: filePath });

    console.log(`[PPTExportEngine] PPT生成完成: ${filePath}`);

    return {
      success: true,
      fileName,
      filePath,
      downloadUrl: `/exports/ppt/${fileName}`,
      slides: 11,
      fileSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 定义母版幻灯片
   */
  defineMasterSlide(pptx) {
    pptx.defineSlideMaster({
      title: 'RheemMaster',
      background: { color: this.brandColors.white },
      objects: [
        // 页脚Logo
        {
          rect: { x: 0.5, y: 7.2, w: 1.5, h: 0.4 },
          fill: { color: this.brandColors.white },
          text: {
            text: '瑞美舒适家居',
            options: {
              fontSize: 10,
              color: this.brandColors.gray,
              fontFace: 'Microsoft YaHei'
            }
          }
        },
        // 装饰线条
        {
          line: {
            x: 0.5, y: 7.1, w: 9, h: 0,
            line: { color: this.brandColors.primary, width: 1 }
          }
        }
      ]
    });
  }

  /**
   * 封面页 - 酷炫动画效果
   */
  async generateCoverSlide(pptx, { projectName, customerName, timestamp }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    // 背景渐变
    slide.background = {
      color: this.brandColors.dark,
      gradient: {
        type: 'linear',
        angle: 45,
        stops: [
          { color: this.brandColors.dark, position: 0 },
          { color: this.brandColors.primary, position: 100 }
        ]
      }
    };

    // 主标题 - 大字报效果
    slide.addText('瑞美舒适家居', {
      x: 0.5, y: 2, w: 9, h: 1,
      fontSize: 54,
      bold: true,
      color: this.brandColors.white,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.zoomIn
    });

    // 副标题
    slide.addText('RHEEM SMART HOME SYSTEM', {
      x: 0.5, y: 3, w: 9, h: 0.5,
      fontSize: 20,
      color: this.brandColors.accent,
      fontFace: 'Arial',
      align: 'center',
      letterSpacing: 8,
      animation: this.animations.fadeIn
    });

    // 项目标题
    slide.addText(projectName, {
      x: 1, y: 4, w: 8, h: 1,
      fontSize: 36,
      bold: true,
      color: this.brandColors.white,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.slideIn
    });

    // 客户名称
    slide.addText(`专为 ${customerName} 定制`, {
      x: 1, y: 5.2, w: 8, h: 0.6,
      fontSize: 18,
      color: this.brandColors.light,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.fadeIn
    });

    // 日期
    slide.addText(new Date(timestamp).toLocaleDateString('zh-CN'), {
      x: 1, y: 6, w: 8, h: 0.4,
      fontSize: 14,
      color: this.brandColors.gray,
      align: 'center'
    });

    // 装饰元素 - 六边形
    this.addHexagonShape(slide, 0.3, 6.5, 0.8, this.brandColors.primary);
    this.addHexagonShape(slide, 9.2, 1, 0.5, this.brandColors.accent);
  }

  /**
   * 公司简介页
   */
  async generateCompanyIntroSlide(pptx) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    // 标题
    slide.addText('关于瑞美', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      animation: this.animations.slideIn
    });

    // 公司介绍
    const introText = [
      { text: '百年瑞美，始于1925', options: { bold: true, fontSize: 20, color: this.brandColors.dark } },
      { text: '\n\n', options: { fontSize: 12 } },
      { text: '• 全球领先的暖通设备制造商', options: { fontSize: 16, color: this.brandColors.text } },
      { text: '\n• 服务100+国家和地区', options: { fontSize: 16, color: this.brandColors.text } },
      { text: '\n• 年营业额超过$10亿', options: { fontSize: 16, color: this.brandColors.text } },
      { text: '\n• 持有1000+项专利技术', options: { fontSize: 16, color: this.brandColors.text } }
    ];

    slide.addText(introText, {
      x: 0.5, y: 1.5, w: 4.5, h: 4,
      animation: this.animations.fadeIn
    });

    // 右侧数据展示
    const stats = [
      { value: '100+', label: '服务国家' },
      { value: '1000+', label: '专利技术' },
      { value: '98%', label: '客户满意度' },
      { value: '10年', label: '质保承诺' }
    ];

    stats.forEach((stat, index) => {
      const y = 1.5 + index * 1.2;
      
      // 数值
      slide.addText(stat.value, {
        x: 5.5, y, w: 2, h: 0.8,
        fontSize: 36,
        bold: true,
        color: this.brandColors.primary,
        align: 'center',
        animation: this.animations.zoomIn
      });

      // 标签
      slide.addText(stat.label, {
        x: 7.5, y: y + 0.2, w: 2, h: 0.5,
        fontSize: 14,
        color: this.brandColors.gray,
        align: 'left'
      });
    });
  }

  /**
   * 项目概况页
   */
  async generateProjectOverviewSlide(pptx, { houseInfo, customerName }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('项目概况', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      animation: this.animations.slideIn
    });

    // 客户信息卡片
    const infoItems = [
      { icon: '👤', label: '客户名称', value: customerName },
      { icon: '🏠', label: '房屋类型', value: houseInfo.propertyType || '住宅' },
      { icon: '📐', label: '建筑面积', value: `${houseInfo.area || 120}㎡` },
      { icon: '🏢', label: '楼层结构', value: `${houseInfo.floors || 2}层${houseInfo.basement && houseInfo.basement !== '无' ? `+${houseInfo.basement}` : ''}` },
      { icon: '🚿', label: '卫生间', value: `${houseInfo.bathrooms || 2}个` },
      { icon: '👨‍👩‍👧‍👦', label: '居住人数', value: `${houseInfo.occupants || 4}人` }
    ];

    infoItems.forEach((item, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.5 + col * 3.2;
      const y = 1.5 + row * 2.5;

      // 卡片背景
      slide.addShape('rect', {
        x, y, w: 3, h: 2,
        fill: { color: this.brandColors.light },
        line: { color: this.brandColors.primary, width: 2 },
        rectRadius: 0.1
      });

      // 图标
      slide.addText(item.icon, {
        x, y: y + 0.2, w: 3, h: 0.6,
        fontSize: 28,
        align: 'center'
      });

      // 标签
      slide.addText(item.label, {
        x, y: y + 0.9, w: 3, h: 0.4,
        fontSize: 12,
        color: this.brandColors.gray,
        align: 'center'
      });

      // 值
      slide.addText(item.value, {
        x, y: y + 1.3, w: 3, h: 0.5,
        fontSize: 18,
        bold: true,
        color: this.brandColors.dark,
        align: 'center',
        animation: this.animations.fadeIn
      });
    });
  }

  /**
   * 痛点诊断页
   */
  async generatePainPointsSlide(pptx, { selectedPainPoints }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('痛点诊断分析', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      animation: this.animations.slideIn
    });

    // AI诊断标签
    slide.addShape('rect', {
      x: 7.5, y: 0.5, w: 2, h: 0.5,
      fill: { color: this.brandColors.accent },
      rectRadius: 0.1
    });

    slide.addText('🤖 AI智能诊断', {
      x: 7.5, y: 0.55, w: 2, h: 0.4,
      fontSize: 12,
      bold: true,
      color: this.brandColors.dark,
      align: 'center'
    });

    // 痛点列表
    const painPoints = selectedPainPoints.length > 0 ? selectedPainPoints : [
      { name: '楼层温差大', severity: 'high' },
      { name: '热水等待久', severity: 'high' },
      { name: '地下室潮湿', severity: 'medium' }
    ];

    const severityColors = {
      high: this.brandColors.primary,
      medium: 'FFA500',
      low: '4CAF50'
    };

    painPoints.forEach((point, index) => {
      const y = 1.5 + index * 1.5;

      // 左侧边框
      slide.addShape('rect', {
        x: 0.5, y, w: 0.1, h: 1,
        fill: { color: severityColors[point.severity || 'medium'] }
      });

      // 痛点名称
      slide.addText(`${index + 1}. ${point.name || point}`, {
        x: 0.8, y: y + 0.3, w: 8, h: 0.6,
        fontSize: 20,
        bold: true,
        color: this.brandColors.dark,
        animation: this.animations.slideIn
      });

      // 严重程度标签
      const severityText = point.severity === 'high' ? '严重' : point.severity === 'medium' ? '中等' : '轻微';
      slide.addShape('roundRect', {
        x: 8, y: y + 0.25, w: 1, h: 0.4,
        fill: { color: severityColors[point.severity || 'medium'] },
        rectRadius: 0.2
      });

      slide.addText(severityText, {
        x: 8, y: y + 0.3, w: 1, h: 0.3,
        fontSize: 11,
        color: this.brandColors.white,
        align: 'center'
      });
    });

    // 底部说明
    slide.addText('基于48项专业痛点评估，为您推荐最佳解决方案', {
      x: 0.5, y: 6.5, w: 9, h: 0.5,
      fontSize: 14,
      color: this.brandColors.gray,
      align: 'center',
      italic: true
    });
  }

  /**
   * 六大系统页
   */
  async generateSixSystemsSlide(pptx, { sixSystems }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('瑞美六大舒适系统', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.slideIn
    });

    // 系统数据
    const systems = sixSystems.length > 0 ? sixSystems : [
      { name: '五恒恒温系统', icon: '🌡️', desc: '恒温·恒湿·恒氧·恒洁·恒静', color: 'FF6B6B' },
      { name: '中央热水系统', icon: '🚿', desc: '即开即热·全屋零等待', color: '4ECDC4' },
      { name: '采暖系统', icon: '🔥', desc: '地暖/暖气片·冬季温暖', color: 'FF9F43' },
      { name: '空调系统', icon: '❄️', desc: '中央空调·夏季清凉', color: '54A0FF' },
      { name: '新风系统', icon: '🌬️', desc: '24h新风·除霾降醛', color: '5F27CD' },
      { name: '净水系统', icon: '💧', desc: '全屋净化·健康用水', color: '00D2D3' }
    ];

    // 2x3网格布局
    systems.forEach((sys, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.5 + col * 3.2;
      const y = 1.5 + row * 2.8;

      // 卡片背景
      slide.addShape('roundRect', {
        x, y, w: 3, h: 2.5,
        fill: { color: `F0F0F0` },
        line: { color: sys.color, width: 3 },
        rectRadius: 0.2
      });

      // 图标
      slide.addText(sys.icon, {
        x, y: y + 0.3, w: 3, h: 0.8,
        fontSize: 36,
        align: 'center',
        animation: this.animations.zoomIn
      });

      // 系统名称
      slide.addText(sys.name, {
        x, y: y + 1.2, w: 3, h: 0.5,
        fontSize: 14,
        bold: true,
        color: this.brandColors.dark,
        align: 'center'
      });

      // 描述
      slide.addText(sys.desc, {
        x, y: y + 1.7, w: 3, h: 0.6,
        fontSize: 10,
        color: this.brandColors.gray,
        align: 'center'
      });
    });
  }

  /**
   * 推荐方案页
   */
  async generateSolutionsSlide(pptx, { recommendedSolutions }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('为您推荐3种方案', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      animation: this.animations.slideIn
    });

    // 方案数据
    const solutions = recommendedSolutions.length > 0 ? recommendedSolutions : [
      {
        name: '实用舒适方案',
        badge: '💰 性价比之选',
        systems: ['热水', '采暖', '新风', '净水'],
        price: '¥45,000',
        matchScore: 87
      },
      {
        name: '全屋舒适总包方案',
        badge: '💎 推荐方案',
        systems: ['五恒', '热水', '采暖', '空调', '新风', '净水'],
        price: '¥83,500',
        matchScore: 97
      },
      {
        name: '豪华尊享方案',
        badge: '👑 顶级配置',
        systems: ['五恒', '热水', '采暖', '空调', '新风', '净水'],
        price: '¥168,000',
        matchScore: 99
      }
    ];

    const badgeColors = {
      '💰 性价比之选': '4ECDC4',
      '💎 推荐方案': 'C41230',
      '👑 顶级配置': 'FFD700'
    };

    solutions.forEach((sol, index) => {
      const x = 0.5 + index * 3.2;

      // 推荐卡片高亮
      if (sol.badge.includes('推荐')) {
        slide.addShape('rect', {
          x: x - 0.1, y: 1.3, w: 3.2, h: 5.4,
          fill: { color: 'FFF5F5' },
          line: { color: this.brandColors.primary, width: 3 },
          rectRadius: 0.2
        });
      }

      // 卡片
      slide.addShape('roundRect', {
        x, y: 1.5, w: 3, h: 5,
        fill: { color: this.brandColors.white },
        line: { color: 'E0E0E0', width: 1 },
        rectRadius: 0.2
      });

      // 徽章
      const badgeColor = badgeColors[sol.badge] || this.brandColors.gray;
      slide.addShape('roundRect', {
        x: x + 0.5, y: 1.7, w: 2, h: 0.5,
        fill: { color: badgeColor },
        rectRadius: 0.25
      });

      slide.addText(sol.badge, {
        x: x + 0.5, y: 1.75, w: 2, h: 0.4,
        fontSize: 12,
        bold: true,
        color: sol.badge.includes('顶级') ? this.brandColors.dark : this.brandColors.white,
        align: 'center'
      });

      // 方案名称
      slide.addText(sol.name, {
        x, y: 2.4, w: 3, h: 0.8,
        fontSize: 16,
        bold: true,
        color: this.brandColors.dark,
        align: 'center',
        animation: this.animations.fadeIn
      });

      // 匹配度
      slide.addText(`匹配度 ${sol.matchScore}%`, {
        x, y: 3.3, w: 3, h: 0.4,
        fontSize: 14,
        color: this.brandColors.primary,
        align: 'center'
      });

      // 价格
      slide.addText(sol.price, {
        x, y: 3.8, w: 3, h: 0.8,
        fontSize: 28,
        bold: true,
        color: this.brandColors.primary,
        align: 'center',
        animation: this.animations.zoomIn
      });

      // 包含系统
      slide.addText('包含系统:', {
        x, y: 4.7, w: 3, h: 0.3,
        fontSize: 10,
        color: this.brandColors.gray,
        align: 'center'
      });

      slide.addText(sol.systems.join(' | '), {
        x, y: 5, w: 3, h: 0.5,
        fontSize: 11,
        color: this.brandColors.dark,
        align: 'center'
      });

      // 选择按钮
      if (sol.badge.includes('推荐')) {
        slide.addShape('roundRect', {
          x: x + 0.8, y: 5.8, w: 1.4, h: 0.5,
          fill: { color: this.brandColors.primary },
          rectRadius: 0.25
        });

        slide.addText('选择此方案', {
          x: x + 0.8, y: 5.85, w: 1.4, h: 0.4,
          fontSize: 12,
          bold: true,
          color: this.brandColors.white,
          align: 'center'
        });
      }
    });
  }

  /**
   * 报价详情页
   */
  async generateQuotationSlide(pptx, { quotation }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('投资报价方案', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      animation: this.animations.slideIn
    });

    // 六系统报价表
    const tableData = [
      [
        { text: '系统', options: { bold: true, fill: this.brandColors.dark, color: this.brandColors.white } },
        { text: '系统名称', options: { bold: true, fill: this.brandColors.dark, color: this.brandColors.white } },
        { text: '功能描述', options: { bold: true, fill: this.brandColors.dark, color: this.brandColors.white } },
        { text: '经济版', options: { bold: true, fill: this.brandColors.dark, color: this.brandColors.white } },
        { text: '标准版', options: { bold: true, fill: this.brandColors.dark, color: this.brandColors.white } },
        { text: '尊享版', options: { bold: true, fill: this.brandColors.dark, color: this.brandColors.white } }
      ],
      ['🌡️', '五恒恒温系统', '恒温恒湿恒氧恒洁恒静', '-', '¥35,000', '¥55,000'],
      ['🚿', '中央热水系统', '即开即热全屋零等待', '¥12,000', '¥15,000', '¥25,000'],
      ['🔥', '采暖系统', '地暖/暖气片冬季温暖', '¥18,000', '¥20,000', '¥35,000'],
      ['❄️', '空调系统', '中央空调夏季清凉', '-', '¥25,000', '¥40,000'],
      ['🌬️', '新风系统', '24h新风除霾降醛', '¥12,000', '¥15,000', '¥25,000'],
      ['💧', '净水系统', '全屋净化健康用水', '¥10,000', '¥12,000', '¥20,000'],
      [
        { text: '💰 方案总价', options: { bold: true, fill: 'FFF5F5', color: this.brandColors.primary } },
        { text: '', options: { fill: 'FFF5F5' } },
        { text: '', options: { fill: 'FFF5F5' } },
        { text: '¥45,000', options: { bold: true, fill: 'FFF5F5', color: this.brandColors.primary } },
        { text: '¥83,500', options: { bold: true, fill: 'FFF5F5', color: this.brandColors.primary } },
        { text: '¥168,000', options: { bold: true, fill: 'FFF5F5', color: this.brandColors.primary } }
      ]
    ];

    slide.addTable(tableData, {
      x: 0.5, y: 1.5, w: 9, h: 4.5,
      colW: [0.8, 2.2, 2.5, 1.2, 1.2, 1.2],
      fontSize: 11,
      border: { color: 'E0E0E0', pt: 1 },
      align: 'center',
      valign: 'middle'
    });

    // 底部说明
    slide.addText('• 以上报价为参考价格，实际价格根据户型面积、具体配置而定', {
      x: 0.5, y: 6.3, w: 9, h: 0.3,
      fontSize: 10,
      color: this.brandColors.gray
    });

    slide.addText('• 所有方案均包含设计费、安装费、调试费 | 支持分期付款', {
      x: 0.5, y: 6.6, w: 9, h: 0.3,
      fontSize: 10,
      color: this.brandColors.gray
    });
  }

  /**
   * 核心优势页
   */
  async generateBenefitsSlide(pptx) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('为什么选择瑞美？', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.slideIn
    });

    const benefits = [
      { icon: '🎯', title: '精准诊断', desc: '48项AI痛点诊断\n精准匹配最佳方案' },
      { icon: '🔧', title: '专业安装', desc: '认证工程师团队\n标准化施工流程' },
      { icon: '⚡', title: '智能控制', desc: 'Econet智能平台\n全屋一键掌控' },
      { icon: '💰', title: '投资回报', desc: '节能30%以上\n3年收回投资' },
      { icon: '🛡️', title: '品质保障', desc: '10年质保承诺\n终身售后服务' },
      { icon: '📱', title: '便捷服务', desc: 'APP在线预约\n2小时响应' }
    ];

    benefits.forEach((benefit, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 0.5 + col * 3.2;
      const y = 1.5 + row * 3;

      // 圆形背景
      slide.addShape('ellipse', {
        x: x + 1, y, w: 1, h: 1,
        fill: { color: this.brandColors.light }
      });

      // 图标
      slide.addText(benefit.icon, {
        x: x + 1, y: y + 0.25, w: 1, h: 0.5,
        fontSize: 32,
        align: 'center',
        animation: this.animations.zoomIn
      });

      // 标题
      slide.addText(benefit.title, {
        x, y: y + 1.2, w: 3, h: 0.5,
        fontSize: 18,
        bold: true,
        color: this.brandColors.dark,
        align: 'center'
      });

      // 描述
      slide.addText(benefit.desc, {
        x, y: y + 1.8, w: 3, h: 1,
        fontSize: 12,
        color: this.brandColors.gray,
        align: 'center'
      });
    });
  }

  /**
   * 成功案例页
   */
  async generateCasesSlide(pptx) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('成功案例', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      animation: this.animations.slideIn
    });

    const cases = [
      { name: '浦东 Villa 别墅', area: '350㎡', systems: '全套六系统', rating: '⭐⭐⭐⭐⭐' },
      { name: '静安大平层', area: '280㎡', systems: '五恒+热水+新风', rating: '⭐⭐⭐⭐⭐' },
      { name: '虹桥联排', area: '220㎡', systems: '四系统组合', rating: '⭐⭐⭐⭐⭐' },
      { name: '徐汇公寓', area: '180㎡', systems: '热水+新风+净水', rating: '⭐⭐⭐⭐⭐' }
    ];

    cases.forEach((caseItem, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 0.5 + col * 4.7;
      const y = 1.5 + row * 2.5;

      // 卡片
      slide.addShape('roundRect', {
        x, y, w: 4.5, h: 2.2,
        fill: { color: this.brandColors.light },
        rectRadius: 0.2
      });

      // 项目名称
      slide.addText(caseItem.name, {
        x: x + 0.3, y: y + 0.3, w: 4, h: 0.5,
        fontSize: 18,
        bold: true,
        color: this.brandColors.dark
      });

      // 面积
      slide.addText(`📐 ${caseItem.area}`, {
        x: x + 0.3, y: y + 0.9, w: 2, h: 0.4,
        fontSize: 12,
        color: this.brandColors.gray
      });

      // 系统
      slide.addText(caseItem.systems, {
        x: x + 0.3, y: y + 1.3, w: 4, h: 0.4,
        fontSize: 11,
        color: this.brandColors.gray
      });

      // 评分
      slide.addText(caseItem.rating, {
        x: x + 3, y: y + 0.3, w: 1.2, h: 0.4,
        fontSize: 14,
        color: this.brandColors.accent,
        align: 'right'
      });
    });

    // 统计数据
    slide.addText('已服务 10,000+ 家庭 | 客户满意度 98% | 平均节能 35%', {
      x: 0.5, y: 6.5, w: 9, h: 0.5,
      fontSize: 14,
      color: this.brandColors.primary,
      align: 'center',
      bold: true
    });
  }

  /**
   * 服务流程页
   */
  async generateServiceSlide(pptx) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    slide.addText('服务流程', {
      x: 0.5, y: 0.5, w: 9, h: 0.8,
      fontSize: 36,
      bold: true,
      color: this.brandColors.primary,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.slideIn
    });

    const steps = [
      { num: '01', title: '在线咨询', desc: 'AI智能问诊\n48项痛点评估' },
      { num: '02', title: '方案设计', desc: '3套定制方案\n专业设计师对接' },
      { num: '03', title: '上门测量', desc: '免费上门勘测\n精准数据采集' },
      { num: '04', title: '合同签订', desc: '透明报价体系\n无增项承诺' },
      { num: '05', title: '施工安装', desc: '标准化施工\n工期保障' },
      { num: '06', title: '验收交付', desc: '多轮验收检测\n10年质保' }
    ];

    steps.forEach((step, index) => {
      const x = 0.5 + index * 1.55;
      const y = 2;

      // 步骤编号圆
      slide.addShape('ellipse', {
        x: x + 0.4, y, w: 0.8, h: 0.8,
        fill: { color: this.brandColors.primary }
      });

      slide.addText(step.num, {
        x: x + 0.4, y: y + 0.2, w: 0.8, h: 0.4,
        fontSize: 14,
        bold: true,
        color: this.brandColors.white,
        align: 'center'
      });

      // 连接线
      if (index < steps.length - 1) {
        slide.addShape('line', {
          x: x + 1.2, y: y + 0.4, w: 0.7, h: 0,
          line: { color: this.brandColors.primary, width: 2, dashType: 'dash' }
        });
      }

      // 标题
      slide.addText(step.title, {
        x, y: y + 1, w: 1.5, h: 0.4,
        fontSize: 12,
        bold: true,
        color: this.brandColors.dark,
        align: 'center'
      });

      // 描述
      slide.addText(step.desc, {
        x, y: y + 1.5, w: 1.5, h: 0.8,
        fontSize: 9,
        color: this.brandColors.gray,
        align: 'center'
      });
    });

    // 底部承诺
    slide.addShape('roundRect', {
      x: 1, y: 5.5, w: 8, h: 1.2,
      fill: { color: this.brandColors.light },
      rectRadius: 0.1
    });

    slide.addText('⏱️ 快速响应：2小时内回电  |  📐 免费测量：专业工程师上门  |  🛡️ 品质保障：10年超长质保', {
      x: 1, y: 5.8, w: 8, h: 0.6,
      fontSize: 14,
      color: this.brandColors.dark,
      align: 'center'
    });
  }

  /**
   * 联系我们页
   */
  async generateContactSlide(pptx, { customerName }) {
    const slide = pptx.addSlide({ masterName: 'RheemMaster' });

    // 背景渐变
    slide.background = {
      color: this.brandColors.dark,
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: this.brandColors.dark, position: 0 },
          { color: this.brandColors.secondary, position: 100 }
        ]
      }
    };

    // 感谢语
    slide.addText('感谢您的信任', {
      x: 0.5, y: 1.5, w: 9, h: 1,
      fontSize: 48,
      bold: true,
      color: this.brandColors.white,
      fontFace: 'Microsoft YaHei',
      align: 'center',
      animation: this.animations.zoomIn
    });

    // 副标题
    slide.addText(`期待为 ${customerName} 打造舒适家居`, {
      x: 0.5, y: 2.8, w: 9, h: 0.6,
      fontSize: 24,
      color: this.brandColors.accent,
      align: 'center'
    });

    // 联系方式
    const contacts = [
      { icon: '📞', label: '服务热线', value: '400-XXX-XXXX' },
      { icon: '🌐', label: '官方网站', value: 'www.rheem-home.com' },
      { icon: '💬', label: '微信咨询', value: 'RheemHome' },
      { icon: '📧', label: '电子邮箱', value: 'service@rheem.com' }
    ];

    contacts.forEach((contact, index) => {
      const y = 4 + index * 0.8;

      slide.addText(`${contact.icon} ${contact.label}: ${contact.value}`, {
        x: 0.5, y, w: 9, h: 0.6,
        fontSize: 16,
        color: this.brandColors.white,
        align: 'center'
      });
    });

    // Slogan
    slide.addText('瑞美舒适家居 · 让家更温暖', {
      x: 0.5, y: 6.5, w: 9, h: 0.5,
      fontSize: 18,
      color: this.brandColors.accent,
      align: 'center',
      italic: true
    });

    // 装饰
    this.addHexagonShape(slide, 0.3, 1, 0.6, this.brandColors.accent);
    this.addHexagonShape(slide, 9, 6, 0.8, this.brandColors.primary);
  }

  /**
   * 添加六边形装饰
   */
  addHexagonShape(slide, x, y, size, color) {
    // 简化：使用圆形代替六边形
    slide.addShape('ellipse', {
      x, y, w: size, h: size,
      fill: { color, transparency: 50 }
    });
  }

  /**
   * 获取导出文件列表
   */
  getExportedFiles() {
    if (!fs.existsSync(this.exportPath)) return [];
    
    return fs.readdirSync(this.exportPath)
      .filter(file => file.endsWith('.pptx'))
      .map(file => {
        const stat = fs.statSync(path.join(this.exportPath, file));
        return {
          fileName: file,
          fileSize: stat.size,
          createdAt: stat.birthtime,
          downloadUrl: `/exports/ppt/${file}`
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = PPTExportEngine;
