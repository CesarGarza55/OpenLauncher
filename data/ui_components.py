"""
UI Components for OpenLauncher
Contains main window UI, dialogs, and styling
"""

import re
import os
import sys
import json
import time
import webbrowser
import minecraft_launcher_lib
import requests
from PyQt5.QtWidgets import (QMainWindow, QPushButton, QVBoxLayout, QWidget, QGroupBox, 
                             QLineEdit, QLabel, QComboBox, QHBoxLayout, QGridLayout, 
                             QSpacerItem, QSizePolicy, QCheckBox, QTextEdit, QAction, 
                             QApplication, QMessageBox, QDialog, QGraphicsBlurEffect, QSplashScreen,
                             QTabWidget)
from PyQt5.QtCore import QSize, Qt, QCoreApplication, QMetaObject, QThreadPool, QThread, pyqtSignal
from PyQt5.QtGui import QIcon, QPixmap
from tkinter import messagebox

import variables
from variables import write_log
from lang import lang, change_language
from mod_manager import show_mod_manager
from microsoft_auth import login
from workers import CommandWorker, FunctionWorker, StdoutRedirector
from version_installer import VersionInstaller
from auth_manager import authenticate, logout
from utils import open_website, open_launcher_dir, open_minecraft_dir, is_java_installed
from resource_cache import get_cached_pixmap, get_cached_icon
from material_design import (MaterialCard, AnimatedButton, FadeInWidget, 
                            MaterialColors, MATERIAL_STYLESHEET)


class Ui_MainWindow(object):
    """Main window UI setup and configuration"""
    
    def setupUi(self, MainWindow, bg_path, bg_color, icon, bg_blur, system_lang, 
                versions, forge_versions, fabric_versions, fabric_loaders,
                discord_manager, config_manager):
        
        # Store references
        self.system_lang = system_lang
        self.bg_color = bg_color
        self.bg_path = bg_path
        self.icon = icon
        self.bg_blur = bg_blur
        self.discord_manager = discord_manager
        self.config_manager = config_manager
        self.minecraft_directory = variables.minecraft_directory
        self.app_dir = variables.app_directory
        
        # Initialize version installer
        self.version_installer = VersionInstaller(self.minecraft_directory)
        
        # Store version data
        self.versions = versions
        self.forge_versions = forge_versions
        self.fabric_versions = fabric_versions
        self.fabric_loaders = fabric_loaders
        
        # Initialize state variables
        self.jvm_arguments = ""
        self.maximize = False
        self.user_name = ""
        self.access_token = ""
        self.user_uuid = ""
        self.show_snapshots = False
        self.output = ""
        
        if not MainWindow.objectName():
            MainWindow.setObjectName("MainWindow")
        MainWindow.resize(1200, 700)
        MainWindow.setMinimumSize(QSize(1200, 700))
        MainWindow.setWindowIcon(QIcon(icon))
        
        # Clean central widget
        self.centralwidget = QWidget(MainWindow)
        self.centralwidget.setObjectName("centralwidget")
        self.centralwidget.setStyleSheet(f"background-color: {MaterialColors.BACKGROUND};")
        self.resizeEvent = self.on_resize

        # Main layout with tabs
        self.main_layout = QVBoxLayout(self.centralwidget)
        self.main_layout.setObjectName("main_layout")
        self.main_layout.setSpacing(0)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        
        # Tab widget for main content and settings (tabs hidden)
        self.tab_widget = QTabWidget(self.centralwidget)
        self.tab_widget.setObjectName("tab_widget")
        self.tab_widget.setStyleSheet(f"""
            QTabWidget::pane {{
                border: none;
                background-color: {MaterialColors.BACKGROUND};
            }}
            QTabBar::tab {{
                display: none;
            }}
        """)
        # Hide tab bar completely
        self.tab_widget.tabBar().setVisible(False)
        
        # Game tab (main content)
        self.game_tab = QWidget()
        self.game_tab.setObjectName("game_tab")
        self.game_tab_layout = QGridLayout(self.game_tab)
        self.game_tab_layout.setSpacing(16)
        self.game_tab_layout.setContentsMargins(20, 20, 20, 20)
        
        # Top clean card
        self.top_group = MaterialCard(self.game_tab, elevated=False)
        self.top_group.setProperty("class", "card")
        self.top_group_layout = QVBoxLayout(self.top_group)
        self.top_group_layout.setObjectName("top_group_layout")
        self.top_group_layout.setSpacing(12)
        self.top_group_layout.setContentsMargins(20, 20, 20, 20)

        # Discord error label with modern styling
        self.discord_e = QLabel(self.game_tab)
        self.discord_e.setObjectName("discord_e")
        self.discord_e.setText(discord_manager.get_error())
        self.discord_e.setProperty("class", "caption")
        self.discord_e.setAlignment(Qt.AlignCenter)
        self.top_group_layout.addWidget(self.discord_e)

        # Main horizontal layout with spacing
        self.horizontalLayout = QHBoxLayout()
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.horizontalLayout.setSpacing(32)
        
        # Left column - User account section
        self.verticalLayout_2 = QVBoxLayout()
        self.verticalLayout_2.setObjectName("verticalLayout_2")
        self.verticalLayout_2.setSpacing(16)

        # Title label with modern styling
        self.label = QLabel(self.game_tab)
        self.label.setObjectName("label")
        self.label.setProperty("class", "title")
        self.label.setAlignment(Qt.AlignCenter | Qt.AlignVCenter)
        self.label.setWordWrap(True)
        self.verticalLayout_2.addWidget(self.label)
        
        # Modern text input
        self.lineEdit = QLineEdit(self.game_tab)
        self.lineEdit.setObjectName("lineEdit")
        self.lineEdit.setMinimumSize(QSize(350, 48))
        self.lineEdit.setMaximumSize(QSize(400, 48))
        self.lineEdit.setPlaceholderText(lang(system_lang, "user_placeholder"))
        self.lineEdit.setAlignment(Qt.AlignCenter)
        self.lineEdit.setFocusPolicy(Qt.ClickFocus)
        self.verticalLayout_2.addWidget(self.lineEdit)

        # Modern animated account button
        self.btn_account = AnimatedButton("", self.game_tab, "primary")
        self.btn_account.setObjectName("btn_account")
        self.btn_account.setMinimumSize(QSize(350, 48))
        self.btn_account.setMaximumSize(QSize(400, 48))
        self.verticalLayout_2.addWidget(self.btn_account)

        self.horizontalLayout.addLayout(self.verticalLayout_2)
        
        # Spacer between columns
        self.horizontalSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.horizontalLayout.addItem(self.horizontalSpacer)

        # Right column - Installation buttons
        self.verticalLayout = QVBoxLayout()
        self.verticalLayout.setObjectName("verticalLayout")
        self.verticalLayout.setSpacing(12)
        
        # Modern animated buttons
        self.btn_minecraft = AnimatedButton("", self.game_tab, "outlined")
        self.btn_minecraft.setObjectName("pushButton")
        self.btn_minecraft.setMinimumSize(QSize(350, 48))
        self.btn_minecraft.setMaximumSize(QSize(400, 48))
        self.verticalLayout.addWidget(self.btn_minecraft)

        self.btn_fabric = AnimatedButton("", self.game_tab, "outlined")
        self.btn_fabric.setObjectName("btn_fabric")
        self.btn_fabric.setMinimumSize(QSize(350, 48))
        self.btn_fabric.setMaximumSize(QSize(400, 48))
        self.verticalLayout.addWidget(self.btn_fabric)

        self.btn_forge = AnimatedButton("", self.game_tab, "outlined")
        self.btn_forge.setObjectName("btn_forge")
        self.btn_forge.setMinimumSize(QSize(350, 48))
        self.btn_forge.setMaximumSize(QSize(400, 48))
        self.verticalLayout.addWidget(self.btn_forge)

        self.btn_mod_manger = AnimatedButton("", self.game_tab, "outlined")
        self.btn_mod_manger.setObjectName("btn_mod_manger")
        self.btn_mod_manger.setMinimumSize(QSize(350, 48))
        self.btn_mod_manger.setMaximumSize(QSize(400, 48))
        self.verticalLayout.addWidget(self.btn_mod_manger)

        # Settings button - outlined style
        self.btn_settings_nav = AnimatedButton("", self.game_tab, "outlined")
        self.btn_settings_nav.setObjectName("btn_settings_nav")
        self.btn_settings_nav.setMinimumSize(QSize(350, 48))
        self.btn_settings_nav.setMaximumSize(QSize(400, 48))
        self.btn_settings_nav.clicked.connect(lambda: self.tab_widget.setCurrentIndex(1))
        self.verticalLayout.addWidget(self.btn_settings_nav)

        self.horizontalLayout.addLayout(self.verticalLayout)
        self.top_group_layout.addLayout(self.horizontalLayout)
        self.game_tab_layout.addWidget(self.top_group, 0, 0, 1, 1)

        # Bottom clean card for console
        self.bottom_group = MaterialCard(self.game_tab, elevated=False)
        self.bottom_group.setProperty("class", "card")
        self.bottom_group_layout = QVBoxLayout(self.bottom_group)
        self.bottom_group_layout.setObjectName("bottom_group_layout")
        self.bottom_group_layout.setSpacing(12)
        self.bottom_group_layout.setContentsMargins(20, 20, 20, 20)

        # Console output with dark styling
        self.console_output = QTextEdit(self.game_tab)
        self.console_output.setObjectName("console_output")
        self.console_output.setMinimumSize(QSize(0, 150))
        self.console_output.setStyleSheet(f"""
            QTextEdit {{
                background-color: {MaterialColors.SURFACE};
                color: {MaterialColors.TEXT_PRIMARY};
                border: 1px solid {MaterialColors.BORDER};
                border-radius: 4px;
                padding: 10px;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 11px;
            }}
        """)
        self.console_output.setInputMethodHints(Qt.ImhMultiLine | Qt.ImhNoEditMenu)
        self.console_output.setTextInteractionFlags(Qt.TextSelectableByKeyboard | Qt.TextSelectableByMouse)
        self.console_output.setReadOnly(True)
        self.bottom_group_layout.addWidget(self.console_output)

        # Bottom controls layout
        self.horizontalLayout_4 = QHBoxLayout()
        self.horizontalLayout_4.setObjectName("horizontalLayout_4")
        self.horizontalLayout_4.setSpacing(16)
        
        # Modern ComboBox for version selection
        self.comboBox = QComboBox(self.game_tab)
        self.comboBox.setObjectName("comboBox")
        self.comboBox.setMinimumSize(QSize(250, 48))
        self.comboBox.setMaximumSize(QSize(400, 48))
        self.horizontalLayout_4.addWidget(self.comboBox)

        # Spacer
        self.horizontalSpacer_3 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.horizontalLayout_4.addItem(self.horizontalSpacer_3)

        # Play button - primary style (highlighted)
        self.btn_play = AnimatedButton("", self.game_tab, "primary")
        self.btn_play.setObjectName("btn_play")
        self.btn_play.setMinimumSize(QSize(180, 48))
        self.btn_play.setMaximumSize(QSize(220, 48))
        self.horizontalLayout_4.addWidget(self.btn_play)

        self.bottom_group_layout.addLayout(self.horizontalLayout_4)
        self.game_tab_layout.addWidget(self.bottom_group, 1, 0, 1, 1)
        
        # Add game tab to tab widget
        self.tab_widget.addTab(self.game_tab, lang(self.system_lang, "game"))
        
        # Settings tab
        self.settings_tab = self.create_settings_tab()
        self.tab_widget.addTab(self.settings_tab, lang(self.system_lang, "settings"))
        
        # Mod Manager tab
        self.mod_manager_tab = self.create_mod_manager_tab()
        self.tab_widget.addTab(self.mod_manager_tab, lang(self.system_lang, "btn_mod_manager"))
        
        # Add tab widget to main layout
        self.main_layout.addWidget(self.tab_widget)

        MainWindow.setCentralWidget(self.centralwidget)

        self.retranslateUi(MainWindow)
        QMetaObject.connectSlotsByName(MainWindow)

        # Apply styles
        self.apply_styles(MainWindow)
        
        # Connect buttons
        self.connect_buttons()
        
        # Initialize UI state
        self.initialize_ui_state(MainWindow)
    
    def create_settings_tab(self):
        """Create settings tab with modern dark styling"""
        settings_widget = QWidget()
        settings_layout = QVBoxLayout(settings_widget)
        settings_layout.setSpacing(20)
        settings_layout.setContentsMargins(20, 20, 20, 20)
        
        # Header with back button
        header_layout = QHBoxLayout()
        self.settings_back_btn = AnimatedButton("← " + lang(self.system_lang, "back"), settings_widget, "text")
        self.settings_back_btn.clicked.connect(lambda: self.tab_widget.setCurrentIndex(0))
        header_layout.addWidget(self.settings_back_btn)
        header_layout.addStretch()
        settings_layout.addLayout(header_layout)
        
        # JVM Arguments Card
        jvm_card = MaterialCard(settings_widget, elevated=False)
        jvm_layout = QVBoxLayout(jvm_card)
        jvm_layout.setSpacing(12)
        jvm_layout.setContentsMargins(20, 20, 20, 20)
        
        self.jvm_title = QLabel(lang(self.system_lang, "label_jvm_args"))
        self.jvm_title.setProperty("class", "subtitle")
        jvm_layout.addWidget(self.jvm_title)
        
        self.jvm_tip = QLabel(lang(self.system_lang, "jvm_tip"))
        self.jvm_tip.setStyleSheet(f"color: {MaterialColors.WARNING}; font-size: 12px;")
        self.jvm_tip.setWordWrap(True)
        jvm_layout.addWidget(self.jvm_tip)
        
        self.entry_jvm_arguments = QLineEdit()
        self.entry_jvm_arguments.setPlaceholderText("JVM arguments (-Xms512M -Xmx8G ...)")
        self.entry_jvm_arguments.setMinimumHeight(40)
        if self.jvm_arguments != "" and self.jvm_arguments != variables.defaultJVM:
            self.entry_jvm_arguments.setText(" ".join(self.jvm_arguments))
        jvm_layout.addWidget(self.entry_jvm_arguments)
        
        settings_layout.addWidget(jvm_card)
        
        # Language Card
        lang_card = MaterialCard(settings_widget, elevated=False)
        lang_layout = QVBoxLayout(lang_card)
        lang_layout.setSpacing(12)
        lang_layout.setContentsMargins(20, 20, 20, 20)
        
        self.lang_title = QLabel(lang(self.system_lang, "language"))
        self.lang_title.setProperty("class", "subtitle")
        lang_layout.addWidget(self.lang_title)
        
        self.lang_combobox = QComboBox()
        self.lang_combobox.setMinimumHeight(40)
        available_langs = lang(self.system_lang, "available_languages")
        for key, value in available_langs.items():
            self.lang_combobox.addItem(value, key)
        current_index = self.lang_combobox.findData(self.system_lang)
        if current_index >= 0:
            self.lang_combobox.setCurrentIndex(current_index)
        lang_layout.addWidget(self.lang_combobox)
        
        settings_layout.addWidget(lang_card)
        
        # Options Card
        options_card = MaterialCard(settings_widget, elevated=False)
        options_layout = QVBoxLayout(options_card)
        options_layout.setSpacing(12)
        options_layout.setContentsMargins(20, 20, 20, 20)
        
        self.options_title = QLabel(lang(self.system_lang, "options"))
        self.options_title.setProperty("class", "subtitle")
        options_layout.addWidget(self.options_title)
        
        self.maximize_checkbox = QCheckBox(lang(self.system_lang, "maximize"))
        self.maximize_checkbox.setChecked(self.maximize)
        options_layout.addWidget(self.maximize_checkbox)
        
        self.snapshots_checkbox = QCheckBox(lang(self.system_lang, "show_snapshots"))
        self.snapshots_checkbox.setChecked(self.show_snapshots)
        options_layout.addWidget(self.snapshots_checkbox)
        
        self.discord_checkbox = QCheckBox(lang(self.system_lang, "discord_rpc"))
        self.discord_checkbox.setChecked(self.discord_manager.enabled)
        options_layout.addWidget(self.discord_checkbox)
        
        settings_layout.addWidget(options_card)
        
        # Links Card
        links_card = MaterialCard(settings_widget, elevated=False)
        links_layout = QVBoxLayout(links_card)
        links_layout.setSpacing(12)
        links_layout.setContentsMargins(20, 20, 20, 20)
        
        self.links_title = QLabel(lang(self.system_lang, "links"))
        self.links_title.setProperty("class", "subtitle")
        links_layout.addWidget(self.links_title)
        
        links_hlayout = QHBoxLayout()
        links_hlayout.setSpacing(12)
        
        self.btn_launcher_dir = AnimatedButton(lang(self.system_lang, "open_launcher_directory"), settings_widget, "outlined")
        self.btn_launcher_dir.setMinimumHeight(40)
        self.btn_launcher_dir.clicked.connect(open_launcher_dir)
        links_hlayout.addWidget(self.btn_launcher_dir)
        
        self.btn_minecraft_dir = AnimatedButton(lang(self.system_lang, "open_minecraft_directory"), settings_widget, "outlined")
        self.btn_minecraft_dir.setMinimumHeight(40)
        self.btn_minecraft_dir.clicked.connect(open_minecraft_dir)
        links_hlayout.addWidget(self.btn_minecraft_dir)
        
        links_layout.addLayout(links_hlayout)
        
        github_btn = AnimatedButton("GitHub", settings_widget, "text")
        github_btn.setMinimumHeight(40)
        github_btn.clicked.connect(lambda: open_website("https://github.com/CesarGarza55/OpenLauncher"))
        links_layout.addWidget(github_btn)
        
        settings_layout.addWidget(links_card)
        
        # Spacer at bottom
        settings_layout.addStretch()
        
        # Save button
        self.save_btn = AnimatedButton(lang(self.system_lang, "save"), settings_widget, "primary")
        self.save_btn.setMinimumHeight(48)
        self.save_btn.clicked.connect(self.save_settings)
        settings_layout.addWidget(self.save_btn)
        
        return settings_widget
    
    def save_settings(self):
        """Save settings from the settings tab"""
        # Save JVM arguments
        jvm_text = self.entry_jvm_arguments.text().strip()
        if jvm_text:
            self.jvm_arguments = jvm_text.split()
        else:
            self.jvm_arguments = variables.defaultJVM
        
        # Save language
        new_lang = self.lang_combobox.currentData()
        if new_lang != self.system_lang:
            self.system_lang = new_lang
            change_language(new_lang)
            # Update UI text immediately
            self.update_all_translations()
        
        # Save options
        self.maximize = self.maximize_checkbox.isChecked()
        self.show_snapshots = self.snapshots_checkbox.isChecked()
        
        # Discord RPC
        discord_enabled = self.discord_checkbox.isChecked()
        if discord_enabled != self.discord_manager.enabled:
            if discord_enabled:
                self.discord_manager.connect()
            else:
                self.discord_manager.disconnect()
        
        # Save all data
        self.save_data()
        
        # Update versions list if snapshots changed
        self.update_list_versions()
        
        # Show confirmation
        QMessageBox.information(None, lang(self.system_lang, "success"), 
                               lang(self.system_lang, "settings_saved"))
        
        # Switch back to game tab
        self.tab_widget.setCurrentIndex(0)
    
    def create_mod_manager_tab(self):
        """Create mod manager tab with modern dark styling"""
        from mod_manager import ModManagerWidget
        
        mod_manager_widget = ModManagerWidget(self.system_lang)
        return mod_manager_widget
    
    def update_all_translations(self):
        """Update all UI translations after language change"""
        # Update main window title
        self.window().setWindowTitle(f'{lang(self.system_lang, "launcher_name")} — {variables.launcher_version}')
        
        # Update button texts
        self.btn_minecraft.setText(lang(self.system_lang, "btn_install_minecraft"))
        self.btn_fabric.setText(lang(self.system_lang, "btn_install_loader"))
        self.btn_forge.setText(lang(self.system_lang, "btn_install_loader").replace("Fabric", "Forge"))
        self.btn_play.setText(lang(self.system_lang, "btn_play"))
        self.btn_mod_manger.setText(lang(self.system_lang, "btn_mod_manager"))
        self.btn_settings_nav.setText(lang(self.system_lang, "settings"))
        
        # Update account button
        if hasattr(self, 'user_name') and self.user_name:
            self.label.setText(f"{lang(self.system_lang, 'logged_as')} {self.user_name}")
        else:
            self.label.setText(lang(self.system_lang, "label_username"))
            
        if hasattr(self, 'access_token') and self.access_token:
            self.btn_account.setText(lang(self.system_lang, "logout_microsoft"))
        else:
            self.btn_account.setText(lang(self.system_lang, "login_microsoft"))
        
        # Update placeholder
        self.lineEdit.setPlaceholderText(lang(self.system_lang, "user_placeholder"))
        
        # Update settings tab
        self.update_settings_translations()
        
        # Update mod manager tab
        if hasattr(self, 'mod_manager_tab') and hasattr(self.mod_manager_tab, 'update_translations'):
            self.mod_manager_tab.update_translations(self.system_lang)
    
    def update_settings_translations(self):
        """Update settings tab translations"""
        if not hasattr(self, 'settings_tab'):
            return
                
        # Update labels
        if hasattr(self, 'jvm_title'):
            self.jvm_title.setText(lang(self.system_lang, "label_jvm_args"))
        
        if hasattr(self, 'jvm_tip'):
            self.jvm_tip.setText(lang(self.system_lang, "jvm_tip"))
            
        if hasattr(self, 'lang_title'):
            self.lang_title.setText(lang(self.system_lang, "language"))
            
        if hasattr(self, 'options_title'):
            self.options_title.setText(lang(self.system_lang, "options"))
            
        if hasattr(self, 'links_title'):
            self.links_title.setText(lang(self.system_lang, "links"))
        
        # Update checkboxes
        if hasattr(self, 'maximize_checkbox'):
            self.maximize_checkbox.setText(lang(self.system_lang, "maximize"))
            
        if hasattr(self, 'snapshots_checkbox'):
            self.snapshots_checkbox.setText(lang(self.system_lang, "show_snapshots"))
            
        if hasattr(self, 'discord_checkbox'):
            self.discord_checkbox.setText(lang(self.system_lang, "discord_rpc"))
        
        # Update buttons
        if hasattr(self, 'btn_launcher_dir'):
            self.btn_launcher_dir.setText(lang(self.system_lang, "open_launcher_directory"))
            
        if hasattr(self, 'btn_minecraft_dir'):
            self.btn_minecraft_dir.setText(lang(self.system_lang, "open_minecraft_directory"))
            
        if hasattr(self, 'save_btn'):
            self.save_btn.setText(lang(self.system_lang, "save"))
        
        # Update language combobox
        if hasattr(self, 'lang_combobox'):
            self.lang_combobox.clear()
            available_langs = lang(self.system_lang, "available_languages")
            for key, value in available_langs.items():
                self.lang_combobox.addItem(value, key)
            current_index = self.lang_combobox.findData(self.system_lang)
            if current_index >= 0:
                self.lang_combobox.setCurrentIndex(current_index)
        self.lineEdit.setPlaceholderText(lang(self.system_lang, "user_placeholder"))

    def apply_styles(self, MainWindow):
        """Apply Material Design styling - most styling handled by material_design.py"""
        # Material theme is applied globally, but we can add custom tweaks here
        self.comboBox.setMaxVisibleItems(10)

    def connect_buttons(self):
        """Connect buttons to their respective functions"""
        self.btn_minecraft.clicked.connect(self.install_normal_versions)
        self.btn_fabric.clicked.connect(self.install_fabric_versions)
        self.btn_forge.clicked.connect(self.install_forge_versions)
        self.btn_play.clicked.connect(self.run_minecraft)
        self.btn_mod_manger.clicked.connect(self.open_mod_manager)
        self.btn_account.clicked.connect(self.login_microsoft)

    def initialize_ui_state(self, MainWindow):
        """Initialize UI state from saved configuration"""
        self.update_list_versions()
        
        # Check for Microsoft account authentication
        if os.path.exists(variables.refresh_token_file):
            try:
                profile = login(self.system_lang, self.icon)
            except Exception as e:
                profile = None
            
            if not variables.check_network():
                profile = "No connection"
            
            if profile == "No connection":
                self.lineEdit.setVisible(True)
                self.label.setText(lang(self.system_lang, "label_username"))
                self.btn_account.setText(lang(self.system_lang, "no_internet"))
                self.btn_account.clicked.disconnect()
                self.btn_account.setDisabled(True)
            elif profile and 'id' in profile and 'name' in profile:
                self.access_token = profile['access_token']
                self.user_name = profile['name']
                self.user_uuid = profile['id']
                self.lineEdit.setVisible(False)
                self.label.setText(f"{lang(self.system_lang, 'logged_as')} {profile['name']}")
                self.btn_account.setText(lang(self.system_lang, "logout_microsoft"))
                self.btn_account.setIcon(QIcon(variables.logout_icon))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.logout_microsoft)
            else:
                self.lineEdit.setVisible(True)
                self.label.setText(lang(self.system_lang, "label_username"))
                self.btn_account.setText(lang(self.system_lang, "login_microsoft"))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.login_microsoft)
        
        # Load user data
        user_data = self.config_manager.load_user_data()
        if user_data:
            self.user_name = user_data.get('name', '')
            last_version = user_data.get('last_version', '')
            self.show_snapshots = user_data.get('toggle_snapshots', False)
            self.jvm_arguments = user_data.get('jvm_arguments', variables.defaultJVM)
            ask_update = user_data.get('ask_update', 'yes')
            discord_rpc = user_data.get('discord_rpc', False)
            self.maximize = user_data.get('maximized', False)
            
            if self.user_name:
                self.lineEdit.setText(self.user_name)
            if last_version:
                index = self.comboBox.findText(last_version, Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
            
            if discord_rpc and not self.discord_manager.is_enabled():
                self.discord_manager.connect(self.system_lang)
        
        # Load UUID
        self.user_uuid = self.config_manager.load_user_uuid()

    def retranslateUi(self, MainWindow):
        """Set UI text and icons"""
        MainWindow.setWindowTitle(
            QCoreApplication.translate(
                "MainWindow", 
                f'{lang(self.system_lang, "launcher_name")} — {variables.launcher_version}', 
                None
            )
        )
        self.label.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "label_username"), None))
        self.btn_minecraft.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_install_minecraft"), None))
        self.btn_fabric.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_install_loader"), None))
        self.btn_forge.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_install_loader").replace("Fabric", "Forge"), None))
        self.btn_play.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_play"), None))
        self.btn_mod_manger.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_mod_manager"), None))
        self.btn_account.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "login_microsoft"), None))
        self.btn_settings_nav.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "settings"), None))
        
        # Update tab names
        self.tab_widget.setTabText(0, QCoreApplication.translate("MainWindow", lang(self.system_lang, "game"), None))
        self.tab_widget.setTabText(1, QCoreApplication.translate("MainWindow", lang(self.system_lang, "settings"), None))

        # Set icons (using cached icons for better performance)
        self.btn_minecraft.setIcon(get_cached_icon(variables.minecraft_icon))
        self.btn_minecraft.setIconSize(QSize(20, 20))
        self.btn_fabric.setIcon(get_cached_icon(variables.fabric_icon))
        self.btn_fabric.setIconSize(QSize(20, 20))
        self.btn_forge.setIcon(get_cached_icon(variables.forge_icon))
        self.btn_forge.setIconSize(QSize(30, 30))
        self.btn_play.setIcon(get_cached_icon(variables.play_icon))
        self.btn_play.setIconSize(QSize(20, 20))
        self.btn_mod_manger.setIcon(get_cached_icon(variables.mod_icon))
        self.btn_mod_manger.setIconSize(QSize(20, 20))
        self.btn_account.setIcon(get_cached_icon(variables.login_icon))
        self.btn_account.setIconSize(QSize(20, 20))

    def login_microsoft(self):
        """Handle Microsoft account login"""
        try:
            profile = authenticate(self.system_lang, self.icon)
            if profile and 'id' in profile and 'name' in profile:
                self.access_token = profile['access_token']
                self.user_name = profile['name']
                self.lineEdit.setText(profile['name'])
                self.lineEdit.setVisible(False)
                self.label.setText(f"{lang(self.system_lang, 'logged_as')} {profile['name']}")
                self.btn_account.setText(lang(self.system_lang, "logout_microsoft"))
                self.btn_account.setIcon(QIcon(variables.logout_icon))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.logout_microsoft)
                self.config_manager.save_user_uuid(profile['id'])
                self.save_data()
            else:
                if 'error' in profile and profile['error'] == 'NOT_FOUND':
                    if messagebox.askyesno(
                        lang(self.system_lang, "microsoft_account_not_found"),
                        lang(self.system_lang, "microsoft_account_not_found_desc")
                    ):
                        webbrowser.open("https://www.minecraft.net/")
                
                self.lineEdit.setVisible(True)
                self.label.setText(lang(self.system_lang, "label_username"))
                self.lineEdit.setText("")
                self.btn_account.setText(lang(self.system_lang, "login_microsoft"))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.login_microsoft)
                self.config_manager.save_user_uuid("")
                self.access_token = ""
                self.save_data()
        except Exception as e:
            write_log(e, "microsoft_auth")

    def logout_microsoft(self):
        """Handle Microsoft account logout"""
        if not messagebox.askyesno(
            lang(self.system_lang, "ask_logout_title"),
            lang(self.system_lang, "ask_logout_desc")
        ):
            return
        
        try:
            logout()
            self.access_token = ""
            self.config_manager.save_user_uuid("")
            
            self.lineEdit.setVisible(True)
            self.label.setText(lang(self.system_lang, "label_username"))
            self.lineEdit.setText("")
            self.btn_account.setText(lang(self.system_lang, "login_microsoft"))
            self.btn_account.setIcon(QIcon(variables.login_icon))
            self.btn_account.clicked.disconnect()
            self.btn_account.clicked.connect(self.login_microsoft)
            self.save_data()
        except Exception as e:
            write_log(e, "microsoft_logout")

    def on_resize(self, event):
        """Handle window resize event - no background image in Material Design"""
        pass

    def update_error_discord(self):
        """Update Discord error label"""
        discord_error = self.discord_manager.get_error()
        if discord_error != "":
            self.discord_e.setText(discord_error)
            self.discord_e.show()
        else:
            self.discord_e.setText("")
            self.discord_e.hide()

    def clear_console(self):
        """Clear console output"""
        self.console_output.clear()

    def set_status(self, status: str):
        """Set status message"""
        self.output = status
        print(self.output)

    def set_max(self, new_max: int):
        """Set maximum progress value"""
        pass

    def set_progress(self, progress_value: int):
        """Update progress value"""
        pass

    # Continue in next part due to length...
