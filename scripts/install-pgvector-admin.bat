@echo off
:: Run this script as Administrator
:: Right click -> Run as administrator

echo ============================================
echo Tandem pgvector Extension Installer (Windows)
echo ============================================
echo.

set "PGROOT=C:\Program Files\PostgreSQL\16"
set "SOURCE=E:\Kimi Hermes\Hermes\pgvector-src\pgvector-0.8.0"

echo [1/5] Stopping PostgreSQL service...
net stop postgresql-x64-16

echo.
echo [2/5] Copying pgvector extension files...
copy /Y "%SOURCE%\vector.dll" "%PGROOT%\lib\" >nul
if %errorlevel% neq 0 (
  echo ERROR: Failed to copy vector.dll. Please run as Administrator.
  pause
  exit /b 1
)
copy /Y "%SOURCE%\vector.control" "%PGROOT%\share\extension\" >nul
copy /Y "%SOURCE%\sql\vector--0.8.0.sql" "%PGROOT%\share\extension\" >nul

echo [3/5] Starting PostgreSQL service...
net start postgresql-x64-16

echo.
echo [4/5] Creating extension...
"%PGROOT%\bin\psql.exe" -U tandem -d tandem -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo.
echo [5/5] Applying Prisma migration columns...
cd /d "E:\Kimi Hermes\Hermes"
set PGPASSWORD=tandem
"%PGROOT%\bin\psql.exe" -U tandem -d tandem -c "DO $$ BEGIN ALTER TABLE \"Material\" ADD COLUMN IF NOT EXISTS embedding vector(1536); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Material embedding column already exists or unavailable'; END $$;"
"%PGROOT%\bin\psql.exe" -U tandem -d tandem -c "DO $$ BEGIN ALTER TABLE \"MemoryEntry\" ADD COLUMN IF NOT EXISTS embedding vector(1536); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'MemoryEntry embedding column already exists or unavailable'; END $$;"

echo.
echo ============================================
echo pgvector installation completed!
echo ============================================
pause
