# ThatOpen Spike（W-BIM-4 选型验证）

蓝图：`docs/RYSNOVA-BIM-MOAT-ARCHITECTURE-AND-EVOLUTION-BLUEPRINT-2026-07-05.md` §6.7 / W-BIM-4。

隔离实验，不进主依赖树。验证三件事：

1. `@thatopen/components` 世界初始化（three.js MIT）
2. `web-ifc` (WASM, MPL-2.0) 加载 IFC → `@thatopen/fragments` 模型
3. 剖切 / 构件选中 / 显隐（对标优筑家 viewer 体验，§6.7 第 7 项）

## 运行

```bash
cd experiments/thatopen-spike
npm install
npm run dev
```

打开页面 → 点"加载 IFC"选一个 .ifc 文件（测试样例可用 ThatOpen 官方 sample 或任意 Revit 导出 IFC）。

## 通过标准（验收）

- [x] IFC 加载成功且秒级完成（中小模型）—— `small.ifc`（`just_wall.ifc`）0.40s 加载成功。
- [x] 剖切面可创建/删除——工具栏新增“放/删剖切面”按钮验证通过。
- [x] 双击选中构件、隐藏/恢复正常——验证通过。
- [x] 许可证确认：three(MIT)/components(MIT)/web-ifc(MPL-2.0)/fragments(开源) 全部可商用。

**验收结论**：2026-07-06 浏览器手动验收通过，可在此底座上开建 HVAC 参数化几何层（§6.7 第 2 项）。

> 测试样例已换为 ThatOpen 官方可用资源：`https://thatopen.github.io/engine_fragment/resources/ifc/just_wall.ifc`（原 `engine_components/resources/small.ifc` 404 失效）。
> 调试记录：初始 `main.js` 未初始化 `FragmentsManager`，导致 `加载失败：You need to initialize fragments first.`，已按 3.4 API 补全。
