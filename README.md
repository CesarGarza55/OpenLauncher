# OpenLauncher

OpenLauncher is an open-source Minecraft launcher developed in Python using CustomTkinter and the minecraft_launcher_lib library.

(For the moment only designed for Windows and Linux)

## Features

- **Microsoft Account Login**: Now supports logging in with an official Microsoft account.
- **Custom Interface**: Utilizes PyQt5 for a modern and customizable look.
- **Minecraft Compatibility**: Manages Minecraft versions using the minecraft_launcher_lib library.
- **Open Source**: Easily extendable and modifiable by the community.
- **Multiplatform**: Available for Windows and Linux operating systems.
- **Oficial Themes**: Download and install themes to personalize your launcher.
- **Community Themes**: Create and share custom themes with other users in the [website](https://openlauncher.totalh.net/)
- **Theme Creator**: Design your own themes using the OpenLauncher [theme creator tool](https://openlauncher.totalh.net/create)

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

    PyInstaller
    ```bash
    py -m pip install -r data/requirements_windows.txt
    pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ --icon "data\img\creeper.ico" ^
        --add-data "data\img;img/" ^
        --add-data "data\updater.py;." ^
        --add-data "data\variables.py;." ^
        --add-data "data\mod_manager.py;." ^
        --add-data "data\microsoft_auth.py;." ^
        "data\OpenLauncher.py"
    del OpenLauncher.spec
    rmdir /s /q temp
    ```
    Or run compile-windows.bat
   
5. You need to install Java to be able to play:

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

   PyInstaller
    ```bash
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
        --add-data data/mod_manager.py:. \
        --add-data data/microsoft_auth.py:. \
        --name OpenLauncher.bin \
        data/OpenLauncher.py
    
    # Remove the temporary files
    rm OpenLauncher.bin.spec
    rm -rf temp
    
    # Deactivate the virtual environment
    deactivate

    ```bash
    ./compile-linux.sh
    ```
    
    Debian / Ubuntu:
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
    
    # Compile the deb package
    dpkg-deb --build compile-deb "OpenLauncher.deb"
    ```

    ```bash
    ./compile-debian.sh
    ```
4. You need to install Java to be able to play, by default it should be possible with:

    ```bash
    sudo apt install default-jre
    ```

5. Mark the file as an program:

![Executable](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/37588648-144d-4b0f-83c8-3dde1d683786)

## Download options

- Windows: .exe
- Linux (compiled): .bin
- Linux (Debian/Ubuntu) .deb


## Usage

When you open the application, a welcome window greets you. You can disable this feature using a checkbox.

![imagen](https://github.com/user-attachments/assets/5b31cabc-4f53-4264-aa78-478509e68299)

The main interface shows different sections:

![image](https://github.com/user-attachments/assets/bd337d4b-e24c-44dd-8bb6-d2ec0dcb3e3c)


To install a version, use the following interface where you select the version and click install:

![image](https://github.com/user-attachments/assets/8174c08a-827f-47f9-897d-9dbd9076cb4b)


By default the following JVM arguments are used:

   ```bash
   -Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M
   ```

If you want to change something you need to do it from the settings window.

![image](https://github.com/user-attachments/assets/377374ba-d60c-4957-bb6e-7c78239ec804)

The new mod manager allows you to manage mods sorted by game version so you can install all the mods you want and then disable the ones you don't want to use:

![imagen](https://github.com/user-attachments/assets/92f17c0a-90c2-4e25-90a3-3ce244b44679)

## Logging in with Microsoft Account
To log in with your official Microsoft account, follow these steps:

1. Open the launcher.
2. Click on "Login with Microsoft"
3. Enter your Microsoft account with Minecraft purchased
4. Once the authentication process is complete, you will see your account appear in the launcher

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
- Operating System: Ubuntu 24.04.1 LTS x86_64 

Tested Minecraft Version:
- RAM Allocated: 2GB (Default JVM Arguments)
- Minecraft Version: 1.21.1
- Fabric: 0.16.5

![imagen](https://github.com/user-attachments/assets/7fdc4cc9-066a-4f07-ae02-32bf9ddaefb6)


## Bugs

For some reason (I don't know if it's a problem with my Linux distribution) there are times when the launcher crashes when running the game, but there are also times when it doesn't happen, so I assume it may be my own distribution.

Occasionally, the Microsoft login may cause the launcher to crash, but you can try again, and this issue shouldn't occur frequently.

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

- pyinstaller
- minecraft_launcher_lib
- PyQt5
- pypresence
- requests

The project is based on the following project: [This](https://github.com/Irr22/Minecraft-launcher)

## Disclaimer

This project is in no way related to or associated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. All trademarks and intellectual property rights mentioned in this project are the exclusive property of their respective owners. No files belonging to Mojang AB or Microsoft are hosted on servers owned by us.

Thank you for using OpenLauncher!
