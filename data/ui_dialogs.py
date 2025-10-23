"""
UI Dialogs for OpenLauncher
Contains installation dialogs and settings window
"""

import json
import requests
from PyQt5 import QtCore
from PyQt5.QtWidgets import (QPushButton, QVBoxLayout, QLabel, QComboBox, QHBoxLayout, 
                             QCheckBox, QApplication, QDialog, QGraphicsBlurEffect)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QIcon
import variables
from lang import lang
from resource_cache import get_cached_pixmap, get_cached_icon
from material_design import MaterialCard, AnimatedButton, MaterialColors


def create_version_dialog(parent, system_lang, bg_color, bg_path, bg_blur, icon,
                          title, info_text, versions_list, default_version, 
                          install_callback, icon_type="minecraft"):
    """Create a modern Material Design version selection dialog"""
    window = QDialog()
    window.setWindowTitle(title)
    window.setFixedSize(400, 220)
    window.setWindowFlags(window.windowFlags() & ~Qt.WindowContextHelpButtonHint & ~Qt.WindowMaximizeButtonHint)
    window.setWindowIcon(QIcon(icon))
    window.setStyleSheet(f"background-color: {MaterialColors.BACKGROUND};")
    
    # Center window
    screen_geometry = QApplication.primaryScreen().availableGeometry()
    window_width = window.width()
    window_height = window.height()
    position_right = int(screen_geometry.width() / 2 - window_width / 2)
    position_down = int(screen_geometry.height() / 2 - window_height / 2)
    window.move(position_right, position_down)
    
    # Main layout with Material Card
    main_layout = QVBoxLayout(window)
    main_layout.setContentsMargins(20, 20, 20, 20)
    main_layout.setSpacing(16)
    
    # Content card
    card = MaterialCard(window, elevated=True)
    card_layout = QVBoxLayout(card)
    card_layout.setSpacing(16)
    card_layout.setContentsMargins(24, 24, 24, 24)
    
    # Info label with modern styling
    info_label = QLabel(info_text)
    info_label.setProperty("class", "body")
    info_label.setAlignment(Qt.AlignCenter)
    info_label.setWordWrap(True)
    card_layout.addWidget(info_label)
    
    # Modern dropdown
    versions_drop = QComboBox()
    versions_drop.setMinimumHeight(48)
    
    icon_map = {
        "minecraft": variables.minecraft_icon,
        "fabric": variables.fabric_icon,
        "forge": variables.forge_icon
    }
    
    for version in versions_list:
        versions_drop.addItem(get_cached_icon(icon_map.get(icon_type, variables.minecraft_icon)), version)
    
    versions_drop.setCurrentText(default_version)
    versions_drop.setMaxVisibleItems(10)
    card_layout.addWidget(versions_drop)
    
    # Modern install button
    bt_install = AnimatedButton(lang(system_lang, "install"), window, "primary")
    bt_install.setMinimumHeight(48)
    bt_install.clicked.connect(lambda: [window.accept(), install_callback(versions_drop.currentText())])
    card_layout.addWidget(bt_install)
    
    main_layout.addWidget(card)
    return window


def create_fabric_dialog(parent, system_lang, bg_color, bg_path, bg_blur, icon,
                         versions_list, loaders_list, default_version, 
                         install_callback):
    """Create modern Material Design Fabric installation dialog"""
    window = QDialog()
    window.setWindowTitle(f"{lang(system_lang, 'install')} Fabric")
    window.setFixedSize(420, 280)
    window.setWindowFlags(window.windowFlags() & ~Qt.WindowContextHelpButtonHint & ~Qt.WindowMaximizeButtonHint)
    window.setWindowIcon(QIcon(icon))
    window.setStyleSheet(f"background-color: {MaterialColors.BACKGROUND};")
    
    # Center window
    screen_geometry = QApplication.primaryScreen().availableGeometry()
    window_width = window.width()
    window_height = window.height()
    position_right = int(screen_geometry.width() / 2 - window_width / 2)
    position_down = int(screen_geometry.height() / 2 - window_height / 2)
    window.move(position_right, position_down)
    
    # Main layout with Material Card
    main_layout = QVBoxLayout(window)
    main_layout.setContentsMargins(20, 20, 20, 20)
    main_layout.setSpacing(16)
    
    # Content card
    card = MaterialCard(window, elevated=True)
    card_layout = QVBoxLayout(card)
    card_layout.setSpacing(16)
    card_layout.setContentsMargins(24, 24, 24, 24)
    
    # Info label
    info_label = QLabel(lang(system_lang, "info_label_loader"))
    info_label.setProperty("class", "body")
    info_label.setAlignment(Qt.AlignCenter)
    info_label.setWordWrap(True)
    card_layout.addWidget(info_label)
    
    # Version dropdown
    versions_drop = QComboBox()
    versions_drop.setMinimumHeight(48)
    for version in versions_list:
        versions_drop.addItem(get_cached_icon(variables.minecraft_icon), version)
    versions_drop.setCurrentText(default_version)
    versions_drop.setMaxVisibleItems(10)
    card_layout.addWidget(versions_drop)
    
    # Loader label
    loader_label = QLabel(lang(system_lang, "loader_label"))
    loader_label.setProperty("class", "subtitle")
    loader_label.setAlignment(Qt.AlignCenter)
    card_layout.addWidget(loader_label)
    
    # Loader dropdown
    loader_drop = QComboBox()
    loader_drop.setMinimumHeight(48)
    for loader in loaders_list:
        loader_drop.addItem(get_cached_icon(variables.fabric_icon), loader)
    loader_drop.setCurrentText(loaders_list[0])
    loader_drop.setMaxVisibleItems(10)
    card_layout.addWidget(loader_drop)
    
    # Modern install button
    bt_install = AnimatedButton(lang(system_lang, "install"), window, "primary")
    bt_install.setMinimumHeight(48)
    bt_install.clicked.connect(lambda: [window.accept(), install_callback(versions_drop.currentText(), loader_drop.currentText())])
    card_layout.addWidget(bt_install)
    
    main_layout.addWidget(card)
    return window


def create_get_started_dialog(system_lang, bg_color, bg_path, bg_blur, icon, app_dir):
    """Create get started dialog for first time users"""
    window_get_started = QDialog()
    window_get_started.setWindowTitle(lang(system_lang, "get_started"))
    window_get_started.setFixedSize(800, 500)
    window_get_started.setWindowFlags(window_get_started.windowFlags() & ~Qt.WindowContextHelpButtonHint)
    window_get_started.setWindowIcon(QIcon(icon))
    window_get_started.setStyleSheet("background-color: rgb(45, 55, 65);")
    
    # Center window
    screen_geometry = QApplication.primaryScreen().availableGeometry()
    window_width = window_get_started.width()
    window_height = window_get_started.height()
    position_right = int(screen_geometry.width() / 2 - window_width / 2)
    position_down = int(screen_geometry.height() / 2 - window_height / 2)
    window_get_started.move(position_right, position_down)
    
    layout = QVBoxLayout()
    layout.setContentsMargins(20, 20, 20, 20)
    layout.setSpacing(15)
    
    # Background
    bg_label = QLabel(window_get_started)
    bg_label.setPixmap(get_cached_pixmap(bg_path, window_width, window_height, True))
    bg_label.setGeometry(0, 0, window_width, window_height)
    
    blur_effect = QGraphicsBlurEffect()
    blur_effect.setBlurRadius(bg_blur)
    bg_label.setGraphicsEffect(blur_effect)
    
    bg_label_2 = QLabel(window_get_started)
    bg_label_2.setStyleSheet("background-color: rgba(0, 0, 0, 0.4);")
    bg_label_2.setGeometry(0, 0, window_width, window_height)
    
    # Welcome label
    welcome_label = QLabel(lang(system_lang, "welcome"))
    welcome_label.setStyleSheet("color: white; font-size: 16px; background-color: transparent;")
    welcome_label.setAlignment(Qt.AlignCenter)
    layout.addWidget(welcome_label)
    
    # Welcome message
    welcome_message = lang(system_lang, "welcome_message")
    welcome_label = QLabel(welcome_message)
    welcome_label.setStyleSheet("color: white; font-size: 14px; background-color: transparent;")
    welcome_label.setAlignment(Qt.AlignLeft)
    welcome_label.setWordWrap(True)
    welcome_label.setOpenExternalLinks(False)
    welcome_label.setTextInteractionFlags(Qt.TextBrowserInteraction)
    layout.addWidget(welcome_label)
    
    welcome_label.linkActivated.connect(lambda link: __import__('webbrowser').open(link))
    
    # Bottom layout
    bottom_layout = QHBoxLayout()
    bottom_layout.setAlignment(Qt.AlignCenter)
    
    # Checkbox
    gs_checkbox = QCheckBox(lang(system_lang, "dont_show_again"))
    gs_checkbox.setStyleSheet(f"""
        QCheckBox {{
            background-color: transparent;
            color: #ffffff;
        }}
        QCheckBox::indicator {{
            width: 20px;
            height: 20px;
        }}
        QCheckBox::indicator:unchecked {{
            border-radius: 5px;
            border: 2px solid rgba(255, 255, 255, 0.5);
            background-color: rgba({bg_color}, 0.5);
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
    """)
    
    def close_window():
        import os
        config_path = f'{app_dir}/config/config.json'
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
        window_get_started.accept()
    
    # Close button
    bt_close = QPushButton(lang(system_lang, "close"))
    bt_close.setFixedSize(100, 30)
    bt_close.clicked.connect(close_window)
    
    bottom_layout.addWidget(gs_checkbox)
    bottom_layout.addWidget(bt_close)
    layout.addLayout(bottom_layout)
    
    window_get_started.setLayout(layout)
    return window_get_started
