import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DispatchService } from './dispatch.service';

/**
 * 派单只读表面（/api/v2/dispatch）。
 * 派单本身由 lead.captured 事件消费者在系统态触发；此处仅供工作台/HQ 查看决策与目录。
 */
@Controller('dispatch')
@UseGuards(AuthGuard)
export class DispatchController {
  constructor(private readonly svc: DispatchService) {}

  /** 本租户的派单决策审计（申诉/复盘） */
  @Get('decisions')
  decisions(@Req() r: any, @Query('limit') limit?: string) {
    return this.svc.listDecisions(r.user, limit ? Number(limit) : 50);
  }

  /** 派单路由目录（foundation 可派经销商索引） */
  @Get('directory')
  directory(@Req() r: any) {
    return this.svc.listDirectory(r.user);
  }
}
