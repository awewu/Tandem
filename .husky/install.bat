@echo off
:: 🔨 Hammer Husky Installation Script for Windows
:: Usage: .husky\install.bat

echo 🔨 Installing Hammer Git Hooks...

:: Check if .git exists
if not exist .git (
    echo ❌ Error: Not a git repository
    exit /b 1
)

:: Create hooks directory if not exists
if not exist .git\hooks mkdir .git\hooks

:: Copy pre-commit hook
echo 📋 Installing pre-commit hook...
copy /Y .husky\pre-commit .git\hooks\pre-commit >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Warning: Could not copy pre-commit hook
) else (
    echo ✅ pre-commit hook installed
)

:: Copy pre-push hook
echo 📋 Installing pre-push hook...
copy /Y .husky\pre-push .git\hooks\pre-push >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Warning: Could not copy pre-push hook
) else (
    echo ✅ pre-push hook installed
)

echo.
echo 🎉 Hammer Git Hooks installed successfully!
echo.
echo 📖 Usage:
echo    - pre-commit: Runs fast validation (L1-L3) before each commit
echo    - pre-push:  Runs full validation (L1-L9) before each push
echo.
echo 💡 To bypass hooks in emergency:
echo    git commit --no-verify
echo    git push --no-verify
