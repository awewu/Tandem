$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:3000'
$pass = 0; $fail = 0; $warn = 0

function Hit {
    param($path, $method='GET', $body=$null)
    try {
        $params = @{ Uri="$base$path"; Method=$method; UseBasicParsing=$true; TimeoutSec=8; ErrorAction='Stop' }
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
Write-Host "  Staff Portal End-to-End Verification" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# Path 1: index top-bar staff button -> /login.html
Write-Host ""
Write-Host "[Path 1] index-ready.html top-bar btn-staff -> /login.html" -ForegroundColor Yellow
$idx = Hit '/index-ready.html'
if ($idx.Body -match 'btn-staff') {
    Show 'OK' 'btn-staff class present in index-ready.html' 'pass'
} else {
    Show 'X' 'btn-staff missing' 'fail'
}
if ($idx.Body -match 'href="/login\.html"') {
    Show 'OK' '/login.html href present' 'pass'
} else {
    Show 'X' '/login.html href missing' 'fail'
}
$login = Hit '/login.html'
if ($login.OK) { Show $login.Status "/login.html reachable ($($login.Size) bytes)" 'pass' }
else           { Show $login.Status "/login.html UNREACHABLE" 'fail' }

# Path 2: index footer link -> /staff-portal.html
Write-Host ""
Write-Host "[Path 2] index-ready.html footer -> /staff-portal.html" -ForegroundColor Yellow
if ($idx.Body -match 'href="/staff-portal\.html"') {
    Show 'OK' 'footer link to /staff-portal.html present' 'pass'
} else {
    Show 'X' 'footer link missing' 'fail'
}
$portal = Hit '/staff-portal.html'
if ($portal.OK) { Show $portal.Status "/staff-portal.html reachable ($($portal.Size) bytes)" 'pass' }
else            { Show $portal.Status "/staff-portal.html UNREACHABLE" 'fail' }

# Path 3: all href targets in staff-portal.html
Write-Host ""
Write-Host "[Path 3] All href targets in staff-portal.html" -ForegroundColor Yellow
$portalHrefs = [regex]::Matches($portal.Body, 'href="(/[^"#?]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -like '*.html' -or $_ -like '*.css' -or $_ -like '/api/*' } | Select-Object -Unique | Sort-Object
foreach($h in $portalHrefs) {
    $r = Hit $h
    if ($r.OK) { Show $r.Status $h 'pass' }
    else       { Show $r.Status ("MISSING " + $h) 'fail' }
}

# Path 4: All login.html roleRedirects targets reachable
Write-Host ""
Write-Host "[Path 4] login.html roleRedirects targets" -ForegroundColor Yellow
$lands = @('/store-admin.html','/designer.html','/sales.html','/hq-admin.html','/admin.html','/customer-view.html','/technical-support.html')
foreach($l in $lands) {
    $r = Hit $l
    if ($r.OK) { Show $r.Status $l 'pass' }
    else       { Show $r.Status ("MISSING " + $l) 'fail' }
}

# Path 5: All 6 demo accounts -> login -> token -> landing
Write-Host ""
Write-Host "[Path 5] All 6 demo accounts: login -> token -> landing" -ForegroundColor Yellow
$users = @(
    @{ phone='13900000000'; req='store_admin'; expectRole='store_admin';   land='/store-admin.html';   label='store-admin' }
    @{ phone='13800000000'; req='designer';    expectRole='designer';      land='/designer.html';      label='designer' }
    @{ phone='13700000000'; req='sales';       expectRole='sales';         land='/sales.html';         label='sales' }
    @{ phone='13600000000'; req='hq_admin';    expectRole='rheem_admin';   land='/hq-admin.html';      label='hq-admin' }
    @{ phone='13500000000'; req='hq_admin';    expectRole='rheem_official';land='/admin.html';         label='rheem-official' }
    @{ phone='13400000000'; req='end_user';    expectRole='end_user';      land='/customer-view.html'; label='end-user' }
)
Start-Sleep -Seconds 2
foreach($u in $users){
    $body = @{ phone=$u.phone; password='123456'; role=$u.req } | ConvertTo-Json -Compress
    $r = Hit '/api/auth/login' 'POST' $body
    if (-not $r.OK) {
        Show $r.Status ("login " + $u.label + " API fail (HTTP " + $r.Status + ")") 'fail'
        Start-Sleep -Milliseconds 600
        continue
    }
    $j = $r.Body | ConvertFrom-Json
    $payload = if ($j.data) { $j.data } else { $j }
    $token = $payload.token
    $role = $payload.user.role
    if (-not $token) { Show 'X' ($u.label + " missing token") 'fail'; continue }
    if ($role -ne $u.expectRole) {
        Show '?' ($u.label + " role=" + $role + " (expected " + $u.expectRole + ")") 'warn'
    }
    $land = Hit $u.land
    $line = "{0,-15} {1,-12} -> role={2,-15} -> land={3}" -f $u.label, $u.phone, $role, $u.land
    if ($land.OK) { Show 'OK' $line 'pass' } else { Show $land.Status ("FAIL " + $line) 'fail' }
    Start-Sleep -Milliseconds 200
}

# Path 6: login.html form integrity
Write-Host ""
Write-Host "[Path 6] login.html form & role cards integrity" -ForegroundColor Yellow
$loginBody = $login.Body
$keys = @(
    'data-role="store_admin"',
    'data-role="designer"',
    'data-role="sales"',
    'data-role="hq_admin"',
    'id="phone"',
    'id="password"',
    '/api/auth/login',
    'localStorage.setItem',
    'roleRedirects',
    'rheem_official',
    'end_user',
    'fillDemo'
)
foreach($k in $keys) {
    if ($loginBody -match [regex]::Escape($k)) { Show 'OK' ("contains " + $k) 'pass' }
    else { Show 'X' ("MISSING " + $k) 'fail' }
}

# Path 7: Each landing page reachable + has body
Write-Host ""
Write-Host "[Path 7] Landing page reachability + size" -ForegroundColor Yellow
foreach($lp in @('/store-admin.html','/designer.html','/sales.html','/hq-admin.html','/admin.html','/customer-view.html','/technical-support.html')) {
    $r = Hit $lp
    if ($r.OK -and $r.Size -gt 1000) {
        Show 'OK' ("{0} ({1} bytes)" -f $lp, $r.Size) 'pass'
    } elseif ($r.OK) {
        Show '?' ("{0} suspiciously small ({1} bytes)" -f $lp, $r.Size) 'warn'
    } else {
        Show $r.Status ($lp + " UNREACHABLE") 'fail'
    }
}

# Path 8: Demo quick-login buttons in login.html
Write-Host ""
Write-Host "[Path 8] login.html quick-login demo buttons" -ForegroundColor Yellow
$demos = [regex]::Matches($loginBody, "fillDemo\('(\d+)','(\d+)','(\w+)'\)")
if ($demos.Count -eq 0) {
    Show 'X' 'no fillDemo() buttons found' 'fail'
} else {
    Show 'OK' ("found " + $demos.Count + " demo buttons") 'pass'
    foreach($m in $demos) {
        $phone  = $m.Groups[1].Value
        $role   = $m.Groups[3].Value
        Show 'i' ("demo: phone=" + $phone + " role=" + $role) 'pass'
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
$total = $pass + $fail + $warn
Write-Host ("  PASS: {0}   FAIL: {1}   WARN: {2}   TOTAL: {3}" -f $pass, $fail, $warn, $total) -ForegroundColor White
if ($fail -eq 0) {
    Write-Host "  STAFF PORTAL: ALL FLOWS GREEN" -ForegroundColor Green
} else {
    Write-Host ("  STAFF PORTAL: " + $fail + " issues to fix") -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
