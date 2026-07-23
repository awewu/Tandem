import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DeliveryService } from './delivery.service';

@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('generate')
  generateDelivery(@Body() dto: Record<string, unknown>) {
    return this.delivery.generateDelivery(dto);
  }

  @Get(':orderNo/docs')
  getDocs(@Param('orderNo') orderNo: string) {
    return this.delivery.getDocs(orderNo);
  }
}
