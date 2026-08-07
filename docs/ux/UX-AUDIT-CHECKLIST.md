# UX 审计清单（逐屏）

> 治理基线（Phase 0）。每屏改造走：`审计打分 → 问题清单(带代码位) → ICE 排序 → 改(用 src/components/ui 组件库) → guard 验`。
> 依据：Nielsen 十原则 + `DESIGN.md §9-16 体验宪章`。

## 逐屏检查表（每项 ✓/✗，✗ 记为一条问题）
### A. 状态五态（DESIGN §9）
- [ ] loading 有骨架屏（非空白/无限 spinner）
- [ ] empty 有文案 + 次级 CTA
- [ ] error 行内提示 + 重试
- [ ] partial（部分失败）可见
### B. 反馈与延迟（§10）
- [ ] 交互 <100ms 有反馈；提交按钮 loading 态
- [ ] 结果 toast 报成败；耗时显进度
### C. 可访问性（§11）
- [ ] 文本对比 ≥4.5:1；可见 focus ring
- [ ] 全键盘可达；交互区 ≥40px；表单 label/aria
### D. 渐进披露（§12）
- [ ] 关键 KPI 上浮；一屏 ≤7 主区块；细节折叠/抽屉
### E. 响应式（§13）
- [ ] 工作台 ≥1280/1024/768 不塌；C 端移动优先
### F. 表单纪律（§14）
- [ ] 行内校验；错误贴字段旁；破坏性二次确认；长表单存草稿
### G. 信息架构（§15）
- [ ] 面包屑+当前位置；层级 ≤3；⌘K；返回不丢状态
### H. 性能感知（§16）
- [ ] 长列表(>50)虚拟化/分页；图片懒加载；路由级骨架屏
### I. Nielsen 补充
- [ ] 系统状态可见 / 匹配现实语言 / 用户可控(撤销) / 一致性 / 防错 / 识别优于记忆 / 灵活高效 / 简约 / 错误可恢复 / 帮助文档

## 问题记录模板
| # | 屏/路由 | 代码位(file:line) | 违反项(§) | 严重度 | ICE(I/C/E) | 处置 |
|---|---|---|---|---|---|---|

## 改造顺序（存量界面滚动）
1. dealer-workbench 工作台（首页/CRM/设计/报价/交付）
2. 增长中枢（营销台/驾驶舱）
3. 品牌站 C 端 + 诊断（everhot/rheem/ruud + consumer-diagnosis）

## 验收 gate
- `npm run guard:ui-vi`（VI+体验）
- 前端改动：`ENABLE_REACT_CANDIDATE=true npm run guard:browser-visual`（staging）
- `npm run guard:active-page-static`
