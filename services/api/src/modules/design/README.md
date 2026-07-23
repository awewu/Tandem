# design

签单前 · 技术 BIM 设计（粗稿设计 + 成本框算，非施工级）。

- 使用者：设计师、销售人员
- 关键目标：需求梳理 + 报价
- 交付物：2D 原理图 + 3D 示意图（供客户查看、帮助成交）
- 产出的 BOM 为**成本框算 BOM**（粗粒度、算大账），经报价单契约（`quote.source=designer-bom`）流入 CRM
- 分界：CRM 签单后移交 `rysnova-bim` 域做施工级深化

Target NestJS module for 2D plans, device placement, pipe runs, and customer sharing.
