#!/bin/bash

pip3 install -r data/requirements_linux.txt

~/.local/bin/pyinstaller --clean --workpath ./temp --onefile --windowed --distpath ./ --noconfirm data/OpenLauncher.py