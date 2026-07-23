/**
 * DXF文件上传和解析路由
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function getDxfParserService() {
  return getRuntimeEngine('dxfParserService');
}

// 配置multer存储
const storage = multer.memoryStorage();

// DXF 文件魔数 (AutoCAD DXF 文件以 "AutoCAD Binary DXF" 或 "0" 开头)
function isValidDxfBuffer(buffer) {
  if (!buffer || buffer.length < 20) return false;
  const header = buffer.toString('ascii', 0, 50).toUpperCase();
  // 检查 ASCII DXF (以 "0" 开头) 或 Binary DXF
  return header.includes('DXF') || header.trim().startsWith('0');
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: (req, file, cb) => {
    // 多重验证：扩展名 + MIME 类型
    const ext = path.extname(file.originalname || '').toLowerCase();
    const validMimeTypes = ['image/vnd.dxf', 'application/dxf', 'application/x-dxf', 'text/plain'];

    if (ext !== '.dxf') {
      return cb(new Error('只允许上传 .dxf 文件'), false);
    }

    // 额外的 MIME 类型检查
    if (file.mimetype && !validMimeTypes.includes(file.mimetype) && !file.mimetype.includes('text')) {
      console.warn(`[Security] 可疑的 MIME 类型: ${file.mimetype} for ${file.originalname}`);
    }

    cb(null, true);
  }
});

/**
 * POST /api/dxf/parse
 * 上传并解析DXF文件
 */
router.post('/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '没有上传文件'
      });
    }

    console.log(`📐 解析DXF文件: ${req.file.originalname}`);

    // 安全验证：检查文件头魔数
    if (!isValidDxfBuffer(req.file.buffer)) {
      console.error(`[Security] 拒绝解析非DXF格式文件: ${req.file.originalname}`);
      return res.status(400).json({
        success: false,
        error: '上传的文件不是有效的DXF格式'
      });
    }

    // 解析DXF文件
    const dxfParserService = getDxfParserService();
    const result = await dxfParserService.parseDXF(req.file.buffer);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // 计算负荷
    const loadCalculation = dxfParserService.calculateHeatingLoad(result, {
      climateZone: req.body.climateZone || 'cold',
      insulation: req.body.insulation || 'good',
      floorHeight: parseFloat(req.body.floorHeight) || 2.8
    });

    // 获取统计信息
    const statistics = dxfParserService.getStatistics(result);

    console.log(`✅ DXF解析成功: ${result.rooms.length}个房间, 总面积${result.totalArea}㎡`);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        fileSize: req.file.size,
        rooms: result.rooms,
        walls: result.walls,
        totalArea: result.totalArea,
        dimensions: result.dimensions,
        loadCalculation,
        statistics
      }
    });
  } catch (error) {
    console.error('❌ DXF解析失败:', error);
    res.status(500).json({
      success: false,
      error: 'DXF解析失败: ' + error.message
    });
  }
});

/**
 * POST /api/dxf/calculate-load
 * 根据已有户型数据计算负荷
 */
router.post('/calculate-load', express.json(), (req, res) => {
  try {
    const { rooms, totalArea, parameters } = req.body;

    if (!rooms || !Array.isArray(rooms)) {
      return res.status(400).json({
        success: false,
        error: '缺少房间数据'
      });
    }

    // 构造DXF数据格式进行计算
    const dxfData = {
      rooms,
      totalArea: totalArea || rooms.reduce((sum, r) => sum + (r.area || 0), 0)
    };

    const loadCalculation = getDxfParserService().calculateHeatingLoad(dxfData, parameters || {});

    res.json({
      success: true,
      data: loadCalculation
    });
  } catch (error) {
    console.error('❌ 负荷计算失败:', error);
    res.status(500).json({
      success: false,
      error: '负荷计算失败: ' + error.message
    });
  }
});

/**
 * GET /api/dxf/room-types
 * 获取房间类型定义
 */
router.get('/room-types', (req, res) => {
  const roomTypes = {
    living_room: { name: '客厅', nameEn: 'Living Room', icon: '🛋️' },
    bedroom: { name: '卧室', nameEn: 'Bedroom', icon: '🛏️' },
    kitchen: { name: '厨房', nameEn: 'Kitchen', icon: '🍳' },
    bathroom: { name: '卫生间', nameEn: 'Bathroom', icon: '🚿' },
    study: { name: '书房', nameEn: 'Study', icon: '📚' },
    dining: { name: '餐厅', nameEn: 'Dining Room', icon: '🍽️' },
    balcony: { name: '阳台', nameEn: 'Balcony', icon: '🌿' },
    other: { name: '其他', nameEn: 'Other', icon: '📦' }
  };

  res.json({
    success: true,
    data: roomTypes
  });
});

/**
 * POST /api/dxf/save-project
 * 保存户型项目
 */
router.post('/save-project', express.json(), async (req, res) => {
  try {
    const projectData = req.body;
    
    // 这里可以保存到数据库
    // 暂时保存到文件系统
    const fs = require('fs').promises;
    
    const projectId = `project_${Date.now()}`;
    const filePath = path.join(__dirname, '../../data/projects', `${projectId}.json`);
    
    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // 保存项目数据
    const projectToSave = {
      id: projectId,
      ...projectData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(projectToSave, null, 2));
    
    console.log(`💾 项目已保存: ${projectId}`);
    
    res.json({
      success: true,
      data: {
        projectId,
        message: '项目保存成功'
      }
    });
  } catch (error) {
    console.error('❌ 项目保存失败:', error);
    res.status(500).json({
      success: false,
      error: '项目保存失败: ' + error.message
    });
  }
});

// 安全的项目ID验证正则
const VALID_PROJECT_ID_REGEX = /^project_\d{13}$/;

/**
 * 验证并净化项目ID
 * @param {string} projectId
 * @returns {string|null} 有效返回ID，无效返回null
 */
function sanitizeProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return null;
  // 只保留字母数字和下划线，防止路径遍历
  const sanitized = projectId.replace(/[^a-zA-Z0-9_]/g, '');
  if (!VALID_PROJECT_ID_REGEX.test(sanitized)) return null;
  return sanitized;
}

/**
 * GET /api/dxf/project/:projectId
 * 获取项目数据
 */
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const fs = require('fs').promises;
    const path = require('path');

    // 验证项目ID格式，防止路径遍历
    const sanitizedId = sanitizeProjectId(projectId);
    if (!sanitizedId) {
      return res.status(400).json({
        success: false,
        error: '无效的项目ID格式'
      });
    }

    const filePath = path.join(__dirname, '../../data/projects', `${sanitizedId}.json`);

    // 确保解析后的路径仍在预期目录内（二次防护）
    const expectedDir = path.resolve(__dirname, '../../data/projects');
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(expectedDir)) {
      return res.status(400).json({
        success: false,
        error: '无效的项目路径'
      });
    }

    const data = await fs.readFile(filePath, 'utf-8');
    const project = JSON.parse(data);

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('❌ 项目加载失败:', error);
    res.status(404).json({
      success: false,
      error: '项目不存在或加载失败'
    });
  }
});

module.exports = router;
