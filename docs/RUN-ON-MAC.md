# Tandem · 在本 mac 上线运行 (Run on mac)

> 目标主机 = 本机 mac。生产服务从仓库根目录运行，读 `.env.local` 真值 + 本机 Postgres (`localhost:5432`)。
> 最近实测: 2026-06-28 · `next start` Ready 261ms · `/login` 200 · 受保护 API 401。

## 前置

- Node 20+ / npm 已装
- Postgres 运行在 `localhost:5432`，库 `tandem`（`DATABASE_URL` 在 `.env.local`）
- `.env.local` 含: `DATABASE_URL` `NEXTAUTH_SECRET` `NEXTAUTH_URL` `DEEPSEEK_API_KEY` 等

## 一次性: 构建

```bash
# 标准生产构建（部署包用 standalone，见末尾）
npm run build
```

## 启动 (前台)

```bash
npx next start -H 0.0.0.0 -p 3000
# 浏览器 http://localhost:3000 ; 同局域网同事 http://<本机IP>:3000
```

## 启动 (后台 + 日志)

```bash
npx next start -H 0.0.0.0 -p 3000 > /tmp/tandem-prod.log 2>&1 &
echo $! > /tmp/tandem-prod.pid     # 记录 PID
tail -f /tmp/tandem-prod.log       # 看启动日志
```

## 停止 / 重启

```bash
# 停止
kill "$(cat /tmp/tandem-prod.pid)" 2>/dev/null || lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill
# 重启 = 停止后重新执行上面的启动命令
```

## 开机自启 (可选, launchd)

创建 `~/Library/LaunchAgents/local.tandem.plist`，`ProgramArguments` 指向
`npx next start -H 0.0.0.0 -p 3000`，`WorkingDirectory` 设为本仓库根，
`EnvironmentVariables` 注入 `.env.local` 关键值，然后 `launchctl load`。

## 数据库迁移 (变更 schema 时)

- **禁** `npm run db:push` / `drizzle-kit push`（会删 User 表遗留列，详见项目规则）
- 新表/列用幂等 DDL（`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`）的 Node 脚本，对 `.env.local` 的 `DATABASE_URL` 执行
- 备份: `pg_dump`（见 `docs/RECOVERY-SOP.md`）

## 健康自检

```bash
curl -s -o /dev/null -w "login=%{http_code}\n" http://localhost:3000/login          # 期望 200
curl -s -o /dev/null -w "api=%{http_code}\n"  http://localhost:3000/api/launchpad    # 期望 401 (未登录)
```

## 部署包 (转移到其它主机时)

`/Users/tiechuishan/Documents/Tandem AI/tandem-deploy.zip` 是自包含 standalone 包。
在目标 Node 主机解压后:

```bash
cd app
DATABASE_URL=... NEXTAUTH_SECRET=... SESSION_SECRET=... DEEPSEEK_API_KEY=... PORT=3000 node server.js
```

重新生成部署包（standalone 构建 + 组装）参考 `package-deploy.ps1`（Windows）或仓库内 rsync/zip 复刻流程。
