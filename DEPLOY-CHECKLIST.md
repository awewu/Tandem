# Tandem 部署 Checklist · 真实可打勾版

> **目的**: 第一次上线不翻车。每条都带具体命令，按顺序跑。
> **预计耗时**: 首次约 30-60 分钟（含买机器、解析域名、Docker 拉镜像）。

---

## 📋 PRE · 上线前（30 分钟）

### ☐ 1. 买云主机
- 推荐：**阿里云 2C4G 100GB ESSD** (~¥150/月) 或同等配置
- 系统选 **Ubuntu 22.04 LTS** 或 **Debian 12**
- 地域：**国内**（如调 Anthropic/OpenAI，选香港/新加坡）
- 控制台开放安全组：**22 (限你的 IP)**、**80**、**443**
- **不要**开 3000 / 5432 / 6379 / 9000 / 9001

### ☐ 2. 域名解析
- 买域名（不强求，IP 直访也行）
- A 记录指向云主机公网 IP
- 等 DNS 生效：`nslookup tandem.your.com` 能解析到正确 IP

### ☐ 3. SSH 登录 + 装 Docker
```bash
ssh root@your-server-ip

# 装 Docker (官方一键)
curl -fsSL https://get.docker.com | sh
systemctl enable docker --now

# 验证
docker --version
docker compose version  # 必须 v2 (用 'docker compose' 不是 'docker-compose')
```

### ☐ 4. 防火墙（主机层 + 云控制台双重）
```bash
# Ubuntu/Debian
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

### ☐ 5. 拉代码
```bash
git clone https://your-git-host/tandem.git /opt/tandem
cd /opt/tandem
```

---

## 🚀 DURING · 部署（10-20 分钟）

### ☐ 6. 一键引导脚本
```bash
cd /opt/tandem
chmod +x scripts/deploy-bootstrap.sh
./scripts/deploy-bootstrap.sh
```

脚本会问你：
- Bootstrap Owner 邮箱（你自己的）
- 访问 URL（如 `https://tandem.your.com`）
- DeepSeek API Key（推荐配，否则 AI 降级到 fallback）
- 告警 Webhook URL（可空）

脚本自动：
- 生 5 个 secrets（PG/Redis/MinIO 密码 + 3 个 session secrets + Owner 16 位密码）
- 写 `.env.production`（`chmod 600`）
- 构建 app 镜像（首次 3-5 分钟）
- 启 postgres/redis/minio，等 healthy
- 启 app
- 跑 migration
- 健康检查 `/api/health`
- 打印登录信息

### ☐ 7. 抄走登录信息
脚本结尾会输出：
```
📧 Owner Email:    you@company.com
🔑 Owner Password: xxxxxxxxxxxxxxxx
🌐 URL:            https://tandem.your.com
```
**保存密码到你的密码管理器**（也在 `.env.production` 里）。

### ☐ 8. 配 HTTPS 反向代理（Caddy 最简单）
```bash
# 装 Caddy
apt install -y caddy

# 写配置
cat > /etc/caddy/Caddyfile <<EOF
tandem.your.com {
  reverse_proxy 127.0.0.1:3000
  encode gzip
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Frame-Options "SAMEORIGIN"
    X-Content-Type-Options "nosniff"
  }
}
EOF

systemctl reload caddy
systemctl status caddy   # 看是不是绿
```

Caddy 自动找 Let's Encrypt 申 SSL 证书，2 分钟内 `https://tandem.your.com` 可访问。

### ☐ 9. 首次访问 + 改密码
- 浏览器开 `https://tandem.your.com`
- 用脚本输出的 Owner 邮箱/密码登录
- 进 `/admin/security` → **改密码 + 开 MFA**
- 进 `/admin/invite` → 生成员工邀请码

---

## ✅ POST · 上线后 24h 内（必做）

### ☐ 10. 设备份 cron
```bash
crontab -e
# 加这行（每天凌晨 3 点备份 PG → 本地 + 对象存储）
0 3 * * * cd /opt/tandem && node scripts/backup-pg.mjs >> /var/log/tandem-backup.log 2>&1
```

**关键**：定期把 `/opt/tandem/backups/` 同步到**异地对象存储**（阿里云 OSS / 腾讯云 COS / S3），不要只放本机。

### ☐ 11. 跑一次备份恢复演练
```bash
# 备份
node scripts/backup-pg.mjs

# 验证备份能恢复 (在临时容器里测, 不影响生产)
# 详见 docs/PRODUCTION-DEPLOY.md §备份恢复 SOP
```
**没演练过的备份等于没备份。**

### ☐ 12. 监控基线
```bash
# 容器健康
docker compose -f docker-compose.prod.yml ps
# 期望: 4 个 Up (healthy)

# 资源占用
docker stats --no-stream
# 期望: app < 500 MB, PG < 400 MB

# 应用健康
curl https://tandem.your.com/api/health | jq
# 期望: {"ok":true, "checks":{...全 true}}

# 跑端到端冒烟 (登录态)
# 见 scripts/smoke-all.mjs
```

### ☐ 13. 配告警 Webhook
如果 `.env.production` 里 `ALERT_WEBHOOK_URL` 没配，现在补：
- 飞书自定义机器人 / 钉钉机器人 / Slack Incoming Webhook
- 更新 `.env.production` → `docker compose ... up -d app`（仅重启 app）
- 触发一次假告警验证：见 `lib/infra/alerts.ts` 注释

### ☐ 14. 升级 SOP
未来代码改了怎么上：
```bash
cd /opt/tandem
git pull

# 如果有新 migration
docker compose -f docker-compose.prod.yml --env-file .env.production exec app npm run db:migrate

# 重建 + 热替 (零停机 if app 多实例; 单实例约 5s 中断)
docker compose -f docker-compose.prod.yml --env-file .env.production build app
docker compose -f docker-compose.prod.yml --env-file .env.production up -d app
```

---

## 🆘 翻车快速诊断

| 症状 | 看哪 | 常见原因 |
|---|---|---|
| `502 Bad Gateway` | `docker compose logs app` | app 没起来 (env 缺 / DB 没 ready) |
| 登录后立刻被踢 | 检查 `NEXTAUTH_URL` | URL 跟实际访问地址不一致 |
| `relation "User" does not exist` | `docker compose exec app npm run db:migrate` | migration 没跑 |
| `NoSuchBucket: tandem-drive` | MinIO 控制台手动建 bucket | env `MINIO_DEFAULT_BUCKETS` 未生效 |
| Anthropic/OpenAI 超时 | LLM provider 配置 | 国内云主机不能直连境外 API |
| 内存暴涨 | `docker stats` | LLM 调用泄漏，重启 app 临时止损 |
| PWA 装不到桌面 | 浏览器 dev tools → Application | 没有 HTTPS / Service Worker 没注册 |
| 邮件不发 | `lib/infra/email.ts` | SMTP 未配置 (V2 功能, V1 可忽略) |

**查日志万能命令**：
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f --tail=200 app
```

---

## 🎯 真实总耗时

| 阶段 | 时长 |
|---|---|
| 买机器 + 解析域名 | 5-30 分钟（域名等 DNS 生效） |
| SSH + 装 Docker | 3 分钟 |
| `git clone` + 跑 bootstrap | 10 分钟（首次构建慢） |
| 配 Caddy + HTTPS | 5 分钟 |
| 首次登录 + 改密码 + 配邀请码 | 5 分钟 |
| 设备份 cron + 监控 | 10 分钟 |
| **合计** | **~40-60 分钟** |

如果遇到问题，看 `docs/PRODUCTION-DEPLOY.md` 完整 SOP，或问我具体报错。

---

## ⚠️ 千万不要

- ❌ **直接把 3000 端口暴露公网**（一定要走反代 + HTTPS）
- ❌ **`ALLOW_DEMO_AUTH=1` 上生产**（后门）
- ❌ **`docker compose down -v`** 在没备份的情况下（会删数据 volume）
- ❌ **把 `.env.production` 提交到 git**（chmod 600 + 加入 .gitignore）
- ❌ **只在本机备份**（机器挂了备份也挂）
- ❌ **跳过 migration 直接用**（表不存在所有 API 500）
