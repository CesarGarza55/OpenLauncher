import os
import pathlib
import sys
import minecraft_launcher_lib

# Set the default JVM arguments
# Separate the arguments with a comma ("arg1", "arg2", "arg3")
defaultJVM = ["-Xmx2G", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M"]
jvm_arguments = ""
# Debug Mode
debug_mode = False

# Show snapshot versions
show_snapshots = False

# Ask for updates
ask_update = "yes"

# Launcher version
launcher_version = "beta-1.0.0"

# User UUID
user_uuid = ""

# Script directory
script_dir = os.path.dirname(__file__)

# Set the paths for the images
bg_path = os.path.join(script_dir, 'img/bg.jpg').replace("\\", "/")
uncheck_path = os.path.join(script_dir, 'img/uncheck.png').replace("\\", "/")
uncheck_hover_path = os.path.join(script_dir, 'img/uncheck_hover.png').replace("\\", "/")
check_path = os.path.join(script_dir, 'img/check.png').replace("\\", "/")
check_hover_path = os.path.join(script_dir, 'img/check_hover.png').replace("\\", "/")
icon = os.path.join(script_dir, 'img/creeper_black.png').replace("\\", "/")

# Set Minecraft directory
if debug_mode:
    # Define a custom Minecraft directory for testing
    if sys.platform == "win32":
        appdata = os.environ["APPDATA"]
        minecraft_directory = os.path.join(appdata, ".launcher")
    elif sys.platform == "linux":
        minecraft_directory = os.path.join(str(pathlib.Path.home()), ".launcher")
else:
    # Gets the default Minecraft directory (.minecraft)
    minecraft_directory = minecraft_launcher_lib.utils.get_minecraft_directory()