"""
OpenLauncher - Open Source Minecraft Launcher
Main entry point for the application

Refactored for better maintainability with modular structure
"""

import time, os, sys, argparse
import minecraft_launcher_lib
from PyQt5.QtWidgets import QApplication
from tkinter import messagebox
import variables
from updater import update
from microsoft_auth import login
from lang import lang, change_language, current_language
from mc_run import run_minecraft
from discord_manager import DiscordManager
from config_manager import ConfigManager
from main_window import MainWindow
from ui_methods import LoadingScreen, MainWindowLoader
from material_design import apply_material_theme

# Function to handle exceptions
def handle_exception(exc_type, exc_value, exc_traceback):
    """Log exceptions instead of crashing"""
    variables.write_log(f"Exception: {exc_type}, {exc_value}", "exception")

# Set exception hook
# sys.excepthook = handle_exception

# Parse command line arguments for CLI mode
parser = argparse.ArgumentParser(description='Run the desired Minecraft version without using a GUI')
parser.add_argument('-mc_ver', type=str, help='Minecraft version to run')
parser.add_argument('-mc_name', type=str, help='Minecraft username (only for offline mode)')
parser.add_argument('-jvm_args', type=str, help='JVM arguments (optional)')
parser.add_argument('-online', type=str, help='Use the online mode (optional) (true/false)')
parser.add_argument('-mc_dir', type=str, help='Minecraft directory (optional)')
args = parser.parse_args()

# Handle CLI mode if arguments are provided
if args.mc_ver or args.mc_name or args.jvm_args or args.online or args.mc_dir:
    if args.online == "true":
        if not os.path.exists(variables.refresh_token_file):
            messagebox.showerror("Error", lang(current_language, "no_refresh_token"))
            sys.exit()
        try:
            profile = login(current_language, None)
            if profile and 'id' in profile and 'name' in profile:
                args.mc_name = profile['name']
                args.online = profile['access_token']
            else:
                messagebox.showerror("Error", "Could not authenticate")
                sys.exit()
        except Exception as e:
            messagebox.showerror("Error", f"Could not authenticate: {e}")
            sys.exit()
    
    mc = run_minecraft(args.mc_ver, args.mc_name, args.jvm_args, args.online, args.mc_dir)
    if mc == "No version":
        messagebox.showerror("Error", lang(current_language, "no_version"))
    if mc == "MC_FAIL":
        messagebox.showerror("Error", lang(current_language, "mc_fail"))
    sys.exit()

# Workaround for Qt platform plugin on Linux with Wayland
# if sys.platform == "linux" and "wayland" in os.environ.get("XDG_SESSION_TYPE", "").lower():
#     os.environ["QT_QPA_PLATFORM"] = "x11"

# Initialize system language
system_lang = current_language

# Initialize configuration manager
config_manager = ConfigManager(variables.app_directory)

# Load configuration and determine language
config = config_manager.load_config()

if config.get("first_time", True):
    # For first run, keep the detected system language
    pass
elif config.get("lang", ""):
    # Use saved language preference
    change_language(config["lang"])
    system_lang = config["lang"]
else:
    # Fallback to English
    change_language("en")
    system_lang = "en"
    config["lang"] = "en"
    config_manager.save_config(config)

# Check for updates
if config_manager.get_ask_update() == "yes":
    update()

# Initialize Discord manager
discord_manager = DiscordManager()

# Use modern Material Design theme (no plugin system)
icon = variables.icon

# Initialize empty version lists (will be loaded in background)
versions = list()
forge_versions = list()
fabric_versions = list()
fabric_loaders = list()

def load_versions_async():
    """Load Minecraft versions in background thread"""
    global versions, forge_versions, fabric_versions, fabric_loaders
    try:
        versions = minecraft_launcher_lib.utils.get_version_list()
        forge_versions = minecraft_launcher_lib.forge.list_forge_versions()
        fabric_versions = minecraft_launcher_lib.fabric.get_all_minecraft_versions()
        fabric_loaders = minecraft_launcher_lib.fabric.get_all_loader_versions()
    except Exception as e:
        variables.write_log(f"Error loading versions: {e}", "version_load")
        versions = list()
        forge_versions = list()
        fabric_versions = list()
        fabric_loaders = list()

def initialize_main_window(loading_screen, app, version_loader):
    """Initialize the main window"""
    # Wait for versions to load
    version_loader.wait()

    window = MainWindow(
        icon,
        system_lang,
        versions,
        forge_versions,
        fabric_versions,
        fabric_loaders,
        discord_manager,
        config_manager,
        app
    )

    loading_screen.loader_thread = MainWindowLoader()
    loading_screen.loader_thread.finished.connect(lambda: show_main_window(loading_screen, window))
    loading_screen.loader_thread.start()

    return window

def show_main_window(loading_screen, window):
    """Show the main window after loading"""
    if sys.platform == "linux":
        time.sleep(2)  # Add delay to ensure splash screen is visible on Linux
    
    loading_screen.close()
    window.show()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # Apply modern Material Design theme
    apply_material_theme(app)
    
    # Create and show loading screen
    loading_screen = LoadingScreen()
    loading_screen.show()
    app.processEvents()  # Force screen to show immediately
    
    # Start loading versions in background thread
    from PyQt5.QtCore import QThread
    
    class VersionLoader(QThread):
        def run(self):
            load_versions_async()
    
    version_loader = VersionLoader()
    version_loader.start()
    
    # Initialize main window (it will wait for versions internally)
    window = initialize_main_window(loading_screen, app, version_loader)
    
    # Keep application responsive while loading
    while loading_screen.isVisible():
        app.processEvents()
    
    # Show "Get Started" tab if first time
    if config.get("first_time", True):
        window.add_get_started_tab()
        config["first_time"] = True  # Mark that first time setup has been completed
        config["lang"] = system_lang  # Save the detected language
        config_manager.save_config(config)
    
    # Show window and update Discord error display
    window.show()
    window.update_error_discord()
    
    # Register Discord cleanup if enabled
    discord_manager.register_cleanup()
    
    # Start application event loop
    sys.exit(app.exec_())

# I have been working on this for idk how long, i stopped counting the hours long ago
# When i fix a bug, another one appears, and when i fix that one, another four appear
# Functions that worked perfectly before, suddenly stop working and i have to rewrite them
# I considerate to rewrite the whole code from scratch, but i don't tink it will be worth it
# If someone wants to rewrite this, feel free to do it, i will not try to refactor this again
# I will keep making updates, but i'm not sure if i will be able to fix all the bugs someday
# The code is a mess, but hey, it works, and that's what matters XD