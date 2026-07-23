/**
 * 统一错误响应工具 - 防止敏感信息泄漏
 * 2026-04-22 P1 清理 175 处 res.json({error: e.message}) 代码味
 */

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * 将异常转为对外安全的错误响应对象
 * 生产环境隐藏 stack 和 内部细节；开发环境透传以便调试
 */
function sanitize(err, fallbackMessage = '服务暂时不可用') {
  const errId = 'ERR-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  // 始终在服务端日志打印完整堆栈
  console.error('[' + errId + '] ' + (err && (err.stack || err.message || err)));

  if (isProduction()) {
    return { success: false, error: fallbackMessage, errorId: errId };
  }
  // 开发环境带上 message 便于调试
  return { success: false, error: (err && err.message) || fallbackMessage, errorId: errId };
}

/**
 * Express res 的便捷封装
 * 用法: } catch (e) { return errorResponse(res, e); }
 */
function errorResponse(res, err, status = 500, fallbackMessage) {
  return res.status(status).json(sanitize(err, fallbackMessage));
}

/**
 * 异步路由包装器 - 自动捕获 async 错误并安全返回
 * 用法: app.get('/x', asyncRoute(async (req, res) => { ... }))
 */
function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(e => errorResponse(res, e));
  };
}

module.exports = { sanitize, errorResponse, asyncRoute };
