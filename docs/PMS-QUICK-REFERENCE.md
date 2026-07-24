# PMS 快速参考手册

## 🔑 核心概念

### 双层隔离模型

```
tenantId (租户隔离)
  └── orgId (组织隔离)
        ├── internal (厂家) — 看全部
        └── dealer (经销商) — 只看自己
```

### 角色体系

| 角色 | 权限 | 可见范围 |
|---|---|---|
| internal | 厂家内部 | 全部组织 |
| dealer_admin | 经销商管理员 | 本组织 + 下级 |
| dealer_sales | 经销商销售 | 本组织 |

---

## 📦 数据模型

### 商机生命周期

```
reported (报备)
  ↓ [查重通过]
following (跟进)
  ↓ [提交报价]
quoted (已报价)
  ↓ [签订合同]
contracted (已签约)
  ↓ [开始交付]
delivered (已交付)
  ↓ [验收完成]
closed (已结案)
```

### 商机状态

```typescript
type OpportunityStatus = 
  | 'active'      // 活跃
  | 'won'         // 赢单
  | 'lost'        // 输单
  | 'duplicate'   // 撞单
  | 'cancelled'   // 取消
  | 'archived';   // 归档
```

### 查重规则

| 维度 | 权重 | 匹配规则 |
|---|---|---|
| 客户名 | 25% | Jaccard 相似度 |
| 地址 | 25% | 500 米内 |
| 电话 | 20% | 精确匹配 |
| 项目名 | 15% | 语义相似度 |
| 产品重叠 | 15% | 交集/并集 |

**总分判定**:
- ≥ 80: `duplicate` (阻断)
- 60-79: `warning` (提示)
- < 60: `pass` (通过)

---

## 🛠️ API 使用示例

### 1. 创建商机 (含自动查重)

```typescript
POST /api/pms/opportunities
Content-Type: application/json

{
  "customerName": "北京某医院",
  "customerContact": "张主任",
  "customerPhone": "13800138000",
  "customerAddress": "北京市朝阳区xxx路xxx号",
  "projectName": "中央空调采购项目",
  "projectType": "new_construction",
  "estimatedAmount": 5000000,
  "expectedCloseDate": "2026-12-31",
  "productRequirements": "需要10台风冷模块机组",
  "dealerOrgId": "org_dealer_001"
}

// 响应 (查重通过)
{
  "opportunity": { ... },
  "duplicateCheck": {
    "status": "pass",
    "matchedOpportunities": [],
    "matchDetails": []
  }
}

// 响应 (查重失败)
{
  "error": "Duplicate opportunity detected",
  "duplicateCheck": {
    "status": "duplicate",
    "matchedOpportunities": ["opp_001"],
    "matchDetails": [
      {
        "opportunityId": "opp_001",
        "dimensions": ["customerName", "address", "phone"],
        "similarity": 0.85
      }
    ]
  }
}
```

### 2. 创建跟进记录

```typescript
POST /api/pms/follow-ups
Content-Type: application/json

{
  "opportunityId": "opp_001",
  "content": "电话沟通，客户表示下周可以安排现场勘察",
  "userId": "user_001"
}
```

### 3. 创建价格申请

```typescript
POST /api/pms/price-applications
Content-Type: application/json

{
  "opportunityId": "opp_001",
  "applicantId": "user_001",
  "dealerOrgId": "org_dealer_001",
  "productItems": [
    {
      "productId": "prod_001",
      "productName": "风冷模块机组 RXYQ10",
      "quantity": 10,
      "listPrice": 50000,
      "proposedPrice": 42000,
      "discount": 16
    }
  ],
  "totalAmount": 420000,
  "reason": "客户要求批量采购优惠"
}

// 响应 (折扣 >15%, 需审批)
{
  "application": {
    "id": "pa_001",
    "approvalStatus": "pending",
    ...
  },
  "needsApproval": true
}
```

---

## 🔍 服务层函数速查

### dealer-org-service.ts

```typescript
createDealerOrg(input)           // 创建经销商组织
updateDealerOrg(orgId, input)    // 更新经销商组织
addQualification(input)          // 添加资质记录
getExpiringQualifications(days)  // 获取即将过期资质
calculateHealthScore(orgId)      // 计算健康分
```

### opportunity-service.ts

```typescript
createOpportunity(input)                        // 创建商机 (自动查重)
updateOpportunity(opportunityId, input)         // 更新商机
recycleToPublicPool(opportunityId, reason)      // 回收到公海池
claimFromPublicPool(opportunityId, userId, ...)  // 从公海池认领
```

### duplicate-check.ts

```typescript
checkDuplicate(input)  // 智能查重
```

### follow-up-service.ts

```typescript
createFollowUp(input)                    // 创建跟进记录
scanOverdueFollowUps(tenantId, days)     // 扫描超期未跟进
```

### price-application-service.ts

```typescript
createPriceApplication(input)                    // 创建价格申请
approvePriceApplication(applicationId, ...)      // 审批价格申请
```

### contract-service.ts

```typescript
createContract(input)                // 创建合同
approveContract(contractId, ...)     // 审批合同
```

### delivery-service.ts

```typescript
createDeliveryOrder(input)              // 创建交付工单
createDeliveryTask(input)               // 创建交付任务
completeDeliveryTask(taskId)            // 完成任务
updateDeliveryOrderProgress(orderId)    // 更新工单完成率
createAcceptanceRecord(input)           // 创建验收记录
createCommissioningRecord(input)        // 创建调试记录
```

### equipment-sn-service.ts

```typescript
createEquipmentSN(input)                     // 创建设备 SN
updateEquipmentSNStatus(snId, status, ...)   // 更新 SN 状态
recallByBatch(batchNumber)                   // 批量召回
```

### maintenance-service.ts

```typescript
createMaintenanceRecord(input)           // 创建维保记录
assignToServiceProvider(input)           // 委托服务商
completeMaintenanceRecord(recordId, ...) // 完成维保
```

---

## 🎨 UI 组件建议

### 商机报备表单

```typescript
// app/pms/new/page.tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

// 使用 Tandem 现有组件
// 表单验证: react-hook-form + zod
// 提交后显示查重结果 (Modal)
```

### 商机列表

```typescript
// app/pms/opportunities/page.tsx
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

// 列: 客户名 | 项目名 | 阶段 | 状态 | 金额 | 预计成交日期 | 操作
// 筛选: 阶段 | 状态 | 日期范围
// 排序: 金额 | 日期
```

### 查重结果 Modal

```typescript
// components/pms/duplicate-check-modal.tsx
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';

// 显示匹配的商机列表
// 显示相似度评分
// 显示匹配维度 (客户名/地址/电话/项目名/产品)
```

---

## 🔧 开发工具

### 类型检查

```powershell
npx tsc --noEmit
```

### 运行 DB 索引脚本

```powershell
node scripts/pms-indexes.mjs
```

### 查看 PMS collections

```typescript
import { getStore } from '@/lib/storage/repository';

const store = getStore();
const opportunities = await store.pmsOpportunities.list({ tenantId: 'default' });
```

---

## 📋 常见问题

### Q: 如何获取当前用户的 orgId?

```typescript
import { requirePmsAuth } from '@/lib/pms/pms-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePmsAuth(req);
  const orgId = auth.orgId; // 当前用户的组织 ID
}
```

### Q: 如何判断用户是否有权限查看某个商机?

```typescript
const auth = await requirePmsAuth(req);
const opportunity = await store.pmsOpportunities.get(opportunityId);

// internal 用户可以看全部
if (auth.isInternal) {
  return opportunity;
}

// dealer 用户只能看自己组织的
if (opportunity.orgId !== auth.orgId) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Q: 如何触发查重?

```typescript
import { checkDuplicate } from '@/lib/pms/duplicate-check';

const duplicateCheck = await checkDuplicate({
  customerName: input.customerName,
  customerAddress: input.customerAddress,
  projectName: input.projectName,
  customerPhone: input.customerPhone,
  tenantId: input.tenantId,
});

if (duplicateCheck.status === 'duplicate') {
  // 阻断创建
  return NextResponse.json({ error: 'Duplicate detected', duplicateCheck }, { status: 409 });
}
```

---

**快速参考手册 v1.0 | 2026-07-23**
