"""
UI Dialogs for OpenLauncher
Contains installation dialogs and settings window
"""

from PyQt5.QtWidgets import (QVBoxLayout, QLabel, QComboBox, QApplication, QDialog)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QIcon
import variables
from lang import lang
from resource_cache import get_cached_icon
from material_design import MaterialCard, AnimatedButton, MaterialColors


def create_version_dialog(system_lang, icon,
                          title, info_text, versions_list, default_version, 
                          install_callback, version_type):
    """Create a modern Material Design version selection dialog"""
    window = QDialog()
    window.setWindowTitle(title)
    window.setFixedSize(400, 220)
    window.setWindowFlags(window.windowFlags() & ~Qt.WindowContextHelpButtonHint & ~Qt.WindowMaximizeButtonHint)
    window.setWindowIcon(QIcon(variables.minecraft_icon))
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
    
    for version in versions_list:
        versions_drop.addItem(get_cached_icon(version_type == "minecraft" and variables.minecraft_icon or variables.forge_icon), version)
    
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


def create_fabric_dialog(system_lang, icon,
                         versions_list, loaders_list, default_version, 
                         install_callback, version_type):
    """Create modern Material Design Fabric installation dialog"""
    window = QDialog()
    window.setWindowTitle(f"{lang(system_lang, 'install')} Fabric")
    window.setFixedSize(420, 280)
    window.setWindowFlags(window.windowFlags() & ~Qt.WindowContextHelpButtonHint & ~Qt.WindowMaximizeButtonHint)
    window.setWindowIcon(QIcon(variables.fabric_icon))
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
        versions_drop.addItem(get_cached_icon(variables.fabric_icon), version)
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