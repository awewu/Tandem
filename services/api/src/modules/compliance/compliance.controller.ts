import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ComplianceService, RecordConsentDto } from './compliance.service';
import { ConsentPurpose } from './consent.entity';
import { Public } from '../common/public.decorator';

/**
 * M14 中国合规 · API 表面（/api/v2/compliance）
 * 覆盖：PIPL 同意管理（consent）、撤回、数据保留策略（dataRetention）。
 */
// 公开面：C 端在登录前采集/撤回同意（PIPL 便捷性要求）。
// TODO(P1)：consent/:tenantId/:subjectId 读端点当前无鉴权即可查同意态，
//   应改为需令牌或短时签名令牌，避免枚举探测。见 MASTER-PROBLEM-LEDGER P0-PIPL。
@Controller('compliance')
@Public()
export class ComplianceController {
  constructor(private readonly svc: ComplianceService) {}

  /** 记录一次知情同意（采集个人信息前必须先拿到） */
  @Post('consent')
  recordConsent(@Body() body: RecordConsentDto, @Req() req: any) {
    return this.svc.recordConsent({
      ...body,
      ip: body.ip || req?.ip,
      userAgent: body.userAgent || req?.headers?.['user-agent'],
    });
  }

  /** 查询某主体某用途的同意状态 */
  @Get('consent/:tenantId/:subjectId')
  status(
    @Param('tenantId') tenantId: string,
    @Param('subjectId') subjectId: string,
    @Query('purpose') purpose: ConsentPurpose,
  ) {
    return this.svc.getConsentStatus(tenantId, subjectId, purpose);
  }

  /** 撤回同意（PIPL：与给予同样便捷） */
  @Post('consent/withdraw')
  withdraw(@Body() body: { tenantId: string; subjectId: string; purpose: ConsentPurpose }) {
    return this.svc.withdrawConsent(body.tenantId, body.subjectId, body.purpose);
  }

  /** 列出主体全部同意记录（数据主体可访问权） */
  @Get('consent/:tenantId/:subjectId/all')
  list(@Param('tenantId') tenantId: string, @Param('subjectId') subjectId: string) {
    return this.svc.listConsents(tenantId, subjectId);
  }

  /** 数据保留策略 */
  @Get('retention-policy')
  retentionPolicy() {
    return this.svc.dataRetentionPolicy();
  }
}
