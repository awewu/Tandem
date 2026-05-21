# Brand Assets

Drop the official brand SVG files here. The `<BrandLogo>` component
(`components/brand-logo.tsx`) auto-resolves them by filename.

## Expected files

| Filename                   | Variant     | Theme  | Use case                                |
|----------------------------|-------------|--------|-----------------------------------------|
| `mark-light.svg`           | `mark`      | light  | Square icon (light bg) — AppRail collapsed, favicon |
| `mark-dark.svg`            | `mark`      | dark   | Square icon (dark bg) — AppRail (charcoal) |
| `mark-brand.svg`           | `mark`      | brand  | Square icon, monochrome red             |
| `wordmark-light.svg`       | `wordmark`  | light  | Horizontal wordmark on light bg         |
| `wordmark-dark.svg`        | `wordmark`  | dark   | Horizontal wordmark on dark bg          |
| `wordmark-brand.svg`       | `wordmark`  | brand  | Horizontal wordmark, red                |
| `lockup-light.svg`         | `lockup`    | light  | Mark + wordmark composite, light bg     |
| `lockup-dark.svg`          | `lockup`    | dark   | Mark + wordmark composite, dark bg      |

## Notes

- Files MUST be SVG with a viewBox attribute (not raster).
- Provide light + dark or just brand if monochrome works on both.
- If a requested variant/theme combo is missing, the component falls back to:
  1. Same variant, `brand` theme
  2. The legacy "T" tile (current placeholder)
- Width/height come from the consumer via props; SVG should fill its viewBox.
