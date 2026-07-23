/**
 * 【API路由统一注册 - 立即修复】
 * 注册所有缺失的API接口
 */

const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../runtimeEngineAccess');

const painDiagnosisV3 = getRuntimeEngine('painDiagnosis');
const drawingSync = getRuntimeEngine('drawingSync');
const templateEngine = getRuntimeEngine('solutionTemplate');
const backupEngine = getRuntimeEngine('dataBackupEngine');
const econetEngine = getRuntimeEngine('econetSystem');
const CADImporter = getRuntimeEngine('legacyCadImporter');
const ImageRecognition = getRuntimeEngine('imageRecognition');

const initializedEngines = new WeakSet();

async function ensureEngineInitialized(engine) {
  if (!engine || initializedEngines.has(engine)) return engine;
  if (typeof engine.initialize === 'function') await engine.initialize();
  initializedEngines.add(engine);
  return engine;
}

// ==================== 改图联动同步 API ====================
router.post('/drawing-sync/session', async (req, res) => {
  try {
    await ensureEngineInitialized(drawingSync);
    console.log('[API] 创建会话, body:', req.body);
    const { designerId, clientId } = req.body || {};
    if (!designerId || !clientId) {
      return res.status(400).json({ success: false, error: '缺少designerId或clientId' });
    }
    const session = drawingSync.createSession(Date.now().toString(), designerId, clientId);
    console.log('[API] 会话创建成功:', session.id);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[API] 创建会话失败:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

router.post('/drawing-sync/push', async (req, res) => {
  try {
    await ensureEngineInitialized(drawingSync);
    const { sessionId, designerId, changes } = req.body;
    const result = await drawingSync.pushChanges(sessionId, designerId, changes);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/drawing-sync/drawing/:sessionId', async (req, res) => {
  try {
    await ensureEngineInitialized(drawingSync);
    const { sessionId } = req.params;
    const { clientId } = req.query;
    const drawing = await drawingSync.getDrawing(sessionId, clientId);
    res.json({ success: true, drawing });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 方案模板复用 API ====================
// /api/templates GET/POST/popular are owned by front-office-runtime.routes.
// Keep only the legacy apply endpoint here until it is migrated behind the same facade.
router.post('/templates/apply', async (req, res) => {
  try {
    await ensureEngineInitialized(templateEngine);
    const { templateId, customerData } = req.body;
    const solution = await templateEngine.applyTemplate(templateId, customerData);
    res.json({ success: true, solution });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 数据备份恢复 API ====================
router.post('/backup', async (req, res) => {
  try {
    await ensureEngineInitialized(backupEngine);
    const result = await backupEngine.performBackup('manual');
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/backups', async (req, res) => {
  try {
    await ensureEngineInitialized(backupEngine);
    const backups = backupEngine.getBackupList();
    res.json({ success: true, backups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Econet智能控制 API ====================
router.post('/econet/scenes/execute', async (req, res) => {
  try {
    await ensureEngineInitialized(econetEngine);
    const { sceneId } = req.body;
    const result = await econetEngine.executeScene(sceneId);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/econet/quote', async (req, res) => {
  try {
    await ensureEngineInitialized(econetEngine);
    const { deviceIds } = req.body;
    const quote = await econetEngine.generatePremiumQuote(deviceIds);
    res.json({ success: true, quote });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CAD图纸导入 API ====================
// /api/cad/import is owned by front-office-runtime.routes.
router.post('/cad/validate', async (req, res) => {
  try {
    const { cadData } = req.body;
    const validation = CADImporter.validateCADData(cadData);
    res.json({ success: true, validation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 图片识别 API ====================
router.post('/image/recognize', async (req, res) => {
  try {
    const { imagePath, options = {} } = req.body;
    const result = await ImageRecognition.recognizeFloorPlan(imagePath, options);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/image/formats', async (req, res) => {
  try {
    const formats = ImageRecognition.getSupportedFormats();
    res.json({ success: true, formats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 痛点诊断v3 API (48项痛点 + 3种方案) ====================

// 获取所有48项痛点定义
router.get('/pain-diagnosis/v3/pain-points', async (req, res) => {
  try {
    const dimensions = painDiagnosisV3.painDimensions;
    const sixSystems = painDiagnosisV3.sixSystems;
    
    // 统计总数
    let totalCount = 0;
    Object.values(dimensions).forEach(dim => {
      totalCount += dim.tags.length;
    });
    
    res.json({
      success: true,
      data: {
        dimensions,
        sixSystems,
        totalPainPoints: totalCount,
        version: '3.0',
        features: [
          '48项专业痛点评估',
          '痛点选择无数量限制',
          'AI智能隐性痛点识别',
          '3种定制方案推荐',
          '6大系统全覆盖'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 执行痛点诊断 (返回可用痛点 + AI推荐)
router.post('/pain-diagnosis/v3/diagnose', async (req, res) => {
  try {
    const { roomProfile } = req.body;
    
    if (!roomProfile) {
      return res.status(400).json({ success: false, error: '缺少roomProfile参数' });
    }
    
    const result = painDiagnosisV3.diagnose(roomProfile);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 提交痛点选择并获取3种推荐方案
router.post('/pain-diagnosis/v3/solutions', async (req, res) => {
  try {
    const { roomProfile, selectedTags } = req.body;
    
    if (!roomProfile || !selectedTags) {
      return res.status(400).json({ success: false, error: '缺少roomProfile或selectedTags参数' });
    }
    
    const result = painDiagnosisV3.diagnose(roomProfile, selectedTags);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // 格式化返回数据
    res.json({
      success: true,
      data: {
        roomProfile: result.data.roomProfile,
        selectedPainPoints: {
          count: selectedTags.length,
          tags: selectedTags
        },
        analysis: result.data.selectedAnalysis,
        recommendedSolutions: result.data.recommendedSolutions,
        sixSystems: painDiagnosisV3.sixSystems,
        timestamp: result.data.timestamp
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取6大系统详情
router.get('/pain-diagnosis/v3/six-systems', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        systems: painDiagnosisV3.sixSystems,
        descriptions: {
          wuheng: '恒温、恒湿、恒氧、恒洁、恒静',
          hotWater: '即开即热，全屋热水零等待',
          heating: '地暖/暖气片，冬季温暖舒适',
          ac: '中央空调/分体空调，夏季清凉',
          freshAir: '24小时新鲜空气，除霾降醛',
          waterPurify: '全屋净化，饮水用水更健康'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI识别隐性痛点
router.post('/pain-diagnosis/v3/ai-recognize', async (req, res) => {
  try {
    const { roomProfile, manuallySelected = [] } = req.body;
    
    if (!roomProfile) {
      return res.status(400).json({ success: false, error: '缺少roomProfile参数' });
    }
    
    const aiRecommendations = painDiagnosisV3.aiRecognizePainPoints(roomProfile, manuallySelected);
    
    res.json({
      success: true,
      data: {
        recommendations: aiRecommendations.recommendations,
        total: aiRecommendations.total,
        accuracy: aiRecommendations.accuracy,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
