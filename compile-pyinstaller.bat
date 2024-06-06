pip install -r data/requirements_pyinstaller.txt
pyinstaller --clean --workpath ./temp --onefile --windowed --icon data/icon.ico --distpath ./ --noconfirm data/OpenLauncher.py