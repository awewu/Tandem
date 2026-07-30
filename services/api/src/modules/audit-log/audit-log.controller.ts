import { Controller, Get, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/permissions.decorator';
import { Roles } from '../common/roles.decorator';
import { AuditLogService, type AuditLogQuery } from './audit-log.service';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  @Permissions('system.audit.read')
  list(@Req() req: any, @Query() query: AuditLogQuery) {
    return this.auditLog.list(req.user, query);
  }
}
