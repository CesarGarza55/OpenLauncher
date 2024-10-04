#!/bin/bash
set -e

# Create a virtual environment if it doesn't exist
VENV_DIR="venv"
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
else
    python3 -m venv "$VENV_DIR"
    # Activate the virtual environment
    source "$VENV_DIR/bin/activate"
fi

# Check if pip is installed in the virtual environment
if ! command -v pip &> /dev/null; then
    echo "pip is not installed in the virtual environment"
    exit 1
fi

# Install dependencies
pip install -r data/requirements_linux.txt

# Install the necessary libraries
sudo apt install -y libxcb-xinerama0 libxcb1 libx11-xcb1 libxrender1 libfontconfig1
sudo apt-get install -y --reinstall libqt5widgets5 libqt5gui5 libqt5core5a

# Export the QT_QPA_PLATFORM variable
export QT_QPA_PLATFORM=xcb

# Compile the application
pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ \
    --add-data data/img:img/ \
    --add-data data/updater.py:. \
    --add-data data/variables.py:. \
    --name OpenLauncher.bin \
    data/OpenLauncher.py

# Remove the temporary files
rm OpenLauncher.bin.spec
rm -rf temp

# Deactivate the virtual environment
deactivate