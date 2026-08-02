const express = require('express');
const path = require('path');

const aliases = [
  ['/pain-diagnosis', { redirectTo: '/index-ready.html#contact' }],
  ['/rysnova', { redirectTo: '/index-ready.html' }],
  ['/rysnova-ai', { redirectTo: '/index-ready.html#contact' }],
  ['/rysnova-diagnosis', { redirectTo: '/index-ready.html#contact' }],
  ['/quality-dashboard', { redirectTo: '/index.html' }],
  ['/solution-summary', { redirectTo: '/index-ready.html#cases' }],
  ['/voice-interaction', { redirectTo: '/index-ready.html#contact' }],
  ['/sales', { redirectTo: '/login.html' }],
  ['/solution-view', { redirectTo: '/index-ready.html#cases' }],
  ['/admin', { redirectTo: '/login.html' }],
  ['/admin.html', { redirectTo: '/login.html' }],
  ['/store-admin', { redirectTo: '/login.html' }],
  ['/hq-admin', { redirectTo: '/login.html' }],
  ['/customers', { redirectTo: '/login.html' }],
  ['/solutions', { redirectTo: '/index-ready.html#capabilities' }],
  ['/quotations', { redirectTo: '/login.html' }],
  ['/products', { redirectTo: '/products.html' }],
  ['/analytics', { redirectTo: '/index.html' }],
  ['/settings', { redirectTo: '/login.html' }],
  ['/notifications', { redirectTo: '/login.html' }],
  ['/messages', { redirectTo: '/login.html' }],
  ['/help', { redirectTo: '/index.html' }],
  ['/login', { redirectTo: '/index.html' }],
  ['/mobile', { redirectTo: '/index-ready.html' }]
];

function createPageAliasesRouter(publicDir = path.join(__dirname, '..', '..', 'archive', 'legacy-ui', 'public')) {
  const router = express.Router();

  for (const [routePath, target] of aliases) {
    router.get(routePath, (req, res) => {
      if (typeof target === 'object' && target.redirectTo) {
        return res.redirect(302, target.redirectTo);
      }
      res.sendFile(path.join(publicDir, target));
    });
  }

  return router;
}

module.exports = createPageAliasesRouter;
module.exports.aliases = aliases;
