const jwt = require('jsonwebtoken');

const objectIdLike = /^[0-9a-fA-F]{24}$/;
const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidId(value) {
  const s = String(value || '');
  return objectIdLike.test(s) || uuidLike.test(s);
}

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION';
}

function getCookieToken(req) {
  try {
    const cookieHeader = req.headers.cookie || '';
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/(?:^|;\s*)nx_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function authenticateV2(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : getCookieToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: '缺少访问令牌'
    });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret());
    if (!isValidScope(req.user)) {
      return res.status(403).json({
        success: false,
        error: '访问令牌租户范围无效'
      });
    }
    return next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: '访问令牌无效'
    });
  }
}

function isValidScope(user = {}) {
  if (!isValidId(user.userId)) return false;
  if (!isValidId(user.tenantId)) return false;
  if (user.dealerId && !isValidId(user.dealerId)) return false;
  if (user.storeId && !isValidId(user.storeId)) return false;
  if (user.customerId && !isValidId(user.customerId)) return false;
  return true;
}

module.exports = {
  authenticateV2,
  getJwtSecret,
  isValidScope
};
