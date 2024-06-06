# OpenLauncher

OpenLauncher is an open-source Minecraft launcher developed in Python using CustomTkinter and the minecraft_launcher_lib library.

(For the moment only designed for Windows)

## Features

- **Custom Interface**: Utilizes CustomTkinter for a modern and customizable look.
- **Minecraft Compatibility**: Manages Minecraft versions using the minecraft_launcher_lib library.
- **Open Source**: Easily extendable and modifiable by the community.

## Requirements

- Python 3.10 or higher
- Java
- pip (Python package manager)

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/CesarGarza55/OpenLauncher.git
    cd OpenLauncher
    ```

2. Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate   # On Windows use `venv\Scripts\activate`
    ```

3. Compile:
   
    PyInstaller (Recommended for single executable file compilation [Detected as virus false positive, you probably need to disable your antivirus to compile it])
    ```bash
    pip install -r data/requirements_pyinstaller.txt
    pyinstaller --clean --workpath ./temp --onefile --windowed --icon data/icon.ico --distpath ./ --noconfirm data/OpenLauncher.py
    ```
    Nuikta (Compiled in the "dist/OpenLauncher.dist" folder, it is required to share the entire folder)
    ```bash
    pip install -r data/requirements_nuikta.txt
    python -m nuitka --standalone --enable-plugin=tk-inter --follow-imports --disable-console --windows-icon-from-ico=data/icon.ico --output-dir=dist data/OpenLauncher.py
    ```

## Usage

To start the launcher, run: 
    
    OpenLauncher.exe

The main interface shows different sections:

![Main Interface](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/6a70c956-6211-450d-91d2-d8ce6d542edc)

To install a version, use the following interface where you select the version and click install:

![Install window](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/da681a5d-8874-4567-b24d-b56915e28ae0)

You need to specify a username and the amount of RAM that the game will allocate, by default the following JVM arguments are used:

   ```bash
   -Xms{ram}G -Xmx{ram}G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem
   ```

If you want to change something you need to do it from the file 'data/OpenLauncher.py (line 328)'

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

Thank you for using OpenLauncher!
