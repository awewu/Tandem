# docs/archive — 历史快照 (勿作现状依据)

本目录存放**开发过程中的阶段性快照**, 已被后续实现推翻, **不代表当前状态**。
查 PMS 现状请看 **`docs/PMS-STATUS.md`** (SSOT)。

| 归档文件 | 快照日期 | 为何过时 |
|---|---|---|
| `PMS-PRODUCTION-READINESS.md` | 2026-07-23 (半程) | 评"43分/不推荐上线/核心 Service 缺失"; 之后 26 service + 24 API + 18 UI 已建齐, tsc 零错。结论已失效。 |
| `PMS-DELIVERY-REPORT.md` | 2026-07-23 (半程) | 称"Service 仅交付 1 个文件 (8%)"; 并建议"用 any 绕过类型冲突、不要参考 lib/types/pms" — 该策略已被后续对齐工作取代。 |
| `PMS-TYPE-ALIGNMENT-TODO.md` | 2026-07-23 | 列"60 个类型错误待修"; 现 `npx tsc --noEmit` 零错误, 清单已完成。 |

> 保留原因: 追溯决策演进 (git 历史 + 快照)。**引用前务必确认已被 `PMS-STATUS.md` 覆盖。**
