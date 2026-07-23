/**
 * Revit集成API - Revit Integration API
 * 双向数据同步、族库、参数映射、模型对比
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const revitEngine = getRuntimeEngine('revitIntegration');

/**
 * POST /api/revit/export-optimized-ifc
 * 生成Revit优化的IFC文件
 */
router.post('/export-optimized-ifc', async (req, res) => {
  try {
    const { 
      projectName, 
      projectId, 
      buildingInfo, 
      devices = [], 
      pipes = [], 
      systems = [],
      revitVersion = '2024'
    } = req.body;
    
    console.log('[Revit API] 生成Revit优化IFC...');
    
    if (!projectName) {
      return res.status(400).json({
        success: false,
        message: '缺少项目信息'
      });
    }
    
    const result = revitEngine.generateRevitOptimizedIFC({
      projectName,
      projectId: projectId || `PRJ-${Date.now()}`,
      buildingInfo: buildingInfo || { name: '住宅', area: 120 },
      devices,
      pipes,
      systems: systems.length > 0 ? systems : [{ type: 'hvac', name: '空调系统' }],
      version: revitVersion
    });
    
    res.json({
      success: true,
      message: `Revit ${revitVersion} 优化IFC生成成功`,
      data: {
        ...result,
        downloadUrl: `/api/revit/download/${result.filename}`,
        importGuide: {
          video: 'https://rheem.com/guides/revit-import-tutorial',
          documentation: 'https://rheem.com/docs/revit-integration',
          faq: 'https://rheem.com/faq/revit-import'
        }
      }
    });
  } catch (error) {
    console.error('[Revit API] 导出失败:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /api/revit/family-library
 * 获取瑞美Revit族库
 */
router.get('/family-library', async (req, res) => {
  try {
    const { category, capacity } = req.query;
    
    const library = revitEngine.familyLibrary;
    
    // 过滤特定类别
    let result = library;
    if (category && library[category]) {
      result = { [category]: library[category] };
    }
    
    // 根据容量匹配
    if (capacity && category === 'hvac') {
      const cap = parseInt(capacity);
      result.hvac.outdoorUnits = result.hvac.outdoorUnits.filter(
        u => u.params?.coolingCapacity >= cap * 0.8 && u.params?.coolingCapacity <= cap * 1.2
      );
    }
    
    res.json({
      success: true,
      data: {
        categories: Object.keys(library),
        families: result,
        totalFamilies: Object.values(library).reduce((sum, cat) => 
          sum + (Array.isArray(cat) ? cat.length : Object.values(cat).flat().length), 0
        ),
        downloadBaseUrl: 'https://rheem.com/revit-families/'
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/revit/match-family
 * 智能匹配族文件
 */
router.post('/match-family', async (req, res) => {
  try {
    const { specs, category } = req.body;
    
    const match = revitEngine.getMatchingFamily(specs, category);
    
    res.json({
      success: true,
      data: {
        matched: !!match,
        family: match,
        alternatives: revitEngine.familyLibrary[category]?.slice(0, 3) || [],
        confidence: match ? 0.95 : 0
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/revit/parameter-mapping
 * 获取参数映射表
 */
router.get('/parameter-mapping', async (req, res) => {
  res.json({
    success: true,
    data: {
      toRevit: revitEngine.parameterMapping.toRevit,
      fromRevit: revitEngine.parameterMapping.fromRevit,
      note: '平台参数与Revit参数双向映射表'
    }
  });
});

/**
 * POST /api/revit/import-from-revit
 * 从Revit导入数据
 */
router.post('/import-from-revit', async (req, res) => {
  try {
    const { elements, parameters, projectInfo } = req.body;
    
    console.log('[Revit API] 从Revit导入数据...');
    
    const imported = revitEngine.exportRevitParameters({
      elements,
      parameters,
      projectInfo
    });
    
    res.json({
      success: true,
      message: 'Revit数据导入成功',
      data: {
        imported,
        statistics: {
          totalDevices: imported.devices.length,
          parametersMapped: Object.keys(revitEngine.parameterMapping.fromRevit).length
        },
        syncId: `SYNC-${Date.now()}`
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/revit/compare-models
 * 模型版本对比
 */
router.post('/compare-models', async (req, res) => {
  try {
    const { oldModel, newModel } = req.body;
    
    const comparison = revitEngine.compareModels(oldModel, newModel);
    
    res.json({
      success: true,
      data: {
        ...comparison,
        report: {
          html: `/reports/comparison-${Date.now()}.html`,
          pdf: `/reports/comparison-${Date.now()}.pdf`
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/revit/detect-conflicts
 * 冲突检测
 */
router.post('/detect-conflicts', async (req, res) => {
  try {
    const { modelA, modelB } = req.body;
    
    const conflicts = revitEngine.detectConflicts(modelA, modelB);
    
    res.json({
      success: true,
      data: {
        ...conflicts,
        resolutionSuggestions: conflicts.conflicts.map(c => ({
          conflict: c,
          suggestions: [
            '调整设备位置',
            '更换小型号设备',
            '修改管路走向'
          ]
        }))
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/revit/supported-versions
 * 支持的Revit版本
 */
router.get('/supported-versions', async (req, res) => {
  res.json({
    success: true,
    data: {
      versions: revitEngine.supportedRevitVersions,
      recommended: '2024',
      minimum: '2020',
      ifcPlugin: {
        required: true,
        downloadUrl: 'https://github.com/Autodesk/revit-ifc/releases',
        latestVersion: 'v24.2.0'
      }
    }
  });
});

/**
 * GET /api/revit/system-mapping
 * 系统映射配置
 */
router.get('/system-mapping', async (req, res) => {
  res.json({
    success: true,
    data: {
      mappings: revitEngine.systemMapping,
      note: '平台系统类型与Revit系统分类的映射关系'
    }
  });
});

/**
 * GET /api/revit/download-template
 * 下载Revit项目模板
 */
router.get('/download-template', async (req, res) => {
  const { type = 'hvac' } = req.query;
  
  const templates = {
    hvac: {
      name: '瑞美暖通项目模板.rte',
      description: '包含MEP系统浏览器、暖通视图配置的Revit模板',
      url: '/templates/Rheem_HVAC_Template_2024.rte',
      size: '15.2 MB'
    },
    mep: {
      name: '瑞美MEP协同模板.rte',
      description: '适用于与建筑/结构协同的MEP模板',
      url: '/templates/Rheem_MEP_Coordination_Template_2024.rte',
      size: '18.5 MB'
    }
  };
  
  res.json({
    success: true,
    data: templates[type] || templates.hvac
  });
});

module.exports = router;
