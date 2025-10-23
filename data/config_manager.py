"""
Configuration Manager for OpenLauncher
Handles loading and saving of user configurations
"""

import os
import json
import uuid
import requests
import variables


class ConfigManager:
    """Manager for user configuration and data persistence"""
    
    def __init__(self, app_dir):
        self.app_dir = app_dir
        self.config_dir = os.path.join(app_dir, 'config')
        self.user_data_path = os.path.join(self.config_dir, 'user_data.json')
        self.user_uuid_path = os.path.join(self.config_dir, 'user_uuid.json')
        self.config_path = os.path.join(self.config_dir, 'config.json')
        
        # Ensure config directory exists
        os.makedirs(self.config_dir, exist_ok=True)
    
    def load_user_data(self):
        """Load user data from file"""
        if os.path.exists(self.user_data_path):
            with open(self.user_data_path, 'r') as f:
                return json.load(f)
        return {}
    
    def save_user_data(self, data):
        """Save user data to file"""
        with open(self.user_data_path, 'w') as f:
            json.dump(data, f)
    
    def load_user_uuid(self):
        """Load user UUID from file"""
        if os.path.exists(self.user_uuid_path) and os.path.getsize(self.user_uuid_path) > 0:
            with open(self.user_uuid_path, 'r') as f:
                return json.load(f)
        return ""
    
    def save_user_uuid(self, user_uuid):
        """Save user UUID to file"""
        with open(self.user_uuid_path, 'w') as f:
            json.dump(user_uuid, f)
    
    def load_config(self):
        """Load main configuration from file"""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    return {"first_time": True, "lang": "en"}
        return {"first_time": True, "lang": "en"}
    
    def save_config(self, config):
        """Save main configuration to file"""
        with open(self.config_path, 'w') as f:
            json.dump(config, f, indent=4)
        print(f"Config saved to {self.config_path}")
    
    def generate_uuid(self, name):
        """Generate a UUID for the user"""
        try:
            resp = requests.get(f"https://api.mojang.com/users/profiles/minecraft/{name}")
            user_uuid = resp.json()["id"]
            return user_uuid
        except (KeyError, requests.RequestException):
            # If the user is not found, generate a random UUID
            return str(uuid.uuid4())
    
    def get_jvm_arguments(self):
        """Get JVM arguments from user data or return default"""
        user_data = self.load_user_data()
        return user_data.get('jvm_arguments', variables.defaultJVM)
    
    def get_discord_rpc_enabled(self):
        """Get Discord RPC enabled status from user data"""
        user_data = self.load_user_data()
        return user_data.get('discord_rpc', False)
    
    def get_show_snapshots(self):
        """Get show snapshots setting from user data"""
        user_data = self.load_user_data()
        return user_data.get('toggle_snapshots', False)
    
    def get_ask_update(self):
        """Get ask update setting from user data"""
        user_data = self.load_user_data()
        return user_data.get('ask_update', 'yes')
