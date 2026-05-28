#requires -Version 5.1
<#
.SYNOPSIS
  用 Cloudflare Tunnel 把本机 Tandem 暴露成公网 HTTPS URL.
  不用买域名, 不用配防火墙, 关电脑自动停.

.DESCRIPTION
  1. 检查 cloudflared 是否已装, 没装就提示用 winget 装
  2. 检查 dev server 是否在 3005 跑着, 没跑就提示先起
  3. 起 quick tunnel (临时 *.trycloudflare.com 域名)
  4. 提示如何改 .env.local 让 cookie/redirect 正常

.NOTES
  Quick tunnel URL 每次重启会变. 如果要固定域名, 在 Cloudflare 注册账号
  绑你自己的域名, 再用 `cloudflared tunnel run <name>`.
#>

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " Tandem · Cloudflare Tunnel 公网共享" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. cloudflared
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host "[X] cloudflared 未安装." -ForegroundColor Red
  Write-Host ""
  Write-Host "    装法 (任选一种):" -ForegroundColor Yellow
  Write-Host "      winget install --id Cloudflare.cloudflared" -ForegroundColor White
  Write-Host "      # 或下载: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Gray
  Write-Host ""
  Write-Host "    装完重新打开 PowerShell, 再跑本脚本." -ForegroundColor Yellow
  exit 1
}
Write-Host "[✓] cloudflared 已装: $($cf.Source)" -ForegroundColor Green

# 2. dev server 检查
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3005/api/health' `
        -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
  if ($r.StatusCode -eq 200) {
    Write-Host "[✓] dev server 在 3005 跑着." -ForegroundColor Green
  }
} catch {
  Write-Host "[X] dev server 没在 3005 跑." -ForegroundColor Red
  Write-Host "    先另开一个 PowerShell, 跑:" -ForegroundColor Yellow
  Write-Host "      cd E:\Hermes; `$env:PORT='3005'; npm run dev" -ForegroundColor White
  Write-Host "    等 ready 后再跑本脚本." -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[!] 起 quick tunnel 中..." -ForegroundColor Yellow
Write-Host "    输出里找形如  https://xxx-yyy-zzz.trycloudflare.com  的 URL" -ForegroundColor Gray
Write-Host "    那就是你的公网地址." -ForegroundColor Gray
Write-Host ""
Write-Host "[!] 拿到 URL 后, 改 .env.local:" -ForegroundColor Yellow
Write-Host "      NEXTAUTH_URL=<那个 https URL>" -ForegroundColor White
Write-Host "    然后重启 dev server (Ctrl+C 后再 npm run dev)." -ForegroundColor Gray
Write-Host ""
Write-Host "[!] 生成给外部用户的邀请码:" -ForegroundColor Yellow
Write-Host "      node scripts/issue-trial-invite.mjs 100 168 employee" -ForegroundColor White
Write-Host "    输出里的注册地址会自动用 NEXTAUTH_URL." -ForegroundColor Gray
Write-Host ""
Write-Host "----------------- cloudflared 输出 (Ctrl+C 关闭) -----------------" -ForegroundColor Cyan
cloudflared tunnel --url http://localhost:3005
