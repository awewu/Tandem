#!/usr/bin/env bash
# 由官方白色 LOGO 描摹 EVERHOT 字标矢量（标准品牌底板 ② 字标层）。
# 依赖：imagemagick + potrace（brew install imagemagick potrace）。
# 用法：bash scripts/trace-wordmark.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="public/assets/img/brand/everhot-logo-white.png"
DEST="public/assets/img/brand/everhot-wordmark.svg"
TMP="$(mktemp -d)"

# 1) 裁出 EVERHOT 字母+swoosh（去掉「恒热」中文），并裁到内容边界
magick "$SRC" -crop 396x95+0+0 +repage -trim +repage "$TMP/letters.png"
# 2) 转双色位图（字 = 黑 / 底 = 白），供 potrace 描摹
magick "$TMP/letters.png" -background black -flatten -threshold 50% -negate "$TMP/letters.pbm"
# 3) 描摹为白填充 SVG（平滑曲线、紧裁）
potrace "$TMP/letters.pbm" -s -C '#ffffff' --tight -o "$TMP/wordmark.svg"
# 4) 去掉 DOCTYPE / 生成器元数据，落地
perl -0pi -e 's/<!DOCTYPE[^>]*>\n//s; s/<metadata>.*?<\/metadata>\n//s' "$TMP/wordmark.svg"
cp "$TMP/wordmark.svg" "$DEST"
rm -rf "$TMP"
echo "wrote $DEST"
