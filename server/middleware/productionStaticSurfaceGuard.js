const path = require('path');
const fs = require('fs');
const {
  redirectLegacyDesignerToViewer
} = require('../utils/legacyDesignerRedirect');

const ACTIVE_HTML_PATHS = new Set([
  '/index.html',
  '/index-ready.html',
  '/privacy.html',
  '/consent.html'
]);
const LEGACY_COMPAT_HTML_REDIRECTS = new Set([
  '/rysnova-bim-designer.html'
]);

function normalizePath(reqPath = '') {
  const clean = reqPath.split('?')[0].split('#')[0] || '/';
  const decoded = decodeURIComponent(clean);
  return path.posix.normalize(decoded.startsWith('/') ? decoded : `/${decoded}`);
}

function createLegacySurfaceClassifier(options = {}) {
  const manifestPath = options.manifestPath || path.join(__dirname, '..', '..', 'archive', 'legacy-ui', 'public', 'legacy-surface-manifest.json');
  const surfaces = new Map();

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const [bucket, files] of Object.entries(manifest.surfaces || {})) {
      for (const file of files || []) {
        surfaces.set(`/${path.basename(file)}`, bucket);
      }
    }
  } catch {
    // The guard still blocks unknown non-active HTML; classification is best-effort.
  }

  return function classifySurface(reqPath) {
    if (ACTIVE_HTML_PATHS.has(reqPath)) {
      return { active: true, bucket: 'active' };
    }
    return {
      active: false,
      bucket: surfaces.get(reqPath) || 'unclassified'
    };
  };
}

function createProductionStaticSurfaceGuard(options = {}) {
  const enabled = options.enabled !== false && process.env.ENABLE_LEGACY_HTML !== 'true';
  const fallback = options.fallback || '/index.html';
  const classifySurface = options.classifySurface || createLegacySurfaceClassifier(options);

  return function productionStaticSurfaceGuard(req, res, next) {
    if (!enabled || req.method !== 'GET') return next();

    const reqPath = normalizePath(req.path || req.url || '');
    if (!reqPath.endsWith('.html')) return next();
    if (LEGACY_COMPAT_HTML_REDIRECTS.has(reqPath)) return redirectLegacyDesignerToViewer(req, res);
    if (ACTIVE_HTML_PATHS.has(reqPath)) return next();
    const surface = classifySurface(reqPath);
    const redirectTarget = `${fallback}?archived=${encodeURIComponent(reqPath)}&surfaceBucket=${encodeURIComponent(surface.bucket)}`;

    if (req.accepts('html')) {
      return res.redirect(302, redirectTarget);
    }

    return res.status(404).json({
      success: false,
      error: 'HTML surface is not part of the active production navigation',
      path: reqPath,
      active: false,
      surfaceBucket: surface.bucket
    });
  };
}

module.exports = {
  ACTIVE_HTML_PATHS,
  LEGACY_COMPAT_HTML_REDIRECTS,
  createLegacySurfaceClassifier,
  createProductionStaticSurfaceGuard
};
