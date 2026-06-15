/**
 * Observability scaffold · Sentry + OpenTelemetry
 *
 * 不强依赖: 仅当 env 配置时才动态 import 真实 SDK, 否则 no-op.
 * 这样 dev/CI 无需装 @sentry/* 也能跑.
 *
 * 启用:
 *   SENTRY_DSN=https://xxx@sentry.io/123
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318
 *   OTEL_SERVICE_NAME=tandem-app
 *
 * 安装 (启用时):
 *   pnpm add @sentry/nextjs @opentelemetry/api @opentelemetry/sdk-node \
 *            @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
 */

import { logger } from './logger';

let sentryEnabled = false;
let otelEnabled = false;
let processHandlersBound = false;

/**
 * 注册进程级未捕获错误处理器 (只注册一次).
 * 即使 Sentry 未启用, captureException 也会 fallback 到 logger, 保证不静默丢错.
 */
function bindProcessErrorHandlers(): void {
  if (processHandlersBound) return;
  processHandlersBound = true;

  process.on('unhandledRejection', (reason: unknown) => {
    captureException(reason instanceof Error ? reason : new Error(String(reason)), {
      kind: 'unhandledRejection',
    });
  });
  process.on('uncaughtException', (err: Error) => {
    captureException(err, { kind: 'uncaughtException' });
    logger.error({ err: err.message, stack: err.stack }, '[observability] uncaughtException');
  });
  logger.info('[observability] process error handlers bound');
}

export async function initObservability(): Promise<void> {
  bindProcessErrorHandlers();

  // Sentry
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import(/* webpackIgnore: true */ '@sentry/nextjs' as string).catch(() => null) as null | { init: (opts: unknown) => void };
      if (Sentry?.init) {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV ?? 'development',
          tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        });
        sentryEnabled = true;
        logger.info('[observability] Sentry initialized');
      } else {
        logger.warn('[observability] SENTRY_DSN set but @sentry/nextjs not installed');
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[observability] Sentry init failed');
    }
  }

  // OpenTelemetry
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      const otelSdk = (await import(/* webpackIgnore: true */ '@opentelemetry/sdk-node' as string).catch(() => null)) as null | { NodeSDK: new (opts: unknown) => { start: () => void } };
      const auto = (await import(/* webpackIgnore: true */ '@opentelemetry/auto-instrumentations-node' as string).catch(() => null)) as null | { getNodeAutoInstrumentations: () => unknown };
      const otlp = (await import(/* webpackIgnore: true */ '@opentelemetry/exporter-trace-otlp-http' as string).catch(() => null)) as null | { OTLPTraceExporter: new (opts: unknown) => unknown };
      if (otelSdk?.NodeSDK && auto?.getNodeAutoInstrumentations && otlp?.OTLPTraceExporter) {
        const sdk = new otelSdk.NodeSDK({
          serviceName: process.env.OTEL_SERVICE_NAME ?? 'tandem-app',
          traceExporter: new otlp.OTLPTraceExporter({
            url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
          }),
          instrumentations: [auto.getNodeAutoInstrumentations()],
        });
        sdk.start();
        otelEnabled = true;
        logger.info('[observability] OpenTelemetry SDK started');
      } else {
        logger.warn('[observability] OTEL endpoint set but SDK packages not installed');
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, '[observability] OTel init failed');
    }
  }
}

/** 上报一个非致命错误 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentryEnabled) {
    logger.warn({ err: (err as Error).message, context }, '[observability] exception (Sentry off)');
    return;
  }
  try {
    (import(/* webpackIgnore: true */ '@sentry/nextjs' as string) as Promise<{ captureException: (e: unknown, opts: unknown) => void }>)
      .then((S) => S.captureException(err, { extra: context }))
      .catch(() => undefined);
  } catch {
    /* noop */
  }
}

export function isObservabilityEnabled(): { sentry: boolean; otel: boolean } {
  return { sentry: sentryEnabled, otel: otelEnabled };
}
