$endpoints = @(
  "/api/documents?ownerId=demo-user",
  "/api/calendar?ownerId=demo-user",
  "/api/drive?ownerId=demo-user",
  "/api/notifications?userId=demo-user",
  "/api/approvals",
  "/api/meetings/rooms",
  "/api/search?q=test",
  "/api/persona/demo-user",
  "/api/memory",
  "/api/okr/initiatives",
  "/api/okr/checkins",
  "/api/im/channels",
  "/api/1on1",
  "/api/360/cycles",
  "/api/nine-box",
  "/api/audit",
  "/api/dashboard/stats",
  "/api/notifications/badge?userId=demo-user"
)
foreach ($ep in $endpoints) {
  $url = "http://localhost:3001$ep"
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
    Write-Host ("OK  {0}  {1,-50}  {2} bytes" -f $r.StatusCode, $ep, $r.Content.Length)
  } catch {
    $msg = $_.Exception.Message.Split([Environment]::NewLine)[0]
    Write-Host ("ERR {0,-50}  {1}" -f $ep, $msg)
  }
}
