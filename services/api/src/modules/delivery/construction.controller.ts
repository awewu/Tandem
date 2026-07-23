import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ConstructionService } from './construction.service';

/**
 * 施工交付过程管控（销售工程师/项目经理视角）。
 * 里程碑推进 + 隐蔽工程留证闸 + 进度款节点解锁。全部 AuthGuard + 租户 RLS。
 */
@Controller('delivery/construction')
@UseGuards(AuthGuard)
export class ConstructionController {
  constructor(private readonly svc: ConstructionService) {}

  /** 合同生效 → 派生施工项目（同合同幂等）。 */
  @Post('projects/from-contract')
  fromContract(@Req() r: any, @Body() b: any) { return this.svc.createProjectForContract(r.user, b); }

  @Get('projects')
  list(@Req() r: any, @Query() q: any) { return this.svc.listProjects(r.user, q); }

  @Get('projects/:id')
  get(@Req() r: any, @Param('id') id: string) { return this.svc.getProject(r.user, id); }

  /** 开始节点：pending→in-progress（前序须完成）。 */
  @Post('projects/:id/milestones/:key/start')
  start(@Req() r: any, @Param('id') id: string, @Param('key') key: string) { return this.svc.startMilestone(r.user, id, key); }

  /** 完成节点：in-progress→completed（隐蔽/验收强制留证；完成解锁款项）。 */
  @Post('projects/:id/milestones/:key/complete')
  complete(@Req() r: any, @Param('id') id: string, @Param('key') key: string) { return this.svc.completeMilestone(r.user, id, key); }

  /** 挂验收留证（影像/电子签/文档）。 */
  @Post('projects/:id/evidence')
  evidence(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.addEvidence(r.user, id, b); }

  /** 标记款项已收（仅 payable 可收；locked 拒绝）。 */
  @Post('projects/:id/payments/:kind/pay')
  pay(@Req() r: any, @Param('id') id: string, @Param('kind') kind: string) { return this.svc.markPaymentPaid(r.user, id, kind); }
}
