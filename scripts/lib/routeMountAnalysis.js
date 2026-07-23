const fs = require('fs');
const path = require('path');

function rel(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function normalizeRoutePath(routePath) {
  if (!routePath) return '/';
  let p = routePath.trim().replace(/\/+/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/$/, '');
  return p;
}

function joinRoute(prefix, routePath) {
  if (!prefix || prefix === '/') return normalizeRoutePath(routePath);
  if (!routePath || routePath === '/') return normalizeRoutePath(prefix);
  return normalizeRoutePath(prefix.replace(/\/$/, '') + '/' + routePath.replace(/^\//, ''));
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function resolveRequirePath(fromFile, requestPath) {
  if (!requestPath || !requestPath.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), requestPath);
  const candidates = [base, base + '.js', base + '.cjs', base + '.mjs', path.join(base, 'index.js')];
  return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

function collectRequireAliases(file, content) {
  const aliases = new Map();
  const directRequireRegex = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const destructuredRequireRegex = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let match;

  while ((match = directRequireRegex.exec(content))) {
    const resolved = resolveRequirePath(file, match[2]);
    if (resolved) aliases.set(match[1], resolved);
  }
  while ((match = destructuredRequireRegex.exec(content))) {
    const resolved = resolveRequirePath(file, match[2]);
    if (!resolved) continue;
    for (const rawToken of match[1].split(',')) {
      const token = rawToken.trim();
      if (!token) continue;
      const alias = token.includes(':') ? token.split(':').pop().trim() : token;
      if (/^[A-Za-z_$][\w$]*$/.test(alias)) aliases.set(alias, resolved);
    }
  }
  return aliases;
}

function addMount({ root, sourceFile, targetFile, parentPrefix, mountPrefix, line, byFile, mounts, queue }) {
  const prefix = joinRoute(parentPrefix, mountPrefix || '/');
  const target = rel(root, targetFile);
  const existing = byFile.get(target) || [];
  if (!existing.includes(prefix)) {
    existing.push(prefix);
    byFile.set(target, existing);
  }
  mounts.push({ file: rel(root, sourceFile), target, prefix, line });
  queue.push({ file: targetFile, prefix });
}

function collectMountsFromFile({ root, file, parentPrefix, byFile, mounts, queue }) {
  const content = read(file);
  if (!content) return;
  const aliases = collectRequireAliases(file, content);
  let match;

  const inlineWithPrefixRegex = /\b(?:app|router)\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\s*\([^)]*\))?/g;
  while ((match = inlineWithPrefixRegex.exec(content))) {
    const targetFile = resolveRequirePath(file, match[2]);
    if (targetFile) addMount({ root, sourceFile: file, targetFile, parentPrefix, mountPrefix: match[1], line: lineForIndex(content, match.index), byFile, mounts, queue });
  }
  const inlineWithoutPrefixRegex = /\b(?:app|router)\.use\s*\(\s*require\(\s*['"`]([^'"`]+)['"`]\s*\)(?:\s*\([^)]*\))?/g;
  while ((match = inlineWithoutPrefixRegex.exec(content))) {
    const targetFile = resolveRequirePath(file, match[1]);
    if (targetFile) addMount({ root, sourceFile: file, targetFile, parentPrefix, mountPrefix: '/', line: lineForIndex(content, match.index), byFile, mounts, queue });
  }
  const aliasWithPrefixRegex = /\b(?:app|router)\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z_$][\w$]*)\b/g;
  while ((match = aliasWithPrefixRegex.exec(content))) {
    const targetFile = aliases.get(match[2]);
    if (targetFile) addMount({ root, sourceFile: file, targetFile, parentPrefix, mountPrefix: match[1], line: lineForIndex(content, match.index), byFile, mounts, queue });
  }
}

function collectMountsFromProductionCatalog({ root, byFile, mounts, queue, includeProductionCandidates }) {
  const catalogFile = path.join(root, 'server/modules/productionRouteCatalog.js');
  if (!fs.existsSync(catalogFile)) return;
  let catalogModule;
  try {
    catalogModule = require(catalogFile);
  } catch {
    return;
  }
  const getMetadata = catalogModule.getProductionRouteCatalogMountMetadata;
  if (typeof getMetadata !== 'function') return;
  for (const entry of getMetadata()) {
    if (!includeProductionCandidates && entry.status === 'production-candidate') continue;
    const targetFile = resolveRequirePath(catalogFile, entry.modulePath);
    if (targetFile) addMount({ root, sourceFile: catalogFile, targetFile, parentPrefix: '/', mountPrefix: entry.prefix || '/', line: 1, byFile, mounts, queue });
  }
}

function getProductionMountPrefixes({ root, entryFile, registrarFiles = [], includeProductionCandidates = false }) {
  const defaultRegistrar = path.join(root, 'server/modules/productionRouteRegistrar.js');
  const initialFiles = [entryFile, fs.existsSync(defaultRegistrar) ? defaultRegistrar : null, ...registrarFiles].filter(Boolean);
  const byFile = new Map();
  const mounts = [];
  const scanned = new Set();
  const queue = initialFiles.map(file => ({ file, prefix: '/' }));
  collectMountsFromProductionCatalog({ root, byFile, mounts, queue, includeProductionCandidates });
  while (queue.length) {
    const current = queue.shift();
    const key = `${rel(root, current.file)}@${current.prefix}`;
    if (scanned.has(key)) continue;
    scanned.add(key);
    collectMountsFromFile({ root, file: current.file, parentPrefix: current.prefix, byFile, mounts, queue });
  }
  return { byFile, mounts, scannedFiles: [...scanned].map(item => item.split('@')[0]) };
}

module.exports = { getProductionMountPrefixes, joinRoute, normalizeRoutePath, resolveRequirePath };
