import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BrandService } from './brand.service';

@Controller('brand')
@UseGuards(AuthGuard)
export class BrandController {
  constructor(private readonly svc: BrandService) {}

  @Get()  data() { return this.svc.getData(); }
  @Post('sync') sync() { return this.svc.sync(); }
}
