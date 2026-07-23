<!-- ⚠️ DEPRECATED 2026-07-03: 内容已整合入 skills/rheem-design-director/references/RHEEM-VI-STANDARD.md，以该文件为准。-->

# Rheem Official VI Standard

This standard summarizes Rheem official website patterns for Rheem-branded product UI and brand work. Refresh with live official pages before major brand decisions.

## Source Pages

- Rheem Water: `https://www.rheem.com/products/water`
- Residential Water Heating: `https://www.rheem.com/products/residential/water-heating/`
- Residential Heating & Cooling: `https://www.rheem.com/products/residential/heating-and-cooling/`
- Commercial Water Heating: `https://www.rheem.com/products/commercial/water-heating/`
- Commercial Water Heating Products & Specs: `https://www.rheem.com/products/commercial/water-heating/products-and-specs/`
- Commercial solutions and official PDFs under `media.rheem.com` / `files.rheem.com`

## Brand Personality

Rheem presents itself as reliable, technically proven, efficient, sustainable, and service-backed.

Core brand themes:

- Dependability: equipment that performs day after day, year after year.
- Efficiency: high efficiency, lower energy bills, energy savings, rebates, tax credits.
- Sustainability: lower carbon footprint, Energy Star, low-GWP refrigerant, zero on-site emissions for heat pump water heaters.
- Protection: leak detection, leak prevention, warranties, peace-of-mind performance.
- Expertise: local experts, application consulting, training, commercial support.
- Availability: local stock, next-day delivery, 24-hour emergency pick-up for commercial water.
- Coverage: residential and commercial, water heating, heating/cooling, pool/spa, home innovations, EcoNet.

Avoid reducing Rheem to decoration. The brand should feel like engineered trust.

## Voice And Copy

Use direct benefit-led headings:

- "Powering your business with an endless supply of hot water"
- "Tested. Trusted. Tough."
- "Save Today. Save Tomorrow."
- "Lower Energy Bills. Smaller Carbon Footprint"
- "Peace of Mind Performance"
- "One partner. Infinite solutions."

Copy style:

- Short headings with strong verbs or concrete benefits.
- Product claims tied to numbers when possible: efficiency, UEF, savings, warranty, delivery time.
- CTA labels are direct: `Learn More`, `Find a Pro`, `Get Financing`, `Find Rebates`, `Contact Rheem`, `See All`.
- Residential language is comfort, savings, protection, convenience.
- Commercial language is uptime, expert support, availability, application fit, training, specification.
- For Chinese localization, use `rheem-chinese-localization.md` to preserve Rheem's rhythm and industrial confidence instead of literal translation.

## Visual Identity

Use official Rheem US / rheem.com-aligned tokens when working in this repo:

- Rheem primary red: `#E4002B`
- Dark red: `#A00F28`
- Light red: `#E8455F`
- Neutral dark: `#2D2D2D`
- Neutral gray: `#4A4A4A`
- White and light gray surfaces should carry most UI area.

Rheem red is an action and identity color, not a full-screen background treatment. Use it for:

- Primary CTA
- Active navigation
- Section markers
- Important status
- Brand-led accents
- Key metrics

Use neutrals for:

- Data surfaces
- Dashboards
- Tables
- Product comparison
- Forms and workflow screens

## Logo Source Of Truth

The official Rheem logo signal is the red circular Rheem badge with white Rheem lettering and registered mark. Wikimedia Commons lists `File:Rheem logo.svg` as the Rheem Manufacturing Company logo, sourced to `rheem.com`; use the original file URL for interim prototypes when an official internal asset package is unavailable:

`https://upload.wikimedia.org/wikipedia/commons/0/0b/Rheem_logo.svg`

Do not treat `public/images/rheem-logo.svg` as approved until it is replaced by an official Rheem brand package asset. The previous local file was a project-made flame/wordmark composition and has been replaced with a warning placeholder to prevent accidental production use.

Logo rules:

- Use the official badge unmodified.
- Do not redraw, stretch, recolor, add Chinese text, add "Since 1925", add flame marks, or build a new lockup.
- Keep clear space around the circular badge.
- Use the logo as a brand identifier; pair it with plain text context outside the mark when a page needs a product or module title.
- For production, replace remote prototype links with approved local brand assets from Rheem's official brand package.

## Layout Language

Official Rheem pages commonly use:

- Strong product-category entry points.
- Large product imagery or lifestyle/equipment imagery.
- Featured innovation sections.
- Benefit bands with concise headings.
- Role-based commercial navigation, such as engineer, contractor, builder.
- Utility entry points: warranty, find a pro, financing, rebates, replace a part, documentation.
- Product education and support as first-class navigation, not hidden help text.

For product software, translate this into:

- Clear task-oriented navigation.
- Product/system category cards for entry.
- Dense comparison tables for equipment and specs.
- Support/action panels for documentation, rebate, warranty, pro/contact, training.
- Commercial workflow surfaces for specification, availability, delivery, emergency support.

## Product Domain Rules

Rheem can cover both water heating and heating/cooling on the official site. Do not assume Rheem means only water. However, for this China HVAC software context, preserve the local workspace rule:

- Rheem lead brand for water-side, hot water, hydronic heating, wall boiler, floor heating, radiator, water treatment, heat-pump water heater.
- Ruud lead brand for air-side systems when the local product taxonomy requires it.
- Mixed systems must state the lead domain before applying visual identity.

## Residential Pattern

Residential Rheem UI should emphasize:

- Comfort at home.
- Savings and rebates.
- Trustworthy independent pros.
- Warranty and registration.
- Product education.
- Easy product category selection.
- Smart home integration such as EcoNet.

Recommended UI modules:

- Product selector by need.
- Savings/rebate panel.
- Find-a-pro CTA.
- Warranty and registration panel.
- Education cards.
- Compare tank vs tankless or standard vs heat pump.

## Commercial Pattern

Commercial Rheem UI should emphasize:

- Endless hot water / uptime.
- Application and specification support.
- Local stock and logistics.
- Next-day delivery and emergency pickup.
- Training and expert consultation.
- Role-based paths for engineers, contractors, builders, developers.

Recommended UI modules:

- Role switcher.
- Application consulting panel.
- Spec/product table.
- Availability and delivery status.
- Training events.
- Case studies and featured reading.
- Contact Rheem support CTA.

## Design Prohibitions

Avoid:

- Generic AI SaaS gradients.
- Purple/blue "tech" styling unrelated to Rheem.
- Oversized decorative hero sections in operational tools.
- Abstract blobs or glassmorphism as brand identity.
- Red overload that reduces readability.
- Product pages without product imagery, specs, or practical support paths.
- Dashboard cards that do not map to real business decisions.
- Hidden or tiny logo treatment on brand-led screens.

## Acceptance Criteria

A Rheem UI passes brand review when:

- It communicates reliability, efficiency, sustainability, and expert support.
- It uses red with discipline and neutrals for work surfaces.
- It distinguishes residential comfort from commercial uptime/support.
- It gives users product, documentation, support, financing/rebate, and expert-contact paths where relevant.
- It is responsive and professional on desktop, tablet, and mobile.
- It feels more like engineered equipment software than a generic landing-page template.
