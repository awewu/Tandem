/**
 * 角色权限系统 - 瑞美舒适家居设计平台
 * 支持5类角色：门店管理员/设计师/销售/瑞美管理员/瑞美运营
 */

const ROLES = {
  STORE_ADMIN: {
    id: 'store_admin',
    name: '门店管理员',
    description: '门店负责人，管理门店所有资源和人员',
    permissions: [
      'user.manage',      // 管理门店员工
      'project.all',      // 查看所有项目
      'design.full',      // 完整设计功能
      'quote.manage',     // 报价审批
      'report.view',      // 查看报表
      'settings.store',   // 门店设置
      'product.edit',     // 编辑产品价格
      'promotion.set'     // 设置促销
    ],
    dashboard: 'admin',
    defaultRoute: '/dashboard/admin'
  },

  DESIGNER: {
    id: 'designer',
    name: '设计师',
    description: '专业设计人员，负责方案设计',
    permissions: [
      'project.own',      // 管理自己的项目
      'design.full',      // 完整设计功能
      'quote.create',     // 创建报价
      '3d.design',        // 3D设计
      'calculation.run',  // 运行计算
      'device.select',    // 设备选型
      'template.use'      // 使用模板
    ],
    dashboard: 'designer',
    defaultRoute: '/dashboard/designer'
  },

  SALES: {
    id: 'sales',
    name: '销售',
    description: '销售人员，现场谈单和客户需求收集',
    permissions: [
      'project.create',   // 创建项目
      'design.quick',     // 快速估算模式
      'quote.create',     // 创建报价
      'quote.modify',     // 修改报价（折扣）
      'customer.manage',  // 客户管理
      'project.share',    // 分享方案
      'device.view'       // 查看设备
    ],
    dashboard: 'sales',
    defaultRoute: '/dashboard/sales'
  },

  RHEEM_ADMIN: {
    id: 'rheem_admin',
    name: '瑞美管理员',
    description: '总部管理员，管理整个平台',
    permissions: [
      'system.all',       // 所有系统权限
      'store.manage',     // 管理门店
      'product.manage',   // 管理产品库
      'user.all',         // 管理所有用户
      'report.all',       // 所有报表
      'audit.log',        // 审计日志
      'settings.system'   // 系统设置
    ],
    dashboard: 'rheem',
    defaultRoute: '/dashboard/rheem'
  },

  RHEEM_OPS: {
    id: 'rheem_ops',
    name: '瑞美运营',
    description: '总部运营人员，数据分析和运营支持',
    permissions: [
      'report.all',       // 所有报表
      'data.analyze',     // 数据分析
      'product.audit',    // 产品审核
      'store.view',       // 查看门店
      'content.manage'    // 内容管理
    ],
    dashboard: 'rheem',
    defaultRoute: '/dashboard/ops'
  }
};

/**
 * 权限检查
 */
function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  const role = ROLES[user.role.toUpperCase()];
  if (!role) return false;
  return role.permissions.includes(permission) || role.permissions.includes('system.all');
}

/**
 * 获取角色信息
 */
function getRole(roleId) {
  return ROLES[roleId.toUpperCase()] || null;
}

/**
 * 获取所有角色
 */
function getAllRoles() {
  return Object.values(ROLES);
}

/**
 * 检查角色层级
 */
function canManage(managerRole, targetRole) {
  const hierarchy = {
    'rheem_admin': ['rheem_ops', 'store_admin', 'designer', 'sales'],
    'rheem_ops': ['store_admin', 'designer', 'sales'],
    'store_admin': ['designer', 'sales']
  };
  
  const canManageList = hierarchy[managerRole] || [];
  return canManageList.includes(targetRole);
}

module.exports = {
  ROLES,
  hasPermission,
  getRole,
  getAllRoles,
  canManage
};
