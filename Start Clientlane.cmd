@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js LTS from https://nodejs.org, then open this launcher again.
) else (
  node scripts/local.mjs
)
pause
