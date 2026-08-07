import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CdpService } from './cdp.service';

@Controller('cdp')
@UseGuards(AuthGuard)
export class CdpController {
  constructor(private readonly svc: CdpService) {}

  @Post('profiles')
  upsertProfile(@Req() r: any, @Body() b: any) { return this.svc.upsertProfile(r.user, b); }

  @Get('profiles')
  listProfiles(@Req() r: any, @Query() q: any) { return this.svc.listProfiles(r.user, q); }

  @Post('segments')
  createSegment(@Req() r: any, @Body() b: any) { return this.svc.createSegment(r.user, b); }

  @Get('segments')
  listSegments(@Req() r: any) { return this.svc.listSegments(r.user); }

  @Post('consent')
  recordConsent(@Req() r: any, @Body() b: any) { return this.svc.recordConsent(r.user, b); }
}
