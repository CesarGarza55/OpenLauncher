"""
Authentication Manager for OpenLauncher
Handles Microsoft account authentication and logout
"""

import os
from tkinter import messagebox
import variables
from microsoft_auth import login


def authenticate(system_lang, icon):
    """Authenticate the user and fetch the profile"""
    try:
        profile = login(system_lang, icon)
        return profile
    except Exception as e:
        messagebox.showerror("Error", f"Could not authenticate: {e}")
        return None


def logout():
    """Log out by removing the refresh token file"""
    try:
        os.remove(variables.refresh_token_file)
        return True
    except Exception as e:
        messagebox.showerror("Error", f"Could not log out: {e}")
        return False
