"""
Utility functions for OpenLauncher
Includes directory operations and general helper functions
"""

import os
import sys
import subprocess
import webbrowser
import variables
from tkinter import messagebox


def open_website(url=None):
    """Open a specified website or the default website"""
    if url is None:
        url = variables.website_url
    webbrowser.open(url)


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
