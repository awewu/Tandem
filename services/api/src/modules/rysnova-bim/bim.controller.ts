import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BimService } from './bim.service';
import { Public } from '../common/public.decorator';

// 公开端点 — 不需要 auth（客户查询项目进度）
@Controller('bim/public')
@Public()
export class BimPublicController {
  constructor(private readonly svc: BimService) {}
  @Get(':code') lookup(@Param('code') code: string) { return this.svc.publicLookup(code); }
}

@Controller('bim')
@UseGuards(AuthGuard)
/**
 * W-BIM-0 · 旧端点兼容层（批 C 将移除）。
 * 请新调用方使用 `/api/v2/rysnova-bim/projects/*` 下的 V2BimController。
 */
export class BimController {
  constructor(private readonly svc: BimService) {}

  // 从报价单承接（签单时调用）
  @Post('inherit/:quotationId')
  inherit(@Req() r: any, @Param('quotationId') id: string) {
    return this.svc.inheritFromQuotation(r.user, id);
  }

  // 工作台统计（must be before :id）
  @Get('stats') stats(@Req() r: any) { return this.svc.stats(r.user); }

  // 项目列表
  @Get() list(@Req() r: any, @Query() q: any) { return this.svc.list(r.user, q); }

  // 项目详情
  @Get(':id') get(@Req() r: any, @Param('id') id: string) { return this.svc.get(r.user, id); }

  // 阶段推进
  @Put(':id/advance') advance(@Req() r: any, @Param('id') id: string) { return this.svc.advanceStatus(r.user, id); }

  // 修改 BOM
  @Put(':id/bom') updateBom(@Req() r: any, @Param('id') id: string, @Body('bom') bom: any[]) {
    return this.svc.updateBom(r.user, id, bom);
  }

  // 导出 BOM Excel
  @Get(':id/bom/export')
  async exportBom(@Req() r: any, @Param('id') id: string, @Res() res: any) {
    const buf = await this.svc.exportBomXlsx(r.user, id);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="BOM_${id.slice(0,8)}.xlsx"`);
    res.send(buf);
  }

  // 验收打勾
  // 保存出图链接
  @Put(':id/drawing')
  updateDrawing(@Req() r: any, @Param('id') id: string, @Body('drawingUrl') url: string) {
    return this.svc.updateDrawing(r.user, id, url);
  }

  @Put(':id/acceptance/:index')
  checkItem(@Req() r: any, @Param('id') id: string, @Param('index') i: string, @Body('done') done: boolean) {
    return this.svc.checkItem(r.user, id, Number(i), done);
  }

  // IoT 交付包
  @Get(':id/iot-package') iotPackage(@Req() r: any, @Param('id') id: string) {
    return this.svc.buildIotHandoffPackage(r.user, id);
  }

  // 指派负责人
  @Post(':id/assign') assign(@Req() r: any, @Param('id') id: string, @Body('assignedTo') uid: string) {
    return this.svc.assign(r.user, id, uid);
  }

  // 更新回款金额
  @Put(':id/paid') updatePaid(@Req() r: any, @Param('id') id: string, @Body('paidValue') v: number) {
    return this.svc.updatePaid(r.user, id, v);
  }
}
