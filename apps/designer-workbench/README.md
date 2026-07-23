# designer-workbench（瑞诺瓦 RysNova BIM 设计工作台）

瑞诺瓦（RysNova）产品旗下的销售设计师 / BIM 设计工作台。

- Current compatibility surface: `public/designer.html` + Next.js 页面
- Target runtime: React / TypeScript / Canvas (Konva) / Three.js (ThatOpen)
- Product boundary: 2D plan, device placement, BOM, quotation, customer share, AI design, IFC viewer, Revit cloud sync
- Status: active implementation; the old `apps/rysnova-bim-workbench` scaffold has been merged into this app
- Powered by Rhautt Comfort（瑞合瑞德集团技术平台）

## 依赖安装

```bash
cd apps/designer-workbench
npm install
```

主要依赖：
- `three`, `@thatopen/components`, `@thatopen/components-front` — 3D IFC viewer
- `konva`, `react-konva` — 2D floor plan canvas

## 路由总览

| 路由 | 能力 | 对应 sprint |
|------|------|------------|
| `/viewer` | ThatOpen IFC viewer，支持 `?artifactId=` 与本地文件 | 3.1 |
| `/floor-plan` | 户型画布（墙/房间/CAD 底图）、布管吸附、设备放置、边画边算 | 3.2-3.6 |
| `/system-model` | 分系统设备管理与 assetRef 绑定 | 3.4 |
| `/bom` | 工程图 + BOM 综合页，支持打印/PDF 导出 | 3.5 |
| `/ai-design` | AI 方案生成（自然语言需求 → 方案草案） | 4.1-4.3 |

## W-BIM-4 · ThatOpen IFC Viewer

新增 `/viewer` 路由，基于 ThatOpen 组件封装：

- `components/ThatOpenViewer.tsx`：IFC 加载、剖切、构件显隐、双击选中
- `src/app/viewer/page.tsx`：页面入口，支持 `?artifactId=xxx` 自动加载已审批产物
- 依赖：`three`、`@thatopen/components`、`@thatopen/components-front`

### 本地运行

```bash
cd apps/designer-workbench
npm install
npm run dev
```

打开 `http://localhost:5003/viewer`。

### Smoke test

1. 把 `experiments/thatopen-spike/small.ifc` 复制到 `public/small.ifc`
2. 打开 `http://localhost:5003/viewer`
3. 点 **加载示例** → 应 3 秒内加载完成
4. 点 **剖切** 开启 → 点 **放剖切面** → 双击模型确认剖切面出现
5. 双击选中某个构件 → 点 **隐藏选中** → 点 **恢复显示**

### 加载已审批产物

```
http://localhost:5003/viewer?artifactId=<file-artifact-id>
```

组件会自动请求 `/api/file-artifact/<id>/base64` 并把 base64 解码为 IFC buffer。
