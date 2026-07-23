# Rhautt Nexus Windows 离线打包部署 Runbook

> 日期：2026-07-23  
> 目标环境：Windows Server + Nginx  
> 对外域名：`https://nexus.rhautt.com/`  
> 产品：Rhautt Nexus / 瑞合数智枢纽  
> 目的：记录本次成功部署链路，后续打包、上传、替换、数据库补迁移、SSO 自动开通和验收按本文执行。

本文不保存任何真实密钥。`OIDC_CLIENT_SECRET`、`JWT_SECRET`、`POSTGRES_PASSWORD`、`PHONE_HASH_SECRET`、`PII_ENCRYPTION_KEY` 不得写入文档、Git、部署包或聊天记录。

## 1. 部署边界

本次离线包只部署 Nexus 前后端：

| 组件 | 本机监听 | 对外入口 | 说明 |
|---|---:|---|---|
| Nexus 前端 `apps/dealer-workbench` | `127.0.0.1:5000` | `https://nexus.rhautt.com/` | Next standalone |
| Nexus 后端 `services/api` | `127.0.0.1:4500` | `https://nexus.rhautt.com/api/*`、`/ws` | NestJS/Fastify |
| PostgreSQL | `127.0.0.1:5432` | 不直接公网暴露 | 使用现有库 `rhautt_nexus` |

不属于本次部署范围：

| 组件 | 端口 | 处理原则 |
|---|---:|---|
| 品牌管理后台 | `4012` | 不打包、不覆盖、不纳入 Nexus 启动脚本 |
| 旧品牌 API | `4400` | 不打包、不覆盖 |
| 官网/集团官网 | 独立域名和服务 | 暂不部署 |

## 2. 本地打包前确认

打包前必须确认：

- 前端固定 `5000`，后端固定 `4500`，不得改端口。
- Nginx `/api/` 和 `/ws` 转发到 `4500`，其他路径转发到 `5000`。
- 服务器数据库为现有 PostgreSQL 库，不做整库覆盖。
- SSO 登录后默认进入 `/brand`。
- `config\.env.production` 只在服务器上保存真实密钥。
- 需要启用生产 SSO 自动开通时，必须使用白名单邮箱域名和角色映射。

## 3. 本地构建与打包

在本地仓库执行：

```powershell
cd D:\Project\Red\rhautt_comfort
```

构建后端：

```powershell
node_modules\.bin\tsc.cmd --project services\api\tsconfig.build.json
```

构建前端：

```powershell
pnpm.cmd --filter dealer-workbench build
```

生成 Windows 离线包 stage：

```powershell
node scripts\release\package-windows-nexus.js
```

生成 ZIP：

```powershell
tar.exe -a -cf deployment-packages\rhautt-nexus-windows-offline-YYYYMMDD.zip `
  -C deployment-packages\.windows-nexus-stage rhautt-nexus
```

本次自动开通版本产物：

```text
D:\Project\Red\rhautt_comfort\deployment-packages\rhautt-nexus-windows-offline-20260722-autoprovision.zip
SHA-256: A9ED7F87D929847139B358177A89D6F3B7E41D3EEB2781A5B359ED23FA2FE4D4
```

抽查包内容：

```powershell
Select-String `
  deployment-packages\.windows-nexus-stage\rhautt-nexus\backend\dist\services\api\modules\auth\sso-external-identity.service.js `
  -Pattern "OIDC_AUTO_PROVISION_ENABLED|OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS"

Select-String `
  deployment-packages\.windows-nexus-stage\rhautt-nexus\config\.env.production.example `
  -Pattern "OIDC_AUTO_PROVISION"
```

## 4. 云服务器替换步骤

服务器部署目录：

```text
E:\dev\rhautt-nexus
```

Nginx 目录：

```text
E:\soft\nginx-1.30.2
```

先停止应用服务，再解压覆盖。Windows 上运行中的 `node.exe` 可能锁文件，不能边跑边覆盖。

```powershell
cd E:\dev\rhautt-nexus
scripts\stop-all.cmd
```

确认端口释放：

```powershell
Get-NetTCPConnection -LocalPort 4500,5000 -State Listen -ErrorAction SilentlyContinue
```

没有输出表示端口已释放。

备份当前目录：

```powershell
cd E:\dev
Rename-Item E:\dev\rhautt-nexus rhautt-nexus.bak-YYYYMMDD-HHMM
```

解压新包到 `E:\dev`，确保最终目录仍然是：

```text
E:\dev\rhautt-nexus
```

复制旧生产配置回来：

```powershell
Copy-Item `
  E:\dev\rhautt-nexus.bak-YYYYMMDD-HHMM\config\.env.production `
  E:\dev\rhautt-nexus\config\.env.production
```

如果只是热修一个后端 JS 文件，也必须先备份原文件：

```powershell
Copy-Item `
  E:\dev\rhautt-nexus\backend\dist\services\api\modules\auth\sso-external-identity.service.js `
  E:\dev\rhautt-nexus\backend\dist\services\api\modules\auth\sso-external-identity.service.js.bak
```

然后覆盖：

```text
E:\dev\rhautt-nexus\backend\dist\services\api\modules\auth\sso-external-identity.service.js
```

## 5. 服务器 `.env.production`

必须保留真实生产值：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=4500
API_PORT=4500

POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<real database password>
POSTGRES_DB=rhautt_nexus
POSTGRES_SCHEMA=rhautt_nexus
POSTGRES_SYNCHRONIZE=false

JWT_SECRET=<real random secret>
PHONE_HASH_SECRET=<real hash secret>
PII_ENCRYPTION_KEY=<real 32-byte hex or base64 key>

OIDC_ISSUER=https://ai.rhautt.com
OIDC_CLIENT_ID=cli_mrve0bgvgnl2gkjg
OIDC_CLIENT_SECRET=<real OIDC client secret>
OIDC_REDIRECT_URI=https://nexus.rhautt.com/api/v2/auth/sso/callback
OIDC_SCOPES=openid profile email roles org
OIDC_POST_LOGIN_REDIRECT=/brand
OIDC_USERINFO_ENABLED=true
OIDC_ALLOWED_REDIRECT_HOSTS=nexus.rhautt.com
OIDC_ROLES_CLAIM=roles
OIDC_ORG_CLAIM=org
```

生产 SSO 自动开通配置：

```dotenv
OIDC_AUTO_PROVISION_ENABLED=true
OIDC_AUTO_PROVISION_ALLOWED_EMAIL_DOMAINS=rhenext.com
OIDC_AUTO_PROVISION_TENANT_CODE=DEFAULT
OIDC_AUTO_PROVISION_ROLE_MAP=owner:platform_admin,admin:platform_admin,employee:hq_admin
OIDC_AUTO_PROVISION_DEFAULT_ROLE=hq_admin
```

自动开通规则：

- `@rhenext.com` 邮箱允许自动开通。
- OIDC `roles` 包含 `owner` 或 `admin` -> `platform_admin`。
- OIDC `roles` 包含 `employee` -> `hq_admin`。
- 未命中白名单域名的用户保持 `pending_authorization`。
- 已存在的 `pending_authorization` 绑定，在启用自动开通后再次登录会自动激活。

如果真实 OIDC secret 曾经出现在聊天、日志或文档中，必须到 `ai.rhautt.com` 后台轮换 secret，并同步更新服务器 `.env.production`。

## 6. 数据库迁移

不要默认整库覆盖。先用迁移补结构。

本次 SSO 必需表：

```text
rhautt_nexus.auth_external_identity_bindings
```

如果缺表，执行：

```powershell
cd E:\dev\rhautt-nexus

psql -h 127.0.0.1 -p 5432 -U postgres -d rhautt_nexus `
  -v ON_ERROR_STOP=1 `
  -f .\migrations\046_auth_external_identity_bindings.sql
```

验证：

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d rhautt_nexus -c "\dt rhautt_nexus.*identity*"
```

需要查看 SSO 绑定：

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d rhautt_nexus -c "
select b.id, b.external_subject, b.status, u.display_name, u.role, b.last_seen_profile
from rhautt_nexus.auth_external_identity_bindings b
left join rhautt_nexus.users u on u.id = b.local_user_id
order by b.updated_at desc
limit 10;
"
```

手工绑定兜底模板：

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d rhautt_nexus -c "
update rhautt_nexus.auth_external_identity_bindings
set tenant_id = '<user tenant_id>',
    local_user_id = '<user id>',
    status = 'active',
    updated_at = now()
where id = '<binding id>';
"
```

不要把 `<...>` 占位符原样执行，必须替换为真实 UUID。

## 7. Nginx 配置

当前 Nexus Nginx 应保持：

```nginx
upstream rhautt_nexus_frontend {
    server 127.0.0.1:5000;
    keepalive 32;
}

upstream rhautt_nexus_backend {
    server 127.0.0.1:4500;
    keepalive 32;
}
```

关键 location：

```nginx
location /api/ {
    proxy_pass http://rhautt_nexus_backend;
}

location /ws {
    proxy_pass http://rhautt_nexus_backend;
}

location /_next/static/ {
    proxy_pass http://rhautt_nexus_frontend;
}

location / {
    proxy_pass http://rhautt_nexus_frontend;
}
```

检查并 reload：

```powershell
cd E:\soft\nginx-1.30.2
.\nginx.exe -T
.\nginx.exe -t
.\nginx.exe -s reload
```

如果 `https://nexus.rhautt.com/` 返回 `Cannot GET /`，通常是 `/` 被转到了后端 `4500`，需要检查 frontend upstream 是否误写成 `4500`。

## 8. 启动与进程确认

启动：

```powershell
cd E:\dev\rhautt-nexus
scripts\start-all.cmd
scripts\status.cmd
scripts\health-check.cmd
```

确认 4500/5000：

```powershell
Get-NetTCPConnection -LocalPort 4500,5000 -State Listen
```

确认后端进程来自当前目录：

```powershell
$Pid4500 = (Get-NetTCPConnection -LocalPort 4500 -State Listen).OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId=$Pid4500" |
  Select-Object ProcessId,Name,CommandLine
```

必须看到：

```text
E:\dev\rhautt-nexus\runtime\node.exe E:\dev\rhautt-nexus\scripts\backend-launcher.js
```

如果看到旧目录，例如：

```text
E:\dev\RhauttNexus\rhautt-nexus
```

说明旧服务还在占用 `4500`，必须停止旧计划任务或旧进程。

查计划任务：

```powershell
Get-ScheduledTask |
  Where-Object { $_.TaskName -like "*Rhautt*" -or $_.TaskName -like "*Nexus*" } |
  Select-Object TaskName,TaskPath,State
```

看任务动作：

```powershell
Get-ScheduledTask -TaskName RhauttNexusApi4400 |
  Select-Object -ExpandProperty Actions
```

确认是旧服务后再禁用：

```powershell
Disable-ScheduledTask -TaskName RhauttNexusApi4400
```

## 9. 验收测试

本机 API：

```powershell
Invoke-RestMethod http://127.0.0.1:4500/api/v2/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5000/
```

公网入口：

```powershell
curl.exe -k -L https://nexus.rhautt.com/
curl.exe -k https://nexus.rhautt.com/api/v2/health
curl.exe -k -i "https://nexus.rhautt.com/api/v2/auth/sso/login?redirect=/brand"
```

期望：

- `/` 返回前端 HTML。
- `/api/v2/health` 返回 `success:true`。
- `/api/v2/auth/sso/login?redirect=/brand` 返回 `302 Found`，`location` 指向 `https://ai.rhautt.com/api/oidc/authorize...`。

浏览器测试：

1. 开新 InPrivate/隐私窗口。
2. 访问 `https://nexus.rhautt.com/`。
3. 点击 SSO 登录。
4. 登录后应返回 `https://nexus.rhautt.com/brand`。

浏览器控制台确认身份：

```js
fetch('/api/v2/auth/me', { credentials: 'include' })
  .then(async r => console.log(r.status, await r.text()))
```

期望 `200`，并返回当前 `role`。

后端 SSO 日志：

```powershell
Get-Content E:\dev\rhautt-nexus\logs\backend-4500.log -Tail 120 |
  Select-String -Pattern "SsoAudit|sso.callback.succeeded|sso.callback.failed|failureReason"
```

成功应出现：

```text
sso.callback.succeeded
```

常见失败含义：

| failureReason | 含义 | 处理 |
|---|---|---|
| `state_mismatch` | cookie/state 不一致，常见于旧窗口、重复 callback、重启后继续旧流程 | 新开隐私窗口，从头点 SSO |
| `unexpected` 且缺 `auth_external_identity_bindings` | 数据库结构缺迁移 | 执行 `046_auth_external_identity_bindings.sql` |
| `pending_authorization` | SSO 账号未绑定，或自动开通未启用/未命中白名单 | 启用自动开通或手工绑定 |
| `token_endpoint_error` | OIDC secret/client/callback 不匹配 | 检查 `OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`、`OIDC_REDIRECT_URI` |
| `client_secret_missing` | 未配置 OIDC secret | 补服务器 `.env.production` |

## 10. 回滚

停止新服务：

```powershell
cd E:\dev\rhautt-nexus
scripts\stop-all.cmd
```

恢复旧目录：

```powershell
cd E:\dev
Rename-Item E:\dev\rhautt-nexus rhautt-nexus.failed-YYYYMMDD-HHMM
Rename-Item E:\dev\rhautt-nexus.bak-YYYYMMDD-HHMM rhautt-nexus
```

启动旧目录：

```powershell
cd E:\dev\rhautt-nexus
scripts\start-all.cmd
scripts\health-check.cmd
```

数据库迁移 `046_auth_external_identity_bindings.sql` 是新增表，通常无需回滚。若确需回滚数据库，必须先确认没有生产登录依赖该表，再由管理员手动处理。

## 11. 本次已验证命令

本地验证：

```text
services/api SSO external identity focused node:test: 8/8 pass
services/api TypeScript build: pass
Windows package stage generation: pass
ZIP generation: pass
```

服务器验证过的关键状态：

```text
backend: running, port 4500
dealer: running, port 5000
Nexus backend: HTTP 200 OK
Nexus frontend: HTTP 200 OK
Nginx frontend upstream: 127.0.0.1:5000
Nginx backend upstream: 127.0.0.1:4500
auth_external_identity_bindings: exists
SSO bindings: active
```

