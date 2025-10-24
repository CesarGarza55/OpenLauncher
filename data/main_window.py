"""
Main Window Class for OpenLauncher
Combines all UI components and methods
"""

import sys
import os
import json
from PyQt5.QtWidgets import QMainWindow, QTextEdit, QWidget, QVBoxLayout, QLabel, QCheckBox, QPushButton, QHBoxLayout
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPixmap
from PyQt5.QtWidgets import QApplication
from resource_cache import get_cached_pixmap
from material_design import AnimatedButton, MaterialColors

from workers import StdoutRedirector
from ui_components import Ui_MainWindow
from ui_methods import UiMethods
from ui_windows import WindowMethods
from lang import lang


class MainWindow(QMainWindow, Ui_MainWindow, UiMethods, WindowMethods):
    """
    Main application window that combines all UI functionality
    
    Inherits from:
    - QMainWindow: Base PyQt5 window class
    - Ui_MainWindow: UI setup and configuration
    - UiMethods: Methods for Minecraft operations and event handling
    - WindowMethods: Methods for installation and settings windows
    """
    
    def __init__(self, bg_path, bg_color, icon, bg_blur, system_lang, 
                 versions, forge_versions, fabric_versions, fabric_loaders,
                 discord_manager, config_manager, app):
        super().__init__()
        
        self.app = app
        
        # Setup UI
        self.setupUi(
            self, 
            bg_path, 
            bg_color, 
            icon, 
            bg_blur, 
            system_lang,
            versions, 
            forge_versions, 
            fabric_versions, 
            fabric_loaders,
            discord_manager, 
            config_manager
        )
        
        # Center the window on screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = self.width()
        window_height = self.height()
        position_right = int(screen_geometry.width() / 2 - window_width / 2)
        position_down = int(screen_geometry.height() / 2 - window_height / 2)
        self.move(position_right, position_down)
        
        # Ensure console_output is a QTextEdit
        if not isinstance(self.console_output, QTextEdit):
            raise TypeError("console_output must be a QTextEdit")
        
        # Redirect standard output to QTextEdit widget
        sys.stdout = StdoutRedirector(self.console_output)
        
        # Update Discord error display
        self.update_error_discord()
        
        # Create signals object for worker threads
        from PyQt5.QtCore import QObject, pyqtSignal
        
        class Signals(QObject):
            """Signals for communication between threads"""
            finished = pyqtSignal()
            error = pyqtSignal(str)
        
        self.signals = Signals()

        # Initialize configuration manager and load config
        self.config_manager = config_manager
        self.config = self.config_manager.load_config()

        # Add "Get Started" tab if first_time is True
        if self.config.get("first_time", True):
            self.add_get_started_tab()
            self.tab_widget.setCurrentIndex(self.tab_widget.count() - 1)  # Automatically switch to the "Get Started" tab

    def add_get_started_tab(self):
        """Add the 'Get Started' tab with Material Design styling."""
        get_started_tab = QWidget()
        layout = QVBoxLayout(get_started_tab)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Welcome label
        welcome_label = QLabel(lang(self.system_lang, "welcome"))
        welcome_label.setStyleSheet(
            f"font-size: 24px; font-weight: bold; margin-bottom: 16px;"
        )
        welcome_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(welcome_label)

        # Welcome message
        welcome_message = lang(self.system_lang, "welcome_message")
        welcome_message_label = QLabel(welcome_message)
        welcome_message_label.setStyleSheet(
            f"font-size: 16px; line-height: 1.6;"
        )
        welcome_message_label.setAlignment(Qt.AlignLeft)
        welcome_message_label.setWordWrap(True)
        welcome_message_label.setOpenExternalLinks(False)
        welcome_message_label.setTextInteractionFlags(Qt.TextBrowserInteraction)
        layout.addWidget(welcome_message_label)

        welcome_message_label.linkActivated.connect(lambda link: __import__('webbrowser').open(link))

        # Bottom layout
        bottom_layout = QHBoxLayout()
        bottom_layout.setAlignment(Qt.AlignCenter)
        bottom_layout.setSpacing(16)

        # Checkbox
        gs_checkbox = QCheckBox(lang(self.system_lang, "dont_show_again"))
        gs_checkbox.setStyleSheet(
            f"font-size: 14px; padding: 8px;"
        )

        def save_config():
            config_path = f'{self.app_dir}/config/config.json'
            if not os.path.exists(config_path):
                data = {}
            else:
                with open(config_path, 'r') as f:
                    try:
                        data = json.load(f)
                    except json.JSONDecodeError:
                        data = {}
            data["first_time"] = not gs_checkbox.isChecked()
            with open(config_path, 'w') as f:
                json.dump(data, f)
            self.exit_get_started_tab()

        # Close button
        bt_close = AnimatedButton(lang(self.system_lang, "close"), get_started_tab, "primary")
        bt_close.setStyleSheet(
            f"font-size: 16px; padding: 12px 24px; border-radius: 8px;"
        )
        bt_close.clicked.connect(save_config)

        bottom_layout.addWidget(gs_checkbox)
        bottom_layout.addWidget(bt_close)
        layout.addLayout(bottom_layout)

        # Store the reference to the 'Get Started' tab
        self.get_started_tab = get_started_tab

        self.tab_widget.addTab(get_started_tab, lang(self.system_lang, "get_started"))

    def exit_get_started_tab(self):
        """Exit the Get Started tab and switch to the main tab"""
        self.tab_widget.removeTab(self.tab_widget.indexOf(self.get_started_tab))
        self.tab_widget.setCurrentIndex(0)  # Switch to the first tab

    def update_first_time_setting(self):
        """Update the first_time setting based on the checkbox"""
        self.config["first_time"] = not self.no_show_again_checkbox.isChecked()
        self.config_manager.save_config(self.config)
        if not self.config["first_time"]:
            self.tab_widget.removeTab(self.tab_widget.indexOf(self.get_started_tab))

    def isMaximized(self):
        """Check if window is maximized"""
        return bool(self.windowState() & Qt.WindowMaximized)
