import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  getOverview(@Request() req: { user: JwtPayload }, @Query() query: Record<string, string>) {
    return this.analytics.getOverview(req.user, query);
  }
}
