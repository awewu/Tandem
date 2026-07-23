import { Router } from 'express';
import { drawingExportEngine } from '../engines/DrawingExportEngine.js';

const router = Router();

/**
 * POST /api/drawings/export
 * 导出图纸和材料清单
 */
router.post('/export', (req, res) => {
  try {
    const {
      projectName,
      buildingType,
      buildingArea,
      unitCount,
      equipmentList,
      tankList,
      pipeRouting,
      drawingType = 'all',
    } = req.body;

    // 参数验证
    if (!projectName || !equipmentList || !tankList) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['projectName', 'equipmentList', 'tankList'],
      });
    }

    const request = {
      projectName,
      buildingType: buildingType || 'hotel',
      buildingArea: Number(buildingArea || 1000),
      unitCount: Number(unitCount || 100),
      equipmentList,
      tankList,
      pipeRouting: pipeRouting || {
        mainPipeDN: 32,
        branchPipeDN: 25,
        circulationPipeDN: 20,
        estimatedLength: 200,
      },
      drawingType,
    };

    const drawings: any[] = [];

    // 生成图纸
    if (drawingType === 'schematic' || drawingType === 'all') {
      const schematic = drawingExportEngine.generateSchematicDiagram(request);
      drawings.push({
        type: 'schematic',
        name: '系统原理图',
        format: 'svg',
        content: schematic,
      });
    }

    if (drawingType === 'layout' || drawingType === 'all') {
      const layout = drawingExportEngine.generateLayoutPlan(request);
      drawings.push({
        type: 'layout',
        name: '平面布置图',
        format: 'svg',
        content: layout,
      });
    }

    // 生成材料清单
    const materialBill = drawingExportEngine.generateMaterialBill(request);

    // 生成技术规格书
    const specifications = drawingExportEngine.generateSpecifications(request);

    res.json({
      success: true,
      data: {
        drawings,
        materialBill,
        specifications,
      },
    });
  } catch (error: any) {
    console.error('Drawing export error:', error);
    res.status(500).json({
      error: 'Drawing export failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/drawings/material-bill
 * 单独导出材料清单
 */
router.post('/material-bill', (req, res) => {
  try {
    const {
      projectName,
      buildingType,
      buildingArea,
      unitCount,
      equipmentList,
      tankList,
      pipeRouting,
    } = req.body;

    const request = {
      projectName: projectName || '未命名项目',
      buildingType: buildingType || 'hotel',
      buildingArea: Number(buildingArea || 1000),
      unitCount: Number(unitCount || 100),
      equipmentList: equipmentList || [],
      tankList: tankList || [],
      pipeRouting: pipeRouting || {
        mainPipeDN: 32,
        branchPipeDN: 25,
        circulationPipeDN: 20,
        estimatedLength: 200,
      },
      drawingType: 'bill' as const,
    };

    const materialBill = drawingExportEngine.generateMaterialBill(request);

    res.json({
      success: true,
      data: materialBill,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Material bill generation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/drawings/specifications
 * 获取技术规格书模板
 */
router.get('/specifications', (req, res) => {
  const specifications = [
    '## 热水系统设计技术规格书',
    '',
    '### 一、设计依据',
    '1. GB 50015-2019《建筑给水排水设计标准》',
    '2. GB 50736-2012《民用建筑供暖通风与空气调节设计规范》',
    '3. GB/T 23137-2020《家用和类似用途热泵热水器》',
    '',
    '### 二、设计参数',
    '- 热水供水温度: 60℃',
    '- 冷水计算温度: 15℃（三亚地区）',
    '',
    '### 三、系统说明',
    '1. 本系统采用空气源热泵作为热源，提供24小时热水供应',
    '2. 系统采用开式（闭式）系统，设置储热水箱蓄热',
    '3. 热水管网采用机械循环系统，保证即开即热',
    '4. 主机采用N+1配置，确保系统可靠性',
    '',
    '### 四、设备要求',
    '1. 热泵主机COP≥4.0（标准工况下）',
    '2. 储热水箱保温厚度≥50mm，24小时温降≤5℃',
    '3. 管道保温采用B1级橡塑保温材料',
    '4. 控制系统具备定时启停、温度设定、故障报警功能',
    '',
    '### 五、施工要求',
    '1. 设备安装应水平，基础承重≥设备重量2倍',
    '2. 管道安装坡度≥0.003，高点设排气，低点设泄水',
    '3. 管道试压0.6MPa，保压30分钟无泄漏',
    '4. 保温施工应在管道试压合格后进行',
    '',
    '### 六、调试要求',
    '1. 系统注水后检查各连接点无渗漏',
    '2. 主机调试应检查高低压、电流、出水温度正常',
    '3. 循环系统调试应检查各用水点压力平衡',
    '4. 系统连续运行72小时无故障',
  ];

  res.json({
    success: true,
    data: specifications,
  });
});

export { router as drawingRoutes };
