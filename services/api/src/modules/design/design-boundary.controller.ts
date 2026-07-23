import { Controller, Get, Injectable } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class DesignBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('design');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}

@Public()
@Controller('design')
export class DesignBoundaryController {
  constructor(private readonly s: DesignBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
