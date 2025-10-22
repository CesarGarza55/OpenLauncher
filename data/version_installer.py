"""
Version Installer for OpenLauncher
Handles installation of Minecraft versions (Vanilla, Fabric, Forge)
"""

import minecraft_launcher_lib
from tkinter import messagebox
from lang import lang


class VersionInstaller:
    """Handles Minecraft version installations"""
    
    def __init__(self, minecraft_directory):
        self.minecraft_directory = minecraft_directory
    
    def install_minecraft(self, version, callback, system_lang):
        """Install a Minecraft version"""
        if not version:
            raise ValueError("No version entered")
        
        try:
            print(lang(system_lang, "minecraft_installation").replace("1.0", version))
            minecraft_launcher_lib.install.install_minecraft_version(
                version, 
                self.minecraft_directory, 
                callback=callback
            )
            messagebox.showinfo(
                "Minecraft", 
                lang(system_lang, "minecraft_installed").replace("1.0", version)
            )
            return True
        except Exception as e:
            messagebox.showerror("Error", f"Could not install version: {e}")
            raise
    
    def install_fabric(self, version, loader, callback, system_lang):
        """Install Fabric loader for a Minecraft version"""
        if not version:
            raise ValueError("No version entered")
        
        try:
            print(lang(system_lang, "forge_installation").replace("1.0", version).replace("Forge", "Fabric"))
            
            # Verify that the version of Minecraft is supported by Fabric
            if minecraft_launcher_lib.fabric.is_minecraft_version_supported(version):
                if loader is None:
                    minecraft_launcher_lib.fabric.install_fabric(
                        version, 
                        self.minecraft_directory, 
                        callback=callback
                    )
                else:
                    minecraft_launcher_lib.fabric.install_fabric(
                        version, 
                        self.minecraft_directory, 
                        callback=callback, 
                        loader_version=loader
                    )
                messagebox.showinfo(
                    "Fabric", 
                    lang(system_lang, "forge_installed").replace("1.0", version).replace("Forge", "Fabric")
                )
                return True
            else:
                messagebox.showerror(
                    "Error", 
                    lang(system_lang, "forge_not_found").replace("Forge", "Fabric")
                )
                return False
        except Exception as e:
            messagebox.showerror("Error", f"Fabric could not be installed: {e}")
            raise
    
    def install_forge(self, version, forge_versions, callback, system_lang):
        """Install Forge loader for a Minecraft version"""
        if not version:
            raise ValueError("No version entered")
        
        try:
            print(lang(system_lang, "forge_installation").replace("1.0", version))
            
            # Find the forge version
            forge = None
            for i in forge_versions:
                if i == version:
                    forge = i
                    break
            
            if forge:
                minecraft_launcher_lib.forge.install_forge_version(
                    forge, 
                    self.minecraft_directory, 
                    callback=callback
                )
                messagebox.showinfo(
                    "Forge", 
                    lang(system_lang, "forge_installed").replace("1.0", version)
                )
                return True
            else:
                messagebox.showerror(
                    "Error", 
                    lang(system_lang, "forge_not_found")
                )
                return False
        except Exception as e:
            messagebox.showerror("Error", f"Forge could not be installed: {e}")
            raise
