#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Clear the terminal
clear

# Ask for the OS type (Debian, Fedora, or Arch)
echo "Select your operating system:"
echo "1) Debian-based systems (Ubuntu, Linux Mint, etc.)"
echo "2) Fedora-based systems"
echo "3) Arch Linux"
echo "4) Other (generate portable tar.gz)"
read -p "Enter the number of your choice: " os_choice

# Clear the terminal
clear

if [ "$os_choice" -eq 1 ]; then
    echo -e "${BLUE}You selected Debian-based systems.${NC}"
elif [ "$os_choice" -eq 2 ]; then
    echo -e "${BLUE}You selected Fedora-based systems.${NC}"
elif [ "$os_choice" -eq 3 ]; then
    echo -e "${BLUE}You selected Arch Linux.${NC}"
elif [ "$os_choice" -eq 4 ]; then
    echo -e "${BLUE}You selected Other (portable tar.gz).${NC}"
fi

echo "Select an option:"
echo "1) Compile the application"
echo "2) Only install dependencies"
if [ "$os_choice" -eq 1 ]; then
    echo "3) Create .deb package only"
fi
read -p "Enter the number of your choice: " action_choice

# Clear the terminal
clear

if [ "$action_choice" -eq 1 ]; then
    echo -e "${BLUE}You selected to compile the application.${NC}"
elif [ "$action_choice" -eq 2 ]; then
    echo -e "${BLUE}You selected to install dependencies.${NC}"
elif [ "$action_choice" -eq 3 ]; then
    echo -e "${BLUE}You selected to create a .deb package only.${NC}"
fi

# Function to install dependencies for Debian-based systems
install_deps_debian() {
    echo -e "${YELLOW}Installing dependencies for Debian-based systems...${NC}"
    sudo apt update
    sudo apt install -y npm nodejs
    echo -e "${GREEN}Dependencies installed!${NC}"
    echo -e "${YELLOW}Installing project dependencies...${NC}"
    npm install
    echo -e "${GREEN}Project dependencies installed!${NC}"
}

# Function to install dependencies for Fedora-based systems
install_deps_fedora() {
    echo -e "${YELLOW}Installing dependencies for Fedora-based systems...${NC}"
    sudo dnf install -y npm nodejs
    echo -e "${GREEN}Dependencies installed!${NC}"
    echo -e "${YELLOW}Installing project dependencies...${NC}"
    npm install
    echo -e "${GREEN}Project dependencies installed!${NC}"
}

# Function to install dependencies for Arch Linux
install_deps_arch() {
    echo -e "${YELLOW}Installing dependencies for Arch Linux...${NC}"
    sudo pacman -Syu --noconfirm npm nodejs
    echo -e "${GREEN}Dependencies installed!${NC}"
    echo -e "${YELLOW}Installing project dependencies...${NC}"
    npm install
    echo -e "${GREEN}Project dependencies installed!${NC}"
}

# Function to install dependencies for Other systems
install_deps_other() {
    echo -e "${YELLOW}Please install npm and nodejs using your package manager.${NC}"
    echo "Example commands:"
    echo "  - openSUSE: sudo zypper install npm nodejs"
    echo "  - Gentoo: sudo emerge npm nodejs"
}

# Clean previous builds
clean_builds() {
    echo -e "${YELLOW}Cleaning previous builds...${NC}"
    rm -rf release
    rm -rf dist
    echo -e "${GREEN}Clean completed!${NC}"
}

# Build renderer (Vite)
build_renderer() {
    echo -e "${GREEN}Building renderer (Vite)...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Vite build failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Renderer built successfully!${NC}"
}

# Build for Debian (.deb)
build_debian() {
    echo -e "${GREEN}Building .deb package for Debian-based systems...${NC}"
    npx electron-builder --linux deb
    if [ $? -ne 0 ]; then
        echo -e "${RED}.deb build failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}.deb package built successfully!${NC}"
}

# Build portable (tar.gz) for Arch/Fedora/Other
build_portable() {
    echo -e "${GREEN}Building portable tar.gz package for Linux...${NC}"
    npx electron-builder --linux tar.gz
    if [ $? -ne 0 ]; then
        echo -e "${RED}Portable build failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Portable package built successfully!${NC}"
}

# Main script logic
case $os_choice in
    1)
        # Debian-based
        if [ "$action_choice" -eq 1 ]; then
            install_deps_debian
            clean_builds
            build_renderer
            build_debian
            echo -e "${GREEN}Build completed! Check the release/ folder for OpenLauncher.deb${NC}"
        elif [ "$action_choice" -eq 2 ]; then
            install_deps_debian
        elif [ "$action_choice" -eq 3 ]; then
            clean_builds
            build_renderer
            build_debian
            echo -e "${GREEN}Build completed! Check the release/ folder for OpenLauncher.deb${NC}"
        else
            echo -e "${RED}Invalid choice. Exiting...${NC}"
            exit 1
        fi
        ;;
    2)
        # Fedora-based
        if [ "$action_choice" -eq 1 ]; then
            install_deps_fedora
            clean_builds
            build_renderer
            build_portable
            echo -e "${GREEN}Build completed! Check the release/ folder for OpenLauncher-Portable-Linux.tar.gz${NC}"
        elif [ "$action_choice" -eq 2 ]; then
            install_deps_fedora
        else
            echo -e "${RED}Invalid choice. Exiting...${NC}"
            exit 1
        fi
        ;;
    3)
        # Arch Linux
        if [ "$action_choice" -eq 1 ]; then
            install_deps_arch
            clean_builds
            build_renderer
            build_portable
            echo -e "${GREEN}Build completed! Check the release/ folder for OpenLauncher-Portable-Linux.tar.gz${NC}"
        elif [ "$action_choice" -eq 2 ]; then
            install_deps_arch
        else
            echo -e "${RED}Invalid choice. Exiting...${NC}"
            exit 1
        fi
        ;;
    4)
        # Other
        if [ "$action_choice" -eq 1 ]; then
            install_deps_other
            clean_builds
            build_renderer
            build_portable
            echo -e "${GREEN}Build completed! Check the release/ folder for OpenLauncher-Portable-Linux.tar.gz${NC}"
        elif [ "$action_choice" -eq 2 ]; then
            install_deps_other
        else
            echo -e "${RED}Invalid choice. Exiting...${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}Invalid operating system choice. Exiting...${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}Done!${NC}"
