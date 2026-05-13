#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Tandem pgvector Extension Installer for Windows
.DESCRIPTION
    Copies pgvector binaries to PostgreSQL 16, creates the extension,
    and adds embedding columns to Material and MemoryEntry tables.
.NOTES
    Run as Administrator (right click -> Run with PowerShell).
#>

$ErrorActionPreference = "Stop"

$PGROOT   = "C:\Program Files\PostgreSQL\16"
$SOURCE   = "E:\Kimi Hermes\Hermes\pgvector-src\pgvector-0.8.0"
$ProjRoot = "E:\Kimi Hermes\Hermes"
$env:PGPASSWORD = "tandem"

function Write-Step($n, $total, $msg) {
    Write-Host "[$n/$total] $msg"
}

Write-Host "========================================"
Write-Host "Tandem pgvector Extension Installer"
Write-Host "========================================"

# 1. Stop PostgreSQL
Write-Step 1 5 "Stopping PostgreSQL service..."
Stop-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue

# 2. Copy files
Write-Step 2 5 "Copying pgvector extension files..."
Copy-Item -Path "$SOURCE\vector.dll"             -Destination "$PGROOT\lib\"          -Force
Copy-Item -Path "$SOURCE\vector.control"         -Destination "$PGROOT\share\extension\" -Force
Copy-Item -Path "$SOURCE\sql\vector--0.8.0.sql" -Destination "$PGROOT\share\extension\" -Force

# 3. Start PostgreSQL
Write-Step 3 5 "Starting PostgreSQL service..."
Start-Service -Name "postgresql-x64-16"

# 4. Create extension
Write-Step 4 5 "Creating extension..."
& "$PGROOT\bin\psql.exe" -U tandem -d tandem -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. Add embedding columns
Write-Step 5 5 "Applying Prisma migration columns..."
Set-Location $ProjRoot
& "$PGROOT\bin\psql.exe" -U tandem -d tandem -c 'DO $$ BEGIN ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS embedding vector(1536); EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''Material embedding column already exists or unavailable''; END $$;'
& "$PGROOT\bin\psql.exe" -U tandem -d tandem -c 'DO $$ BEGIN ALTER TABLE "MemoryEntry" ADD COLUMN IF NOT EXISTS embedding vector(1536); EXCEPTION WHEN OTHERS THEN RAISE NOTICE ''MemoryEntry embedding column already exists or unavailable''; END $$;'

Write-Host "========================================"
Write-Host "pgvector installation completed!"
Write-Host "========================================"
Read-Host "Press Enter to exit"
