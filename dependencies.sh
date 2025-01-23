#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Ask for the OS type (Debian or Fedora)
echo "Select your operating system:"
echo "1) Debian-based systems"
echo "2) Fedora-based systems"
read -p "Enter the number of your choice: " os_choice

# Function to install dependencies for Debian-based systems
install_deps_debian() {
    echo -e "${YELLOW}Installing dependencies for Debian-based systems...${NC}"
    sudo apt update

    # Install required dependencies
    sudo apt install -y python3 python3-venv python3-tk default-jre \
        libxcb-xinerama0 libxcb1 libx11-xcb1 libxrender1 libfontconfig1 \
        libqt5widgets5 libqt5gui5 libqt5core5a libxcb-cursor0

    # Install python dependencies
    python3 -m pip install -r data/requirements_linux.txt
}

# Function to install dependencies for Fedora-based systems
install_deps_fedora() {
    echo -e "${YELLOW}Installing dependencies for Fedora-based systems...${NC}"

    # Install required dependencies
    sudo dnf install -y python3 python3-virtualenv python3-tkinter java-11-openjdk \
        libxcb libX11-xcb libXrender fontconfig qt5-qtbase-gui qt5-qtbase xcb-util-cursor

    # Install python dependencies
    python3 -m pip install -r data/requirements_linux.txt
}

# Main script logic
case $os_choice in
    1)
        echo -e "${GREEN}You selected Debian-based systems.${NC}"
        install_deps_debian
        ;;
    2)
        echo -e "${GREEN}You selected Fedora-based systems.${NC}"
        install_deps_fedora
        ;;
    *)
        echo -e "${RED}Invalid operating system choice. Exiting...${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Dependencies installed successfully!${NC}"
echo -e "${BLUE}You can now compile the application using the compile-linux.sh script or download the pre-compiled binaries from the releases page.${NC}"
echo -e "${BLUE}https://github.com/CesarGarza55/OpenLauncher/releases/latest${NC}"