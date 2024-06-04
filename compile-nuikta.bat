pip install -r data/requirements_nuikta.txt
python -m nuitka --enable-plugin=tk-inter --follow-imports --disable-console --windows-icon-from-ico=data/icon.ico data/OpenLauncher.py