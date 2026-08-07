import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './modules/app.module';
import { ObservabilityInterceptor } from './modules/common/observability.interceptor';

export const apiBootstrapTarget = {
  platform: 'Rhautt Nexus / 瑞合数智枢纽',
  framework: 'NestJS',
  httpAdapter: 'Fastify',
  architecture: 'DDD modular monolith',
  status: 'source-contract-ready',
  runtimeTruth: 'Install target dependencies before treating this as boot proof.'
} as const;

export async function createApiApplication() {
  // rawBody:true —— Nest 内置原始请求体捕获（req.rawBody），供契约锁 webhook 签名验证使用
  // （contract.controller.ts 的 qiyuesuoWebhook() 读取）。避免手动 addContentTypeParser 与
  // Nest/Fastify 自带 application/json 解析器在 app.init() 冲突（"already present"）。
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      bodyLimit: Number(process.env.API_BODY_LIMIT_BYTES || 50 * 1024 * 1024),
    }),
    { rawBody: true }
  );

  app.setGlobalPrefix('api/v2');
  // 可观测性基础层:请求 trace-id 透传 + 结构化时序/错误日志（APM/Sentry 铺底）。
  app.useGlobalInterceptors(new ObservabilityInterceptor());
  // 内部工作台（增长中枢/后台）跨源调用：反射请求源 + 允许 Authorization。
  // 端点仍由 AuthGuard（JWT 租户范围）保护，CORS 不放宽鉴权。
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();
  return app;
}

export async function bootstrap() {
  const app = await createApiApplication();
  const port = Number(process.env.PORT || process.env.API_PORT || 5500);
  const host = process.env.HOST || process.env.BIND_HOST || '0.0.0.0';
  await app.listen(port, host);
  return app;
}

if (require.main === module) {
  bootstrap().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
