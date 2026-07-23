import { Controller, Get } from '@nestjs/common';
import { apiModuleBoundary } from './module-boundary';
import { Public } from './common/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  health() {
    return {
      success: true,
      platform: 'Rhautt Nexus / 瑞合数智枢纽',
      framework: 'NestJS',
      httpAdapter: 'Fastify',
      architecture: 'DDD modular monolith',
      moduleBoundary: apiModuleBoundary,
      iotBoundary: 'lifecycle_handoff_only'
    };
  }
}
