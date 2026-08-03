import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DevicesCandidateService } from './devices-candidate.service';

@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesCandidateController {
  constructor(private readonly svc: DevicesCandidateService) {}

  @Get('stats/categories')
  categoriesStats() {
    return this.svc.categoriesStats();
  }

  @Get('search')
  search(@Query('query') query?: string) {
    return this.svc.search(query);
  }

  @Post('recommend')
  recommend(@Body() body: Record<string, unknown>) {
    return { devices: [], requirements: body || {} };
  }

  @Post('batch')
  batch(@Body() body: { operation?: string; deviceIds?: string[] }) {
    return { operation: body?.operation, deviceIds: body?.deviceIds || [], status: 'accepted' };
  }

  @Post('compatibility')
  compatibility(@Body() body: { deviceIds?: string[] }) {
    return { compatible: true, deviceIds: body?.deviceIds || [], notes: [] };
  }

  @Get('export')
  exportDevices(@Query('format') format?: string) {
    return { exportId: `DEV-EXP-${Date.now()}`, format: format || 'excel' };
  }

  @Post('import')
  importDevices() {
    return { importId: `DEV-IMP-${Date.now()}`, status: 'queued' };
  }

  @Get()
  list(@Query() query: { system?: string; brand?: string; search?: string }) {
    return this.svc.list(query);
  }

  @Post()
  create(@Body() body: Record<string, unknown>) {
    return { id: `device-${Date.now()}`, ...body };
  }

  @Get(':deviceId')
  get(@Param('deviceId') deviceId: string) {
    return this.svc.get(deviceId);
  }

  @Put(':deviceId')
  update(@Param('deviceId') deviceId: string, @Body() body: Record<string, unknown>) {
    return { id: deviceId, ...body };
  }

  @Delete(':deviceId')
  delete(@Param('deviceId') deviceId: string) {
    return { id: deviceId, deleted: true };
  }

  @Put(':deviceId/review')
  review(@Param('deviceId') deviceId: string) {
    return { id: deviceId, reviewed: true };
  }

  @Post(':deviceId/favorite')
  favorite(@Param('deviceId') deviceId: string) {
    return { id: deviceId, favorited: true };
  }
}
