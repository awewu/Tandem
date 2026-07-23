# HVAC Calculation Kernels

纯函数计算内核，脱离 HTTP 上下文和租户作用域。

## 结构

- `hot-water/` - 热水系统负荷、选型
- `water-system/` - 净水三级架构、水力计算
- `heating/` - 供暖系统负荷、地暖/水系统
- `air-conditioning/` - 制冷/全空气负荷、室内机选型、五恒
- `fresh-air/` - 新风（含常规新风 / DOAS 两档）
- `load-calculation/` - 负荷计算引擎（RTS/Harmonic/GB50736）
- `hydraulic/` - 水力平衡、管径选型、压损
- `quotation/` - 报价成本模型、税费、促销

## 原则

- 纯函数，无副作用
- 输入/输出类型明确
- 单测覆盖关键路径
- 标准符合性（GB 50736 / ASHRAE 62.1·90.1）
