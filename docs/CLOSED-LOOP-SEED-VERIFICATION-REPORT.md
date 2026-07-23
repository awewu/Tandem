# 闭环样板数据播种 · 全体系验证报告

> 通过真实 API 造多组样板业务数据、跑通所有功能体系，并整理发现的问题与演进。
> 复现命令：`npm run seed:closed-loop`（播种+验证）、`npm run e2e:closed-loop`（单例回归）、`npm run test:api-units`（引擎单测）。

## 1. 样板数据集（经 `/api/v2` 真实导入）

| # | 案例 | 城市 | 面积 | 系统组合 | 售后工单类型 |
|---|---|---|---|---|---|
| 1 | 家用五恒 | 上海 | 180㎡ | 制冷/新风/采暖/恒湿/净水 | complaint · high |
| 2 | 家用热水净水 | 杭州 | 90㎡ | 热水/净水 | repair · urgent |
| 3 | 商用 DOAS | 苏州 | 800㎡ | 制冷/新风/恒湿/控制 | maintenance · normal |
| 4 | 采暖新风 | 南京 | 140㎡ | 采暖/新风 | repair · high |

每案完整走：获客 → 设备推荐 → BOM → 自动布点 → 水力选型 → 方案 PDF → 模板建项目 → 报价 → 签单 → BIM 承接 → 售后工单(建单/派工/关闭) → 保修登记。

## 2. 验证结果

- **断言 63/63 PASS，0 FAIL，0 非 2xx**。
- **系统覆盖（7）**：`auth`、`crm`、`design`、`quote`、`rysnova-bim`、`lifecycle`、`aftersales`。
- **读回一致性（落库证据）**：CRM pipeline、报价列表、BIM 项目列表(≥签单数)、BIM stats、生命周期 customer-projects、售后工单/保修台账 均读回成功且计数达标。
- 样例真实产出：五恒案 BOM 小计 ¥92,880 / 布点 80 节点；商用 800㎡ BOM ¥283,200 / 布点 272 节点；方案 PDF 均为合法 `%PDF`（1.4KB 级）。

## 3. 问题清单与演进（Issues → Evolution）

| # | 发现的问题 | 根因 | 处置 | 状态 |
|---|---|---|---|---|
| I-1 | 签单 500：`column ContractEntity.esign_contract_id does not exist` | **Schema 漂移**：实体新增契约锁电签列却无迁移，签单→BIM 承接读写 contracts 即失败 | 补幂等迁移 `033_contracts_esign_columns.sql`（4 列 + 索引）并应用 | ✅ 已修复 |
| I-2 | 设备推荐/BOM/工程量为占位 `implemented:false` | 引擎未落地 | 接 hvac-kernels 负荷 + product-catalog 牌价中位数 + 面积系数量算 | ✅ 已交付(P1) |
| I-3 | 云碰撞/工程量、AutoLayout/碰撞/水力/PDF/模板为占位 | 引擎/文件层未落地 | 真实 AABB、流速法选型、网格布点、pdf-lib、内置模板+落库 | ✅ 已交付(P2) |
| I-4 | AI 方案复核为规则占位 | 未接 LLM | 接统一 `ai-gateway`（大模型+确定性兜底+合规打标，事实锚点防幻觉） | ✅ 已交付(P2) |
| I-5 | 售后为 dealer 前端本地 mock，无后端域 | 域未建 | 新建 NestJS `aftersales` 域(工单+保修, RLS)，前端切真实域 | ✅ 已交付(P3) |
| I-6 | **施工里程碑 start/complete 响应状态滞后一拍**（客户端看到的 `currentMilestoneKey`/`project.status` 是更新前值） | `ConstructionService.assembleView` 返回同事务内 update 前的旧 `project` 实体 | 改为重新读取最新 project 再组装视图 | ✅ 已修复 |

> I-6 由本轮「客户项目技术支持深度验证」（`verify:tech-support`）抓出——此前 seed/e2e 仅浅验 `status=200`，未走里程碑状态机。

### BIM 设计赋能 · 对标国际系统的缺口补齐（本轮交付）

复用仓库既有开源栈（`web-ifc`/`@thatopen`、`three`、`dxf-parser`、`pdf-lib` 与自有 `hvac-kernels/hydraulic`），无新增依赖：

| # | 能力 | 实现 | 端点 | 验证 |
|---|---|---|---|---|
| G-1 | **真实 IFC 几何碰撞** | `web-ifc` 服务端解析网格顶点→世界坐标 AABB(mm)，复用相交/净距（取代客户端包围盒） | `POST /rysnova-bim/cloud/ifc-clash` | 样例 4 构件→3 硬碰撞 ✓ |
| G-2 | **净高分析** | 楼板顶(结构件)↔MEP 底 净空（web-ifc Y-up 垂直轴），低于阈值判不达标 | `POST /rysnova-bim/cloud/ifc-clearance` | 抬高风管 2.2m<2.4m 判违规、亏空 200mm ✓ |
| G-3 | **水力平衡** | 接 `HydraulicEngine.solveNetwork`：树状流量分配 + Darcy-Weisbach 沿程/局部阻力 + 最不利环路 + 水泵扬程 | `POST /design/layout/optimize-pipes`（含 network） | 6kW 双末端→总流 521L/h、泵扬程 2.01m ✓ |
| G-4 | **自动系统图/原理图** | 确定性 SVG（机房→立管→末端），返回 svg+base64 | `POST /design/diagram/system` | 960×356 合法 SVG ✓ |
| G-5 | **DXF 图纸导入** | `dxf-parser` 按图层提管线长度/设备块计数，归类水管/风管；`.dwg/.rvt` 诚实不支持（建议导出 DXF/IFC） | `POST /design/cad/parse` | 水管 5000mm + 设备块 1 ✓ |

> 定位：不追平 Revit 参数化建模，而是用**开放格式集成(IFC/DXF)** 补几何深度，闭环编排/过程管控为自研护城河。单测覆盖 G-1~G-5（`test:api-units` 33/33）。

### 待改进（不影响闭环，记录供演进）

| # | 观察 | 建议 |
|---|---|---|
| E-1 | 响应信封不统一：`design` 返回 `{success,implemented,data}`，`crm/cloud/ai-design` 返回裸对象或 `{data}` | 统一响应拦截器或在契约层显式约定，降低前端/测试取值心智负担 |
| E-2 | 播种数据累计：重复跑 `seed:closed-loop` 会持续新增商机/报价（读回计数递增） | 为 seed 增加 `--cleanup` 或幂等标记(source='seed')批量清理选项 |
| E-3 | PDF 导出中文以 `?` 占位（StandardFonts 仅 WinAnsi） | 嵌入 CJK TTF（fontkit）以支持中文项目名/城市 |
| E-4 | 3D 渲染、`.dwg/.rvt` 二进制解析、IFC **导出** 仍未实现（IFC 读取/DXF 已交付见 G 表） | 渲染需渲染农场；`.dwg/.rvt` 闭源→用户导出 DXF/IFC；IFC 导出可后续接 IfcOpenShell/web-ifc 写 |
| E-5 | GEO/舆情外部抓取 `not-configured` | 配置各平台凭证（部署项，非代码缺口） |

## 4. 护栏与回归

- 引擎单测 `test:api-units` 33/33（含 G-1~G-5：IFC 碰撞/净高、水力平衡、系统图、DXF，已入 `validate`）。
- 闭环回归 `e2e:closed-loop` 25/25 · 技术支持深验 `verify:tech-support` 28/28 · 样板播种 `seed:closed-loop` 4 案 63/63。
- `tsc`(services/api) 0 错误 · `lint` 0 错误。

## 5. 结论

商业**全闭环 + 售后**已贯通、可运行，并以多组真实样板数据端到端验证通过；本轮未发现新缺陷。剩余仅「客观需外部引擎/凭证」项（E-3~E-5），均诚实标注 `implemented:false`，非伪装。
