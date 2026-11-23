<p align="center">
  <img width="96px" src="public/icon.webp" alt="OpenLauncher" />
  <h1 align="center">OpenLauncher</h1>
  <p align="center">
    A fast, modern, and open-source Minecraft launcher built with <b>React</b> and <b>Tauri 2</b> for <b>Windows</b>, <b>macOS</b>, and <b>Linux</b>.
  </p>
</p>

<p align="center">
  <a href="https://github.com/CesarGarza55/OpenLauncher/releases"><img alt="Latest Release" src="https://img.shields.io/github/v/release/CesarGarza55/OpenLauncher?style=flat&color=3b82f6" /></a>
  <img alt="License" src="https://img.shields.io/badge/License-GPL--2.0-blue.svg?style=flat" />
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-FFC131?style=flat&logo=tauri&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19+-61DAFB?style=flat&logo=react&logoColor=black" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6+-646CFF?style=flat&logo=vite&logoColor=white" />
  <img alt="Platforms" src="https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux-22c55e?style=flat" />
  <a href="https://github.com/CesarGarza55/OpenLauncher/stargazers"><img alt="GitHub Stars" src="https://img.shields.io/github/stars/CesarGarza55/OpenLauncher?style=flat&color=eab308" /></a>
</p>

---

## Downloads

Pre-built binaries are available in the **[Releases](https://github.com/CesarGarza55/OpenLauncher/releases)** section:

| Operating System | Installer | Portable | Architecture |
| :--- | :--- | :--- | :--- |
| **macOS** | `OpenLauncher-mac-arm64.dmg`<br>`OpenLauncher-mac-x64.dmg` | `OpenLauncher-mac-arm64.zip`<br>`OpenLauncher-mac-x64.zip` | Apple Silicon (M1–M5)<br>Intel (x64) |
| **Windows** | `OpenLauncher.exe` | `OpenLauncher-Portable-Windows.exe` | x64 |
| **Linux** | `OpenLauncher.deb`<br>`OpenLauncher.AppImage` | `OpenLauncher.tar.gz` | x64 |

> [!TIP]
> **macOS Installation Note:**
> macOS automatically places downloaded applications from third-party sources into quarantine if they are not signed with a paid Apple Developer certificate. If macOS shows *"OpenLauncher is damaged and can't be opened"*, open Terminal and run:
> ```bash
> sudo xattr -rd com.apple.quarantine /Applications/OpenLauncher.app
> ```

> [!NOTE]
> **Linux Installation & Permissions:**
> - **Debian / Ubuntu (.deb):** `sudo apt install ./OpenLauncher.deb`
> - **Universal AppImage:** Give execution permission and run:
>   ```bash
>   chmod +x OpenLauncher.AppImage
>   ./OpenLauncher.AppImage
>   ```
> - **Tarball (.tar.gz):** Extract and execute `./openlauncher`. Ensure your distribution has `webkit2gtk-4.1` installed (`sudo apt install libwebkit2gtk-4.1-0` on Ubuntu/Debian, `sudo dnf install webkit2gtk4.1` on Fedora, `sudo pacman -S webkit2gtk-4.1` on Arch).

<details>
<summary><b>Legacy Python Version (Beta-1.7.4)</b></summary>

The previous Python-based version of OpenLauncher (legacy) is still available for download in the [Releases](https://github.com/CesarGarza55/OpenLauncher/releases) section. The last version of the legacy system was **Beta-1.7.4**.
Version 1.2.0 completes the migration from the Electron desktop shell to Tauri 2 while keeping the React/Vite interface and launcher workflows.
</details>

---

## Features

- **Microsoft & Offline Profiles**: Secure authentication via official Microsoft OAuth, plus offline local profile support.
- **Full Instance Isolation**: Create, edit, and launch independent game instances with isolated mods, resource packs, shaders, datapacks, saves, and screenshots. Includes custom icons, custom JVM arguments, and 1-click migration from `.minecraft`.
- **Modrinth Hub (Mods, Shaders & Texture Packs)**: Direct online browsing and 1-click installation of mods, shaders, and resource packs with auto-dependency resolution and update checks.
- **My Library Management**: Dedicated tabs for local Mods, Shaders, Resource Packs, and Data Packs scoped dynamically to the active instance or global `.minecraft`.
- **Fabric Conflict & Incompatibility Auto-Fixer**: Diagnoses Fabric crash logs and harmonizes mod versions in 1 click.
- **Unified Version Installer**: Fast installation of **Vanilla**, **Fabric**, **Forge**, **NeoForge**, and **Quilt** versions with live Minecraft Snapshot support.
- **Fine-Tuned Performance**: Per-profile and per-instance RAM allocation, custom Java paths, and smart version-aware JVM garbage collection presets (Generational ZGC for Java 21+, Aikar's G1GC for Java 8–17).
- **News Feed & Customization**: Integrated official Minecraft news, multi-language support (EN, ES, FR), and launcher settings.

---

## Interface Tour

### Main Dashboard
Quick access to profiles, version selectors, installed mods, real-time console output, official news, and launcher settings.

<img width="1478" height="851" alt="image" src="https://github.com/user-attachments/assets/19971ff9-a8e4-4153-9f7f-a3efc6af4d50" />

<details>
<summary><b>View Interface Details & Screenshots (Versions, Settings, Microsoft Login, Mod Manager, Auto-Fixer)</b></summary>

#### Version Installation
Install Vanilla, Fabric, Forge, NeoForge, or Quilt versions with automatic catalog loading and snapshot filters:

<img width="1478" height="851" alt="image" src="https://github.com/user-attachments/assets/5f83e287-7039-456c-854a-eed8e1900a3a" />

#### Settings & Customization
Configure game directories, custom Java JREs, auto-updates, JVM arguments, and language options:

<img width="1478" height="851" alt="image" src="https://github.com/user-attachments/assets/896a5e22-9184-4d43-b7b3-758b78b5e91c" />

#### Optimized Dynamic JVM Arguments
OpenLauncher dynamically applies the best Garbage Collector flags based on the detected Java runtime:

- **Java 21+ (Modern Minecraft 1.20.5+) — Generational ZGC:**
  ```bash
  -XX:+IgnoreUnrecognizedVMOptions -XX:+UnlockExperimentalVMOptions -XX:+UseZGC -XX:+ZGenerational
  ```
- **Java 8–17 (Legacy / Standard Minecraft) — Optimized Aikar's G1GC:**
  ```bash
  -XX:+IgnoreUnrecognizedVMOptions -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1
  ```

#### Microsoft Account Authentication
Authenticate securely with your official Minecraft-entitled Microsoft account:

1. Open OpenLauncher.
2. Click on the **Microsoft icon** in the sidebar.
3. Complete the login in the secure browser prompt.

<img width="279" height="94" alt="Microsoft Authentication" src="https://github.com/user-attachments/assets/5f036741-7007-45f2-819e-034146bd4ba5" />

#### Mod, Shaders & Texture Packs Manager & Modrinth Browser (Beta)
Browse thousands of mods, shaders, texture packs and data packs check installed mod updates against Modrinth hashes, and drag-and-drop files:

<img width="1478" height="851" alt="image" src="https://github.com/user-attachments/assets/749d04a5-89c8-4a4d-8d81-429ef046b3e3" />

#### Mod Incompatibility Auto-Fixer
When Fabric detects conflicting mods, OpenLauncher parses the diagnostic tree and applies harmonized versions in one action:

<img width="1552" height="897" alt="Mod Auto-Fixer" src="https://github.com/user-attachments/assets/3a76a061-743c-4cb0-b00c-aec1b5e64aed" />

#### Instance Creation & Profile Management
Create separate Minecraft instances to run distinct modpacks, loaders, versions, and configurations without interference:
- **Dedicated Game Directories**: Keeps `.minecraft/instances/<id>` fully isolated (mods, config, saves, resource packs, shaders, data packs).
- **Scope-Aware Content Management**: Selecting an active instance automatically shifts your Mods, Shaders, Resource Packs, and Data Packs tabs to that instance.
- **Custom Visuals & Performance**: Pick standard pixel-perfect Minecraft block icons or upload your own custom image (`.png`, `.jpg`, `.webp`, `.svg`), with individual RAM and JVM argument overrides.

<img width="1478" height="851" alt="image" src="https://github.com/user-attachments/assets/287319dd-d921-4c37-9767-890c8e06794b" />

#### Instance Migration Wizard
Easily transition from a traditional shared `.minecraft` directory to an isolated setup without losing your progress:
- **Non-Destructive Cloning**: Safely copies existing mods, configs, shaders, resource packs, and world saves into a dedicated new instance.
- **Automatic Loader & Version Detection**: Identifies the currently installed Fabric, Forge, NeoForge, Quilt, or Vanilla environment to preserve modpack compatibility.

<img width="1478" height="851" alt="image" src="https://github.com/user-attachments/assets/9380ecef-212f-45fb-bee6-dda1651c3caf" />

</details>

---

## Build from Source

**Prerequisites:**
- **Node.js**: 20+ (recommended 22+)
- **Package Manager**: `pnpm` (or `npm`)
- **Rust**: Stable toolchain (`rustup default stable`)
- **Java**: Java JDK 17+ (only needed to play Minecraft, not to build the launcher)

```bash
git clone https://github.com/CesarGarza55/OpenLauncher.git
cd OpenLauncher
pnpm install
```

To run in development mode with hot-reload:
```bash
pnpm tauri:dev
```

### Interactive Platform Builders

<details>
<summary><b>macOS Build Instructions</b></summary>

Execute the macOS compilation script:
```bash
chmod +x compile-mac.sh
./compile-mac.sh
```
Interactive options:
- **Architecture**: Current Mac, Apple Silicon (ARM64: M1–M5), Intel (x64), or Universal Binary.
- **Format**: DMG installer (`.dmg`), portable zip (`.zip`), full bundle (DMG + ZIP), or unpacked `.app`.
</details>

<details>
<summary><b>Windows Build Instructions</b></summary>

Execute the Windows interactive batch script:
```cmd
compile-windows.bat
```
Generates `OpenLauncher.exe` (custom NSIS installer via `script/installer.nsi`) and `OpenLauncher-Portable-Windows.exe`. Requires [NSIS](https://nsis.sourceforge.io/Download) (or will fallback to Tauri's bundler).
</details>

<details>
<summary><b>Linux Build Instructions</b></summary>

Install system dependencies:
- **Ubuntu / Debian:**
  ```bash
  sudo apt-get update
  sudo apt-get install -y build-essential curl wget file libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev patchelf libwebkit2gtk-4.1-dev
  ```
- **Fedora / RHEL:**
  ```bash
  sudo dnf install -y gcc gcc-c++ webkit2gtk4.1-devel openssl-devel curl wget librsvg2-devel libappindicator-gtk3-devel patchelf
  ```
- **Arch Linux:**
  ```bash
  sudo pacman -S --needed base-devel webkit2gtk-4.1 openssl curl wget librsvg libappindicator-gtk3
  ```

Execute the Linux compilation script:
```bash
chmod +x compile-linux.sh
./compile-linux.sh
```
Interactive options:
- **Debian / Ubuntu package** (`.deb`)
- **Universal AppImage** (`.AppImage` for any Linux distribution)
- **Portable Tarball** (`.tar.gz`)
- **Full bundle** (`.deb` + `.AppImage` + `.tar.gz`)
- **Unpacked directory** (`linux-unpacked`)
</details>

### Custom Microsoft Entra Client ID (For Forks & Developers)

1. Register an app in [Microsoft Entra ID](https://entra.microsoft.com): **App registrations** &rarr; **New registration**.
2. Add Redirect URI: `http://localhost:8080/callback`.
3. Request Xbox Live & Minecraft scopes ([Microsoft Developer Form](https://forms.office.com/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR-ajEQ1td1ROpz00KtS8Gd5UNVpPTkVLNFVROVQxNkdRMEtXVjNQQjdXVC4u)).
4. Test OAuth flow in your local environment.

> [!WARNING]
> Never commit client secrets or refresh tokens to a public repository.

---

## Testing & Benchmarks

- **Hardware**: AMD Ryzen 5 5600G (6-core / 12-thread), AMD Radeon RX 580 (8GB VRAM), 32GB DDR4 RAM, Windows 11 Pro x64
- **Setup**: OpenLauncher 1.2.0, 4GB RAM allocated, Minecraft 1.21.11, Fabric Loader 0.1845, Custom Mods (Distant Horizons, Iris, Sodium, etc.)
- **Shaders**: [MakeUp-UltraFast-9.5e](https://modrinth.com/shader/makeup-ultra-fast-shaders)

<img width="1425" height="901" alt="image" src="https://github.com/user-attachments/assets/2a24a96d-055e-4a53-85bb-8ea3fbfed841" />

---

## Tauri Architecture & Performance

OpenLauncher 1.2.0 migrates the desktop runtime from Electron to **Tauri 2 + Rust**. React 19 and Vite continue to render the user interface, while high-performance Rust services in `src-tauri` handle game management, networking, and system operations.

### Key Performance Advantages:
- **Ultra-Lightweight Footprint:** By leveraging native system webviews (WebKit on macOS, WebKitGTK on Linux, and WebView2 on Windows) instead of bundling a full Chromium browser, the installer size drops from **~150 MB to ~15 MB**, and baseline idle RAM drops from **~220 MB down to ~35 MB**.
- **High-Performance Native Command Layer:** Filesystem operations, multi-threaded Minecraft asset downloads, Java detection, Microsoft OAuth callback handling, and Modrinth API enrichment run with compiled Rust performance.
- **Native Game Supervisor:** Minecraft game processes are launched and supervised via asynchronous Rust threads with zero CPU impact and instant game log streaming.
- **Zero-Overhead Launcher Modes:** Choose between keeping the launcher open, minimizing to background, hiding the window, or terminating the launcher upon game launch to free 100% of resources for Minecraft.
- **Automated Cross-Platform CI:** GitHub Actions compiles native distributions for Windows (NSIS & Portable), Linux (Debian, AppImage, tar.gz), and macOS (Apple Silicon ARM64 & Intel x64).

---

## Contributing & License

Contributions are welcome! Please open issues or submit pull requests following standard GitHub workflows.
This project is licensed under the **[GPL-2.0 License](https://github.com/CesarGarza55/OpenLauncher/blob/main/LICENSE)**.

---

## Credits & Acknowledgements

OpenLauncher is developed and maintained by **[Cesar Garza](https://github.com/CesarGarza55)** with modern AI-assisted engineering workflows for rapid feature iteration and code quality. Built upon [Tauri](https://tauri.app/), [Rust](https://www.rust-lang.org/), [React](https://react.dev/), [Vite](https://vitejs.dev/), [pnpm](https://pnpm.io/), and [Modrinth API](https://docs.modrinth.com/).

---

## Disclaimer

This project is not affiliated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. Review the [Terms and Conditions and Privacy Policy](https://openlauncher.codevbox.com/terms) or contact [support@codevbox.com](mailto:support@codevbox.com).
