const jwt = require('jsonwebtoken')
const User = require('../models/User')
// JWT 密钥 - 生产环境强制要求设置，否则抛出错误
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('生产环境必须设置 JWT_SECRET 环境变量');
}
// 仅在开发环境使用默认密钥
const _JWT_SECRET = JWT_SECRET || 'rheem-platform-secret-key-dev-only';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '访问被拒绝，未提供认证token'
      })
    }

    const decoded = jwt.verify(token, _JWT_SECRET)
    
    // 获取用户信息
    const user = await User.findById(decoded.userId).select('-password')
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      })
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: '用户账号已被禁用'
      })
    }

    // 检查是否被锁定
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: '账号已被锁定，请稍后再试'
      })
    }

    req.user = {
      userId: user._id,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions
    }

    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '无效的token'
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'token已过期'
      })
    }
    
    console.error('认证中间件错误:', error)
    res.status(500).json({
      success: false,
      message: '服务器错误'
    })
  }
}

// 权限检查中间件
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      })
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      })
    }

    next()
  }
}

module.exports = { auth, authorize }
