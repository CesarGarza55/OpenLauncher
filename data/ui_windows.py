"""
Window Methods for OpenLauncher
Contains installation and settings window methods
"""

import re
import json
import requests
from PyQt5 import QtCore
from PyQt5.QtWidgets import (QPushButton, QVBoxLayout, QWidget, QGroupBox, 
                             QLineEdit, QLabel, QComboBox, QHBoxLayout, QSizePolicy, 
                             QCheckBox, QApplication, QDialog, QGraphicsBlurEffect, QMessageBox)
from PyQt5.QtCore import QSize, Qt, QCoreApplication
from PyQt5.QtGui import QIcon, QPixmap

import variables
from lang import lang, change_language
from ui_dialogs import create_version_dialog, create_fabric_dialog
from utils import open_website, open_launcher_dir, open_minecraft_dir, check_internet_connection
from resource_cache import get_cached_pixmap, get_cached_icon


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
    
    def settings_window(self):
        """Show settings window"""
        window_settings = QDialog()
        window_settings.setWindowTitle(lang(self.system_lang, "settings"))
        window_settings.setFixedSize(500, 450)
        window_settings.setWindowFlags(window_settings.windowFlags() & ~Qt.WindowContextHelpButtonHint & ~Qt.WindowMaximizeButtonHint)
        window_settings.setWindowIcon(QIcon(self.icon))
        window_settings.setStyleSheet("background-color: rgb(45, 55, 65); border-radius: 10px;")
        
        # Center window
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = window_settings.width()
        window_height = window_settings.height()
        position_right = int(screen_geometry.width() / 2 - window_width / 2)
        position_down = int(screen_geometry.height() / 2 - window_height / 2)
        window_settings.move(position_right, position_down)
        
        layout = QVBoxLayout()
        layout.setAlignment(Qt.AlignHCenter)
        layout.setSpacing(10)
        layout.setContentsMargins(10, 10, 10, 10)
                
        # JVM settings group
        jvm_group = QGroupBox()
        jvm_group.setStyleSheet("background-color: rgba(0, 0, 0, 0.3); border-radius: 10px;")
        jvm_group.setMaximumHeight(100)
        jvm_layout = QVBoxLayout()
        
        label_jvm_arguments = QLabel(lang(self.system_lang, "label_jvm_args"))
        label_jvm_arguments.setStyleSheet("color: white; font-size: 12px; background-color: transparent;")
        label_jvm_arguments.setAlignment(Qt.AlignCenter)
        label_jvm_arguments.setWordWrap(True)
        jvm_layout.addWidget(label_jvm_arguments)
        
        label_tip = QLabel(lang(self.system_lang, "jvm_tip"))
        label_tip.setStyleSheet("color: yellow; font-size: 12px; background-color: transparent;")
        label_tip.setAlignment(Qt.AlignCenter)
        label_tip.setWordWrap(True)
        jvm_layout.addWidget(label_tip)
        
        entry_jvm_arguments = QLineEdit()
        entry_jvm_arguments.setPlaceholderText("JVM arguments (-Xms512M -Xmx8G ...)")
        entry_jvm_arguments.setStyleSheet(f"""
            color: white; 
            background-color: rgba({self.bg_color}, 0.6);
            border-radius: 5px; 
            padding: 5px;
        """)
        
        if self.jvm_arguments != "" and self.jvm_arguments != variables.defaultJVM:
            entry_jvm_arguments.setText(" ".join(self.jvm_arguments))
        
        jvm_layout.addWidget(entry_jvm_arguments)
        jvm_group.setLayout(jvm_layout)
        layout.addWidget(jvm_group)
        
        # Language selection
        lang_combobox = QComboBox()
        lang_combobox.setFixedHeight(30)
        lang_combobox.setSizePolicy(QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed))
        available_langs = lang(self.system_lang, "available_languages")
        
        for key, value in available_langs.items():
            lang_combobox.addItem(value, key)
        
        lang_combobox.setStyleSheet(f"""
            QComboBox {{
                background-color: rgba({self.bg_color}, 0.5); 
                color: #ffffff; 
                border-radius: 5px;
                font-size: 12px;
            }}
            QComboBox:hover {{
                background-color: rgba({self.bg_color}, 1);
            }}
            QComboBox QAbstractItemView {{
                background-color: rgba({self.bg_color}, 0.5); 
                color: #ffffff; 
                border-radius: 5px;
            }}
        """)
        lang_combobox.setCurrentText(available_langs[self.system_lang])
        lang_combobox.setMaxVisibleItems(10)
        
        horizontal_layout = QHBoxLayout()
        label_lang = QLabel(lang(self.system_lang, "language"))
        label_lang.setStyleSheet("color: white; font-size: 14px; background-color: transparent;")
        horizontal_layout.addWidget(label_lang)
        horizontal_layout.addWidget(lang_combobox)
        layout.addLayout(horizontal_layout)
        
        # Checkbox style
        checkbox_style = f"""
            QCheckBox {{
                background-color: rgba({self.bg_color}, 0.5);
                color: #ffffff;
                font-size: 14px;
                font-weight: bold;
            }}
            QCheckBox::indicator {{
                width: 20px;
                height: 20px;
            }}
            QCheckBox::indicator:unchecked {{
                border-radius: 5px;
                border: 2px solid rgba(255, 255, 255, 0.5);
                background-color: rgba({self.bg_color}, 0.5);
            }}
            QCheckBox::indicator:checked {{
                border-radius: 5px;
                border: 2px solid rgba(255, 255, 255, 1);
                background-color: rgba(255, 255, 255, 1);
            }}
            QCheckBox::indicator:unchecked:hover {{
                border-radius: 5px;
                border: 2px solid rgb(255, 255, 255);
            }}
            QCheckBox::indicator:checked:hover {{
                border-radius: 5px;
                border: 2px solid rgba(255, 255, 255, 1);
                background-color: rgba(255, 255, 255, 0.5);
            }}
            QCheckBox:disabled {{
                color: #cccccc;
            }}
        """
        
        # Checkboxes
        snapshots_checkbox = QCheckBox(lang(self.system_lang, "checkbox_snapshots"))
        snapshots_checkbox.setStyleSheet(checkbox_style)
        snapshots_checkbox.setChecked(self.show_snapshots)
        snapshots_checkbox.clicked.connect(lambda: [self.toggle_snapshots(), self.save_data()])
        layout.addWidget(snapshots_checkbox)
        
        discord_checkbox = QCheckBox(lang(self.system_lang, "discord_rpc"))
        discord_checkbox.setStyleSheet(checkbox_style)
        discord_checkbox.clicked.connect(lambda: [self.discord_manager.toggle(self.system_lang), self.update_error_discord(), self.save_data()])
        discord_checkbox.setChecked(self.discord_manager.is_enabled())
        layout.addWidget(discord_checkbox)
        
        ask_update_checkbox = QCheckBox(lang(self.system_lang, "ask_update"))
        ask_update_checkbox.setStyleSheet(checkbox_style)
        ask_update_checkbox.setChecked(self.config_manager.get_ask_update() == "yes")
        
        def toggle_ask_update():
            current = self.config_manager.get_ask_update()
            user_data = self.config_manager.load_user_data()
            user_data['ask_update'] = "no" if current == "yes" else "yes"
            self.config_manager.save_user_data(user_data)
            self.save_data()
        
        ask_update_checkbox.clicked.connect(toggle_ask_update)
        layout.addWidget(ask_update_checkbox)
        
        def set_lang():
            new_lang = lang_combobox.currentData()
            change_language(new_lang)
            self.set_language(new_lang)
            
            # Update settings window
            window_settings.setWindowTitle(lang(new_lang, "settings"))
            label_jvm_arguments.setText(lang(new_lang, "label_jvm_args"))
            label_tip.setText(lang(new_lang, "jvm_tip"))
            snapshots_checkbox.setText(lang(new_lang, "checkbox_snapshots"))
            discord_checkbox.setText(lang(new_lang, "discord_rpc"))
            ask_update_checkbox.setText(lang(new_lang, "ask_update"))
            label_lang.setText(lang(new_lang, "language"))
            bt_save.setText(lang(new_lang, "save"))
            bt_open_minecraft.setText(lang(new_lang, "open_minecraft_directory"))
            bt_open_launcher.setText(lang(new_lang, "open_launcher_directory"))
            
            # Update combo box
            lang_combobox.blockSignals(True)
            lang_combobox.clear()
            available_langs = lang(new_lang, "available_languages")
            for key, value in available_langs.items():
                lang_combobox.addItem(value, key)
            lang_combobox.setCurrentText(available_langs[new_lang])
            lang_combobox.blockSignals(False)
            
            # Save language
            config = self.config_manager.load_config()
            config["lang"] = new_lang
            self.config_manager.save_config(config)
        
        lang_combobox.currentIndexChanged.connect(set_lang)
        
        def set_jvm():
            entry_value = entry_jvm_arguments.text().strip()
            if entry_value != "" and not re.match("^-*$", entry_value):
                self.jvm_arguments = entry_value.split()
                self.jvm_arguments = [arg.replace("\n", "") for arg in self.jvm_arguments if arg.strip() not in ["", "-"] and not re.match("^-*$", arg)]
                if not self.jvm_arguments:
                    self.jvm_arguments = variables.defaultJVM
            else:
                self.jvm_arguments = variables.defaultJVM
        
        # Buttons
        bt_save = QPushButton(lang(self.system_lang, "save"))
        bt_save.setFixedSize(480, 30)
        bt_save
        bt_save.clicked.connect(lambda: [set_jvm(), self.save_data(), window_settings.accept()])
        layout.addWidget(bt_save)
        
        bt_open_minecraft = QPushButton(lang(self.system_lang, "open_minecraft_directory"))
        bt_open_minecraft.setFixedSize(480, 30)
        bt_open_minecraft
        bt_open_minecraft.clicked.connect(open_minecraft_dir)
        layout.addWidget(bt_open_minecraft)
        
        bt_open_launcher = QPushButton(lang(self.system_lang, "open_launcher_directory"))
        bt_open_launcher.setFixedSize(480, 30)
        bt_open_launcher
        bt_open_launcher.clicked.connect(open_launcher_dir)
        layout.addWidget(bt_open_launcher)
        
        window_settings.setLayout(layout)
        window_settings.exec_()