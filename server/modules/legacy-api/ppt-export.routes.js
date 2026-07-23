/**
 * PPT导出API路由
 * 专业酷炫的方案PPT导出
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getRuntimeEngine } = require('../runtimeEngineAccess');

function getPptEngine() {
  return getRuntimeEngine('pptExport');
}

/**
 * POST /api/ppt-export/solution
 * 导出方案PPT
 */
router.post('/solution', async (req, res) => {
  try {
    const {
      projectName,
      customerName,
      houseInfo,
      selectedPainPoints,
      recommendedSolutions,
      sixSystems,
      quotation
    } = req.body;

    console.log('[PPT Export API] 收到PPT导出请求:', projectName);

    // 验证必要参数
    if (!projectName || !customerName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: projectName, customerName'
      });
    }

    // 生成PPT
    const result = await getPptEngine().exportSolutionPPT({
      projectName,
      customerName,
      houseInfo: houseInfo || {},
      selectedPainPoints: selectedPainPoints || [],
      recommendedSolutions: recommendedSolutions || [],
      sixSystems: sixSystems || [],
      quotation: quotation || {},
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'PPT导出成功',
      data: result
    });

  } catch (error) {
    console.error('[PPT Export API] 导出失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/ppt-export/files
 * 获取已导出的PPT文件列表
 */
router.get('/files', (req, res) => {
  try {
    const files = getPptEngine().getExportedFiles();
    
    res.json({
      success: true,
      data: {
        files,
        total: files.length,
        exportPath: '/exports/ppt'
      }
    });
  } catch (error) {
    console.error('[PPT Export API] 获取文件列表失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/ppt-export/files/:filename
 * 删除导出的PPT文件
 */
router.delete('/files/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../../exports/ppt', filename);
    
    // 安全检查：确保文件在导出目录内
    const resolvedPath = path.resolve(filePath);
    const exportDir = path.resolve(path.join(__dirname, '../../../exports/ppt'));
    
    if (!resolvedPath.startsWith(exportDir)) {
      return res.status(403).json({
        success: false,
        error: '非法文件路径'
      });
    }
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: `文件 ${filename} 已删除`
      });
    } else {
      res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }
  } catch (error) {
    console.error('[PPT Export API] 删除文件失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ppt-export/download/:filename
 * 下载PPT文件（通过静态文件服务更推荐）
 */
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../../exports/ppt', filename);
    
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.sendFile(filePath);
    } else {
      res.status(404).json({
        success: false,
        error: '文件不存在'
      });
    }
  } catch (error) {
    console.error('[PPT Export API] 下载失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ppt-export/preview
 * 预览PPT结构（不实际生成文件）
 */
router.post('/preview', (req, res) => {
  try {
    const { projectName, customerName } = req.body;
    
    // 返回PPT结构预览
    const preview = {
      title: `${projectName} - 方案介绍`,
      slides: [
        { type: 'cover', title: '封面', description: '项目标题、客户名称、日期' },
        { type: 'company', title: '关于瑞美', description: '公司简介、核心数据' },
        { type: 'project', title: '项目概况', description: '房屋信息、客户需求' },
        { type: 'painpoints', title: '痛点诊断', description: 'AI诊断结果、问题列表' },
        { type: 'systems', title: '六大系统', description: '五恒、热水、采暖、空调、新风、净水' },
        { type: 'solutions', title: '推荐方案', description: '3种方案对比、价格、系统配置' },
        { type: 'quotation', title: '投资报价', description: '详细报价表、六系统价格对比' },
        { type: 'benefits', title: '核心优势', description: '为什么选择瑞美' },
        { type: 'cases', title: '成功案例', description: '真实案例展示' },
        { type: 'service', title: '服务流程', description: '6步服务流程' },
        { type: 'contact', title: '联系我们', description: '联系方式、感谢语' }
      ],
      brand: {
        colors: ['C41230', '8B0D24', 'FFD700'],
        features: ['专业模板', '酷炫动画', '品牌定制']
      }
    };
    
    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
