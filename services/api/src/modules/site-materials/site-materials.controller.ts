import { Body, Controller, Get, Param, Post, Put, Query, StreamableFile } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { SiteMaterialsService } from './site-materials.service';

@Controller('site-materials')
export class SiteMaterialsController {
  constructor(private readonly service: SiteMaterialsService) {}

  @Public()
  @Get(':brandCode')
  async list(@Param('brandCode') brandCode: string, @Query('asset') asset?: string) {
    if (asset) {
      const file = await this.service.readAsset(brandCode, asset);
      return new StreamableFile(file.buffer, {
        type: file.mimeType,
        disposition: `inline; filename="${encodeURIComponent(asset.split('/').pop() || 'asset')}"`,
      });
    }
    return { data: await this.service.list(brandCode) };
  }

  @Post(':brandCode')
  async upload(@Param('brandCode') brandCode: string, @Body() body: Record<string, unknown>) {
    return { data: await this.service.upload(brandCode, body) };
  }

  @Put(':brandCode')
  async update(@Param('brandCode') brandCode: string, @Body() body: { key?: string; items?: any[] }) {
    return { data: await this.service.update(brandCode, body) };
  }
}
