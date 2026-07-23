function requireTenantScope(req, res, next) {
  const user = req.user || {};

  // 只信任 JWT 解析后的 user 对象，不允许 header fallback（防止租户隔离绕过）
  const tenantId = user.tenantId;

  if (!tenantId) {
    return res.status(403).json({ success: false, error: '缺少租户上下文' });
  }

  req.scope = {
    tenantId,
    dealerId: user.dealerId || null,
    storeId: user.storeId || null,
    customerId: user.customerId || null,
    userId: user.userId || user.id || null,
    role: user.role || null
  };

  next();
}

function requireDealerScope(req, res, next) {
  if (!req.scope || !req.scope.dealerId) {
    return res.status(403).json({
      success: false,
      error: '缺少经销商上下文'
    });
  }
  next();
}

function canAccessScope(req, target = {}) {
  const scope = req.scope || {};
  if (!scope.tenantId) return false;
  if (String(target.tenantId) !== String(scope.tenantId)) return false;

  if (scope.role === 'platform_admin' || scope.role === 'hq_admin') return true;
  if (target.dealerId && scope.dealerId && String(target.dealerId) !== String(scope.dealerId)) return false;
  if (target.storeId && scope.storeId && String(target.storeId) !== String(scope.storeId)) return false;
  return true;
}

module.exports = {
  requireTenantScope,
  requireDealerScope,
  canAccessScope
};
