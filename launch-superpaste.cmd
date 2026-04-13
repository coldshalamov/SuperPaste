@echo off
setlocal
pushd "%~dp0"

set "APP_EXE=%~dp0src-tauri\target\release\superpaste.exe"
set "FORCE_DEV_ARG=0"
for %%A in (%*) do (
  if /I "%%~A"=="--dev" set "FORCE_DEV_ARG=1"
)

if exist "%APP_EXE%" if /I not "%SUPERPASTE_FORCE_DEV%"=="1" if /I not "%FORCE_DEV_ARG%"=="1" if /I not "%SUPERPASTE_LAUNCHER_DRY_RUN%"=="1" (
  start "" "%APP_EXE%"
  popd
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install Node.js, then run launch-superpaste.cmd again.
  if /I not "%SUPERPASTE_LAUNCHER_NO_PAUSE%"=="1" pause
  popd
  exit /b 1
)

node "%~dp0scripts\launch-superpaste.js" %*
set "ERR=%errorlevel%"
if not "%ERR%"=="0" if /I not "%SUPERPASTE_LAUNCHER_NO_PAUSE%"=="1" pause

popd
exit /b %ERR%
