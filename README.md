<p align="center">
  <img width="96px" src="public/icon.webp" alt="OpenLauncher" />
  <h1 align="center">OpenLauncher</h1>
  <p align="center">
    A fast, modern, and open-source Minecraft launcher built with <b>React</b> and <b>Electron</b> for <b>Windows</b>, <b>macOS</b>, and <b>Linux</b>.
  </p>
</p>

<p align="center">
  <a href="https://github.com/CesarGarza55/OpenLauncher/releases"><img alt="Latest Release" src="https://img.shields.io/github/v/release/CesarGarza55/OpenLauncher?style=flat&color=3b82f6" /></a>
  <img alt="License" src="https://img.shields.io/badge/License-GPL--2.0-blue.svg?style=flat" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33+-47848F?style=flat&logo=electron&logoColor=white" />
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
| **macOS** | `OpenLauncher-mac-arm64.dmg` | `OpenLauncher-mac-arm64.zip` | ARM64 (Apple Silicon: M1–M5) |
| **Windows** | `OpenLauncher.exe` | `OpenLauncher-Portable-Windows.exe` | x64 |
| **Linux** | `OpenLauncher.deb` | `OpenLauncher-Portable-Linux.tar.gz` | x64 |

> [!TIP]
> **macOS Installation Note:**
> macOS automatically places downloaded applications from third-party sources into quarantine if they are not signed with a paid Apple Developer certificate. If macOS shows *"OpenLauncher is damaged and can't be opened"*, open Terminal and run:
> ```bash
> sudo xattr -rd com.apple.quarantine /Applications/OpenLauncher.app
> ```

<details>
<summary><b>Legacy Python Version (Beta-1.7.4)</b></summary>

The previous Python-based version of OpenLauncher (legacy) is still available for download in the [Releases](https://github.com/CesarGarza55/OpenLauncher/releases) section. The last version of the legacy system was **Beta-1.7.4**.
The current Electron-based version represents a complete rewrite with improved performance, cross-platform stability, and a modern reactive UI.
</details>

---

## Features

- **Microsoft & Offline Profiles**: Secure authentication via official Microsoft OAuth, plus offline local profile support.
- **Modrinth Hub (Mods, Shaders & Texture Packs)**: Direct online browsing and 1-click installation of mods, shaders, and resource packs with auto-dependency resolution and update checks.
- **My Library Management**: Dedicated tabs for local Mods, Shaders, and Texture Packs with live item counts and folder access.
- **Fabric Conflict & Incompatibility Auto-Fixer**: Diagnoses Fabric crash logs and harmonizes mod versions in 1 click.
- **Unified Version Installer**: Fast installation of **Vanilla**, **Fabric**, **Forge**, **NeoForge**, and **Quilt** versions with live Minecraft Snapshot support.
- **Fine-Tuned Performance**: Per-profile RAM allocation, custom Java paths, and smart version-aware JVM garbage collection presets (Generational ZGC for Java 21+, Aikar's G1GC for Java 8–17).
- **News Feed & Customization**: Integrated official Minecraft news, multi-language support (EN, ES, FR), and auto-updater.

---

## Interface Tour

### Main Dashboard
Quick access to profiles, version selectors, installed mods, real-time console output, official news, and launcher settings.

<img width="1552" height="897" alt="OpenLauncher Main Interface" src="https://github.com/user-attachments/assets/814f3417-294c-4a4f-83f3-f1e3f71defef" />

<details>
<summary><b>View Interface Details & Screenshots (Versions, Settings, Microsoft Login, Mod Manager, Auto-Fixer)</b></summary>

#### Version Installation
Install Vanilla, Fabric, Forge, NeoForge, or Quilt versions with automatic catalog loading and snapshot filters:

<img width="1552" height="897" alt="Version Installer" src="https://github.com/user-attachments/assets/70412866-f0d1-4c00-b54c-13a03bb142e9" />

#### Settings & Customization
Configure game directories, custom Java JREs, auto-updates, JVM arguments, and language options:

<img width="1552" height="897" alt="Launcher Settings" src="https://github.com/user-attachments/assets/c9587697-9a6e-45f4-ae26-9d7ca701922a" />

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

#### Mod Manager & Modrinth Browser (Beta)
Browse thousands of mods, check installed mod updates against Modrinth hashes, and drag-and-drop `.jar` files:

<img width="1552" height="897" alt="Mod Manager" src="https://github.com/user-attachments/assets/9323d0b7-3c3d-459e-9d91-e62c884d22b2" />

<img width="1552" height="897" alt="Modrinth Browser" src="https://github.com/user-attachments/assets/8380e6b5-ce06-408c-ae42-d5334c3dfb1d" />


#### Mod Incompatibility Auto-Fixer
When Fabric detects conflicting mods, OpenLauncher parses the diagnostic tree and applies harmonized versions in one action:

<img width="1552" height="897" alt="Mod Auto-Fixer" src="https://github.com/user-attachments/assets/3a76a061-743c-4cb0-b00c-aec1b5e64aed" />

</details>

---

## Build from Source

**Requirements:** Node.js 18+, npm/pnpm, Java JDK 17+.

```bash
git clone https://github.com/CesarGarza55/OpenLauncher.git
cd OpenLauncher
npm install
```

<details>
<summary><b>macOS Build Instructions</b></summary>

Execute the macOS compilation script:
```bash
chmod +x compile-mac.sh
./compile-mac.sh
```
Choose Apple Silicon (ARM64), Intel (x64), or Universal to generate `.dmg` and `.zip` packages in `release/`.
</details>

<details>
<summary><b>Windows Build Instructions</b></summary>

Execute the Windows batch script:
```cmd
compile-windows.bat
```
Generates `OpenLauncher.exe` (NSIS installer) and `OpenLauncher-Portable-Windows.exe`. Requires [NSIS](https://nsis.sourceforge.io/Download).
</details>

<details>
<summary><b>Linux Build Instructions</b></summary>

Execute the Linux compilation script:
```bash
chmod +x compile-linux.sh
./compile-linux.sh
```
Generates `OpenLauncher.deb` (Debian/Ubuntu) and `OpenLauncher-Portable-Linux.tar.gz`.
</details>

<details>
<summary><b>Custom Microsoft Entra Client ID (For Forks & Developers)</b></summary>

1. Register an app in [Microsoft Entra ID](https://entra.microsoft.com): **App registrations** &rarr; **New registration**.
2. Add Redirect URI: `http://localhost:8080/callback`.
3. Request Xbox Live & Minecraft scopes ([Microsoft Developer Form](https://forms.office.com/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR-ajEQ1td1ROpz00KtS8Gd5UNVpPTkVLNFVROVQxNkdRMEtXVjNQQjdXVC4u)).
4. Test OAuth flow in your local environment.

> [!WARNING]
> Never commit client secrets or refresh tokens to a public repository.
</details>

---

## Testing & Benchmarks

- **Hardware**: Apple M1 (8-core CPU / 8-core GPU), 8GB Unified Memory, macOS Tahoe 26.x
- **Setup**: OpenLauncher 1.1.0, 4GB RAM allocated, Minecraft 1.21.11, Fabric Loader 0.19.5
- **Shaders**: [MakeUp-UltraFast-9.5e](https://modrinth.com/shader/makeup-ultra-fast-shaders)

<img width="1440" height="784" alt="In-Game Test Screenshot" src="https://github.com/user-attachments/assets/8b233cc4-1a1c-47c7-89e2-969f004a15e8" />

---

## Contributing & License

Contributions are welcome! Please open issues or submit pull requests following standard GitHub workflows.
This project is licensed under the **[GPL-2.0 License](https://github.com/CesarGarza55/OpenLauncher/blob/main/LICENSE)**.

---

## Credits & Acknowledgements

OpenLauncher is developed and maintained by **[Cesar Garza](https://github.com/CesarGarza55)** with modern AI-assisted engineering workflows for rapid feature iteration and code quality. Built upon [Electron](https://www.electronjs.org/), [React](https://react.dev/), [Vite](https://vitejs.dev/), [Node.js](https://nodejs.org/), [electron-builder](https://www.electron.build/), and [Modrinth API](https://docs.modrinth.com/).

---

## Disclaimer

This project is not affiliated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. Review the [Terms and Conditions and Privacy Policy](https://openlauncher.codevbox.com/terms_app) or contact [support@codevbox.com](mailto:support@codevbox.com).
