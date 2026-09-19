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

## Legacy Python Version

The previous Python-based version of OpenLauncher (legacy) is still available for download in the [Releases](https://github.com/CesarGarza55/OpenLauncher/releases) section. The last version of the legacy system was **Beta-1.7.4**.

The new Electron-based version represents a complete rewrite with improved performance, better cross-platform compatibility, and a modern architecture.

---

## Features

- **Microsoft Account Login**: Supports logging in with an official Microsoft account as well as custom local offline profiles.
- **Modern Interface**: Built with React and Electron for a sleek, responsive, and customizable look.
- **Modrinth Ecosystem Integration**: Search, explore, and install mods directly from Modrinth with full dependency resolution.
- **Smart Mod Updates**: Automatically checks installed mods against Modrinth using file hashes to offer 1-click updates.
- **Fabric Crash & Conflict Assistant**: Intelligently diagnoses incompatibility errors and missing dependencies on launch.
- **Minecraft Compatibility**: Manages Vanilla, Fabric, and Forge versions with custom launch implementations.
- **Per-Profile Configuration**: Custom RAM, JVM arguments, and Java paths saved independently per profile.
- **Official Minecraft News**: Integrated news feed directly from Minecraft.net.
- **Multiplatform & Multilanguage**: Available for Windows, macOS, and Linux with full internationalization (EN, ES, FR).
- **Auto-updater**: Built-in update system for seamless background updates.
- **Open Source**: Easily extensible and modifiable by the community.

---

## Requirements

- **Node.js** 18 or higher
- **npm** or **pnpm** (Node.js package manager)
- **Java** (JDK 17+ recommended for modern Minecraft versions)

---

## Compilation & Installation from Source

<details>
<summary><b>macOS Build Instructions</b></summary>

### Compilation for macOS

> [!NOTE]
> The official macOS releases are compiled only for **Apple Silicon (ARM64)** and require a Mac with an M1, M2, M3, or M4 chip.

1. Clone the repository:
   ```bash
   git clone https://github.com/CesarGarza55/OpenLauncher.git
   cd OpenLauncher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile:
   Execute the macOS build script:
   ```bash
   chmod +x compile-mac.sh
   ./compile-mac.sh
   ```

   You can choose between:
   - **Apple Silicon (ARM64)**: For M1/M2/M3/M4 Macs.
   - **Intel (x64)**: For Intel Macs.
   - **Universal**: For all Macs.

   This will generate:
   - `OpenLauncher-mac-<arch>.dmg` (DMG installer)
   - `OpenLauncher-mac-<arch>.zip` (Portable ZIP archive)

   The automated GitHub release build provides **ARM64** packages only.

4. If macOS blocks the application after copying it to Applications, authorize it from Terminal:
   ```bash
   xattr -cr /Applications/OpenLauncher.app
   ```

5. Make sure Java is installed:
   ```bash
   brew install openjdk
   ```
</details>

<details>
<summary><b>Windows Build Instructions</b></summary>

### Compilation for Windows

1. Clone the repository:
   ```bash
   git clone https://github.com/CesarGarza55/OpenLauncher.git
   cd OpenLauncher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile:
   Run the `compile-windows.bat` script to compile the project:
   ```cmd
   compile-windows.bat
   ```

   This will generate:
   - `OpenLauncher.exe` (NSIS installer)
   - `OpenLauncher-Portable-Windows.exe` (Portable version)

   > [!NOTE]
   > The installer script requires [NSIS](https://nsis.sourceforge.io/Download) to be installed on your system.

4. Make sure Java is installed:
   [https://www.java.com/download/](https://www.java.com/download/)
</details>

<details>
<summary><b>Linux Build Instructions</b></summary>

### Compilation for Linux

1. Clone the repository:
   ```bash
   git clone https://github.com/CesarGarza55/OpenLauncher.git
   cd OpenLauncher
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile:
   Execute the script to start the compilation process:
   ```bash
   chmod +x compile-linux.sh
   ./compile-linux.sh
   ```

   This will generate:
   - `OpenLauncher.deb` (for Debian/Ubuntu-based distributions)
   - `OpenLauncher-Portable-Linux.tar.gz` (for Arch/Fedora/other distributions)

4. Install:
   - **For Debian/Ubuntu-based systems:**
     ```bash
     sudo dpkg -i OpenLauncher.deb
     ```
   - **For Arch/Fedora/other systems:**
     ```bash
     tar -xzf OpenLauncher-Portable-Linux.tar.gz
     cd OpenLauncher
     ./OpenLauncher
     ```
</details>

---

## Download Options

Pre-built binaries are available in the **[Releases](https://github.com/CesarGarza55/OpenLauncher/releases)** section:

| Operating System | Installer | Portable | Architecture |
| :--- | :--- | :--- | :--- |
| **macOS** | `OpenLauncher-mac-arm64.dmg` | `OpenLauncher-mac-arm64.zip` | ARM64 (Apple Silicon) |
| **Windows** | `OpenLauncher.exe` | `OpenLauncher-Portable-Windows.exe` | x64 |
| **Linux** | `OpenLauncher.deb` | `OpenLauncher-Portable-Linux.tar.gz` | x64 |

---

## Usage & Interface Tour

### Main Interface
The main interface provides quick access to profiles, Minecraft versions, installed mods, console output, news, and launcher controls.

<img width="1552" height="897" alt="main" src="https://github.com/user-attachments/assets/814f3417-294c-4a4f-83f3-f1e3f71defef" />

---

### Installing Versions
To install a version (Vanilla, Fabric, Forge), open the installation modal, choose the target game version and loader, and click install:

<img width="1552" height="897" alt="install" src="https://github.com/user-attachments/assets/70412866-f0d1-4c00-b54c-13a03bb142e9" />

---

### Default Optimized JVM Arguments
By default, OpenLauncher uses modern, garbage-collection-optimized JVM arguments for smooth frame pacing:

```bash
-Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M
```

---

### Settings
Customize launcher behavior, Java paths, directory locations, snapshot visibility, language, and auto-updates from the Settings window:

<img width="1552" height="897" alt="settings" src="https://github.com/user-attachments/assets/c9587697-9a6e-45f4-ae26-9d7ca701922a" />

---

## Sign in with Microsoft Account

To log in with your official Microsoft account:

1. Open OpenLauncher.
2. Click on the **Microsoft icon** in the sidebar.
3. Complete the login in the secure browser prompt with your Minecraft-entitled Microsoft account.
4. Once authenticated, your profile skin and username will appear automatically in the launcher.

<img width="279" height="94" alt="microsoft icon" src="https://github.com/user-attachments/assets/5f036741-7007-45f2-819e-034146bd4ba5" />


<details>
<summary><b>Using your own Microsoft Entra Client ID (For Forks & Developers)</b></summary>

### Custom Entra Client ID Setup
The official OpenLauncher builds use a hosted authentication proxy. If you fork this repository and want to use your own Microsoft App (Client ID):

1. Register an app in [Microsoft Entra ID](https://entra.microsoft.com): **App registrations** &rarr; **New registration**.
   - Copy the Application (client) ID — this is your `CLIENT_ID`.
   - In **Authentication**, click **Add a platform**, choose **Mobile and desktop applications**.
   - Add Redirect URI: `http://localhost:8080/callback` (or your configured redirect URI).
2. Implement or route the OAuth flow in your Electron main process.
3. Ensure required permissions/scopes for Xbox Live & Minecraft are granted ([Microsoft Developer Request Form](https://forms.office.com/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR-ajEQ1td1ROpz00KtS8Gd5UNVpPTkVLNFVROVQxNkdRMEtXVjNQQjdXVC4u)).
4. Launch locally and test login.

> [!WARNING]
> Never commit client secrets or refresh tokens to a public repository.
</details>

---

## Mod Manager & Modrinth Integration (Beta)

> [!WARNING]
> Modrinth integration is currently a **beta/experimental feature**. Search, installation, dependency resolution, and update detection may change or behave unexpectedly while the feature is being improved.

The experimental Modrinth integration lets you install, enable, disable, and delete mods:

- **Browse Modrinth**: Search thousands of mods with filters by loader, version, and category.
- **Auto-Update Checker**: Check installed mods against Modrinth and update them in 1 click.
- **Drag & Drop**: Drag `.jar` files straight into the launcher to install them instantly.

<img width="1552" height="897" alt="mods" src="https://github.com/user-attachments/assets/9323d0b7-3c3d-459e-9d91-e62c884d22b2" />

---

<img width="1552" height="897" alt="Modrinth" src="https://github.com/user-attachments/assets/3c29ed21-c4a2-44bb-9c1c-d90a97e99f48" />

---

## Mod Incompatibility Auto-Fixer

When Fabric detects incompatible mods, OpenLauncher analyzes the loader output and presents the recommended resolution in a dedicated conflict dialog. The auto-fixer can apply compatible mod versions and update related dependencies in one action, helping restore the profile without automatically disabling mods.

If Fabric does not provide a reliable automatic fix, the launcher keeps the detected conflict details visible so you can review the affected mods and choose the appropriate solution manually.

<img width="1552" height="897" alt="mod fixer" src="https://github.com/user-attachments/assets/3a0317fe-93d5-4c71-b417-e135aa184356" />

---

## Testing & Performance

### Tested PC Specifications & Configuration

### Hardware Specifications
- **CPU**: Apple M1 (8-core)
- **GPU**: Apple M1 (8-core GPU)
- **RAM**: 8GB Unified Memory
- **OS**: macOS Tahoe 26.x

### Game Benchmark Setup
- **Launcher version**: Release 1.1.0
- **RAM Allocated**: 4GB
- **Minecraft Version**: 1.21.11
- **Fabric Loader**: 0.19.5

- **Shaders**: [MakeUp-UltraFast-9.5e](https://modrinth.com/shader/makeup-ultra-fast-shaders)

<img width="1440" height="784" alt="test" src="https://github.com/user-attachments/assets/8b233cc4-1a1c-47c7-89e2-969f004a15e8" />

---

## Contributing

Contributions are welcome! Follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/new-feature`).
3. Commit your changes (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Open a Pull Request on GitHub.

---

## License

This project is licensed under the **GPL-2.0 License**. For more details, see the [LICENSE](https://github.com/CesarGarza55/OpenLauncher/blob/main/LICENSE) file.

---

## Credits & Acknowledgements

OpenLauncher is developed and maintained by **[Cesar Garza](https://github.com/CesarGarza55)** with modern AI-assisted engineering workflows for rapid feature iteration and code quality.

OpenLauncher uses and builds upon the following open-source tools:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Node.js](https://nodejs.org/)
- [Vite](https://vitejs.dev/)
- [electron-builder](https://www.electron.build/)
- [Modrinth API](https://docs.modrinth.com/)

---

## Disclaimer

This project is in no way related to or associated with Mojang AB or Microsoft. Minecraft is a registered trademark of Mojang AB and Microsoft. All trademarks and intellectual property rights mentioned in this project are the exclusive property of their respective owners. No files belonging to Mojang AB or Microsoft are hosted on servers owned by us.

Review the [Terms and Conditions and Privacy Policy](https://openlauncher.codevbox.com/terms_app). For any questions or concerns, please contact [support@codevbox.com](mailto:support@codevbox.com?subject=OpenLauncher%20Inquiry).

Thank you for using OpenLauncher!
