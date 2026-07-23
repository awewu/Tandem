Status: ready-for-agent

# Everhot 基础产品 CRUD 闭环

## What to build

在当前管理平台与现有产品目录领域中交付第一条完整 Everhot 产品管理路径：管理员能够查询、新增、编辑和删除产品，独立 Everhot 官网通过运行时公开 API 立即读取并显示保存后的真实数据。

第一阶段使用现有产品事实模型和 Everhot 品牌租户，不新建重复产品后端。管理内容包括名称、型号、稳定 slug、家用/商用分类、系统分类、系列、简介和标签。保存即生效，不经过审核、静态发布、回滚或操作日志流程。

管理入口属于“网站管理”中的 Everhot 站点下一级工作区。管理员从网站列表点击 Everhot 的 Logo 或名称进入 `/comfort/sites/everhot/products`；站点行的“编辑”操作继续只管理域名、Logo 等站点元数据。页面层级变化不改变产品领域归属，所有产品写入仍由现有 D2 product-catalog 负责。

PDF、规格书和技术资料上传不在本 issue 范围内。

## Acceptance criteria

- [ ] 当前管理平台能够分页查询和搜索 Everhot 产品。
- [ ] 从“网站管理”的 Everhot Logo 或名称能够进入 Everhot 产品管理页，地址为 `/comfort/sites/everhot/products`。
- [ ] 页面面包屑清晰显示“网站管理 / Everhot / 产品管理”，并能返回网站列表。
- [ ] 网站列表中的“编辑”继续只编辑 Everhot 站点元数据，不与产品 CRUD 混用。
- [ ] 管理员能够新增产品，并填写名称、型号、slug、分类、系列、简介和标签。
- [ ] 管理员能够编辑已有产品，未修改的 Everhot 详情字段不会被覆盖或清空。
- [ ] 管理员能够执行删除操作，删除后的产品不再出现在官网公开数据中。
- [ ] slug 在 Everhot 品牌范围内唯一，并能稳定定位公开产品详情。
- [ ] 公开产品列表和单品接口只返回官网所需的安全字段，不返回成本价格或管理字段。
- [ ] Everhot 官网无需重新构建即可显示新增或修改后的产品基础信息。
- [ ] 覆盖管理 API、公开 API 和官网显示结果的自动化测试通过。

## Blocked by

None - can start immediately.

## Comments
