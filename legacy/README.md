# legacy/ 归档区

本目录存放经资产盘点裁定为 ARCHIVE 的真孤儿代码:全仓零接线、不在任何注册表/路由 catalog/legacy-fusion-registry/退役矩阵中登记。
移动依据见 audit/asset-ledger.md(裁定层)与 PROJECT-CHARTER.md 第 8.2 节。

保留(不直接删)的原因:留作迁移期参考证据,确认替代实现稳定后再物理删除。

| 文件 | 原路径 | 裁定依据 |
|---|---|---|
| server/routes/solution-visual-packages.routes.js | server/routes/ | 未被 productionRouteCatalog 挂载, 全仓零接线 |
| server/models/Construction.js | server/models/ | 零静态接线(施工能力由 ConstructionManager 承载) |

注:被 V2/V3 取代的旧版引擎(LoadCalculationEngine/QuotationEngine 等)不在此目录,它们仍在 engineRegistry 活跃登记,归 audit/legacy-fusion-registry.json 的 migrate/retire 治理流程管辖,须先切引用再退役。
