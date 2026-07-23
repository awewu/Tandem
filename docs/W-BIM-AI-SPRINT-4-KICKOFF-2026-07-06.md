# W-BIM-AI · Sprint 4 启动文档

> 日期：2026-07-06
> 目标：AI 设计引擎骨架（规则自动化 + LLM 编排 + 信任状态机）

## 1. 范围

- **4.1 信任状态机**
  - `unverified → estimate → verified`
  - `insufficient_data` 拒绝默认值
  - 角色阶梯：sales(estimate) / engineer(verified) / designer(insufficient_data+verified)
- **4.2 规则自动化入口**
  - 自动盘管 / 自动布管 / 自动选型放机
  - 当前为占位，待接入 LoopCAD/LATS 基准算法
- **4.3 AI 方案生成**
  - `POST /api/ai-design/propose`：户型 + 自然语言需求 → 方案草案
- **4.4 LLM 复核**
  - `POST /api/ai-design/review`：calc-gate 结果 → 挑错提示
  - 编排铁律：LLM 不自出合规结论
- **4.5 报价锁价**
  - `POST /api/ai-design/select-quote`：产品推荐 + 报价快照
- **4.6 审计链（未启动）**
  - prompt / 模型 / kernel / gate / 人审 全程留痕

## 2. 已交付文件

- `services/api/src/modules/ai-design/ai-design.service.ts`
- `services/api/src/modules/ai-design/ai-design.controller.ts`
- `services/api/src/modules/ai-design/ai-design.module.ts`
- `services/api/src/modules/rysnova-bim/bim-role.policy.ts`
- `apps/designer-workbench/src/app/ai-design/page.tsx`

## 3. 验收标准

- [ ] `POST /api/ai-design/propose` 返回 trustState 与 devices/pipes
- [ ] `POST /api/ai-design/verify` 提升 trustState 到 verified
- [ ] `POST /api/ai-design/review` 输出 disclaimer，不输出合规结论
- [ ] `POST /api/ai-design/select-quote` 返回 quoteId 与 lockedUntil
- [ ] 角色阶梯限制 sales 不能调用 verify

## 4. 风险

- 真实 HVAC 自动布局算法需要大量算法投入
- LLM 服务尚未接入，当前为规则占位
- 与 product-catalog/quote 的真实价格联动待实现
