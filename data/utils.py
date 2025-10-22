"""
Utility functions for OpenLauncher
Includes directory operations, theme loading, and general helper functions
"""

import os
import sys
import json
import subprocess
import webbrowser
import variables
from tkinter import messagebox


def open_website():
    """Open the plugins website"""
    webbrowser.open(variables.website_url)


def open_launcher_dir():
    """Open the launcher directory in the file explorer"""
    app_dir = variables.app_directory
    
    # Check if the directory exists
    if os.path.exists(app_dir):
        # Open the directory
        if sys.platform == "win32":
            subprocess.Popen(['explorer', app_dir])
        elif sys.platform == "linux":
            try:
                subprocess.Popen(['gio', 'open', app_dir])
            except Exception as e:
                subprocess.Popen(['xdg-open', app_dir])
    else:
        messagebox.showerror("Error", f"Directory {app_dir} does not exist")


def open_minecraft_dir():
    """Open the Minecraft directory in the file explorer"""
    minecraft_directory = variables.minecraft_directory
    
    # Check if the directory exists
    if os.path.exists(minecraft_directory):
        # Open the directory
        if sys.platform == "win32":
            subprocess.Popen(['explorer', minecraft_directory])
        elif sys.platform == "linux":
            try:
                subprocess.Popen(['gio', 'open', minecraft_directory])
            except Exception as e:
                subprocess.Popen(['xdg-open', minecraft_directory])
    else:
        print(f"Directory {minecraft_directory} does not exist")


def load_theme_plugins(plugin_dir):
    """Load theme plugins from the plugins directory"""
    themes = []
    if os.path.exists(plugin_dir):
        for folder in os.listdir(plugin_dir):
            folder_path = os.path.join(plugin_dir, folder)
            if os.path.isdir(folder_path):
                config_path = os.path.join(folder_path, 'theme.json')
                if os.path.isfile(config_path):
                    with open(config_path, 'r') as f:
                        try:
                            theme = json.load(f)
                            theme['folder'] = folder  # Add the folder name to the theme
                            themes.append(theme)
                        except Exception as e:
                            print(f"Could not load theme from {config_path}: {e}")
    return themes


def apply_theme(theme, plugin_dir):
    """
    Apply a theme and return theme values
    Returns: tuple (bg_path, bg_color, icon, bg_blur)
    """
    # Dictionary with the default paths
    default_paths = {
        'bg_path': variables.bg_path,
        'icon': variables.icon,
        'bg_color': variables.bg_color,
        'bg_blur': variables.bg_blur
    }
    
    result = {}
    
    # Update the paths
    for key in default_paths:
        if key in theme:
            if key == 'bg_color':
                # Validate bg_color format
                if isinstance(theme[key], str) and all(0 <= int(c) <= 255 for c in theme[key].split(',')):
                    result[key] = theme[key]
                else:
                    messagebox.showerror(
                        "Error", 
                        f"The theme {theme['folder']} has an invalid bg_color value "
                        f"(must be in the format 'R, G, B') for example '25, 45, 75' "
                        f"the values must be between 0 and 255.\nThe default color will be used"
                    )
                    result[key] = default_paths[key]
            elif key == 'bg_blur':
                # Validate bg_blur range
                if isinstance(theme[key], int) and 0 <= theme[key] <= 64:
                    result[key] = theme[key]
                else:
                    messagebox.showerror(
                        "Error", 
                        f"The theme {theme['folder']} has an invalid bg_blur value "
                        f"(must be an number between 0 and 64).\nThe default value will be used"
                    )
                    result[key] = default_paths[key]
            elif key == 'folder':
                pass
            else:
                # Validate image path
                image_path = os.path.join(plugin_dir, theme['folder'], theme[key]).replace("\\", "/")
                if os.path.isfile(image_path):
                    result[key] = image_path
                else:
                    messagebox.showerror(
                        "Error", 
                        f"The theme {theme['folder']} has an invalid {key} path.\n"
                        f"The default path will be used"
                    )
                    result[key] = default_paths[key]
        else:
            result[key] = default_paths[key]
    
    return result['bg_path'], result['bg_color'], result['icon'], result['bg_blur']


def is_java_installed():
    """Check if Java is installed on the system"""
    try:
        output = subprocess.check_output('java -version', stderr=subprocess.STDOUT, shell=True)
        return 'version' in output.decode('UTF-8').lower()
    except Exception:
        return False


def check_internet_connection(timeout=5):
    """
    Check if there is an active internet connection
    
    Args:
        timeout: Timeout in seconds for the connection test
        
    Returns:
        bool: True if connected, False otherwise
    """
    import socket
    
    # List of reliable servers to test connection
    test_hosts = [
        ("google.com", 80), # Google
        ("cloudflare.com", 80), # Cloudflare
        ("8.8.8.8", 53),  # Google DNS
        ("1.1.1.1", 53),  # Cloudflare DNS
    ]
    
    for host, port in test_hosts:
        try:
            socket.setdefaulttimeout(timeout)
            socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect((host, port))
            return True
        except (socket.error, socket.timeout):
            continue
    
    return False
