# 修复 P1014: Prisma 元数据与实际表状态不一致
# 执行方式: .\scripts\fix-pg.ps1

$ErrorActionPreference = "Stop"
Set-Location "E:\Hermes"

Write-Host "=== Step 1: Drop & Recreate database ===" -ForegroundColor Green
$dropResult = docker exec tandem-postgres psql -U tandem -d postgres -c "DROP DATABASE IF EXISTS tandem WITH (FORCE);" 2>&1
Write-Host $dropResult
$createResult = docker exec tandem-postgres psql -U tandem -d postgres -c "CREATE DATABASE tandem;" 2>&1
Write-Host $createResult
$grantResult = docker exec tandem-postgres psql -U tandem -d tandem -c "GRANT ALL ON SCHEMA public TO tandem;" 2>&1
Write-Host $grantResult

Write-Host "=== Step 2: Prisma DB Push --force-reset ===" -ForegroundColor Green
$npxResult = & npx prisma db push --force-reset 2>&1
Write-Host $npxResult

Write-Host "=== Step 3: Verify tables ===" -ForegroundColor Green
$tables = docker exec tandem-postgres psql -U tandem -d tandem -c "\dt" 2>&1
Write-Host $tables

Write-Host "=== Done ===" -ForegroundColor Green
