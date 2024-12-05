import os
import pathlib
import sys
import time
import requests
import minecraft_launcher_lib

# Website URL
website_url = "https://openlauncher.totalh.net"

# Set the default JVM arguments
# Separate the arguments with a comma ("arg1", "arg2", "arg3")
defaultJVM = ["-Xmx2G", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M"]
jvm_arguments = ""

# Define the client ID for the Discord Rich Presence
CLIENT_ID = '1274620174347010069'

# Set the state list for discord rich presence
state_list = ["Block party time!","Crafting away!","Pixel perfectionist!",
            "Mining fun!","Survival mode: On!","Craft, build, repeat!",
            "Creeper avoider!","Epic loot hunting!","Digging deep!",
            "Also available on toaster!","With great power comes great blockiness!",
            "print('Hello world!')","Redstone engineer!","Building a better world!",
            "I am a blockhead!","We love python!","Powered by coffee!",
            "Also try Terraria!","TODO: Delete this later","Don't mine at night!",
            "Why so blocky?","/gamerule keepInventory true","Powered by Redstone!",
            "/op @s","respawning...","rage quitting...","I need a hero!", 
            "zZzz...", "uninstalling...", "loading...", "saving chunks...", 
            "flying is not enabled on this server", "building terrain...",
            "connecting to the server...", "waiting for the server...",
            "generating world...", "loading resources...", "saving world...",
            "punching trees...", "taming a wolf...", "riding a pig...",
            "fishing...", "growing crops...", "brewing potions...", "smelting ores...",
            "enchanting items...", "fighting mobs...", "exploring caves...",
            "climbing mountains...", "building a house...", "building a castle...",
            "building a farm...", "building a redstone contraption...",
            "building a roller coaster...", "building a secret base...",
            "building a city...", "building a space station...", "building a rocket...",
            "building a time machine...", "building a portal...", "building a bridge...",
            "invoking Herobrine...", "L is real 2401", "Herobrine was here...",
            "this isn't a bug, it's a feature!", "this message will never appear again",
            "this message is a lie", "this message is true", "this message is false",
            "this message is a placeholder", "this message is a secret",
            "someone really read this?", "idk what to write here",
            "hi, I'm a message!", "this is a message", "don't read this",
            "why are you reading this?", "why are you still reading this?",
            "making unnecessary messages...", "this message is pointless",
            "help! I'm trapped in a message factory!", "this message is a reference",
            "192.168.1.10", "port 25565", "localhost", "Watch mom, I'm on Discord!",
            "Join the Dark Side, we have cookies!", "The cake is a lie!",
            "Don't look behind you!", "I'm watching you!", "I'm always here!",
            "monetizing your data...", "selling your data...", "collecting data...",
            "calculating pi...", "calculating e...", "calculating the square root of 2...",
            "calculating the meaning of life...", "calculating the answer to everything...",
            "this code is a mess", "i need to refactor this code", "i need to optimize this code",
            "i need to comment this code", "i need to document this code", "i need to test this code",
            "i need to debug this code", "i need to fix this code", "i need to improve this code",
            "if else if else if else...", "are we using all these libraries?",
            "i'm sure there's a lot of unused code here", "this code is a relic from the past",
            "i'm not a malware, trust me", "i'm not a virus, trust me", "i'm not a trojan, trust me",
            "can i see your credit card?", "can i see your social security number?",
            "there's a virus in this message", "this message is a virus", "this message is a trojan"]

# Debug Mode
debug_mode = False

# Show snapshot versions
show_snapshots = False

# Ask for updates
ask_update = "yes"

# Launcher version
version = "1.5.5"
launcher_version = f"beta-{version}"

# User UUID
user_uuid = ""

# Script directory
script_dir = os.path.dirname(__file__)

# Set the paths for the images
bg_path = os.path.join(script_dir, 'img/bg.png').replace("\\", "/")
icon = os.path.join(script_dir, 'img/icon.png').replace("\\", "/")
bg_blur = 10
minecraft_icon = os.path.join(script_dir, 'img/minecraft.png').replace("\\", "/")
fabric_icon = os.path.join(script_dir, 'img/fabric.png').replace("\\", "/")
forge_icon = os.path.join(script_dir, 'img/forge.png').replace("\\", "/")
mod_icon = os.path.join(script_dir, 'img/command_block.png').replace("\\", "/")
settings_icon = os.path.join(script_dir, 'img/settings.png').replace("\\", "/")
play_icon = os.path.join(script_dir, 'img/play.png').replace("\\", "/")
shortcut_icon = os.path.join(script_dir, 'img/shortcut.png').replace("\\", "/")
logout_icon = os.path.join(script_dir, 'img/logout.png').replace("\\", "/")
login_icon = os.path.join(script_dir, 'img/login.png').replace("\\", "/")
steve_icon = os.path.join(script_dir, 'img/steve.png').replace("\\", "/")

# Set the variable theme
bg_color = "17, 33, 115"

# Set app directory
if sys.platform == "win32":
    appdata = os.environ["APPDATA"]
    app_directory = os.path.join(appdata, "OpenLauncher")
elif sys.platform == "linux":
    app_directory = os.path.join(str(pathlib.Path.home()), "OpenLauncher")

# Set plugins directory
if sys.platform == "win32":
    appdata = os.environ["APPDATA"]
    plugins_directory = os.path.join(appdata, "OpenLauncher", "plugins")
    os.makedirs(plugins_directory, exist_ok=True)
elif sys.platform == "linux":
    plugins_directory = os.path.join(str(pathlib.Path.home()), "OpenLauncher", "plugins")

config_dir = os.path.join(app_directory, "config")
refresh_token_file = os.path.join(config_dir, "refresh_token.json")

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

# Function to write a log file
def write_log(text = "", log_type = "latest"):
    text = f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {text}\n"
    os.makedirs(f'{app_directory}/logs', exist_ok=True)
    with open(f'{app_directory}/logs/{log_type}.log', 'a') as f:
        f.write(text)

# Detect if the system has internet connection
def check_network():
    try:
        response = requests.get("https://www.google.com/", timeout=5)
        return response.status_code == 200
    except requests.ConnectionError:
        return False
    except requests.Timeout:
        return False