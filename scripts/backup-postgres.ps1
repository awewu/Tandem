<#
  Hermes / Tandem · PostgreSQL backup script (Windows / PowerShell variant)

  与 backup-postgres.sh 等价. 用于 Windows 服务器 (生产更推荐 sh 版).

  用法 (Task Scheduler):
    powershell.exe -File E:\Hermes\scripts\backup-postgres.ps1

  环境变量同 .sh 版本.
#>

$ErrorActionPreference = 'Stop'

$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { 'C:\Backups\Hermes' }
$RetainDays = if ($env:BACKUP_RETAIN_DAYS) { [int]$env:BACKUP_RETAIN_DAYS } else { 30 }
$S3Prefix = if ($env:S3_PREFIX) { $env:S3_PREFIX } else { 'hermes-tandem' }
$AwsRegion = if ($env:AWS_REGION) { $env:AWS_REGION } else { 'cn-north-1' }

if (-not $env:DATABASE_URL) {
  Write-Error '[backup] FATAL: DATABASE_URL not set'
  exit 1
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$Ts = (Get-Date -Format 'yyyyMMdd-HHmmss')
$HostSafe = ($env:COMPUTERNAME -replace '[^A-Za-z0-9]', '-').Trim('-')
$File = Join-Path $BackupDir "hermes-$HostSafe-$Ts.sql.gz"

Write-Host "[backup] $(Get-Date -Format o) start, output=$File"

# pg_dump → gzip 管道. 需要 pg_dump + 7z (或 gzip.exe) 在 PATH.
$tempSql = [System.IO.Path]::ChangeExtension($File, '.sql')
& pg_dump --no-owner --no-privileges --clean --if-exists --format=plain --file=$tempSql $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) {
  Write-Error '[backup] FATAL: pg_dump failed'
  Remove-Item -ErrorAction SilentlyContinue $tempSql
  exit 1
}

# 用 .NET GzipStream 压缩 (避免依赖 7z)
$inputStream = [System.IO.File]::OpenRead($tempSql)
$outputStream = [System.IO.File]::Create($File)
$gzip = New-Object System.IO.Compression.GzipStream($outputStream, [System.IO.Compression.CompressionLevel]::Optimal)
$inputStream.CopyTo($gzip)
$gzip.Dispose()
$outputStream.Dispose()
$inputStream.Dispose()
Remove-Item $tempSql

$size = [math]::Round((Get-Item $File).Length / 1MB, 1)
Write-Host "[backup] pg_dump ok, size=${size}MB"

# SHA256 校验
$hash = (Get-FileHash -Algorithm SHA256 $File).Hash.ToLower()
Set-Content -NoNewline -Path "$File.sha256" -Value $hash
Write-Host "[backup] sha256=$hash"

# S3 上传 (可选)
if ($env:S3_BUCKET) {
  if (Get-Command aws -ErrorAction SilentlyContinue) {
    Write-Host "[backup] uploading to s3://$env:S3_BUCKET/$S3Prefix/"
    & aws s3 cp $File "s3://$env:S3_BUCKET/$S3Prefix/" --region $AwsRegion --storage-class STANDARD_IA
    if ($LASTEXITCODE -ne 0) { Write-Warning '[backup] S3 upload failed'; exit 2 }
    & aws s3 cp "$File.sha256" "s3://$env:S3_BUCKET/$S3Prefix/" --region $AwsRegion
  } else {
    Write-Warning '[backup] S3_BUCKET set but aws CLI not found, skipping upload'
  }
}

# 清理过期
Get-ChildItem -Path $BackupDir -Filter 'hermes-*.sql.gz*' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetainDays) } |
  Remove-Item -Force

Write-Host "[backup] $(Get-Date -Format o) done"
