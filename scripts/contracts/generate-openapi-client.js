#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const SPEC_PATH = path.join(ROOT, 'contracts/openapi/rhautt-nexus-v2.openapi.json');
const CLIENT_PATH = path.join(ROOT, 'packages/generated-client/src/rhauttNexusClient.ts');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function readSpec() {
  return JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
}

function specHash() {
  return crypto.createHash('sha256').update(fs.readFileSync(SPEC_PATH)).digest('hex');
}

function collectOperations(spec) {
  const operations = [];
  for (const [routePath, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem || {})) {
      if (!HTTP_METHODS.has(method)) continue;
      if (!operation.operationId) {
        throw new Error(`${method.toUpperCase()} ${routePath} is missing operationId`);
      }
      operations.push({
        method: method.toUpperCase(),
        path: routePath,
        operationId: operation.operationId,
        binary: Boolean(operation.responses?.['200']?.$ref === '#/components/responses/RysnovaArtifactContentSuccess')
      });
    }
  }
  return operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

function schemaNameFromRef(ref) {
  const prefix = '#/components/schemas/';
  if (typeof ref !== 'string' || !ref.startsWith(prefix)) return 'unknown';
  return ref.slice(prefix.length);
}

function literalType(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'unknown';
}

function propertyKey(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function uniqueTypes(types) {
  return Array.from(new Set(types.filter(Boolean)));
}

function renderSchemaType(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (schema.$ref) return schemaNameFromRef(schema.$ref);
  if (Object.prototype.hasOwnProperty.call(schema, 'const')) return literalType(schema.const);
  if (Array.isArray(schema.enum)) return uniqueTypes(schema.enum.map(literalType)).join(' | ') || 'unknown';
  if (Array.isArray(schema.anyOf)) return uniqueTypes(schema.anyOf.map(renderSchemaType)).join(' | ') || 'unknown';
  if (Array.isArray(schema.oneOf)) return uniqueTypes(schema.oneOf.map(renderSchemaType)).join(' | ') || 'unknown';
  if (Array.isArray(schema.allOf)) return uniqueTypes(schema.allOf.map(renderSchemaType)).join(' & ') || 'unknown';

  if (Array.isArray(schema.type)) {
    return uniqueTypes(schema.type.map(type => renderSchemaType({ ...schema, type }))).join(' | ') || 'unknown';
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `Array<${renderSchemaType(schema.items)}>`;
    case 'object':
    default:
      return renderObjectSchemaType(schema);
  }
}

function renderObjectSchemaType(schema) {
  const properties = schema.properties || {};
  const propertyEntries = Object.entries(properties);
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);

  if (!propertyEntries.length) {
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      return `Record<string, ${renderSchemaType(schema.additionalProperties)}>`;
    }
    return 'Record<string, unknown>';
  }

  const lines = ['{'];
  for (const [name, propertySchema] of propertyEntries) {
    lines.push(`  ${propertyKey(name)}${required.has(name) ? '' : '?'}: ${renderSchemaType(propertySchema)};`);
  }
  lines.push('}');
  const objectType = lines.join('\n');
  return schema.additionalProperties ? `${objectType} & Record<string, unknown>` : objectType;
}

function renderSchemas(spec) {
  const schemas = spec.components?.schemas || {};
  return Object.entries(schemas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, schema]) => `export type ${name} = ${renderSchemaType(schema)};`)
    .join('\n\n');
}

function renderClient(spec, operations) {
  const hash = specHash();
  const schemaTypes = renderSchemas(spec);
  const methods = operations.map(operation => {
    if (operation.binary) {
      return [
        `  async ${operation.operationId}(params: ClientParams = {}): Promise<Response> {`,
        `    return this.requestBlob(${JSON.stringify(operation.method)}, ${JSON.stringify(operation.path)}, params);`,
        '  }'
      ].join('\n');
    }
    return [
      `  async ${operation.operationId}<T = unknown>(params: ClientParams = {}): Promise<ApiEnvelope<T>> {`,
      `    return this.request<T>(${JSON.stringify(operation.method)}, ${JSON.stringify(operation.path)}, params);`,
      '  }'
    ].join('\n');
  }).join('\n\n');

  return [
    '/* eslint-disable */',
    '// Generated by scripts/contracts/generate-openapi-client.js',
    '// Do not edit manually. Update contracts/openapi/rhautt-nexus-v2.openapi.json and rerun npm run contracts:generate.',
    `export const OPENAPI_SHA256 = '${hash}';`,
    `export const OPENAPI_TITLE = ${JSON.stringify(spec.info.title)};`,
    '',
    schemaTypes,
    '',
    'export type ApiEnvelope<T = unknown> = { success: true; data: T } | { success: false; error: string };',
    '',
    'export type ClientParams = {',
    '  path?: Record<string, string | number>;',
    '  query?: Record<string, string | number | boolean | undefined | null>;',
    '  body?: unknown;',
    '  headers?: Record<string, string>;',
    '};',
    '',
    'export type RhauttNexusClientOptions = {',
    '  baseUrl?: string;',
    '  token?: string;',
    '  fetchImpl?: typeof fetch;',
    '};',
    '',
    'export class RhauttNexusClient {',
    '  private baseUrl: string;',
    '  private token?: string;',
    '  private fetchImpl: typeof fetch;',
    '',
    '  constructor(options: RhauttNexusClientOptions = {}) {',
    "    this.baseUrl = options.baseUrl || '';",
    '    this.token = options.token;',
    '    this.fetchImpl = options.fetchImpl || fetch;',
    '  }',
    '',
    '  setToken(token?: string) {',
    '    this.token = token;',
    '  }',
    '',
    '  private buildUrl(routePath: string, params: ClientParams) {',
    '    let url = routePath;',
    '    for (const [key, value] of Object.entries(params.path || {})) {',
    "      url = url.replace(`{${key}}`, encodeURIComponent(String(value)));",
    '    }',
    '    const query = new URLSearchParams();',
    '    for (const [key, value] of Object.entries(params.query || {})) {',
    '      if (value === undefined || value === null) continue;',
    '      query.set(key, String(value));',
    '    }',
    '    const suffix = query.toString();',
    '    return `${this.baseUrl}${url}${suffix ? `?${suffix}` : ``}`;',
    '  }',
    '',
    '  private async request<T>(method: string, routePath: string, params: ClientParams = {}): Promise<ApiEnvelope<T>> {',
    '    const headers: Record<string, string> = {',
    "      'Content-Type': 'application/json',",
    '      ...(params.headers || {})',
    '    };',
    '    if (this.token) headers.Authorization = `Bearer ${this.token}`;',
    '    const response = await this.fetchImpl(this.buildUrl(routePath, params), {',
    '      method,',
    '      headers,',
    "      body: params.body === undefined || method === 'GET' ? undefined : JSON.stringify(params.body)",
    '    });',
    '    const payload = await response.json().catch(() => ({ success: false, error: response.statusText }));',
    '    return payload as ApiEnvelope<T>;',
    '  }',
    '',
    '  private async requestBlob(method: string, routePath: string, params: ClientParams = {}): Promise<Response> {',
    '    const headers: Record<string, string> = {',
    '      ...(params.headers || {})',
    '    };',
    '    if (this.token) headers.Authorization = `Bearer ${this.token}`;',
    '    return this.fetchImpl(this.buildUrl(routePath, params), {',
    '      method,',
    '      headers,',
    "      body: params.body === undefined || method === 'GET' ? undefined : JSON.stringify(params.body)",
    '    });',
    '  }',
    '',
    methods,
    '}',
    '',
    'export function createRhauttNexusClient(options: RhauttNexusClientOptions = {}) {',
    '  return new RhauttNexusClient(options);',
    '}',
    ''
  ].join('\n');
}

function main() {
  const spec = readSpec();
  const operations = collectOperations(spec);
  fs.mkdirSync(path.dirname(CLIENT_PATH), { recursive: true });
  fs.writeFileSync(CLIENT_PATH, renderClient(spec, operations));
  console.log(`Generated client: ${path.relative(ROOT, CLIENT_PATH)} (${operations.length} operations)`);
}

if (require.main === module) main();

module.exports = { collectOperations, specHash };
