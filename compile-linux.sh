#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenLauncher - Interactive Linux 
# Build packages for Debian (.deb), AppImage, tar.gz, and Arch Linux
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

print_banner() {
    clear
    echo ""
    echo -e "  ${BRIGHT_CYAN}◆${NC} ${BOLD}OpenLauncher${NC} ${DIM}•${NC} ${BRIGHT_BLUE}Linux${NC}"
    echo -e "  ${DIM}───────────────────────────────────────────────────────${NC}"
    echo ""
}

print_step() {
    local step="$1"
    local total="$2"
    local title="$3"
    clear
    print_banner
    echo -e " ${BOLD}Target Architecture:${NC} ${GREEN}${HOST_ARCH}${NC}\n"
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

# Detect environment
detect_env() {
    HOST_ARCH=$(uname -m)
    
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

check_prerequisites() {
    print_step 1 4 "Validating Environment"
    
    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js is not installed! Please install Node.js 18+"
        exit 1
    fi
    
    NODE_VER=$(node -v)
    print_info "Node.js:     ${GREEN}${NODE_VER}${NC}"
    print_info "Package Mgr: ${GREEN}${PKG_MGR}${NC}"
    
    if [ "$PKG_MGR" = "none" ]; then
        print_error "Neither pnpm nor npm was found in PATH!"
        exit 1
    fi
    
    print_info "Installing dependencies..."
    if [ "$PKG_MGR" = "pnpm" ]; then
        pnpm install --silent
    else
        npm install --silent
    fi
    print_success "Dependencies verified"
}

clean_build_cache() {
    print_step 2 4 "Cleaning Workspace & Release Cache"
    rm -rf release dist
    print_success "Build directory cleaned"
}

compile_renderer() {
    print_step 3 4 "Compiling Frontend (Vite)"
    $PKG_RUN build
    print_success "Vite bundle compiled into dist/"
}

package_linux() {
    local target="$1"
    print_step 4 4 "Packaging Linux Target (${target})"
    $PKG_EXEC electron-builder --linux "$target"
    print_success "Linux package created"
}

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
        find release -maxdepth 1 -type f \( -name "*.deb" -o -name "*.tar.gz" -o -name "*.AppImage" \) -exec ls -lh {} + 2>/dev/null | awk '{print "    " $9 " (" $5 ")"}'
    fi
    
    echo ""
}

# Interactive Menu
detect_env
print_banner

echo -e " ${BOLD}System Configuration:${NC}"
echo -e "   • Architecture: ${GREEN}${HOST_ARCH}${NC}"
echo -e "   • Package Mgr:  ${MAGENTA}${PKG_MGR}${NC}\n"

echo -e " ${BOLD}Select Target Linux Format:${NC}"
echo -e "   ${BRIGHT_CYAN}[1]${NC} 📦 Debian / Ubuntu Package (.deb) ${DIM}[Recommended for Debian/Ubuntu]${NC}"
echo -e "   ${BRIGHT_CYAN}[2]${NC} 🗜️  Portable Archive (.tar.gz)     ${DIM}[Arch, Fedora, generic Linux]${NC}"
echo -e "   ${BRIGHT_CYAN}[3]${NC} 🚀 Full Bundle (.deb + .tar.gz)"
echo -e "   ${BRIGHT_CYAN}[4]${NC} 📂 Unpacked Directory (linux-unpacked)"
echo -e "   ${BRIGHT_CYAN}[5]${NC} ⚡ Frontend Build Only"
read -p " Select [1-5] (default: 1): " target_choice
target_choice=${target_choice:-1}

clear

case $target_choice in
    1)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_linux deb
        show_summary
        ;;
    2)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_linux "tar.gz"
        show_summary
        ;;
    3)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_linux deb
        package_linux "tar.gz"
        show_summary
        ;;
    4)
        check_prerequisites
        clean_build_cache
        compile_renderer
        package_linux dir
        show_summary
        ;;
    5)
        check_prerequisites
        clean_build_cache
        compile_renderer
        print_success "Frontend compilation complete!"
        ;;
    *)
        print_error "Invalid choice. Exiting."
        exit 1
        ;;
esac
