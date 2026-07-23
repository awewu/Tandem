/**
 * 【BE-Agent11-A/B/C/D交付物】RoleSystem v2.0
 * 权限管理系统 - 5类角色完整实现
 * 
 * 角色: 门店管理员/设计师/销售/总部管理员/瑞美官方管理员
 */

class RoleSystemV2 {
  constructor() {
    this.version = '2.0';
    
    // 5类角色定义
    this.roles = {
      store_admin: {
        id: 'store_admin',
        name: '门店管理员',
        description: '管理门店所有功能和账号',
        permissions: [
          'user.manage',      // 账号管理
          'project.view',     // 查看所有方案
          'project.edit',     // 编辑方案
          'quote.approve',    // 审批报价
          'report.view',      // 查看报表
          'setting.view'      // 查看设置
        ]
      },
      
      designer: {
        id: 'designer',
        name: '设计师',
        description: '创建和编辑设计方案',
        permissions: [
          'project.create',   // 创建方案
          'project.edit',     // 编辑自己的方案
          'project.view',     // 查看方案
          'design.tool',      // 使用设计工具
          'quote.generate',   // 生成报价
          'drawing.generate'  // 生成图纸
        ]
      },
      
      sales: {
        id: 'sales',
        name: '销售顾问',
        description: '快速锁客和客户管理',
        permissions: [
          'customer.manage',  // 客户管理
          'quick.lock',       // 快速锁客
          'project.view',     // 查看方案
          'quote.view',       // 查看报价
          'followup.manage'   // 跟进管理
        ]
      },
      
      rheem_admin: {
        id: 'rheem_admin',
        name: '总部管理员',
        description: '区域管理和数据查看',
        permissions: [
          'store.manage',     // 门店管理
          'data.view',        // 数据查看
          'report.view',      // 报表查看
          'product.view',     // 产品查看
          'price.view'        // 价格查看
        ]
      },
      
      rheem_super: {
        id: 'rheem_super',
        name: '瑞美官方管理员',
        description: '系统所有功能',
        permissions: ['*']   // 所有权限
      }
    };
    
    // 权限矩阵
    this.permissionMatrix = {
      'user.manage': ['store_admin', 'rheem_super'],
      'user.create': ['store_admin', 'rheem_super'],
      'user.delete': ['store_admin', 'rheem_super'],
      'project.create': ['designer', 'store_admin', 'rheem_super'],
      'project.edit': ['designer', 'store_admin', 'rheem_super'],
      'project.delete': ['designer', 'store_admin', 'rheem_super'],
      'project.view': ['designer', 'sales', 'store_admin', 'rheem_admin', 'rheem_super'],
      'design.tool': ['designer', 'store_admin', 'rheem_super'],
      'quote.generate': ['designer', 'store_admin', 'rheem_super'],
      'quote.approve': ['store_admin', 'rheem_super'],
      'admin.system': ['rheem_super']
    };
  }

  /**
   * 检查权限
   */
  checkPermission(userRole, permission) {
    const role = this.roles[userRole];
    if (!role) return { allowed: false, reason: '角色不存在' };
    
    // 超级管理员拥有所有权限
    if (role.permissions.includes('*')) {
      return { allowed: true };
    }
    
    // 检查特定权限
    const allowedRoles = this.permissionMatrix[permission] || [];
    const allowed = allowedRoles.includes(userRole);
    
    return {
      allowed,
      reason: allowed ? null : `角色 ${role.name} 无权限: ${permission}`
    };
  }

  /**
   * 获取角色权限列表
   */
  getRolePermissions(roleId) {
    const role = this.roles[roleId];
    if (!role) return null;
    
    if (role.permissions.includes('*')) {
      return Object.keys(this.permissionMatrix);
    }
    
    // 收集该角色拥有的所有权限
    const permissions = [];
    Object.entries(this.permissionMatrix).forEach(([perm, roles]) => {
      if (roles.includes(roleId)) {
        permissions.push(perm);
      }
    });
    
    return permissions;
  }

  /**
   * 获取所有角色
   */
  getAllRoles() {
    return Object.values(this.roles).map(role => ({
      id: role.id,
      name: role.name,
      description: role.description
    }));
  }

  /**
   * 验证用户角色
   */
  validateUserRole(user, requiredPermission) {
    const check = this.checkPermission(user.role, requiredPermission);
    
    // 检查账号有效期
    if (user.expireDate && new Date(user.expireDate) < new Date()) {
      return {
        allowed: false,
        reason: '账号已过期'
      };
    }
    
    // 检查账号状态
    if (user.status === 'disabled') {
      return {
        allowed: false,
        reason: '账号已禁用'
      };
    }
    
    return check;
  }
}

module.exports = RoleSystemV2;
