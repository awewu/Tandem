import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ViewerComponentCatalogService } from './viewer-component-catalog.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim/component-catalog')
export class ViewerComponentCatalogController {
  constructor(private readonly svc: ViewerComponentCatalogService) {}

  @Get()
  list() {
    return this.svc.list();
  }
}
