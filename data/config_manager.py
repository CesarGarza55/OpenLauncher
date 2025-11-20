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
        self.profiles_path = os.path.join(self.config_dir, 'profiles.json')
        
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

    # --- Profiles support ---
    def load_profiles(self):
        """Load profiles dict from profiles.json. If missing, attempt migration from user_data.json."""
        if os.path.exists(self.profiles_path):
            with open(self.profiles_path, 'r', encoding='utf-8') as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    return {"active": "default", "profiles": {}}

        # If profiles file doesn't exist, try to migrate single-user data
        return self.migrate_to_profiles()

    def save_profiles(self, profiles_obj):
        """Save profiles object to profiles.json"""
        with open(self.profiles_path, 'w', encoding='utf-8') as f:
            json.dump(profiles_obj, f, indent=4)

    def migrate_to_profiles(self):
        """Create a default profile from existing user_data.json and persist profiles.json."""
        profiles = {"active": "default", "profiles": {}}
        user_data = self.load_user_data()
        default_profile = {
            "display_name": "Default",
            "type": "local",
            "account_name": user_data.get('name', '') if user_data else '',
            "user_uuid": self.load_user_uuid(),
            "last_version": user_data.get('last_version', ''),
            "jvm_arguments": user_data.get('jvm_arguments', []),
            "settings": {}
        }
        profiles['profiles']['default'] = default_profile
        try:
            os.makedirs(self.config_dir, exist_ok=True)
            with open(self.profiles_path, 'w', encoding='utf-8') as f:
                json.dump(profiles, f, indent=4)
        except Exception:
            pass
        return profiles

    def create_profile(self, key, display_name=None, profile_type='local'):
        """Create a new empty profile with given key."""
        profiles = self.load_profiles()
        if key in profiles.get('profiles', {}):
            raise ValueError('Profile exists')
        profile = {
            'display_name': display_name or key,
            'type': profile_type,
            'account_name': '',
            'user_uuid': '',
            'last_version': '',
            'jvm_arguments': variables.defaultJVM if hasattr(variables, 'defaultJVM') else [],
            'settings': {}
        }
        profiles.setdefault('profiles', {})[key] = profile
        self.save_profiles(profiles)
        return profile

    def delete_profile(self, key):
        profiles = self.load_profiles()
        if key in profiles.get('profiles', {}):
            profiles['profiles'].pop(key)
            # If deleted active, set active to first available or default
            if profiles.get('active') == key:
                remaining = list(profiles.get('profiles', {}).keys())
                profiles['active'] = remaining[0] if remaining else None
            self.save_profiles(profiles)

    def set_active_profile(self, key):
        profiles = self.load_profiles()
        if key in profiles.get('profiles', {}):
            profiles['active'] = key
            self.save_profiles(profiles)

    def get_active_profile_key(self):
        profiles = self.load_profiles()
        return profiles.get('active')

    def get_profile(self, key):
        profiles = self.load_profiles()
        return profiles.get('profiles', {}).get(key)
