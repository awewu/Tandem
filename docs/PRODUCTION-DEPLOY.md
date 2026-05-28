# Tandem · 生产部署 + 备份恢复 SOP

> 自用阶段第一优先 (§SELF-USE-FIRST priority #1).
> 同事用着不能崩 + 数据丢了不可恢复 = 信任永远失去.
>
> 这一份覆盖: 部署 3 条路径选一 + PG 备份/恢复 演练.

---

## 一、部署 3 条路径 (选一条)

### 路径 A · Tailscale + 本机 (最快, 适合 ≤ 30 人内部试用)

**适用**: 已经在用 Tailscale, 同事多数远程, 不想买 VPS.

```
[同事手机/电脑] → Tailscale (P2P 加密) → 100.84.x.x:3005 (你电脑)
```

**步骤**:

1. 电脑 24/7 开机 + Tailscale 在线
2. `npm run dev:lan` (绑 0.0.0.0:3005, 已在 package.json)
3. 防火墙开放 3005 (PowerShell 管理员):
   ```powershell
   New-NetFirewallRule -DisplayName "Tandem 3005" -Direction Inbound -LocalPort 3005 -Protocol TCP -Action Allow
   ```
4. 同事手机/电脑装 Tailscale 加入 Tandem Tailnet
5. 访问 `http://100.84.x.x:3005` (你的 Tailscale IP)

**优点**: 5 分钟, 0 成本, 自动加密
**缺点**:
- HTTP (不是 HTTPS) → PWA 装到主屏功能受限
- 电脑关机就断
- 不适合 > 30 人 (本地 PG 性能)
- 同事必须接受装 Tailscale

### 路径 B · 公司内网 VPS + Caddy 自动 HTTPS (推荐, 长期稳)

**适用**: 公司有内网服务器 (Linux), 同事多数办公室, 想要稳定的 HTTPS 域名.

**架构**:
```
[同事] → https://tandem.<company>.local → Caddy (443) → Tandem (3005) → PG (5432)
```

**步骤**:

1. 准备一台 Linux 内网机 (≥ 4GB RAM, Ubuntu 22.04+)
2. 装依赖:
   ```bash
   apt update && apt install -y postgresql-16 postgresql-client nodejs npm git
   curl -fsSL https://get.docker.com | sh  # 可选, 跑 Redis/MinIO 用
   ```
3. 装 Caddy (自动签 Let's Encrypt 证书, 内网用自签):
   ```bash
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/setup.deb.sh' | bash
   apt install caddy
   ```
4. `/etc/caddy/Caddyfile`:
   ```
   tandem.<your-company>.local {
     # 内网自签 (无公网域名), 或换公网域名让 Caddy 自动 LE 签
     tls internal
     reverse_proxy 127.0.0.1:3005
   }
   ```
5. clone Tandem + `npm ci` + `npm run build` + 配 .env (DATABASE_URL, NEXTAUTH_SECRET, ...)
6. 用 systemd 跑后台:
   ```ini
   # /etc/systemd/system/tandem.service
   [Unit]
   Description=Tandem
   After=postgresql.service
   [Service]
   Type=simple
   WorkingDirectory=/opt/tandem
   ExecStart=/usr/bin/npm start
   Restart=always
   EnvironmentFile=/opt/tandem/.env.production
   [Install]
   WantedBy=multi-user.target
   ```
7. `systemctl enable --now tandem caddy postgresql`

**优点**: HTTPS / 24/7 / 稳 / 备份方便
**缺点**: 需要一台 Linux 服务器 + 半天配置

### 路径 C · 公网 VPS + 域名 (对外可达, 适合分布式团队)

跟路径 B 几乎一样, 区别:
- 换公网 IP 服务器 (阿里云 / 腾讯云 / AWS Lightsail / 等)
- Caddyfile 用真实公网域名 → Caddy 自动 Let's Encrypt
- DNS A 记录指向 VPS IP

⚠️ **公网暴露注意**:
- 设强 `NEXTAUTH_SECRET`, 关 `ALLOW_DEMO_AUTH`
- PG 不开公网端口, 只 127.0.0.1
- 用 ufw / iptables 只允许 22/80/443
- 配 fail2ban 防爆破

---

## 二、PG 备份: 每日定时 + 异地保留 7 + 30

### 已就绪脚本

- `scripts/backup-pg.mjs` — 调 pg_dump, 输出 `.sql.gz`
- `scripts/restore-pg.mjs` — 调 psql, 从 `.sql.gz` 恢复
- `scripts/apply-migration.mjs` — 手动应用单个 .sql migration

### 手动备份 (随时跑)

```powershell
# Windows
node scripts/backup-pg.mjs
# → ./backups/tandem-2026-05-27_19-30-00.sql.gz

# 自定义目录
node scripts/backup-pg.mjs --dir D:/tandem-backups
```

```bash
# Linux
node scripts/backup-pg.mjs --dir /var/backups/tandem
```

### 自动每日 (cron)

**Linux**:
```bash
# crontab -e
0 3 * * * cd /opt/tandem && /usr/bin/node scripts/backup-pg.mjs --dir /var/backups/tandem >> /var/log/tandem-backup.log 2>&1
```

**Windows** (任务计划程序):
```powershell
# 注册每天凌晨 3 点跑
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "E:\Hermes\scripts\backup-pg.mjs --dir E:\tandem-backups" -WorkingDirectory "E:\Hermes"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "TandemBackup" -Action $action -Trigger $trigger -Description "每日 Tandem PG 备份"
```

### 保留策略 (滚动删旧)

7 + 30 双层: 最近 7 天全留, 30 天内每周留 1 个, 30 天前删.

```bash
# 添加到 cron 同一脚本里, 自动清理
find /var/backups/tandem -name 'tandem-*.sql.gz' -mtime +30 -delete
```

### 异地保留 (必须!)

本地备份在本地 = 没备份 (硬盘坏 / 勒索病毒 / 火灾 一起没).

至少做一项:

- **rsync / rclone 到另一台机器**:
  ```bash
  rclone copy /var/backups/tandem remote:tandem-backups --max-age 7d
  ```
- **OSS / S3**: 阿里云 OSS / AWS S3 / 腾讯云 COS, 配 lifecycle 自动过期
- **USB 硬盘** (低成本): 每周拷一次到办公桌的离线硬盘

---

## 三、恢复演练 (上线前必须做一次)

⚠️ **没演练过的备份等于没备份**. 第一次故障不是练手时机.

### 演练步骤 (在 staging / 本地 PG 试)

```powershell
# 1) 跑一次备份
node scripts/backup-pg.mjs

# 2) 故意搞个破坏 (开发数据库, 别用生产!)
node -e "require('pg').Pool({connectionString:process.env.DATABASE_URL||'postgresql://tandem:tandem@localhost:5432/tandem'}).query(\"INSERT INTO \\\"User\\\" (id,email,emailVerifiedAt,name,roles,updatedAt) VALUES ('test-rec','test@x.com',null,'test',ARRAY[]::text[],now())\")"

# 3) 用最新备份恢复
node scripts/restore-pg.mjs ./backups/tandem-2026-XX-XX_XX-XX-XX.sql.gz
#  → 输入 yes 确认

# 4) 验证: test-rec 用户应该不存在了 (因为备份比破坏更早)
node -e "require('pg').Pool({connectionString:process.env.DATABASE_URL||'postgresql://tandem:tandem@localhost:5432/tandem'}).query('SELECT count(*) FROM \\\"User\\\" WHERE id=\\'test-rec\\'').then(r=>{console.log(r.rows);process.exit()})"
```

### 真实故障时

1. **冷静** — 别立刻乱搞, 先确认问题
2. **保留现场** — 先 backup 当前坏掉的 DB (`backup-pg.mjs` 跑一次), 万一恢复完发现有用数据丢了能反查
3. **找最近的好备份** — 看 `backups/` 列表, 选故障前的最后一份
4. **演练流程恢复** — `restore-pg.mjs <file>` + 输入 yes
5. **跑健康检查** — `curl /api/health` + `npm test` + 用关键账号登录试一遍
6. **复盘** — 在 `docs/INCIDENT-LOG.md` 记一笔: 故障原因 / 恢复用了多久 / 怎么避免

---

## 四、密钥 / 环境变量管理

| 变量 | 用途 | 来源 |
|---|---|---|
| `DATABASE_URL` | PG 连接 | 部署时设置, 生产用强密码 |
| `NEXTAUTH_SECRET` | session 签名 | 生成: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | LLM provider | 各家官网申请 |
| `TANDEM_BOOTSTRAP_OWNER_PASSWORD` | 首次 Owner 密码 | 强密码, 上线后改 |
| `ALLOW_DEMO_AUTH` | demo 旁路 | **生产必须不设或 =0** |
| `BACKUP_DIR` | 备份输出目录 | 生产指向独立磁盘 / 网盘 |

**绝对不要**:
- 把 `.env.local` / `.env.production` 提交到 git
- 在群里 / 邮件里发明文密钥
- 用 dev / staging 的 NEXTAUTH_SECRET 跑生产 (cookie 会冲)

---

## 五、上线前 checklist

参见 `LAUNCH-CHECKLIST.md`. 核心 6 条:

- [ ] HTTPS 已配 (路径 B/C) 或可以接受 HTTP 限制 (路径 A)
- [ ] `NEXTAUTH_SECRET` 是 64 字符随机
- [ ] `ALLOW_DEMO_AUTH` 关闭
- [ ] `TANDEM_BOOTSTRAP_OWNER_PASSWORD` 已改成强密码
- [ ] 备份 cron 已配 + 至少一次演练过恢复
- [ ] `/api/health` 200 + `/api/integrations/health` 关键依赖全绿

---

## 六、监控 + 告警 (V2 补)

当前 v1 没建. 等同事人数 > 10 再建:

- 进程死了告警 (systemd OnFailure + 邮件)
- `/api/health` 失败告警 (cron 每分钟 curl, 失败发钉钉/飞书)
- PG 磁盘 > 80% 告警
- LLM 月成本 > 阈值告警 (查 `/api/admin/usage`)

---

## 相关文档

- `docs/SELF-USE-FIRST.md` — 战略锚点 (先读)
- `docs/REFLECTION-2026-05.md` — 完整产品复盘
- `LAUNCH-CHECKLIST.md` — 上线前 checklist
- `LOCAL-SHARE.md` — 本机分享 3 档 (Tailscale / Cloudflare / VPS)
- `scripts/backup-pg.mjs` / `restore-pg.mjs` — 已就绪脚本
