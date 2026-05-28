$body = @{ email='admin@tandem.local'; password='Test1234!!' } | ConvertTo-Json
try {
  $r = Invoke-WebRequest -Uri http://localhost:3001/api/auth/login -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
  Write-Host ('STATUS=' + $r.StatusCode)
  Write-Host $r.Content
} catch {
  Write-Host ('ERR ' + $_.Exception.Message)
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}
