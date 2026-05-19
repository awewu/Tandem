# Tandem · 生产部署 Runbook

## 1. 前置依赖

| 组件 | 版本 | 用途 |
|---|---|---|
| Docker Engine | ≥ 24 | 容器运行时 |
| Docker Compose | v2 | 编排 |
| Node.js | 22 LTS | 仅本机调试时需要 |
| 对外 TLS | nginx / traefik / cloudflared | HTTPS 终端 |

## 2. 一键部署

```bash
# 1. 拉代码
git clone <repo> && cd Hermes

# 2. 配置环境
cp .env.example .env.production
# 至少改: POSTGRES_PASSWORD / REDIS_PASSWORD / MINIO_ROOT_PASSWORD / NEXTAUTH_SECRET / SCRYPT_N=65536

# 3. 启动栈
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 4. 应用迁移
docker compose -f docker-compose.prod.yml exec app npx drizzle-kit migrate

# 5. 健康检查
curl http://localhost:3000/api/health
# 预期: {"ok":true,"checks":{"database":{"ok":true,...},"redis":{...},"storage":{...}}}
```

## 3. 关键运维命令

```bash
# 滚动重启 app (零停机)
docker compose -f docker-compose.prod.yml up -d --no-deps --scale app=2 app
sleep 30 && docker compose -f docker-compose.prod.yml up -d --no-deps app

# 查看结构化日志 (pino JSON)
docker compose -f docker-compose.prod.yml logs -f app | jq .

# 数据库备份
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U tandem -Fc tandem > backup-$(date +%F).dump

# 数据库恢复
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U tandem -d tandem -c < backup.dump
```

## 4. 安全清单（部署前必查）

- [ ] `.env.production` 不在 git 历史里 (gitignored)
- [ ] `NEXTAUTH_SECRET` ≥ 64 hex chars (生成: `openssl rand -hex 32`)
- [ ] `POSTGRES_PASSWORD` / `REDIS_PASSWORD` / `MINIO_ROOT_PASSWORD` 各自 24+ 字符
- [ ] `SCRYPT_N=65536` 或更高 (登录变慢但抗爆破)
- [ ] `ALLOW_DEMO_AUTH=0` (生产禁用 demo 用户)
- [ ] `NODE_ENV=production` → cookie sameSite='strict' + secure=true
- [ ] HTTPS 终端 (nginx/cloudflared) 在外面套 (容器只暴露 3000)
- [ ] PG 5432 / Redis 6379 / MinIO 9000-9001 不映射到宿主机
- [ ] firewall 仅放行 443

## 5. 监控/告警

| 指标 | 来源 | 告警阈值 |
|---|---|---|
| `/api/health` 503 | k8s readiness / curl 监控 | ≥ 1min |
| `db latency` | health endpoint `checks.database.latencyMs` | > 200ms |
| `app 5xx` | nginx access log | > 1% req/min |
| `登录 429` | pino warn `rate-limited` | 异常激增 |
| `KvStore growth` | `SELECT count(*) FROM "KvStore"` | > 1M (考虑强类型化) |

## 6. 关键架构红线（§T 章节）

| § | 红线 | 实施 |
|---|---|---|
| T1 | API → Service → Repo → Infra 分层 | 见 `lib/services/`, `lib/repositories/` |
| T2 | 状态不挂 globalThis (HMR-safe 单例除外) | `boot.ts` 已做 |
| T6 | 数据归 PG, 文件归 MinIO, 缓存归 Redis | `drizzle-schema.ts` / `s3-client.ts` / `cache.ts` |
| T10 | scrypt N 可调, sameSite strict, RL 必有 | `password.ts` / `session.ts` / `rate-limit.ts` |
| T15 | 日志不落 PII | `logger.ts` redact 列表 |

## 7. 故障排查

### `/api/health` 返回 503
```bash
docker compose -f docker-compose.prod.yml exec app sh -c 'wget -qO- http://localhost:3000/api/health'
# 看哪个 check 失败:
#   database 失败 → docker compose ... logs postgres
#   redis 失败    → docker compose ... logs redis
#   storage 失败  → 检查 MinIO bucket 是否创建; mc mb local/tandem-drive
```

### 登录全部 429
```bash
# 大概率攻击 / 自动化脚本; 临时调高:
docker compose -f docker-compose.prod.yml exec app sh -c \
  'export RATE_LIMIT_LOGIN_PER_HOUR=20'
# 永久调整: 修改 .env.production 后重启 app
```

### 数据库连接耗尽
```bash
# 检查活跃连接
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U tandem -d tandem -c "SELECT count(*) FROM pg_stat_activity;"
# Drizzle postgres-js 默认 max=10, 必要时调整 lib/infra/drizzle-client.ts
```

## 8. 升级流程

1. 在 staging 跑 CI (GitHub Actions ✓)
2. 合 main → 构建镜像 → push 到 registry
3. 生产 `docker compose pull && docker compose up -d --no-deps app`
4. 看 `/api/health` 30s 内返回 200
5. 看 5xx 率 5min 内不超 0.1%
6. 失败回滚: `docker compose up -d --no-deps app:previous-tag`
