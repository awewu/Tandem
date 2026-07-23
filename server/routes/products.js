/**
 * 产品管理API - 材料设备数据库管理
 * 支持: 查询/增删改查/批量导入/参数修订
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');

// 所有路由需要认证
router.use(auth);

// 文件上传配置（内存存储，限制10MB，仅允许 .csv / .xlsx / .xls）
const uploadStorage = multer.memoryStorage();

// 验证 Excel/CSV 文件魔数
function isValidExcelOrCsvBuffer(buffer, mimetype, originalname) {
  if (!buffer || buffer.length < 8) return false;
  const ext = (originalname || '').toLowerCase().split('.').pop();

  // XLSX 文件以 PK 开头 (ZIP 格式)
  if (ext === 'xlsx') {
    return buffer[0] === 0x50 && buffer[1] === 0x4B; // 'PK'
  }
  // XLS 文件 (OLE2)
  if (ext === 'xls') {
    return buffer[0] === 0xD0 && buffer[1] === 0xCF; // OLE2 签名
  }
  // CSV 文件应该是纯文本
  if (ext === 'csv') {
    // 检查是否包含逗号或是纯文本
    const sample = buffer.toString('utf-8', 0, Math.min(200, buffer.length));
    return sample.includes(',') || /^[\x00-\x7F\s]*$/.test(sample);
  }
  return false;
}

const uploadFile = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const validExts = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(name);

    if (!validExts.includes(ext)) {
      return cb(new Error('仅允许上传 .csv / .xlsx / .xls 文件'), false);
    }

    // MIME 类型白名单
    const validMimes = [
      'text/csv', 'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'application/octet-stream'
    ];
    if (file.mimetype && !validMimes.some(m => file.mimetype.includes(m))) {
      console.warn(`[Security] 可疑的 MIME 类型: ${file.mimetype} for ${file.originalname}`);
    }

    cb(null, true);
  }
});

/**
 * GET /api/products
 * 获取产品列表（支持分页、筛选、搜索）
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      subcategory,
      brand,
      search,
      status = 'active',
      sort = '-createdAt'
    } = req.query;

    // 构建查询条件
    const filter = { status };
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    if (brand) filter.brand = brand;
    
    // 文本搜索
    if (search) {
      filter.$text = { $search: search };
    }

    // 执行查询
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
    
  } catch (error) {
    console.error('[Products API] 查询失败:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /api/products/categories
 * 获取产品分类列表
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: { category: '$category', subcategory: '$subcategory' },
          count: { $sum: 1 },
          brands: { $addToSet: '$brand' }
        }
      },
      {
        $group: {
          _id: '$_id.category',
          subcategories: {
            $push: {
              name: '$_id.subcategory',
              count: '$count',
              brands: '$brands'
            }
          },
          totalCount: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: categories.map(c => ({
        category: c._id,
        totalCount: c.totalCount,
        subcategories: c.subcategories
      }))
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/products/:sku
 * 获取单个产品详情
 */
router.get('/:sku', async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '产品不存在'
      });
    }

    res.json({
      success: true,
      data: product
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/products
 * 创建新产品
 */
router.post('/', async (req, res) => {
  try {
    const productData = {
      ...req.body,
      dataSource: {
        type: 'manual',
        verified: true
      }
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      message: '产品创建成功',
      data: product
    });
    
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'SKU已存在'
      });
    }
    return errorResponse(res, error);
  }
});

/**
 * PUT /api/products/:sku
 * 更新产品信息（后台修订参数）
 */
router.put('/:sku', async (req, res) => {
  try {
    const updates = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // 不允许修改SKU
    delete updates.sku;
    delete updates._id;

    const product = await Product.findOneAndUpdate(
      { sku: req.params.sku },
      updates,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '产品不存在'
      });
    }

    res.json({
      success: true,
      message: '产品更新成功',
      data: product
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * PATCH /api/products/:sku/price
 * 快速更新价格（常用后台操作）
 */
router.patch('/:sku/price', async (req, res) => {
  try {
    const { cost, retail, wholesale } = req.body;
    
    const product = await Product.findOneAndUpdate(
      { sku: req.params.sku },
      {
        'pricing.cost': cost,
        'pricing.retail': retail,
        'pricing.wholesale': wholesale,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '产品不存在'
      });
    }

    res.json({
      success: true,
      message: '价格更新成功',
      data: {
        sku: product.sku,
        pricing: product.pricing
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * PATCH /api/products/:sku/stock
 * 更新库存
 */
router.patch('/:sku/stock', async (req, res) => {
  try {
    const { stock, supplier, leadTime } = req.body;
    
    const product = await Product.findOneAndUpdate(
      { sku: req.params.sku },
      {
        'inventory.stock': stock,
        'inventory.supplier': supplier,
        'inventory.leadTime': leadTime,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '产品不存在'
      });
    }

    res.json({
      success: true,
      message: '库存更新成功',
      data: {
        sku: product.sku,
        inventory: product.inventory
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * DELETE /api/products/series
 * 按品牌 + 系列批量软删除（必须注册在 /:sku 之前！）
 * Query: ?brand=Rheem&series=Classic  (series可选；仅brand则删除该品牌全部)
 * Body (可选): { hardDelete: true } — 硬删除（不推荐，默认软删除）
 */
router.delete('/series', async (req, res) => {
  try {
    const { brand, series } = req.query;
    const { hardDelete = false } = req.body || {};

    if (!brand) {
      return res.status(400).json({
        success: false,
        message: '必须指定 brand 参数'
      });
    }

    const filter = { brand };
    if (series) filter.series = series;

    const affected = await Product.countDocuments(filter);
    if (affected === 0) {
      return res.status(404).json({
        success: false,
        message: `未找到匹配 brand=${brand}${series ? `, series=${series}` : ''} 的产品`
      });
    }

    let result;
    if (hardDelete === true) {
      result = await Product.deleteMany(filter);
      return res.json({
        success: true,
        message: `已永久删除 ${result.deletedCount} 个产品`,
        data: { mode: 'hard', affected: result.deletedCount, filter }
      });
    } else {
      result = await Product.updateMany(filter, {
        $set: { status: 'discontinued', updatedAt: new Date() }
      });
      return res.json({
        success: true,
        message: `已停用 ${result.modifiedCount || result.nModified || 0} 个产品`,
        data: {
          mode: 'soft',
          affected: result.modifiedCount || result.nModified || 0,
          filter
        }
      });
    }
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * DELETE /api/products/:sku
 * 删除产品（软删除，改为discontinued状态）
 */
router.delete('/:sku', async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { sku: req.params.sku },
      { status: 'discontinued', updatedAt: new Date() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: '产品不存在'
      });
    }

    res.json({
      success: true,
      message: '产品已停用'
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/products/bulk-import
 * 批量导入产品（从JSON文件）
 */
router.post('/bulk-import', async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供产品数组'
      });
    }

    // 添加数据源标记
    const productsToImport = products.map(p => ({
      ...p,
      dataSource: {
        type: 'imported',
        scrapedAt: new Date(),
        verified: false
      }
    }));

    // 使用upsert批量导入
    const results = await Promise.all(
      productsToImport.map(async (p) => {
        try {
          await Product.findOneAndUpdate(
            { sku: p.sku },
            p,
            { upsert: true, new: true, runValidators: true }
          );
          return { sku: p.sku, status: 'success' };
        } catch (err) {
          return { sku: p.sku, status: 'error', message: err.message };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    res.json({
      success: true,
      message: `导入完成: ${successCount} 成功, ${errorCount} 失败`,
      data: {
        total: products.length,
        success: successCount,
        errors: errorCount,
        details: results
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * 文件解析工具：将上传的 CSV/Excel buffer 解析为行对象数组
 */
function parseSpreadsheet(file) {
  const name = (file.originalname || '').toLowerCase();
  const wb = XLSX.read(file.buffer, {
    type: 'buffer',
    raw: false,
    cellDates: true
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('文件无有效工作表');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return { rows, sheetName, format: name.endsWith('.csv') ? 'csv' : 'xlsx' };
}

/**
 * 字段映射：把用户表头（中英文皆可）映射到 Product 模型字段
 */
const FIELD_MAP = {
  'sku': 'sku', 'SKU': 'sku', '编码': 'sku', '产品编码': 'sku', '型号': 'sku',
  'name': 'name', '名称': 'name', '产品名称': 'name',
  'brand': 'brand', '品牌': 'brand',
  'series': 'series', '系列': 'series',
  'category': 'category', '分类': 'category',
  'subcategory': 'subcategory', '子分类': 'subcategory',
  'description': 'description', '描述': 'description', '产品描述': 'description',
  'cost': 'pricing.cost', '成本价': 'pricing.cost', '成本': 'pricing.cost',
  'retail': 'pricing.retail', '零售价': 'pricing.retail', '售价': 'pricing.retail', '价格': 'pricing.retail',
  'wholesale': 'pricing.wholesale', '批发价': 'pricing.wholesale',
  'capacity': 'technicalParams.capacity', '制冷量': 'technicalParams.capacity', '功率': 'technicalParams.capacity',
  'diameter': 'pipeParams.diameter', '管径': 'pipeParams.diameter',
  'stock': 'inventory.stock', '库存': 'inventory.stock',
  'status': 'status', '状态': 'status'
};

function mapRow(row) {
  const obj = {};
  for (const [key, val] of Object.entries(row)) {
    const k = String(key).trim();
    const mapped = FIELD_MAP[k] || FIELD_MAP[k.toLowerCase()];
    if (!mapped) continue;
    // 支持 'pricing.cost' 这种点分路径
    const path = mapped.split('.');
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) {
      cur[path[i]] = cur[path[i]] || {};
      cur = cur[path[i]];
    }
    let value = val;
    // 数字字段类型转换
    if (/cost|retail|wholesale|capacity|diameter|stock/i.test(mapped)) {
      const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
      value = isNaN(num) ? 0 : num;
    }
    cur[path[path.length - 1]] = value;
  }
  return obj;
}

/**
 * POST /api/products/upload-file/preview
 * 上传文件并预览前10行解析结果（不入库）
 * 前端表单字段名：file
 */
router.post('/upload-file/preview', uploadFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未收到文件' });
    }
    const { rows, sheetName, format } = parseSpreadsheet(req.file);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: '文件无数据行' });
    }
    const headers = Object.keys(rows[0]);
    const mapped = rows.slice(0, 10).map(mapRow);
    const unmappedHeaders = headers.filter(h => !FIELD_MAP[h] && !FIELD_MAP[h.toLowerCase()]);
    res.json({
      success: true,
      data: {
        format,
        sheetName,
        totalRows: rows.length,
        headers,
        unmappedHeaders,
        previewMapped: mapped,
        previewRaw: rows.slice(0, 10)
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/products/upload-file
 * 上传文件并批量导入
 * 前端表单字段名：file
 * Body: mode=upsert (默认，按SKU覆盖) 或 mode=insert (仅新增，已存在则跳过)
 */
router.post('/upload-file', uploadFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未收到文件' });
    }
    const mode = (req.body?.mode || 'upsert').toLowerCase();
    const { rows } = parseSpreadsheet(req.file);
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: '文件无数据行' });
    }

    const results = { total: rows.length, success: 0, skipped: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const mapped = mapRow(rows[i]);
      if (!mapped.sku) {
        results.failed++;
        results.errors.push({ row: i + 2, reason: '缺少SKU字段' });
        continue;
      }
      try {
        if (mode === 'insert') {
          const exists = await Product.findOne({ sku: mapped.sku }).lean();
          if (exists) { results.skipped++; continue; }
          await new Product({
            ...mapped,
            dataSource: { type: 'imported', verified: false, importedAt: new Date() }
          }).save();
        } else {
          // upsert 模式
          await Product.findOneAndUpdate(
            { sku: mapped.sku },
            {
              ...mapped,
              'dataSource.type': 'imported',
              'dataSource.importedAt': new Date(),
              updatedAt: new Date()
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
        }
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: i + 2, sku: mapped.sku, reason: err.message });
      }
    }

    res.json({
      success: true,
      message: `导入完成：成功 ${results.success}，跳过 ${results.skipped}，失败 ${results.failed}`,
      data: results
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/products/match-for-project
 * 为项目匹配产品（根据布线结果自动匹配材料）
 */
router.post('/match-for-project', async (req, res) => {
  try {
    const { devices, pipes } = req.body;
    
    const matchedProducts = {
      devices: [],
      pipes: [],
      fittings: [],
      insulation: [],
      totalCost: 0,
      totalRetail: 0
    };

    // 匹配设备
    if (Array.isArray(devices)) {
      for (const device of devices) {
        const match = await Product.findOne({
          category: 'HVAC',
          subcategory: device.type,
          status: 'active'
        }).sort({ 'technicalParams.capacity': 1 });
        
        if (match) {
          matchedProducts.devices.push({
            ...device,
            matchedProduct: {
              sku: match.sku,
              name: match.name,
              price: match.pricing.retail
            }
          });
          matchedProducts.totalRetail += match.pricing.retail;
          matchedProducts.totalCost += match.pricing.cost;
        }
      }
    }

    // 匹配管材
    if (Array.isArray(pipes)) {
      for (const pipe of pipes) {
        const diameter = pipe.diameter;
        const material = pipe.type === 'refrigerant' ? '铜' : 
                        pipe.type === 'condensate' ? 'PVC-U' : 'PPR';
        
        const match = await Product.findOne({
          'pipeParams.diameter': { $gte: diameter - 2, $lte: diameter + 2 },
          'pipeParams.material': material,
          status: 'active'
        });
        
        if (match) {
          const length = pipe.length || 1;
          matchedProducts.pipes.push({
            ...pipe,
            matchedProduct: {
              sku: match.sku,
              name: match.name,
              unitPrice: match.pricing.retail,
              totalPrice: match.pricing.retail * length
            }
          });
          matchedProducts.totalRetail += match.pricing.retail * length;
          matchedProducts.totalCost += match.pricing.cost * length;
        }
      }
    }

    res.json({
      success: true,
      data: matchedProducts
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/products/stats/overview
 * 产品统计概览（后台仪表盘）
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          discontinuedProducts: {
            $sum: { $cond: [{ $eq: ['$status', 'discontinued'] }, 1, 0] }
          },
          avgRetailPrice: { $avg: '$pricing.retail' },
          avgCost: { $avg: '$pricing.cost' },
          unverifiedScraped: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$dataSource.type', 'scraped'] },
                  { $eq: ['$dataSource.verified', false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const categoryStats = await Product.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        byCategory: categoryStats
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

// ==================== 从JSON数据库读取产品 (开发测试用) ====================

const fs = require('fs');
const path = require('path');

// 公开API - 从JSON文件获取产品列表（含成本价）
router.get('/json/all', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../database/products.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const products = JSON.parse(data);

    // 统计包含成本价的产品
    const withCost = products.filter(p => p.cost !== undefined).length;
    const total = products.length;

    res.json({
      success: true,
      data: {
        products,
        stats: {
          total,
          withCost,
          costCoverage: Math.round((withCost / total) * 100) + '%'
        }
      }
    });
  } catch (error) {
    console.error('[Products API] 读取JSON失败:', error);
    return errorResponse(res, error);
  }
});

// 公开API - 获取单个产品详情（含成本价）
router.get('/json/:id', async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../database/products.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const products = JSON.parse(data);

    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '产品不存在'
      });
    }

    // 计算毛利
    const grossProfit = product.price - (product.cost || product.price * 0.6);
    const profitMargin = ((grossProfit / product.price) * 100).toFixed(1);

    res.json({
      success: true,
      data: {
        ...product,
        profit: {
          grossProfit,
          profitMargin: parseFloat(profitMargin)
        }
      }
    });
  } catch (error) {
    console.error('[Products API] 读取产品详情失败:', error);
    return errorResponse(res, error);
  }
});

module.exports = router;
