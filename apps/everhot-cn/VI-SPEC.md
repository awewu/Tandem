# 恒热 EVERHOT — VI 规范摘录（来源：VI-2026新（定版）.pdf，33 页）

> 本文件是把官方 VI 手册"整合吸收"进站点设计系统的事实源。CSS 令牌见 `public/css/everhot.css` 的 `:root`。

## 标准色（Standard Color）
主色调 **恒热红**：品牌输出主色，**避免大面积使用，比例 ≤ 30%**，须配合次级色使用。
次级色（**中性灰**，主要用于背景填充）：

| 名称 | RGB | HEX | CMYK |
|---|---|---|---|
| EverHot Red 恒热红 | 191, 25, 36 | `#BF1924` | 32/100/98/1 |
| EverHot Black | 47, 48, 47 | `#2F302F` | 80/74/73/48 |
| EverHot Dark Gray | 81, 82, 83 | `#515253` | 73/66/62/18 |
| EverHot Grey | 134, 137, 139 | `#86898B` | 54/44/41/0 |
| EverHot White | 255, 255, 255 | `#FFFFFF` | 0/0/0/0 |

注意：官方中性色是**冷/中性灰**，不是暖色（espresso/taupe）。旧 CSS 的暖色调与红值 `#C8102E` 均为 off-spec，已更正。

## 辅助色（Auxiliary，仅点缀，须配合主色+次级色）
家用系列 / 商用渐变（暖）：

| 名称 | RGB | HEX |
|---|---|---|
| Yellow | 242, 176, 61 | `#F2B03D` |
| Orange | 216, 99, 47 | `#D8632F` |
| Burgundy | 108, 21, 37 | `#6C1525` |

可持续发展（冷）：

| 名称 | RGB | HEX |
|---|---|---|
| Light Teal | 65, 169, 169 | `#41A9A9` |
| Dark Teal | 57, 128, 135 | `#398087` |
| Chartreuse | 138, 174, 66 | `#8AAE42` |
| Green | 100, 134, 60 | `#64863C` |

## 标准字体（Standard Font）
中文 & 英文统一：**阿里巴巴普惠体 3.0（Alibaba PuHuiTi 3.0）**。
权重映射：标题 **115 (Black/Heavy ≈ 900)**、副标 **65 (Medium ≈ 500)**、内文 **45 (Regular ≈ 400)**。
字体文件放 `public/assets/fonts/`（见该目录 README）；未就位时回退系统字。

## LOGO
重磅大写 **EVERHOT** + 红色弧形（swoosh，象征热水器内胆形态）+ **恒热**。
三种锁定：红/浅底、黑（深）、白字红底反白。可持续 logo 仅用于空气能产品，使用时一半覆盖于产品上。

已从 VI 手册第 2 页提取官方主锁定（按"红度"通道抠图，保留抗锯齿、去除构图网格/底色）：
- `public/assets/img/brand/everhot-logo.png` — 恒热红，透明底（页眉/浅底）。
- `public/assets/img/brand/everhot-logo-white.png` — 反白版（页脚/深底）。
站点以 CSS 背景图呈现于 `.logo`，原 `EVERHOT/恒热` 文字保留作 SEO/无障碍但视觉隐藏。
提取脚本：`/tmp/vi/extract_logo.py`（如需重生成，可移入 repo `scripts/`）。

## 标准品牌底板（Baseplate · LOCKED）
所有画面（hero / 深色区块 / 海报 / banner）以**统一底板**作为标准底层，构成 Everhot 设计语言的可识别基底。

**三要素锁定（不可改动）：**
1. **技术制图栅格参考线** — 左右各两条竖线 + 上下横线，呈"工程蓝图/构造网格"观感。
2. **椭圆双线 LOGO 容器轮廓** — 居中细线描边椭圆环（双线）。
3. **EVERHOT 幽灵字** — 官方字标矢量（含 swoosh），半透明水印。

**颜色可创意：** 线稿统一为**白色半透明**，与底色解耦，可叠加在任意创意色底上。换色只改背景，线稿恒定。

实现（两层，全站统一规则见 everhot.css「标准品牌底板」段）：
- **① 线稿层**（`::before`）：`public/assets/img/brand/everhot-baseplate.svg`（viewBox 1024×569，栅格+椭圆双线，白色半透明，透明底）。
- **② 字标层**（`::after`）：`public/assets/img/brand/everhot-wordmark.svg` —— **官方 EVERHOT 字标矢量**，由 `everhot-logo-white.png` 经 potrace 描摹（含 swoosh），白填充，叠加时 `opacity:.08`。复现脚本：`scripts/trace-wordmark.sh`。
- 统一套用到所有品牌色表面：`.section-dark / .section-cta / .section-green / .page-hero / .pd-hero / .ev-brandfield / .eh-baseplate`；首页 `.hero` 仅叠线稿层（`screen` 混合，不压标题）。
- 颜色由各表面自身背景决定（**创意色轴**）；通用 `.eh-baseplate` 默认恒热红，变体 `--ink / --teal / --ember`，或就地覆盖 `--baseplate-bg`。
- 三要素几何**锁定**：改 SVG 或那条统一规则即全站生效，杜绝碎片化。

## 品牌口号
**为爱恒热 / EVERHOT FOR EVERLOVE**　副标示例：高效中央热水解决方案引领者。
