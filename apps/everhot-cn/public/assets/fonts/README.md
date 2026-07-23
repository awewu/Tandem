# 字体目录 — 阿里巴巴普惠体 3.0（官方 VI 指定）

恒热 VI 规定中英文统一使用 **阿里巴巴普惠体 3.0（Alibaba PuHuiTi 3.0）**。
本目录用于放置 web 字体文件；`css/everhot.css` 的 `@font-face` 已按以下文件名引用。

## 需要放入的文件（woff2）
| 用途 | 字重 | 文件名 |
|---|---|---|
| 内文 45 Regular | 400 | `AlibabaPuHuiTi-3-55-Regular.woff2` |
| 副标 65 Medium | 500 | `AlibabaPuHuiTi-3-65-Medium.woff2` |
| 标题 115 Black/Heavy | 900 | `AlibabaPuHuiTi-3-105-Heavy.woff2` |

## 获取方式
1. 官方下载（免费商用）：https://www.alibabafonts.com/ → 普惠体 3.0，下载对应字重 OTF/TTF。
2. 转 woff2 并**按 unicode-range 子集化**（CJK 全集很大，务必子集化）：
   ```bash
   # 例：用 fonttools
   pip install fonttools brotli
   pyftsubset AlibabaPuHuiTi-3-105-Heavy.otf \
     --unicodes-file=used-codepoints.txt \
     --flavor=woff2 --output-file=AlibabaPuHuiTi-3-105-Heavy.woff2
   ```
3. 放入本目录，文件名与上表一致即可生效。

## 未就位时的行为
`@font-face` 用 `local()` 优先 + `font-display: swap`：
- 装有该字体的机器（设计师/已 `local()`）直接使用；
- 否则回退 `PingFang SC` / `Microsoft YaHei`，站点正常显示，仅非品牌字。
