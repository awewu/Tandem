# W-BIM-5 · Sprint 5 启动文档

> 日期：2026-07-06
> 目标：生态对齐 + 角色阶梯打磨（Revit 插件命名空间统一、云端能力契约、BIM 角色阶梯）

## 1. 范围

- **5.1 Revit 插件生态对齐**
  - 统一 API 命名空间：`/api/rysnova-bim/*`
  - 统一云端能力契约：碰撞检测、IFC 导出、工程量统计
  - 与 ThatOpen viewer / designer-workbench 产物互通
- **5.2 BIM 角色阶梯**
  - 销售（sales）→ 只能产出 `estimate`
  - 技术支持/工程师（engineer）→ 可提升为 `verified`
  - 设计师（designer）→ 可处理 `insufficient_data` 并产出 `verified`

## 2. 已交付文件

- `services/api/src/modules/rysnova-bim/cloud-capability.service.ts`
- `services/api/src/modules/rysnova-bim/cloud-capability.controller.ts`（已加 `@Roles`，仅 engineer/designer/管理员可调用）
- `services/api/src/modules/rysnova-bim/bim-role.policy.ts`
- `revit-plugin/README.md`（命名空间统一）
- `services/api/src/modules/ai-design/ai-design.controller.ts`（角色装饰）
- `docs/W-BIM-5-3-BENCHMARK-REGISTRY-2026-07-06.md`（5.3 登记册刷新）

## 3. 验收标准

- [x] Revit 插件 README 与后端 API 路径一致
- [x] `/api/rysnova-bim/cloud/clash` 可返回占位结果
- [x] `/api/rysnova-bim/cloud/ifc` 可返回占位结果
- [x] `/api/rysnova-bim/cloud/boq` 可返回占位结果
- [x] AI 设计端点按角色阶梯限制访问
- [x] 云端能力端点按角色阶梯限制访问
- [x] 5.3 竞品/标杆登记册季度刷新

## 4. 风险

- 真实 BVH 碰撞引擎、IFC 生成引擎需要后续算法投入
- Revit 插件 C# 代码侧仍需实际对接新的 `/api/rysnova-bim/cloud/*` 路径
