# Tandem 自动化发布执行手册

本文用于当前发布方案：

- Windows Server
- NSSM 托管 Node 服务
- GitLab 本地仓库
- 云服务器不能访问 GitLab
- GitLab Runner 构建 zip 包并上传服务器
- `deploy` 分支触发发布
- 蓝绿不停机发布
- Nginx 反向代理切流
- 企业微信群机器人通知

## 0. 你需要先确认

本机仓库已有这些文件：

```text
.gitlab-ci.yml
package-deploy.ps1
scripts\deploy-windows-nssm-bluegreen.ps1
scripts\deploy-windows-nssm.ps1
docs\WINDOWS-NSSM-CICD.md
```

GitLab Runner 建议使用 Windows Runner，因为 `package-deploy.ps1` 使用了 `robocopy`。

## 1. Windows Server 准备

### 1.1 安装基础软件

在云服务器安装：

```text
Node.js
NSSM
Nginx
OpenSSH Server
```

确认命令可用：

```powershell
node -v
nssm version
nginx -v
ssh -V
```

### 1.2 创建发布目录

```powershell
New-Item -ItemType Directory -Force E:\tandem-deploy
New-Item -ItemType Directory -Force E:\tandem-deploy\update
New-Item -ItemType Directory -Force E:\tandem-deploy\slots
New-Item -ItemType Directory -Force E:\tandem-deploy\backup
New-Item -ItemType Directory -Force E:\tandem-deploy\logs
New-Item -ItemType Directory -Force E:\tandem-deploy\nginx
```

### 1.3 放置生产配置

把生产环境配置放到：

```text
E:\tandem-deploy\.env.production
```

这个文件只放服务器，不提交仓库，不由 CI 覆盖。

### 1.4 放置发布脚本

把仓库里的脚本复制到服务器：

```text
scripts\deploy-windows-nssm-bluegreen.ps1
```

目标路径：

```text
E:\tandem-deploy\deploy-windows-nssm-bluegreen.ps1
```

### 1.5 改造现有 Nginx

你们现有配置里，`ai.rhautt.com` 当前直接转发到：

```nginx
proxy_pass http://127.0.0.1:3000;
```

蓝绿发布要改成：

```text
ai.rhautt.com -> tandem_backend -> 127.0.0.1:3005 或 127.0.0.1:3006
```

先创建 upstream 文件：

```powershell
@"
upstream tandem_backend {
    server 127.0.0.1:3005;
    keepalive 64;
}
"@ | Set-Content E:\tandem-deploy\nginx\tandem-upstream.conf -Encoding ASCII

Set-Content E:\tandem-deploy\active-slot.txt -Value "blue" -Encoding ASCII
```

然后在现有 `nginx.conf` 的 `http { ... }` 里 include 这个 upstream 文件。

建议放在这一段后面：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

新增：

```nginx
include E:/tandem-deploy/nginx/tandem-upstream.conf;
```

再找到 `server_name ai.rhautt.com;` 这个 server，把 location 里的：

```nginx
proxy_pass http://127.0.0.1:3000;
```

改成：

```nginx
proxy_pass http://tandem_backend;
```

检查并重载 Nginx：

```powershell
E:/soft/nginx-1.30.2/nginx.exe -t
E:/soft/nginx-1.30.2/nginx.exe -s reload
```

### 1.6 开放访问端口

你们现有 `ai.rhautt.com` 已经监听 `443 ssl`，通常不需要再开放 `3000`。

确认云服务器防火墙和安全组允许：

```text
TCP 443
```

## 2. SSH 登录准备

### 2.1 在 GitLab Runner 机器生成 SSH key

```powershell
ssh-keygen -t ed25519 -C "gitlab-runner-tandem-deploy" -f .\id_tandem_deploy
```

得到：

```text
id_tandem_deploy
id_tandem_deploy.pub
```

### 2.2 把公钥加到 Windows Server

把 `id_tandem_deploy.pub` 内容追加到服务器用户的：

```text
C:\Users\<DEPLOY_USER>\.ssh\authorized_keys
```

确认 Runner 能登录：

```powershell
ssh -i .\id_tandem_deploy <DEPLOY_USER>@<DEPLOY_HOST>
```

## 3. GitLab CI/CD Variables

进入 GitLab 项目：

```text
Settings -> CI/CD -> Variables
```

添加：

```text
DEPLOY_HOST=云服务器 IP 或域名
DEPLOY_USER=Windows Server 用户名
DEPLOY_ROOT=E:/tandem-deploy
DEPLOY_SSH_PRIVATE_KEY=id_tandem_deploy 私钥全文
DEPLOY_NGINX_EXE=E:/soft/nginx-1.30.2/nginx.exe
DEPLOY_PUBLIC_BASE_URL=https://ai.rhautt.com
DEPLOY_NOTIFY_WEBHOOK_URL=企业微信群机器人 webhook
DEPLOY_NOTIFY_WEBHOOK_TYPE=wecom
```

注意：

- `DEPLOY_SSH_PRIVATE_KEY` 是私钥全文，不是 `.pub`。
- `DEPLOY_NOTIFY_WEBHOOK_URL` 包含企微机器人 key，不要提交到仓库。
- 建议把这两个变量设为 masked/protected，如果你们 GitLab 支持。

## 4. GitLab Runner 要求

当前 `.gitlab-ci.yml` 的发布任务需要 Windows Runner，并带有 tag：

```text
windows
```

Runner 机器需要安装：

```text
Node.js
npm
PowerShell
OpenSSH client
Git
```

确认 Runner 执行用户能运行：

```powershell
npm -v
powershell -v
scp -V
ssh -V
```

## 5. 创建并推送 deploy 分支

本地已经创建过 `deploy` 分支时，直接同步代码：

```bash
git checkout main
git pull internal main
git checkout deploy
git merge main
git push internal deploy
```

如果远端还没有 `deploy` 分支：

```bash
git push internal deploy
```

之后只有推送到 `deploy` 分支才会发布。

`main` 分支不会发布生产。

## 6. 第一次自动发布

推送 `deploy` 分支后，到 GitLab Pipeline 页面观察：

```text
typecheck
lint
unit
build
smoke
deploy_prod
```

`deploy_prod` 会做：

1. 写入 SSH 私钥。
2. 构建 `tandem-deploy.zip`。
3. 上传到 `E:/tandem-deploy/update/tandem-deploy.zip`。
4. 执行 `deploy-windows-nssm-bluegreen.ps1`。
5. 启动闲置实例。
6. 健康检查。
7. 切换 Nginx upstream 并 reload。
8. 发送企微通知。

第一次蓝绿发布通常会从：

```text
blue -> green
```

下一次会从：

```text
green -> blue
```

## 7. 发布后验证

在服务器执行：

```powershell
nssm status TandemServerBlue
nssm status TandemServerGreen
Get-Content E:\tandem-deploy\active-slot.txt
```

检查健康接口：

```powershell
Invoke-WebRequest https://ai.rhautt.com/api/health -UseBasicParsing
```

检查日志：

```powershell
Get-Content E:\tandem-deploy\logs\blue.err.log -Tail 100
Get-Content E:\tandem-deploy\logs\green.err.log -Tail 100
```

企微群应该收到成功消息，标题类似：

```text
[Tandem Blue-Green Deploy] SUCCESS
```

## 8. 日常发布

日常发布只需要：

```bash
git checkout main
git pull internal main
git checkout deploy
git merge main
git push internal deploy
```

如果只想发布某个提交：

```bash
git push internal <commit-sha>:deploy
```

## 9. 回滚

蓝绿发布失败时，脚本会尝试保持旧 slot 继续服务。

如果发布成功后业务要回滚，可以手动切回上一个 slot。

查看当前 slot：

```powershell
Get-Content E:\tandem-deploy\active-slot.txt
```

如果当前是 `green`，切回 `blue`：

```powershell
@"
upstream tandem_backend {
    server 127.0.0.1:3005;
    keepalive 64;
}
"@ | Set-Content E:\tandem-deploy\nginx\tandem-upstream.conf -Encoding ASCII

E:/soft/nginx-1.30.2/nginx.exe -t
E:/soft/nginx-1.30.2/nginx.exe -s reload
Set-Content E:\tandem-deploy\active-slot.txt -Value "blue" -Encoding ASCII
nssm start TandemServerBlue
```

如果当前是 `blue`，切回 `green`：

```powershell
@"
upstream tandem_backend {
    server 127.0.0.1:3006;
    keepalive 64;
}
"@ | Set-Content E:\tandem-deploy\nginx\tandem-upstream.conf -Encoding ASCII

E:/soft/nginx-1.30.2/nginx.exe -t
E:/soft/nginx-1.30.2/nginx.exe -s reload
Set-Content E:\tandem-deploy\active-slot.txt -Value "green" -Encoding ASCII
nssm start TandemServerGreen
```

回滚后检查：

```powershell
Invoke-WebRequest https://ai.rhautt.com/api/health -UseBasicParsing
```

## 10. 常见问题

### CI 上传失败

检查：

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_SSH_PRIVATE_KEY
服务器 OpenSSH
服务器防火墙 22 端口
```

### Nginx reload 失败

检查：

```powershell
E:/soft/nginx-1.30.2/nginx.exe -t
Get-Content E:\tandem-deploy\nginx\tandem-upstream.conf
```

### 健康检查失败

检查当前发布 slot 的日志：

```powershell
Get-Content E:\tandem-deploy\logs\blue.err.log -Tail 100
Get-Content E:\tandem-deploy\logs\green.err.log -Tail 100
```

确认 `.env.production` 存在：

```powershell
Test-Path E:\tandem-deploy\.env.production
```

### 企微没有通知

检查 GitLab Variables：

```text
DEPLOY_NOTIFY_WEBHOOK_URL
DEPLOY_NOTIFY_WEBHOOK_TYPE=wecom
```

也可以在服务器手动测试：

```powershell
$body = @{ msgtype = "text"; text = @{ content = "Tandem deploy webhook test" } } | ConvertTo-Json
Invoke-RestMethod -Uri "<企业微信机器人 webhook>" -Method Post -ContentType "application/json" -Body $body
```

## 11. 数据库迁移纪律

蓝绿发布要求数据库迁移向后兼容：

- 本次发布可以加表、加字段、加索引。
- 不要在同一次发布删除旧字段。
- 不要在同一次发布把字段改名。
- 不要直接加会锁大表的强约束。
- 破坏性 schema 变更放到维护窗口。

应用先兼容新旧字段，下一次或后续清理发布再删除旧结构。
