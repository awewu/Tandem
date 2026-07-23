import { Router } from 'express';
import { quotationEngine } from '../engines/QuotationEngine.js';

const router = Router();

/**
 * POST /api/quotations/generate
 * 生成三档报价方案
 */
router.post('/generate', (req, res) => {
  try {
    const {
      equipmentPower,
      storageVolume,
      pipeLength,
      unitCount,
      buildingType,
    } = req.body;

    // 参数验证
    if (!equipmentPower || !unitCount) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['equipmentPower', 'unitCount'],
      });
    }

    // 生成三档报价
    const schemes = quotationEngine.generateQuotationSchemes(
      Number(equipmentPower),
      Number(storageVolume || 2000),
      Number(pipeLength || 200),
      Number(unitCount),
      buildingType || 'hotel'
    );

    res.json({
      success: true,
      data: {
        schemes,
        summary: {
          basicPrice: schemes[0].totalPrice,
          standardPrice: schemes[1].totalPrice,
          premiumPrice: schemes[2].totalPrice,
          recommended: 'standard', // 推荐标准型
        },
      },
    });
  } catch (error: any) {
    console.error('Quotation generation error:', error);
    res.status(500).json({
      error: 'Quotation generation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/quotations/schemes
 * 获取报价方案配置说明
 */
router.get('/schemes', (req, res) => {
  res.json({
    success: true,
    data: {
      basic: {
        name: '基础型方案',
        description: '经济实用，满足基本需求',
        profitMargin: 0.15,
        matchRate: 25,
        selectRate: 32,
        features: [
          '常规空气能热泵',
          '标准储热水箱',
          '基本控制系统',
          '2年质保',
        ],
      },
      standard: {
        name: '标准型方案',
        description: '高性价比，品质与价格平衡',
        profitMargin: 0.22,
        matchRate: 68,
        selectRate: 68,
        features: [
          '高效空气能热泵（COP≥4.0）',
          '保温储热水箱（不锈钢内胆）',
          '智能控制系统',
          '3年质保',
          '免费年度巡检',
        ],
      },
      premium: {
        name: '豪华型方案',
        description: '高端配置，全气候适应',
        profitMargin: 0.28,
        matchRate: 15,
        selectRate: 15,
        features: [
          '超低温空气能热泵（-30℃稳定运行）',
          '承压储热水箱（搪瓷内胆）',
          'AI智能控制系统',
          '太阳能辅助加热',
          '5年质保',
          '终身技术支持',
          '远程监控服务',
        ],
      },
    },
  });
});

/**
 * POST /api/quotations/export
 * 导出报价单
 */
router.post('/export', (req, res) => {
  try {
    const { scheme, format = 'json' } = req.body;

    if (!scheme) {
      return res.status(400).json({
        error: 'Missing scheme data',
      });
    }

    // 根据格式返回
    if (format === 'json') {
      res.json({
        success: true,
        data: scheme,
      });
    } else if (format === 'csv') {
      // 生成CSV格式的材料清单
      let csv = '序号,分类,名称,型号,品牌,单位,数量,成本价,销售价,备注\n';
      
      scheme.materialCosts.forEach((m: any, index: number) => {
        csv += `${index + 1},${m.category},${m.name},${m.model},${m.brand},${m.unit},${m.quantity},${m.unitCost},${m.unitPrice},${m.description || ''}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=quotation.csv');
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Unsupported format' });
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Export failed',
      message: error.message,
    });
  }
});

export { router as quotationRoutes };
