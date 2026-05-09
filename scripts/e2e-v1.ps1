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

function Send-Json($path, $body, $method = 'POST') {
  $bytes = $utf8.GetBytes(($body | ConvertTo-Json -Compress -Depth 10))
  return Invoke-RestMethod -Method $method -Uri "$BaseUrl$path" `
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
# 6. Convergence full lifecycle: start -> PICK -> COMMIT -> VETO
#    (PRD section 8 acceptance steps 5/6/8)
# ---------------------------------------------------------------------------
$cardId = $null
try {
  $cv = Send-Json '/api/convergence' @{
    title = '[E2E] should we cut V1 GA from 14 months to 12?'
    description = 'Trade-off: faster GA vs. unfinished compliance review.'
    ownerId = 'demo-user'
  }
  $cardId = $cv.cardId
  $hasOpts = ($cv.step -eq 'DIVERGE')
  Step '6a Convergence start (LLM 3+1 generated)' $hasOpts "cardId=$cardId step=$($cv.step)"
} catch { Step '6a Convergence start' $false "ERR: $($_.Exception.Message)" }

if (-not $cardId) {
  Write-Host '!! convergence start failed, skipping 6b-6e'
}

if ($cardId) {
  # PICK_OPTION D (forces human originality per Manifesto section 9)
  try {
    $pick = Send-Json "/api/convergence/$cardId" @{
      event = @{ type = 'PICK_OPTION'; userId = 'demo-user'; option = 'D'; at = [int64](([DateTimeOffset]::Now.ToUnixTimeMilliseconds())) }
    }
    Step '6b Convergence PICK_OPTION D' ($pick.step -eq 'CONVERGE') "step=$($pick.step)"
  } catch { Step '6b Convergence PICK' $false "ERR: $($_.Exception.Message)" }

  # COMMIT (opens 24h veto window)
  try {
    $com = Send-Json "/api/convergence/$cardId" @{
      event = @{ type = 'COMMIT'; userId = 'demo-user'; at = [int64](([DateTimeOffset]::Now.ToUnixTimeMilliseconds())) }
    }
    Step '6c Convergence COMMIT' ($com.step -eq 'COMMIT') "step=$($com.step) events=$($com.events -join ',')"
  } catch { Step '6c Convergence COMMIT' $false "ERR: $($_.Exception.Message)" }

  # Verify card has vetoWindowEnds set
  try {
    $card = (Get-Json "/api/convergence/$cardId").card
    $vetoOpen = ($null -ne $card.vetoWindowEnds)
    Step '6d Convergence veto window opened' $vetoOpen "vetoWindowEnds=$($card.vetoWindowEnds)"
  } catch { Step '6d Convergence veto window' $false "ERR: $($_.Exception.Message)" }

  # VETO within 24h
  try {
    $veto = Send-Json "/api/convergence/$cardId" @{
      event = @{ type = 'VETO'; userId = 'demo-user'; reason = 'e2e: rolling back commit to test veto path'; at = [int64](([DateTimeOffset]::Now.ToUnixTimeMilliseconds())) }
    }
    Step '6e Convergence VETO' ($veto.step -eq 'VETOED') "step=$($veto.step)"
  } catch { Step '6e Convergence VETO' $false "ERR: $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
# 7. Memory promotion sign flow (PRD section 8 acceptance step 10)
#    Pick a pending team-level promotion -> sign team_leader -> sign steward
# ---------------------------------------------------------------------------
try {
  $allPending = (Get-Json '/api/tandem/memory/promotion?status=pending&level=team').promotions
  $target = $allPending | Where-Object { $_.signers.history.Count -eq 0 } | Select-Object -First 1
  if ($null -eq $target) {
    Step '7a Memory promotion pick target' $false 'no pending team-level promotion to sign (need fresh seed?)'
  } else {
    Step '7a Memory promotion pick target' $true "promotionId=$($target.id) level=$($target.level)"

    # Sign as team_leader (demo-user) - PATCH
    try {
      $sig1 = Send-Json '/api/tandem/memory/promotion' @{
        promotionId = $target.id
        action = 'sign'
        signerId = 'demo-user'
        role = 'team_leader'
        comment = '[E2E] team_leader sign lesson promotion'
      } 'PATCH'
      $tlOk = ($null -ne $sig1.promotion.signers.teamLeader)
      Step '7b Sign team_leader' $tlOk "teamLeader=$($sig1.promotion.signers.teamLeader.userId)"
    } catch { Step '7b Sign team_leader' $false "ERR: $($_.Exception.Message)" }

    # Sign as steward (colleague-wang, seed-appointed) - PATCH
    try {
      $sig2 = Send-Json '/api/tandem/memory/promotion' @{
        promotionId = $target.id
        action = 'sign'
        signerId = 'colleague-wang'
        role = 'steward'
        comment = '[E2E] steward review approved'
      } 'PATCH'
      $stOk = ($null -ne $sig2.promotion.signers.steward)
      Step '7c Sign steward' $stOk "steward=$($sig2.promotion.signers.steward.userId)"
      # All required signed: team_leader + steward
      $signedCount = $sig2.promotion.signers.history.Count
      Step '7d All required roles signed' ($signedCount -ge 2) "history.count=$signedCount status=$($sig2.promotion.status) (note: status=approved 仅在公示期满后, 这里 publicReviewUntil 还在未来 -> 仍 pending)"
    } catch { Step '7c Sign steward' $false "ERR: $($_.Exception.Message)" }
  }
} catch { Step '7 Memory sign flow' $false "ERR: $($_.Exception.Message)" }

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$summary = "`n========== E2E SUMMARY ==========`nbase: $BaseUrl`npass: $pass`nfail: $fail`nlog : $logPath`n"
Write-Host $summary

$logBody = ($log -join "`n") + $summary
[System.IO.File]::WriteAllText($logPath, $logBody, $utf8)

if ($fail -gt 0) { exit 1 } else { exit 0 }
