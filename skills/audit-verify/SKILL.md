---
name: audit-verify
description: 审计链 SHA-256 完整性校验. 用户说"审计"/"合规审查"/"哈希链"/"是否被篡改"时调用. 等保二级要求审计日志 ≥ 6 个月不可篡改.
allowedRoles: ["admin", "champion"]
permissions: []
---

# 审计链完整性校验 Skill

## 何时使用

- 季度 / 年度内审
- 安全事件应急响应 (怀疑数据被篡改)
- ISO27001 / 等保审核员现场抽查
- KPI 周期年终关闭前的最后校验

## 工作原理

```
genesis → entry1 (action|actor|ts) → SHA256 → hash1
hash1   → entry2 (action|actor|ts) → SHA256 → hash2
hash2   → entry3 (action|actor|ts) → SHA256 → hash3
...
```

每条 audit entry 的 hash = `SHA256(prevHash | action | actorId | timestamp)`.

任何中间一条被改, 后续所有 hash 都对不上 → verify() 立即检出.

## 调用

```
GET /api/audit/verify
→ {
    ok: true,
    total: 1247,
    chainEnd: "abc123..."
  }

或异常:
→ {
    ok: false,
    brokenAt: 487,
    brokenEntry: { action, actorId, ts },
    message: "chain broken at seq 487"
  }
```

## 不可妥协铁律 (CHARTER §合规)

1. ❌ **不要自动修复** — 链断 = 调查证据
2. 立即冻结相关用户账号 (调查中)
3. 从最近备份导出审计表全量 → 离线归档
4. 比对生产 vs 备份的 hash 链, 定位篡改点
5. 形成事件报告, 通报安全负责人
6. 24h 内决定: 公告 / 监管报备 / 内部追责

## 备份联动

`docs/RECOVERY-SOP.md` 场景 C 详细描述如何恢复. 备份脚本:
- Linux: `scripts/backup-postgres.sh`
- Windows: `scripts/backup-postgres.ps1`

每日 02:00 全量 + S3 上传 + SHA256 校验.

## 反例

- ❌ 链断后立即重建 (毁灭证据)
- ❌ 把 verify 失败当作 bug 修, 不上报
- ❌ 让普通 admin 看 verify 端点 (应仅 champion / 安全负责人)
