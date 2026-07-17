$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$marker = Join-Path $root ".dev-memory"
$next = Join-Path $root "node_modules\.bin\next.cmd"

Set-Content -LiteralPath $marker -Value "1"
$env:NEXT_DIST_DIR = ".next-dev"

try {
  & $next dev -p 3005
} finally {
  Remove-Item -LiteralPath $marker -ErrorAction SilentlyContinue
}
