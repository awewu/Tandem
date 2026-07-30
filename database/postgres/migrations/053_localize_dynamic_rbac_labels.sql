SET search_path TO rhautt_nexus, public;

UPDATE rhautt_nexus.rbac_permissions SET
  name = CASE code
    WHEN 'admin.users.view' THEN '查看账号权限页面'
    WHEN 'admin.users.read' THEN '查看账号列表'
    WHEN 'admin.users.create' THEN '新建账号'
    WHEN 'admin.users.update' THEN '编辑账号'
    WHEN 'admin.users.delete' THEN '删除账号'
    WHEN 'admin.users.reset_password' THEN '重置账号密码'
    WHEN 'admin.users.assign_roles' THEN '分配用户角色'
    WHEN 'admin.roles.view' THEN '查看角色权限页面'
    WHEN 'admin.roles.read' THEN '查看角色列表'
    WHEN 'admin.roles.create' THEN '新建角色'
    WHEN 'admin.roles.update' THEN '编辑角色'
    WHEN 'admin.roles.assign_permissions' THEN '配置角色权限'
    WHEN 'admin.permissions.read' THEN '查看权限点目录'
    WHEN 'marketing.content.view' THEN '查看内容页面'
    WHEN 'marketing.content.create' THEN '新建内容'
    WHEN 'marketing.content.update' THEN '编辑内容'
    WHEN 'marketing.content.delete' THEN '删除内容'
    WHEN 'marketing.campaigns.view' THEN '查看营销活动'
    WHEN 'marketing.campaigns.create' THEN '新建营销活动'
    WHEN 'marketing.campaigns.update' THEN '编辑营销活动'
    WHEN 'marketing.campaigns.delete' THEN '删除营销活动'
    WHEN 'marketing.assets.view' THEN '查看营销物料'
    WHEN 'marketing.assets.create' THEN '新建营销物料'
    WHEN 'marketing.assets.update' THEN '编辑营销物料'
    WHEN 'marketing.assets.delete' THEN '删除营销物料'
    WHEN 'analytics.dashboard.view' THEN '查看数据看板'
    WHEN 'analytics.export' THEN '导出数据'
    WHEN 'system.audit.read' THEN '查看审计日志'
    ELSE name
  END,
  description = CASE code
    WHEN 'admin.users.view' THEN '允许打开账号权限管理页面。'
    WHEN 'admin.users.read' THEN '允许查看后台账号列表与账号信息。'
    WHEN 'admin.users.create' THEN '允许创建后台账号。'
    WHEN 'admin.users.update' THEN '允许编辑账号资料和启停状态。'
    WHEN 'admin.users.delete' THEN '允许删除后台账号。'
    WHEN 'admin.users.reset_password' THEN '允许重置后台账号密码。'
    WHEN 'admin.users.assign_roles' THEN '允许给用户绑定或移除角色。'
    WHEN 'admin.roles.view' THEN '允许打开角色权限管理页面。'
    WHEN 'admin.roles.read' THEN '允许查看角色列表和角色详情。'
    WHEN 'admin.roles.create' THEN '允许创建角色。'
    WHEN 'admin.roles.update' THEN '允许编辑角色名称、说明和状态。'
    WHEN 'admin.roles.assign_permissions' THEN '允许修改角色绑定的权限点。'
    WHEN 'admin.permissions.read' THEN '允许查看系统可分配的权限点。'
    WHEN 'marketing.content.view' THEN '允许打开营销内容页面。'
    WHEN 'marketing.content.create' THEN '允许新建营销内容。'
    WHEN 'marketing.content.update' THEN '允许编辑营销内容。'
    WHEN 'marketing.content.delete' THEN '允许删除营销内容。'
    WHEN 'marketing.campaigns.view' THEN '允许打开营销活动页面。'
    WHEN 'marketing.campaigns.create' THEN '允许新建营销活动。'
    WHEN 'marketing.campaigns.update' THEN '允许编辑营销活动。'
    WHEN 'marketing.campaigns.delete' THEN '允许删除营销活动。'
    WHEN 'marketing.assets.view' THEN '允许打开营销物料页面。'
    WHEN 'marketing.assets.create' THEN '允许新建营销物料。'
    WHEN 'marketing.assets.update' THEN '允许编辑营销物料。'
    WHEN 'marketing.assets.delete' THEN '允许删除营销物料。'
    WHEN 'analytics.dashboard.view' THEN '允许查看运营数据看板。'
    WHEN 'analytics.export' THEN '允许导出运营数据。'
    WHEN 'system.audit.read' THEN '允许查看系统审计日志。'
    ELSE description
  END,
  updated_at = now()
WHERE code IN (
  'admin.users.view',
  'admin.users.read',
  'admin.users.create',
  'admin.users.update',
  'admin.users.delete',
  'admin.users.reset_password',
  'admin.users.assign_roles',
  'admin.roles.view',
  'admin.roles.read',
  'admin.roles.create',
  'admin.roles.update',
  'admin.roles.assign_permissions',
  'admin.permissions.read',
  'marketing.content.view',
  'marketing.content.create',
  'marketing.content.update',
  'marketing.content.delete',
  'marketing.campaigns.view',
  'marketing.campaigns.create',
  'marketing.campaigns.update',
  'marketing.campaigns.delete',
  'marketing.assets.view',
  'marketing.assets.create',
  'marketing.assets.update',
  'marketing.assets.delete',
  'analytics.dashboard.view',
  'analytics.export',
  'system.audit.read'
);

UPDATE rhautt_nexus.rbac_roles SET
  name = CASE code
    WHEN 'platform_admin' THEN '平台超级管理员'
    WHEN 'hq_admin' THEN '总部管理员'
    WHEN 'brand_admin' THEN '品牌管理员'
    WHEN 'regional_manager' THEN '区域经理'
    WHEN 'dealer_admin' THEN '经销商管理员'
    WHEN 'store_manager' THEN '门店经理'
    WHEN 'designer' THEN '设计师'
    WHEN 'sales' THEN '销售'
    WHEN 'engineer' THEN '工程师'
    WHEN 'installer' THEN '安装工'
    WHEN 'customer' THEN '客户'
    ELSE name
  END,
  description = CASE
    WHEN description = 'Backfilled from users.role' THEN '由历史账号角色自动迁移生成'
    ELSE description
  END,
  updated_at = now()
WHERE code IN (
  'platform_admin',
  'hq_admin',
  'brand_admin',
  'regional_manager',
  'dealer_admin',
  'store_manager',
  'designer',
  'sales',
  'engineer',
  'installer',
  'customer'
) OR description = 'Backfilled from users.role';
