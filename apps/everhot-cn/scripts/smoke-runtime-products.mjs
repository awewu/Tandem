#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(import.meta.dirname, '..');
const CATALOG_JS = readFileSync(join(ROOT, 'public', 'js', 'catalog.js'), 'utf8');

function product(overrides) {
  return {
    slug: 'runtime-pump',
    name: 'Runtime Heat Pump',
    cat: 'residential',
    sys: 'water-heating',
    series: 'Runtime Series',
    summary: 'Nexus managed product',
    mainImage: { url: '/api/v2/sites/everhot/products/runtime-pump/images/main' },
    ...overrides,
  };
}

function createGrid() {
  return {
    dataset: {},
    parentNode: null,
    innerHTML: '',
    getAttribute(name) {
      return name === 'data-catalog' ? 'residential:water-heating' : null;
    },
    querySelectorAll() {
      return [];
    },
  };
}

async function runCatalog({ hostname, fetchImpl, staticProducts }) {
  const grid = createGrid();
  const context = {
    console,
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
    URLSearchParams,
    location: { hostname, search: '', pathname: '/products/residential/water-heating/' },
    document: {
      readyState: 'complete',
      addEventListener() {},
      querySelector(selector) {
        if (selector === '[data-product-detail]' || selector === '[data-product-compare]') return null;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '[data-catalog]' || selector === '[data-catalog],[data-featured]') return [grid];
        if (selector === '[data-featured]') return [];
        return [];
      },
      createElement() {
        return { className: '', innerHTML: '', querySelectorAll: () => [] };
      },
      head: { appendChild() {} },
    },
    history: { replaceState() {} },
    navigator: {},
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    Promise,
  };
  context.window = context;
  context.window.EVERHOT_PRODUCTS = staticProducts;
  vm.createContext(context);
  vm.runInContext(CATALOG_JS, context, { filename: 'catalog.js' });
  if (context.window.EVERHOT_PRODUCTS_READY) await context.window.EVERHOT_PRODUCTS_READY;
  await Promise.resolve();
  await Promise.resolve();
  return { window: context.window, grid };
}

const successCalls = [];
const success = await runCatalog({
  hostname: 'localhost',
  staticProducts: [product({ slug: 'static-pump', name: 'Static Heat Pump', tagline: 'Static fallback' })],
  fetchImpl: async (url) => {
    successCalls.push(url);
    assert.equal(url, '/api/v2/sites/everhot/products?locale=zh-CN');
    return {
      ok: true,
      json: async () => ({ success: true, data: { items: [product()], total: 1 } }),
    };
  },
});

assert.equal(success.window.EVERHOT_PRODUCTS_STATUS, 'runtime');
assert.equal(success.window.EVERHOT_PRODUCTS[0].slug, 'runtime-pump');
assert.match(success.grid.innerHTML, /Runtime Heat Pump/);
assert.doesNotMatch(success.grid.innerHTML, /Static Heat Pump/);
assert.deepEqual(successCalls, ['/api/v2/sites/everhot/products?locale=zh-CN']);

const legacyCalls = [];
const legacy = await runCatalog({
  hostname: 'localhost',
  staticProducts: [product({ slug: 'static-pump', name: 'Static Heat Pump', tagline: 'Static fallback' })],
  fetchImpl: async (url) => {
    legacyCalls.push(url);
    if (url === '/api/v2/sites/everhot/products?locale=zh-CN') {
      return {
        ok: false,
        status: 503,
        json: async () => ({ message: 'site runtime unavailable' }),
      };
    }
    assert.equal(url, '/api/v2/brand/everhot/products?locale=zh-CN');
    return {
      ok: true,
      json: async () => ({ success: true, data: { items: [product({ slug: 'legacy-pump', name: 'Legacy Runtime Pump' })], total: 1 } }),
    };
  },
});

assert.equal(legacy.window.EVERHOT_PRODUCTS_STATUS, 'runtime');
assert.equal(legacy.window.EVERHOT_PRODUCTS[0].slug, 'legacy-pump');
assert.match(legacy.grid.innerHTML, /Legacy Runtime Pump/);
assert.deepEqual(legacyCalls, [
  '/api/v2/sites/everhot/products?locale=zh-CN',
  '/api/v2/brand/everhot/products?locale=zh-CN',
]);

const fallbackCalls = [];
const fallback = await runCatalog({
  hostname: 'localhost',
  staticProducts: [product({ slug: 'static-pump', name: 'Static Heat Pump', tagline: 'Static fallback' })],
  fetchImpl: async (url) => {
    fallbackCalls.push(url);
    throw new Error('offline');
  },
});

assert.equal(fallback.window.EVERHOT_PRODUCTS_STATUS, 'fallback');
assert.equal(fallback.window.EVERHOT_PRODUCTS[0].slug, 'static-pump');
assert.match(fallback.grid.innerHTML, /Static Heat Pump/);
assert.deepEqual(fallbackCalls, [
  '/api/v2/sites/everhot/products?locale=zh-CN',
  '/api/v2/brand/everhot/products?locale=zh-CN',
]);

const staticCalls = [];
const staticRuntime = await runCatalog({
  hostname: 'www.everhot.com.cn',
  staticProducts: [product({ slug: 'static-pump', name: 'Static Heat Pump', tagline: 'Static fallback' })],
  fetchImpl: async (url) => {
    staticCalls.push(url);
    throw new Error('non-local runtime should not fetch products');
  },
});

assert.equal(staticRuntime.window.EVERHOT_PRODUCTS_STATUS, 'static');
assert.equal(staticRuntime.window.EVERHOT_PRODUCTS[0].slug, 'static-pump');
assert.match(staticRuntime.grid.innerHTML, /Static Heat Pump/);
assert.deepEqual(staticCalls, []);

console.log('Everhot runtime product loader smoke passed.');
