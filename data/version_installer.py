"""
Version Installer for OpenLauncher
Handles installation of Minecraft versions (Vanilla, Fabric, Forge)
"""

import minecraft_launcher_lib
from PyQt5.QtCore import Qt, QObject, pyqtSignal
from PyQt5.QtWidgets import QMessageBox
from lang import lang


class _MessageDispatcher(QObject):
    """Qt helper that shows dialogs on the UI thread."""

    showRequested = pyqtSignal(str, str, object)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._parent = parent
        self.showRequested.connect(self._show_dialog)

    def _show_dialog(self, title, text, icon):
        dialog = QMessageBox(self._parent)
        dialog.setIcon(icon)
        dialog.setWindowTitle(title)
        dialog.setText(text)
        dialog.setWindowFlag(Qt.WindowStaysOnTopHint, True)
        dialog.exec_()


class VersionInstaller:
    """Handles Minecraft version installations"""
    
    def __init__(self, minecraft_directory, message_parent=None):
        self.minecraft_directory = minecraft_directory
        self.message_parent = message_parent
        self._dispatcher = _MessageDispatcher(message_parent)

    def _show_message(self, title, text, icon):
        """Display Qt message box that stays above the UI."""
        if self._dispatcher is None:
            # Fallback in case Qt dispatcher is unavailable
            dialog = QMessageBox(self.message_parent)
            dialog.setIcon(icon)
            dialog.setWindowTitle(title)
            dialog.setText(text)
            dialog.setWindowFlag(Qt.WindowStaysOnTopHint, True)
            dialog.exec_()
            return
        self._dispatcher.showRequested.emit(title, text, icon)
    
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
            self._show_message(
                "Minecraft",
                lang(system_lang, "minecraft_installed").replace("1.0", version),
                QMessageBox.Information
            )
            return True
        except Exception as e:
            self._show_message("Error", f"Could not install version: {e}", QMessageBox.Critical)
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
                self._show_message(
                    "Fabric",
                    lang(system_lang, "forge_installed").replace("1.0", version).replace("Forge", "Fabric"),
                    QMessageBox.Information
                )
                return True
            else:
                self._show_message(
                    "Error",
                    lang(system_lang, "forge_not_found").replace("Forge", "Fabric"),
                    QMessageBox.Critical
                )
                return False
        except Exception as e:
            self._show_message("Error", f"Fabric could not be installed: {e}", QMessageBox.Critical)
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
                self._show_message(
                    "Forge",
                    lang(system_lang, "forge_installed").replace("1.0", version),
                    QMessageBox.Information
                )
                return True
            else:
                self._show_message(
                    "Error",
                    lang(system_lang, "forge_not_found"),
                    QMessageBox.Critical
                )
                return False
        except Exception as e:
            self._show_message("Error", f"Forge could not be installed: {e}", QMessageBox.Critical)
            raise
