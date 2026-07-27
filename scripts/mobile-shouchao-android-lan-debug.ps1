param(
  [string]$HostIp = "",
  [int]$Port = 3005,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Resolve-LanIp {
  try {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.IPAddress -notlike "172.17.*" -and
        $_.InterfaceAlias -notmatch "vEthernet|VirtualBox|VMware|Loopback"
      } |
      Sort-Object -Property @{ Expression = { if ($_.InterfaceAlias -match "WLAN|Wi-Fi") { 0 } else { 1 } } }

    if ($candidates -and $candidates[0]) {
      return $candidates[0].IPAddress
    }
  } catch {
    Write-Host "Get-NetIPAddress failed; falling back to ipconfig." -ForegroundColor DarkYellow
  }

  $adapter = ""
  $ipconfigIps = foreach ($line in (ipconfig)) {
    if ($line -match "adapter (.+):$") {
      $adapter = $Matches[1]
      continue
    }
    if ($line -match "IPv4.*?:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)") {
      $ip = $Matches[1]
      if (
        $ip -notlike "127.*" -and
        $ip -notlike "169.254.*" -and
        $ip -notlike "172.17.*" -and
        $adapter -notmatch "vEthernet|VirtualBox|VMware|Loopback|Default Switch|WSL|Bluetooth"
      ) {
        [PSCustomObject]@{
          Ip = $ip
          Rank = if ($adapter -match "WLAN|Wi-Fi|Wireless") { 0 } else { 1 }
        }
      }
    }
  }

  $ipconfigIps = $ipconfigIps | Sort-Object -Property Rank
  if ($ipconfigIps -and $ipconfigIps[0]) {
    return $ipconfigIps[0].Ip
  }

  throw "Unable to detect LAN IP. Retry with: powershell -ExecutionPolicy Bypass -File scripts/mobile-shouchao-android-lan-debug.ps1 -HostIp 192.168.x.x"
}

function Reset-WorkDir([string]$WorkDir) {
  $root = (Resolve-Path -LiteralPath ".").Path
  $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($WorkDir)
  if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove temp directory outside workspace: $full"
  }
  if (Test-Path -LiteralPath $full) {
    Remove-Item -LiteralPath $full -Recurse -Force
  }
  New-Item -ItemType Directory -Path $full | Out-Null
}

if (-not $HostIp) {
  $HostIp = Resolve-LanIp
}

$originUrl = "http://${HostIp}:$Port"
$serverUrl = "$originUrl/shouchao"
$nativeDir = "android-shouchao"
$workDir = ".capacitor-shouchao-work"
$capCli = Join-Path (Resolve-Path -LiteralPath ".").Path "node_modules\@capacitor\cli\bin\capacitor"

Write-Host "Shouchao standalone Android LAN debug" -ForegroundColor Cyan
Write-Host "Server URL: $serverUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Make sure another terminal is running:" -ForegroundColor Yellow
Write-Host ('  $env:NEXTAUTH_URL="' + $originUrl + '"; npm run dev:lan') -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path -LiteralPath $capCli)) {
  throw "Capacitor CLI not found at $capCli. Run npm install first."
}

if (-not $SkipInstall) {
  $devices = adb devices
  $hasDevice = ($devices | Select-String "device$" -Quiet)
  if ($LASTEXITCODE -ne 0) {
    throw "No Android device detected. Please reconnect USB and allow USB debugging."
  }
  if (-not $hasDevice) {
    throw "No Android device detected. Please reconnect USB and allow USB debugging."
  }
}

$env:SHOUCHAO_MOBILE_SERVER_URL = $serverUrl
node scripts/build-mobile-bootstrap.mjs

Reset-WorkDir $workDir

$packageJson = @'
{
  "name": "shouchao-capacitor-workspace",
  "private": true,
  "dependencies": {
    "@capacitor/app": "^8.1.0",
    "@capacitor/browser": "^8.0.3",
    "@capacitor/keyboard": "^8.0.5",
    "@capacitor/status-bar": "^8.0.2"
  },
  "devDependencies": {
    "@capacitor/android": "^8.4.1",
    "@capacitor/cli": "^8.4.1"
  }
}
'@
$configJs = @"
const serverUrl = process.env.SHOUCHAO_MOBILE_SERVER_URL || process.env.TANDEM_MOBILE_SERVER_URL || 'http://10.0.2.2:3005/shouchao';
const isHttp = serverUrl.startsWith('http://');

module.exports = {
  appId: 'local.shouchao.mobile',
  appName: '\u642d\u5b50\u624b\u6284',
  webDir: '../dist/mobile',
  server: {
    androidScheme: isHttp ? 'http' : 'https',
    url: serverUrl,
    cleartext: isHttp,
    errorPath: 'offline.html',
  },
  android: {
    path: '../android-shouchao',
    allowMixedContent: isHttp,
    backgroundColor: '#FFFFFF',
  },
  ios: {
    path: '../ios-shouchao',
    backgroundColor: '#FFFFFF',
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#FFFFFF',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
      style: 'LIGHT',
    },
  },
};
"@

[System.IO.File]::WriteAllText((Join-Path $workDir "package.json"), $packageJson, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path $workDir "capacitor.config.js"), $configJs, [System.Text.UTF8Encoding]::new($false))

Push-Location $workDir
try {
  if (Test-Path -LiteralPath "..\$nativeDir") {
    node $capCli sync android
  } else {
    node $capCli add android
  }
} finally {
  Pop-Location
}

$stringsPath = Join-Path $nativeDir "app\src\main\res\values\strings.xml"
if (Test-Path -LiteralPath $stringsPath) {
  $stringsXml = [System.IO.File]::ReadAllText($stringsPath)
  $appNameXml = "&#x642d;&#x5b50;&#x624b;&#x6284;"
  $stringsXml = [System.Text.RegularExpressions.Regex]::Replace(
    $stringsXml,
    '<string name="app_name">.*?</string>',
    '<string name="app_name">' + $appNameXml + '</string>'
  )
  $stringsXml = [System.Text.RegularExpressions.Regex]::Replace(
    $stringsXml,
    '<string name="title_activity_main">.*?</string>',
    '<string name="title_activity_main">' + $appNameXml + '</string>'
  )
  [System.IO.File]::WriteAllText($stringsPath, $stringsXml, [System.Text.UTF8Encoding]::new($false))
}

$manifestPath = Join-Path $nativeDir "app\src\main\AndroidManifest.xml"
if (Test-Path -LiteralPath $manifestPath) {
  $manifestXml = [System.IO.File]::ReadAllText($manifestPath)
  if ($manifestXml -notmatch 'android\.permission\.RECORD_AUDIO') {
    $manifestXml = $manifestXml.Replace(
      '<uses-permission android:name="android.permission.INTERNET" />',
      '<uses-permission android:name="android.permission.INTERNET" />' + [Environment]::NewLine + '    <uses-permission android:name="android.permission.RECORD_AUDIO" />'
    )
    [System.IO.File]::WriteAllText($manifestPath, $manifestXml, [System.Text.UTF8Encoding]::new($false))
  }
}

if (-not $SkipInstall) {
  Push-Location $nativeDir
  try {
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle assembleDebug failed."
    }
    adb install -r app\build\outputs\apk\debug\app-debug.apk
    if ($LASTEXITCODE -ne 0) {
      throw "ADB install failed. On the phone, allow USB installation / install via USB, then re-run this script."
    }
    adb shell am start -n local.shouchao.mobile/.MainActivity
    if ($LASTEXITCODE -ne 0) {
      throw "ADB start failed."
    }
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "Done. The standalone Shouchao Android app uses $serverUrl." -ForegroundColor Green
Write-Host "For Next.js page/CSS/component changes, usually no rebuild is needed; refresh the app page." -ForegroundColor Green
Write-Host "Re-run this script after changing the server IP, native Android code, plugins, permissions, icons, or splash screens." -ForegroundColor Green
