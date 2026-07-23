<!-- ⚠️ DEPRECATED 2026-07-03: 内容已整合入 skills/rheem-design-director/references/RHEEM-VI-STANDARD.md，以该文件为准。-->

# Rheem VI Reference

Use this reference for Rheem-branded UI and visual identity work in the enterprise website workspace.

## Brand Tokens

Controlling source: `skills/rheem-design-director/references/rheem-official-vi.md`. Local CSS must be treated as implementation, not brand authority.

- Primary red: `#E4002B`
- Dark red: `#A00F28`
- Light red: `#E8455F`
- Neutral gray: `#4A4A4A`
- Neutral dark: `#2D2D2D`
- Background primary: `#FFFFFF`
- Background secondary: `#F5F5F5`
- Background tertiary: `#EEEEEE`
- Text primary: `#333333`
- Text secondary: `#666666`
- Text light: `#999999`
- Success: `#4CAF50`
- Warning: `#FF9800`
- Error: `#F44336`
- Info: `#2196F3`
- Radius: `4px`, `8px`, `12px`; prefer `8px` or less for professional app UI cards unless local CSS requires otherwise.
- Font stack: `Microsoft YaHei`, `PingFang SC`, system sans-serif.

## Logo

Use the official Rheem red circular badge with white Rheem lettering. For interim prototypes, use the official-source file:

`https://upload.wikimedia.org/wikipedia/commons/0/0b/Rheem_logo.svg`

Do not use `public/images/rheem-logo.svg` in production until it is replaced by an approved Rheem brand package asset. The previous project-made flame/wordmark placeholder was removed because it conflicted with official branding.

Keep the mark readable. Do not stretch, recolor, redraw, crop, place on noisy backgrounds, add Chinese text, add "Since 1925", or reduce it to decorative nav text when the screen is brand-led.

## Product Classification

Local source: `public/brand-classification.css`

Use Rheem for water-side and hydronic products:

- Gas, electric, solar, and heat-pump water heaters
- Wall boilers
- Hydronic floor heating
- Radiator systems
- Domestic cold/hot/soft water systems
- Water filtration and purification
- Commercial hot water equipment
- Pool heating equipment

Use Ruud for air-side products:

- Central AC, VRF, split AC
- HVAC heat pumps for cooling/heating air
- Ventilation and fresh air
- Air purification, humidity, and dehumidification
- Commercial air handling

For "five-constant" comfort systems:

- Water radiant/capillary dominant: Rheem lead brand.
- AC plus ventilation dominant: Ruud lead brand.
- Mixed proposal: show the classification explicitly before applying visual identity.

## Visual Tone

Rheem UI should communicate engineering confidence: accurate, durable, efficient, and service-ready.

Prefer:

- Dense but organized dashboards
- Clear metric hierarchy
- Equipment comparison tables
- Water/heating system diagrams
- Plan, pipe, circuit, load, and quote views
- White/gray surfaces with disciplined red accents

Avoid:

- Single-hue red overload
- Generic abstract gradients
- Excessively soft consumer-app styling
- Oversized landing-page hero treatment in operational tools
- Decorative cards without workflow value
