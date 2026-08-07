import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * 可观测性基础层（APM/Sentry 铺底,完整可用增量）:
 *  - 为每个请求生成/透传 trace-id（x-trace-id）,回写响应头,便于跨服务串联。
 *  - 完成时输出结构化时序日志（traceId/method/url/status/ms）,慢请求告警。
 *  - 出错时结构化记录 + 调用可插拔 errorSink（Sentry/OTel 就绪的接缝,默认仅日志,无新依赖）。
 * env:
 *  OBSERVABILITY_LOG_REQUESTS=true 打开成功请求日志（默认关,避免噪声）
 *  OBSERVABILITY_SLOW_MS=1000       慢请求阈值(ms)
 */
export type ErrorSink = (err: unknown, ctx: { traceId: string; method: string; url: string }) => void;

// 默认错误接收器:结构化日志。生产接 Sentry/OTel 时替换本函数即可（见 setErrorSink）。
let errorSink: ErrorSink = (err, ctx) => {
  const e = err as { message?: string; status?: number };
  Logger.error(JSON.stringify({ evt: 'request.error', ...ctx, status: e?.status ?? 500, message: e?.message ?? String(err) }), 'Observability');
};
export function setErrorSink(sink: ErrorSink) { errorSink = sink; }

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Observability');
  private readonly logRequests = process.env.OBSERVABILITY_LOG_REQUESTS === 'true';
  private readonly slowMs = Number(process.env.OBSERVABILITY_SLOW_MS || 1000);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req: any = http.getRequest();
    const res: any = http.getResponse();

    const traceId = String(req.headers?.['x-trace-id'] || randomUUID());
    req.traceId = traceId;
    try { res?.header?.('x-trace-id', traceId); } catch { /* fastify reply */ }

    const method = req.method;
    const url = req.url;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          if (ms >= this.slowMs) {
            this.logger.warn(JSON.stringify({ evt: 'request.slow', traceId, method, url, ms }));
          } else if (this.logRequests) {
            this.logger.log(JSON.stringify({ evt: 'request', traceId, method, url, ms }));
          }
        },
        error: (err) => errorSink(err, { traceId, method, url }),
      }),
    );
  }
}
