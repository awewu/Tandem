const express = require('express');

function createContentSalesRouter() {
  const router = express.Router();

  router.get('/api/content/presentation', (req, res) => {
    res.json({
      success: true,
      data: {
        slides: [
          { title: 'Rhautt Comfort舒适家居系统介绍', type: 'cover' },
          { title: '五恒系统原理', type: 'diagram' },
          { title: '产品优势对比', type: 'comparison' },
          { title: '成功案例展示', type: 'cases' }
        ],
        downloadUrl: '/downloads/presentation.pdf'
      }
    });
  });

  router.get('/api/content/video', (req, res) => {
    res.json({
      success: true,
      data: {
        videos: [
          { id: 1, title: '五恒系统工作原理', duration: '3:45', thumbnail: '/thumbs/video1.jpg' },
          { id: 2, title: '安装流程详解', duration: '5:20', thumbnail: '/thumbs/video2.jpg' },
          { id: 3, title: '客户体验分享', duration: '2:30', thumbnail: '/thumbs/video3.jpg' }
        ]
      }
    });
  });

  router.get('/api/content/cases', (req, res) => {
    res.json({
      success: true,
      data: [
        { id: 1, title: '北京棕榈泉别墅项目', area: 450, type: '别墅', savings: '35%', image: '/cases/case1.jpg' },
        { id: 2, title: '上海汤臣一品公寓', area: 280, type: '大平层', savings: '28%', image: '/cases/case2.jpg' },
        { id: 3, title: '深圳湾壹号', area: 320, type: '豪宅', savings: '32%', image: '/cases/case3.jpg' }
      ]
    });
  });

  router.get('/api/content/comparison', (req, res) => {
    res.json({
      success: true,
      data: {
        systems: [
          { name: '传统空调+地暖', efficiency: 65, comfort: 70, cost: 80, maintenance: 75 },
          { name: 'Rhautt Comfort五恒系统', efficiency: 95, comfort: 98, cost: 60, maintenance: 90 }
        ]
      }
    });
  });

  router.post('/api/sales/report', (req, res) => {
    const { customerType, decorationStage } = req.body || {};
    console.log(`[销售报告] 客户类型:${customerType} 装修阶段:${decorationStage}`);
    res.json({
      success: true,
      message: '报告提交成功',
      data: {
        reportId: `SR${Date.now()}`,
        timestamp: new Date().toISOString(),
        recommendations: ['推荐五恒系统方案', '赠送首次维护服务']
      }
    });
  });

  router.post('/api/diagnosis/analyze', (req, res) => {
    const { description } = req.body || {};
    const diagnoses = [
      { id: 'D001', problem: '制冷效果不佳', confidence: 85, solution: '检查冷媒压力，清洗过滤网' },
      { id: 'D002', problem: '噪音过大', confidence: 72, solution: '检查风机轴承，紧固螺丝' },
      { id: 'D003', problem: '能耗异常', confidence: 68, solution: '检查温控设置，清洗换热器' }
    ];
    res.json({
      success: true,
      data: {
        diagnoses: diagnoses.filter(d => description?.includes('冷') || description?.includes('噪') || Math.random() > 0.5),
        analysisTime: '1.2s',
        suggestion: '建议预约上门检测'
      }
    });
  });

  router.post('/api/workorders/create-from-diagnosis', (req, res) => {
    const { diagnosisId } = req.body || {};
    res.json({
      success: true,
      data: {
        workOrderId: `WO${Date.now()}`,
        diagnosisId,
        status: 'created',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  });

  return router;
}

module.exports = createContentSalesRouter;
