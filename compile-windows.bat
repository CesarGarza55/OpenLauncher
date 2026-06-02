@echo off
setlocal

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found in PATH.
  exit /b 1
)

echo [0/4] Cleaning previous builds...
if exist "release" (
  rmdir /s /q "release" 2>nul
  timeout /t 2 /nobreak >nul
)

echo [1/4] Building renderer (Vite)...
call npm run build
if errorlevel 1 exit /b 1

echo [2/4] Building Electron app folder (win-unpacked)...
call npx electron-builder --win --dir
if errorlevel 1 exit /b 1

echo [3/4] Building NSIS installer with custom script...
cd script

REM Try to find makensis in common NSIS installation paths
set "MAKENSIS_PATH="
if exist "C:\Program Files (x86)\NSIS\makensis.exe" set "MAKENSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
if exist "C:\Program Files\NSIS\makensis.exe" set "MAKENSIS_PATH=C:\Program Files\NSIS\makensis.exe"
if exist "%LOCALAPPDATA%\Programs\NSIS\makensis.exe" set "MAKENSIS_PATH=%LOCALAPPDATA%\Programs\NSIS\makensis.exe"

REM Also check PATH
where makensis >nul 2>nul
if not errorlevel 1 (
  set "MAKENSIS_PATH=makensis"
)

if "%MAKENSIS_PATH%"=="" (
  echo makensis was not found in PATH or common installation paths.
  echo Please compile manually: Open NSIS GUI, load script\compile-electron.nsi and compile.
  cd ..
  exit /b 1
)

"%MAKENSIS_PATH%" compile-electron.nsi
if errorlevel 1 (
  cd ..
  exit /b 1
)
cd ..

echo [4/4] Building portable version (single .exe without installation)...
call npx electron-builder --win portable
if errorlevel 1 exit /b 1

echo.
echo Done. Builds created in release/ folder:
echo - OpenLauncher.exe (NSIS installer)
echo - OpenLauncher-Portable-Windows.exe (portable)

endlocal
