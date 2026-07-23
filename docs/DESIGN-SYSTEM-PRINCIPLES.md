# 设计系统原则（Figma 精髓 → 代码纪律）

> 来源：Figma 官方 skills（token-creation / componentization / common-patterns）的核心思想，沉淀为本仓库前端布局的统一纪律。
> 适用：`apps/*/public/css`、未来组件库。参照实现：`apps/everhot-cn/public/css/everhot.css` + `apps/everhot-cn/design-tokens.json`。

---

## 1. 一切皆令牌：primitives → semantic → 绑定

- **primitives**：原始值（hex / px），是唯一存放字面量的地方。
- **semantic（语义令牌）**：`bg/text/border`、`space/*`、`radius/*`、`elev/*`，**别名**到 primitive。
- **使用处只引用语义令牌**，绝不内联字面量。换肤/调性只改一处。
- CSS 落地：
  - primitive = 固定值 CSS 变量；semantic = 引用型 `var()`；组件只用语义变量。
  - 禁止内联 `rgba(191,25,36,.05)` 之类——提为 `--red-tint`。

## 2. Auto-layout 是布局原语（≈ flexbox）

一个容器 = **方向 + gap + padding + 对齐 + 尺寸模式**，而非绝对坐标 / 散堆 margin。

| Figma | CSS |
|---|---|
| Auto-layout 方向 | `display:flex; flex-direction` |
| itemSpacing | `gap`（取 `--space-*`） |
| padding | `padding`（取 `--space-*`） |
| Hug contents | `width:fit-content` |
| Fill container | `flex:1` |
| Fixed | 固定值（组件专属尺寸） |

写布局先问三问：横排还是纵排？gap 取哪级令牌？子项 hug 还是 fill？

## 3. 组件化是默认，不是事后

- 元素重复 ≥2 次，或对应一个源组件 → **写一次，复用 N 次**（CSS：一套基类 + 修饰类 `--variant`；JS：主组件 + 实例）。
- **变体走属性/修饰类**（`state=hover`、`size=md`、`is-featured`），不手搓 N 个近似块。
- 组件边界**镜像代码组件边界**：一个 `<Card>` ↔ 一套 `.card` 规则 ↔ 一个 Figma main component。

## 4. 受约束的「尺子」，而非散装值

所有数值落在某把尺上：

- **间距阶**（4px 基数）：`--space-05/1/2/3/4/5/6/7/8/9/10` = 2/4/8/12/16/20/24/32/40/48/64。
- **字号模数阶**：`--fs-display/h1/h2/h3/lead/body/sm`。
- **圆角阶**：`--r-sm/r/lg/xl/pill`。
- **分层电梯**：`--elev-1/2/3`（弹层按层级取用）、`--shadow/shadow-lg`。

落不上尺的值：要么并入尺，要么明确标注为「组件专属尺寸」（如卡片图高 132px）。

## 5. 清晰层级：section → frame → component → instance

- 顶层分区 `<section>` → 区内 auto-layout 容器 → 容器内放可复用组件实例。
- HTML 语义与视觉层级一致，便于 Dev Mode / Code Connect 对照。

---

## 执行检查清单（改布局前自查）

- [ ] 没有内联字面量颜色/阴影？（用语义令牌）
- [ ] 所有 gap/padding 取自 `--space-*`？（精确刻度已 ~191 处转换；非刻度见 `design-tokens README` 复审清单）
- [ ] 用 flex+gap 表达结构，而非 margin 堆叠？
- [ ] 子项尺寸是有意的 hug / fill / fixed？
- [ ] 重复元素是否已抽成基类 + 修饰类？

## 关联文件

- 令牌镜像（Tokens Studio 可导入 Figma Variables）：`apps/everhot-cn/design-tokens.json`
- 导入/Code Connect 指南：`apps/everhot-cn/DESIGN-TOKENS-README.md`
- 参照实现：`apps/everhot-cn/public/css/everhot.css`（`:root` 令牌 + mega-nav 全 token 化）
