import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { LifecycleService } from './lifecycle.service';

@UseGuards(AuthGuard)
@Controller('lifecycle')
export class LifecycleController {
  constructor(private readonly svc: LifecycleService) {}

  @Post('handover')
  @HttpCode(201)
  createHandover(@Req() req: any, @Body() body: unknown) {
    return this.svc.createOrUpdateHandover(req.user, body);
  }

  @Post('handover/:id/acceptance')
  markAccepted(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.markAccepted(req.user, id, body);
  }

  @Get('handover/:id/handoff-package')
  handoffPackage(@Req() req: any, @Param('id') id: string) {
    return this.svc.buildIotHandoffPackage(req.user, id);
  }

  @Get('customer-projects')
  customerProjects(@Req() req: any, @Query() query: unknown) {
    return this.svc.listCustomerProjectViews(req.user, query);
  }

  @Get('customer-projects/:id')
  customerProject(@Req() req: any, @Param('id') id: string) {
    return this.svc.getCustomerProjectView(req.user, id);
  }

  @Get('project-states')
  projectStates() {
    return this.svc.getProjectStateMap();
  }

  @Get('handover/:id')
  handover(@Req() req: any, @Param('id') id: string) {
    return this.svc.getHandover(req.user, id);
  }

  @Patch('handover/:id/state')
  updateState(@Req() req: any, @Param('id') id: string, @Body() body: unknown) {
    return this.svc.updateProjectState(req.user, id, body);
  }
}
