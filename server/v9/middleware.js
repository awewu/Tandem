/**
 * V9 Middleware - 集中式中间件配置
 * 替代 server-production.js 中分散的 app.use() 中间件
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

function setupMiddleware(app) {
  // 安全头
  try {
    const helmet = require('helmet');
    app.use(helmet({ contentSecurityPolicy: false }));
  } catch (e) {
    console.warn('[Middleware] helmet不可用, 跳过');
  }

  // CORS
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));

  // Body解析
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 请求日志
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`🐌 [Slow] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      }
    });
    next();
  });

  // 静态文件
  app.use(express.static(path.join(__dirname, '../../public'), { maxAge: '1d' }));

  // i18n 语言检测中间件
  app.use((req, res, next) => {
    const lang = req.headers['accept-language']?.split(',')[0]?.trim() || 'zh-CN';
    req.locale = lang;
    req.unitSystem = ['en-US', 'en-GB'].includes(lang) ? 'imperial' : 'metric';
    next();
  });

  // 请求ID
  app.use((req, res, next) => {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  console.log('✅ [Middleware] V9中间件栈配置完成');
}

module.exports = { setupMiddleware };
