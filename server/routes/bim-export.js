/**
 * BIM导出API - BIM Export API
 * 支持DXF/IFC/PDF/JSON多格式导出，对接Revit/MagiCAD
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function getBimEngine() {
  return getRuntimeEngine('bimExport');
}

/**
 * POST /api/bim/export
 * 导出设计到BIM格式
 */
router.post('/export', async (req, res) => {
  try {
    const { designData, format = 'ifc' } = req.body;
    
    console.log('[BIM API] 导出请求:', format);
    
    if (!designData) {
      return res.status(400).json({
        success: false,
        message: '缺少设计数据'
      });
    }
    
    const result = getBimEngine().exportDesign(designData, format);
    
    res.json({
      success: true,
      message: `${format.toUpperCase()}导出成功`,
      data: result
    });
  } catch (error) {
    console.error('[BIM API] 导出失败:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /api/bim/export/ifc
 * 专门导出IFC 4.0 (Revit兼容)
 */
router.post('/export/ifc', async (req, res) => {
  try {
    const { projectId, devices, pipes, systems, buildingInfo } = req.body;
    
    console.log('[BIM API] IFC 4.0导出 (Revit兼容)');
    
    const designData = {
      houseType: buildingInfo?.type || '住宅',
      area: buildingInfo?.area || 120,
      devices: devices || [],
      pipes: pipes || [],
      systems: systems || ['hvac']
    };
    
    const result = getBimEngine().exportToIFC(designData);
    
    res.json({
      success: true,
      message: 'IFC 4.0导出成功 (Revit兼容)',
      data: {
        ...result,
        revitImportGuide: {
          steps: [
            '1. 打开Revit 2020+',
            '2. 插入 > IFC > 选择下载的.ifc文件',
            '3. 在链接IFC选项中，选择"作为MEP元素导入"',
            '4. 完成后可在MEP视图中查看系统'
          ],
          tips: [
            '确保Revit安装了最新的IFC导入插件',
            '大型模型建议分段导入',
            '检查系统分类是否正确映射到Revit系统浏览器'
          ]
        }
      }
    });
  } catch (error) {
    console.error('[BIM API] IFC导出失败:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /api/bim/export/dxf
 * 导出DXF (AutoCAD兼容)
 */
router.post('/export/dxf', async (req, res) => {
  try {
    const { designData } = req.body;
    
    const result = getBimEngine().exportToDXF(designData);
    
    res.json({
      success: true,
      message: 'DXF导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/bim/export/pdf
 * 导出施工图纸PDF
 */
router.post('/export/pdf', async (req, res) => {
  try {
    const { designData } = req.body;
    
    const result = getBimEngine().generateConstructionPDF(designData);
    
    res.json({
      success: true,
      message: '施工图纸PDF生成成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/bim/supported-formats
 * 获取支持的导出格式
 */
router.get('/supported-formats', async (req, res) => {
  res.json({
    success: true,
    data: {
      formats: [
        {
          id: 'ifc',
          name: 'IFC 4.0',
          description: 'BIM行业标准格式，支持Revit/MagiCAD导入',
          compatible: ['Revit 2020+', 'MagiCAD', 'AutoCAD MEP', 'Tekla', 'Navisworks'],
          useCase: '与建筑师/结构师协同',
          priority: 'high'
        },
        {
          id: 'dxf',
          name: 'DXF',
          description: 'AutoCAD兼容格式，2D施工图',
          compatible: ['AutoCAD', '浩辰CAD', '天正'],
          useCase: '施工图绘制',
          priority: 'high'
        },
        {
          id: 'pdf',
          name: 'PDF图纸',
          description: '施工图纸PDF，可直接打印',
          compatible: ['所有PDF阅读器'],
          useCase: '现场施工指导',
          priority: 'medium'
        },
        {
          id: 'json',
          name: 'JSON数据',
          description: '结构化设计数据',
          compatible: ['自定义系统'],
          useCase: '系统集成',
          priority: 'low'
        },
        {
          id: 'csv',
          name: 'CSV清单',
          description: '材料清单Excel',
          compatible: ['Excel', 'WPS'],
          useCase: '采购清单',
          priority: 'medium'
        }
      ]
    }
  });
});

/**
 * GET /api/bim/ifc-schema
 * 获取IFC模式定义
 */
router.get('/ifc-schema', async (req, res) => {
  res.json({
    success: true,
    data: {
      schema: 'IFC4',
      version: 'IFC4.0.2.1',
      mvd: 'CoordinationView_V2.0 + MEPView',
      entities: {
        project: 'IfcProject',
        building: 'IfcBuilding',
        storey: 'IfcBuildingStorey',
        systems: {
          hvac: 'IfcDistributionSystem.AIRCONDITIONING',
          heating: 'IfcDistributionSystem.HEATING',
          water: 'IfcDistributionSystem.DOMESTICHOTWATER',
          ventilation: 'IfcDistributionSystem.VENTILATION'
        },
        elements: {
          outdoorUnit: 'IfcCondenser',
          indoorUnit: 'IfcEvaporator',
          waterHeater: 'IfcWaterHeater',
          pipe: 'IfcPipeSegment',
          duct: 'IfcDuctSegment',
          pump: 'IfcPump',
          valve: 'IfcValve'
        }
      },
      properties: [
        '设备型号',
        '额定功率',
        '制冷量',
        '制热量',
        '管径',
        '材质',
        '安装位置'
      ]
    }
  });
});

module.exports = router;
