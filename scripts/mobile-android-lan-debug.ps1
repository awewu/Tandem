param(
  [string]$HostIp = "",
  [int]$Port = 3005,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Resolve-LanIp {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.IPAddress -notlike "172.17.*" -and
      $_.InterfaceAlias -notmatch "vEthernet|VirtualBox|VMware|Loopback"
    } |
    Sort-Object -Property @{ Expression = { if ($_.InterfaceAlias -match "WLAN|Wi-Fi") { 0 } else { 1 } } }

  if (-not $candidates -or -not $candidates[0]) {
    throw "Unable to detect LAN IP. Retry with: powershell -ExecutionPolicy Bypass -File scripts/mobile-android-lan-debug.ps1 -HostIp 192.168.x.x"
  }

  return $candidates[0].IPAddress
}

if (-not $HostIp) {
  $HostIp = Resolve-LanIp
}

$serverUrl = "http://${HostIp}:$Port"
Write-Host "Tandem mobile Android LAN debug" -ForegroundColor Cyan
Write-Host "Server URL: $serverUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure another terminal is running:" -ForegroundColor Yellow
Write-Host ('  $env:NEXTAUTH_URL="' + $serverUrl + '"; npm run dev:lan') -ForegroundColor Yellow
Write-Host ""

$devices = adb devices
$hasDevice = ($devices | Select-String "device$" -Quiet)
if ($LASTEXITCODE -ne 0) {
  throw "No Android device detected. Please reconnect USB and allow USB debugging."
}
if (-not $hasDevice) {
  throw "No Android device detected. Please reconnect USB and allow USB debugging."
}

$env:TANDEM_MOBILE_SERVER_URL = $serverUrl
npm run mobile:bootstrap
npx cap sync android

if (-not $SkipInstall) {
  Push-Location android
  try {
    .\gradlew.bat assembleDebug
    adb install -r app\build\outputs\apk\debug\app-debug.apk
    adb shell am start -n local.tandem.mobile/.MainActivity
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "Done. For Next.js page/CSS/component changes, usually no rebuild is needed; refresh the app page." -ForegroundColor Green
Write-Host "Re-run this script only after changing capacitor.config.ts, native Android code, plugins, permissions, icons, or splash screens." -ForegroundColor Green
