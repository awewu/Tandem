# 文档收敛台账 (Doc Consolidation Ledger)

> 生成器: scripts/doc-consolidation-ledger.js
> 用途: 把散落历史文档需求吸收进 PRD-v2 后, 逐个标处置, 共识后删除冗余, 避免文件紊乱。
> 处置: KEEP 保持权威 / ABSORBED-DELETE 已吸收进PRD可删 / DELETE 历史归档可删 / REVIEW 人工确认。

## 分布

- DELETE: 57
- ABSORBED-DELETE: 56
- KEEP: 13

## KEEP(13)

| 文件 | 行数 | 依据 |
| --- | ---: | --- |
| `docs/CAPABILITY-DECOMPOSITION-AND-RECOMPOSITION.md` | 125 | 保持权威，本 PRD 引用 |
| `docs/DATABASE-BACKEND-ARCHITECTURE.md` | 937 | 保持权威，本 PRD 引用 |
| `docs/DOC-CONSOLIDATION-LEDGER.md` | 159 | 本台账自身 |
| `docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md` | 368 | 保持权威，本 PRD 引用 |
| `docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md` | 188 | 保持权威，本 PRD 引用 |
| `docs/STRUCTURE-ASSET-LEDGER.md` | 83 | 保持权威，本 PRD 引用 |
| `CLAUDE.md` | 138 | 根级运维/构建/Agent 配置, 与 PRD 不重叠, 保留 |
| `DEPLOYMENT-GUIDE.md` | 166 | 根级运维/构建/Agent 配置, 与 PRD 不重叠, 保留 |
| `DESIGN.md` | 223 | 根级运维/构建/Agent 配置, 与 PRD 不重叠, 保留 |
| `INSTALL-GUIDE.md` | 239 | 根级运维/构建/Agent 配置, 与 PRD 不重叠, 保留 |
| `PRD-v2.md` | 281 | 根级权威文档 |
| `PROJECT-CHARTER.md` | 421 | 根级权威文档 |
| `README.md` | 337 | 根级权威文档 |

## ABSORBED-DELETE(56)

| 文件 | 行数 | 依据 |
| --- | ---: | --- |
| `docs/150-TEAM-6-SYSTEMS-PROJECT.md` | 510 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/ARCHITECTURE-DECISION-MATRIX-2026-06-05.md` | 268 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/BACKEND-DATA-LANGUAGE-HIGHEST-STANDARD.md` | 339 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/COMFORT-HOME-STANDARDS-MATRIX.md` | 61 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/COMPETITOR-ANALYSIS-HAIER-AOSMITH.md` | 403 | 竞品研究，已吸收进 PRD 第 4.4 |
| `docs/COMPETITOR-DEEP-ANALYSIS.md` | 357 | 竞品研究，已吸收进 PRD 第 4.4 |
| `docs/COMPLETE-CALCULATION-SYSTEM-v2.0.md` | 506 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/COMPLETE-REWRITE-CHARTER-PRD-SUMMARY.md` | 207 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/DESIGN-CALCULATION-SYSTEM-PROJECT.md` | 307 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/DETAILED-DEVELOPMENT-GUIDE-v5.0.md` | 1584 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/DEVICE-POSITIONING-SOLUTION.md` | 332 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/DOAS-COMPLIANCE-ANALYSIS.md` | 407 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/DOAS-Design-Standard.md` | 190 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/DOAS-IMPLEMENTATION-ROADMAP.md` | 209 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/EVOLUTION-MECHANISM.md` | 405 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/EXPORT-AND-ANALYTICS-GUIDE.md` | 390 | 专题，有效内容已吸收(治理见 governance/ 与台账) |
| `docs/FULL-REWRITE-CHARTER-PRD-TECHNICAL-BLUEPRINT.md` | 476 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/FULL-REWRITE-DATA-API-CONTRACT-DRAFT.md` | 541 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/FULL-REWRITE-START-DECISION-RECORD.md` | 232 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/HVAC-PhD-Level-Analysis-Report.md` | 684 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/INDUSTRY-COMPETITOR-RESEARCH-2026-06-05.md` | 429 | 竞品研究，已吸收进 PRD 第 4.4 |
| `docs/INTEGRATED-PRD-AND-DEV-SPECIFICATION-v5.0.md` | 1123 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/LIFECYCLE-IOT-BRIDGE.md` | 100 | 双栖/IoT/契约约束，已吸收进 PRD 第 4.1 及契约约束 |
| `docs/LOCATION-SERVICE-IMPLEMENTATION.md` | 318 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/MONGODB-MIGRATION.md` | 188 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/PRD-CODE-ASSET-CROSSWALK.md` | 152 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/PRD-Commercial-Hot-Water-Cooling-Design-System.md` | 768 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/PRD-INTEGRATED-FEATURES-v6.0.md` | 703 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/PRD-Rheem-AI-HVAC-Core-Advantages.md` | 280 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/PRD-UPDATE-AND-FEATURES-v5.0.md` | 510 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/PRODUCT-DIFFERENTIATION-DOAS.md` | 336 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/PRODUCT-PORTAL-ARCHITECTURE.md` | 246 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/PROJECT-CHARTER-AND-PRD.md` | 373 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/RHAUTT-NEXUS-DEEP-INDUSTRY-ARCHITECTURE-RESEARCH-2026-06-05.md` | 473 | 竞品研究，已吸收进 PRD 第 4.4 |
| `docs/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md` | 119 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/RHAUTT-NEXUS-GOAL-EVIDENCE-MATRIX.md` | 120 | 专题，有效内容已吸收(治理见 governance/ 与台账) |
| `docs/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md` | 220 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/RHAUTT-NEXUS-LEGACY-FUSION-LEDGER.md` | 138 | 专题，有效内容已吸收(治理见 governance/ 与台账) |
| `docs/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md` | 143 | 双栖/IoT/契约约束，已吸收进 PRD 第 4.1 及契约约束 |
| `docs/RHAUTT-NEXUS-LOCKED-GOAL.md` | 111 | 专题，有效内容已吸收(治理见 governance/ 与台账) |
| `docs/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md` | 139 | 专题，有效内容已吸收(治理见 governance/ 与台账) |
| `docs/RHAUTT-NEXUS-ULTIMATE-DELIVERABLE.md` | 107 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `docs/RHAUTT-NEXUS-WORKFLOW-OUTBOX-CONTRACT.md` | 51 | 双栖/IoT/契约约束，已吸收进 PRD 第 4.1 及契约约束 |
| `docs/RHEEM-PLUG-AND-PLAY-SYSTEM-PACKS.md` | 118 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/RYSNOVA-AI-DIAGNOSIS-C-END-UI-VI-ARCHITECTURE.md` | 515 | VI 专题，已并入宪章第 6 章(实测为准) |
| `docs/RUUD-COM-FULLSITE-VI-AUDIT.md` | 351 | VI 专题，已并入宪章第 6 章(实测为准) |
| `docs/RUUD-VI-RESEARCH.md` | 131 | VI 专题，已并入宪章第 6 章(实测为准) |
| `docs/SYSTEM-INTEGRATION-v2.0.md` | 262 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/SYSTEM-INTEGRITY-HARDENING.md` | 142 | 架构专题，结论已并入宪章第 5 章/重组蓝图 |
| `docs/THREE-TIER-CONTRACT.md` | 191 | 双栖/IoT/契约约束，已吸收进 PRD 第 4.1 及契约约束 |
| `docs/UI-Design-Commercial-Hot-Water-Cooling.md` | 569 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `docs/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md` | 169 | VI 专题，已并入宪章第 6 章(实测为准) |
| `docs/USER-JOURNEY-DATA-ANALYSIS.md` | 305 | 专题，有效内容已吸收(治理见 governance/ 与台账) |
| `docs/WATER-SYSTEM-PRODUCT-MATRIX.md` | 325 | 暖通领域规格，已吸收进 PRD 第 4.3 |
| `PRD-CURRENT.md` | 383 | 历史 PRD/规格，有效内容已吸收进本 PRD |
| `PRODUCT-SCOPE.md` | 364 | 历史 PRD/规格，有效内容已吸收进本 PRD |

## DELETE(57)

| 文件 | 行数 | 依据 |
| --- | ---: | --- |
| `docs/100-DATA-EVOLUTION-SUMMARY.md` | 314 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/ACCELERATED-DEV-COMPLETION-REPORT.md` | 224 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/ACCELERATED-DEVELOPMENT-PLAN.md` | 92 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/ALL-PROBLEMS-FIXED-REPORT.md` | 213 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/API-DOCUMENTATION-v1.0.md` | 509 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-ai-assistant.md` | 27 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-auth.md` | 27 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-bim-export.md` | 27 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-calculation-api.md` | 63 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-construction.md` | 99 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-design.md` | 55 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-devices.md` | 35 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-dxfRoutes.md` | 23 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-exports.md` | 75 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-hotwater.md` | 23 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-rysnova-bim-simple.md` | 23 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-rysnova-bim.md` | 39 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-marketing.md` | 99 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-materials.md` | 55 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-oneclick-api.md` | 39 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-products.md` | 39 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-projects.md` | 31 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-quotation-v2.md` | 35 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-quotations.md` | 63 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-revit-integration.md` | 43 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-smart-routing.md` | 27 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-supreme-api.md` | 95 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-workflows.md` | 51 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/API-workorders.md` | 47 | 手写 API 参考，被 OpenAPI 契约 + 自动生成取代 |
| `docs/BIM-SYSTEM-FIX-REPORT.md` | 270 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/DATA-ARCHITECTURE-INSPECTION-REPORT.md` | 324 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/DELIVERY-REPORT-v2.0.md` | 282 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/DEVELOPMENT-RESULTS-REPORT-v5.0.md` | 295 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/DOAS-PHASE2-PROGRESS.md` | 319 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/DRAWING-MATERIAL-FIX-REPORT.md` | 299 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/EVOLUTION-RESULTS-CYCLE5-9.md` | 290 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/EXECUTION-START.md` | 442 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/FAST-CATCHUP-PLAN.md` | 375 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/FINAL-VERIFICATION-REPORT.md` | 137 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/OPTIMIZATION-COMPLETION-REPORT.md` | 316 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/P0-COMPLETION-REPORT.md` | 197 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/PHASE-1-REWRITE-EXECUTION-CHECKLIST.md` | 274 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/PRD-NAMING-ALIGNMENT-AUDIT-2026-06-05.md` | 63 | 命名候选/审计，命名已锁定(宪章第 1 章) |
| `docs/PRD-REVIEW-COMPLETION-ANALYSIS.md` | 252 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/PROBLEMS-FIXED-REPORT.md` | 111 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/PRODUCTION-TRUNK-REWRITE-PLAN.md` | 176 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/PROJECT-COMPREHENSIVE-SUMMARY.md` | 439 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md` | 91 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md` | 131 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/SOFTWARE-NAMING-CANDIDATES.md` | 124 | 命名候选/审计，命名已锁定(宪章第 1 章) |
| `docs/SOFTWARE-OPTIMIZATION-REPORT-v3.0.md` | 398 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/SUPREME-DEVELOPMENT-PLAN.md` | 547 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/SYSTEM-COMPLETION-REPORT.md` | 295 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/ULTIMATE-FINAL-ACCEPTANCE.md` | 181 | 完成/修复/验收报告，过程记录已落入代码与台账 |
| `docs/WEEK-SPRINT-PLAN.md` | 438 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/migration-roadmap.md` | 70 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
| `docs/task_plan.md` | 97 | 历史开发计划，被 PRD 第 9 章里程碑取代 |
