# rysnova-bim

签单后 · 技术支持深化（施工级深化设计，供真正施工与验收）。

- 使用者：技术支持 / BIM 工程师
- 关键目标：施工 + 验收
- 交付物：施工图 + BOM 明细（细粒度、可采购）+ 最终 3D 效果图
- 用途：领料、预决算、验收交付
- 承接：CRM 签单（`opportunities/:id/sign` 带 `quotationId`）触发从报价单承接项目；施工 BOM 在成本框算 BOM 基础上细化重算，非简单复用

Target NestJS module for BIM, drawings, schematics, standards checks, and engineering artifacts.
