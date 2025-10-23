@echo off
if exist output_build rmdir /s /q output_build
python -m pip install -r data/requirements_windows.txt
python compile.py build

echo OpenLauncher compiled successfully!
echo You can create the installer with NSIS by running the compile.nsi file with NSIS.
echo Press any key to exit...
pause >nul