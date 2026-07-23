import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { BrandRegistryService } from './brand-registry.service';

/**
 * 品牌注册表 API（/api/v2/brands）。配置驱动、只读。
 * 各品牌站（public-portal / everhot-cn / lithnova-cn ...）与后台 brand-console 消费此处，
 * 禁止在前端硬编码品牌命名/VI/NAP。新增品牌 = 往 brand-registry.json 加一条，自动出现在此。
 */
@Controller('brands')
export class BrandRegistryController {
  constructor(private readonly svc: BrandRegistryService) {}

  /** 品牌清单（摘要）。可选过滤：?type=brand-site&selfBuilt=true */
  @Public()
  @Get()
  list(@Query('type') type?: string, @Query('selfBuilt') selfBuilt?: string) {
    return this.svc.list({
      type: type || undefined,
      selfBuilt: selfBuilt === undefined ? undefined : selfBuilt === 'true',
    });
  }

  /** 治理元数据（供应商定位、已决/待决事项）。放在 :slug 之前避免路由冲突。 */
  @Public()
  @Get('_meta')
  meta() {
    return this.svc.meta();
  }

  /** 单品牌完整要素。 */
  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.svc.get(slug);
  }

  /** 重载注册表（改文件后触发）。默认受全局 AuthGuard 保护。 */
  @Post('reload')
  reload() {
    return this.svc.reload();
  }
}
