import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ViewerModelSourceInput, ViewerModelSourceService } from './viewer-model-source.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim/model-sources')
export class ViewerModelSourceController {
  constructor(private readonly svc: ViewerModelSourceService) {}

  @Post()
  create(@Req() r: any, @Body() b: ViewerModelSourceInput) {
    return this.svc.save(r.user, b);
  }

  @Get()
  list(
    @Req() r: any,
    @Query('projectId') projectId?: string,
    @Query('draftId') draftId?: string,
    @Query('artifactId') artifactId?: string,
    @Query('includeArchived') includeArchived?: string
  ) {
    return this.svc.list(r.user, {
      projectId,
      draftId,
      artifactId,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get(':id')
  get(@Req() r: any, @Param('id') id: string) {
    return this.svc.get(r.user, id);
  }

  @Put(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() b: ViewerModelSourceInput) {
    return this.svc.save(r.user, { ...b, id });
  }

  @Post(':id/duplicate')
  duplicate(@Req() r: any, @Param('id') id: string, @Body() b: { name?: string | null }) {
    return this.svc.duplicate(r.user, id, b);
  }

  @Patch(':id/name')
  rename(@Req() r: any, @Param('id') id: string, @Body() b: { name?: string | null }) {
    return this.svc.rename(r.user, id, b);
  }

  @Post(':id/archive')
  archive(@Req() r: any, @Param('id') id: string) {
    return this.svc.archive(r.user, id);
  }

  @Delete(':id')
  delete(@Req() r: any, @Param('id') id: string) {
    return this.svc.delete(r.user, id);
  }
}
