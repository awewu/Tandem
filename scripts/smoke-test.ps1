$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:3000'
$pass = 0; $fail = 0; $warn = 0

function Hit {
    param($path, $method='GET', $body=$null, $token=$null)
    try {
        $headers = @{}
        if ($token) { $headers['Authorization'] = "Bearer $token" }
        $params = @{ Uri="$base$path"; Method=$method; UseBasicParsing=$true; TimeoutSec=8; ErrorAction='Stop'; Headers=$headers }
        if ($body) { $params.ContentType='application/json'; $params.Body=$body }
        $r = Invoke-WebRequest @params
        return [PSCustomObject]@{ Path=$path; Status=$r.StatusCode; Size=$r.RawContentLength; Body=$r.Content; OK=$true }
    } catch {
        $code = 'NET'
        if ($_.Exception.Response) { $code = $_.Exception.Response.StatusCode.value__ }
        return [PSCustomObject]@{ Path=$path; Status=$code; Size=0; Body=$null; OK=$false }
    }
}

function Show {
    param([string]$status, [string]$msg, [string]$kind='info')
    $color = switch($kind){ 'pass'{'Green'}; 'fail'{'Red'}; 'warn'{'Yellow'}; default{'Gray'} }
    Write-Host ("  {0,-4} {1}" -f $status, $msg) -ForegroundColor $color
    if ($kind -eq 'pass') { $script:pass++ }
    elseif ($kind -eq 'fail') { $script:fail++ }
    elseif ($kind -eq 'warn') { $script:warn++ }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Rhautt Platform - Pre-delivery Smoke Test" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# 1. Static assets
Write-Host ""
Write-Host "[1/6] Static assets" -ForegroundColor Yellow
foreach($a in '/favicon.ico','/images/rysnova-logo.svg','/css/design-system.css'){
    $r = Hit $a
    $line = "{0} ({1} bytes)" -f $a, $r.Size
    if ($r.OK) { Show $r.Status $line 'pass' } else { Show $r.Status "MISSING $a" 'fail' }
}

# 2. Key pages
Write-Host ""
Write-Host "[2/6] Key pages" -ForegroundColor Yellow
$keyPages = @(
    '/index-ready.html','/login.html','/staff-portal.html','/admin.html',
    '/hq-admin.html','/store-admin.html','/sales.html','/designer.html',
    '/technical-support.html','/customer-view.html','/pain-diagnosis.html'
)
foreach($p in $keyPages){
    $r = Hit $p
    $line = "{0} ({1} bytes)" -f $p, $r.Size
    if ($r.OK) { Show $r.Status $line 'pass' } else { Show $r.Status $p 'fail' }
}

# 3. Login + role redirects
Write-Host ""
Write-Host "[3/6] Login + 6 role landing flow" -ForegroundColor Yellow
$users = @(
    @{ phone='13900000000'; req='store_admin';  expectRole='store_admin';   land='/store-admin.html' }
    @{ phone='13800000000'; req='designer';     expectRole='designer';      land='/designer.html' }
    @{ phone='13700000000'; req='sales';        expectRole='sales';         land='/sales.html' }
    @{ phone='13600000000'; req='hq_admin';     expectRole='rheem_admin';   land='/hq-admin.html' }
    @{ phone='13500000000'; req='hq_admin';     expectRole='rheem_official';land='/admin.html' }
    @{ phone='13400000000'; req='end_user';     expectRole='end_user';      land='/customer-view.html' }
)
$tokens = @{}
Start-Sleep -Seconds 3
foreach($u in $users){
    $body = @{ phone=$u.phone; password='123456'; role=$u.req } | ConvertTo-Json -Compress
    $r = Hit '/api/auth/login' 'POST' $body
    if (-not $r.OK) {
        Show $r.Status ("login {0} req={1} -- API failed" -f $u.phone, $u.req) 'fail'
        Start-Sleep -Milliseconds 800
        continue
    }
    $j = $r.Body | ConvertFrom-Json
    $payload = if ($j.data) { $j.data } else { $j }
    $token = $payload.token
    $role = $payload.user.role
    if (-not $token) { Show 'X' ("{0} - missing token" -f $u.phone) 'fail'; continue }
    $tokens[$u.phone] = $token
    $land = Hit $u.land
    $line = "{0} -> role={1} -> {2}" -f $u.phone, $role, $u.land
    if ($land.OK) { Show 'OK' $line 'pass' } else { Show $land.Status ("LAND-FAIL " + $line) 'fail' }
    if ($role -ne $u.expectRole) {
        Show '?' ("role mismatch: got {0}, expected {1}" -f $role, $u.expectRole) 'warn'
    }
    Start-Sleep -Milliseconds 250
}

# 4. Business APIs
Write-Host ""
Write-Host "[4/6] Business APIs" -ForegroundColor Yellow
$tok = $tokens['13600000000']
$apis = @(
    @{ p='/api/auth/me'; m='GET';  auth=$true;  body=$null }
    @{ p='/api/house-types'; m='GET'; auth=$false; body=$null }
    @{ p='/api/house-types/stats'; m='GET'; auth=$false; body=$null }
    @{ p='/api/engines/health'; m='GET'; auth=$false; body=$null }
    @{ p='/api/pain-diagnosis'; m='POST'; auth=$false; body='{"roomProfile":{"area":120,"city":"shanghai"},"selectedTags":["hot"]}' }
    @{ p='/api/solution-match'; m='POST'; auth=$false; body='{"diagnosis":{"painPoints":["hot"]},"roomProfile":{"area":120}}' }
    @{ p='/api/ai-consultant/recommend'; m='POST'; auth=$false; body='{"houseType":"3BR","area":120,"city":"shanghai","budget":80000}' }
    @{ p='/api/design/water-system'; m='POST'; auth=$false; body='{"houseType":"3BR","area":120,"residents":3}' }
    @{ p='/api/design/heating-system'; m='POST'; auth=$false; body='{"houseType":"3BR","area":120,"city":"shanghai"}' }
    @{ p='/api/design/air-conditioning'; m='POST'; auth=$false; body='{"houseType":"3BR","area":120,"city":"shanghai"}' }
    @{ p='/api/design/five-constant'; m='POST'; auth=$false; body='{"houseType":"3BR","area":120,"city":"shanghai"}' }
    @{ p='/api/search/customer?phone=13900000000'; m='GET'; auth=$true; body=$null }
)
foreach($a in $apis){
    $token = if ($a.auth) { $tok } else { $null }
    $r = Hit $a.p $a.m $a.body $token
    $line = "[{0,-4}] {1}" -f $a.m, $a.p
    if ($r.OK -and $r.Status -eq 200) {
        Show $r.Status ("{0} ({1} bytes)" -f $line, $r.Size) 'pass'
    } elseif ($r.Status -in 401,403) {
        Show $r.Status ($line + ' (auth)') 'warn'
    } elseif ($r.Status -eq 429) {
        Show $r.Status ($line + ' (rate-limited)') 'warn'
    } else {
        Show $r.Status $line 'fail'
    }
    Start-Sleep -Milliseconds 80
}

# 5. Designer.html resource integrity
Write-Host ""
Write-Host "[5/6] Designer.html resource integrity" -ForegroundColor Yellow
$dPage = Hit '/designer.html'
if ($dPage.OK) {
    $body = $dPage.Body
    foreach($k in 'DEVICE_CATALOG','PIPE_CATALOG','LAYOUT_CATALOG','generateQuote','recalcBOM','exportPNG','loadJSON','konva@9','rysnova-logo.svg'){
        if ($body -match $k) { Show 'OK' ("designer.html contains " + $k) 'pass' }
        else                 { Show 'X'  ("designer.html missing " + $k) 'fail' }
    }
} else {
    Show $dPage.Status 'designer.html unreachable' 'fail'
}

# 6. Broken link scan
Write-Host ""
Write-Host "[6/6] href scan across key pages" -ForegroundColor Yellow
$pages = @('/index-ready.html', '/login.html', '/staff-portal.html', '/designer.html', '/admin.html')
$brokenRefs = @{}
$totalRefs = 0
foreach($pg in $pages){
    $r = Hit $pg
    if (-not $r.OK) { continue }
    $hrefs = [regex]::Matches($r.Body, 'href="(/[^"#?]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -like '*.html' -or $_ -like '/api/*' } | Select-Object -Unique
    foreach($h in $hrefs){
        $totalRefs++
        if ($brokenRefs.ContainsKey($h)) { continue }
        $hr = Hit $h
        if (-not $hr.OK) {
            $brokenRefs[$h] = ("{0} -> {1} ({2})" -f $pg, $h, $hr.Status)
        }
    }
}
if ($brokenRefs.Count -eq 0) {
    Show 'OK' ("scanned " + $totalRefs + " links, all reachable") 'pass'
} else {
    foreach($k in $brokenRefs.Keys){ Show 'X' $brokenRefs[$k] 'fail' }
}

# Summary
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
$total = $pass + $fail + $warn
Write-Host ("  PASS: {0}   FAIL: {1}   WARN: {2}   TOTAL: {3}" -f $pass, $fail, $warn, $total) -ForegroundColor White
if ($fail -eq 0) {
    Write-Host "  STATUS: READY TO SHIP" -ForegroundColor Green
} else {
    Write-Host ("  STATUS: " + $fail + " failures need fixing") -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
