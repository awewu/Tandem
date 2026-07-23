---
name: everhot-vi-designer
description: Design, build, and review Everhot (恒热) brand sites and UI. Everhot pages MUST replicate rheem.com architecture/layout/IA while using the EVERHOT warm-red brand identity (NO blue/navy). Use when creating or critiquing Everhot pages, the everhot-cn site, brand visuals, color usage, or when verifying an Everhot screen feels warm, heavy, and on-brand rather than cold or generic.
---

# Everhot VI Designer (恒热)

## Overview
Everhot 恒热 is a water-heating / HVAC brand under 瑞合瑞德暖通科技集团 (Rhautt Comfort).
Strategic rule: **clone rheem.com's architecture, IA, and layout patterns, then reskin with the Everhot brand color.** Do not "innovate" the structure — replicate it and substitute branding (logo + palette + copy). Product model data is DB-backed and swappable via a data layer (`js/products-data.js` + `js/catalog.js`); seed it with creative placeholder models now, swap for real data later with no HTML edits.

## Brand color — CONFIRMED FROM OFFICIAL VI-2026 MANUAL
The palette was verified by pixel-analysis of ALL 33 pages of `VI-2026新（定版）.pdf`:
- RED is the dominant chromatic mass (~24% of all chromatic pixels).
- Warm orange/copper is the secondary accent (~3%).
- Blue 0.56%, cyan 0.28%, green 0.24% — all NEGLIGIBLE NOISE. **There is NO blue/navy/green in the Everhot VI.**

Tone goal in the user's words: **温暖厚重 (warm + substantial / heavy).** The brand must feel like warm crimson + espresso + cream, never cold corporate blue.

### Tokens (current site implementation, `public/everhot/css/everhot.css`)
| Token | Hex | Role |
|---|---|---|
| `--red` | `#C8102E` | warm crimson brand red (VI-sampled #ba1925–#c2222a range) |
| `--red-dk` | `#8E0E20` | deep brand red, hover/pressed |
| `--dark` | `#2C1C18` | warm espresso — heavy dark bands (replaces navy) |
| `--ink` | `#271E1B` | warm near-black text |
| `--gray` | `#6B5E57` | warm taupe body text |
| `--gray-lt` | `#A6968C` | warm light grey |
| `--border` | `#E4DCD4` | warm border |
| `--border-lt` | `#F0EAE4` | warm hairline |
| `--surface` | `#F7F2EC` | warm cream surface |
| `--accent` | `#B5642A` | warm copper accent (stats, sustainability) |
| `--page` | `#FFFFFF` | page bg |

Legacy aliases `--navy` and `--green` are intentionally remapped to warm tones (`--dark`/`--accent`) so any legacy reference stays on-brand. Never reintroduce literal `#1B365D`, `rgba(27,54,93,*)`, blue, cyan, or green.

## Hard rules (do / don't)
- DO use red as the decisive accent: masthead 4px brand line, primary buttons, active nav underline, eyebrows, key stats.
- DO use warm espresso `--dark` for hero/innovation/CTA dark bands and cream `--surface` for alt sections.
- DO keep rheem.com layout DNA: utility bar, sticky white masthead + 4px red line, three-audience mega-nav (Homeowners 家用 / Commercial 商用 / Professionals 专业人士) + About, page-hero + breadcrumb, card grids, dark CTA band, multi-column footer.
- DON'T use blue / navy / cyan / green anywhere. If you see them, it's a bug — replace with the warm palette.
- DON'T leave dead `href="#"` links, and DON'T hardcode `型号待上传` product cards. Product cards are rendered from `window.EVERHOT_PRODUCTS` and link to real detail pages (`products/detail/?model=<slug>`).
- DON'T redesign structure away from rheem.com parity.

## rheem.com IA parity checklist (Everhot must cover)
Top nav: Homeowners, Commercial, Professionals, About (+ Innovation, Sustainability standalone).
Support cluster (rheem has these → Everhot equivalents already built):
- `warranty/` 保修服务 (serial lookup + warranty terms)  ← rheem `warranties/`
- `faqs/` 常见问题 (FAQPage schema)  ← rheem `faqs/`
- `contact/` 联系我们 (Organization schema)  ← rheem `help-and-support`
- `rebates/` 节能补贴 / 以旧换新  ← rheem `rebate-center` / `federal-incentives`
- `find-a-pro/` 查找经销商  ← rheem `find-a-pro`
- `support/` 支持中心 hub linking all of the above.

## Product data layer (swappable DB)
- `js/products-data.js` exposes `window.EVERHOT_PRODUCTS` (24 seeded Everhot models, 6 per cat/sys) + `window.EVERHOT_CATALOG.by(cat,sys)` / `.one(slug)`.
- `js/catalog.js` renders category grids (`data-catalog="cat:sys"`), homepage featured (`data-featured`), and the detail page (`data-product-detail` + `?model=<slug>`), and injects Product JSON-LD.
- Detail template: `products/detail/index.html`. Record shape: `slug,name,en,series,cat,sys,icon,image,tagline,badges,highlights[],features[],specs[]`.
- To go live: replace `window.EVERHOT_PRODUCTS` with same-shape real data (real `image` + model codes); no page HTML changes needed.

## GEO / SEO (charter requirement)
Every page keeps: canonical, OG + Twitter meta, JSON-LD (WebPage/FAQPage/Organization/Product + BreadcrumbList), semantic headings, crawlable static HTML, sitemap.xml entry, theme-color `#C8102E`.

## Verify before done
1. `grep -rniE "1b365d|27, *54, *93|[^-a-z]blue|navy|cyan|#eef2ff|#eef2f7" public/everhot` → must be clean (only the comment noting "no blue").
2. `grep -rn 'href="#"' public/everhot` → must be empty; `grep -rn '型号待上传' public/everhot` → must be empty (data-driven now).
3. All internal `/everhot/.../` link targets exist on disk; sitemap covers new pages + product detail URLs. `node -c js/products-data.js && node -c js/catalog.js` pass.
4. Run the site (`python3 -m http.server` from `public/`) and screenshot; confirm warm/heavy feel, red accents, no cold tones, no text overflow, logo renders.

## References
- `references/everhot-vi.md` — full palette rationale, pixel-analysis method, and component recipes.
