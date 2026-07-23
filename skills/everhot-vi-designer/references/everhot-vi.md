# Everhot 恒热 — VI Reference

## How the palette was confirmed (method, repeatable)
Source: `VI-2026新（定版）.pdf` → rendered to JPG/PNG at `/tmp/vi/p-01..33`.
Process: for every page, downscale and classify each pixel by HSV into
white / black / gray / red / orange / yellow / green / cyan / blue / purple / pink.
Aggregate across all 33 pages.

Result (chromatic mass):
```
gray 63.3%  red 24.4%  white 6.4%  orange 3.1%  black 1.5%
blue 0.56%  cyan 0.28%  green 0.24%  yellow 0.14%  pink 0.01%
```
Conclusion: brand = RED + warm neutrals, warm orange/copper secondary.
Blue/cyan/green are sub-1% JPEG/anti-alias noise → NOT brand colors.

Modal saturated red sampled from swatch-heavy pages (p-29/33/17/27):
`#ba1925`, `#a81824`, `#c2222a` cluster → production token `--red:#C8102E`
(a clean, warm crimson sitting in that measured range).

## Why warm, not cold
User directive: "完全没有温暖厚重的感觉。我的VI资料中哪里有蓝色的？去掉或弱化！！"
=> Everhot reads as warm + heavy (温暖厚重). Neutrals are warmed (taupe/cream/espresso),
not the cool grays Rheem uses. This is the key visual difference from rheem.com:
**same architecture, warmer skin.**

## Palette (copy-paste :root)
```css
:root{
  --red:#C8102E; --red-dk:#8E0E20;
  --dark:#2C1C18; --ink:#271E1B;
  --gray:#6B5E57; --gray-lt:#A6968C;
  --border:#E4DCD4; --border-lt:#F0EAE4;
  --surface:#F7F2EC; --page:#FFFFFF;
  --accent:#B5642A;            /* warm copper */
  --green:#B5642A; --navy:#2C1C18; /* legacy aliases → warm */
}
```

## Component recipes (rheem.com parity, Everhot skin)
- Utility bar: white, 12px, warm hairline bottom border, right side links to 专业人士/经销商 + 集团跳转.
- Masthead: white, sticky, `height:68px`; `.brand-line{height:4px;background:var(--red)}` directly under it.
- Logo: `EVERHOT` 900-weight in `--red` + `恒热` small in `--gray`.
- Primary nav: 14px 700, hover/active = red text + 3px red bottom border. No radius.
- Mega-nav: three audiences (家用/商用/专业人士) + 关于恒热; featured column uses `--surface`.
- Hero: full-bleed video/poster; eyebrow + bold headline; dark scrim.
- Dual-entry: two large cards 家用 RESIDENTIAL / 商用 COMMERCIAL.
- Dark bands (innovation / CTA / page-hero): `background:var(--dark)` espresso, white text, red eyebrow.
- Cards: white, `--border`, radius 8px, hover `border-color:var(--red)`.
- Tag chips: `.sel-tag{background:#FFF0F2;color:var(--red)}`,
  `.sel-tag-com{background:#F3E7E0;color:var(--dark)}`,
  `.sel-tag-pro{background:#F5E9DD;color:var(--accent)}`.
- Stats (sustainability): big number in `--accent` copper.
- Footer: warm, multi-column (家用 / 商用 / 支持服务 / 集团品牌) + bottom bar with ICP.

## Banned values (search-and-destroy)
`#1B365D`, `#E4002B` (old Rheem red — Everhot uses #C8102E), `rgba(27,54,93,*)`,
`rgba(228,0,43,*)`, `#EEF2FF`, `#EEF2F7`, literal `blue`/`navy`/`cyan`, green hues.

## Product data (data-driven, swappable DB)
Model specs live in a single swappable layer, NOT hardcoded in page HTML:
- `public/everhot/js/products-data.js` → `window.EVERHOT_PRODUCTS` (array) +
  `window.EVERHOT_CATALOG.by(cat,sys)` / `.one(slug)` helpers.
- `public/everhot/js/catalog.js` renders from that data:
  - category grids via `<div class="product-grid" data-catalog="residential:water-heating"></div>`
  - homepage featured via `data-featured="residential" data-count="6"`
  - detail page via `<div data-product-detail></div>` + URL `?model=<slug>`
- Detail page lives at `public/everhot/products/detail/` and injects Product JSON-LD.
Each product record: `slug,name,en,series,cat,sys,icon,image,tagline,badges,highlights[],features[],specs[]`.
When real data lands, replace `window.EVERHOT_PRODUCTS` with the same shape (point `image`
to real product photos, set real model codes in `specs`); pages re-render with no HTML edits.
Do NOT reintroduce static `型号待上传` cards or `查看详情` links that dead-end at find-a-pro —
cards now link to real detail pages.
