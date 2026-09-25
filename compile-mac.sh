#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenLauncher - Interactive macOS 
# High-performance builder for macOS distributions (DMG, ZIP, Universal)
# ==============================================================================

# ANSI Color Palette
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
BRIGHT_GREEN='\033[1;32m'
BLUE='\033[0;34m'
BRIGHT_BLUE='\033[1;34m'
CYAN='\033[0;36m'
BRIGHT_CYAN='\033[1;36m'
YELLOW='\033[0;33m'
BRIGHT_YELLOW='\033[1;33m'
RED='\033[0;31m'
BRIGHT_RED='\033[1;31m'
MAGENTA='\033[0;35m'
BRIGHT_MAGENTA='\033[1;35m'
NC='\033[0m'

# Helpers
print_banner() {
    clear
    echo ""
    echo -e "  ${BRIGHT_CYAN}◆${NC} ${BOLD}OpenLauncher${NC} ${DIM}•${NC} ${BRIGHT_BLUE}macOS${NC}"
    echo -e "  ${DIM}───────────────────────────────────────────────────────${NC}"
    echo ""
}

print_step() {
    local step="$1"
    local total="$2"
    local title="$3"
    clear
    print_banner
    echo -e " ${BOLD}Target Architecture:${NC} ${GREEN}${ARCH_LABEL}${NC}\n"
    echo -e "${BRIGHT_BLUE}╭─ [${step}/${total}] ${BOLD}${title}${NC}"
}

print_success() {
    echo -e "${BRIGHT_GREEN}╰─  $1${NC}"
}

print_error() {
    echo -e "${BRIGHT_RED}╰─  $1${NC}"
}

print_info() {
    echo -e "   ${CYAN}ℹ${NC}  $1"
}

print_warn() {
    echo -e "   ${BRIGHT_YELLOW}⚠${NC}  $1"
}

# Detect System
detect_system() {
    HOST_ARCH=$(uname -m)
    MACOS_VER=$(sw_vers -productVersion 2>/dev/null || echo "macOS")
    
    if [ "$HOST_ARCH" = "arm64" ]; then
        DEFAULT_ARCH="arm64"
        ARCH_LABEL="Apple Silicon (ARM64)"
    else
        DEFAULT_ARCH="x64"
        ARCH_LABEL="Intel (x64)"
    fi

    # Detect package manager
    if command -v pnpm >/dev/null 2>&1; then
        PKG_MGR="pnpm"
        PKG_RUN="pnpm"
        PKG_EXEC="pnpm exec"
    elif command -v npm >/dev/null 2>&1; then
        PKG_MGR="npm"
        PKG_RUN="npm run"
        PKG_EXEC="npx"
    else
        PKG_MGR="none"
    fi
}

# Pre-flight environment check
check_prerequisites() {
    print_step 1 4 "Checking Environment & Dependencies"
    
    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js is not installed! Please install Node.js 18+ (brew install node)"
        exit 1
    fi
    
    NODE_VER=$(node -v)
    print_info "Node.js:        ${GREEN}${NODE_VER}${NC}"
    print_info "Host System:    ${GREEN}${MACOS_VER} (${ARCH_LABEL})${NC}"
    
    if [ "$PKG_MGR" = "none" ]; then
        print_error "Neither pnpm nor npm was found in PATH!"
        exit 1
    fi
    
    print_info "Package Mgr:    ${GREEN}${PKG_MGR}${NC}"
    
    print_info "Verifying dependencies..."
    if [ "$PKG_MGR" = "pnpm" ]; then
        pnpm install --silent
    else
        npm install --silent
    fi
    print_success "Prerequisites and dependencies verified"
}

# Clean old artifacts
clean_build_cache() {
    print_step 2 4 "Cleaning Workspace & Release Cache"
    rm -rf release dist
    print_success "Artifacts directory cleaned"
}

# Build renderer with Vite
compile_renderer() {
    print_step 3 4 "Compiling Frontend (Vite + React 19)"
    $PKG_RUN build
    print_success "Vite bundle compiled into dist/"
}

# Package macOS target with electron-builder
package_electron() {
    local target="$1"
    local arch="$2"
    
    print_step 4 4 "Packaging macOS Binary (${target} - ${arch})"
    
    if [ "$arch" = "universal" ]; then
        $PKG_EXEC electron-builder --mac "$target" --universal
    else
        $PKG_EXEC electron-builder --mac "$target" --"$arch"
    fi
    
    print_success "macOS build packaging finished"
}

# Display build summary
show_summary() {
    clear
    print_banner
    echo -e "  ${BRIGHT_GREEN}✓${NC} ${BOLD}Build completed successfully!${NC}"
    echo -e "  ${DIM}───────────────────────────────────────────────────────${NC}"
    echo ""
    echo -e "  ${BOLD}Artifacts directory:${NC} ${CYAN}$(pwd)/release${NC}"
    echo ""
    
    if [ -d "release" ]; then
        echo -e "  ${DIM}Generated packages:${NC}"
        find release -maxdepth 1 -type f \( -name "*.dmg" -o -name "*.zip" \) -exec ls -lh {} + 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'
    fi
    
    echo ""
}

# Interactive Menu
detect_system
print_banner

echo -e " ${BOLD}System Configuration:${NC}"
echo -e "   • OS:           ${CYAN}${MACOS_VER}${NC}"
echo -e "   • Architecture: ${GREEN}${ARCH_LABEL}${NC}"
echo -e "   • Package Mgr:  ${MAGENTA}${PKG_MGR}${NC}\n"

echo -e " ${BOLD}Step 1/2: Select Target Architecture:${NC}"
echo -e "   ${BRIGHT_CYAN}[1]${NC} Current Mac (${ARCH_LABEL}) ${DIM}[Recommended]${NC}"
echo -e "   ${BRIGHT_CYAN}[2]${NC} Apple Silicon (ARM64 - M1/M2/M3/M4)"
echo -e "   ${BRIGHT_CYAN}[3]${NC} Intel (x64)"
echo -e "   ${BRIGHT_CYAN}[4]${NC} Universal Binary (Apple Silicon + Intel)"
read -p " Select [1-4] (default: 1): " arch_choice
arch_choice=${arch_choice:-1}

TARGET_ARCH="$DEFAULT_ARCH"
case $arch_choice in
    1) TARGET_ARCH="$DEFAULT_ARCH" ;;
    2) TARGET_ARCH="arm64" ;;
    3) TARGET_ARCH="x64" ;;
    4) TARGET_ARCH="universal" ;;
    *) TARGET_ARCH="$DEFAULT_ARCH" ;;
esac

# Clear screen and update banner with chosen target
clear
print_banner

echo -e " ${BOLD}System Configuration:${NC}"
echo -e "   • Target Arch:  ${GREEN}${TARGET_ARCH}${NC}"
echo -e "   • Package Mgr:  ${MAGENTA}${PKG_MGR}${NC}\n"

echo -e " ${BOLD}Step 2/2: Select Distribution Format:${NC}"
echo -e "   ${BRIGHT_GREEN}[1]${NC} 📦 DMG Installer (.dmg) ${DIM}[Standard installer]${NC}"
echo -e "   ${BRIGHT_GREEN}[2]${NC} 🗜️  ZIP Archive (.zip)   ${DIM}[Portable archive]${NC}"
echo -e "   ${BRIGHT_GREEN}[3]${NC} 🚀 Full Bundle (DMG + ZIP)"
echo -e "   ${BRIGHT_GREEN}[4]${NC} 📂 Unpacked Directory (.app only for quick testing)"
echo -e "   ${BRIGHT_GREEN}[5]${NC} ⚡ Frontend Build Only"
read -p " Select [1-5] (default: 1): " build_choice
build_choice=${build_choice:-1}

clear

# Execute Workflow
case $build_choice in
    1)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_electron dmg "$TARGET_ARCH"
        show_summary
        ;;
    2)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_electron zip "$TARGET_ARCH"
        show_summary
        ;;
    3)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_electron dmg "$TARGET_ARCH"
        package_electron zip "$TARGET_ARCH"
        show_summary
        ;;
    4)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_electron dir "$TARGET_ARCH"
        show_summary
        ;;
    5)
        check_prerequisites
        clean_build_cache
        compile_renderer
        print_success "Frontend compilation complete! (dist/ is ready)"
        ;;
    *)
        print_error "Invalid selection. Exiting."
        exit 1
        ;;
esac
