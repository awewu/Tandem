/**
 * Apply/check the ApiLog wrapper on every App Router API handler.
 *
 * Usage:
 *   node scripts/business-log-routes.mjs apply
 *   node scripts/business-log-routes.mjs check
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, 'app', 'api');
const MODE = process.argv[2] ?? 'check';
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const IMPORT = "import { withApiLog } from '@/lib/api-log/with-api-log';";

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.name === 'route.ts' ? [full] : [];
  });
}

function hasExport(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function removeExportEdit(node, sourceFile) {
  const modifier = node.modifiers?.find((item) => item.kind === ts.SyntaxKind.ExportKeyword);
  if (!modifier) throw new Error('export modifier not found');
  let end = modifier.end;
  while (end < sourceFile.text.length && /\s/.test(sourceFile.text[end])) end += 1;
  return { start: modifier.getStart(sourceFile), end, text: '' };
}

function routeTemplate(file) {
  const relative = path.relative(path.join(ROOT, 'app'), path.dirname(file)).replaceAll(path.sep, '/');
  return `/${relative}`;
}

function wrapperText(method, handlerName, route) {
  return `\n\nexport const ${method} = withApiLog(${handlerName}, { route: '${route}' });`;
}

function parse(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function applyFile(file) {
  const originalText = fs.readFileSync(file, 'utf8');
  const text = originalText
    .replaceAll("@/lib/business-log/with-business-log-edge", "@/lib/api-log/with-api-log-edge")
    .replaceAll("@/lib/business-log/with-business-log", "@/lib/api-log/with-api-log")
    .replaceAll('withBusinessLog', 'withApiLog')
    .replaceAll('BusinessHandler', 'ApiHandler')
    .replaceAll('business-log-exempt', 'api-log-exempt');
  if (text.includes('api-log-exempt')) {
    if (text !== originalText) fs.writeFileSync(file, text, 'utf8');
    return { changed: text !== originalText, handlers: 0, exempt: true };
  }
  const source = parse(file, text);
  const route = routeTemplate(file);
  const edits = [];
  let handlers = 0;

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && hasExport(statement) && statement.name && METHODS.has(statement.name.text)) {
      const method = statement.name.text;
      const handlerName = `${method}ApiHandler`;
      handlers += 1;
      edits.push(removeExportEdit(statement, source));
      edits.push({ start: statement.name.getStart(source), end: statement.name.end, text: handlerName });
      edits.push({ start: statement.end, end: statement.end, text: wrapperText(method, handlerName, route) });
      continue;
    }

    if (ts.isVariableStatement(statement) && hasExport(statement)) {
      const methodDeclarations = statement.declarationList.declarations.filter(
        (declaration) => ts.isIdentifier(declaration.name) && METHODS.has(declaration.name.text),
      );
      if (methodDeclarations.length === 0) continue;
      if (statement.declarationList.declarations.length !== 1 || methodDeclarations.length !== 1) {
        throw new Error(`${path.relative(ROOT, file)}: handler export must use one declaration per statement`);
      }
      const declaration = methodDeclarations[0];
      const method = declaration.name.text;
      if (declaration.initializer && ts.isCallExpression(declaration.initializer)
        && declaration.initializer.expression.getText(source) === 'withApiLog') {
        continue;
      }
      const handlerName = `${method}ApiHandler`;
      handlers += 1;
      edits.push(removeExportEdit(statement, source));
      edits.push({ start: declaration.name.getStart(source), end: declaration.name.end, text: handlerName });
      edits.push({ start: statement.end, end: statement.end, text: wrapperText(method, handlerName, route) });
    }
  }

  if (handlers === 0) {
    if (text !== originalText) fs.writeFileSync(file, text, 'utf8');
    return { changed: text !== originalText, handlers: 0, exempt: false };
  }
  if (!text.includes("@/lib/api-log/with-api-log")) {
    const imports = source.statements.filter(ts.isImportDeclaration);
    const position = imports.at(-1)?.end ?? 0;
    edits.push({ start: position, end: position, text: `${position ? '\n' : ''}${IMPORT}` });
  }

  let output = text;
  for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  fs.writeFileSync(file, output, 'utf8');
  return { changed: true, handlers, exempt: false };
}

function checkFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('api-log-exempt')) return { covered: 0, exempt: 1, errors: [] };
  const source = parse(file, text);
  const errors = [];
  let covered = 0;
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && hasExport(statement) && statement.name && METHODS.has(statement.name.text)) {
      errors.push(`${path.relative(ROOT, file)}: ${statement.name.text} is not wrapped`);
    }
    if (!ts.isVariableStatement(statement) || !hasExport(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !METHODS.has(declaration.name.text)) continue;
      const wrapped = declaration.initializer && ts.isCallExpression(declaration.initializer)
        && declaration.initializer.expression.getText(source) === 'withApiLog';
      if (wrapped) covered += 1;
      else errors.push(`${path.relative(ROOT, file)}: ${declaration.name.text} is not wrapped`);
    }
  }
  return { covered, exempt: 0, errors };
}

const files = walk(API_ROOT);
if (MODE === 'apply') {
  let changedFiles = 0;
  let wrappedHandlers = 0;
  for (const file of files) {
    const result = applyFile(file);
    if (result.changed) changedFiles += 1;
    wrappedHandlers += result.handlers;
  }
  console.log(`ApiLog wrapper applied: ${wrappedHandlers} new handlers; ${changedFiles} files changed.`);
} else if (MODE === 'check') {
  const results = files.map(checkFile);
  const errors = results.flatMap((result) => result.errors);
  const covered = results.reduce((sum, result) => sum + result.covered, 0);
  const exempt = results.reduce((sum, result) => sum + result.exempt, 0);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`ApiLog coverage OK: ${covered} handlers covered, ${exempt} internal route exempt.`);
  }
} else {
  console.error(`Unknown mode: ${MODE}. Use apply or check.`);
  process.exitCode = 2;
}
