import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { GovernanceService } from './governance.service';

@Controller('governance')
@UseGuards(AuthGuard)
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Get('agent-progress')
  getAgentProgress(@Request() req: { user: JwtPayload }) {
    return this.governance.getAgentProgress(req.user);
  }
}
