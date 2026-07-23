import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { TenantService } from './tenant.service';
import { Roles } from '../common/roles.decorator';

@Controller()
@UseGuards(AuthGuard)
export class TenantController {
  constructor(private readonly svc: TenantService) {}

  // Tenants (hq admin only)
  @Roles('platform_admin', 'hq_admin')
  @Get('tenants')       listTenants (@Req() r: any, @Query() q: any) { return this.svc.listTenants(r.user, q); }
  @Roles('platform_admin', 'hq_admin')
  @Get('tenants/:id')   getTenant   (@Req() r: any, @Param('id') id: string) { return this.svc.getTenant(r.user, id); }
  @Roles('platform_admin', 'hq_admin')
  @Post('tenants')      createTenant(@Req() r: any, @Body() b: any) { return this.svc.createTenant(r.user, b); }
  @Roles('platform_admin', 'hq_admin')
  @Put('tenants/:id')   updateTenant(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.updateTenant(r.user, id, b); }

  // Dealers
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Get('dealers')       listDealers (@Req() r: any, @Query() q: any) { return this.svc.listDealers(r.user, q); }
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Get('dealers/:id')   getDealer   (@Req() r: any, @Param('id') id: string) { return this.svc.getDealer(r.user, id); }
  @Roles('platform_admin', 'hq_admin', 'regional_manager')
  @Post('dealers')      createDealer(@Req() r: any, @Body() b: any) { return this.svc.createDealer(r.user, b); }
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin')
  @Put('dealers/:id')   updateDealer(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.updateDealer(r.user, id, b); }

  // Stores
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Get('stores')        listStores  (@Req() r: any, @Query() q: any) { return this.svc.listStores(r.user, q); }
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Get('stores/:id')    getStore    (@Req() r: any, @Param('id') id: string) { return this.svc.getStore(r.user, id); }
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin')
  @Post('stores')       createStore (@Req() r: any, @Body() b: any) { return this.svc.createStore(r.user, b); }
  @Roles('platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin')
  @Put('stores/:id')    updateStore (@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.updateStore(r.user, id, b); }
}
