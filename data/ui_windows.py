"""
Window Methods for OpenLauncher
Contains installation and settings window methods
"""

import re
import requests
from PyQt5.QtWidgets import (QPushButton, QVBoxLayout, QGroupBox, 
                             QLineEdit, QLabel, QComboBox, QHBoxLayout, QSizePolicy, 
                             QCheckBox, QApplication, QDialog, QMessageBox, QScrollArea, QWidget)
from PyQt5.QtCore import Qt, QCoreApplication
from PyQt5.QtGui import QIcon

import variables
from lang import lang, change_language
from ui_dialogs import create_version_dialog, create_fabric_dialog
from utils import open_launcher_dir, open_minecraft_dir, check_internet_connection
from updater import update as run_updater, version_to_tuple


class WindowMethods:
    """Methods for creating installation and settings windows"""
    
    def install_normal_versions(self):
        """Show Minecraft version installation dialog"""
        self.save_data()

        if not self.versions:
            if not check_internet_connection():
                QMessageBox.critical(None, "Error", lang(self.system_lang, "no_internet"))
            else:
                QMessageBox.critical(None, "Error", lang(self.system_lang, "version_error"))
            return
        
        if not self.access_token:
            QMessageBox.critical(None, "Error", lang(self.system_lang, "install_login_required"))
            return
        
        # Prepare versions list
        all_versions = []
        releases = []
        
        for i in range(0, len(self.versions)):
            all_versions.append(self.versions[i]['id'])
            if self.versions[i]['type'] == 'release':
                releases.append(self.versions[i]['id'])
        
        if self.show_snapshots:
            vers = all_versions[0]
            versions_list = all_versions
        else:
            vers = releases[0]
            versions_list = releases
        
        window = create_version_dialog(
            self.system_lang,
            self.icon,
            f"{lang(self.system_lang, 'install')} Minecraft",
            lang(self.system_lang, "info_label_minecraft"),
            versions_list,
            vers,
            lambda version: self.start_installation(self.install_minecraft, version),
            "minecraft"
        )
        window.exec_()
    
    def install_fabric_versions(self):
        """Show Fabric version installation dialog"""
        self.save_data()
        
        if not self.versions:
            if not check_internet_connection():
                QMessageBox.critical(None, "Error", lang(self.system_lang, "no_internet"))
            else:
                QMessageBox.critical(None, "Error", lang(self.system_lang, "version_error"))
            return
        
        # Prepare fabric versions
        fabric_releases = []
        fabric_all = []
        
        for i in range(0, len(self.fabric_versions)):
            if self.fabric_versions[i]['stable']:
                fabric_releases.append(self.fabric_versions[i]['version'])
            fabric_all.append(self.fabric_versions[i]['version'])
        
        fabric_loader = [loader['version'] for loader in self.fabric_loaders]
        
        if self.show_snapshots:
            vers = fabric_all[0]
            versions_list = fabric_all
        else:
            vers = fabric_releases[0]
            versions_list = fabric_releases
        
        window = create_fabric_dialog(
            self.system_lang,
            self.icon,
            versions_list,
            fabric_loader,
            vers,
            lambda version, loader: self.start_installation(self.install_fabric, version, loader),
            "fabric"
        )
        window.exec_()
    
    def install_forge_versions(self):
        """Show Forge version installation dialog"""
        self.save_data()
        
        if not self.forge_versions:
            if not check_internet_connection():
                QMessageBox.critical(None, "Error", lang(self.system_lang, "no_internet"))
            else:
                QMessageBox.critical(None, "Error", lang(self.system_lang, "version_error"))
            return
        
        forge_all = list(self.forge_versions)
        
        # Get latest Forge version
        try:
            response = requests.get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
            forge_latest = response.json()
            keys = list(forge_latest["promos"].keys())
            last_key = keys[-2]
            last_value = forge_latest["promos"][last_key]
            result = last_key.split('-')[0] + '-' + last_value
            
            if result in forge_all:
                vers = result
            else:
                vers = forge_all[0]
        except:
            vers = forge_all[0]
        
        window = create_version_dialog(
            self.system_lang,
            self.icon,
            f"{lang(self.system_lang, 'install')} Forge",
            lang(self.system_lang, "info_label_loader").replace("Fabric", "Forge"),
            forge_all,
            vers,
            lambda version: self.start_installation(self.install_forge, version),
            "forge"
        )
        window.exec_()

    def manual_check_for_updates(self, parent_dialog=None):
        """Manually compare launcher versions and run the updater if needed"""
        repo_latest = "https://github.com/CesarGarza55/OpenLauncher/releases/latest"
        try:
            response = requests.get(repo_latest, timeout=10)
            response.raise_for_status()
            latest_tag = response.url.rstrip('/').split('/').pop()
            latest_version = version_to_tuple(latest_tag)
            current_version = version_to_tuple(variables.launcher_version)
        except requests.RequestException:
            QMessageBox.warning(parent_dialog, "Error", lang(self.system_lang, "no_internet"))
            return
        except Exception as exc:
            QMessageBox.warning(parent_dialog, "Error", lang(self.system_lang, "error_occurred") + str(exc))
            return

        if latest_version > current_version:
            answer = QMessageBox.question(
                parent_dialog,
                lang(self.system_lang, "ask_update"),
                lang(self.system_lang, "update_available"),
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.Yes,
            )
            if answer == QMessageBox.Yes:
                if isinstance(parent_dialog, QDialog):
                    parent_dialog.accept()
                run_updater()
        else:
            QMessageBox.information(
                parent_dialog,
                lang(self.system_lang, "ask_update"),
                lang(self.system_lang, "update_latest"),
            )
    
    def set_language(self, new_lang):
        """Set the new language"""
        self.system_lang = new_lang
        
        if self.access_token != "":
            self.label.setText(f"{lang(self.system_lang, 'logged_as')} {self.user_name}")
            self.btn_account.setText(lang(self.system_lang, "logout_microsoft"))
        else:
            self.label.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "label_username"), None))
            self.btn_account.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "login_microsoft"), None))
        
        self.username_input.setPlaceholderText(lang(self.system_lang, "user_placeholder"))
        self.btn_minecraft.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_install_minecraft"), None))
        self.btn_fabric.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_install_loader"), None))
        self.btn_forge.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_install_loader").replace("Fabric", "Forge"), None))
        self.btn_play.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_play"), None))
        self.btn_mod_manager.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_mod_manager"), None))
        
        # Update tab names
        if hasattr(self, 'tab_widget'):
            self.tab_widget.setTabText(0, QCoreApplication.translate("MainWindow", lang(self.system_lang, "game"), None))
            self.tab_widget.setTabText(1, QCoreApplication.translate("MainWindow", lang(self.system_lang, "settings"), None))