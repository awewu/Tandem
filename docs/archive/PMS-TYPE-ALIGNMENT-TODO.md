# PMS 类型对齐待办清单

**状态**: 🚧 进行中  
**优先级**: P1 (阻塞生产使用)  
**预计工时**: 2-3 小时

---

## 📋 类型错误统计

**总计**: 60 个类型错误，分布在 11 个文件

| 文件 | 错误数 | 状态 |
|---|---|---|
| `dealer-org-service.ts` | 13 | ⚠️ 待修复 |
| `delivery-service.ts` | 9 | ⚠️ 待修复 |
| `rebate-service.ts` | 9 | ⚠️ 待修复 |
| `opportunity-service.ts` | 5 | ⚠️ 待修复 |
| `equipment-sn-service.ts` | 5 | ⚠️ 待修复 |
| `contract-service.ts` | 4 | ⚠️ 待修复 |
| `price-application-service.ts` | 4 | ⚠️ 待修复 |
| `maintenance-service.ts` | 4 | ⚠️ 待修复 |
| `product-service.ts` | 3 | ⚠️ 待修复 |
| `duplicate-check.ts` | 2 | ⚠️ 待修复 |
| `follow-up-service.ts` | 2 | ⚠️ 待修复 |

---

## 🎯 修复策略

### 阶段 1: 核心功能（P0）
**目标**: 商机报备 + 查重 + 跟进 可用

1. ✅ `duplicate-check.ts` (2 errors)
2. ✅ `follow-up-service.ts` (2 errors)
3. ⚠️ `opportunity-service.ts` (5 errors)

### 阶段 2: 扩展功能（P1）
**目标**: 价格申请 + 合同 + 交付 可用

4. ⚠️ `price-application-service.ts` (4 errors)
5. ⚠️ `contract-service.ts` (4 errors)
6. ⚠️ `delivery-service.ts` (9 errors)

### 阶段 3: 设备管理（P2）
**目标**: 设备 SN + 维保 可用

7. ⚠️ `equipment-sn-service.ts` (5 errors)
8. ⚠️ `maintenance-service.ts` (4 errors)

### 阶段 4: 经销商体系（P2）
**目标**: 经销商档案 + 返利 可用

9. ⚠️ `dealer-org-service.ts` (13 errors)
10. ⚠️ `rebate-service.ts` (9 errors)

### 阶段 5: 产品目录（P3）
**目标**: 产品管理 可用

11. ⚠️ `product-service.ts` (3 errors)

---

## 🔧 常见错误模式

### 1. 字段缺失
```typescript
// 错误示例
input.expiryDate  // Property 'expiryDate' does not exist

// 修复方法
// 检查 lib/types/pms.ts 中的正确字段名
// 例如: effectiveTo (不是 expiryDate)
```

### 2. 类型不匹配
```typescript
// 错误示例
status: input.status || 'active'  // Type 'string' is not assignable

// 修复方法
status: (input.status || 'active') as 'active' | 'inactive'
```

### 3. 返回类型不完整
```typescript
// 错误示例
return rows.map(row => ({
  id: row.id,
  // 缺少必填字段
}));

// 修复方法
// 补全 lib/types/pms.ts 中定义的所有必填字段
```

---

## 📝 修复模板

### Service 文件修复步骤

1. **打开类型定义**
   ```bash
   code lib/types/pms.ts
   ```

2. **找到对应接口**
   ```typescript
   export interface RebatePolicy {
     // 查看所有字段定义
   }
   ```

3. **对齐 Service 代码**
   - 检查 `create*` 函数的 `input` 参数
   - 检查 `db.insert().values()` 的字段
   - 检查 `list*` 函数的返回映射

4. **验证修复**
   ```bash
   npx tsc --noEmit lib/pms/your-service.ts
   ```

---

## 🚀 快速修复脚本

### 批量检查单个文件
```powershell
# 检查单个文件
npx tsc --noEmit lib/pms/rebate-service.ts

# 只看错误行号
npx tsc --noEmit lib/pms/rebate-service.ts 2>&1 | Select-String "error TS"
```

### 自动生成类型对齐代码
```typescript
// scripts/generate-service-from-type.mjs
// TODO: 从 lib/types/pms.ts 自动生成 Service 骨架
```

---

## ✅ 完成标准

- [ ] 所有 11 个文件 TypeScript 检查通过
- [ ] `npx tsc --noEmit` 零错误
- [ ] 核心 API 路由可正常调用
- [ ] 单元测试覆盖核心功能

---

## 📌 注意事项

### 1. 不要修改类型定义
`lib/types/pms.ts` 是 SSOT（Single Source of Truth），Service 层必须对齐类型定义，而不是反过来。

### 2. 保持向后兼容
如果字段名有变化（如 `expiryDate` → `effectiveTo`），在 Service 层做映射，不要破坏 API 契约。

### 3. 使用类型断言谨慎
优先修复类型定义，而不是用 `as any` 绕过检查。

---

**创建时间**: 2026-07-23  
**预计完成**: 2026-07-24  
**负责人**: AI Coding Loop
