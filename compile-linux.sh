#!/bin/bash
set -e
# Clear the terminal
clear
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

# Clear the terminal
clear

# Ask what to do (compile or install dependencies)
if [ "$os_choice" -eq 1 ]; then
    echo -e "${BLUE}You selected Debian-based systems.${NC}"
elif [ "$os_choice" -eq 2 ]; then
    echo -e "${BLUE}You selected Fedora-based systems.${NC}"
fi

echo "Select an option:"
echo "1) Compile the application"
echo "2) Only install dependencies"
if [ "$os_choice" -eq 1 ]; then
    echo "3) Create .deb package"
fi
read -p "Enter the number of your choice: " action_choice

# Clear the terminal
clear

if [ "$action_choice" -eq 1 ]; then
    echo -e "${BLUE}You selected to compile the application.${NC}"
elif [ "$action_choice" -eq 2 ]; then
    echo -e "${BLUE}You selected to install dependencies.${NC}"
elif [ "$action_choice" -eq 3 ]; then
    echo -e "${BLUE}You selected to create a .deb package.${NC}"
fi

# Function to install dependencies for Debian-based systems
install_deps_debian() {
    echo -e "${YELLOW}Installing dependencies for Debian-based systems...${NC}"
    sudo apt update

    # Install required dependencies
    sudo apt install -y python3 python3-venv python3-tk python3-pip python3-full default-jre \
        libxcb-xinerama0 libxcb1 libx11-xcb1 libxrender1 libfontconfig1 \
        libqt5widgets5 libqt5gui5 libqt5core5a libxcb-cursor0
    # Create (or reuse) virtual environment and install python dependencies there
    create_venv
    python3 -m pip install --upgrade pip setuptools wheel
    python3 -m pip install -r data/requirements_linux.txt
}

# Function to install dependencies for Fedora-based systems
install_deps_fedora() {
    echo -e "${YELLOW}Installing dependencies for Fedora-based systems...${NC}"

    # Install required dependencies
    sudo dnf install -y python3 python3-pip python3-virtualenv python3-tkinter java-11-openjdk \
        libxcb libX11-xcb libXrender fontconfig qt5-qtbase-gui qt5-qtbase xcb-util-cursor
    # Create (or reuse) virtual environment and install python dependencies there
    create_venv
    python3 -m pip install --upgrade pip setuptools wheel
    python3 -m pip install -r data/requirements_linux.txt
}

# Create virtual environment and activate it
create_venv() {
    echo -e "${GREEN}Creating virtual environment...${NC}"
    # If venv already exists, just activate it. This makes the function idempotent.
    if [ -d "venv" ] && [ -f "venv/bin/activate" ]; then
        echo -e "${YELLOW}Virtual environment already exists. Activating...${NC}"
    else
        python3 -m venv venv
        echo -e "${GREEN}Virtual environment created.${NC}"
    fi

    # Activate the virtualenv
    # shellcheck disable=SC1091
    source venv/bin/activate
    echo -e "${GREEN}Virtual environment activated!${NC}"
}

# Ask user to confirm compilation
confirm_compile() {
    read -p "Do you want to compile the application now? [Y/n]: " compile_confirm
    # default to Y if empty
    compile_confirm=${compile_confirm:-Y}
    case "$compile_confirm" in
        [Yy]|[Yy][Ee][Ss])
            return 0
            ;;
        *)
            echo -e "${YELLOW}Compilation cancelled by user.${NC}"
            return 1
            ;;
    esac
}

# Compile the application
compile_application() {
    echo -e "${GREEN}Compiling the application...${NC}"
    pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ \
        --add-data data/img:img/ \
        --add-data data/config_manager.py:. \
        --add-data data/discord_manager.py:. \
        --add-data data/lang.py:. \
        --add-data data/main_window.py:. \
        --add-data data/material_design.py:. \
        --add-data data/mc_run.py:. \
        --add-data data/microsoft_auth.py:. \
        --add-data data/mod_manager.py:. \
        --add-data data/resource_cache.py:. \
        --add-data data/ui_components.py:. \
        --add-data data/ui_dialogs.py:. \
        --add-data data/ui_methods.py:. \
        --add-data data/ui_windows.py:. \
        --add-data data/updater.py:. \
        --add-data data/utils.py:. \
        --add-data data/variables.py:. \
        --add-data data/version_installer.py:. \
        --add-data data/workers.py:. \
        --name OpenLauncher.bin \
        data/main.py

    echo -e "${GREEN}Compilation finished! Cleaning up...${NC}"
    rm OpenLauncher.bin.spec
    rm -rf temp
}

# Create .deb package (only for Debian-based systems)
create_deb_package() {
    echo -e "${GREEN}Creating .deb package...${NC}"
    mkdir -p compile-deb/usr/share/openlauncher

    # If the binary already exists, ask whether to use it or recreate
    if [ -f "OpenLauncher.bin" ]; then
        read -p "OpenLauncher.bin already exists. Use existing binary? [Y/n]: " use_existing
        # default to yes if empty, and make case-insensitive
        use_existing=${use_existing:-Y}
        use_existing=$(echo "$use_existing" | tr '[:upper:]' '[:lower:]')
        if [ "$use_existing" != "y" ]; then
            echo -e "${YELLOW}Recreating OpenLauncher.bin...${NC}"
            # Ensure virtualenv is active (create_venv is idempotent)
            create_venv
            if confirm_compile; then
                compile_application
            else
                echo -e "${RED}Aborting .deb creation because compilation was cancelled.${NC}"
                return 1
            fi
        else
            echo -e "${GREEN}Using existing OpenLauncher.bin${NC}"
        fi
    else
        echo -e "${YELLOW}No existing OpenLauncher.bin found. Compiling...${NC}"
        create_venv
        if confirm_compile; then
            compile_application
        else
            echo -e "${RED}Aborting .deb creation because compilation was cancelled.${NC}"
            return 1
        fi
    fi

    cp OpenLauncher.bin compile-deb/usr/share/openlauncher/
    chmod +x compile-deb/usr/share/openlauncher/OpenLauncher.bin
    chmod -R 0755 compile-deb

    # Build .deb; use --root-owner-group to avoid owner/group warnings when running as root
    dpkg-deb --build --root-owner-group compile-deb "OpenLauncher.deb"
    echo -e "${GREEN}Deb package created!${NC}"

    # Ask to install the package
    read -p "Do you want to install the package? [y/n]: " install_choice
    if [ "$install_choice" == "y" ]; then
        # Use apt to install the local .deb so dependencies declared in control are resolved
        sudo apt update
        sudo apt install -y ./OpenLauncher.deb
    fi

    rm compile-deb/usr/share/openlauncher/OpenLauncher.bin
}

# Main script logic
case $os_choice in
    1)
        if [ "$action_choice" -eq 1 ]; then
            install_deps_debian
            create_venv
            if confirm_compile; then
                compile_application
            else
                echo -e "${RED}Compilation cancelled. Exiting.${NC}"
                exit 0
            fi
            read -p "Do you want to create a .deb package? [y/n]: " deb_choice
            if [ "$deb_choice" == "y" ]; then
                create_deb_package
            fi
        elif [ "$action_choice" -eq 2 ]; then
            install_deps_debian
        elif [ "$action_choice" -eq 3 ]; then
            if [ "$os_choice" -eq 1 ]; then
                    # For Debian: install dependencies and then build .deb (create_deb_package
                    # will ask whether to reuse or recreate the binary)
                    install_deps_debian
                    create_deb_package
            else
                echo -e "${RED}Invalid choice. Exiting...${NC}"
                exit 1
            fi
        else
            echo -e "${RED}Invalid choice. Exiting...${NC}"
            exit 1
        fi
        ;;
    2)
        if [ "$action_choice" -eq 1 ]; then
            install_deps_fedora
            create_venv
            if confirm_compile; then
                compile_application
            else
                echo -e "${RED}Compilation cancelled. Exiting.${NC}"
                exit 0
            fi
        elif [ "$action_choice" -eq 2 ]; then
            install_deps_fedora
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

# Deactivate the virtual environment
deactivate
echo -e "${GREEN}Virtual environment deactivated!${NC}"
