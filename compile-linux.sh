#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Create a virtual environment if it doesn't exist
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}python3 is not installed and will be installed now${NC}"
    sudo apt install -y python3
fi

if ! dpkg -l | grep -q python3-venv; then
    echo -e "${YELLOW}python3-venv is not installed and will be installed now${NC}"
    sudo apt install -y python3-venv
fi

VENV_DIR="venv"
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${GREEN}Creating virtual environment...${NC}"
    python3 -m venv "$VENV_DIR"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create virtual environment${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}Virtual environment already exists${NC}"
fi

# Check if the virtual environment was created successfully
if [ ! -f "$VENV_DIR/bin/activate" ]; then
    echo -e "${RED}Virtual environment was not created... Exiting${NC}"
    exit 1
fi

# Activate the virtual environment
echo -e "${GREEN}Activating virtual environment...${NC}"
source "$VENV_DIR/bin/activate"

# Check if pip is installed in the virtual environment
if ! command -v pip &> /dev/null; then
    echo -e "${RED}pip is not installed in the virtual environment... Exiting${NC}"
    exit 1
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
python3 -m pip install -r data/requirements_linux.txt

# Install the necessary libraries if not already installed
LIBRARIES=("libxcb-xinerama0" "libxcb1" "libx11-xcb1" "libxrender1" "libfontconfig1" "libqt5widgets5" "libqt5gui5" "libqt5core5a" "libxcb-cursor0")

for LIB in "${LIBRARIES[@]}"; do
    if ! dpkg -l | grep -q "$LIB"; then
        echo -e "${GREEN}Installing $LIB...${NC}"
        sudo apt install -y "$LIB"
    else
        echo -e "${GREEN}$LIB is already installed${NC}"
    fi
done

# Export the QT_QPA_PLATFORM variable
export QT_QPA_PLATFORM=xcb

# Compile the application
echo -e "${GREEN}Compiling the application...${NC}"
pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ \
    --add-data data/img:img/ \
    --add-data data/updater.py:. \
    --add-data data/variables.py:. \
    --add-data data/mod_manager.py:. \
    --add-data data/microsoft_auth.py:. \
    --add-data data/lang.py:. \
    --add-data data/run.py:. \
    --name OpenLauncher.bin \
    data/OpenLauncher.py

# Remove the temporary files
echo -e "${GREEN}Cleaning up...${NC}"
rm OpenLauncher.bin.spec
rm -rf temp

# Deactivate the virtual environment
echo -e "${GREEN}Deactivating virtual environment...${NC}"
deactivate