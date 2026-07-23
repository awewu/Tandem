# Issue 05: 主图、详情图和素材引用管理

## What to build

Implement native image and asset management for the brand product console. Operators should be able to upload or replace a main image, remove a main image, and manage detail/gallery image references and ordering where backend support exists.

## Acceptance criteria

- [ ] Product rows show whether a main image and detail images exist.
- [ ] Write-capable users can upload or replace a main image.
- [ ] Write-capable users can delete a main image.
- [ ] Detail/gallery image references can be listed and reordered where the backend supports it.
- [ ] Image operations use Nexus file/product APIs, not 5012 iframe or browser-only state.
- [ ] Image operations remain scoped to the selected brand and tenant mapping.

## Blocked by

- Issue 02: 品牌产品列表与 taxonomy 数据适配
