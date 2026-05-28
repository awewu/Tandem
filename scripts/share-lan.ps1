#requires -Version 5.1
<#
.SYNOPSIS
  让局域网内 (同 Wi-Fi / 同办公室) 的人也能访问你这台机器上的 Tandem.

.DESCRIPTION
  1. 找出本机所有 IPv4 地址 (非 loopback / 非 169.254.x APIPA)
  2. (可选) 自动开 Windows 防火墙 3005 端口 (需要管理员)
  3. 提示如何改 .env.local 的 NEXTAUTH_URL
  4. 用 npm run dev:lan 启动 (bind 0.0.0.0:3005)

.EXAMPLE
  pwsh -File scripts/share-lan.ps1
  # 然后另开一个 PowerShell:
  node scripts/issue-trial-invite.mjs 20 168 employee
#>

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host " Tandem · 局域网共享" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. 找 IPv4
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object IPAddress, InterfaceAlias

if ($ips.Count -eq 0) {
  Write-Host "[!] 没找到局域网 IP. 检查 Wi-Fi / 网线是否连接." -ForegroundColor Red
  exit 1
}

Write-Host "本机局域网地址:" -ForegroundColor Yellow
foreach ($ip in $ips) {
  Write-Host ("  http://{0}:3005   ({1})" -f $ip.IPAddress, $ip.InterfaceAlias) -ForegroundColor Green
}
Write-Host ""

# 2. 防火墙
$rule = Get-NetFirewallRule -DisplayName "Tandem 3005" -ErrorAction SilentlyContinue
if (-not $rule) {
  Write-Host "[?] 未发现 Tandem 3005 防火墙规则." -ForegroundColor Yellow
  $isAdmin = ([Security.Principal.WindowsPrincipal]`
              [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(`
              [Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($isAdmin) {
    Write-Host "    -> 你是管理员, 自动开放 3005 入站..." -ForegroundColor Yellow
    New-NetFirewallRule -DisplayName "Tandem 3005" -Direction Inbound `
      -LocalPort 3005 -Protocol TCP -Action Allow | Out-Null
    Write-Host "    -> ✅ 防火墙规则已添加." -ForegroundColor Green
  } else {
    Write-Host "    -> 你不是管理员, 跳过. 同事访问会被防火墙挡." -ForegroundColor Yellow
    Write-Host "    -> 如要打开, 用管理员 PowerShell 跑:" -ForegroundColor Yellow
    Write-Host "       New-NetFirewallRule -DisplayName 'Tandem 3005' -Direction Inbound -LocalPort 3005 -Protocol TCP -Action Allow" -ForegroundColor White
  }
} else {
  Write-Host "[✓] 防火墙规则 'Tandem 3005' 已存在." -ForegroundColor Green
}
Write-Host ""

# 3. 提示 NEXTAUTH_URL
$primaryIp = $ips[0].IPAddress
Write-Host "[!] 重要: 改 .env.local 里的 NEXTAUTH_URL" -ForegroundColor Yellow
Write-Host "    把  NEXTAUTH_URL=http://localhost:3005" -ForegroundColor Gray
Write-Host "    改成 NEXTAUTH_URL=http://$primaryIp`:3005" -ForegroundColor Green
Write-Host "    (不改的话别人能开页面, 但登录后 cookie 会丢)" -ForegroundColor Gray
Write-Host ""

# 4. 启动
Write-Host "[?] 按 Enter 启动 dev server (bind 0.0.0.0:3005), Ctrl+C 退出." -ForegroundColor Cyan
Read-Host
Set-Location $root
npm run dev:lan
