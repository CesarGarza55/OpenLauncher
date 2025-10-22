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
                             QApplication, QMessageBox, QDialog, QGraphicsBlurEffect, QSplashScreen)
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
        MainWindow.resize(850, 500)
        MainWindow.setMinimumSize(QSize(850, 500))
        MainWindow.setWindowIcon(QIcon(icon))
        self.centralwidget = QWidget(MainWindow)
        self.centralwidget.setObjectName("centralwidget")
        self.resizeEvent = self.on_resize

        # Create the background image for the central widget with blur effect
        self.background = QLabel(self.centralwidget)
        self.background.setObjectName("background")
        self.background.setGeometry(0, 0, 850, 500)
        self.background.setPixmap(get_cached_pixmap(bg_path, 850, 500, True))

        self.blur_effect = QGraphicsBlurEffect()
        self.blur_effect.setBlurRadius(bg_blur)
        self.background.setGraphicsEffect(self.blur_effect)

        self.gridLayout = QGridLayout(self.centralwidget)
        self.gridLayout.setObjectName("gridLayout")

        # Top group
        self.top_group = QGroupBox(self.centralwidget)
        self.top_group.setStyleSheet(f"background-color: rgba({bg_color}, 0.3); border-radius: 5px;")
        self.top_group_layout = QVBoxLayout(self.top_group)
        self.top_group_layout.setObjectName("top_group_layout")

        self.discord_e = QLabel(self.centralwidget)
        self.discord_e.setObjectName("discord_e")
        self.discord_e.setText(discord_manager.get_error())
        self.discord_e.setStyleSheet("color: #ffffff; background-color: transparent; font-size: 14px; font: bold;")
        self.discord_e.setAlignment(Qt.AlignCenter)
        self.top_group_layout.addWidget(self.discord_e)

        self.horizontalLayout = QHBoxLayout()
        self.horizontalLayout.setObjectName("horizontalLayout")
        self.verticalLayout_2 = QVBoxLayout()
        self.verticalLayout_2.setObjectName("verticalLayout_2")
        self.horizontalLayout_2 = QHBoxLayout()
        self.horizontalLayout_2.setObjectName("horizontalLayout_2")

        self.label = QLabel(self.centralwidget)
        self.label.setObjectName("label")
        self.label.setAlignment(Qt.AlignCenter | Qt.AlignVCenter)
        self.label.setWordWrap(True)
        self.verticalLayout_2.addWidget(self.label)
        
        self.lineEdit = QLineEdit(self.centralwidget)
        self.lineEdit.setObjectName("lineEdit")
        sizePolicy = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.lineEdit.sizePolicy().hasHeightForWidth())
        self.lineEdit.setSizePolicy(sizePolicy)
        self.lineEdit.setMinimumSize(QSize(350, 30))
        self.lineEdit.setMaximumSize(QSize(350, 16777215))
        self.lineEdit.setPlaceholderText(lang(system_lang, "user_placeholder"))
        self.lineEdit.setAlignment(Qt.AlignCenter)
        self.lineEdit.setFocusPolicy(Qt.ClickFocus)
        self.verticalLayout_2.addWidget(self.lineEdit)

        self.btn_account = QPushButton(self.centralwidget)
        self.btn_account.setObjectName("btn_account")
        sizePolicy1 = QSizePolicy(QSizePolicy.MinimumExpanding, QSizePolicy.Fixed)
        sizePolicy1.setHeightForWidth(self.btn_account.sizePolicy().hasHeightForWidth())
        self.btn_account.setSizePolicy(sizePolicy1)
        self.btn_account.setMinimumSize(QSize(350, 30))
        self.btn_account.setMaximumSize(QSize(350, 30))
        self.btn_account.clicked.connect(self.login_microsoft)
        self.verticalLayout_2.addWidget(self.btn_account)

        self.horizontalLayout.addLayout(self.verticalLayout_2)
        self.horizontalSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.horizontalLayout.addItem(self.horizontalSpacer)

        self.verticalLayout = QVBoxLayout()
        self.verticalLayout.setObjectName("verticalLayout")
        
        self.btn_minecraft = QPushButton(self.centralwidget)
        self.btn_minecraft.setObjectName("pushButton")
        sizePolicy1.setHorizontalStretch(0)
        sizePolicy1.setVerticalStretch(0)
        sizePolicy1.setHeightForWidth(self.btn_minecraft.sizePolicy().hasHeightForWidth())
        self.btn_minecraft.setSizePolicy(sizePolicy1)
        self.btn_minecraft.setMinimumSize(QSize(350, 30))
        self.btn_minecraft.setMaximumSize(QSize(350, 30))
        self.verticalLayout.addWidget(self.btn_minecraft)

        self.btn_fabric = QPushButton(self.centralwidget)
        self.btn_fabric.setObjectName("btn_fabric")
        sizePolicy1.setHeightForWidth(self.btn_fabric.sizePolicy().hasHeightForWidth())
        self.btn_fabric.setSizePolicy(sizePolicy1)
        self.btn_fabric.setMinimumSize(QSize(350, 30))
        self.btn_fabric.setMaximumSize(QSize(350, 30))
        self.verticalLayout.addWidget(self.btn_fabric)

        self.btn_forge = QPushButton(self.centralwidget)
        self.btn_forge.setObjectName("btn_forge")
        sizePolicy1.setHeightForWidth(self.btn_forge.sizePolicy().hasHeightForWidth())
        self.btn_forge.setSizePolicy(sizePolicy1)
        self.btn_forge.setMinimumSize(QSize(350, 30))
        self.btn_forge.setMaximumSize(QSize(350, 30))
        self.verticalLayout.addWidget(self.btn_forge)

        self.btn_mod_manger = QPushButton(self.centralwidget)
        self.btn_mod_manger.setObjectName("btn_mod_manger")
        sizePolicy1.setHeightForWidth(self.btn_mod_manger.sizePolicy().hasHeightForWidth())
        self.btn_mod_manger.setSizePolicy(sizePolicy1)
        self.btn_mod_manger.setMinimumSize(QSize(350, 30))
        self.btn_mod_manger.setMaximumSize(QSize(350, 30))
        self.verticalLayout.addWidget(self.btn_mod_manger)

        self.horizontalLayout.addLayout(self.verticalLayout)
        self.top_group_layout.addLayout(self.horizontalLayout)
        self.gridLayout.addWidget(self.top_group, 0, 0, 1, 1)

        # Bottom group
        self.bottom_group = QGroupBox(self.centralwidget)
        self.bottom_group.setStyleSheet(f"background-color: rgba({bg_color}, 0.3); border-radius: 5px;")
        self.bottom_group_layout = QVBoxLayout(self.bottom_group)
        self.bottom_group_layout.setObjectName("bottom_group_layout")

        self.console_output = QTextEdit(self.centralwidget)
        self.console_output.setObjectName("console_output")
        sizePolicy2 = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        sizePolicy2.setHorizontalStretch(0)
        sizePolicy2.setVerticalStretch(0)
        sizePolicy2.setHeightForWidth(self.console_output.sizePolicy().hasHeightForWidth())
        self.console_output.setSizePolicy(sizePolicy2)
        self.console_output.setMinimumSize(QSize(0, 200))
        self.console_output.setInputMethodHints(Qt.ImhMultiLine | Qt.ImhNoEditMenu)
        self.console_output.setTextInteractionFlags(Qt.TextSelectableByKeyboard | Qt.TextSelectableByMouse)
        self.console_output.setReadOnly(True)
        self.bottom_group_layout.addWidget(self.console_output)

        self.horizontalLayout_4 = QHBoxLayout()
        self.horizontalLayout_4.setObjectName("horizontalLayout_4")
        
        self.comboBox = QComboBox(self.centralwidget)
        self.comboBox.setObjectName("comboBox")
        sizePolicy3 = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        sizePolicy3.setHorizontalStretch(1)
        sizePolicy3.setVerticalStretch(0)
        self.comboBox.setMinimumSize(QSize(200, 30))
        self.comboBox.setMaximumSize(QSize(500, 30))
        self.comboBox.setSizePolicy(sizePolicy3)
        self.horizontalLayout_4.addWidget(self.comboBox)

        self.horizontalSpacer_3 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.horizontalLayout_4.addItem(self.horizontalSpacer_3)

        self.btn_settings = QPushButton(self.centralwidget)
        self.btn_settings.setObjectName("btn_settings")
        self.btn_settings.setMinimumSize(QSize(200, 30))
        self.btn_settings.setMaximumSize(QSize(500, 30))
        self.btn_settings.setSizePolicy(sizePolicy3)
        self.horizontalLayout_4.addWidget(self.btn_settings)

        self.horizontalSpacer_5 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.horizontalLayout_4.addItem(self.horizontalSpacer_5)

        self.btn_play = QPushButton(self.centralwidget)
        self.btn_play.setObjectName("btn_play")
        self.btn_play.setMinimumSize(QSize(200, 30))
        self.btn_play.setMaximumSize(QSize(500, 30))
        self.btn_play.setSizePolicy(sizePolicy3)
        self.horizontalLayout_4.addWidget(self.btn_play)

        self.bottom_group_layout.addLayout(self.horizontalLayout_4)
        self.gridLayout.addWidget(self.bottom_group, 1, 0, 1, 1)

        MainWindow.setCentralWidget(self.centralwidget)

        self.retranslateUi(MainWindow)
        QMetaObject.connectSlotsByName(MainWindow)

        # Apply styles
        self.apply_styles(MainWindow)
        
        # Connect buttons
        self.connect_buttons()
        
        # Initialize UI state
        self.initialize_ui_state(MainWindow)

    def apply_styles(self, MainWindow):
        """Apply styling to all UI components"""
        MainWindow.setStyleSheet(f"background-color: rgba({self.bg_color}, 1);")
        
        self.bt_style = f"""
            QPushButton {{
                background-color: rgba({self.bg_color}, 0.5);
                color: #ffffff; 
                border-radius: 5px;
            }}
            QPushButton:hover {{
                background-color: rgba({self.bg_color}, 1);
            }}
            QPushButton:disabled {{
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }}
            QPushButton:focus {{
                outline: none;
                border: none;
            }}
            QPushButton {{
                border: none;
            }}
        """
        
        self.btn_minecraft.setStyleSheet(self.bt_style)
        self.btn_fabric.setStyleSheet(self.bt_style)
        self.btn_forge.setStyleSheet(self.bt_style)
        self.btn_settings.setStyleSheet(self.bt_style)
        self.btn_play.setStyleSheet(self.bt_style)
        self.btn_mod_manger.setStyleSheet(self.bt_style)
        self.btn_account.setStyleSheet(self.bt_style)
        
        self.console_output.setStyleSheet(
            f"background-color: rgba({self.bg_color}, 0.5); "
            f"color: #ffffff; border: none; border-radius: 5px; font-size: 12px;"
        )
        self.label.setStyleSheet(
            f"background-color: rgba({self.bg_color}, 0.5); "
            f"color: #ffffff; font-size: 14px; border-radius: 5px;"
        )
        self.lineEdit.setStyleSheet(f"""
            QLineEdit {{
                background-color: rgba({self.bg_color}, 0.5); 
                color: #ffffff;
                border-radius: 5px;
                border: none;
                padding: 5px;
            }}
            QLineEdit:hover {{
                background-color: rgba({self.bg_color}, 0.8);
            }}
            QLineEdit:disabled {{
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }}
        """)
        self.comboBox.setStyleSheet(f"""
            QComboBox {{
                background-color: rgba({self.bg_color}, 0.5); 
                color: #ffffff; 
                border-radius: 5px;
            }}
            QComboBox:hover {{
                background-color: rgba({self.bg_color}, 1);
            }}
            QComboBox:disabled {{
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }}
            QComboBox QAbstractItemView {{
                background-color: rgba({self.bg_color}, 0.5); 
                color: #ffffff; 
                border-radius: 5px;
            }}
        """)
        self.comboBox.setMaxVisibleItems(10)
        
        tooltip_stylesheet = "QToolTip { color: #ffffff; background-color: #333333; border: 1px solid white; }"
        QApplication.instance().setStyleSheet(tooltip_stylesheet)

    def connect_buttons(self):
        """Connect buttons to their respective functions"""
        self.btn_minecraft.clicked.connect(self.install_normal_versions)
        self.btn_fabric.clicked.connect(self.install_fabric_versions)
        self.btn_forge.clicked.connect(self.install_forge_versions)
        self.btn_settings.clicked.connect(self.settings_window)
        self.btn_play.clicked.connect(self.run_minecraft)
        self.btn_mod_manger.clicked.connect(self.open_mod_manager)

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
        self.btn_settings.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "settings"), None))
        self.btn_play.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_play"), None))
        self.btn_mod_manger.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_mod_manager"), None))
        self.btn_account.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "login_microsoft"), None))

        # Set icons (using cached icons for better performance)
        self.btn_minecraft.setIcon(get_cached_icon(variables.minecraft_icon))
        self.btn_minecraft.setIconSize(QSize(20, 20))
        self.btn_fabric.setIcon(get_cached_icon(variables.fabric_icon))
        self.btn_fabric.setIconSize(QSize(20, 20))
        self.btn_forge.setIcon(get_cached_icon(variables.forge_icon))
        self.btn_forge.setIconSize(QSize(30, 30))
        self.btn_settings.setIcon(get_cached_icon(variables.settings_icon))
        self.btn_settings.setIconSize(QSize(20, 20))
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
        """Handle window resize event"""
        size = event.size()
        self.background.setGeometry(0, 0, size.width(), size.height())
        self.background.setPixmap(get_cached_pixmap(self.bg_path, size.width(), size.height(), True))

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
