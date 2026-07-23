# public-portal

Target app for the 瑞合瑞德 group public portal.

- Current production surface: `public/index-ready.html`
- Current compatibility surface: `public/index.html`
- Target runtime: Next.js / React / TypeScript
- Product boundary: group portal, brand relationships, 瑞诺瓦 system brand entry, Rheem / Ruud / Everhot equipment brand links
- Independent brand sites: `apps/rheem-cn`, `apps/ruud-cn`, `apps/everhot-cn` — each has its own domain target, brand shell, and content ownership
- Embedded product-module entries: 瑞诺瓦 AI 问诊 and Rysnova technical support / BIM
- Cross-link rule: the portal links to each equipment brand site and 瑞诺瓦 AI 问诊; each brand site links back to the group portal and to 瑞诺瓦 AI 问诊; sibling brand sites link to each other
- Boundary rule: the portal can route users into 瑞诺瓦, Rysnova, and equipment brand sites, but must not absorb any of them into a generic homepage shell
- Status: scaffold only, not production implementation proof
