# Hermes / Tandem · Disaster Recovery SOP

> 灾难恢复操作手册 · 适用于 PostgreSQL 主库丢失 / 误删表 / 数据损毁场景
>
> RTO 目标: 30 min · RPO 目标: 24 h (按当前每日凌晨 2:00 全量备份)

## 备份策略

| 类型     | 频率           | 保留    | 位置                         |
| -------- | -------------- | ------- | ---------------------------- |
| 全量     | 每日 02:00 UTC | 30 天   | 本地 `BACKUP_DIR` + S3       |
| WAL 增量 | (待实施)       | —       | 未启用                       |

脚本: `scripts/backup-postgres.sh` (Linux) / `scripts/backup-postgres.ps1` (Windows)

> RPO 改进项 (未来 P1): 启用 WAL streaming 到 S3, RPO 可降到 5min 内. 当前 P0 仅交付每日全量.

---

## 场景 A: 主库整库丢失 → 全量恢复

### 准备

1. 确认有最近 24h 内的备份文件 (本地 / S3)
2. 准备新的 PostgreSQL 实例 (空库, 与原 schema 名一致, 默认 `public`)
3. 找到 `DATABASE_URL` (新库连接串)

### 步骤

```bash
# 1. 从 S3 拉最近备份 (如果本地丢失)
aws s3 cp s3://$S3_BUCKET/hermes-tandem/hermes-prod-20260520-020000.sql.gz ./
aws s3 cp s3://$S3_BUCKET/hermes-tandem/hermes-prod-20260520-020000.sql.gz.sha256 ./

# 2. 验证完整性
echo "$(cat hermes-prod-*.sql.gz.sha256)  hermes-prod-*.sql.gz" | sha256sum -c -

# 3. 解压并恢复
gunzip -c hermes-prod-20260520-020000.sql.gz | psql "$DATABASE_URL"

# 4. 验证表数量与行数
psql "$DATABASE_URL" -c "\dt"                               # 应有 9+ 张表
psql "$DATABASE_URL" -c 'SELECT count(*) FROM "AuditLog";'  # 应非 0
```

### 验证应用

1. 重启 Hermes 应用 (`pm2 restart hermes` 或 k8s rollout restart)
2. 浏览器打开 `/api/audit/verify` (admin 登录) — 应返回 `{ ok: true, total: N }`
3. 打开 `/admin/kpi/setup` 检查 KPI 数据完整

---

## 场景 B: 误删表 / 误删行 → 单表恢复

### 步骤

```bash
# 1. 解压到临时 SQL 文件
gunzip -c hermes-prod-20260520-020000.sql.gz > /tmp/restore.sql

# 2. 抽取目标表的 DROP/CREATE/COPY 语句
#    备份文件用 plain SQL, 易 grep
grep -E '"TableName"' /tmp/restore.sql | head

# 3. 改成 staging schema 防止覆盖现网
sed -i 's/"public"."TableName"/"recovery"."TableName"/g' /tmp/restore-partial.sql

# 4. 恢复到 recovery schema, 然后 INSERT INTO public 选择性回填
psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS recovery;"
psql "$DATABASE_URL" -f /tmp/restore-partial.sql
psql "$DATABASE_URL" -c \
  'INSERT INTO public."TableName" SELECT * FROM recovery."TableName"
   WHERE id NOT IN (SELECT id FROM public."TableName");'

# 5. 清理
psql "$DATABASE_URL" -c "DROP SCHEMA recovery CASCADE;"
```

---

## 场景 C: 审计链断裂 → 防篡改告警

如果 `/api/audit/verify` 返回 `{ ok: false, brokenAt: N }`:

1. **不要** 自动修复 — 这可能是真实篡改证据
2. 立即:
   - 冻结相关用户账号 (调查中)
   - 从最近备份导出 `AuditLog` 表全量 → 离线归档
   - 比对生产 vs 备份的 `AuditLog.hash` 链, 定位篡改点
3. 形成事件报告, 通报安全负责人

```sql
-- 对比 hash 链 (生产 vs 备份)
SELECT seq, id, action, hash, prevHash
FROM "AuditLog"
WHERE "tenantId" = 'default'
ORDER BY seq;
```

---

## 演练 (每季度一次)

每季度第一周, SRE 模拟全量恢复:

1. 在 staging 环境拉昨日生产备份
2. 完整跑 "场景 A" 流程
3. 应用 smoke test 通过 (登录 / 查 KPI / 提交人工补录)
4. 记录恢复耗时, 若 > 30min 须优化

最近演练记录: 待 (项目尚未上生产)

---

## 联系人

- 数据库主理: TBD
- 应用主理: TBD
- 安全主理 (审计链断裂时): TBD
