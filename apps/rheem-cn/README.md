# rheem-cn

Rheem 中国独立品牌站。

- Target domain: `rheem.com.cn`
- Current scaffold surface: `apps/rheem-cn/public/index.html`
- Product boundary: Rheem equipment brand public site; presents Rheem products, brand story, and authorized relationship with 瑞合瑞德暖通科技集团
- Cross-link policy:
  - Link back to 瑞合瑞德集团官网 (`apps/public-portal` / `public/index-ready.html`)
  - Link to 瑞诺瓦 AI 问诊 (`apps/consumer-diagnosis` / `public/pain-diagnosis.html`) for system-level comfort solutions
  - Link to Ruud 中国 (`apps/ruud-cn`) and Everhot 中国 (`apps/everhot-cn`) as sibling equipment-brand sites
- ~~**Delivery decision (locked 2026-06-28): EXTERNAL-LINK, NOT self-built.**~~ (superseded)
- **Delivery decision (updated 2026-07-07): SELF-BUILT with dedicated port.** This brand site is now served in-repo as an independent site on its own port (`4014`, `pnpm --filter rheem-cn dev`), mirroring everhot-cn (4011) / lithnova-cn (4013). Production maps it to `rheem.com.cn`.
- Serving: zero-dependency static server `scripts/serve.js`. Maps `/packages/tokens/*` to the monorepo tokens; cross-brand / group / diagnosis absolute links 302-redirect to each site's own port locally (override via `SITE_*_URL` env for production domains).
- Status: self-built static site on port 4014 (scaffold content; product data & visual assets pending brand-side confirmation)
