# 01 - Brand product category model and default seeds

## What to build

Add the backend data foundation for brand-specific product category trees. Each brand must own an independent category tree with up to three levels. The first release must seed level-1 and level-2 categories from current website/backend examples so the category manager is not empty on first use.

## Acceptance criteria

- [ ] A brand product category entity/table exists with `id`, `brandCode`, `parentId`, `level`, `code`, `nameCn`, `nameEn`, `slug`, `sortOrder`, `status`, `description`, `createdAt`, `updatedAt`, and `deletedAt`.
- [ ] Categories are scoped by brand; Rheem, Ruud, and Everhot trees are independent.
- [ ] The model supports level 1, 2, and 3 only.
- [ ] Default seed data creates active level-1 and level-2 categories for each supported brand.
- [ ] Everhot seed data includes current example categories: `家用` with `家用中央空调`, `地暖系统`, `全热新风`; `商用` with `热水系统`, `燃气冷凝壁挂炉`, `零冷水燃气热水器`, `空气能热水器`, `容积式燃气热水器`, `电热水器`, `采暖热水两联供`.
- [ ] Rheem and Ruud receive current known example categories or a minimal usable active level-1/level-2 tree.
- [ ] Seed logic is idempotent and does not duplicate the same brand/parent/code or brand/parent/name.
- [ ] Focused backend tests cover level limits, brand scoping, and idempotent seeds.

## Blocked by

None - can start immediately.
