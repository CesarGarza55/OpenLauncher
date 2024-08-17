#!/bin/bash
pip3 install -r data/requirements_linux.txt
sudo apt install libxcb-xinerama0 libxcb1 libx11-xcb1 libxrender1 libfontconfig1
export QT_QPA_PLATFORM=xcb
sudo apt-get install --reinstall libqt5widgets5 libqt5gui5 libqt5core5a
~/.local/bin/pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ --icon "data/img/icon.ico" --add-data "data/img:img/" "data/OpenLauncher.py"
rm OpenLauncher.spec
rm -rf temp
