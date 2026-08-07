import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PositioningService } from './positioning.service';

@Controller('positioning')
@UseGuards(AuthGuard)
export class PositioningController {
  constructor(private readonly svc: PositioningService) {}

  @Post('house')
  upsert(@Req() r: any, @Body() b: any) { return this.svc.upsertHouse(r.user, b); }

  @Get('house')
  get(@Req() r: any, @Query('brandCode') brandCode: string, @Query('category') category: string) { return this.svc.getHouse(r.user, brandCode, category); }

  @Get('houses')
  list(@Req() r: any, @Query('brandCode') brandCode?: string) { return this.svc.listHouses(r.user, brandCode); }

  @Post('house/:id/status')
  setStatus(@Req() r: any, @Param('id') id: string, @Body('status') status: 'approved' | 'archived') { return this.svc.setStatus(r.user, id, status); }
}
