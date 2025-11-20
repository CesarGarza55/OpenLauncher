import os
import pathlib
import sys
import time
import requests
import minecraft_launcher_lib
import json

# Optional secure storage for refresh tokens via keyring
try:
    import keyring
    KEYRING_AVAILABLE = True
except Exception:
    keyring = None
    KEYRING_AVAILABLE = False

# Website URL
website_url = "https://openlauncher.codevbox.com"

# Set the default JVM arguments
# Separate the arguments with a comma ("arg1", "arg2", "arg3")
defaultJVM = ["-Xmx2G", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M"]
# Default JVM arguments as a string
defaultJVM_string = " ".join(defaultJVM).strip()[:60] + "..."
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
version = "1.7.0"
launcher_version = f"beta-{version}"

# User UUID
user_uuid = ""

# Script directory
script_dir = os.path.dirname(__file__)

# Set the paths for the images
icon = os.path.join(script_dir, 'img/icon.webp').replace("\\", "/")
minecraft_icon = os.path.join(script_dir, 'img/minecraft.webp').replace("\\", "/")
fabric_icon = os.path.join(script_dir, 'img/fabric.webp').replace("\\", "/")
forge_icon = os.path.join(script_dir, 'img/forge.webp').replace("\\", "/")
mod_icon = os.path.join(script_dir, 'img/command_block.webp').replace("\\", "/")
settings_icon = os.path.join(script_dir, 'img/settings.webp').replace("\\", "/")
play_icon = os.path.join(script_dir, 'img/play.webp').replace("\\", "/")
logout_icon = os.path.join(script_dir, 'img/logout.webp').replace("\\", "/")
login_icon = os.path.join(script_dir, 'img/login.webp').replace("\\", "/")
splash_screen = os.path.join(script_dir, 'img/splash.webp').replace("\\", "/")
steve_head = os.path.join(script_dir, 'img/steve.webp').replace("\\", "/")

# Set app directory
if sys.platform == "win32":
    app_directory = os.path.join(os.path.expanduser("~"), "OpenLauncher")
    os.makedirs(app_directory, exist_ok=True)
elif sys.platform == "linux":
    app_directory = os.path.join(str(pathlib.Path.home()), "OpenLauncher")
    os.makedirs(app_directory, exist_ok=True)

# Set config directory and refresh token file path
config_dir = os.path.join(app_directory, "config")
refresh_token_file = os.path.join(config_dir, "refresh_token.json")


SERVICE_NAME = "OpenLauncher"


def save_refresh_token(token):
    """Save refresh token using keyring if available, otherwise to a protected file."""
    try:
        s = token if isinstance(token, str) else json.dumps(token)
    except Exception:
        s = str(token)

    if KEYRING_AVAILABLE:
        try:
            keyring.set_password(SERVICE_NAME, 'refresh_token', s)
            return
        except Exception:
            pass

    # Fallback to file
    try:
        os.makedirs(config_dir, exist_ok=True)
        path = refresh_token_file
        with open(path, 'w', encoding='utf-8') as f:
            f.write(s)
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass
    except Exception:
        pass


def _profile_token_name(profile_key: str):
    # internal helper name for keyring or file
    return f"refresh_token:{profile_key}"


def save_refresh_token_for(profile_key: str, token):
    """Save refresh token for a specific profile."""
    try:
        s = token if isinstance(token, str) else json.dumps(token)
    except Exception:
        s = str(token)

    name = _profile_token_name(profile_key)
    if KEYRING_AVAILABLE:
        try:
            keyring.set_password(SERVICE_NAME, name, s)
            return
        except Exception:
            pass

    # Fallback to file per profile
    try:
        os.makedirs(config_dir, exist_ok=True)
        path = os.path.join(config_dir, f"refresh_token_{profile_key}.json")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(s)
        try:
            os.chmod(path, 0o600)
        except Exception:
            pass
    except Exception:
        pass


def load_refresh_token_for(profile_key: str):
    """Load refresh token for a specific profile. Returns None if not found."""
    name = _profile_token_name(profile_key)
    if KEYRING_AVAILABLE:
        try:
            s = keyring.get_password(SERVICE_NAME, name)
            if s:
                try:
                    return json.loads(s)
                except Exception:
                    return s
        except Exception:
            pass

    path = os.path.join(config_dir, f"refresh_token_{profile_key}.json")
    if os.path.isfile(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                s = f.read()
            try:
                return json.loads(s)
            except Exception:
                return s
        except Exception:
            return None

    return None


def delete_refresh_token_for(profile_key: str):
    """Delete stored refresh token for a specific profile."""
    name = _profile_token_name(profile_key)
    if KEYRING_AVAILABLE:
        try:
            keyring.delete_password(SERVICE_NAME, name)
        except Exception:
            pass
    try:
        path = os.path.join(config_dir, f"refresh_token_{profile_key}.json")
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def load_refresh_token():
    """Load refresh token from keyring or fallback file. Returns None if not found."""
    if KEYRING_AVAILABLE:
        try:
            s = keyring.get_password(SERVICE_NAME, 'refresh_token')
            if s:
                try:
                    return json.loads(s)
                except Exception:
                    return s
        except Exception:
            pass

    path = refresh_token_file
    if os.path.isfile(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                s = f.read()
            try:
                return json.loads(s)
            except Exception:
                return s
        except Exception:
            return None

    return None


def delete_refresh_token():
    """Remove stored refresh token from keyring and fallback file."""
    if KEYRING_AVAILABLE:
        try:
            keyring.delete_password(SERVICE_NAME, 'refresh_token')
        except Exception:
            pass
    try:
        if os.path.exists(refresh_token_file):
            os.remove(refresh_token_file)
    except Exception:
        pass

# Set Minecraft directory
if debug_mode:
    # Define a custom Minecraft directory for testing
    if sys.platform == "win32":
        minecraft_directory = os.path.join(os.path.expanduser("~"), ".launcher")
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


def get_auth_headers():
    """Return launcher build headers used to authenticate with the auth API.

    If data/build_secret.py is missing, returns an empty dict.
    if not getattr(sys, 'frozen', False):
        return {}
    """

    # Running in a frozen build — attempt to load build_secret values.
    try:
        from data import build_secret  # type: ignore
        bid = getattr(build_secret, 'BUILD_ID', '')
        bsign = getattr(build_secret, 'BUILD_SIGNATURE', '')
        if bid and bsign:
            return {"x-launcher-id": bid, "x-launcher-sign": bsign}
    except Exception:
        pass

    # Fallback: try to read file `build_secret.py` directly.
    try:
        secret_path = os.path.join(os.path.dirname(__file__), 'build_secret.py')
        if os.path.isfile(secret_path):
            bid = ''
            bsign = ''
            with open(secret_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('BUILD_ID') and '=' in line:
                        parts = line.split('=', 1)
                        bid = parts[1].strip().strip('"').strip("'")
                    elif line.startswith('BUILD_SIGNATURE') and '=' in line:
                        parts = line.split('=', 1)
                        bsign = parts[1].strip().strip('"').strip("'")
            if bid and bsign:
                return {"x-launcher-id": bid, "x-launcher-sign": bsign}
    except Exception:
        pass

    return {}