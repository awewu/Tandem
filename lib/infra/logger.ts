/**
 * Structured Logger · pino
 *
 * 用法:
 *   import { logger } from '@/lib/infra/logger';
 *   logger.info({ userId, action: 'login' }, 'user logged in');
 *
 * 生产 (NODE_ENV=production): JSON 输出, 走 stdout, 由 sidecar (loki/cw) 采集
 * 开发: pino-pretty 彩色, 易读
 *
 * §T15: 不打印 PII (邮箱/IP) 除非显式 allowed; 改用 hash/redact.
 */

import pino, { type Logger } from 'pino';

const isProd = process.env.NODE_ENV === 'production';

const baseOpts: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: {
    service: 'tandem',
    env: process.env.NODE_ENV ?? 'development',
  },
  // 自动屏蔽敏感字段 (PII)
  redact: {
    paths: [
      'password',
      'passwordHash',
      'refreshToken',
      'refreshTokenHash',
      'token',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'mfaSecret',
      'encryptedSecret',
      'recoveryCodeHashes',
    ],
    censor: '***REDACTED***',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Next.js webpack 无法 bundle pino-pretty 的 worker thread, 强行用 transport
// 会在 dev 下抛 "Cannot find module .next/server/vendor-chunks/lib/worker.js".
// 因此所有 env 都走 plain pino (JSON 到 stdout). 开发者想要彩色:
//   $ npx next dev | npx pino-pretty
export const logger: Logger = pino(baseOpts);

/**
 * 创建带请求上下文的子 logger.
 * 在 Next.js API route 头部调用:
 *   const log = childLogger({ reqId, userId });
 *   log.info('processing');
 */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

/** 生成短随机请求 ID (16 hex). */
export function generateRequestId(): string {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')).join('').slice(0, 16);
}
