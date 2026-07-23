/**
 * 三张核心原理图可视化引擎 (M5) - CorePrincipleVisuals
 * 痛点拆解原理图 / 方案映射原理图 / 全流程演示图
 */

class CorePrincipleVisuals {
  constructor() {
    this.canvasSize = { width: 1920, height: 1080 }; // 投屏适配尺寸
    this.colors = {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#f093fb',
      text: '#2d3748',
      bg: '#f7fafc',
      pain: '#fc8181',
      solution: '#68d391',
      product: '#63b3ed'
    };
  }

  /**
   * 生成图1: 业主深层痛点拆解原理图
   * 布局: 左场景图 → 中标签拆解 → 右算法匹配
   */
  generatePainPointAnalysisDiagram(diagnosis, roomProfile) {
    return {
      id: 'diagram_001',
      name: '业主深层痛点拆解原理图',
      type: 'pain_analysis',
      layout: 'three_column',
      columns: {
        left: {
          title: '居住场景',
          width: '30%',
          content: {
            roomImage: this.generateRoomScene(roomProfile),
            keyFeatures: roomProfile.keyFeatures || ['西晒户型', '3室2厅', '有老人'],
            highlightAreas: this.identifyPainAreas(diagnosis)
          }
        },
        center: {
          title: '痛点拆解',
          width: '40%',
          content: {
            painTags: diagnosis.allTags.map(tag => ({
              id: tag.id,
              name: tag.name,
              category: tag.category,
              icon: this.getPainIcon(tag.category),
              color: this.getPainColor(tag.category),
              severity: tag.severity || 'medium'
            })),
            categorySummary: this.summarizeByCategory(diagnosis.allTags),
            aiRecognized: diagnosis.aiSuggestedTags.length
          }
        },
        right: {
          title: '智能匹配',
          width: '30%',
          content: {
            algorithmFlow: [
              { step: 1, name: '户型解析', status: 'complete' },
              { step: 2, name: '痛点识别', status: 'complete' },
              { step: 3, name: '方案匹配', status: 'complete' }
            ],
            matchingScore: Math.round(diagnosis.recommendationPriority.length * 20),
            recommendationCount: diagnosis.recommendationPriority.length
          }
        }
      },
      bottomBanner: {
        slogan: '「对症开药」一户一方案，拒绝千篇一律',
        subSlogan: 'AI智能识别居住痛点，精准匹配舒适解决方案'
      },
      presentationMode: {
        hideUI: true,
        fullScreen: true,
        animation: 'fade_in_sequence' // 痛点逐个显示动画
      }
    };
  }

  /**
   * 生成图2: 痛点—方案—产品映射原理图
   * 布局: 三栏并排（痛点池→系统处方→产品落地）
   */
  generateSolutionMappingDiagram(matchResult, diagnosis) {
    const systems = matchResult.recommendedSystems;
    const packages = matchResult.productPackages;

    return {
      id: 'diagram_002',
      name: '痛点—方案—产品映射原理图',
      type: 'solution_mapping',
      layout: 'three_column_flow',
      columns: {
        painPool: {
          title: '痛点池',
          subtitle: `${diagnosis.allTags.length}个居住痛点`,
          items: diagnosis.allTags.map((tag, index) => ({
            id: tag.id,
            text: tag.name,
            category: tag.category,
            icon: this.getPainIcon(tag.category),
            position: { row: index % 3, col: Math.floor(index / 3) }
          })),
          visualStyle: 'tag_cloud'
        },
        prescription: {
          title: '系统处方',
          subtitle: `${systems.length}大系统联动`,
          items: systems.map((sys, index) => ({
            id: `sys_${index}`,
            name: sys.name,
            icon: this.getSystemIcon(sys.name),
            confidence: Math.round(sys.confidence * 100),
            forceRecommend: sys.forceRecommend,
            keyBenefit: sys.explanation,
            color: sys.forceRecommend ? this.colors.primary : this.colors.secondary,
            position: { row: index, col: 0 }
          })),
          visualStyle: 'prescription_cards',
          connections: this.generatePainToSystemConnections(diagnosis.allTags, systems)
        },
        products: {
          title: '产品落地',
          subtitle: '瑞美/恒热全系产品',
          items: packages.flatMap((pkg, pkgIndex) => 
            pkg.products.map((prod, prodIndex) => ({
              id: `prod_${pkgIndex}_${prodIndex}`,
              name: prod.model || prod,
              brand: prod.brand || '瑞美',
              system: pkg.system,
              price: prod.price || '询价',
              position: { row: pkgIndex * 2 + prodIndex, col: 0 }
            }))
          ),
          visualStyle: 'product_grid'
        }
      },
      centerSlogan: {
        text: '「对症开药」一户一方案，杜绝人工拼单',
        position: 'center_vertical',
        style: 'highlight_banner'
      },
      flowArrows: {
        leftToCenter: { label: 'AI匹配算法', style: 'dashed_arrow' },
        centerToRight: { label: '产品配置', style: 'solid_arrow' }
      },
      presentationMode: {
        hideUI: true,
        fullScreen: true,
        animation: 'flow_reveal' // 流动揭示动画
      }
    };
  }

  /**
   * 生成图3: 全流程问诊→出方案→演示交付图
   * 布局: 四步递进（问诊→推荐→3D效果→报价）
   */
  generateFullProcessDiagram(session, matchResult) {
    return {
      id: 'diagram_003',
      name: '全流程问诊→出方案→演示交付图',
      type: 'process_flow',
      layout: 'four_step_timeline',
      steps: [
        {
          step: 1,
          name: '痛点问诊',
          icon: '📝',
          duration: '3分钟',
          description: '5大维度痛点快速勾选',
          details: [
            '户型档案录入',
            '居住痛点诊断',
            'AI隐性痛点识别'
          ],
          visual: 'checklist_completed',
          status: 'completed'
        },
        {
          step: 2,
          name: '方案推荐',
          icon: '🎯',
          duration: '2分钟',
          description: 'AI匹配最优系统组合',
          details: [
            'Tag匹配算法',
            '强制推荐规则',
            '方案弹窗展示'
          ],
          visual: 'system_cards',
          status: 'completed',
          highlight: `匹配${matchResult.recommendedSystems.length}大系统`
        },
        {
          step: 3,
          name: '3D效果',
          icon: '🎮',
          duration: '3分钟',
          description: '设备布局+管路走向可视化',
          details: [
            '户型生成',
            '设备布局',
            '原理图演示'
          ],
          visual: '3d_preview',
          status: 'completed'
        },
        {
          step: 4,
          name: '报价交付',
          icon: '💰',
          duration: '2分钟',
          description: '价值型报价+清单导出',
          details: [
            '痛点对应报价',
            '促销配置',
            '方案分享'
          ],
          visual: 'quote_summary',
          status: 'completed',
          highlight: `总价${matchResult.totalEstimate ? '约' + matchResult.totalEstimate.toLocaleString() + '元' : '按需定制'}`
        }
      ],
      timeline: {
        totalTime: '10分钟完成现场谈单',
        efficiency: '比传统方式节省80%时间',
        conversion: '方案现场锁定率提升50%'
      },
      bottomSlogan: {
        main: '「10分钟完成现场谈单，告别图纸+计算器时代」',
        sub: 'AI赋能 · 方案即产即销 · 客户秒懂秒签'
      },
      presentationMode: {
        hideUI: true,
        fullScreen: true,
        animation: 'step_by_step_reveal'
      }
    };
  }

  /**
   * 生成完整演示包（三张图合一）
   */
  generatePresentationPackage(diagnosis, matchResult, session) {
    return {
      packageId: `PRES-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title: '瑞美舒适家居系统方案演示',
      subtitle: `${session.data.roomProfile.area}㎡ ${session.data.roomProfile.type} 定制方案`,
      diagrams: [
        this.generatePainPointAnalysisDiagram(diagnosis, session.data.roomProfile),
        this.generateSolutionMappingDiagram(matchResult, diagnosis),
        this.generateFullProcessDiagram(session, matchResult)
      ],
      navigation: {
        type: 'slide_nav',
        currentSlide: 1,
        totalSlides: 3,
        autoPlay: false,
        loop: true
      },
      presentationTips: [
        '第一张图：讲痛点共鸣，让客户点头',
        '第二张图：讲方案价值，让客户心动',
        '第三张图：讲流程高效，让客户放心'
      ],
      exportFormats: ['pptx', 'pdf', 'html']
    };
  }

  // 辅助方法
  generateRoomScene(roomProfile) {
    return {
      type: 'simplified_floorplan',
      area: roomProfile.area,
      rooms: Math.ceil(roomProfile.area / 30),
      highlight: roomProfile.keyFeatures
    };
  }

  identifyPainAreas(diagnosis) {
    return diagnosis.allTags.slice(0, 3).map(tag => ({
      name: tag.name,
      location: '典型区域',
      severity: tag.severity || 'medium'
    }));
  }

  summarizeByCategory(tags) {
    const summary = {};
    for (const tag of tags) {
      if (!summary[tag.category]) {
        summary[tag.category] = { count: 0, tags: [] };
      }
      summary[tag.category].count++;
      summary[tag.category].tags.push(tag.name);
    }
    return summary;
  }

  getPainIcon(category) {
    const icons = {
      '温度体感痛点': '❄️',
      '热水用水痛点': '🚿',
      '潮湿/空气痛点': '💨',
      '水质健康痛点': '💧',
      '省心总包痛点': '🏠'
    };
    return icons[category] || '⚠️';
  }

  getPainColor(category) {
    const colors = {
      '温度体感痛点': '#fc8181',
      '热水用水痛点': '#63b3ed',
      '潮湿/空气痛点': '#68d391',
      '水质健康痛点': '#4299e1',
      '省心总包痛点': '#ed8936'
    };
    return colors[category] || '#a0aec0';
  }

  getSystemIcon(systemName) {
    const icons = {
      '中央热水系统': '💧',
      '五恒恒温系统': '🌡️',
      '新风除湿系统': '🍃',
      '全屋净水系统': '🚰',
      '中央空调系统': '❄️',
      '瑞美全屋总包方案': '🏠'
    };
    return icons[systemName] || '✨';
  }

  generatePainToSystemConnections(tags, systems) {
    // 简化的连接逻辑
    return tags.map((tag, i) => ({
      from: tag.id,
      to: systems[i % systems.length]?.name,
      type: 'solves'
    })).filter(c => c.to);
  }
}

module.exports = CorePrincipleVisuals;
