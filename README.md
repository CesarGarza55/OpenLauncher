# OpenLauncher

OpenLauncher is an open-source Minecraft launcher developed in Python using CustomTkinter and the minecraft_launcher_lib library.

(For the moment only designed for Windows and Linux)

## Features

- **Custom Interface**: Utilizes PyQt5 for a modern and customizable look.
- **Minecraft Compatibility**: Manages Minecraft versions using the minecraft_launcher_lib library.
- **Open Source**: Easily extendable and modifiable by the community.

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
        data/OpenLauncher.py

    # Remove the temporary files
    rm OpenLauncher.spec
    rm -rf temp

    # Deactivate the virtual environment
    deactivate
    ./compile-linux.sh
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

The main interface shows different sections:

![Main interface](https://github.com/user-attachments/assets/bee88371-29b9-4fd3-8037-9895a3a6dc49)


To install a version, use the following interface where you select the version and click install:

![Install minecraft](https://github.com/user-attachments/assets/c709ce85-6b7d-46bd-b2e4-06b6bcf43588)

By default the following JVM arguments are used:

   ```bash
   -Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M
   ```

If you want to change something you need to do it from the settings window.

![Settings](https://github.com/user-attachments/assets/ea74104f-cdb0-4e1c-8f65-66441d1153ee)

## Testing
My PC Specs:
- CPU: AMD Ryzen 5 3450U 4-Core 2.1GHz
- GPU: Radeon Vega 8 Graphics
- RAM: 16GB DDR4 SODIMM 2400MHz
- Operating System: Windows 11 Home v22621.3593

Tested Minecraft Version:
- RAM Allocated: 2GB (Default JVM Arguments)
- Minecraft Version: 1.21.1

![Test](https://github.com/user-attachments/assets/b6b94107-de9c-4c53-a85e-5374d76b806a)

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
