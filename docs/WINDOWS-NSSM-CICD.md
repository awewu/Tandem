# Windows Server + NSSM 自动发布

适用场景：

- GitLab 在公司内网或本地服务器，云服务器访问不了 GitLab。
- 云服务器是 Windows Server。
- 应用进程由 NSSM 托管。
- 发布方式不是 Docker，而是 Next.js standalone zip 包。

## 目录约定

云服务器建议使用：

```text
E:\tandem-deploy\
  app\                 当前运行版本
  update\              CI 上传发布包
  backup\              发布前备份
  logs\                NSSM / 应用日志
  .env.production      生产配置，CI 不覆盖
```

CI 上传的包固定放到：

```text
E:\tandem-deploy\update\tandem-deploy.zip
```

## NSSM 服务配置

服务只需要启动当前版本的 `server.js`。

```powershell
nssm install TandemServer "C:\Program Files\nodejs\node.exe" "server.js"
nssm set TandemServer AppDirectory "E:\tandem-deploy\app"
nssm set TandemServer AppEnvironmentExtra NODE_ENV=production PORT=3005
nssm set TandemServer AppStdout "E:\tandem-deploy\logs\app.out.log"
nssm set TandemServer AppStderr "E:\tandem-deploy\logs\app.err.log"
nssm set TandemServer AppRotateFiles 1
nssm set TandemServer AppRotateOnline 1
nssm set TandemServer AppRotateBytes 10485760
nssm set TandemServer Start SERVICE_AUTO_START
nssm start TandemServer
```

如果生产端口不是 `3005`，同步调整 `PORT` 和发布脚本的 `-HealthPort`。

## 服务器端发布脚本

把仓库里的脚本放到服务器：

```text
E:\tandem-deploy\deploy-windows-nssm.ps1
```

脚本来源：

```text
scripts\deploy-windows-nssm.ps1
```

CI 上传 zip 后执行：

```powershell
powershell -ExecutionPolicy Bypass -File E:\tandem-deploy\deploy-windows-nssm.ps1 `
  -Root E:\tandem-deploy `
  -ServiceName TandemServer `
  -HealthPort 3005
```

脚本会执行：

1. 停止 NSSM 服务。
2. 解压 `update\tandem-deploy.zip`。
3. 备份旧 `app`。
4. 发布新 `app`。
5. 复制服务器上的 `.env.production` 到新版本目录。
6. 执行 `node scripts\apply-migrations.mjs`。
7. 启动 NSSM 服务。
8. 请求 `/api/health` 做健康检查。
9. 失败时回滚上一版。

## GitLab CI 变量

在 GitLab 项目里配置 CI/CD Variables：

```text
DEPLOY_HOST=云服务器IP或域名
DEPLOY_USER=Windows服务器用户名
DEPLOY_ROOT=E:/tandem-deploy
DEPLOY_NGINX_EXE=E:/soft/nginx-1.30.2/nginx.exe
DEPLOY_PUBLIC_BASE_URL=https://ai.rhautt.com
DEPLOY_SERVICE_NAME=TandemServer
DEPLOY_HEALTH_PORT=3005
DEPLOY_SSH_PRIVATE_KEY=用于登录云服务器的私钥
DEPLOY_NOTIFY_WEBHOOK_URL=飞书/钉钉/企业微信 webhook，可选
DEPLOY_NOTIFY_WEBHOOK_TYPE=feishu 或 dingtalk 或 wecom，可选
```

企业微信群机器人使用：

```text
DEPLOY_NOTIFY_WEBHOOK_TYPE=wecom
```

`DEPLOY_NOTIFY_WEBHOOK_URL` 里包含机器人 `key`，不要提交到仓库，放 GitLab CI/CD Variables 即可。

云服务器需要允许 GitLab Runner 所在机器通过 SSH 登录。

## 发布分支

生产发布只从 `deploy` 分支触发，不从 `main` 分支触发。

推荐流程：

```bash
git checkout main
git pull
git checkout deploy
git merge main
git push internal deploy
```

或者把指定提交推到 `deploy`：

```bash
git push internal <commit-sha>:deploy
```

老版本 GitLab CI 里的发布规则使用：

```yaml
only:
  - deploy
```

## GitLab CI 发布片段

如果 GitLab Runner 是 Windows：

```yaml
deploy_prod:
  stage: deploy
  tags:
    - windows
  only:
    - deploy
  script:
    - New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh"
    - $env:DEPLOY_SSH_PRIVATE_KEY -replace "`r", "" | Set-Content -NoNewline "$env:USERPROFILE\.ssh\id_tandem_deploy"
    - ssh-keyscan $env:DEPLOY_HOST | Add-Content "$env:USERPROFILE\.ssh\known_hosts"
    - npm ci --no-audit --no-fund
    - npm test
    - powershell -ExecutionPolicy Bypass -File package-deploy.ps1 -OutputZip tandem-deploy.zip
    - scp -i "$env:USERPROFILE\.ssh\id_tandem_deploy" tandem-deploy.zip "${env:DEPLOY_USER}@${env:DEPLOY_HOST}:$env:DEPLOY_ROOT/update/tandem-deploy.zip"
    - ssh -i "$env:USERPROFILE\.ssh\id_tandem_deploy" "${env:DEPLOY_USER}@${env:DEPLOY_HOST}" "powershell -ExecutionPolicy Bypass -File $env:DEPLOY_ROOT/deploy-windows-nssm.ps1 -Root $env:DEPLOY_ROOT -ServiceName $env:DEPLOY_SERVICE_NAME -HealthPort $env:DEPLOY_HEALTH_PORT"
  environment:
    name: production
```

如果 Runner 是 Linux，但安装了 PowerShell Core：

```yaml
deploy_prod:
  image: mcr.microsoft.com/powershell:7.4-debian-12
  stage: deploy
  only:
    - deploy
  before_script:
    - apt-get update && apt-get install -y openssh-client
    - eval $(ssh-agent -s)
    - echo "$DEPLOY_SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan -H "$DEPLOY_HOST" >> ~/.ssh/known_hosts
  script:
    - npm ci --no-audit --no-fund
    - npm test
    - pwsh -ExecutionPolicy Bypass -File package-deploy.ps1 -OutputZip tandem-deploy.zip
    - scp tandem-deploy.zip "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_ROOT/update/tandem-deploy.zip"
    - ssh "$DEPLOY_USER@$DEPLOY_HOST" "powershell -ExecutionPolicy Bypass -File $DEPLOY_ROOT/deploy-windows-nssm.ps1 -Root $DEPLOY_ROOT -ServiceName $DEPLOY_SERVICE_NAME -HealthPort $DEPLOY_HEALTH_PORT"
  environment:
    name: production
```

Windows Runner 更推荐，因为当前 `package-deploy.ps1` 使用了 `robocopy`。

## 不停机发布：蓝绿模式

单个 NSSM 服务直接监听用户访问端口时，不能做到真正不停机。因为发布时必须停旧进程，或者新旧进程抢同一个端口。

真正不停机需要：

```text
用户 / 域名
  -> Nginx 反向代理
  -> TandemServerBlue  127.0.0.1:3005
  -> TandemServerGreen 127.0.0.1:3006
```

发布时只更新闲置颜色：

1. 当前流量在 `blue`。
2. CI 上传新包。
3. 发布脚本更新 `green` 的代码。
4. 启动 `TandemServerGreen`。
5. 检查 `http://127.0.0.1:3006/api/health`。
6. Nginx upstream 切到 `green`。
7. 检查公网健康地址。
8. 停掉旧的 `TandemServerBlue`。

下一次发布反过来，从 `green` 切回 `blue`。

### Nginx 反代

蓝绿脚本会维护：

```text
E:\tandem-deploy\nginx\tandem-upstream.conf
E:\tandem-deploy\active-slot.txt
```

你们现有 Nginx 中 `ai.rhautt.com` 是应用入口。蓝绿发布时，只需要让这个 server 转发到 `tandem_backend`。

在 Nginx 的 `http { ... }` 中 include upstream 文件：

```nginx
include E:/tandem-deploy/nginx/tandem-upstream.conf;
```

然后把 `server_name ai.rhautt.com;` 里的：

```nginx
proxy_pass http://127.0.0.1:3000;
```

改成：

```nginx
proxy_pass http://tandem_backend;
```

保留原来的 header 设置：

```nginx
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto https;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```


### 蓝绿发布脚本

脚本来源：

```text
scripts\deploy-windows-nssm-bluegreen.ps1
```

放到服务器：

```text
E:\tandem-deploy\deploy-windows-nssm-bluegreen.ps1
```

执行：

```powershell
powershell -ExecutionPolicy Bypass -File E:\tandem-deploy\deploy-windows-nssm-bluegreen.ps1 `
  -Root E:\tandem-deploy `
  -BlueServiceName TandemServerBlue `
  -GreenServiceName TandemServerGreen `
  -BluePort 3005 `
  -GreenPort 3006 `
  -NginxExe "E:\soft\nginx-1.30.2\nginx.exe" `
  -NginxUpstreamFile "E:\tandem-deploy\nginx\tandem-upstream.conf" `
  -PublicBaseUrl "https://ai.rhautt.com"
```

如果你们对外是域名和 HTTPS，把参数改成：

把 `PublicBaseUrl` 改成真实对外地址，例如 `https://tandem.your-company.com`。

### CI 调用蓝绿发布

把原来的远程执行命令替换成：

```yaml
- ssh -i "$env:USERPROFILE\.ssh\id_tandem_deploy" "${env:DEPLOY_USER}@${env:DEPLOY_HOST}" "powershell -ExecutionPolicy Bypass -File $env:DEPLOY_ROOT/deploy-windows-nssm-bluegreen.ps1 -Root $env:DEPLOY_ROOT -BlueServiceName TandemServerBlue -GreenServiceName TandemServerGreen -BluePort 3005 -GreenPort 3006 -NginxExe '$env:DEPLOY_NGINX_EXE' -NginxUpstreamFile '$env:DEPLOY_ROOT/nginx/tandem-upstream.conf' -PublicBaseUrl '$env:DEPLOY_PUBLIC_BASE_URL'"
```

### 发布通知

两个发布脚本都支持发布结束通知：

```powershell
-NotifyWebhookUrl "https://your-webhook-url" `
-NotifyWebhookType feishu
```

也可以在服务器或 CI 远程命令里设置环境变量：

```powershell
$env:DEPLOY_NOTIFY_WEBHOOK_URL="https://your-webhook-url"
$env:DEPLOY_NOTIFY_WEBHOOK_TYPE="feishu"
```

通知发送时机：

- 成功：应用健康检查通过后发送。
- 失败：回滚尝试完成后发送。

支持的 `NotifyWebhookType`：

```text
generic   {"text":"..."}
feishu    飞书机器人 text 消息
dingtalk  钉钉机器人 text 消息
wecom     企业微信机器人 text 消息
```

`generic` 默认发送：

```json
{
  "text": "[Tandem Deploy] SUCCESS\n..."
}
```

CI 调用蓝绿发布时可以这样传：

```yaml
- ssh -i "$env:USERPROFILE\.ssh\id_tandem_deploy" "${env:DEPLOY_USER}@${env:DEPLOY_HOST}" "powershell -ExecutionPolicy Bypass -File $env:DEPLOY_ROOT/deploy-windows-nssm-bluegreen.ps1 -Root $env:DEPLOY_ROOT -BlueServiceName TandemServerBlue -GreenServiceName TandemServerGreen -BluePort 3005 -GreenPort 3006 -NginxExe '$env:DEPLOY_NGINX_EXE' -NginxUpstreamFile '$env:DEPLOY_ROOT/nginx/tandem-upstream.conf' -PublicBaseUrl '$env:DEPLOY_PUBLIC_BASE_URL' -NotifyWebhookUrl '$env:DEPLOY_NOTIFY_WEBHOOK_URL' -NotifyWebhookType '$env:DEPLOY_NOTIFY_WEBHOOK_TYPE'"
```

### 数据库迁移要求

蓝绿只能保证应用进程切换不停机。数据库迁移要做到不停机，迁移必须向后兼容：

- 先加字段 / 表 / 索引，不要在同一次发布删除旧字段。
- 应用代码同时兼容旧字段和新字段。
- 删除字段、改名字段、强制 `NOT NULL` 这类破坏性变更，放到后续清理发布。
- 大表索引要避免长时间锁表。

如果某次发布包含破坏性 schema 变更，应改为维护窗口发布，不要强行蓝绿。
