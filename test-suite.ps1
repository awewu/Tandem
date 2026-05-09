$ErrorActionPreference = 'Continue'
$BASE = 'http://localhost:3000'
$results = @()

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Method = 'GET',
    [string]$Path,
    [object]$Body = $null,
    [int]$ExpectStatus = 200,
    [scriptblock]$Validate = $null,
    [int]$TimeoutSec = 30
  )
  $url = $BASE + $Path
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $obj = [ordered]@{
    name = $Name
    method = $Method
    path = $Path
    status = $null
    durationMs = $null
    pass = $false
    note = ''
    sample = $null
  }
  try {
    $params = @{ Uri = $url; Method = $Method; UseBasicParsing = $true; TimeoutSec = $TimeoutSec }
    if ($Body) {
      $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
      $params.Headers = @{ 'Content-Type' = 'application/json' }
    }
    $r = Invoke-WebRequest @params
    $sw.Stop()
    $obj.status = $r.StatusCode
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $body = $r.Content
    $sample = $body
    if ($body.Length -gt 300) { $sample = $body.Substring(0, 300) + '...' }
    $obj.sample = $sample
    if ($r.StatusCode -eq $ExpectStatus) {
      if ($Validate) {
        $parsed = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
        $vRes = & $Validate $parsed
        if ($vRes -is [bool]) {
          $obj.pass = $vRes
          if (-not $vRes) { $obj.note = 'validation failed' }
        } else {
          $obj.pass = $true
        }
      } else {
        $obj.pass = $true
      }
    } else {
      $obj.note = "expected $ExpectStatus got $($r.StatusCode)"
    }
  } catch [System.Net.WebException] {
    $sw.Stop()
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    if ($_.Exception.Response) {
      $obj.status = [int]$_.Exception.Response.StatusCode
      $rd = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $obj.sample = $rd.ReadToEnd()
    }
    if ($obj.status -eq $ExpectStatus) {
      if ($Validate) {
        $parsed = $obj.sample | ConvertFrom-Json -ErrorAction SilentlyContinue
        $vRes = & $Validate $parsed
        $obj.pass = ($vRes -is [bool] -and $vRes)
      } else {
        $obj.pass = $true
      }
    } else {
      $obj.note = $_.Exception.Message
    }
  } catch {
    $sw.Stop()
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $obj.note = $_.Exception.Message
  }
  $script:results += [PSCustomObject]$obj
  $color = if ($obj.pass) { 'Green' } else { 'Red' }
  $tag = if ($obj.pass) { '[PASS]' } else { '[FAIL]' }
  Write-Host ("{0} {1,-30} {2,5}ms  {3,-3}  {4}" -f $tag,$Name,$obj.durationMs,$obj.status,$obj.note) -ForegroundColor $color
}

Write-Host '=========================================================='
Write-Host ' tieshan E2E API test' -ForegroundColor Cyan
Write-Host '=========================================================='

# Health/status
Test-Endpoint -Name 'health'        -Path '/api/health'   -Validate { param($d) $d.PSObject.Properties.Name -contains 'ok' }
Test-Endpoint -Name 'status'        -Path '/api/status'   -Validate { param($d) $d.PSObject.Properties.Name -contains 'environment' }
Test-Endpoint -Name 'skills'        -Path '/api/skills'   -Validate { param($d) $d.PSObject.Properties.Name -contains 'skills' }
Test-Endpoint -Name 'mcp list'      -Path '/api/mcp'      -Validate { param($d) $d.PSObject.Properties.Name -contains 'servers' }
Test-Endpoint -Name 'memory status' -Path '/api/memory'   -Validate { param($d) $d.PSObject.Properties.Name -contains 'builtIn' }

# Logs (URL with & must be quoted -- single quotes preserve it)
Test-Endpoint -Name 'logs default'         -Path '/api/logs?lines=5'                      -Validate { param($d) $d.PSObject.Properties.Name -contains 'logs' }
Test-Endpoint -Name 'logs filter ERROR'    -Path ('/api/logs?lines=20' + '&' + 'level=ERROR') -Validate { param($d) $d.PSObject.Properties.Name -contains 'logs' }
Test-Endpoint -Name 'logs file=errors'     -Path ('/api/logs?log=errors' + '&' + 'lines=5')   -Validate { param($d) $d.PSObject.Properties.Name -contains 'logs' }
Test-Endpoint -Name 'logs since 1d'        -Path ('/api/logs?lines=10' + '&' + 'since=1d')    -Validate { param($d) $d.PSObject.Properties.Name -contains 'logs' }

# Cron CRUD
$cronName = 'webuiTest' + (Get-Random -Min 1000 -Max 9999)
Test-Endpoint -Name 'cron list (initial)' -Path '/api/cron' -Validate { param($d) $d.PSObject.Properties.Name -contains 'jobs' }
Test-Endpoint -Name 'cron create'  -Method POST -Path '/api/cron' -Body @{ schedule = '0 9 * * *'; prompt = 'Daily smoke test'; name = $cronName } -Validate { param($d) $d.success -eq $true }

$listRes = Invoke-WebRequest ($BASE + '/api/cron') -UseBasicParsing
$listJson = $listRes.Content | ConvertFrom-Json
$createdJob = $listJson.jobs | Where-Object { $_.name -eq $cronName } | Select-Object -First 1
if ($createdJob) {
  Write-Host ("    created cron id = " + $createdJob.id) -ForegroundColor DarkGray
  Test-Endpoint -Name 'cron pause'  -Method PATCH  -Path ('/api/cron/' + $createdJob.id) -Body @{ action = 'pause' }  -Validate { param($d) $d.success -eq $true }
  Test-Endpoint -Name 'cron resume' -Method PATCH  -Path ('/api/cron/' + $createdJob.id) -Body @{ action = 'resume' } -Validate { param($d) $d.success -eq $true }
  Test-Endpoint -Name 'cron run'    -Method POST   -Path ('/api/cron/' + $createdJob.id)                              -Validate { param($d) $d.success -eq $true }
  Test-Endpoint -Name 'cron delete' -Method DELETE -Path ('/api/cron/' + $createdJob.id)                              -Validate { param($d) $d.success -eq $true }
} else {
  Write-Host '    [WARN] could not locate created cron job, skipping action tests' -ForegroundColor Yellow
}

# Negative-path tests
Test-Endpoint -Name 'cron create no schedule' -Method POST   -Path '/api/cron' -Body @{ prompt = 'no sched' } -ExpectStatus 400 -Validate { param($d) $d.success -eq $false }
Test-Endpoint -Name 'cron action bad id'      -Method DELETE -Path '/api/cron/INVALID..ID' -ExpectStatus 400 -Validate { param($d) $d.success -eq $false }
if ($createdJob) {
  Test-Endpoint -Name 'cron action bad verb'  -Method PATCH  -Path ('/api/cron/' + $createdJob.id) -Body @{ action = 'explode' } -ExpectStatus 400 -Validate { param($d) $d.success -eq $false }
}
# llm-stream returns 400 + SSE body (not pure JSON), so do a raw fetch and assert
Write-Host '' 
function Test-LLMStreamMissingBaseURL {
  $obj = [ordered]@{ name = 'llm-stream missing baseURL'; method = 'POST'; path = '/api/llm-stream'; status = $null; durationMs = $null; pass = $false; note = ''; sample = $null }
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $req = [System.Net.HttpWebRequest]::Create($BASE + '/api/llm-stream')
    $req.Method = 'POST'
    $req.ContentType = 'application/json'
    $req.Timeout = 10000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"messages":[],"model":"foo"}')
    $req.ContentLength = $bytes.Length
    $rs = $req.GetRequestStream(); $rs.Write($bytes,0,$bytes.Length); $rs.Close()
    try { $resp = $req.GetResponse() } catch [System.Net.WebException] { $resp = $_.Exception.Response }
    $obj.status = [int]$resp.StatusCode
    $rd = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $body = $rd.ReadToEnd(); $rd.Close(); $resp.Close()
    $obj.sample = $body.Substring(0,[Math]::Min(200,$body.Length))
    $sw.Stop(); $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $obj.pass = ($obj.status -eq 400 -and $body -match 'baseURL')
    if (-not $obj.pass) { $obj.note = 'expected 400 + baseURL error in SSE body' }
  } catch {
    $sw.Stop(); $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds; $obj.note = $_.Exception.Message
  }
  $script:results += [PSCustomObject]$obj
  $color = if ($obj.pass) { 'Green' } else { 'Red' }
  $tag = if ($obj.pass) { '[PASS]' } else { '[FAIL]' }
  Write-Host ("{0} {1,-30} {2,5}ms  {3,-3}  {4}" -f $tag,$obj.name,$obj.durationMs,$obj.status,$obj.note) -ForegroundColor $color
}
Test-LLMStreamMissingBaseURL

Write-Host ''
Write-Host '=== SSE streaming ===' -ForegroundColor Cyan

function Test-SSE {
  param([string]$Name, [string]$Path, [object]$Body, [int]$MaxSeconds = 90)
  $url = $BASE + $Path
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $obj = [ordered]@{
    name = $Name; method = 'POST'; path = $Path; status = $null
    durationMs = $null; pass = $false; note = ''; sample = $null
    contentChunks = 0; totalChars = 0; doneSeen = $false; errorSeen = $null
  }
  try {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = 'POST'
    $req.ContentType = 'application/json'
    $req.Timeout = $MaxSeconds * 1000
    $req.ReadWriteTimeout = $MaxSeconds * 1000
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10 -Compress))
    $req.ContentLength = $bodyBytes.Length
    $rs = $req.GetRequestStream()
    $rs.Write($bodyBytes, 0, $bodyBytes.Length); $rs.Close()
    $resp = $req.GetResponse()
    $obj.status = [int]$resp.StatusCode
    $rd = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $contentSample = New-Object System.Text.StringBuilder
    while (-not $rd.EndOfStream -and $sw.Elapsed.TotalSeconds -lt $MaxSeconds) {
      $line = $rd.ReadLine()
      if ($null -eq $line) { continue }
      $t = $line.Trim()
      if (-not $t.StartsWith('data:')) { continue }
      $payload = $t.Substring(5).Trim()
      if (-not $payload -or $payload -eq '[DONE]') { continue }
      try {
        $j = $payload | ConvertFrom-Json
        if ($j.error) { $obj.errorSeen = $j.error }
        if ($j.content) {
          $obj.contentChunks++
          $obj.totalChars += $j.content.Length
          if ($contentSample.Length -lt 200) { [void]$contentSample.Append($j.content) }
        }
        if ($j.done) { $obj.doneSeen = $true; break }
      } catch { }
    }
    $rd.Close()
    $resp.Close()
    $sw.Stop()
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $sm = $contentSample.ToString()
    if ($sm.Length -gt 200) { $sm = $sm.Substring(0,200) + '...' }
    $obj.sample = $sm
    $obj.pass = ($obj.doneSeen -and (-not $obj.errorSeen) -and $obj.contentChunks -gt 0)
    if (-not $obj.doneSeen) { $obj.note = 'no done event' }
    elseif ($obj.errorSeen) { $obj.note = 'error: ' + $obj.errorSeen.Substring(0, [Math]::Min(120, $obj.errorSeen.Length)) }
    elseif ($obj.contentChunks -eq 0) { $obj.note = 'no content chunks' }
  } catch {
    $sw.Stop()
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $obj.note = $_.Exception.Message
  }
  $script:results += [PSCustomObject]$obj
  $color = if ($obj.pass) { 'Green' } else { 'Red' }
  $tag = if ($obj.pass) { '[PASS]' } else { '[FAIL]' }
  Write-Host ("{0} {1,-30} {2,5}ms  chunks={3} chars={4} done={5}  {6}" -f $tag,$Name,$obj.durationMs,$obj.contentChunks,$obj.totalChars,$obj.doneSeen,$obj.note) -ForegroundColor $color
}

Test-SSE -Name 'chat stream (CLI)' -Path '/api/stream' -Body @{
  messages = @(@{ role = 'user'; content = 'Say hello in one short sentence.' })
  model = 'default'
} -MaxSeconds 90

# Workflow run
$wfBody = @{
  nodes = @(
    @{ id = 'n1'; type = 'trigger'; label = 'start' },
    @{ id = 'n2'; type = 'agent';   label = 'pm';      agentId = 'agent-pm'; prompt = 'Reply with one short word.' },
    @{ id = 'n3'; type = 'output';  label = 'end' }
  )
  edges = @(
    @{ from = 'n1'; to = 'n2' },
    @{ from = 'n2'; to = 'n3' }
  )
  initialInput = 'Hello'
}

function Test-WorkflowSSE {
  param([object]$Body, [int]$MaxSeconds = 180)
  $url = $BASE + '/api/workflows/run'
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $obj = [ordered]@{
    name = 'workflow run'; method = 'POST'; path = '/api/workflows/run'; status = $null
    durationMs = $null; pass = $false; note = ''; sample = $null
    eventCounts = $null
    nodesStarted = 0; nodesDone = 0; doneSeen = $false; errorSeen = $null
  }
  try {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = 'POST'
    $req.ContentType = 'application/json'
    $req.Timeout = $MaxSeconds * 1000
    $req.ReadWriteTimeout = $MaxSeconds * 1000
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10 -Compress))
    $req.ContentLength = $bodyBytes.Length
    $rs = $req.GetRequestStream()
    $rs.Write($bodyBytes, 0, $bodyBytes.Length); $rs.Close()
    $resp = $req.GetResponse()
    $obj.status = [int]$resp.StatusCode
    $rd = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $eventTypes = @{}
    # SSE event/data pair tracking
    $currentEvent = 'message'
    $currentData = New-Object System.Text.StringBuilder
    $break = $false
    while (-not $rd.EndOfStream -and $sw.Elapsed.TotalSeconds -lt $MaxSeconds -and -not $break) {
      $line = $rd.ReadLine()
      if ($null -eq $line) { continue }
      if ($line -eq '') {
        # event boundary -- process pair
        if ($currentData.Length -gt 0) {
          $payload = $currentData.ToString()
          try {
            $j = $payload | ConvertFrom-Json
            if (-not $eventTypes.ContainsKey($currentEvent)) { $eventTypes[$currentEvent] = 0 }
            $eventTypes[$currentEvent]++
            if ($currentEvent -eq 'node:start') { $obj.nodesStarted++ }
            if ($currentEvent -eq 'node:done')  { $obj.nodesDone++ }
            if ($currentEvent -eq 'error')      { $obj.errorSeen = $j.message }
            if ($currentEvent -eq 'done')       { $obj.doneSeen = $true; $break = $true }
          } catch { }
        }
        $currentEvent = 'message'
        [void]$currentData.Clear()
        continue
      }
      if ($line.StartsWith('event: ')) {
        $currentEvent = $line.Substring(7).Trim()
      } elseif ($line.StartsWith('data: ')) {
        [void]$currentData.Append($line.Substring(6))
      }
    }
    $rd.Close(); $resp.Close()
    $sw.Stop()
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $obj.eventCounts = $eventTypes
    $obj.sample = ($eventTypes | ConvertTo-Json -Compress)
    $obj.pass = ($obj.doneSeen -and $obj.nodesStarted -ge 1 -and $obj.nodesDone -ge 1 -and (-not $obj.errorSeen))
    if (-not $obj.doneSeen) { $obj.note = 'no done event' }
    elseif ($obj.errorSeen) { $obj.note = 'wf error: ' + $obj.errorSeen.Substring(0, [Math]::Min(120, $obj.errorSeen.Length)) }
  } catch {
    $sw.Stop()
    $obj.durationMs = [int]$sw.Elapsed.TotalMilliseconds
    $obj.note = $_.Exception.Message
  }
  $script:results += [PSCustomObject]$obj
  $color = if ($obj.pass) { 'Green' } else { 'Red' }
  $tag = if ($obj.pass) { '[PASS]' } else { '[FAIL]' }
  Write-Host ("{0} workflow run                   {1,5}ms  events={2}  started={3} done={4}  {5}" -f $tag,$obj.durationMs,($obj.eventCounts | ConvertTo-Json -Compress),$obj.nodesStarted,$obj.nodesDone,$obj.note) -ForegroundColor $color
}

Test-WorkflowSSE -Body $wfBody

Write-Host ''
Write-Host '=== Page SSR (raw HTML) ===' -ForegroundColor Cyan
foreach ($pg in @('/','/chat','/agents','/workflows','/tasks','/skills','/knowledge','/memories','/organization','/okr','/mcp','/logs','/design','/settings')) {
  Test-Endpoint -Name ('page ' + $pg) -Path $pg
}

$summary = [ordered]@{
  total = $results.Count
  pass = ($results | Where-Object { $_.pass }).Count
  fail = ($results | Where-Object { -not $_.pass }).Count
  results = $results
}
$summary | ConvertTo-Json -Depth 10 | Out-File -FilePath E:\Hermes\test-report.json -Encoding utf8
Write-Host ''
Write-Host '=========================================================='
Write-Host (' total {0}  pass {1}  fail {2}' -f $summary.total, $summary.pass, $summary.fail) -ForegroundColor Cyan
Write-Host '=========================================================='
Write-Host 'JSON report: E:\Hermes\test-report.json'
