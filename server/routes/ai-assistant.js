/**
 * AI智能设计助手API - AI Assistant API
 * 自然语言设计、自动方案生成、智能问答
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const ai = getRuntimeEngine('aiDesignAssistant');

/**
 * POST /api/ai/parse-intent
 * 解析自然语言设计意图
 */
router.post('/parse-intent', async (req, res) => {
  try {
    const { input } = req.body;
    
    console.log('[AI API] 解析意图:', input);
    
    const result = await ai.parseDesignIntent(input);
    
    res.json({
      success: true,
      message: '意图解析完成',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/ai/generate-design
 * 自动生成设计方案
 */
router.post('/generate-design', async (req, res) => {
  try {
    const { area, rooms, city, orientation, budget } = req.body;
    
    console.log('[AI API] 生成设计方案:', { area, rooms, city });
    
    const projectInfo = { area, rooms, city, orientation, budget };
    const design = await ai.generateAutoDesign(projectInfo);
    
    res.json({
      success: true,
      message: 'AI设计方案生成完成',
      data: design,
      highlights: [
        '基于气候数据智能计算负荷',
        '自动匹配最优设备配置',
        '管路路径AI优化',
        '合规性自动检查'
      ]
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/ai/compare
 * 方案对比
 */
router.post('/compare', async (req, res) => {
  try {
    const { schemeA, schemeB } = req.body;
    
    const comparison = ai.compareSchemes(schemeA, schemeB);
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/ai/capabilities
 * 获取AI能力清单
 */
router.get('/capabilities', async (req, res) => {
  res.json({
    success: true,
    data: {
      version: ai.version,
      capabilities: ai.capabilities,
      features: [
        { id: 'natural_language', name: '自然语言设计', desc: '用一句话描述需求，AI自动生成方案' },
        { id: 'auto_design', name: '自动方案生成', desc: '3秒生成完整设计方案' },
        { id: 'load_optimization', name: '负荷智能优化', desc: '基于气候数据精确计算' },
        { id: 'equipment_selection', name: '设备智能选型', desc: '自动匹配最优设备组合' },
        { id: 'path_optimization', name: '管路路径优化', desc: '最短路径+最小阻力算法' },
        { id: 'diagnosis', name: '故障智能诊断', desc: '常见问题自动排查' },
        { id: 'comparison', name: '方案智能对比', desc: '多维度评分对比' }
      ]
    }
  });
});

module.exports = router;
