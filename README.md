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
    pip install -r data/requirements_windows.txt
    pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ --icon "data\img\icon.ico" --add-data "data\img;img/" "data\OpenLauncher.py"
    del OpenLauncher.spec
    rmdir /s /q temp
    ```
    Or run compile-windows.bat

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
    pip3 install -r data/requirements_linux.txt
    sudo apt install libxcb-xinerama0 libxcb1 libx11-xcb1 libxrender1 libfontconfig1
    export QT_QPA_PLATFORM=xcb
    sudo apt-get install --reinstall libqt5widgets5 libqt5gui5 libqt5core5a
    ~/.local/bin/pyinstaller --clean --workpath ./temp --noconfirm --onefile --windowed --distpath ./ --icon "data/img/icon.ico" --add-data "data/img:img/" "data/OpenLauncher.py"
    rm OpenLauncher.spec
    rm -rf temp
    ```
    Or run compile-linux.sh:
    ```bash
    chmod +x compile-linux.sh
    ./compile-linux.sh
    ```
    You need to install Java to be able to play, by default it should be possible with:
    ```bash
    sudo apt install default-jre
    ```

5. Mark the file as an program:

![Executable](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/37588648-144d-4b0f-83c8-3dde1d683786)

## Usage

The main interface shows different sections:

![Main Interface](https://github.com/user-attachments/assets/3b516633-089f-4a19-9687-aeba389d2d7d)

To install a version, use the following interface where you select the version and click install:

![Install minecraft](https://github.com/user-attachments/assets/c709ce85-6b7d-46bd-b2e4-06b6bcf43588)

By default the following JVM arguments are used:

   ```bash
   -Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M
   ```

If you want to change something you need to do it from the settings window.

![Settings](https://github.com/user-attachments/assets/2fc94605-2fdc-4085-926b-dde09533bf89)

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

## Bugs

In this latest version I have patched the bug by installing Forge versions, it should work perfectly, however, I have left the warning mainly because it is likely that with specific versions there may be some error (I have not checked each one because there are too many)

![Bug](https://github.com/user-attachments/assets/b005d827-d565-4003-bc29-3a88f9da5e51)

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
- requests

The project is based on the following project: [This](https://github.com/Irr22/Minecraft-launcher)

## Disclaimer

This project is in no way related to or associated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. All trademarks and intellectual property rights mentioned in this project are the exclusive property of their respective owners. No files belonging to Mojang AB or Microsoft are hosted on servers owned by us.

Thank you for using OpenLauncher!
