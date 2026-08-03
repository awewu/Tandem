import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SystemPacksService } from './system-packs.service';

@Controller('system-packs')
export class SystemPacksController {
  constructor(private readonly svc: SystemPacksService) {}

  @Get()
  list(@Query('category') category?: string, @Query('role') role?: string) {
    return this.svc.list({ category, role });
  }

  @Get(':packId')
  getPack(@Param('packId') packId: string) {
    return this.svc.getPack(packId);
  }

  @Post('compose')
  compose(@Body() body: { selectedPackIds?: string[]; context?: Record<string, unknown> }) {
    return this.svc.compose(body);
  }

  @Post('recommend')
  recommend(@Body() body: Record<string, unknown>) {
    return this.svc.recommend(body);
  }
}
