const jwt = require('jsonwebtoken');

function resolveJwtSecret(env = process.env) {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is required in production');
    process.exit(1);
  }
  return 'rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION';
}

function createAuthRuntime({ jwtSecret }) {
  const roleGroups = [
    ['platform_admin', 'rheem_official', 'rheem_super'],
    ['hq_admin', 'rheem_admin'],
    ['dealer_admin', 'store_admin'],
    ['store_manager', 'store_admin'],
    ['customer', 'end_user']
  ];

  const roleMatches = (actualRole, allowedRole) => {
    if (actualRole === allowedRole) return true;
    return roleGroups.some(group => group.includes(actualRole) && group.includes(allowedRole));
  };

  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: '未提供访问令牌' });
    }

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) return res.status(403).json({ success: false, error: '令牌无效' });
      req.user = user;
      return next();
    });
  };

  const checkRole = roles => (req, res, next) => {
    if (!req.user || !roles.some(role => roleMatches(req.user.role, role) || roleMatches(req.user.legacyRole, role))) {
      return res.status(403).json({ success: false, error: '权限不足' });
    }
    return next();
  };

  return {
    authenticateToken,
    checkRole
  };
}

module.exports = {
  createAuthRuntime,
  resolveJwtSecret
};
