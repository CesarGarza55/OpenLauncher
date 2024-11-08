import json, locale
import os, sys
import variables

if sys.platform == 'win32':
    platform = ".exe"
elif sys.platform == 'linux':
    platform = ".bin"

lang_codes = ["en", "es"]

# Load the system language
os.makedirs(f'{variables.app_directory}/config', exist_ok=True)
if os.path.exists(f'{variables.app_directory}/config/config.json'):
    with open(f'{variables.app_directory}/config/config.json', 'r') as f:
        try:
            config = json.load(f)
            current_language = config.get('lang')
            if current_language not in lang_codes:
                current_language = "en"
                config["lang"] = current_language
                with open(f'{variables.app_directory}/config/config.json', 'w') as f:
                    json.dump(config, f, indent=4)
        except json.JSONDecodeError:
            current_language = "en"
else:
    current_language = locale.getdefaultlocale()[0].split('_')[0]
    if current_language not in lang_codes:
        current_language = "en"
    
    

languages = {
    "en": {
        "language": "Select Language",
        "available_languages": {
            "en": "English",
            "es": "Spanish"
        },
        "launcher_name": "OpenLauncher",
        "launcher_title": "OpenLauncher for Minecraft",
        "label_username": " Username: ",
        "user_placeholder": "Enter your username (Steve)",
        "checkbox_snapshots": "Show snapshots",
        "btn_install_minecraft": "Install Minecraft",
        "btn_install_loader": "Install Fabric",
        "btn_play": "Play",
        "btn_mod_manager": "Mod Manager",
        "btn_shorts": "Shortcuts",
        "get_started": "Get Started",
        "welcome": "Welcome to OpenLauncher!",
        "welcome_message": (
            "OpenLauncher is a free and open-source launcher for Minecraft that allows you to install and play the version you want, "
            "created with Python and Qt for the GUI.<br>"
            "To get started, you can install the Minecraft version you want, install Fabric or Forge, and play the game. "
            "You can also manage your mods with the Mod Manager and enable Discord Rich Presence.<br><br>"
            f"You can install themes to customize the launcher, you can find them in the <a style='color: #00aaff;' href='{variables.website_url}/plugins'>themes section</a> of the OpenLauncher website.<br><br>"
            f"Visit the <a style='color: #00aaff;' href='{variables.website_url}'>OpenLauncher website</a> for more information.<br><br>"
            "OpenLauncher offers some features like:"
            "<ul>"
            "<li>Install Minecraft versions</li>"
            "<li>Install Fabric and Forge</li>"
            "<li>Play the Minecraft version you want</li>"
            "<li>Manage your mods with the Mod Manage</li>"
            "<li>Enable Discord Rich Presence</li>"
            "<li>Customize the launcher with themes</li>"
            "<li>Multilanguage support</li>"
            "</ul>"
        ),
        "dont_show_again": "Don't show this message again",
        "close": "Close",
        "open_themes_website": "Open Themes Website",
        "open_launcher_directory": "Open Application Directory",
        "open_minecraft_directory": "Open Minecraft Directory",
        "save": "Save changes",
        "discord_rpc": "Enable Discord Rich Presence",
        "jvm_tip": "Leave blank and save to reset to default",
        "label_jvm_args": "JVM arguments (Expert settings)\nIf nothing is specified, default values will be used.\nDon't use this option if you don't know what you're doing.",
        "settings": "Settings",
        "install": "Install",
        "info_label_minecraft": "Install the version of Minecraft you want",
        "info_label_loader": "Install the latest available version of Fabric for the desired Minecraft version",
        "no_internet": "No internet connection",
        "no_username": "Please enter your user name",
        "java_not_installed": "Java is not installed",
        "java_not_installed_linux": "Please install Java to run Minecraft.\n\nFor example, in Ubuntu you can install it with the command 'sudo apt install default-jre'",
        "java_not_installed_win": "It's necessary to install Java to run Minecraft, please install it and restart the launcher",
        "ask_install_java": "Java is not installed. Do you want to open the download page?",
        "no_versions_installed": "No versions installed",
        "forge_installed": "Forge 1.0 has been installed successfully",
        "forge_not_found": "No Forge version found for this version of Minecraft",
        "forge_installation": "Forge for Minecraft 1.0 will be installed, this may take a few minutes depending on your internet connection, please wait...",
        "minecraft_installed": "Minecraft 1.0 has been installed successfully",
        "minecraft_installation": "Minecraft 1.0 will be installed, this may take a few minutes depending on your internet connection, please wait...",
        "login_microsoft": "Login with Microsoft",
        "relogin_microsoft": "Reauthenticate with Microsoft",
        "logout_microsoft": "Logout",
        "microsoft_account_not_found": "Minecraft Java Edition Not Found",
        "microsoft_account_not_found_desc": "It looks like your account doesn't have Minecraft Java Edition. Would you like to visit the official Minecraft website to buy it?",
        "token_expired": "Your session has expired, you need to login again, do you want to login now?",
        "logged_as": "Logged in as",
        "theme_ask": "Multiple themes were found, which may cause issues. Would you like to open the plugins directory to remove the additional themes?",
        "theme_error": "The first detected theme will be attempted for loading, please remove additional themes to prevent issues.",
        "discord_error": "Could not connect to Discord Rich Presence, ensure that Discord is running",
        "mod_manager_info": "The Mod Manager renames mods by adding the current game version to the start of the file name. For example, 'mod.jar' becomes 'VERSION_TEXT_mod.jar'. This lets you manage multiple mod versions for different game versions.\n\nTo install, drag and drop the file or click 'Install mod' (supports .jar and .olpkg files). Avoid activating mods that are incompatible with the current version.\n\nThe 'olpkg' files are OpenLauncher Packages, which are mods that have been deactivated. You can activate them by clicking 'Activate mod'.",
        "mod_manager_disabled": "The Mod Manager is disabled because no compatible version is detected.\nPlease select a valid (Forge, Fabric, Quilt, NeoForge) version in the launcher settings.",
        "active_mods": "Active Mods",
        "inactive_mods": "Inactive Mods",
        "mod_already_exists": "The mod already exists in the list of mods",
        "file_exists": "The file already exists. Do you want to overwrite it?",
        "invalid_file_format": "Invalid file format only .jar and .olpkg files are supported",
        "btn_activate": "Activate mod",
        "btn_install": "Install mod",
        "btn_deactivate": "Deactivate mod",
        "btn_open_mods_dir": "Open Mods Directory",
        "error_no_version": "First install a version to manage mods",
        "auth_window_title": "Microsoft Authentication",
        "auth_window_label": "Please wait while we authenticate you with Microsoft...",
        "auth_success": "Authentication Successful - You can close this window now.",
        "auth_failure": "Authentication Failed - Please try again.",
        "restart_app": "The application needs to restart to apply the changes, do you want to close it now?, you will have to open it manually.",
        "shortcuts": "Shortcuts",
        "shortcuts_info": (
            "You can create shortcuts to launch the game with different configurations. "
            "For example, you can create a shortcut to launch the game with a specific Minecraft version. "
            f"Use the following format: 'OpenLauncher{platform} -mc_ver 1.0 -mc_name Steve', where '1.0' is the Minecraft version and 'Steve' is the username. "
            f"For more information, visit the <a style='color: #00aaff;' href='{variables.website_url}/guide'>OpenLauncher documentation</a>.<br><br>"
            "Example of a shortcut to launch the game with version 1.0 and username Steve:<br>"
            f"<b>'OpenLauncher{platform} -mc_ver 1.0 -mc_name Steve'</b><br><br>"
            f"Use <b>'OpenLauncher{platform} -h'</b> to see the available parameters."
        ),
        "logout_success": "You have successfully logged out",
        "copy_parameters": "Copy parameters",
        "parameters_copied": "Success",
        "parameters_copied_info": "The parameters have been copied to the clipboard, you can add them to the game shortcut",
        "offline_mode": "Offline mode",
        "offline_mode_error": "If you want to play in offline mode, you must enter a username",
        "no_refresh_token": "You must be logged in to use the online mode, please run OpenLauncher without arguments to open the GUI and log in",
        "no_version": "No version has been selected, please run OpenLauncher -mc_ver <version> -mc_name <username> -online <true/false> to run Minecraft",
        "mc_fail": "An error occurred while trying to run Minecraft please run OpenLauncher without arguments to open the GUI",
        "ask_update": "Check for updates",
        "update_available": "An update is available, do you want to download it?",
        "downloading": "Downloading...",
        "download_format": "Select Download Format",
        "select_folder": "Please select the download location.",
        "download_cancelled": "Download cancelled.",
        "download_success": "The download has been completed successfully.",
        "open_bin": "You can open the .bin file using the command './dest' or open it using the file manager.",
        "xterm_not_found": "The automatic installation of the .deb file has failed. Please install it manually using the command 'sudo dpkg -i dest'",
        "update_complete": "The update has been installed successfully.",
        "error_occurred": "An error occurred: ",
    },
    "es": {
        "language": "Seleccionar Idioma",
        "available_languages": {
            "en": "Inglés",
            "es": "Español"
        },
        "launcher_name": "OpenLauncher",
        "launcher_title": "OpenLauncher para Minecraft",
        "label_username": " Nombre de usuario: ",
        "user_placeholder": "Ingresa tu nombre de usuario (Steve)",
        "checkbox_snapshots": "Mostrar snapshots",
        "btn_install_minecraft": "Instalar Minecraft",
        "btn_install_loader": "Instalar Fabric",
        "btn_play": "Jugar",
        "btn_mod_manager": "Gestor de Mods",
        "btn_shorts": "Accesos Directos",
        "get_started": "Inicio",
        "welcome": "¡Bienvenido a OpenLauncher!",
        "welcome_message": (
            "OpenLauncher es un lanzador gratuito y de código abierto para Minecraft que te permite instalar y jugar la versión que desees, "
            "creado con Python y Qt para la interfaz gráfica.<br>"
            "Para comenzar, puedes instalar la versión de Minecraft que desees, instalar Fabric o Forge y jugar al juego. "
            "También puedes gestionar tus mods con el Mod Manager y habilitar Discord Rich Presence.<br><br>"
            f"Puedes instalar temas para personalizar el lanzador, puedes encontrarlos en la <a style='color: #00aaff;' href='{variables.website_url}/plugins'>sección de temas</a> del sitio web de OpenLauncher.<br><br>"
            f"Visita el <a style='color: #00aaff;' href='{variables.website_url}'>sitio web de OpenLauncher</a> para obtener más información.<br><br>"
            "OpenLauncher ofrece algunas características como:"
            "<ul>"
            "<li>Instalar versiones de Minecraft</li>"
            "<li>Instalar Fabric y Forge</li>"
            "<li>Jugar la versión de Minecraft que desees</li>"
            "<li>Gestionar tus mods con el Mod Manager</li>"
            "<li>Habilitar Discord Rich Presence</li>"
            "<li>Personalizar el lanzador con temas</li>"
            "<li>Soporte multilenguaje</li>"
            "</ul>"
        ),
        "dont_show_again": "No mostrar este mensaje de nuevo",
        "close": "Cerrar",
        "open_themes_website": "Abrir Sitio Web de Temas",
        "open_launcher_directory": "Abrir Directorio de la Aplicación",
        "open_minecraft_directory": "Abrir Directorio de Minecraft",
        "save": "Guardar cambios",
        "discord_rpc": "Habilitar Discord Rich Presence",
        "jvm_tip": "Deja en blanco y guarda para restablecer a los valores predeterminados",
        "label_jvm_args": "Argumentos JVM (Configuraciones avanzadas)\nSi no se especifica nada, se utilizarán los valores predeterminados.\nNo utilice esta opción si no sabe lo que está haciendo.",
        "settings": "Configuraciones",
        "install": "Instalar",
        "info_label_minecraft": "Instalar la versión de Minecraft que desees",
        "info_label_loader": "Instalar la última versión disponible de Fabric para la versión de Minecraft deseada",
        "no_internet": "Sin conexión a internet",
        "no_username": "Por favor, ingrese su nombre de usuario",
        "java_not_installed": "Java no está instalado",
        "java_not_installed_linux": "Por favor, instale Java para ejecutar Minecraft.\n\nPor ejemplo, en Ubuntu puedes instalarlo con el comando 'sudo apt install default-jre'",
        "java_not_installed_win": "Es necesario instalar Java para ejecutar Minecraft, por favor instálelo y reinicie el lanzador",
        "ask_install_java": "Java no está instalado. ¿Quieres abrir la página de descarga?",
        "no_versions_installed": "No hay versiones instaladas",
        "forge_installed": "Forge 1.0 se ha instalado correctamente",
        "forge_not_found": "No se encontró ninguna versión de Forge para esta versión de Minecraft",
        "forge_installation": "Se instalará Forge para Minecraft 1.0, esto puede tardar unos minutos dependiendo de tu conexión a internet, por favor espera...",
        "minecraft_installed": "Minecraft 1.0 se ha instalado correctamente",
        "minecraft_installation": "Se instalará Minecraft 1.0, esto puede tardar unos minutos dependiendo de tu conexión a internet, por favor espera...",
        "login_microsoft": "Iniciar sesión con Microsoft",
        "relogin_microsoft": "Reautenticar con Microsoft",
        "logout_microsoft": "Cerrar sesión",
        "microsoft_account_not_found": "Minecraft Java Edition no encontrado",
        "microsoft_account_not_found_desc": "Parece que tu cuenta no tiene Minecraft Java Edition. ¿Te gustaría visitar el sitio web oficial de Minecraft para comprarlo?",
        "token_expired": "Tu sesión ha expirado, necesitas iniciar sesión de nuevo, ¿quieres iniciar sesión ahora?",
        "logged_as": "Conectado como",
        "theme_ask": "Se encontraron varios temas, lo que puede causar problemas. ¿Te gustaría abrir el directorio de plugins para eliminar los temas adicionales?",
        "theme_error": "Se intentará cargar el primer tema detectado, por favor elimine temas adicionales para evitar problemas.",
        "discord_error": "No se pudo conectar a Discord Rich Presence, asegúrese de que Discord esté en ejecución",
        "mod_manager_info": "El Gestor de Mods renombra los mods agregando la versión actual del juego al inicio del nombre del archivo. Por ejemplo, 'mod.jar' se convierte en 'VERSION_TEXT_mod.jar'. Esto te permite gestionar múltiples versiones de mods para diferentes versiones del juego.\n\nPara instalar, arrastra y suelta el archivo o haz clic en 'Instalar mod' (admite archivos .jar y .olpkg). Evita activar mods que sean incompatibles con la versión actual.\n\nLos archivos 'olpkg' son Paquetes OpenLauncher, que son mods que han sido desactivados. Puedes activarlos haciendo clic en 'Activar mod'.",
        "mod_manager_disabled": "El Gestor de Mods está desactivado porque no se detecta ninguna versión compatible.\nPor favor, selecciona una versión válida (Forge, Fabric, Quilt, NeoForge) en la configuración del lanzador.",
        "active_mods": "Mods Activos",
        "inactive_mods": "Mods Inactivos",
        "mod_already_exists": "El mod ya existe en la lista de mods",
        "file_exists": "El archivo ya existe. ¿Quieres sobrescribirlo?",
        "invalid_file_format": "Formato de archivo inválido solo se admiten archivos .jar y .olpkg",
        "btn_activate": "Activar mod",
        "btn_install": "Instalar mod",
        "btn_deactivate": "Desactivar mod",
        "btn_open_mods_dir": "Abrir Directorio de Mods",
        "error_no_version": "Primero instala una versión para gestionar mods",
        "auth_window_title": "Autenticación de Microsoft",
        "auth_window_label": "Por favor, espera mientras te autenticamos con Microsoft...",
        "auth_success": "Autenticación Exitosa - Puedes cerrar esta ventana ahora.",
        "auth_failure": "Autenticación Fallida - Por favor, inténtalo de nuevo.",
        "restart_app": "La aplicación necesita reiniciarse para aplicar los cambios, ¿quieres cerrarla ahora?, tendrás que abrirla manualmente.",
        "shortcuts": "Accesos Directos",
        "shortcuts_info": (
            "Puedes crear accesos directos para lanzar el juego con diferentes configuraciones. "
            "Por ejemplo, puedes crear un acceso directo para lanzar el juego con una versión específica de Minecraft. "
            f"Usa el siguiente formato: 'OpenLauncher{platform} -mc_ver 1.0 -mc_name Steve', donde '1.0' es la versión de Minecraft y 'Steve' es el nombre de usuario. "
            f"Para más información, visita la <a style='color: #00aaff;' href='{variables.website_url}/guide'>documentación de OpenLauncher</a>.<br><br>"
            "Ejemplo de acceso directo para lanzar el juego con la versión 1.0 y el nombre de usuario Steve:<br>"
            f"<b>'OpenLauncher{platform} -mc_ver 1.0 -mc_name Steve'</b><br><br>"
            f"Usa <b>'OpenLauncher{platform} -h'</b> para ver los parámetros disponibles."
        ),
        "logout_success": "Has cerrado sesión correctamente",
        "copy_parameters": "Copiar parámetros",
        "parameters_copied": "Éxito",
        "parameters_copied_info": "Los parámetros se han copiado al portapapeles, puedes agregarlos en el acceso directo al juego",
        "offline_mode": "Modo desconectado",
        "offline_mode_error": "Si deseas jugar en modo desconectado, debes ingresar un nombre de usuario",
        "no_refresh_token": "Debes iniciar sesión para usar el modo en línea, por favor ejecuta OpenLauncher sin argumentos para abrir la GUI e iniciar sesión",
        "no_version": "No se ha seleccionado ninguna versión, por favor ejecuta OpenLauncher -mc_ver <version> -mc_name <username> -online <true/false> para ejecutar Minecraft",
        "mc_fail": "Ocurrió un error al intentar ejecutar Minecraft por favor ejecuta OpenLauncher sin argumentos para abrir la GUI",
        "ask_update": "Buscar actualizaciones",
        "update_available": "Hay una actualización disponible, ¿quieres descargarla?",
        "downloading": "Descargando...",
        "download_format": "Seleccionar Formato de Descarga",
        "select_folder": "Por favor selecciona la ubicación de la descarga.",
        "download_cancelled": "Descarga cancelada.",
        "download_success": "La descarga se ha completado correctamente.",
        "open_bin": "Puedes abrir el archivo .bin usando el comando './dest' o abrirlo usando el administrador de archivos.",
        "xterm_not_found": "La instalación automática del archivo .deb ha fallado. Por favor, instálalo manualmente usando el comando 'sudo dpkg -i dest'",
        "update_complete": "La actualización se ha instalado correctamente.",
        "error_occurred": "Ocurrió un error: ",
    }
}

def lang(lang_code, key):
    return languages.get(lang_code, "es").get(key, key)

def change_language(lang_code="en"):
    global current_language
    current_language = lang_code
    config_path = os.path.join(variables.app_directory, 'config/config.json').replace('\\', '/')
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    # Read the config.json file if it exists
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            try:
                config = json.load(f)
            except json.JSONDecodeError:
                config = {}
    else:
        config = {}

    # Update the language code in the config dictionary
    config["lang"] = lang_code

    # Write the updated config dictionary to the config.json file
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=4)