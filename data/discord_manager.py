"""
Discord Rich Presence Manager for OpenLauncher
Handles Discord RPC connection and updates
"""

import time
import random
import atexit
from pypresence import Presence
import variables
from lang import lang


class DiscordManager:
    """Manager for Discord Rich Presence functionality"""
    
    def __init__(self):
        self.rpc = Presence(variables.CLIENT_ID)
        self.enabled = False
        self.error_message = ""
    
    def connect(self, system_lang):
        """Connect to Discord Rich Presence"""
        try:
            self.rpc.connect()
            self.rpc.update(
                details="OpenSource Minecraft Launcher",
                state=random.choice(variables.state_list),
                large_image="preview",
                large_text="Minecraft Java Edition",
                start=time.time()
            )
            self.error_message = ""
            self.enabled = True
        except Exception as e:
            self.error_message = lang(system_lang, "discord_error")
            self.enabled = False
    
    def cleanup(self):
        """Clean up Discord Rich Presence connection"""
        try:
            self.rpc.clear()
            self.rpc.close()
            self.error_message = ""
            self.enabled = False
        except Exception as e:
            pass
    
    def toggle(self, system_lang):
        """Enable or disable Discord Rich Presence"""
        if not self.enabled:
            self.connect(system_lang)
        else:
            self.cleanup()
    
    def get_error(self):
        """Get the current error message"""
        return self.error_message
    
    def is_enabled(self):
        """Check if Discord RPC is enabled"""
        return self.enabled
    
    def register_cleanup(self):
        """Register cleanup function to run on exit"""
        if self.enabled:
            atexit.register(self.cleanup)
