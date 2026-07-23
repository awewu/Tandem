const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

function serializeArtifactContent(content) {
  if (Buffer.isBuffer(content)) return content;
  if (typeof content === 'string') return Buffer.from(content, 'utf8');
  return Buffer.from(JSON.stringify(content ?? {}), 'utf8');
}

function contentHashFromBytes(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function normalizeObjectKey(objectKey) {
  const key = String(objectKey || '').trim();
  if (!key) {
    const err = new Error('objectKey is required for artifact storage');
    err.status = 400;
    throw err;
  }
  const normalized = key.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('~')) {
    const err = new Error('objectKey must be a tenant-scoped relative key');
    err.status = 400;
    throw err;
  }
  return normalized;
}

function encodeS3PathPart(value) {
  return String(value)
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}

function proofCapabilities(adapter) {
  if (adapter && typeof adapter.proofCapabilities === 'function') return adapter.proofCapabilities();
  return {
    adapterType: 'unknown',
    externalRoundTrip: false,
    finalLaunchEligible: false
  };
}

class MemoryArtifactStorageAdapter {
  constructor(options = {}) {
    this.provider = options.provider || 'memory-object-storage';
    this.objects = options.objects || new Map();
  }

  async putObject({ objectKey, content, contentType = 'application/json', metadata = {} }) {
    const key = normalizeObjectKey(objectKey);
    const bytes = serializeArtifactContent(content);
    const record = {
      objectKey: key,
      bytes,
      contentType,
      metadata,
      contentHash: contentHashFromBytes(bytes),
      sizeBytes: bytes.length,
      provider: this.provider,
      uri: `memory://${key}`,
      updatedAt: new Date().toISOString()
    };
    this.objects.set(key, record);
    return this.toSummary(record);
  }

  async getObject(objectKey) {
    const key = normalizeObjectKey(objectKey);
    const record = this.objects.get(key);
    if (!record) {
      const err = new Error(`artifact object not found: ${key}`);
      err.status = 404;
      throw err;
    }
    return { ...record, bytes: Buffer.from(record.bytes) };
  }

  async verifyObject(objectKey, expectedContentHash) {
    try {
      const record = await this.getObject(objectKey);
      const actualContentHash = contentHashFromBytes(record.bytes);
      return {
        objectKey: record.objectKey,
        provider: record.provider,
        exists: true,
        passed: actualContentHash === expectedContentHash,
        expectedContentHash,
        actualContentHash,
        sizeBytes: record.bytes.length,
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error.status !== 404) throw error;
      return {
        objectKey: normalizeObjectKey(objectKey),
        provider: this.provider,
        exists: false,
        passed: false,
        expectedContentHash,
        actualContentHash: null,
        sizeBytes: 0,
        checkedAt: new Date().toISOString()
      };
    }
  }

  proofCapabilities() {
    return {
      provider: this.provider,
      adapterType: 'memory',
      externalRoundTrip: false,
      finalLaunchEligible: false
    };
  }

  toSummary(record) {
    return {
      objectKey: record.objectKey,
      provider: record.provider,
      contentHash: record.contentHash,
      sizeBytes: record.sizeBytes,
      contentType: record.contentType,
      uri: record.uri,
      updatedAt: record.updatedAt
    };
  }
}

class LocalArtifactStorageAdapter extends MemoryArtifactStorageAdapter {
  constructor(options = {}) {
    super({ provider: options.provider || 'local-object-storage' });
    this.rootDir = options.rootDir || process.env.OBJECT_STORAGE_LOCAL_DIR || path.join(process.cwd(), 'storage', 'rysnova-bim-artifacts');
  }

  objectPath(objectKey) {
    const key = normalizeObjectKey(objectKey);
    const fullPath = path.join(this.rootDir, key);
    const relative = path.relative(this.rootDir, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      const err = new Error('objectKey escapes artifact storage root');
      err.status = 400;
      throw err;
    }
    return { key, fullPath };
  }

  async putObject({ objectKey, content, contentType = 'application/json', metadata = {} }) {
    const { key, fullPath } = this.objectPath(objectKey);
    const bytes = serializeArtifactContent(content);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, bytes);
    const summary = {
      objectKey: key,
      provider: this.provider,
      contentHash: contentHashFromBytes(bytes),
      sizeBytes: bytes.length,
      contentType,
      uri: `local://${key}`,
      updatedAt: new Date().toISOString()
    };
    await fs.promises.writeFile(`${fullPath}.meta.json`, JSON.stringify({ ...summary, metadata }, null, 2));
    return summary;
  }

  async getObject(objectKey) {
    const { key, fullPath } = this.objectPath(objectKey);
    try {
      const bytes = await fs.promises.readFile(fullPath);
      return {
        objectKey: key,
        bytes,
        provider: this.provider,
        contentHash: contentHashFromBytes(bytes),
        sizeBytes: bytes.length,
        uri: `local://${key}`
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const err = new Error(`artifact object not found: ${key}`);
      err.status = 404;
      throw err;
    }
  }

  proofCapabilities() {
    return {
      provider: this.provider,
      adapterType: 'local-filesystem',
      externalRoundTrip: false,
      finalLaunchEligible: false
    };
  }
}

class S3CompatibleArtifactStorageAdapter {
  constructor(options = {}) {
    this.provider = options.provider || 's3-compatible-object-storage';
    this.endpoint = options.endpoint || process.env.OBJECT_STORAGE_ENDPOINT;
    this.bucket = options.bucket || process.env.OBJECT_STORAGE_BUCKET;
    this.region = options.region || process.env.OBJECT_STORAGE_REGION || 'us-east-1';
    this.accessKeyId = options.accessKeyId || process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
    this.secretAccessKey = options.secretAccessKey || process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;
    this.sessionToken = options.sessionToken || process.env.OBJECT_STORAGE_SESSION_TOKEN;
    this.forcePathStyle = options.forcePathStyle !== false;

    for (const [field, value] of Object.entries({
      endpoint: this.endpoint,
      bucket: this.bucket,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey
    })) {
      if (!value) {
        const err = new Error(`S3-compatible artifact storage requires ${field}`);
        err.status = 400;
        throw err;
      }
    }
  }

  proofCapabilities() {
    return {
      provider: this.provider,
      adapterType: 's3-compatible',
      externalRoundTrip: true,
      finalLaunchEligible: true
    };
  }

  uriFor(objectKey) {
    return `${this.provider}://${this.bucket}/${normalizeObjectKey(objectKey)}`;
  }

  buildUrl(objectKey) {
    const key = normalizeObjectKey(objectKey);
    const endpoint = new URL(this.endpoint);
    const basePath = endpoint.pathname.replace(/\/+$/, '');
    const encodedBucket = encodeURIComponent(this.bucket);
    const encodedKey = encodeS3PathPart(key);

    if (this.forcePathStyle) {
      endpoint.pathname = `${basePath}/${encodedBucket}/${encodedKey}`.replace(/\/{2,}/g, '/');
    } else {
      endpoint.hostname = `${this.bucket}.${endpoint.hostname}`;
      endpoint.pathname = `${basePath}/${encodedKey}`.replace(/\/{2,}/g, '/');
    }
    endpoint.search = '';
    return { url: endpoint, key };
  }

  signingKey(dateStamp) {
    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
  }

  signedRequestOptions({ method, objectKey, bytes = Buffer.alloc(0), contentType }) {
    const { url, key } = this.buildUrl(objectKey);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256Hex(bytes);
    const headers = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    };
    if (contentType) headers['content-type'] = contentType;
    if (this.sessionToken) headers['x-amz-security-token'] = this.sessionToken;

    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames
      .map(name => `${name}:${String(headers[name]).trim()}\n`)
      .join('');
    const signedHeaders = sortedHeaderNames.join(';');
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');
    const signature = hmac(this.signingKey(dateStamp), stringToSign, 'hex');

    headers.authorization = [
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ');

    return {
      key,
      requestOptions: {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        method,
        path: `${url.pathname}${url.search}`,
        headers
      }
    };
  }

  request({ method, objectKey, bytes = Buffer.alloc(0), contentType, expectedStatuses = [200] }) {
    const { key, requestOptions } = this.signedRequestOptions({ method, objectKey, bytes, contentType });
    const client = requestOptions.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(requestOptions, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const responseBytes = Buffer.concat(chunks);
          if (!expectedStatuses.includes(res.statusCode)) {
            const err = new Error(`artifact object storage ${method} ${key} failed with HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.body = responseBytes.toString('utf8');
            reject(err);
            return;
          }
          resolve({
            key,
            bytes: responseBytes,
            statusCode: res.statusCode,
            headers: res.headers
          });
        });
      });
      req.on('error', reject);
      if (bytes.length) req.write(bytes);
      req.end();
    });
  }

  async putObject({ objectKey, content, contentType = 'application/json', metadata = {} }) {
    const key = normalizeObjectKey(objectKey);
    const bytes = serializeArtifactContent(content);
    await this.request({
      method: 'PUT',
      objectKey: key,
      bytes,
      contentType,
      expectedStatuses: [200, 201, 204]
    });
    return {
      objectKey: key,
      provider: this.provider,
      contentHash: contentHashFromBytes(bytes),
      sizeBytes: bytes.length,
      contentType,
      metadata,
      uri: this.uriFor(key),
      updatedAt: new Date().toISOString()
    };
  }

  async getObject(objectKey) {
    const key = normalizeObjectKey(objectKey);
    const response = await this.request({
      method: 'GET',
      objectKey: key,
      expectedStatuses: [200]
    });
    return {
      objectKey: key,
      bytes: response.bytes,
      provider: this.provider,
      contentHash: contentHashFromBytes(response.bytes),
      sizeBytes: response.bytes.length,
      uri: this.uriFor(key)
    };
  }

  async verifyObject(objectKey, expectedContentHash) {
    try {
      const record = await this.getObject(objectKey);
      const actualContentHash = contentHashFromBytes(record.bytes);
      return {
        objectKey: record.objectKey,
        provider: record.provider,
        exists: true,
        passed: actualContentHash === expectedContentHash,
        expectedContentHash,
        actualContentHash,
        sizeBytes: record.bytes.length,
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error.status !== 404) throw error;
      return {
        objectKey: normalizeObjectKey(objectKey),
        provider: this.provider,
        exists: false,
        passed: false,
        expectedContentHash,
        actualContentHash: null,
        sizeBytes: 0,
        checkedAt: new Date().toISOString()
      };
    }
  }
}

function createDefaultArtifactStorageAdapter(options = {}) {
  if (options.storageAdapter) return options.storageAdapter;
  if (options.artifactStorage) return options.artifactStorage;
  if (options.memoryDb || process.env.NODE_ENV === 'test') {
    return new MemoryArtifactStorageAdapter();
  }
  return new LocalArtifactStorageAdapter(options.storage || {});
}

module.exports = {
  MemoryArtifactStorageAdapter,
  LocalArtifactStorageAdapter,
  S3CompatibleArtifactStorageAdapter,
  contentHashFromBytes,
  createDefaultArtifactStorageAdapter,
  normalizeObjectKey,
  proofCapabilities,
  serializeArtifactContent
};
