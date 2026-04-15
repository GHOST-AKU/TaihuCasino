@echo off
setlocal

cd /d "%~dp0"

echo [TaihuCasino] Working directory: %cd%

where corepack >nul 2>nul
if errorlevel 1 (
  echo [Error] corepack not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [TaihuCasino] node_modules not found. Installing dependencies...
  call corepack pnpm install
  if errorlevel 1 (
    echo [Error] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo [TaihuCasino] Opening browser...
start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:3000'"

echo [TaihuCasino] Starting Next.js dev server...
call corepack pnpm dev --hostname 127.0.0.1

if errorlevel 1 (
  echo [Error] Dev server exited with an error.
  pause
  exit /b 1
)

endlocal
