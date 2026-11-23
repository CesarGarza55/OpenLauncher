@echo off
setlocal EnableDelayedExpansion

REM ==============================================================================
REM OpenLauncher - Interactive Windows
REM High-performance builder for Windows distributions (NSIS, Portable, Directory)
REM ==============================================================================

cls
echo.
echo   OpenLauncher - Windows
echo  -------------------------------------------------------------
echo.

REM Detect package manager
set "PKG_RUN=npm run"
set "PKG_EXEC=npx"
where pnpm >nul 2>nul
if not errorlevel 1 (
    set "PKG_RUN=pnpm"
    set "PKG_EXEC=pnpm exec"
    echo  [i] Package manager: pnpm
) else (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Neither pnpm nor npm was found in PATH.
        exit /b 1
    )
    echo  [i] Package manager: npm
)

echo.
echo  Select target distribution:
echo   [1] Full Release (NSIS Installer + Portable .exe) [Recommended]
echo   [2] Portable EXE (.exe standalone)
echo   [3] NSIS Custom Installer (.exe with NSIS script)
echo   [4] Unpacked Directory (win-unpacked for quick testing)
echo   [5] Frontend Build Only (Vite dist)
echo.
set /p build_choice=" Select [1-5] (default: 1): "
if "%build_choice%"=="" set "build_choice=1"

cls
echo.
echo   OpenLauncher - Windows
echo  -------------------------------------------------------------
echo   [1/4] Cleaning previous builds...
echo.
if exist "release" (
    rmdir /s /q "release" 2>nul
    timeout /t 1 /nobreak >nul
)
if exist "dist" (
    rmdir /s /q "dist" 2>nul
)
echo   [OK] Clean completed.

cls
echo.
echo   OpenLauncher - Windows
echo  -------------------------------------------------------------
echo   [2/4] Compiling Frontend (Vite + React 19)...
echo.
call %PKG_RUN% build
if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    exit /b 1
)
echo   [OK] Frontend compiled into dist\

if "%build_choice%"=="5" (
    cls
    echo.
    echo   OpenLauncher - Windows
    echo  -------------------------------------------------------------
    echo   [OK] Frontend compilation complete!
    echo.
    exit /b 0
)

cls
echo.
echo   OpenLauncher - Windows
echo  -------------------------------------------------------------
echo   [3/4] Compiling Tauri Application (Release mode)...
echo.
call %PKG_EXEC% tauri build --no-bundle
if errorlevel 1 (
    echo [ERROR] Tauri build failed!
    exit /b 1
)

if not exist "release\win-unpacked" mkdir "release\win-unpacked"
copy /y "src-tauri\target\release\openlauncher.exe" "release\win-unpacked\OpenLauncher.exe" >nul

if "%build_choice%"=="4" (
    goto summary
)

if "%build_choice%"=="2" (
    copy /y "src-tauri\target\release\openlauncher.exe" "release\OpenLauncher-Portable-Windows.exe" >nul
    goto summary
)

REM Handle NSIS custom build or Full build
set "MAKENSIS_PATH="
if exist "C:\Program Files (x86)\NSIS\makensis.exe" set "MAKENSIS_PATH=C:\Program Files (x86)\NSIS\makensis.exe"
if exist "C:\Program Files\NSIS\makensis.exe" set "MAKENSIS_PATH=C:\Program Files\NSIS\makensis.exe"
if exist "%LOCALAPPDATA%\Programs\NSIS\makensis.exe" set "MAKENSIS_PATH=%LOCALAPPDATA%\Programs\NSIS\makensis.exe"

where makensis >nul 2>nul
if not errorlevel 1 (
    set "MAKENSIS_PATH=makensis"
)

if not "%MAKENSIS_PATH%"=="" (
    echo   [i] Compiling custom NSIS installer using script/installer.nsi...
    pushd script
    "%MAKENSIS_PATH%" installer.nsi
    popd
) else (
    echo   [!] NSIS not found in PATH, using tauri build --bundles nsis fallback...
    call %PKG_RUN% tauri build -- --bundles nsis
)

if "%build_choice%"=="1" (
    cls
    echo.
    echo   OpenLauncher - Windows
    echo  -------------------------------------------------------------
    echo   [4/4] Building portable executable...
    echo.
    copy /y "src-tauri\target\release\openlauncher.exe" "release\OpenLauncher-Portable-Windows.exe" >nul
)

:summary
cls
echo.
echo   OpenLauncher - Windows
echo  -------------------------------------------------------------
echo   [OK] Build completed successfully!
echo.
echo   Artifacts generated in release\ folder:
dir /b release\*.exe 2>nul
echo.

endlocal
