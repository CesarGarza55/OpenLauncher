# OpenLauncher

OpenLauncher is an open-source Minecraft launcher developed in Python using CustomTkinter and the minecraft_launcher_lib library.

## Features

- **Custom Interface**: Utilizes CustomTkinter for a modern and customizable look.
- **Minecraft Compatibility**: Manages Minecraft installations using the minecraft_launcher_lib library.
- **Open Source**: Easily extendable and modifiable by the community.

## Requirements

- Python 3.8 or higher
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
   
    (PyInstaller)
    ```bash
    pip install -r data/requirements_pyinstaller.txt
    pyinstaller data/OpenLauncher.py --workpath ./temp --specpath ./temp  --onefile --windowed --icon data/icon.ico --distpath ./ --noconfirm
    ```
   (Nuikta)
   ```bash
   pip install -r data/requirements_nuikta.txt
   python -m nuitka --enable-plugin=tk-inter --disable-console --onefile --windows-icon-from-ico=data/icon.ico data/OpenLauncher.py
   ```

## Usage

To start the launcher, run: 
    
    OpenLauncher.exe

The main interface shows different sections:

![Main interface](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/464b7a33-20e3-4ddd-83e4-404786675cb1)

To install a version, the following interface is used where the version is written:

![Install window](https://github.com/CesarGarza55/OpenLauncher/assets/168610828/0160d883-c8c0-4464-82e3-fc9281eaf0de)

You need to specify a username and the amount of RAM that the game will allocate, by default the following JVM arguments are used:

   ```bash
   -Xms{ram}G -Xmx{ram}G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem
   ```

If you want to change something you need to do it from the file 'data/OpenLauncher.py (line 287)'

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

Thank you for using OpenLauncher!
