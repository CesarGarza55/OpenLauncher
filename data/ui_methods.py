"""
UI Components - Additional Methods
Contains remaining UI methods for installation and window management
"""

import re
import sys
import webbrowser
import minecraft_launcher_lib
from PyQt5 import QtCore
from PyQt5.QtWidgets import (QApplication,QSplashScreen)
from PyQt5.QtCore import Qt, QThreadPool, QThread, pyqtSignal
from PyQt5.QtGui import QPixmap
from tkinter import messagebox

import variables
from lang import lang, change_language
from workers import CommandWorker, FunctionWorker, StdoutRedirector
from utils import open_website, open_launcher_dir, open_minecraft_dir, is_java_installed


class UiMethods:
    """Additional UI methods for MainWindow"""
    
    def install_minecraft(self, version, loader=None):
        """Install Minecraft version in a separate thread"""
        if version:
            print(lang(self.system_lang, "minecraft_installation").replace("1.0", version))
            self.disable_buttons()
            
            try:
                callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                }
                self.version_installer.install_minecraft(version, callback, self.system_lang)
            except Exception as e:
                self.signals.error.emit(str(e))
            finally:
                self.enable_buttons()
                self.update_list_versions()
                index = self.comboBox.findText(version, QtCore.Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
                self.signals.finished.emit()
        else:
            messagebox.showerror("Error", "No version entered")

    def install_fabric(self, version, loader=None):
        """Install Fabric in a separate thread"""
        if version:
            print(lang(self.system_lang, "forge_installation").replace("1.0", version).replace("Forge", "Fabric"))
            self.disable_buttons()
            
            try:
                callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                }
                self.version_installer.install_fabric(version, loader, callback, self.system_lang)
            except Exception as e:
                self.signals.error.emit(str(e))
            finally:
                self.enable_buttons()
                self.update_list_versions()
                codename = f"fabric-loader-{loader}-{version}"
                index = self.comboBox.findText(codename, QtCore.Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
                self.signals.finished.emit()
        else:
            messagebox.showerror("Error", "No version entered")

    def install_forge(self, version, loader=None):
        """Install Forge in a separate thread"""
        if version:
            print(lang(self.system_lang, "forge_installation").replace("1.0", version))
            self.disable_buttons()
            
            try:
                callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                }
                self.version_installer.install_forge(version, self.forge_versions, callback, self.system_lang)
            except Exception as e:
                self.signals.error.emit(str(e))
            finally:
                self.enable_buttons()
                self.update_list_versions()
                
                # Set the selected version
                codename = version.split('-')
                mc_version = codename[0]
                forge_loader = codename[1]
                try:
                    extra = codename[2]
                except:
                    extra = ""
                
                type1 = f"{mc_version}-forge-{forge_loader}"
                type2 = f"{mc_version}-Forge{forge_loader}-{mc_version}"
                type3 = f"{mc_version}-forge{mc_version}-{forge_loader}-{extra}"
                
                index1 = self.comboBox.findText(type1, QtCore.Qt.MatchFixedString)
                index2 = self.comboBox.findText(type2, QtCore.Qt.MatchFixedString)
                index3 = self.comboBox.findText(type3, QtCore.Qt.MatchFixedString)
                
                if index1 >= 0:
                    self.comboBox.setCurrentIndex(index1)
                elif index2 >= 0:
                    self.comboBox.setCurrentIndex(index2)
                elif index3 >= 0:
                    self.comboBox.setCurrentIndex(index3)
                
                self.signals.finished.emit()
        else:
            messagebox.showerror("Error", "No version entered")

    def toggle_snapshots(self):
        """Toggle snapshots visibility"""
        self.show_snapshots = not self.show_snapshots

    def configure_dropdown(self, vers, installed_versions_list):
        """Configure the version dropdown"""
        from resource_cache import get_cached_icon
        
        # Block signals during bulk update for better performance
        self.comboBox.blockSignals(True)
        self.comboBox.clear()
        
        # Cache icons once
        forge_icon = get_cached_icon(variables.forge_icon)
        fabric_icon = get_cached_icon(variables.fabric_icon)
        minecraft_icon = get_cached_icon(variables.minecraft_icon)
        
        for version in installed_versions_list:
            if "forge" in version:
                self.comboBox.addItem(forge_icon, version)
            elif "fabric" in version:
                self.comboBox.addItem(fabric_icon, version)
            else:
                self.comboBox.addItem(minecraft_icon, version)
        
        index = self.comboBox.findText(vers, QtCore.Qt.MatchFixedString)
        if index >= 0:
            self.comboBox.setCurrentIndex(index)
        
        self.comboBox.blockSignals(False)

    def update_list_versions(self):
        """Update the list of installed versions"""
        installed_versions = minecraft_launcher_lib.utils.get_installed_versions(self.minecraft_directory)
        installed_versions_list = [version['id'] for version in installed_versions]
        installed_versions_list = installed_versions_list[::-1]
        
        if len(installed_versions_list) != 0:
            vers = installed_versions_list[0]
        else:
            vers = lang(self.system_lang, "no_versions_installed")
            installed_versions_list.append(vers)
        
        self.configure_dropdown(vers, installed_versions_list)

    def save_data(self):
        """Save user data to file"""
        arg = self.jvm_arguments if self.jvm_arguments != "" else variables.defaultJVM
        
        data = {
            'name': self.lineEdit.text(),
            'toggle_snapshots': self.show_snapshots,
            'jvm_arguments': arg,
            'last_version': self.comboBox.currentText(),
            'ask_update': self.config_manager.get_ask_update(),
            'discord_rpc': self.discord_manager.is_enabled(),
            'maximized': self.isMaximized() if hasattr(self, 'isMaximized') else False
        }
        
        self.config_manager.save_user_data(data)
        self.config_manager.save_user_uuid(self.user_uuid)

    def generate_uuid(self, name):
        """Generate a UUID for the username"""
        self.user_uuid = self.config_manager.generate_uuid(name)

    def verify_username(self, username):
        """Verify if username is valid"""
        if len(username) < 3 or len(username) > 16:
            return False
        if not re.match("^[a-zA-Z0-9_]*$", username):
            return False
        return True

    def run_minecraft(self):
        """Run Minecraft with the selected version"""
        self.console_output.clear()
        
        # Check if Java is installed
        if not is_java_installed():
            if sys.platform == 'win32':
                if messagebox.askyesno(
                    lang(self.system_lang, "java_not_installed"),
                    lang(self.system_lang, "ask_install_java")
                ):
                    webbrowser.open('https://www.java.com/es/download/')
                else:
                    messagebox.showerror(
                        lang(self.system_lang, "java_not_installed"),
                        lang(self.system_lang, "java_not_installed_win")
                    )
                    sys.exit()
            elif sys.platform == 'linux':
                messagebox.showinfo(
                    lang(self.system_lang, "java_not_installed"),
                    lang(self.system_lang, "java_not_installed_linux")
                )
            return
        
        if self.access_token == "" or self.access_token is None:
            mine_user = self.lineEdit.text()
        else:
            mine_user = self.user_name
        
        if not mine_user:
            messagebox.showerror("Error", lang(self.system_lang, "no_username"))
            return
        
        if not self.verify_username(mine_user):
            messagebox.showerror("Error", lang(self.system_lang, "invalid_username"))
            return
        
        arg = self.jvm_arguments if self.jvm_arguments else variables.defaultJVM
        
        if self.user_uuid == "":
            self.generate_uuid(mine_user)
        
        self.save_data()
        self.disable_buttons()
        
        version = self.comboBox.currentText()
        
        if version:
            options = {
                'username': mine_user,
                'uuid': self.user_uuid,
                'token': self.access_token,
                'jvmArguments': arg,
                'launcherName': "OpenLauncher for Minecraft",
                'launcherVersion': variables.launcher_version
            }
            
            try:
                minecraft_command = minecraft_launcher_lib.command.get_minecraft_command(
                    version, 
                    self.minecraft_directory, 
                    options
                )
                
                self.worker = CommandWorker(minecraft_command)
                self.worker.signals.output.connect(self.handle_output)
                self.worker.signals.error.connect(self.on_minecraft_error)
                self.worker.signals.finished.connect(self.on_minecraft_finished)
                QThreadPool.globalInstance().start(self.worker)
            except Exception as e:
                messagebox.showerror("Error", f"Could not start Minecraft: {e}")
                self.enable_buttons()

    def handle_output(self, output):
        """Handle command output"""
        self.console_output.append(output)
        self.console_output.verticalScrollBar().setValue(
            self.console_output.verticalScrollBar().maximum()
        )

    def on_installation_finished(self):
        """Handle installation finished"""
        self.enable_buttons()

    def on_installation_error(self, error_message):
        """Handle installation error"""
        from variables import write_log
        write_log(error_message, "installation_error")

    def on_minecraft_finished(self):
        """Handle Minecraft process finished"""
        self.enable_buttons()

    def on_minecraft_error(self, error_message):
        """Handle Minecraft process error"""
        from variables import write_log
        write_log(error_message, "minecraft_startup")
        self.enable_buttons()

    def enable_buttons(self):
        """Enable all buttons"""
        self.btn_minecraft.setEnabled(True)
        self.btn_fabric.setEnabled(True)
        self.btn_forge.setEnabled(True)
        self.btn_play.setEnabled(True)
        self.btn_account.setEnabled(True)
        self.btn_mod_manger.setEnabled(True)
        self.lineEdit.setEnabled(True)
        self.comboBox.setEnabled(True)

    def disable_buttons(self):
        """Disable all buttons"""
        self.btn_minecraft.setEnabled(False)
        self.btn_fabric.setEnabled(False)
        self.btn_forge.setEnabled(False)
        self.btn_play.setEnabled(False)
        self.btn_account.setEnabled(False)
        self.btn_mod_manger.setEnabled(False)
        self.lineEdit.setEnabled(False)
        self.comboBox.setEnabled(False)

    def start_installation(self, install_function, version, loader=None):
        """Start installation in a separate thread"""
        self.console_output.clear()
        worker = FunctionWorker(install_function, version, loader)
        worker.signals.output.connect(self.handle_output)
        worker.signals.error.connect(self.on_installation_error)
        worker.signals.finished.connect(self.on_installation_finished)
        QThreadPool.globalInstance().start(worker)

    def open_mod_manager(self):
        """Switch to mod manager tab"""
        self.tab_widget.setCurrentIndex(2)  # Index 2 is the mod manager tab


class LoadingScreen(QSplashScreen):
    """Loading screen for application startup"""
    
    def __init__(self):
        super().__init__(QPixmap(variables.splash_screen))
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        
        # Center the splash screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        self.move(
            int(screen_geometry.width() / 2 - self.width() / 2),
            int(screen_geometry.height() / 2 - self.height() / 2)
        )


class MainWindowLoader(QThread):
    """Thread loader for main window"""
    finished = pyqtSignal()
    
    def run(self):
        self.finished.emit()
