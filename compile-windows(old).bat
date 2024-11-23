@echo off
echo WARNING: It is not recommended to use this method as it generates many false positives.
echo Do you want to continue? (y/n)
set /p continue=

if /i "%continue%" NEQ "y" (
    echo Operation cancelled.
    echo Press any key to exit...
    pause >nul
    exit
)

py -m pip install -r data/requirements_windows(old).txt
pyinstaller --clean --workpath ./temp --noconfirm --windowed --distpath ./ --icon "data\img\creeper.ico" ^
    --add-data "data\img;img/" ^
    --add-data "data\updater.py;." ^
    --add-data "data\variables.py;." ^
    --add-data "data\mod_manager.py;." ^
    --add-data "data\microsoft_auth.py;." ^
    --add-data "data\lang.py;." ^
    --add-data "data\run.py;." ^
    "data\OpenLauncher.py"
del OpenLauncher.spec
rmdir /s /q temp

echo OpenLauncher compiled successfully!
echo Press any key to exit...
pause >nul