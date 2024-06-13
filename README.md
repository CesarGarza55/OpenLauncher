# OpenLauncher

OpenLauncher is an open-source Minecraft launcher developed in Python using CustomTkinter and the minecraft_launcher_lib library.

(For the moment only designed for Windows and Linux)

## Features

- **Custom Interface**: Utilizes CustomTkinter for a modern and customizable look.
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

    PyInstaller (Recommended for single executable file compilation [Detected as virus false positive, you probably need to disable your antivirus to compile it])
    ```bash
    pip install -r data/requirements_pyinstaller.txt
    pyinstaller --clean --workpath ./temp --onefile --windowed --icon data/icon.ico --distpath ./ --noconfirm data/OpenLauncher.py
    ```
    Or run compile-pyinstaller.bat
   
    Nuikta (Compiled in the "dist/OpenLauncher.dist" folder, it is required to share the entire folder)
    ```bash
    pip install -r data/requirements_nuikta.txt
    python -m nuitka --standalone --enable-plugin=tk-inter --follow-imports --disable-console --windows-icon-from-ico=data/icon.ico --output-dir=dist data/OpenLauncher.py
    ```
    Or run compile-nuikta.bat

### Linux:

1. Clone the repository:
    ```bash
    git clone https://github.com/CesarGarza55/OpenLauncher.git
    cd OpenLauncher
    ```
    
2. Install python3, pip3 and Tkinter
    ```bash
    sudo apt install python3
    sudo apt install pip3
    sudo apt install python3-tk
    ```
    
3. Compile:

   PyInstaller
    ```bash
    pip3 install -r data/requirements_linux.txt
    ~/.local/bin/pyinstaller --clean --workpath ./temp --onefile --windowed --distpath ./ --noconfirm data/OpenLauncher.py
    ```
    Or run compile-linux.sh:
    ```bash
    chmod +x compile-linux.sh
    ./compile-linux.sh
    ```

4. Mark the file as an program:

![Executable](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/37588648-144d-4b0f-83c8-3dde1d683786)

## Usage

The main interface shows different sections:

![Main interface](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/42d5c13d-fcf0-403e-a281-e1591e3713c2)

To install a version, use the following interface where you select the version and click install:

![Install window](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/5e88b59f-f597-4b29-831a-09b18ffe4104)

By default the following JVM arguments are used:

   ```bash
   -Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M
   ```

If you want to change something you need to do it from the settings window.

![Settings window](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/e059b56f-5402-4d0d-8829-32ebdec0780c)

## Testing
My PC Specs:
- CPU: AMD Ryzen 5 3450U 4-Core 2.1GHz
- GPU: Radeon Vega 8 Graphics
- RAM: 16GB DDR4 SODIMM 2400MHz
- Operating System: Windows 11 Home v22621.3593

Tested Minecraft Version:
- RAM Allocated: 8GB
- Fabric Loader: 0.15.11
- Minecraft Version: 1.20.4
- MODS: Custom modpack

![Test](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/72b6c1f7-8da3-4f7d-8cdf-668621b3cb65)

## Bugs

There is currently a bug when installing older versions of Forge, it is recommended to use the official installer instead of using the built-in feature (Works fine with the latest versions)

![Forge Bug](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/a4f69ac2-c223-4864-ab6b-a80b9efdbffb)

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
- nuitka
- minecraft_launcher_lib
- customtkinter
- requests

The project is based on the following project: [This](https://github.com/Irr22/Minecraft-launcher)

## Disclaimer

This project is in no way related to or associated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. All trademarks and intellectual property rights mentioned in this project are the exclusive property of their respective owners. No files belonging to Mojang AB or Microsoft are hosted on servers owned by us.

Thank you for using OpenLauncher!
