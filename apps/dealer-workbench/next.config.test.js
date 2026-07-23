const assert = require('node:assert/strict');
const test = require('node:test');

const nextConfig = require('./next.config');

test('dealer workbench proxies to the NestJS backend by default', async () => {
  const previousApiUrl = process.env.API_URL;
  delete process.env.API_URL;

  try {
    const rewrites = await nextConfig.rewrites();
    assert.equal(rewrites[0].destination, 'http://localhost:5500/api/:path*');
  } finally {
    if (previousApiUrl === undefined) {
      delete process.env.API_URL;
    } else {
      process.env.API_URL = previousApiUrl;
    }
  }
});

test('dealer workbench allows an explicit API proxy override', async () => {
  const previousApiUrl = process.env.API_URL;
  process.env.API_URL = 'http://localhost:5500';

  try {
    const rewrites = await nextConfig.rewrites();
    assert.equal(rewrites[0].destination, 'http://localhost:5500/api/:path*');
  } finally {
    if (previousApiUrl === undefined) {
      delete process.env.API_URL;
    } else {
      process.env.API_URL = previousApiUrl;
    }
  }
});
