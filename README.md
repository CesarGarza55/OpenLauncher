# OpenLauncher

OpenLauncher is an open-source Minecraft launcher developed in Python using Qt, Tkinter and the minecraft_launcher_lib library.

(For the moment only designed for Windows and Linux)

## WARNING FOR WINDOWS USERS

**Warning**: On Windows, there is a known issue where the launcher may be flagged as a false positive by antivirus software due to the absence of a valid certificate. Please be assured that this is a false alarm and the software is safe to use.

If you encounter issues downloading the [installer](https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.exe), please consider using the [portable](https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher-Portable-Windows.zip) version of the launcher as an alternative.

To verify its safety, I have scanned the launcher with VirusTotal, and it was not detected by any antivirus engine. You can view the scan results below.

![image](https://github.com/user-attachments/assets/5685f609-36d1-432f-b628-a25cb916312b)

The installed executable of the launcher has also been scanned with VirusTotal and shows no issues.

![image](https://github.com/user-attachments/assets/7b7aa152-5f54-4457-9273-7c955cf85a4e)

## Features

- **Microsoft Account Login**: Now supports logging in with an official Microsoft account.
- **Discord Rich Presence**: Displays various fun messages while you play.
- **Custom Interface**: Utilizes PyQt5 for a modern and customizable look.
- **Minecraft Compatibility**: Manages Minecraft versions using the minecraft_launcher_lib library.
- **Open Source**: Easily extendable and modifiable by the community.
- **Multiplatform**: Available for Windows and Linux operating systems.
- **Oficial Themes**: Download and install themes to personalize your launcher.
- **Community Themes**: Create and share custom themes with other users in the [website](https://openlauncher.totalh.net/)
- **Theme Creator**: Design your own themes using the OpenLauncher [theme creator tool](https://openlauncher.totalh.net/create)
- **Multilanguage Support**: Supports multiple languages for a better user experience.

## Requirements

- Python 3.10 or higher
- Java
- pip (Python package manager)

## Installation

### Windows:

1. Clone the repository:
    ```bash
    git clone https://github.com/CesarGarza55/OpenLauncher.git
    cd OpenLauncher
    ```

2. Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    source `venv\Scripts\activate`
    ```

3. Compile:
   
    1. Run the `compile-windows.bat` script to compile the project.
   
    compile-windows.bat:
    ```bash
    @echo off
    py -m pip install -r data/requirements_windows.txt
    python compile.py build
    
    echo OpenLauncher compiled successfully!
    echo You can create the installer with NSIS by running the compile.nsi file with NSIS.
    echo Press any key to exit...
    pause >nul
    ```
    2. Make sure NSIS is installed on your system. You can download NSIS from [nsis.sourceforge.io](https://nsis.sourceforge.io/Download).
    3. Open NSIS and click on "Compile NSI scripts":


       ![{789A5A1C-FFC6-4CCF-A7A8-F7D2442C5709}](https://github.com/user-attachments/assets/daba00d4-e5ee-46e6-9f41-14f60e8e3b7d)

    4. Click on "Load Script..." to load the `script/compile.nsi` script file.

       Alternatively, use the `compile-compress.nsi` script to reduce installer size by ~30 MB, though it will increase build time.

       ![{ACE19409-B779-4FE9-B3CA-F2350765D323}](https://github.com/user-attachments/assets/22c5b691-51f9-4fcf-a25c-563705402200)
    
    5. Once the compilation is successful, open the output file OpenLauncher.exe to begin the installation.

4. You need to install Java to be able to play:

    [https://www.java.com/es/download/](https://www.java.com/es/download/)


### Linux:

1. Clone the repository:
    ```bash
    git clone https://github.com/CesarGarza55/OpenLauncher.git
    cd OpenLauncher
    ```
    
2. Install python3, pip and Tkinter
    ```bash
    sudo apt update
    sudo apt upgrade
    sudo apt install python3
    sudo apt install python3-pip
    sudo apt install python3-tk
    ```
    
3. Compile:
   1. Debian / Ubuntu:
    ```bash
    #!/bin/bash
    set -e

    # Create the directory structure
    DEST_DIR="compile-deb/usr/share/openlauncher"
    mkdir -p "$DEST_DIR"

    # Compile the source code if the binary does not exist
    if [ ! -f "OpenLauncher.bin" ]; then
        echo "OpenLauncher.bin is not compiled yet and will be compiled now"
        chmod +x compile-linux.sh
        ./compile-linux.sh
        echo "OpenLauncher.bin is compiled successfully and ready to be packaged"
    else
        rm OpenLauncher.bin
        echo "OpenLauncher.bin will be recompiled to ensure the latest version is packaged"
        chmod +x compile-linux.sh
        ./compile-linux.sh
        echo "OpenLauncher.bin is compiled successfully and ready to be packaged"
    fi

    # Copy the necessary files
    cp OpenLauncher.bin "$DEST_DIR"

    # Ensure the binary is executable
    chmod +x "$DEST_DIR/OpenLauncher.bin"

    # Ensure the permissions are set correctly
    chmod -R 0755 compile-deb

    # Compile the deb package
    dpkg-deb --build compile-deb "OpenLauncher.deb"

    # Ask the user if they want to install the package
    read -p "Do you want to install the package? [y/n]: " INSTALL
    if [ "$INSTALL" == "y" ]; then
        sudo dpkg -i "OpenLauncher.deb"
    fi
    
    # Remove the binary from the destination directory
    rm "$DEST_DIR/OpenLauncher.bin"
    ```
    
    Next, you can execute the script to start the compilation process:

    ```bash
    ./compile-debian.sh
    ```



   2. Generic Linux systems:
    ```bash
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
    pip install -r data/requirements_linux.txt

    # Install the necessary libraries if not already installed
    LIBRARIES=("libxcb-xinerama0" "libxcb1" "libx11-xcb1" "libxrender1" "libfontconfig1" "libqt5widgets5" "libqt5gui5" "libqt5core5a")

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
        --name OpenLauncher.bin \
        data/OpenLauncher.py

    # Remove the temporary files
    echo -e "${GREEN}Cleaning up...${NC}"
    rm OpenLauncher.bin.spec
    rm -rf temp

    # Deactivate the virtual environment
    echo -e "${GREEN}Deactivating virtual environment...${NC}"
    deactivate
    ```

    Next, you can execute the script to start the compilation process:

    ```bash
    ./compile-linux.sh
    ```
    
4. You need to install Java to be able to play, by default it should be possible with:

    ```bash
    sudo apt install default-jre
    ```

5. Mark the file as an program:

![Executable](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/37588648-144d-4b0f-83c8-3dde1d683786)

Or run:

   ```bash
   chmod +x OpenLauncher.bin
   ```


## Download options

- Windows Installer: .exe
- Linux Installer (Debian/Ubuntu): .deb
- Linux Generic (compiled): .bin


## Usage

When you open the application, a welcome window greets you. You can disable this feature using a checkbox.

![imagen](https://github.com/user-attachments/assets/5b31cabc-4f53-4264-aa78-478509e68299)

The main interface shows different sections:

![imagen](https://github.com/user-attachments/assets/6b214dfd-7d65-4eb0-b723-c20bdf7acdf9)

To install a version, use the following interface where you select the version and click install:

![imagen](https://github.com/user-attachments/assets/a019e385-7b45-4780-b51c-2f2659ea9527)


By default the following JVM arguments are used:

   ```bash
   -Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M
   ```

If you want to change something you need to do it from the settings window.

![imagen](https://github.com/user-attachments/assets/cf29f0f0-dbc4-40b5-8fcd-c47617b2dc98)

The new mod manager allows you to manage mods sorted by game version so you can install all the mods you want and then disable the ones you don't want to use:

![imagen](https://github.com/user-attachments/assets/4e059b37-1732-46bc-94db-3a98769891ef)

## Sign in with Microsoft Account
To log in with your official Microsoft account, follow these steps:

1. Open the launcher.
2. Click on "Login with Microsoft"
3. Enter your Microsoft account with Minecraft purchased
4. Once the authentication process is complete, you will see your account appear in the launcher

![imagen](https://github.com/user-attachments/assets/c7d15cf5-a397-4004-aa2a-0380dd39b35b)

## Themes

OpenLauncher allows you to customize the appearance of the launcher with themes. You can choose from official and community themes, as well as create your own.

### Official themes
Official themes are provided by me, and you can find them at [https://openlauncher.totalh.net/plugins](https://openlauncher.totalh.net/plugins).

### Community Themes

Users can create and share their own themes on the official OpenLauncher website. Visit [https://openlauncher.totalh.net/community](https://openlauncher.totalh.net/community) to explore and download community themes.

### Theme Creator

If you want to create a custom theme, use the theme creator tool available on [https://openlauncher.totalh.net/create](https://openlauncher.totalh.net/create).

### Guide

For a detailed guide on how to install themes, visit [https://openlauncher.totalh.net/guide](https://openlauncher.totalh.net/guide).


## Testing
My PC Specs:
- CPU: AMD Ryzen 5 3450U 4-Core 2.1GHz
- GPU: Radeon Vega 8 Graphics
- RAM: 16GB DDR4 SODIMM 2400MHz
- Operating System: Debian 12 (bookworm) x86_64 

Tested Minecraft Version:
- RAM Allocated: 2GB (Default JVM Arguments)
- Minecraft Version: 1.21.1
- Fabric: 0.16.7
- Shaders: [MakeUp-UltraFast-9.0.c](https://modrinth.com/shader/makeup-ultra-fast-shaders)

![imagen](https://github.com/user-attachments/assets/a54aed8f-fe49-499c-8450-f8c5d2e25f99)

## Bugs

There was previously a minor bug that caused the launcher to close when installing versions or running the game. This was due to how subprocesses are managed, and IN THEORY, this issue has been fixed as of beta-1.5.1. However, if the error persists, please report it in the issues section, and I will continue working to resolve it.

Keeping the software bug-free is challenging since it’s designed to work with both Windows and Linux. With so many Linux distributions out there, it’s especially complex to manage compatibility across such a wide variety of systems.

## Linux errors

In some distributions, errors may occur due to the wide variety of systems available. If the executable does not open or fails to display anything when you run it, this may be due to an incompatibility or missing dependencies. To help identify the error and provide a possible solution in the future, you can run the application directly from the terminal using './OpenLauncher.bin' or 'openlauncher' if you installed the .deb package.

For example, in Debian 12, when you try to open the application, no error message may appear, but the application does not launch. This issue is caused by the version of Python being used. The easiest way to resolve this is by compiling the package yourself.

Example of the error:

![imagen](https://github.com/user-attachments/assets/d5e56835-95a8-457a-a45c-cc6a11e56d03)

## Contributing
Contributions are welcome! Follow these steps to contribute:

- Fork the repository.
- Create a new branch (git checkout -b feature/new-feature).
- Make the necessary changes and commit (git commit -am 'Add new feature').
- Push the changes to your repository (git push origin feature/new-feature).
- Open a Pull Request on GitHub.

## License
This project is licensed under the GPL-2.0 License. For more details, see the [LICENSE](https://github.com/CesarGarza55/OpenLauncher/blob/main/LICENSE) file.

## Credits
OpenLauncher uses the following libraries and tools:

- cx_Freeze
- minecraft_launcher_lib
- PyQt5
- Tkinter
- pypresence
- requests

The project is based on the this [project](https://github.com/Irr22/Minecraft-launcher).

## Disclaimer

This project is in no way related to or associated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. All trademarks and intellectual property rights mentioned in this project are the exclusive property of their respective owners. No files belonging to Mojang AB or Microsoft are hosted on servers owned by us.

Thank you for using OpenLauncher!
