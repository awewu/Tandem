<#
.SYNOPSIS
  Tandem V1 PoC End-to-End Smoke Test (aligned with PRD section 8)

.DESCRIPTION
  Walks the V1 critical path via HTTP API. Does NOT require UI nor auth cookies.
  Covers the machine-testable parts of the V1 GA acceptance:
    - /api/health, /api/integrations/health, /api/llm-health
    - Self-built IM PoC: list channels / send message / spawn-room / promote-to-memory / @persona
    - DeepSeek live trigger via @persona summon (async reply)
    - Memory 3-tier promotion entry created
    - Persona / dashboard / 9-box aggregations
  Auth-cookie steps (register / login / MFA) are NOT covered here; do those via UI.

.PARAMETER BaseUrl
  Tandem instance base URL, default http://localhost:3000

.EXAMPLE
  pwsh -File scripts/e2e-v1.ps1
  pwsh -File scripts/e2e-v1.ps1 -BaseUrl http://localhost:3001

.NOTES
  Exit codes: 0 = all PASS, 1 = any FAIL.
  Log: writes .tmp-e2e.log (UTF-8). Console may show CJK as garbage on Windows
  cp936 codepage; the log file is the source of truth.
#>

param(
  [string]$BaseUrl = 'http://localhost:3000'
)

$ErrorActionPreference = 'Continue'
$utf8 = [System.Text.Encoding]::UTF8
$logPath = '.tmp-e2e.log'
$log = @()
$pass = 0
$fail = 0

function Step($name, $ok, $detail) {
  $tag = if ($ok) { 'PASS' } else { 'FAIL' }
  $line = "[$tag] $name :: $detail"
  $log += $line
  if ($ok) { $script:pass++ } else { $script:fail++ }
  Write-Host $line
}

function Get-Json($path) {
  return Invoke-RestMethod -Uri "$BaseUrl$path" -Method GET
}

function Send-Json($path, $body) {
  $bytes = $utf8.GetBytes(($body | ConvertTo-Json -Compress -Depth 10))
  return Invoke-RestMethod -Method POST -Uri "$BaseUrl$path" `
    -ContentType 'application/json; charset=utf-8' -Body $bytes
}

# ---------------------------------------------------------------------------
# 0. Probes
# ---------------------------------------------------------------------------
try {
  $h = Get-Json '/api/health'
  Step '0a /api/health' ($h.ok -eq $true) "ok=$($h.ok)"
} catch { Step '0a /api/health' $false "ERR: $($_.Exception.Message)" }

try {
  $i = Get-Json '/api/integrations/health'
  Step '0b /api/integrations/health' ($i.summary.total -ge 10) "total=$($i.summary.total) reachable=$($i.summary.reachable)"
} catch { Step '0b /api/integrations/health' $false "ERR: $($_.Exception.Message)" }

try {
  $l = Get-Json '/api/llm-health'
  $deepOk = $l.deepseekHealthy -eq $true
  Step '0c /api/llm-health (DeepSeek live)' $deepOk "providers=$($l.registeredProviders -join ',') deepseekHealthy=$deepOk"
} catch { Step '0c /api/llm-health' $false "ERR: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# 1. Seed integrity
# ---------------------------------------------------------------------------
try {
  $s = Get-Json '/api/dashboard/stats'
  Step '1a dashboard/stats DC>=3' ($s.decisionCards.total -ge 3) "DC total=$($s.decisionCards.total)"
  Step '1b dashboard/stats KR>0' ($s.okr.keyResults -gt 0) "KR=$($s.okr.keyResults) TTI=$($s.okr.ttis)"
} catch { Step '1 dashboard/stats' $false "ERR: $($_.Exception.Message)" }

try {
  $d = Get-Json '/api/me/dashboard?userId=demo-user'
  $hasPersona = ($null -ne $d.creation.persona)
  Step '1c me/dashboard persona' $hasPersona "stage=$($d.creation.persona.stage) score=$($d.creation.persona.bossCaptureScore)"
} catch { Step '1c me/dashboard' $false "ERR: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# 2. Self-built IM PoC (core differentiator)
# ---------------------------------------------------------------------------
$ch = $null
try {
  $cs = Get-Json '/api/im/channels?userId=demo-user'
  Step '2a IM list channels >=2' ($cs.channels.Count -ge 2) "channels=$($cs.channels.Count)"
  $ch = $cs.channels[0]
} catch { Step '2a IM channels' $false "ERR: $($_.Exception.Message)" }

if (-not $ch) {
  Write-Host '!! no channel, skip IM subtests'
} else {
  $sent = $null
  try {
    $sent = Send-Json "/api/im/channels/$($ch.id)/messages" @{
      senderId = 'demo-user'
      body = '[E2E] plain message - target for spawn-room test'
    }
    Step '2b IM POST message' ($null -ne $sent.message.id) "msgId=$($sent.message.id)"
  } catch { Step '2b IM POST message' $false "ERR: $($_.Exception.Message)" }

  if ($sent.message.id) {
    try {
      $sr = Send-Json "/api/im/messages/$($sent.message.id)/spawn-room" @{
        triggeredBy = 'demo-user'
      }
      Step '2c IM spawn-room' ($null -ne $sr.cardId) "cardId=$($sr.cardId)"
    } catch { Step '2c IM spawn-room' $false "ERR: $($_.Exception.Message)" }
  }

  $sent2 = $null
  try {
    $sent2 = Send-Json "/api/im/channels/$($ch.id)/messages" @{
      senderId = 'demo-user'
      body = '[E2E] candidate for memory promotion - in-memory + globalThis singletons survive HMR'
    }
    Step '2d IM POST message #2' ($null -ne $sent2.message.id) "msgId=$($sent2.message.id)"
  } catch { Step '2d IM POST message #2' $false "ERR: $($_.Exception.Message)" }

  if ($sent2.message.id) {
    try {
      $pm = Send-Json "/api/im/messages/$($sent2.message.id)/promote-to-memory" @{
        triggeredBy = 'demo-user'
        level = 'team'
        proposedType = 'lesson'
      }
      Step '2e IM promote-to-memory' ($null -ne $pm.promotionId) "promotionId=$($pm.promotionId) materialId=$($pm.materialId)"
    } catch { Step '2e IM promote-to-memory' $false "ERR: $($_.Exception.Message)" }
  }

  $sent3 = $null
  try {
    $sent3 = Send-Json "/api/im/channels/$($ch.id)/messages" @{
      senderId = 'demo-user'
      body = '[E2E] @[colleague-li](colleague-li:persona) one sentence: in-memory or PG for V1?'
    }
    Step '2f IM @persona POST' ($null -ne $sent3.message.id) "msgId=$($sent3.message.id)"
    Start-Sleep -Seconds 8
    $msgs = (Get-Json "/api/im/channels/$($ch.id)/messages?limit=50").messages
    $personaReply = $msgs | Where-Object {
      $_.senderKind -eq 'persona' -and $_.parentMessageId -eq $sent3.message.id
    } | Select-Object -First 1
    $replyText = if ($personaReply) { $personaReply.body.Substring(0,[Math]::Min(60,$personaReply.body.Length)) } else { 'NONE' }
    Step '2g IM @persona DeepSeek reply' ($null -ne $personaReply) "reply=$replyText..."
  } catch { Step '2f IM @persona' $false "ERR: $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
# 3. Memory promotion stored
# ---------------------------------------------------------------------------
try {
  $p = Get-Json '/api/tandem/memory/promotion?status=pending'
  Step '3 Memory promotion pending >=1' ($p.promotions.Count -ge 1) "pending=$($p.promotions.Count)"
} catch { Step '3 Memory promotion' $false "ERR: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# 4. 9-box (KPI x TTI)
# ---------------------------------------------------------------------------
try {
  $nb = Get-Json '/api/nine-box'
  $hasPeople = ($null -ne $nb.people)
  Step '4 9-box matrix' $hasPeople "people=$($nb.people.Count) cycles=$($nb.cycles.Count)"
} catch { Step '4 9-box' $false "ERR: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# 5. Persona evolution endpoint
# ---------------------------------------------------------------------------
try {
  $pe = Get-Json '/api/persona/demo-user/progress'
  Step '5 Persona progress' ($null -ne $pe) "stage=$($pe.persona.stage) delegationLevel=$($pe.persona.delegationLevel)"
} catch { Step '5 Persona progress' $false "ERR: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$summary = "`n========== E2E SUMMARY ==========`nbase: $BaseUrl`npass: $pass`nfail: $fail`nlog : $logPath`n"
Write-Host $summary

$logBody = ($log -join "`n") + $summary
[System.IO.File]::WriteAllText($logPath, $logBody, $utf8)

if ($fail -gt 0) { exit 1 } else { exit 0 }
