@echo off
py -m pip install -r data/requirements_windows.txt
python compile.py build

echo OpenLauncher compiled successfully!
echo You can create the installer with NSIS by running the compile.nsi file with NSIS.
echo Press any key to exit...
pause >nul