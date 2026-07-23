$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:3000'

function Probe {
    param($p, $m='GET', $body=$null, $label='')
    Write-Host ""
    Write-Host "=== $label : $m $p ===" -ForegroundColor Cyan
    if ($body) { Write-Host ("Body: " + $body) -ForegroundColor DarkGray }
    try {
        $params = @{ Uri="$base$p"; Method=$m; UseBasicParsing=$true; TimeoutSec=10; ErrorAction='Stop' }
        if ($body) { $params.ContentType='application/json'; $params.Body=$body }
        $r = Invoke-WebRequest @params
        Write-Host ("OK " + $r.StatusCode) -ForegroundColor Green
        $sample = $r.Content.Substring(0, [Math]::Min(400, $r.Content.Length))
        Write-Host $sample
    } catch {
        $resp = $_.Exception.Response
        $code = if ($resp) { $resp.StatusCode.value__ } else { 'NET' }
        Write-Host ("FAIL " + $code) -ForegroundColor Red
        if ($resp) {
            try {
                $stream = $resp.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errBody = $reader.ReadToEnd()
                Write-Host $errBody -ForegroundColor Yellow
            } catch { Write-Host ("(could not read body: " + $_.Exception.Message + ")") -ForegroundColor DarkRed }
        } else {
            Write-Host $_.Exception.Message -ForegroundColor DarkRed
        }
    }
}

Probe '/api/house-types/stats' 'GET' $null 'house-types stats'
Probe '/api/solution-match' 'POST' '{"diagnosis":{"painPoints":["hot"]},"roomProfile":{"area":120}}' 'solution-match (simple)'
Probe '/api/solution-match' 'POST' '{"diagnosis":{"painPoints":["summer-hot","winter-cold"],"severity":"high"},"roomProfile":{"area":120,"city":"shanghai","houseType":"3BR","budget":80000}}' 'solution-match (full)'
Probe '/api/design/water-system' 'POST' '{"houseType":"3BR","area":120,"residents":3}' 'water-system'
Probe '/api/design/water-system' 'POST' '{"houseType":"3室2厅","area":120,"residents":3,"city":"shanghai","budget":80000}' 'water-system (CN)'
Probe '/api/design/air-conditioning' 'POST' '{"houseType":"3BR","area":120,"city":"shanghai"}' 'air-conditioning'
Probe '/api/design/air-conditioning' 'POST' '{"houseType":"3室2厅","area":120,"city":"shanghai","rooms":[{"name":"living","area":30}]}' 'air-conditioning (CN)'
Probe '/api/design/five-constant' 'POST' '{"houseType":"3BR","area":120,"city":"shanghai"}' 'five-constant'
