"""
Main Window Class for OpenLauncher
Combines all UI components and methods
"""

import sys
from PyQt5.QtWidgets import QMainWindow, QTextEdit
from PyQt5.QtCore import Qt

from workers import StdoutRedirector
from ui_components import Ui_MainWindow
from ui_methods import UiMethods
from ui_windows import WindowMethods


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
        from PyQt5.QtWidgets import QApplication
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
    
    def isMaximized(self):
        """Check if window is maximized"""
        return bool(self.windowState() & Qt.WindowMaximized)
