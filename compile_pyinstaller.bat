pip install -r data/requirements_pyinstaller.txt
pyinstaller data/OpenLauncher.py --workpath ./temp --specpath ./temp  --onefile --windowed --icon data/icon.ico --distpath ./ --noconfirm
