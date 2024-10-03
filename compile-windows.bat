py -m pip install -r data/requirements_windows.txt
pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ --icon "data\img\creeper.ico" ^
    --add-data "data\img;img/" ^
    --add-data "data\updater.py;." ^
    --add-data "data\variables.py;." ^
    "data\OpenLauncher.py"
del OpenLauncher.spec
rmdir /s /q temp