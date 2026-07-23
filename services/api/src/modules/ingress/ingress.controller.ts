import { Body, Controller, Post, Req } from '@nestjs/common';
import { IngressService } from './ingress.service';
import { Public } from '../common/public.decorator';

/**
 * 公域接入层入口（匿名 · 无 AuthGuard）。营销站（板块一）经 generated-client 调用。
 * TenantContextInterceptor 对无 JWT 请求为 no-op；租户由 IngressService 以获客暂存租户显式绑定。
 */
@Controller('ingress')
@Public()
export class IngressController {
  constructor(private readonly svc: IngressService) {}

  @Post('lead')
  captureLead(@Req() req: { ip?: string; headers?: Record<string, string> }, @Body() body: {
    phone?: string; name?: string; audience?: string; source?: string; city?: string; campaign?: string;
    consent?: boolean; consentMeta?: { purpose?: string; policyVersion?: string; surface?: string };
  }) {
    return this.svc.captureLead(req?.ip || 'unknown', body, req?.headers?.['user-agent']);
  }
}
