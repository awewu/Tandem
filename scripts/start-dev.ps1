# Start dev server and capture output
$env:NODE_ENV = "development"
$env:NEXT_TELEMETRY_DISABLED = "1"

Write-Host "Starting Next.js dev server on port 3001..."
try {
    npm run dev 2>&1 | Tee-Object -FilePath "$PSScriptRoot\..\dev-output.log"
} catch {
    Write-Error "Failed to start: $_"
}
