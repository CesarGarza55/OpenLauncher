import json, locale
import os, sys
import variables

if sys.platform == 'win32':
    platform = ".exe"
elif sys.platform == 'linux':
    platform = ".bin"

lang_codes = ["en", "es", "fr"]

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
            "es": "Spanish",
            "fr": "French",
        },
        "launcher_name": "OpenLauncher",
        "launcher_title": "OpenLauncher for Minecraft",
        "label_username": "Welcome to OpenLauncher\nEnter your username",
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
            f"Visit the <a style='color: #00aaff;' href='{variables.website_url}'>OpenLauncher website</a> for more information.<br><br>"
            "OpenLauncher offers some features like:"
            "<ul>"
            "<li>Install Minecraft versions</li>"
            "<li>Install Fabric and Forge</li>"
            "<li>Play the Minecraft version you want</li>"
            "<li>Enable Discord Rich Presence</li>"
            "<li>Multilanguage support</li>"
            "</ul>"
        ),
        "dont_show_again": "Don't show this message again",
        "close": "Close",
        "open_website": "Open website",
        "open_launcher_directory": "Open Application Directory",
        "open_minecraft_directory": "Open Minecraft Directory",
        "save": "Save changes",
        "discord_rpc": "Enable Discord Rich Presence",
        "jvm_tip": f"Leave blank and save to reset to default values\n ({variables.defaultJVM_string})",
        "label_jvm_args": "JVM arguments (Expert settings)",
        "settings": "Settings",
        "game": "Game",
        "options": "Options",
        "links": "Links",
        "settings_saved": "Settings saved successfully",
        "success": "Success",
        "select_mod": "Select Mod File",
        "back": "Back",
        "install": "Install",
        "info_label_minecraft": "Install the version of Minecraft you want",
        "info_label_loader": "Install the latest available version of Fabric for the desired Minecraft version",
        "loader_label": "Select the loader version",
        "no_internet": "No internet connection",
        "version_error": "Error loading versions. Please restart the launcher.",
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
        "logged_as": "Welcome to OpenLauncher\n\nLogged in as",
        "discord_error": "Could not connect to Discord Rich Presence, ensure that Discord is running",
        "mod_manager_title": "Mod Manager",
        "mod_manager_info": "The Mod Manager renames mods with the game version. Ex: 'mod.jar' to 'fabric-loader-0.17.3-1.21.4_mod.jar'. To install, drag the file or click 'Install mod' (.jar and .olpkg). 'olpkg' files are disabled mods that you can activate.",
        "mod_manager_disabled": "The Mod Manager is disabled because no compatible version is detected.\nPlease select a valid (Forge, Fabric, Quilt, NeoForge) version in the launcher settings.",
        "active_mods": "Active Mods",
        "inactive_mods": "Inactive Mods",
        "mod_already_exists": "The mod already exists in the list of mods",
        "file_exists": "The file already exists. Do you want to overwrite it?",
        "same_file_title": "Same file",
        "same_file": "The file is the same as the destination file so it whill not be installed",
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
        "microsoft_login_title": "Login with Microsoft",
        "microsoft_login_waiting": "Please complete the login in your default web browser.\nThis window will close automatically once login is successful.",
        "microsoft_login_success_title": "Login successful",
        "microsoft_login_success_message": "Login completed successfully.",
        "microsoft_login_close_button": "Close",
        "cancel": "Cancel",
        "ask_logout_title": "Logout",
        "ask_logout_desc": "Are you sure you want to log out? If you log out, you will need to log in again to play with your Microsoft account.",
        "invalid_username": "Invalid username, must be between 3 and 16 characters and not contain spaces or special characters",
        "work_in_progress": "Work in progress",
        "work_in_progress_info": "This feature is not yet available, but will be available in future updates.",
        "microsoft_login_desc": "Log in with your Microsoft account to access Minecraft Java Edition.",
    },
    "es": {
        "language": "Seleccionar Idioma",
        "available_languages": {
            "en": "Inglés",
            "es": "Español",
            "fr": "Francés",
        },
        "launcher_name": "OpenLauncher",
        "launcher_title": "OpenLauncher para Minecraft",
        "label_username": "Bienvenido a OpenLauncher\nIngresa tu nombre de usuario",
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
            f"Visita el <a style='color: #00aaff;' href='{variables.website_url}'>sitio web de OpenLauncher</a> para obtener más información.<br><br>"
            "OpenLauncher ofrece algunas características como:"
            "<ul>"
            "<li>Instalar versiones de Minecraft</li>"
            "<li>Instalar Fabric y Forge</li>"
            "<li>Jugar la versión de Minecraft que desees</li>"
            "<li>Habilitar Discord Rich Presence</li>"
            "<li>Soporte multilenguaje</li>"
            "</ul>"
        ),
        "dont_show_again": "No mostrar este mensaje de nuevo",
        "close": "Cerrar",
        "open_website": "Abrir sitio web",
        "open_launcher_directory": "Abrir Directorio de la Aplicación",
        "open_minecraft_directory": "Abrir Directorio de Minecraft",
        "save": "Guardar cambios",
        "discord_rpc": "Habilitar Discord Rich Presence",
        "jvm_tip": f"Deja en blanco y guarda para restablecer a los valores predeterminados\n ({variables.defaultJVM_string})",
        "label_jvm_args": "Argumentos JVM (Configuraciones avanzadas)",
        "settings": "Configuraciones",
        "game": "Juego",
        "options": "Opciones",
        "links": "Enlaces",
        "settings_saved": "Configuraciones guardadas correctamente",
        "success": "Éxito",
        "select_mod": "Seleccionar Archivo de Mod",
        "back": "Volver",
        "install": "Instalar",
        "info_label_minecraft": "Instalar la versión de Minecraft que desees",
        "info_label_loader": "Instalar la última versión disponible de Fabric para la versión de Minecraft deseada",
        "loader_label": "Selecciona la versión del loader",
        "no_internet": "Sin conexión a internet",
        "version_error": "Error al cargar las versiones. Por favor, reinicia el launcher.",
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
        "logged_as": "Bienvenido a OpenLauncher\n\nConectado como",
        "discord_error": "No se pudo conectar a Discord Rich Presence, asegúrese de que Discord esté en ejecución",
        "mod_manager_title": "Gestor de Mods",
        "mod_manager_info": "El Gestor de Mods renombra los mods con la versión del juego. Ej: 'mod.jar' a 'fabric-loader-0.17.3-1.21.4_mod.jar'. Para instalar, arrastra el archivo o haz clic en 'Instalar mod' (.jar y .olpkg). Los archivos 'olpkg' son mods desactivados que puedes activar.",
        "mod_manager_disabled": "El Gestor de Mods está desactivado porque no se detecta ninguna versión compatible.\nPor favor, selecciona una versión válida (Forge, Fabric, Quilt, NeoForge) en la configuración del lanzador.",
        "active_mods": "Mods Activos",
        "inactive_mods": "Mods Inactivos",
        "mod_already_exists": "El mod ya existe en la lista de mods",
        "file_exists": "El archivo ya existe. ¿Quieres sobrescribirlo?",
        "same_file_title": "Mismo archivo",
        "same_file": "El archivo es el mismo que el archivo de destino, por lo que no se instalará",
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
        "microsoft_login_title": "Iniciar sesión con Microsoft",
        "microsoft_login_waiting": "Completa el inicio de sesión en tu navegador predeterminado.\nEsta ventana se cerrará automáticamente una vez que el inicio de sesión sea exitoso.",
        "microsoft_login_success_title": "Inicio de sesión exitoso",
        "microsoft_login_success_message": "El inicio de sesión se completó correctamente.",
        "microsoft_login_close_button": "Cerrar",
        "cancel": "Cancelar",
        "ask_logout_title": "Cerrar sesión",
        "ask_logout_desc": "¿Estás seguro de que deseas cerrar sesión? Si cierras sesión, tendrás que iniciar sesión de nuevo para jugar con tu cuenta de Microsoft.",
        "invalid_username": "Nombre de usuario inválido, debe tener entre 3 y 16 caracteres y no contener espacios ni caracteres especiales",
        "work_in_progress": "Trabajo en progreso",
        "work_in_progress_info": "Esta función aún no está disponible, pero estará disponible en futuras actualizaciones.",
        "microsoft_login_desc": "Inicia sesión con tu cuenta de Microsoft para acceder a Minecraft Java Edition.",
    },
    "fr": {
        "language": "Sélectionnez la langue",
        "available_languages": {
            "en": "Anglais",
            "es": "Espagnol",
            "fr": "Français",
        },
        "launcher_name": "OpenLauncher",
        "launcher_title": "OpenLauncher pour Minecraft",
        "label_username": "Bienvenue sur OpenLauncher\nEntrez votre nom d'utilisateur",
        "user_placeholder": "Entrez votre nom d'utilisateur (Steve)",
        "checkbox_snapshots": "Afficher les snapshots",
        "btn_install_minecraft": "Installer Minecraft",
        "btn_install_loader": "Installer Fabric",
        "btn_play": "Jouer",
        "btn_mod_manager": "Gestionnaire de Mods",
        "btn_shorts": "Raccourcis",
        "get_started": "Commencer",
        "welcome": "Bienvenue sur OpenLauncher !",
        "welcome_message": (
            "OpenLauncher est un lanceur gratuit et open-source pour Minecraft qui vous permet d'installer et de jouer à la version que vous souhaitez, "
            "créé avec Python et Qt pour l'interface graphique.<br>"
            "Pour commencer, vous pouvez installer la version de Minecraft que vous souhaitez, installer Fabric ou Forge et jouer au jeu. "
            "Vous pouvez également gérer vos mods avec le Mod Manager et activer Discord Rich Presence.<br><br>"
            f"Visitez le <a style='color: #00aaff;' href='{variables.website_url}'>site web OpenLauncher</a> pour plus d'informations.<br><br>"
            "OpenLauncher offre quelques fonctionnalités comme :"
            "<ul>"
            "<li>Installer des versions de Minecraft</li>"
            "<li>Installer Fabric et Forge</li>"
            "<li>Jouer à la version de Minecraft que vous souhaitez</li>"
            "<li>Activer Discord Rich Presence</li>"
            "<li>Support multilingue</li>"
            "</ul>"
        ),
        "dont_show_again": "Ne plus afficher ce message",
        "close": "Fermer",
        "open_website": "Ouvrir le site web",
        "open_launcher_directory": "Ouvrir le répertoire de l'application",
        "open_minecraft_directory": "Ouvrir le répertoire de Minecraft",
        "save": "Enregistrer les modifications",
        "discord_rpc": "Activer Discord Rich Presence",
        "jvm_tip": f"Laissez vide et enregistrez pour réinitialiser aux valeurs par défaut\n ({variables.defaultJVM_string})",
        "label_jvm_args": "Arguments JVM (Paramètres avancés)",
        "settings": "Paramètres",
        "game": "Jeu",
        "options": "Options",
        "links": "Liens",
        "settings_saved": "Paramètres enregistrés avec succès",
        "success": "Succès",
        "select_mod": "Sélectionner Fichier Mod",
        "back": "Retour",
        "install": "Installer",
        "info_label_minecraft": "Installer la version de Minecraft que vous souhaitez",
        "info_label_loader": "Installer la dernière version disponible de Fabric pour la version de Minecraft souhaitée",
        "loader_label": "Sélectionnez la version du loader",
        "no_internet": "Pas de connexion internet",
        "version_error": "Erreur lors du chargement des versions. Veuillez redémarrer le lanceur.",
        "no_username": "Veuillez entrer votre nom d'utilisateur",
        "java_not_installed": "Java n'est pas installé",
        "java_not_installed_linux": "Veuillez installer Java pour exécuter Minecraft.\n\nPar exemple, sur Ubuntu, vous pouvez l'installer avec la commande 'sudo apt install default-jre'",
        "java_not_installed_win": "Il est nécessaire d'installer Java pour exécuter Minecraft, veuillez l'installer et redémarrer le lanceur",
        "ask_install_java": "Java n'est pas installé. Voulez-vous ouvrir la page de téléchargement ?",
        "no_versions_installed": "Aucune version installée",
        "forge_installed": "Forge 1.0 a été installé avec succès",
        "forge_not_found": "Aucune version de Forge trouvée pour cette version de Minecraft",
        "forge_installation": "Forge pour Minecraft 1.0 sera installé, cela peut prendre quelques minutes en fonction de votre connexion internet, veuillez patienter...",
        "minecraft_installed": "Minecraft 1.0 a été installé avec succès",
        "minecraft_installation": "Minecraft 1.0 sera installé, cela peut prendre quelques minutes en fonction de votre connexion internet, veuillez patienter...",
        "login_microsoft": "Connexion avec Microsoft",
        "relogin_microsoft": "Réauthentifier avec Microsoft",
        "logout_microsoft": "Déconnexion",
        "microsoft_account_not_found": "Minecraft Java Edition introuvable",
        "microsoft_account_not_found_desc": "Il semble que votre compte n'a pas Minecraft Java Edition. Souhaitez-vous visiter le site web officiel de Minecraft pour l'acheter ?",
        "token_expired": "Votre session a expiré, vous devez vous reconnecter, voulez-vous vous connecter maintenant ?",
        "logged_as": "Bienvenue sur OpenLauncher\n\nConnecté en tant que",
        "discord_error": "Impossible de se connecter à Discord Rich Presence, assurez-vous que Discord est en cours d'exécution",
        "mod_manager_title": "Gestionnaire de Mods",
        "mod_manager_info": "Le Mod Manager renomme les mods avec la version du jeu. Ex : 'mod.jar' en 'fabric-loader-0.17.3-1.21.4_mod.jar'. Pour installer, faites glisser le fichier ou cliquez sur 'Installer mod' (.jar et .olpkg). Les fichiers 'olpkg' sont des mods désactivés que vous pouvez activer.",
        "mod_manager_disabled": "Le Mod Manager est désactivé car aucune version compatible n'est détectée.\nVeuillez sélectionner une version valide (Forge, Fabric, Quilt, NeoForge) dans les paramètres du lanceur.",
        "active_mods": "Mods Actifs",
        "inactive_mods": "Mods Inactifs",
        "mod_already_exists": "Le mod existe déjà dans la liste des mods",
        "file_exists": "Le fichier existe déjà. Voulez-vous l'écraser ?",
        "same_file_title": "Même fichier",
        "same_file": "Le fichier est le même que le fichier de destination, il ne sera donc pas installé",
        "invalid_file_format": "Format de fichier invalide seuls les fichiers .jar et .olpkg sont pris en charge",
        "btn_activate": "Activer mod",
        "btn_install": "Installer mod",
        "btn_deactivate": "Désactiver mod",
        "btn_open_mods_dir": "Ouvrir le répertoire des mods",
        "error_no_version": "Installez d'abord une version pour gérer les mods",
        "auth_window_title": "Authentification Microsoft",
        "auth_window_label": "Veuillez patienter pendant que nous vous authentifions avec Microsoft...",
        "auth_success": "Authentification réussie - Vous pouvez fermer cette fenêtre maintenant.",
        "auth_failure": "Échec de l'authentification - Veuillez réessayer.",
        "restart_app": "L'application doit redémarrer pour appliquer les modifications, voulez-vous la fermer maintenant ? Vous devrez l'ouvrir manuellement.",
        "shortcuts": "Raccourcis",
        "shortcuts_info": (
            "Vous pouvez créer des raccourcis pour lancer le jeu avec différentes configurations. "
            "Par exemple, vous pouvez créer un raccourci pour lancer le jeu avec une version spécifique de Minecraft. "
            f"Utilisez le format suivant : 'OpenLauncher{platform} -mc_ver 1.0 -mc_name Steve', où '1.0' est la version de Minecraft et 'Steve' est le nom d'utilisateur. "
            f"Pour plus d'informations, visitez la <a style='color: #00aaff;' href='{variables.website_url}/guide'>documentation OpenLauncher</a>.<br><br>"
            "Exemple de raccourci pour lancer le jeu avec la version 1.0 et le nom d'utilisateur Steve :<br>"
            f"<b>'OpenLauncher{platform} -mc_ver 1.0 -mc_name Steve'</b><br><br>"
            f"Utilisez <b>'OpenLauncher{platform} -h'</b> pour voir les paramètres disponibles."
        ),
        "logout_success": "Vous avez bien été déconnecté",
        "copy_parameters": "Copier les paramètres",
        "parameters_copied": "Succès",
        "parameters_copied_info": "Les paramètres ont été copiés dans le presse-papiers, vous pouvez les ajouter au raccourci du jeu",
        "offline_mode": "Mode hors ligne",
        "offline_mode_error": "Si vous souhaitez jouer en mode hors ligne, vous devez entrer un nom d'utilisateur",
        "no_refresh_token": "Vous devez être connecté pour utiliser le mode en ligne, veuillez exécuter OpenLauncher sans arguments pour ouvrir l'interface graphique et vous connecter",
        "no_version": "Aucune version n'a été sélectionnée, veuillez exécuter OpenLauncher -mc_ver <version> -mc_name <username> -online <true/false> pour exécuter Minecraft",
        "mc_fail": "Une erreur s'est produite lors de l'essai d'exécution de Minecraft, veuillez exécuter OpenLauncher sans arguments pour ouvrir l'interface graphique",
        "ask_update": "Vérifier les mises à jour",
        "update_available": "Une mise à jour est disponible, voulez-vous la télécharger ?",
        "downloading": "Téléchargement...",
        "download_format": "Sélectionner le format de téléchargement",
        "select_folder": "Veuillez sélectionner l'emplacement du téléchargement.",
        "download_cancelled": "Téléchargement annulé.",
        "download_success": "Le téléchargement a été effectué avec succès.",
        "open_bin": "Vous pouvez ouvrir le fichier .bin en utilisant la commande './dest' ou l'ouvrir en utilisant le gestionnaire de fichiers.",
        "xterm_not_found": "L'installation automatique du fichier .deb a échoué. Veuillez l'installer manuellement en utilisant la commande 'sudo dpkg -i dest'",
        "update_complete": "La mise à jour a été installée avec succès.",
        "error_occurred": "Une erreur s'est produite : ",
        "microsoft_login_title": "Connexion avec Microsoft",
        "microsoft_login_waiting": "Complétez le processus de connexion dans votre navigateur web par défaut.\nCette fenêtre se fermera automatiquement une fois la connexion réussie.",
        "microsoft_login_success_title": "Connexion réussie",
        "microsoft_login_success_message": "Le processus de connexion est terminé avec succès.",
        "microsoft_login_close_button": "Fermer",
        "cancel": "Annuler",
        "ask_logout_title": "Déconnexion",
        "ask_logout_desc": "Êtes-vous sûr de vouloir vous déconnecter ? Si vous vous déconnectez, vous devrez vous reconnecter pour jouer avec votre compte Microsoft.",
        "invalid_username": "Nom d'utilisateur invalide, doit contenir entre 3 et 16 caractères et ne doit pas contenir d'espaces ou de caractères spéciaux",
        "work_in_progress": "Travail en cours",
        "work_in_progress_info": "Cette fonctionnalité n'est pas encore disponible, mais le sera dans les prochaines mises à jour.",
        "microsoft_login_desc": "Inicia sesión con tu cuenta de Microsoft para acceder a Minecraft Java Edition.",
    }
}

# Function to get the language string
def lang(lang_code, key):
    return languages.get(lang_code, "en").get(key, key)

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