import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import {
  ViewerDraftComponentInput,
  ViewerDraftInput,
  ViewerDraftRiserInput,
  ViewerDraftService,
  ViewerLegacyDesigner2dConversionInput,
} from './viewer-draft.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim/viewer-drafts')
export class ViewerDraftController {
  constructor(private readonly svc: ViewerDraftService) {}

  @Post()
  create(@Req() r: any, @Body() b: ViewerDraftInput) {
    return this.svc.save(r.user, b);
  }

  @Get(':id')
  get(@Req() r: any, @Param('id') id: string) {
    return this.svc.get(r.user, id);
  }

  @Put(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() b: ViewerDraftInput) {
    return this.svc.save(r.user, { ...b, id });
  }

  @Post(':id/generated-model')
  generateModel(@Req() r: any, @Param('id') id: string) {
    return this.svc.generateModel(r.user, id);
  }

  @Post(':id/legacy-designer-2d-conversion')
  convertLegacyDesigner2d(
    @Req() r: any,
    @Param('id') id: string,
    @Body() b: ViewerLegacyDesigner2dConversionInput,
  ) {
    return this.svc.convertLegacyDesigner2d(r.user, id, b);
  }

  @Post(':id/components')
  createComponent(@Req() r: any, @Param('id') id: string, @Body() b: ViewerDraftComponentInput) {
    return this.svc.createComponent(r.user, id, b);
  }

  @Put(':id/components/:componentId')
  updateComponent(
    @Req() r: any,
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @Body() b: ViewerDraftComponentInput,
  ) {
    return this.svc.updateComponent(r.user, id, componentId, b);
  }

  @Post(':id/components/:componentId/riser')
  addRiser(
    @Req() r: any,
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @Body() b: ViewerDraftRiserInput,
  ) {
    return this.svc.addRiser(r.user, id, componentId, b);
  }

  @Delete(':id/components/:componentId')
  deleteComponent(@Req() r: any, @Param('id') id: string, @Param('componentId') componentId: string) {
    return this.svc.deleteComponent(r.user, id, componentId);
  }
}
