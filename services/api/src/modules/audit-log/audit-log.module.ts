import { Module } from '@nestjs/common';
import { AuditLogController, AuditEventsController } from './audit-log.controller';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from './audit-log.service';

@Module({
  controllers: [AuditLogController, AuditEventsController],
  providers: [AuditLogService, AuditLogInterceptor],
  exports: [AuditLogService, AuditLogInterceptor],
})
export class AuditLogModule {}
