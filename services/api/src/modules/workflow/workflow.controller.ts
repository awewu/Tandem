import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { WorkflowService } from './workflow.service';
import { JwtPayload } from '../auth/auth.service';

@UseGuards(AuthGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly svc: WorkflowService) {}

  @Get()
  list(@Request() req: { user: JwtPayload }) {
    return this.svc.listWorkflows(req.user);
  }

  @Get('rysnova-bim/projects/:projectId')
  rysnovaBimProjectWorkflow(@Request() req: { user: JwtPayload }, @Param('projectId') projectId: string) {
    return this.svc.getRysnovaProjectWorkflow(req.user, projectId);
  }
}
