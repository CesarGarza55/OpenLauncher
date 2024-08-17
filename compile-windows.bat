pip install -r data/requirements_windows.txt
pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ --icon "data\img\icon.ico" --add-data "data\img;img/" "data\OpenLauncher.py"
del OpenLauncher.spec
rmdir /s /q temp