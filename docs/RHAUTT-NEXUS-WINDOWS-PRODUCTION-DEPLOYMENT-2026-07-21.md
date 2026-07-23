# Rhautt Nexus Windows 生产部署复盘与运行手册

> 日期：2026-07-21
> 生产服务器：`113.249.110.37`（Windows Server，服务器内网地址 `10.0.0.20`）
> 统一入口：`https://nexus.rhautt.com/`
> 产品名称：**Rhautt Nexus / 瑞合数智枢纽**

## 1. 文档目的

本文记录本次 Rhautt Nexus 上云过程中确认的部署边界、最终拓扑、全部主要故障、根因、修复方式、验收命令和遗留风险，作为后续发布、重启、回滚和排障基线。

本文不保存 PostgreSQL 密码、`JWT_SECRET`、`PHONE_HASH_SECRET` 或 `PII_ENCRYPTION_KEY` 的明文值。

## 2. 最终部署边界

本次新增部署只负责 Rhautt Nexus 的前后端：

| 角色 | 本机监听 | 外部入口 | 状态 |
|---|---|---|---|
| Nexus 前端（dealer-workbench） | `127.0.0.1:4000` | `https://nexus.rhautt.com/` | 已验证 HTTP 可访问 |
| Nexus NestJS API | `127.0.0.1:4500` | `https://nexus.rhautt.com/api/*` | 已验证 health 返回 `success:true` |
| PostgreSQL | `127.0.0.1:5432` | 不直接对公网提供应用访问 | 后端已成功连接 |

以下既有服务不属于本次部署，不得被 Nexus 包、启动脚本或 Nginx 新配置覆盖：

| 既有服务 | 本机监听 | 外部入口 | 约束 |
|---|---|---|---|
| 品牌管理后台 | `4012` | `https://manage.rhautt.com/` | 保留原部署和原 Nginx 配置 |
| Everhot/品牌旧 API | `4400` | 供既有品牌站和 4012 使用 | 保留原计划任务和运行目录 |
| 瑞诺瓦问诊 | 云端既有部署 | `https://rhautt.com/` | Nexus 中只跳转，不在本次包内重复部署 |

生产链路如下：

```text
Internet
  -> nexus.rhautt.com:443
      -> Nginx
          -> /api/*, /ws -> 127.0.0.1:4500
          -> 其他路径     -> 127.0.0.1:4000

  -> manage.rhautt.com:443
      -> 既有 Nginx 配置 -> 127.0.0.1:4012
                              -> 既有品牌 API 127.0.0.1:4400
```

## 3. 打包与目录结论

### 3.1 打包方式

前端和后端应当分离构建、分离启动、分离检查：

- 前端独立监听 `4000`。
- 后端独立监听 `4500`。
- Nginx 根据路径转发。
- 交付时可以放入同一个版本化 ZIP，但运行边界必须保持分离。
- 4012 和 4400 不应包含在本次 Nexus 新部署的启动范围内。

### 3.2 服务器目录

部署目录不要求必须存在 `D:` 盘。此次实际使用：

```text
E:\dev\RhauttNexus\rhautt-nexus
```

Nginx 目录：

```text
E:\soft\nginx-1.30.2
```

Nexus 独立 Nginx 配置：

```text
E:\soft\nginx-1.30.2\conf\conf.d\nexus.rhautt.com.conf
```

旧品牌 API 运行目录：

```text
E:\dev\rhautt-api-brand-113-prod-20260717-162500
```

## 4. 数据库与密钥原则

### 4.1 PostgreSQL 连接

虽然服务器公网地址为 `113.249.110.37`，但 Nexus API 和 PostgreSQL 位于同一台 Windows Server 时，应用必须优先使用：

```dotenv
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_DB=rhautt_nexus
POSTGRES_SCHEMA=rhautt_nexus
POSTGRES_SYNCHRONIZE=false
```

不要让本机应用绕行公网地址 `113.249.110.37:5432`。本次后端最初因此发生 `ETIMEDOUT`。

### 4.2 数据迁移

数据库采用 SQL/PostgreSQL 工具迁移。恢复前应停止会写库的 Nexus 后端，并先确认目标库是空库还是已有业务库。未经明确批准，不执行 `--clean`、DROP 或覆盖式恢复。

曾出现以下命令错误：

```text
无法将“\psql.exe”识别为 cmdlet、函数、脚本文件或可运行程序
```

根因是 `$PgBin` 未赋值，`"$PgBin\psql.exe"` 最终变成了 `\psql.exe`。应先发现实际安装路径：

```powershell
$Psql = Get-ChildItem `
  'C:\Program Files\PostgreSQL\*\bin\psql.exe', `
  'E:\soft\PostgreSQL\*\bin\psql.exe' `
  -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $Psql) {
    throw '未找到 psql.exe，请确认 PostgreSQL 客户端安装目录。'
}

& $Psql --version
```

### 4.3 密钥连续性

已有加密业务数据时：

- `PII_ENCRYPTION_KEY` 必须继续使用原生产密钥，否则历史 PII 无法解密。
- `PHONE_HASH_SECRET` 必须继续使用原生产密钥，否则相同手机号将生成不同哈希，影响查询、去重和账号识别。
- `JWT_SECRET` 变更会使现有登录会话失效；相关前后端必须保持一致。
- 只有全新空库、无历史数据的环境才可以直接生成全新的三组密钥。

本次排障过程中密码和密钥曾以明文输入交互终端或对话。不得把这些值写入仓库、部署文档或日志。数据库密码和 JWT 应安排轮换；PII 和手机号密钥如需轮换，必须通过受控迁移完成，不能直接替换。

## 5. 本次问题、根因与处理结果

### 5.1 部署路径被误认为必须使用 D 盘

**现象**：最初示例使用 `D:\RhauttNexus\packages\`，服务器没有 D 盘。

**根因**：示例路径被误解为强制路径。

**结论**：发布包可以上传到任意明确、稳定、权限正确的版本目录。本次采用 `E:\dev\RhauttNexus\rhautt-nexus`。

### 5.2 包含了不应重复部署的 4012

**现象**：早期发布说明和 Nginx 示例同时包含 Nexus、品牌控制台 4012 和旧 API 4400，造成端口冲突和职责混淆。

**根因**：打包模板沿用了“三服务合包”的旧边界，没有遵守“4012 已上线，不在本次部署范围内”的要求。

**最终处理**：本次 Nexus 新部署只处理 4000 和 4500；原有 `manage.rhautt.com -> 4012` 以及其依赖的 4400 保持不动。

**仓库遗留风险**：截至本文形成时，以下模板仍记录旧的 4400/4012 合包方式，不能直接作为下一次 Nexus 4500 发布依据：

- `deploy/windows/DEPLOY.md`
- `deploy/windows/config/.env.production.example`
- `deploy/windows/nginx/nexus.rhautt.com.conf`
- `deploy/windows/scripts/service-manager.js`
- `deploy/windows/scripts/start-frontend.cmd`

### 5.3 后端启动后 4500 不监听

**现象**：`start-all.cmd` 显示后端已启动，但 health check 失败，`Get-NetTCPConnection -LocalPort 4500` 没有结果。

日志核心错误：

```text
Unable to connect to the database
connect ETIMEDOUT 113.249.110.37:5432
JWT_SECRET 未配置，使用开发默认值
```

**根因**：

1. 后端使用公网 IP 连接同机 PostgreSQL，连接超时。
2. 生产 `.env.production` 没有在鉴权模块初始化前加载。
3. 启动器输出 PID 不等于应用已经完成启动并开始监听。

**处理**：

- 数据库主机改为 `127.0.0.1`。
- 启动前设置 `DOTENV_CONFIG_PATH`，并通过 dotenv preload/launcher 先加载生产环境。
- 启动后同时检查端口、health 和错误日志。

**验证结果**：`127.0.0.1:4500/api/v2/health` 返回 HTTP 200 和 `success:true`。

### 5.4 Nginx 返回 502 Bad Gateway

**现象**：

```text
https://nexus.rhautt.com/api/v2/health -> 502 Bad Gateway
```

Nginx 错误日志显示：

```text
connect() failed (10061: No connection could be made because the target machine actively refused it)
upstream: http://127.0.0.1:4500/api/v2/health
```

**根因**：Nginx 路由已正确指向 4500，但后端没有监听 4500。

**处理**：先恢复后端监听并验证本机 health，再验证 Nginx。502 与数据库数据内容无关，它表示 Nginx 无法连接上游进程。

### 5.5 `server directive is not allowed here`

**现象**：

```text
"server" directive is not allowed here in nginx.conf:166
```

**根因**：`server {}` 被放在 `http {}` 外部，或附近大括号层级错误。

**处理**：Nexus 配置作为独立文件加载，`include` 必须位于主配置的 `http {}` 内。每次修改后先执行 `nginx.exe -t`，成功后才能 reload。

### 5.6 `manage.rhautt.com` server name 冲突

**现象**：

```text
conflicting server name "manage.rhautt.com" on 0.0.0.0:80, ignored
conflicting server name "manage.rhautt.com" on 0.0.0.0:443, ignored
```

**根因**：生效配置中存在重复的 `manage.rhautt.com` server block。Nginx 会忽略后出现的重复块，因此配置语法虽然通过，实际命中的代理块可能不是预期版本。

**处理边界**：用户明确要求不修改原有 4012 配置，因此本次 Nexus 独立配置不再声明 `manage.rhautt.com`。现有 80 端口 warning 仍属于旧配置遗留项，只有在单独备份和确认两个重复块来源后才能清理。

### 5.7 `manage.rhautt.com` 显示 Nginx 欢迎页或后台内容为空

这两个现象需要分开判断：

1. 显示 Nginx 欢迎页通常表示请求命中了默认 server 或错误的重复 server block。
2. 管理后台页面可以打开但商品列表为空，表示 4012 前端存活，但其数据 API 可能不可用。

本次 4012 进程为：

```text
node.exe apps\brand-console\server.js
```

页面空数据的直接原因是旧 API 端口 4400 没有监听，不是 PostgreSQL 中的 27 条商品被删除。

### 5.8 旧 API 计划任务显示 Ready，但 4400 没有监听

**现象**：计划任务 `RhauttNexusApi4400` 显示 `Ready`，但：

```text
LastTaskResult = 1
127.0.0.1:4400 无监听
```

**根因**：`Ready` 只表示任务可被调度，不表示任务正在运行。旧 runner 没有加载 API 目录中的 `.env.production`，Node 进程启动失败；日志文件也没有产生有效输出。

**处理**：修正 runner，在 Node/NestJS 加载前解析正确的生产环境文件，并让任务等待子进程，避免任务立即退出。

**验证结果**：

```text
127.0.0.1:4400/api/v2/health -> success=True
Everhot products total       -> 27
```

因此无需重新导入、删除或覆盖商品数据。

### 5.9 Nexus 域名最初无法解析

**现象**：

```text
未能解析此远程名称: nexus.rhautt.com
```

**根因**：DNS A 记录当时尚未建立或尚未传播。

**处理与结果**：A 记录最终解析到 `113.249.110.37`。DNS 只负责把域名指向服务器，不决定 Nginx 转发到哪个本机端口。

### 5.10 Nexus 域名打开了错误页面或 API 返回 Unauthorized

**现象**：域名曾打开 StratOS/其他页面，根路径返回 `307`，API 曾返回：

```json
{"error":"Unauthorized"}
```

**证据**：同一时刻直接访问 4000、4500 或 4400 的结果与域名结果不同，说明请求没有进入预期的 Nexus server block，而不是数据库决定了页面。

**根因**：Nexus 独立配置文件没有被主 Nginx 配置实际加载，或者请求被已有 server block 捕获。

**处理**：在主配置 `http {}` 内只加载 Nexus 独立文件：

```nginx
include E:/soft/nginx-1.30.2/conf/conf.d/nexus.rhautt.com.conf;
```

随后使用 `nginx.exe -T` 验证生效配置，而不是只查看磁盘上的文件。

最终输出已经确认：

```text
# configuration file E:/soft/nginx-1.30.2/conf/conf.d/nexus.rhautt.com.conf:
server 127.0.0.1:4000;
server 127.0.0.1:4500;
server_name nexus.rhautt.com;
```

### 5.11 `include` 替换次数异常

**现象**：保护脚本发现：

```text
原 include 出现次数不是 1，停止修改。
```

**根因**：主配置中通配 `include conf/conf.d/*.conf;` 不止出现一次，直接全局替换可能重复加载配置并影响其他站点。

**最终处理**：确认主配置仅有一条 Nexus 精确 include 生效。最终检测结果：

```text
Nexus include count: 1
nginx configuration test is successful
```

后续不得用无条件 `.Replace()` 修改全部 include；必须先检查上下文、数量并备份。

### 5.12 根路径不是预期业务导航页

Nginx 只负责把 Nexus 页面请求转发到 4000，不决定 Next.js 应显示登录页、`/command` 还是 `/hub`。

当前应用关系：

- `/` 是 dealer-workbench 的统一登录/入口逻辑。
- `/hub` 是当前源码中的业务导航 Hub。
- 未登录时 `/hub` 可能重定向回登录入口。
- 根路径出现 `307` 属于前端路由或认证逻辑，不能通过修改数据库或把 Nginx 改到 4010/4012解决。

是否把 `/` 直接改成 Hub、登录后落到哪个路由，需要作为前端产品决策单独验收。

### 5.13 前端仍含本地地址

已观察到当前 4000 构建产物中的“返回集团官网”链接仍指向：

```text
http://localhost:4005
```

这是前端构建配置/源码问题，不是 Nginx 问题。生产目标应使用正式域名并重新构建前端，不能依赖服务器本机 `localhost:4005`。

## 6. 最终 Nexus Nginx 配置基线

主 `nginx.conf` 的 `http {}` 中只加入一条精确 include：

```nginx
include E:/soft/nginx-1.30.2/conf/conf.d/nexus.rhautt.com.conf;
```

`nexus.rhautt.com.conf` 只声明 Nexus，不声明 `manage.rhautt.com`、4012、4400 或其他旧站点：

```nginx
upstream rhautt_nexus_frontend {
    server 127.0.0.1:4000;
    keepalive 32;
}

upstream rhautt_nexus_backend {
    server 127.0.0.1:4500;
    keepalive 32;
}

server {
    listen 80;
    server_name nexus.rhautt.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name nexus.rhautt.com;

    ssl_certificate     C:/cert/rhautt.com_cert_chain.pem;
    ssl_certificate_key C:/cert/rhautt.com_key.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 100m;
    proxy_connect_timeout 60s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;

    location /api/ {
        proxy_pass http://rhautt_nexus_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /ws {
        proxy_pass http://rhautt_nexus_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /_next/static/ {
        proxy_pass http://rhautt_nexus_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://rhautt_nexus_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

该配置依赖主 `http {}` 中已存在：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

## 7. 标准启动后验收

以下命令在服务器管理员 PowerShell 中执行。

### 7.1 端口和进程

```powershell
Get-NetTCPConnection `
  -LocalPort 4000,4012,4400,4500,5432 `
  -State Listen `
  -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

### 7.2 Nexus 本机直连

```powershell
Invoke-WebRequest -UseBasicParsing `
  http://127.0.0.1:4000/ |
  Select-Object StatusCode,StatusDescription

Invoke-RestMethod `
  http://127.0.0.1:4500/api/v2/health
```

### 7.3 验证 Nginx 实际加载内容

```powershell
Set-Location E:\soft\nginx-1.30.2

.\nginx.exe -t
if ($LASTEXITCODE -ne 0) {
    throw 'Nginx 配置检查失败，禁止 reload。'
}

.\nginx.exe -T 2>&1 |
  Select-String `
    -Pattern 'configuration file.*nexus|server_name nexus\.rhautt\.com|127\.0\.0\.1:4000|127\.0\.0\.1:4500' `
    -Context 1,5
```

### 7.4 Nexus 通过 Nginx 的本机闭环

```powershell
curl.exe -k -L -sS -o NUL `
  -w "Nexus Frontend: HTTP %{http_code}`n" `
  --resolve nexus.rhautt.com:443:127.0.0.1 `
  https://nexus.rhautt.com/

curl.exe -k -sS `
  --resolve nexus.rhautt.com:443:127.0.0.1 `
  https://nexus.rhautt.com/api/v2/health
```

预期前端最终状态为 HTTP 200，health 包含：

```json
{"success":true,"platform":"Rhautt Nexus / 瑞合数智枢纽"}
```

### 7.5 公网和既有服务回归

```powershell
Resolve-DnsName nexus.rhautt.com -Type A |
  Select-Object Name,IPAddress

curl.exe -k -L -sS -o NUL `
  -w "Nexus Public: HTTP %{http_code}`n" `
  https://nexus.rhautt.com/

curl.exe -k -sS `
  https://nexus.rhautt.com/api/v2/health

curl.exe -k -L -sS -o NUL `
  -w "Manage 4012: HTTP %{http_code}`n" `
  https://manage.rhautt.com/

$Products = Invoke-RestMethod `
  'http://127.0.0.1:4400/api/v2/brand/everhot/products?locale=zh-CN'

$Products.data.total
```

当前基线：

```text
nexus.rhautt.com A record -> 113.249.110.37
Nexus Public             -> HTTP 200（允许认证流程中的中间 307）
Nexus API                -> success:true
Manage                   -> HTTP 200
Everhot product total    -> 27
```

## 8. 排障顺序

遇到页面或 API 异常时按以下顺序检查，避免把代理或进程问题误判为数据库问题：

1. 检查对应本机端口是否监听。
2. 直接访问本机前端/API。
3. 检查应用 stderr/stdout 日志。
4. 执行 `nginx.exe -t`。
5. 执行 `nginx.exe -T`，确认配置确实已加载。
6. 使用 `curl --resolve` 绕过公网 DNS，验证本机 Nginx 虚拟主机。
7. 验证 DNS 和公网访问。
8. 只有 API 已成功连接数据库但返回数据异常时，才检查表、schema、迁移和数据数量。

错误与层级快速对应：

| 表现 | 优先检查 |
|---|---|
| 域名无法解析 | DNS A 记录和传播 |
| Nginx 欢迎页/其他产品页面 | server block、include、SNI/Host |
| 502 Bad Gateway | 上游端口和进程 |
| Connection refused | 目标进程未监听或监听地址错误 |
| ETIMEDOUT 到公网 5432 | 数据库地址、防火墙、同机绕公网 |
| 页面可开但列表为空 | 页面调用的 API 端口、认证和 API 日志 |
| Unauthorized | 请求是否进入正确 API、鉴权配置、JWT |
| 307 跳转 | Next.js 路由和登录状态 |

## 9. 禁止操作

- 不要修改或删除原有 4012 配置来解决 Nexus 4000/4500 问题。
- 不要把 4012 再次加入 Nexus 启动包。
- 不要因页面空白直接重新导入或覆盖 PostgreSQL 数据。
- 不要用公网 IP 连接同机 PostgreSQL。
- 不要在 `nginx.exe -t` 失败时 reload。
- 不要只看磁盘配置文件；必须用 `nginx.exe -T` 确认实际生效配置。
- 不要把 `Ready` 当作计划任务正在运行的证明。
- 不要把密码或密钥提交到 Git、ZIP、日志或文档。
- 不要在没有备份和来源确认时批量替换所有 Nginx include。

## 10. 当前验收状态与遗留项

| 项目 | 状态 | 说明 |
|---|---|---|
| Nexus DNS | 已验证 | `nexus.rhautt.com -> 113.249.110.37` |
| Nexus 前端 4000 | 已验证 | 本机返回 HTTP 200 |
| Nexus 后端 4500 | 已验证 | 本机 health 返回 `success:true` |
| Nexus Nginx 配置 | 已验证 | 独立配置已被 `nginx.exe -T` 加载 |
| Nexus 域名 API | 已验证 | 通过 HTTPS 返回 `success:true` |
| 既有 Manage 4012 | 已恢复 | 保持既有部署，不属于本次包 |
| 既有 API 4400 | 已恢复 | health 正常，商品数 27 |
| PostgreSQL 业务数据 | 未发现丢失 | 27 条商品仍存在，不需重导 |
| `manage.rhautt.com:80` 重复 warning | 待单独清理 | 本次按要求不修改旧配置 |
| Nexus `/` 页面产品验收 | 待确认 | 登录页、`/command`、`/hub` 落点需产品确认 |
| “返回集团官网”生产链接 | 待修复并重构建 | 当前构建仍含 `http://localhost:4005` |
| 4000/4500 开机自启 | 尚未完成验证 | 需注册服务或计划任务并做重启演练 |
| 仓库 Windows 部署模板 | 待修正 | 当前仍混入 4012/4400，与最终边界不一致 |
| 密钥轮换 | 待制定方案 | PII/手机号密钥不能直接替换 |

## 11. 下一步发布门槛

在宣告本次生产部署完全结束前，还应完成：

1. 确认 `https://nexus.rhautt.com/` 的最终产品落点和登录后导航行为。
2. 修正前端 `localhost:4005` 链接并重新构建 4000 产物。
3. 将 4000 和 4500 注册为 Windows 服务或计划任务。
4. 完成一次服务器重启演练，确认 5432、4400、4012、4500、4000 和 Nginx 按依赖顺序恢复。
5. 在不影响现有 4012 的前提下，单独审计 `manage.rhautt.com` 重复 server block。
6. 更新仓库 Windows 发布模板，使其固定为 Nexus 4000/4500，不再启动 4012/4400。
7. 形成数据库备份、SHA-256 校验和隔离恢复演练记录。
