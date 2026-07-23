const fs = require('fs');
const path = require('path');
const { normalizeRoutePath } = require('./routeMountAnalysis');

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function normalizeApiPath(value, options = {}) {
  if (!value) return null;
  let p = value.trim();
  if (/^(http|ws|mailto|tel|data):/.test(p)) return null;
  if (p.startsWith('../data/') || p.startsWith('./') || p.startsWith('../')) return null;
  if (/^\/[^?]+\.(js|css|html|png|jpg|jpeg|webp|svg|ico|map)(\?.*)?$/i.test(p)) return null;

  p = p.replace(/\$\{[^}]+\}/g, ':dynamic');
  if (!p.startsWith('/')) p = '/' + p;

  const basePath = options.basePath ? normalizeRoutePath(options.basePath) : '';
  if (basePath && !p.startsWith(basePath) && !p.startsWith('/api') && !p.startsWith('/rysnova-bim-deliverables')) {
    p = basePath.replace(/\/$/, '') + p;
  } else if (!p.startsWith('/api') && !p.startsWith('/rysnova-bim-deliverables')) {
    p = '/api' + p;
  }

  p = p.replace(/\?.*$/, '');
  return normalizeRoutePath(p);
}

function detectAxiosBasePath(content, apiName = 'api') {
  const createRegex = new RegExp(
    `\\b(?:const|let|var)\\s+${apiName}\\s*=\\s*axios\\.create\\s*\\(\\s*\\{[\\s\\S]*?\\bbaseURL\\s*:\\s*['"\`]([^'"\`]+)['"\`]`,
    'm'
  );
  const match = createRegex.exec(content);
  return match ? normalizeRoutePath(match[1]) : '';
}

function findSiblingServiceBasePath(file, importPath) {
  if (!importPath || !importPath.startsWith('.')) return '';
  const base = path.resolve(path.dirname(file), importPath);
  const candidates = [base, base + '.js', base + '.jsx', base + '.ts', base + '.tsx', path.join(base, 'index.js')];
  const target = candidates.find(candidate => fs.existsSync(candidate));
  return target ? detectAxiosBasePath(read(target)) : '';
}

function detectImportedApiBasePath(file, content, apiName = 'api') {
  const importRegex = new RegExp(`\\bimport\\s+${apiName}\\s+from\\s+['"\`]([^'"\`]+)['"\`]`, 'm');
  const match = importRegex.exec(content);
  return match ? findSiblingServiceBasePath(file, match[1]) : '';
}

function getApiClientBasePath(file, content, apiName = 'api') {
  return detectAxiosBasePath(content, apiName) || detectImportedApiBasePath(file, content, apiName);
}

function extractApiCalls(file, options = {}) {
  const content = read(file);
  const calls = [];
  const apiClientBasePath = getApiClientBasePath(file, content, options.apiClientName || 'api');
  const patterns = [
    { kind: 'fetch', regex: /fetch\s*\(\s*['"`]([^'"`]+)['"`]/g },
    { kind: 'axios', regex: /axios\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g },
    { kind: 'api', regex: /\bapi\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g }
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(content))) {
      const raw = match[2] || match[1];
      const pathValue = normalizeApiPath(raw, { basePath: pattern.kind === 'api' ? apiClientBasePath : '' });
      if (!pathValue) continue;
      calls.push({
        file: options.relativeFile ? options.relativeFile(file) : file,
        kind: pattern.kind,
        method: pattern.kind === 'fetch' ? 'UNKNOWN' : match[1].toUpperCase(),
        raw,
        path: pathValue,
        apiClientBasePath,
        dynamicPrefix: /\/$/.test(raw) || /\$\{/.test(raw),
        line: lineForIndex(content, match.index)
      });
    }
  }

  return calls;
}

module.exports = { detectAxiosBasePath, extractApiCalls, getApiClientBasePath, normalizeApiPath };
