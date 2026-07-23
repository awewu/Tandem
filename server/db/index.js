/**
 * 数据库适配层 — 生产强制持久化，开发允许内存演示。
 *
 * MONGO 模式：MONGODB_URI 环境变量存在时自动连接，持久化所有数据。
 * MEMORY 模式：仅限非生产环境、未显式 REQUIRE_MONGODB=true 时使用。
 *
 * 生产环境必须 fail-fast，不能静默降级到内存模式。
 */

const mongoose = require('mongoose');

let connected = false;
let mode = 'memory';
let lastError = null;

function isProductionDatabaseRequired(env = process.env) {
  return env.NODE_ENV === 'production' || env.REQUIRE_MONGODB === 'true';
}

function resetForTests() {
  connected = false;
  mode = 'memory';
  lastError = null;
}

// ── 连接 MongoDB ──────────────────────────────────────────────────────────────
async function connect(options = {}) {
  const env = options.env || process.env;
  const uri = env.MONGODB_URI;
  const requireMongo = typeof options.requireMongo === 'boolean'
    ? options.requireMongo
    : isProductionDatabaseRequired(env);

  lastError = null;

  if (!uri) {
    if (requireMongo) {
      lastError = new Error('[DB] MONGODB_URI is required when NODE_ENV=production or REQUIRE_MONGODB=true');
      throw lastError;
    }
    connected = false;
    mode = 'memory';
    console.log('[DB] MONGODB_URI 未设置，使用内存模式（仅限开发/演示，重启数据不持久）');
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: Number(env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000)
    });
    connected = true;
    mode = 'mongo';
    console.log(`[DB] ✅ MongoDB 已连接：${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
    return true;
  } catch (e) {
    lastError = e;
    connected = false;
    mode = 'memory';

    if (requireMongo) {
      throw new Error(`[DB] MongoDB connection failed in required mode: ${e.message}`);
    }

    console.warn(`[DB] ⚠️  MongoDB 连接失败（${e.message}），非生产环境降级为内存模式`);
    return false;
  }
}

function isConnected() { return connected; }
function getMode() { return mode; }
function getLastError() { return lastError; }

/**
 * 业务写入前的持久化断言。
 * 在 non-production 环境只打警告；production / REQUIRE_MONGODB=true 时直接抛错。
 * service 在任何写操作前调用，取代各自独立的 shouldUseMemoryMode() 判断。
 */
function requirePersistence(label = 'operation') {
  if (mode === 'memory') {
    const msg = `[DB] 数据库未连接，${label} 拒绝写入内存（数据不持久）`;
    if (isProductionDatabaseRequired()) throw new Error(msg);
    console.warn(`[DB] ⚠️  ${msg}（非生产环境，本次操作被跳过）`);
    return false;
  }
  return true;
}

module.exports = {
  connect,
  getLastError,
  getMode,
  isConnected,
  isProductionDatabaseRequired,
  requirePersistence,
  resetForTests
};
