const { EventEmitter } = require('events');
const { IncomingMessage } = require('http');
const { Socket } = require('net');
const { Readable } = require('stream');
const { URL } = require('url');

function normalizeHeaderName(name) {
  return String(name).toLowerCase();
}

function createRequest(app, method, requestPath, headers, payload) {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  const url = new URL(requestPath, 'http://127.0.0.1');
  const body = payload === undefined
    ? null
    : Buffer.from(typeof payload === 'string' || Buffer.isBuffer(payload)
      ? payload
      : JSON.stringify(payload));

  req.method = method.toUpperCase();
  req.url = `${url.pathname}${url.search}`;
  req.originalUrl = req.url;
  req.headers = { ...headers };
  req.query = Object.fromEntries(url.searchParams.entries());
  req.params = {};
  req.connection = socket;
  req.socket = socket;
  socket.remoteAddress = headers['x-forwarded-for'] || '127.0.0.1';
  socket.remotePort = 49152;
  req.ip = socket.remoteAddress;
  req.app = app;

  if (body && !req.headers['content-type']) req.headers['content-type'] = 'application/json';
  if (body && !req.headers['content-length']) req.headers['content-length'] = String(body.length);

  const source = Readable.from(body ? [body] : []);
  req._read = source._read.bind(source);
  source.on('data', chunk => req.push(chunk));
  source.on('end', () => req.push(null));
  source.on('error', error => req.emit('error', error));

  return req;
}

function createResponse(resolve) {
  const res = new EventEmitter();
  const chunks = [];
  const headers = new Map();

  res.statusCode = 200;
  res.locals = Object.create(null);
  res.finished = false;
  res.headersSent = false;

  res.setHeader = (name, value) => {
    headers.set(normalizeHeaderName(name), { name: String(name), value });
    return res;
  };
  res.getHeader = (name) => headers.get(normalizeHeaderName(name))?.value;
  res.removeHeader = (name) => {
    headers.delete(normalizeHeaderName(name));
  };
  res.getHeaders = () => {
    const out = {};
    for (const [key, entry] of headers.entries()) out[key] = entry.value;
    return out;
  };
  res.writeHead = (statusCode, statusMessageOrHeaders, maybeHeaders) => {
    res.statusCode = statusCode;
    const headerSource = typeof statusMessageOrHeaders === 'object'
      ? statusMessageOrHeaders
      : maybeHeaders;
    if (headerSource) {
      for (const [key, value] of Object.entries(headerSource)) res.setHeader(key, value);
    }
    res.headersSent = true;
    return res;
  };
  res.write = (chunk) => {
    if (chunk !== undefined) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    return true;
  };
  res.end = (chunk) => {
    if (chunk !== undefined) res.write(chunk);
    res.finished = true;
    res.headersSent = true;
    const text = Buffer.concat(chunks).toString();
    const responseHeaders = {};
    for (const [key, entry] of headers.entries()) {
      responseHeaders[key] = entry.value;
      responseHeaders[entry.name] = entry.value;
    }
    const response = {
      status: res.statusCode,
      statusCode: res.statusCode,
      headers: responseHeaders,
      text,
      body: parseBody(text, responseHeaders)
    };
    res.emit('finish');
    resolve(response);
    return res;
  };

  return res;
}

function parseBody(text, headers) {
  const contentType = String(headers['content-type'] || headers['Content-Type'] || '');
  if (!text) return {};
  if (contentType.includes('application/json') || /^[\[{]/.test(text.trim())) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  return {};
}

class InProcessTest {
  constructor(app, method, requestPath) {
    this.app = app;
    this.method = method;
    this.path = requestPath;
    this.headers = {};
    this.payload = undefined;
    this.assertions = [];
  }

  set(name, value) {
    this.headers[normalizeHeaderName(name)] = value;
    return this;
  }

  send(payload) {
    this.payload = payload;
    return this;
  }

  expect(first, second) {
    if (typeof first === 'number') {
      this.assertions.push(response => {
        if (response.status !== first) {
          throw new Error(`expected status ${first}, got ${response.status}: ${response.text}`);
        }
      });
      return this;
    }

    if (typeof first === 'string') {
      this.assertions.push(response => {
        const actual = response.headers[normalizeHeaderName(first)] || response.headers[first];
        if (actual !== second) {
          throw new Error(`expected header ${first}=${second}, got ${actual}`);
        }
      });
      return this;
    }

    if (typeof first === 'function') {
      this.assertions.push(first);
    }
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }

  async execute() {
    const response = await new Promise((resolve, reject) => {
      const req = createRequest(this.app, this.method, this.path, this.headers, this.payload);
      const res = createResponse(resolve);
      req.on('error', reject);
      res.on('error', reject);
      this.app.handle(req, res, error => {
        if (error) return reject(error);
        if (!res.finished) {
          res.statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 404;
          res.end(JSON.stringify({ success: false, error: 'Not Found' }));
        }
      });
    });

    for (const assertion of this.assertions) assertion(response);
    return response;
  }
}

function request(app) {
  return {
    get: requestPath => new InProcessTest(app, 'GET', requestPath),
    post: requestPath => new InProcessTest(app, 'POST', requestPath),
    put: requestPath => new InProcessTest(app, 'PUT', requestPath),
    patch: requestPath => new InProcessTest(app, 'PATCH', requestPath),
    delete: requestPath => new InProcessTest(app, 'DELETE', requestPath)
  };
}

module.exports = request;
