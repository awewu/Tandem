# pre-warm.ps1 — 预热 Next.js 页面以绕过冷启动和 On-Demand 编译延迟
#
# 运行方式：
#   pwsh -File ./scripts/pre-warm.ps1
#
# 对应 docs/AI-SETUP.md 第三节

$pages = @(
  "/",
  "/chat",
  "/agents",
  "/settings/llm",
  "/partner/join",
  "/register/employee",
  "/okr",
  "/report",
  "/report/weekly",
  "/kpi",
  "/im",
  "/convergence",
  "/1on1",
  "/360",
  "/nine-box"
)

Write-Host "================────────────────=========================" -ForegroundColor Cyan
Write-Host "🚀 Tandem · 正在预热主页面，触发本地按需编译..." -ForegroundColor Cyan
Write-Host "================────────────────────────────────=========" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

foreach ($p in $pages) {
  $url = "$baseUrl$p"
  try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    # 发送一个基础 HTTP 请求，让 Next.js dev server 自动开始编译当前路由和组件
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
    $sw.Stop()
    Write-Host "✅ $p → 预热就位 ($($sw.ElapsedMilliseconds)ms, 状态: $($res.StatusCode))" -ForegroundColor Green
  } catch {
    # 允许 401 报错，因为 401 说明路由已就位，只是需要登录态，这同样代表组件已经完成了 dev 编译！
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode -eq "Unauthorized") {
      Write-Host "✅ $p → 预热就位 (需登录，已完成按需编译)" -ForegroundColor Green
    } else {
      Write-Host "❌ $p → 预热失败 (原因: $($_.Exception.Message))" -ForegroundColor Red
    }
  }
}

Write-Host "================────────────────=========================" -ForegroundColor Cyan
Write-Host "🎉 预热完成。点击页面不再卡顿。" -ForegroundColor Cyan
Write-Host "================────────────────────────────────=========" -ForegroundColor Cyan
