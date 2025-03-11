import os, subprocess, sys, shutil
from tkinter import messagebox
from PyQt5 import QtWidgets, QtCore
from PyQt5.QtWidgets import QFileDialog, QDialog, QVBoxLayout, QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QPushButton, QGraphicsBlurEffect, QAbstractItemView
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QIcon, QBrush, QColor, QPixmap
import variables
from lang import lang

# Class to manage mods in the launcher (install, activate, deactivate)
class ModManager(QDialog):
    # Constructor
    def __init__(self, bg_color=f"{variables.bg_color}", icon=f"{variables.icon}", bg_path=variables.bg_path, bg_blur=variables.bg_blur, current_lang="en"):
        super().__init__()
        self.bg_color = bg_color
        self.icon = icon
        self.bg_path = bg_path
        self.bg_blur = bg_blur
        self.current_lang = current_lang
        self.init_ui()

    # Function to initialize the UI
    def init_ui(self):
        # Gets the Minecraft directory and the mods directory
        self.minecraft_directory = variables.minecraft_directory
        self.mod_directory = os.path.join(self.minecraft_directory, "mods")

        # Creates the mods directory if it doesn't exist
        os.makedirs(self.mod_directory, exist_ok=True)
        
        # List all the mods in the mods directory
        self.active_mods = {}
        self.inactive_mods = {}
        self.list_mods()

        # UI setup
        self.setWindowTitle(lang(self.current_lang,'mod_manager_title'))
        self.setGeometry(100, 100, 850, 500)
        self.setWindowIcon(QIcon(self.icon))
        self.setStyleSheet(f"background-color: rgb({self.bg_color});")

        layout = QVBoxLayout()

        # Background image and blur effect
        if self.bg_path:
            self.background = QLabel(self)
            self.background.setGeometry(0, 0, 850, 500)
            self.background.setPixmap(QPixmap(self.bg_path).scaled(850, 500, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))

            self.blur_effect = QGraphicsBlurEffect()
            self.blur_effect.setBlurRadius(self.bg_blur)
            self.background.setGraphicsEffect(self.blur_effect)
            self.background.lower()

        # Label for the title
        title_label = QLabel(lang(self.current_lang, 'mod_manager_title'))
        title_label.setAlignment(Qt.AlignCenter)
        title_label.setStyleSheet("font-size: 24px; font-weight: bold; color: white; background-color: transparent;")
        layout.addWidget(title_label)

        # Horizontal layout for the lists
        lists_layout = QHBoxLayout()
        
        active_mods_layout = QVBoxLayout()
        inactive_mods_layout = QVBoxLayout()
        
        active_mods_label = QLabel(lang(self.current_lang, "active_mods"))
        inactive_mods_label = QLabel(lang(self.current_lang, "inactive_mods"))
        
        active_mods_label.setStyleSheet("font-size: 18px; font-weight: bold; color: white; background-color: transparent;")
        inactive_mods_label.setStyleSheet("font-size: 18px; font-weight: bold; color: white; background-color: transparent;")

        active_mods_label.setAlignment(Qt.AlignCenter)
        inactive_mods_label.setAlignment(Qt.AlignCenter)

        self.active_mods_list = QListWidget()
        self.inactive_mods_list = QListWidget()

        # Set selection mode to ExtendedSelection
        self.active_mods_list.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.inactive_mods_list.setSelectionMode(QAbstractItemView.ExtendedSelection)
        
        self.load_mods_to_list()

        # Apply styles to the lists
        list_style = """
            QListWidget {
                background-color:""" + f"rgba({self.bg_color}, 0.5);" + """
                color: #ffffff;
                border: 1px solid #ccc;
                border-radius: 5px;
                padding: 5px;
            }
            QListWidget::item {
                padding: 5px;
            }
            QListWidget::item:selected {
                background-color: rgba(255, 255, 255, 0.2);
                color: #ffffff;
            }
        """
        self.active_mods_list.setStyleSheet(list_style)
        self.inactive_mods_list.setStyleSheet(list_style)

        active_mods_layout.addWidget(active_mods_label)
        active_mods_layout.addWidget(self.active_mods_list)
        
        inactive_mods_layout.addWidget(inactive_mods_label)
        inactive_mods_layout.addWidget(self.inactive_mods_list)

        lists_layout.addLayout(active_mods_layout)
        lists_layout.addLayout(inactive_mods_layout)

        layout.addLayout(lists_layout)

        # Buttons layout
        buttons_layout = QHBoxLayout()
        
        activate_button = QPushButton(lang(self.current_lang, "btn_activate"))
        deactivate_button = QPushButton(lang(self.current_lang, "btn_deactivate"))
        install_button = QPushButton(lang(self.current_lang, "btn_install"))
        
        activate_button.clicked.connect(self.activate_mod)
        deactivate_button.clicked.connect(self.deactivate_mod)
        install_button.clicked.connect(self.install_mod)

        buttons_layout.addWidget(activate_button)
        buttons_layout.addWidget(install_button)
        buttons_layout.addWidget(deactivate_button)

        layout.addLayout(buttons_layout)

        self.setLayout(layout)

        # Apply button styles
        self.bt_style = f"""
            QPushButton {{
                background-color: rgba({self.bg_color}, 0.5);
                color: #ffffff; 
                border-radius: 5px;
                height: 50px;
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
        activate_button.setStyleSheet(self.bt_style)
        deactivate_button.setStyleSheet(self.bt_style)
        install_button.setStyleSheet(self.bt_style)

    def list_mods(self):
        for mod in os.listdir(self.mod_directory):
            if mod.endswith('.jar'):
                self.active_mods[mod] = os.path.join(self.mod_directory, mod)
            elif mod.endswith('.olpkg'):
                self.inactive_mods[mod] = os.path.join(self.mod_directory, mod)

    def load_mods_to_list(self):
        self.active_mods_list.clear()
        self.inactive_mods_list.clear()
        
        for mod in self.active_mods:
            item = QListWidgetItem(mod)
            self.active_mods_list.addItem(item)
        
        for mod in self.inactive_mods:
            item = QListWidgetItem(mod)
            self.inactive_mods_list.addItem(item)

    def activate_mod(self):
        selected_items = self.inactive_mods_list.selectedItems()
        for item in selected_items:
            mod_name = item.text()
            mod_path = self.inactive_mods[mod_name]
            new_mod_path = mod_path.replace('.olpkg', '.jar')
            os.rename(mod_path, new_mod_path)
            self.active_mods[mod_name.replace('.olpkg', '.jar')] = new_mod_path
            del self.inactive_mods[mod_name]
        self.load_mods_to_list()

    def deactivate_mod(self):
        selected_items = self.active_mods_list.selectedItems()
        for item in selected_items:
            mod_name = item.text()
            mod_path = self.active_mods[mod_name]
            new_mod_path = mod_path.replace('.jar', '.olpkg')
            os.rename(mod_path, new_mod_path)
            self.inactive_mods[mod_name.replace('.jar', '.olpkg')] = new_mod_path
            del self.active_mods[mod_name]
        self.load_mods_to_list()

    def install_mod(self):
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getOpenFileName(self, lang(self.current_lang, "select_mod"), "", "Mod Files (*.jar);;All Files (*)", options=options)
        if file_name:
            shutil.copy(file_name, self.mod_directory)
            self.list_mods()
            self.load_mods_to_list()

# Function to show the mod manager dialog
def show_mod_manager(bg_color=f"{variables.bg_color}", icon=f"{variables.icon}", bg_path=variables.bg_path, bg_blur=variables.bg_blur, current_lang="en"):
    mod_manager = ModManager(bg_color, icon, bg_path, bg_blur, current_lang)
    mod_manager.exec_()