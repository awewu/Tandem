# Everhot 官网生产部署记录与故障复盘（2026-07-18）

> 用途：记录 Everhot 官网、Rhautt Nexus API、品牌运营控制台在 113/219 环境的实际部署拓扑、故障根因、修复过程、数据库事实、验证方式与后续运维要求。
>
> 安全规则：本文只记录密钥名称、文件位置和一致性要求，不记录 `JWT_SECRET`、PostgreSQL 密码、控制台密码、证书私钥等秘密值。

## 1. 最终结论

本次故障不是商品数据丢失，也不是官网前端地址错误。最终确认：

- PostgreSQL 中存在 27 条 Everhot 商品，全部属于正确租户且状态为 `active`。
- `127.0.0.1:4400`、`https://web.rhautt.com`、`https://everhot.com.cn` 均可返回 27 条商品。
- 官网公开数据链路已经恢复。
- 品牌运营控制台实际部署在 `E:\dev\brand-console`，不是最初假设的后端包子目录。
- 品牌运营控制台的 `4012` 计划任务已验证为 `Running`，本机首页返回 HTTP 200。
- `https://manage.rhautt.com/` 已配置专属 Nginx 443 虚拟主机，实际返回 `HTTP/1.1 200 OK` 和 Next.js 页面。
- 控制台登录模式需要显式设为 `dev`；HTTPS 验证完成后，Cookie 的 `Secure` 标志应设为 `true`。
- 当前 `dev` 登录只适用于内部临时运行。正式生产目标仍需完成 OIDC SSO。

## 2. 生产拓扑

```text
浏览器
  |
  +-- https://everhot.com.cn
  |     IIS 10 + ARR（官网静态站与 /api/v2 代理）
  |       -> https://web.rhautt.com/api/v2/*
  |
  +-- https://manage.rhautt.com
        Nginx
          -> http://127.0.0.1:4012
          -> Everhot 品牌运营控制台

https://web.rhautt.com
  Nginx 1.30.2（TLS）
    -> http://127.0.0.1:4400
    -> Rhautt Nexus / 瑞合数智枢纽 NestJS API
         -> PostgreSQL 127.0.0.1:5432
              database: rhautt_nexus
              schema:   rhautt_nexus
```

## 3. 运行资源清单

| 资源 | 实际值 | 状态/说明 |
|---|---|---|
| 官网域名 | `https://everhot.com.cn` | IIS/ARR，公开商品接口已验证 27 条 |
| 后端域名 | `https://web.rhautt.com` | Nginx TLS 反向代理 |
| 控制台域名 | `https://manage.rhautt.com` | Nginx TLS 反向代理，已验证 HTTP 200 |
| NestJS API 端口 | `4400` | 旧资料中的 `3300`、`4000` 均不是当前生产端口 |
| 控制台端口 | `4012` | 监听 `0.0.0.0:4012` |
| Node.js | `E:\soft\nodejs\node.exe` | 实际进程可执行文件 |
| Nginx | `E:\soft\nginx-1.30.2\nginx.exe` | 配置测试与 reload 已成功 |
| API bundle | `E:\dev\rhautt-api-brand-113-prod-20260717-162500\api\scripts\start-api.js` | 当前服务器 bundle |
| API 环境文件 | `E:\dev\rhautt-api-brand-113-prod-20260717-162500\api\.env.production` | 含秘密，不得入库或外发 |
| API runner | `E:\dev\rhautt-api-brand-113-prod-20260717-162500\run-api-4400.ps1` | 必须在启动 Node 前注入环境变量 |
| 控制台程序 | `E:\dev\brand-console\apps\brand-console\server.js` | Next.js standalone server |
| 控制台环境文件 | `E:\dev\brand-console\.env.production` | 本次补建 |
| 控制台 runner | `E:\dev\run-brand-console-4012.ps1` | 本次补建 |
| API 计划任务 | `RhauttNexusApi4400` | 需在关闭手工 API 窗口前最终确认 `Running` |
| 控制台计划任务 | `EverhotBrandConsole4012` | 已验证 `Running` |

## 4. Nginx 与 IIS 事实

### 4.1 后端 Nginx

Nginx 主配置目录：

```text
E:\soft\nginx-1.30.2\conf
```

`web.rhautt.com` 的最终代理目标：

```nginx
proxy_pass http://127.0.0.1:4400;
```

证书位置：

```text
C:\cert\rhautt.com_cert_chain.pem
C:\cert\rhautt.com_key.key
```

曾存在重复配置：

```text
E:\soft\nginx-1.30.2\conf\conf.d\web.rhautt.com.conf
```

该文件曾把 HTTPS 请求代理到旧端口 `3300`，导致公网请求返回 `401 Unauthorized`。处理方式是将其禁用为：

```text
web.rhautt.com.conf.disabled
```

当前以主 `nginx.conf` 中的 `web.rhautt.com` 80/443 server 块为准。

验证命令：

```powershell
Set-Location E:\soft\nginx-1.30.2
.\nginx.exe -t
.\nginx.exe -s reload

curl.exe -k -i `
  --resolve "web.rhautt.com:443:127.0.0.1" `
  "https://web.rhautt.com/api/v2/health"
```

### 4.2 官网 IIS/ARR

`everhot.com.cn/api/v2/*` 经 IIS 10 + ARR 转发后端。最终验证：

```powershell
Invoke-RestMethod `
  "https://everhot.com.cn/api/v2/brand/everhot/products?locale=zh-CN"
```

预期 `data.total = 27`。

### 4.3 品牌控制台 HTTPS

`manage.rhautt.com` 最初只有 HTTP 80 虚拟主机。访问 HTTPS 时，请求会落入其他域名的默认 443 server，因此 HTTP 与 HTTPS 显示不同页面。

最终新增的 HTTPS 虚拟主机使用统一证书，并代理控制台 `4012`：

```nginx
server {
    listen 80;
    server_name manage.rhautt.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name manage.rhautt.com;

    ssl_certificate     C:/cert/rhautt.com_cert_chain.pem;
    ssl_certificate_key C:/cert/rhautt.com_key.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:4012;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

2026-07-18 实际验证结果：

```text
https://manage.rhautt.com/
HTTP/1.1 200 OK
Server: nginx/1.30.2
Content-Type: text/html; charset=utf-8
X-Powered-By: Next.js
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

附件中的最终配置快照仍同时包含两个 `listen 80; server_name manage.rhautt.com;` 块：旧块直接代理 `4012`，新块执行 301。规范状态应删除旧的 HTTP 代理块，只保留一个 80 跳转块和一个 443 代理块，然后重新执行 `nginx -t`、reload 和 HTTP 301 验证。

## 5. API 环境变量契约

生产 API 至少需要以下键：

```text
NODE_ENV=production
PORT=4400
API_PORT=4400
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_DB=rhautt_nexus
POSTGRES_SCHEMA=rhautt_nexus
POSTGRES_PASSWORD=<secret>
JWT_SECRET=<secret>
EVERHOT_TENANT_ID=e5e40000-0000-4000-8000-000000000001
```

关键约束：

- `JWT_SECRET` 必须在 Node 加载 API bundle 之前进入进程环境。
- 仅设置 `DOTENV_CONFIG_PATH` 对当前旧 bundle 不够，因为鉴权模块可能在 Nest `ConfigModule` 执行前读取 `JWT_SECRET`。
- 计划任务 runner 必须先解析 `.env.production`，逐项写入 Process 环境，再执行 Node。
- `PORT` 优先于 `API_PORT`，两者统一设为 `4400`，避免端口歧义。

## 6. 品牌控制台环境变量契约

控制台环境文件：

```text
E:\dev\brand-console\.env.production
```

必要键：

```text
NODE_ENV=production
PORT=4012
HOSTNAME=0.0.0.0
NEXUS_API_URL=http://127.0.0.1:4400
NEXUS_API_PREFIX=/api/v2
JWT_SECRET=<must-equal-api-JWT_SECRET>
BRAND=everhot
BRAND_TENANT=e5e40000-0000-4000-8000-000000000001
EVERHOT_TENANT_ID=e5e40000-0000-4000-8000-000000000001
EVERHOT_PUBLIC_ORIGIN=https://everhot.com.cn
BRAND_CONSOLE_AUTH_MODE=dev
BRAND_CONSOLE_COOKIE_SECURE=true
```

关键约束：

- 控制台的 `NEXUS_API_URL` 必须是 `4400`，不能继续指向旧端口 `3300`。
- 控制台用 `JWT_SECRET` 铸造服务令牌，必须与 API 完全一致，但不得把实际值写进本文。
- 控制台域名已切换 HTTPS，因此 `BRAND_CONSOLE_COOKIE_SECURE=true`；不得再通过 HTTP 执行登录。
- `dev` 登录只用于内部过渡。完成 OIDC 配置后，应切换 `BRAND_CONSOLE_AUTH_MODE=sso`。

## 7. PostgreSQL 与商品数据事实

PostgreSQL 不是单一“数据库文件”，生产数据由 PostgreSQL 实例的数据目录、WAL、配置文件和逻辑备份共同组成。

### 7.1 已验证连接信息

| 项目 | 值 |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `postgres` |
| Database | `rhautt_nexus` |
| Schema | `rhautt_nexus` |
| 商品表 | `rhautt_nexus.products` |
| 租户表 | `rhautt_nexus.tenants` |
| `public.products` | 不存在 |

### 7.2 Everhot 租户

```text
id          e5e40000-0000-4000-8000-000000000001
code        everhot
tenant_type hq
status      active
```

### 7.3 商品数据

2026-07-18 实际查询结果：

```text
tenant_id e5e40000-0000-4000-8000-000000000001
brand     everhot
status    active
count     27
```

总商品数也是 27。因此本次故障期间没有执行商品重新导入，也没有更新、删除或迁移商品行。

### 7.4 数据库迁移与导入证据

仓库迁移目录：

```text
database/postgres/migrations/
```

Everhot 品牌租户迁移：

```text
database/postgres/migrations/009_everhot_brand_tenant.sql
```

历史官方商品导入证据：

```text
evidence/provenance/official-product-import-result.json
evidence/provenance/official-product-db-verification.json
```

注意：历史导入证据记录的 API base 是 `http://localhost:3300/api/v2`，不能单独证明当时写入的就是当前生产实例；本次以生产 PostgreSQL 直接查询到的 27 条记录为准。

### 7.5 待补录的数据库物理文件位置

本次会话尚未取得 PostgreSQL 的实际数据目录、配置文件和 HBA 文件路径。由 DBA/运维在服务器执行：

```sql
SHOW data_directory;
SHOW config_file;
SHOW hba_file;
SHOW external_pid_file;
```

PowerShell 示例：

```powershell
$postgres = Get-Process postgres |
  Where-Object Path |
  Select-Object -First 1

$psql = Join-Path (Split-Path $postgres.Path -Parent) "psql.exe"

& $psql -h 127.0.0.1 -p 5432 -U postgres -d rhautt_nexus `
  -c "SHOW data_directory; SHOW config_file; SHOW hba_file;"
```

取得结果后补录：

```text
data_directory = <待补录>
config_file    = <待补录>
hba_file       = <待补录>
```

### 7.6 备份要求

本次故障排查没有产生或验证新的数据库备份文件，不得把“查询成功”视为“已经备份”。建议建立独立备份目录，例如：

```text
E:\backup\rhautt_nexus\
```

逻辑备份示例（执行前确认空间、权限和密码注入方式）：

```powershell
$timestamp = Get-Date -Format yyyyMMdd-HHmmss
$backup = "E:\backup\rhautt_nexus\rhautt_nexus-$timestamp.dump"
$pgBin = Split-Path (Get-Process postgres | Where-Object Path | Select-Object -First 1).Path -Parent

& (Join-Path $pgBin "pg_dump.exe") `
  -h 127.0.0.1 -p 5432 -U postgres `
  -d rhautt_nexus -Fc -f $backup

& (Join-Path $pgBin "pg_restore.exe") -l $backup |
  Select-Object -First 20
```

备份完成后必须记录：文件路径、大小、SHA-256、生成时间、保留期，以及一次隔离环境恢复验证结果。

## 8. 故障时间线与根因

| 阶段 | 症状 | 根因 | 修复 |
|---|---|---|---|
| 1 | `127.0.0.1:3300` 无法连接 | 当前生产 API 已改为 `4400` | 以 `4400` 为唯一运行端口 |
| 2 | Nginx HTTP 可用，HTTPS 返回 `401` | `conf.d` 重复配置仍代理旧 `3300` | 禁用重复配置，主 `nginx.conf` 统一代理 `4400` |
| 3 | 健康检查 200，但官网商品为 0 | API 运行时未加载 `EVERHOT_TENANT_ID`，查询回退到 `rhautt_shared` | 在启动 Node 前注入 `.env.production` |
| 4 | API 新任务立即退出，日志出现大段 bundle | 真正异常是 `FATAL: JWT_SECRET is required in production` | 启动器预加载全部生产环境变量 |
| 5 | 数据库查询有 27 条，公开 API 曾返回 0 | 运行时环境与数据库事实不一致 | 修正启动环境后，本机与公网均返回 27 |
| 6 | 官网恢复，控制台仍为 0 | 控制台仍走旧端口/默认 JWT，且实际目录判断错误 | 定位实际目录 `E:\dev\brand-console`，补建环境文件 |
| 7 | 控制台任务启动，但登录 POST 返回 400 | `AUTH_MODE=sso` 且没有完整 IdP；页面仍显示密码表单 | 显式设置 `BRAND_CONSOLE_AUTH_MODE=dev` |
| 8 | HTTP 环境登录可能反复回登录页 | production 默认 Secure Cookie，HTTP 不保存 | 临时设置 `BRAND_CONSOLE_COOKIE_SECURE=false` |
| 9 | HTTP 与 HTTPS 控制台显示不同页面 | `manage.rhautt.com` 缺少专属 443 server，HTTPS 命中其他默认虚拟主机 | 新增 443 TLS 代理到 `4012`，HTTPS 实测返回 Next.js HTTP 200 |

## 9. 完整验收命令

### 9.1 API 与商品链路

```powershell
$health = Invoke-RestMethod `
  "http://127.0.0.1:4400/api/v2/health"

$local = Invoke-RestMethod `
  "http://127.0.0.1:4400/api/v2/brand/everhot/products?locale=zh-CN"

$backend = Invoke-RestMethod `
  "https://web.rhautt.com/api/v2/brand/everhot/products?locale=zh-CN"

$frontend = Invoke-RestMethod `
  "https://everhot.com.cn/api/v2/brand/everhot/products?locale=zh-CN"

[PSCustomObject]@{
  Health        = $health.success
  Local         = $local.data.total
  WebBackend    = $backend.data.total
  EverhotProxy  = $frontend.data.total
}
```

预期：

```text
Health       True
Local        27
WebBackend   27
EverhotProxy 27
```

### 9.2 计划任务与端口

```powershell
Get-ScheduledTask `
  -TaskName "RhauttNexusApi4400","EverhotBrandConsole4012" |
  Select-Object TaskName,State

Get-NetTCPConnection `
  -LocalPort 4400,4012 `
  -State Listen |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

预期两个任务均为 `Running`，两个端口均处于 `Listen`。

### 9.3 控制台

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:4012"
Invoke-RestMethod "http://127.0.0.1:4012/api/session"
curl.exe -I "http://manage.rhautt.com/"
curl.exe -I "https://manage.rhautt.com/"
```

过渡期预期：

```text
HTTP status 200
authMode dev
sso      False
manage HTTP  301 -> https://manage.rhautt.com/
manage HTTPS 200
```

浏览器重新登录后，产品库应显示 27。

## 10. 回滚与日志

### 10.1 日志文件

```text
E:\dev\logs\brand-console.stdout.log
E:\dev\logs\brand-console.stderr.log
E:\dev\rhautt-api-brand-113-prod-20260717-162500\logs\api-4400.stdout.log
E:\dev\rhautt-api-brand-113-prod-20260717-162500\logs\api-4400.stderr.log
```

### 10.2 配置备份

本次命令在覆盖 runner 或环境文件前使用时间戳创建备份。回滚前先确认目标文件和当前监听进程，不要盲目覆盖。

### 10.3 数据库回滚边界

本次修复没有修改数据库数据，因此不需要执行数据库回滚。禁止为了处理端口、JWT 或控制台登录问题而重新导入、删除或批量更新 27 条商品。

## 11. 后续必须完成

- [ ] 确认 `RhauttNexusApi4400` 在关闭手工 Node 窗口后仍为 `Running`。
- [ ] 重启服务器演练一次，确认 `4400`、`4012` 自动恢复。
- [ ] 补录 PostgreSQL `data_directory`、`config_file`、`hba_file`。
- [ ] 生成并校验一次 `pg_dump -Fc` 备份，完成隔离恢复演练。
- [x] 为 `manage.rhautt.com` 配置 HTTPS，并验证 Next.js 页面返回 HTTP 200。
- [ ] 删除重复的旧 `manage.rhautt.com:80` 代理块，确认 HTTP 唯一行为是 301 跳转 HTTPS。
- [ ] 配置 OIDC IdP，将控制台从 `dev` 切换为 `sso`；Cookie Secure 保持 `true`。
- [ ] 构建新的版本化 API 生产包，不直接覆盖旧目录；新包必须证明启动前已加载生产环境。
- [ ] 清理旧端口命名与失效任务（例如 `RhauttNexusApi3300`），保留变更记录后再删除。

## 12. 源码与未来部署约束

本地源码已增加 `ConfigModule` 对 `DOTENV_CONFIG_PATH` 的读取，并通过启动器回归测试与 TypeScript 编译。但当前服务器运行的是旧的单文件 bundle，该源码修改尚未重新打包部署。

未来生产包必须满足以下任一条件：

1. 以仓库 `scripts/start-api.js` 为启动入口，由其先调用 dotenv，再加载编译后的 NestJS main；或
2. 由计划任务/服务管理器在 Node 启动前完整注入生产环境变量。

不能仅依赖 Nest `ConfigModule` 在模块装配阶段加载密钥，因为鉴权模块可能更早读取 `JWT_SECRET`。

## 13. 当前部署版本与归档基线

生产运行目录、IIS 部署目录和本次实际验收共同证明，当前生产使用的前后端配对版本是：

```text
20260717-162500
```

保留的生产归档及 SHA-256：

| 角色 | 文件 | 大小（字节） | SHA-256 |
|---|---|---:|---|
| 官网前端 | `everhot-iis-219-prod-20260717-162500.zip` | 6,983,268 | `4E8EFA0593C9712A93BB9ED79009A98A2F4E8E3182C51ED5E1629FFF305DAB67` |
| Rhautt Nexus API | `rhautt-api-brand-113-prod-20260717-162500.tar.gz` | 109,065,390 | `70E92986B9A60500D95DFFF9ABC8909EC7C9C051984D38FD409840A739ABCDD3` |

目录中时间更晚的 `182959`、`183204`、`183756`、`184032`、`184321`、`184801` 以及 `local-234` 包没有被本次生产运行证据采用，不能仅凭文件名较新就认定为当前生产版本。

## 14. 下一次更新标准流程

### 14.1 发布前冻结基线

1. 记录当前计划任务、监听端口、进程命令行、IIS 物理路径和 Nginx 生效配置。
2. 执行第 9 节的四段验收并保存结果。
3. 生成 PostgreSQL `pg_dump -Fc` 备份，检查文件非零、计算 SHA-256，并在隔离环境验证可读取或恢复。
4. 备份以下配置，但不得把秘密值提交到仓库：
   - API `.env.production`
   - 控制台 `.env.production`
   - API/控制台 runner
   - Nginx `nginx.conf`
   - IIS 站点与 ARR/rewrite 配置

### 14.2 生成版本化部署包

前端与后端使用同一个构建时间戳，例如：

```powershell
$version = Get-Date -Format yyyyMMdd-HHmmss
$frontendArchive = "everhot-iis-219-prod-$version.zip"
$backendArchive = "rhautt-api-brand-113-prod-$version.tar.gz"
```

构建和打包必须在开发/构建机完成，服务器只运行构建产物。每个包必须：

- 不包含 `.env.production`、密码、JWT、私钥或数据库 dump。
- 包含版本号、源码 commit、构建时间、入口文件和安装说明。
- 计算 SHA-256，并在上传后再次校验。
- 前端先通过 `apps/everhot-cn` 的构建与链接审计；API 通过生产 readiness、目标启动 smoke 和相关合同测试。

当前仓库尚无一条经验证、可复现生成上述 API `.tar.gz` 的正式发布脚本。因此下一次源码更新前，应先补齐该脚本并在非生产环境验证，不要手工拼装后直接覆盖生产。

### 14.3 新目录旁路部署

1. 将新包解压到新的版本目录，不覆盖 `20260717-162500`。
2. 从受控位置复制生产环境文件，并逐项确认端口、数据库、schema、租户和 JWT 一致性；不输出秘密值。
3. 新 API 先在临时端口启动，验证 health 和 Everhot 商品总数。
4. 若版本包含 migration，必须先审阅 SQL、在 staging 演练并准备数据库回滚方案；普通代码更新不复制 PostgreSQL 数据目录、不重新导入商品。

### 14.4 切换生产

1. 停止对应计划任务，确认旧监听进程及 PID。
2. 将计划任务工作目录/启动器切到新版本；官网更新则将 IIS 物理路径切到新目录。
3. Nginx 变更必须先执行 `nginx.exe -t`，成功后再 reload。
4. 启动计划任务，依次验证本机 API、`web.rhautt.com`、`everhot.com.cn` 和 `manage.rhautt.com`。
5. 关闭任何手工启动窗口，再确认 `4400`、`4012` 仍监听且两个任务均为 `Running`。

### 14.5 完成与回滚

只有以下条件全部满足才标记发布完成：health 成功、三段商品接口均返回 27、控制台可登录并显示 27、日志无 JWT/数据库异常、计划任务可独立运行。

任一关键检查失败时，停止新任务，将计划任务/IIS 路径切回上一版本并重新验收。回滚代码和代理配置，不通过重新导入、删除或批量修改商品数据处理运行环境故障。上一生产版本至少保留到新版本经过重启演练和观察期后再清理。

## 15. 生产启动、停止与重启命令

以下命令在 `113.249.110.37` Windows Server 的管理员 PowerShell 中执行。正式运行方式是 Windows 计划任务；直接执行 runner 仅用于前台诊断，不能与相同端口的计划任务同时运行。

### 15.1 启动关系与顺序

```text
PostgreSQL 5432
  -> Rhautt Nexus API 4400
      -> web.rhautt.com（Nginx）
  -> Brand Console 4012
      -> manage.rhautt.com（Nginx）
```

服务器冷启动时建议按以下顺序检查或启动：

1. PostgreSQL。
2. `RhauttNexusApi4400`。
3. `EverhotBrandConsole4012`。
4. Nginx。
5. 执行整链路验收。

### 15.2 查看正式启动命令

先读取计划任务实际执行的 runner，不要凭历史文件名猜测：

```powershell
Get-ScheduledTask `
  -TaskName "RhauttNexusApi4400","EverhotBrandConsole4012" |
  Select-Object TaskName,State,@{
    Name = "Execute"
    Expression = { $_.Actions.Execute }
  },@{
    Name = "Arguments"
    Expression = { $_.Actions.Arguments }
  }
```

当前预期启动链路：

```text
RhauttNexusApi4400
  -> E:\dev\rhautt-api-brand-113-prod-20260717-162500\run-api-4400.ps1
  -> E:\soft\nodejs\node.exe api\scripts\start-api.js
  -> 4400

EverhotBrandConsole4012
  -> E:\dev\run-brand-console-4012.ps1
  -> E:\soft\nodejs\node.exe E:\dev\brand-console\apps\brand-console\server.js
  -> 4012
```

### 15.3 检查或启动 PostgreSQL

不假定 PostgreSQL 的 Windows 服务名，先发现实际服务：

```powershell
$postgresService = Get-Service |
  Where-Object {
    $_.Name -like "postgresql*" -or
    $_.DisplayName -like "PostgreSQL*"
  } |
  Select-Object -First 1

if (-not $postgresService) {
    throw "PostgreSQL Windows service was not found."
}

$postgresService |
  Select-Object Name,DisplayName,Status,StartType

if ($postgresService.Status -ne "Running") {
    Start-Service -Name $postgresService.Name
    $postgresService.WaitForStatus("Running", "00:00:30")
}
```

验证 `5432`：

```powershell
Get-NetTCPConnection `
  -LocalPort 5432 `
  -State Listen `
  -ErrorAction Stop |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

### 15.4 启动 API 4400

```powershell
Start-ScheduledTask -TaskName "RhauttNexusApi4400"
Start-Sleep -Seconds 5

Get-ScheduledTask -TaskName "RhauttNexusApi4400" |
  Select-Object TaskName,State

Get-NetTCPConnection `
  -LocalPort 4400 `
  -State Listen `
  -ErrorAction Stop |
  Select-Object LocalAddress,LocalPort,OwningProcess

Invoke-RestMethod "http://127.0.0.1:4400/api/v2/health"
```

API 日志：

```powershell
$apiRoot = "E:\dev\rhautt-api-brand-113-prod-20260717-162500"

Get-Content `
  -LiteralPath "$apiRoot\logs\api-4400.stderr.log" `
  -Tail 100 `
  -ErrorAction SilentlyContinue

Get-Content `
  -LiteralPath "$apiRoot\logs\api-4400.stdout.log" `
  -Tail 100 `
  -ErrorAction SilentlyContinue
```

### 15.5 启动品牌控制台 4012

```powershell
Start-ScheduledTask -TaskName "EverhotBrandConsole4012"
Start-Sleep -Seconds 5

Get-ScheduledTask -TaskName "EverhotBrandConsole4012" |
  Select-Object TaskName,State

Get-NetTCPConnection `
  -LocalPort 4012 `
  -State Listen `
  -ErrorAction Stop |
  Select-Object LocalAddress,LocalPort,OwningProcess

Invoke-WebRequest `
  -UseBasicParsing `
  "http://127.0.0.1:4012/" |
  Select-Object StatusCode,StatusDescription
```

控制台日志：

```powershell
Get-Content `
  -LiteralPath "E:\dev\logs\brand-console.stderr.log" `
  -Tail 100 `
  -ErrorAction SilentlyContinue

Get-Content `
  -LiteralPath "E:\dev\logs\brand-console.stdout.log" `
  -Tail 100 `
  -ErrorAction SilentlyContinue
```

### 15.6 启动或重新加载 Nginx

当前 Nginx 目录：

```text
E:\soft\nginx-1.30.2
```

启动前始终测试配置：

```powershell
Set-Location E:\soft\nginx-1.30.2

.\nginx.exe -t
if ($LASTEXITCODE -ne 0) {
    throw "Nginx configuration test failed."
}

if (Get-Process nginx -ErrorAction SilentlyContinue) {
    .\nginx.exe -s reload
} else {
    Start-Process `
      -FilePath ".\nginx.exe" `
      -WorkingDirectory "E:\soft\nginx-1.30.2" `
      -WindowStyle Hidden
}
```

验证 Nginx 进程与域名：

```powershell
Get-Process nginx |
  Select-Object Id,ProcessName,StartTime

Invoke-WebRequest `
  -UseBasicParsing `
  "https://web.rhautt.com/api/v2/health" |
  Select-Object StatusCode,StatusDescription

curl.exe -I "http://manage.rhautt.com/"
curl.exe -I "https://manage.rhautt.com/"
```

预期 `manage.rhautt.com` 的 HTTP 返回 `301`，HTTPS 返回 `200`。

当前记录只证明 Nginx 正在运行，尚未确认它通过 Windows 服务、计划任务还是其他方式开机自启动。可用以下命令检查：

```powershell
Get-Service -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -match "nginx" -or $_.DisplayName -match "nginx"
  }

Get-ScheduledTask -ErrorAction SilentlyContinue |
  Where-Object { $_.TaskName -match "nginx" } |
  Select-Object TaskName,State
```

### 15.7 重启 API 或控制台

`Stop-ScheduledTask` 后应检查端口；如果旧 Node 进程仍监听，才终止该端口对应的 PID。

重启 API：

```powershell
Stop-ScheduledTask -TaskName "RhauttNexusApi4400"
Start-Sleep -Seconds 3

$apiProcessIds = Get-NetTCPConnection `
  -LocalPort 4400 `
  -State Listen `
  -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $apiProcessIds) {
    Stop-Process -Id $processId -Force
}

Start-ScheduledTask -TaskName "RhauttNexusApi4400"
Start-Sleep -Seconds 5
Invoke-RestMethod "http://127.0.0.1:4400/api/v2/health"
```

重启控制台：

```powershell
Stop-ScheduledTask -TaskName "EverhotBrandConsole4012"
Start-Sleep -Seconds 3

$consoleProcessIds = Get-NetTCPConnection `
  -LocalPort 4012 `
  -State Listen `
  -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $consoleProcessIds) {
    Stop-Process -Id $processId -Force
}

Start-ScheduledTask -TaskName "EverhotBrandConsole4012"
Start-Sleep -Seconds 5
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:4012/"
```

### 15.8 前台诊断启动

仅在对应计划任务已经停止、端口已经释放时使用。命令会占用当前 PowerShell 窗口；结束诊断后按 `Ctrl+C`，再恢复计划任务。

API 前台启动：

```powershell
Stop-ScheduledTask -TaskName "RhauttNexusApi4400"
& "E:\dev\rhautt-api-brand-113-prod-20260717-162500\run-api-4400.ps1"
```

控制台前台启动：

```powershell
Stop-ScheduledTask -TaskName "EverhotBrandConsole4012"
& "E:\dev\run-brand-console-4012.ps1"
```

诊断完成后恢复正式运行：

```powershell
Start-ScheduledTask -TaskName "RhauttNexusApi4400"
Start-ScheduledTask -TaskName "EverhotBrandConsole4012"
```

### 15.9 启动后的完整验收

```powershell
$health = Invoke-RestMethod `
  "http://127.0.0.1:4400/api/v2/health"

$local = Invoke-RestMethod `
  "http://127.0.0.1:4400/api/v2/brand/everhot/products?locale=zh-CN"

$backend = Invoke-RestMethod `
  "https://web.rhautt.com/api/v2/brand/everhot/products?locale=zh-CN"

$frontend = Invoke-RestMethod `
  "https://everhot.com.cn/api/v2/brand/everhot/products?locale=zh-CN"

$console = Invoke-WebRequest `
  -UseBasicParsing `
  "https://manage.rhautt.com/"

[PSCustomObject]@{
    Health       = $health.success
    Local        = $local.data.total
    WebBackend   = $backend.data.total
    EverhotProxy = $frontend.data.total
    ManageStatus = $console.StatusCode
}
```

当前基线预期：

```text
Health       True
Local        27
WebBackend   27
EverhotProxy 27
ManageStatus 200
```
