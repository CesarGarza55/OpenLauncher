#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Detect host architecture
HOST_ARCH=$(uname -m)
if [ "$HOST_ARCH" = "arm64" ]; then
    DEFAULT_ARCH="arm64"
    ARCH_NAME="Apple Silicon (ARM64)"
else
    DEFAULT_ARCH="x64"
    ARCH_NAME="Intel (x64)"
fi

clear
echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}         OpenLauncher - macOS Build           ${NC}"
echo -e "${CYAN}==============================================${NC}"
echo -e "Detected system architecture: ${GREEN}${ARCH_NAME}${NC}\n"

echo "Select target architecture:"
echo "1) Current Mac architecture (${ARCH_NAME})"
echo "2) Apple Silicon (ARM64 - M1/M2/M3/M4)"
echo "3) Intel (x64)"
echo "4) Universal (Apple Silicon + Intel)"
read -p "Enter choice [1-4] (default: 1): " arch_choice
arch_choice=${arch_choice:-1}

TARGET_ARCH="$DEFAULT_ARCH"
case $arch_choice in
    1) TARGET_ARCH="$DEFAULT_ARCH" ;;
    2) TARGET_ARCH="arm64" ;;
    3) TARGET_ARCH="x64" ;;
    4) TARGET_ARCH="universal" ;;
    *)
        echo -e "${RED}Invalid architecture choice. Using ${DEFAULT_ARCH}.${NC}"
        TARGET_ARCH="$DEFAULT_ARCH"
        ;;
esac

echo ""
echo "Select build type:"
echo "1) DMG Installer (.dmg)"
echo "2) ZIP Archive (.zip)"
echo "3) Both DMG and ZIP"
echo "4) Only install dependencies"
read -p "Enter choice [1-4] (default: 1): " build_choice
build_choice=${build_choice:-1}

# Dependency checker
check_deps() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}Node.js is not installed! Please install Node.js 18+ (e.g. via brew install node).${NC}"
        exit 1
    fi
    if ! command -v npm >/dev/null 2>&1; then
        echo -e "${RED}npm is not installed! Please install npm.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Prerequisites satisfied!${NC}"
    echo -e "${YELLOW}Installing project dependencies (npm install)...${NC}"
    npm install
    echo -e "${GREEN}Dependencies installed!${NC}"
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
    echo -e "${GREEN}Renderer built successfully!${NC}"
}

# Package application with electron-builder
build_app() {
    local target_type="$1"
    local arch="$2"

    echo -e "${GREEN}Packaging OpenLauncher for macOS (${target_type} - ${arch})...${NC}"
    if [ "$arch" = "universal" ]; then
        npx electron-builder --mac "$target_type" --universal
    else
        npx electron-builder --mac "$target_type" --"$arch"
    fi
    echo -e "${GREEN}Package created successfully!${NC}"
}

# Execution flow
if [ "$build_choice" -eq 4 ]; then
    check_deps
    echo -e "${GREEN}Setup completed!${NC}"
    exit 0
fi

check_deps
clean_builds
build_renderer

case $build_choice in
    1)
        build_app dmg "$TARGET_ARCH"
        ;;
    2)
        build_app zip "$TARGET_ARCH"
        ;;
    3)
        build_app dmg "$TARGET_ARCH"
        build_app zip "$TARGET_ARCH"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting...${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}==============================================${NC}"
echo -e "${GREEN} Build completed! Check the 'release/' folder. ${NC}"
echo -e "${GREEN}==============================================${NC}"
