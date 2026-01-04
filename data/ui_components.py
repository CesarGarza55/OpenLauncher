"""
UI Components for OpenLauncher
Contains main window UI, dialogs, and styling
"""

import os, re, requests
import minecraft_launcher_lib
from PyQt5.QtWidgets import (QVBoxLayout, QWidget, QLineEdit, QLabel,
                             QComboBox, QHBoxLayout, QGridLayout, QSpacerItem,
                             QSizePolicy, QCheckBox, QTextEdit, QMessageBox, QTabWidget,
                             QDialog, QDialogButtonBox, QFormLayout)
from PyQt5.QtCore import QSize, Qt, QCoreApplication, QMetaObject, QTimer
from PyQt5.QtGui import QPainter, QColor, QPixmap
from tkinter import messagebox
import variables
import urllib.request
from variables import write_log
from lang import lang, change_language
from microsoft_auth import LoginThread, AUTH_API_BASE
from version_installer import VersionInstaller
from utils import open_launcher_dir, open_minecraft_dir
from shortcut_utils import create_launch_shortcut, ShortcutCreationError
from resource_cache import get_cached_pixmap, get_cached_icon
from material_design import (MaterialCard, AnimatedButton, MaterialColors)


class Ui_MainWindow(object):
    """Main window UI setup and configuration"""

    def setupUi(self, MainWindow, icon, system_lang, 
                versions, forge_versions, fabric_versions, fabric_loaders,
                discord_manager, config_manager):
        
        # Store references
        self.system_lang = system_lang
        self.icon = icon
        self.discord_manager = discord_manager
        self.config_manager = config_manager
        self.minecraft_directory = variables.minecraft_directory
        self.app_dir = variables.app_directory
        
        # Initialize version installer
        self.version_installer = VersionInstaller(self.minecraft_directory, MainWindow)
        
        # Store version data-
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
        MainWindow.resize(1000, 600)
        MainWindow.setMinimumSize(QSize(1000, 600))
        # Use cached icon with a reasonable size to avoid sending oversized pixmaps to X
        MainWindow.setWindowIcon(get_cached_icon(icon, size=256))
        
        # Prevent the app from being maximized
        
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

        # Account header: avatar + title label (avatar left, text right)
        self.account_header_layout = QHBoxLayout()
        self.account_header_layout.setObjectName("account_header_layout")
        self.account_header_layout.setSpacing(12)
        self.account_header_layout.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)

        # Avatar label (will display user's skin when available)
        self.avatar_label = QLabel(self.game_tab)
        self.avatar_label.setObjectName("avatar_label")
        # Make avatar slightly larger and square; we'll scale pixmaps to this size
        self._avatar_size = 32
        self.avatar_label.setFixedSize(QSize(self._avatar_size, self._avatar_size))
        self.avatar_label.setAlignment(Qt.AlignCenter)
        # Make it appear rounded via stylesheet (Qt may not perfectly clip the pixmap, but improves visual)
        self.avatar_label.setStyleSheet("border-radius: 32px; background-clip: padding;")
        # Try to set a small default icon safely
        try:
            # Use steve_head as the default/fallback avatar
            default_icon = get_cached_icon(variables.steve_head, size=self._avatar_size)
            # get_cached_icon may return QIcon or QPixmap
            if hasattr(default_icon, 'pixmap'):
                default_pix = default_icon.pixmap(self._avatar_size, self._avatar_size)
            else:
                default_pix = default_icon
            if isinstance(default_pix, QPixmap) and not default_pix.isNull():
                self.avatar_label.setPixmap(default_pix.scaled(self._avatar_size, self._avatar_size, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        except Exception:
            # If anything fails, leave the label empty (hidden)
            pass

        # Title label with modern styling
        self.label = QLabel(self.game_tab)
        self.label.setObjectName("label")
        self.label.setProperty("class", "title")
        # Left-align the text so it sits nicely next to the avatar
        self.label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self.label.setWordWrap(True)
        # Allow rich text for nicer formatting when logged in
        try:
            self.label.setTextFormat(Qt.RichText)
        except Exception:
            pass

        # Add avatar and label to header layout
        # Give label expanding policy so it takes remaining space
        # Profile selector (choose active profile)
        self.profile_selector = QComboBox(self.game_tab)
        self.profile_selector.setObjectName("profile_selector")
        self.profile_selector.setMinimumSize(QSize(194, 48))
        self.profile_selector.setMaximumSize(QSize(194, 48))
        self.profile_selector.currentIndexChanged.connect(self.on_profile_changed)

        # Manage profiles button
        self.btn_manage_profiles = AnimatedButton(lang(self.system_lang, "profiles"), self.game_tab, "outlined")
        self.btn_manage_profiles.setObjectName("btn_manage_profiles")
        self.btn_manage_profiles.clicked.connect(self.open_profile_manager)
        self.btn_manage_profiles.setMaximumSize(QSize(194, 48))
        self.btn_manage_profiles.setMinimumSize(QSize(194, 48))

        self.account_header_layout.addWidget(self.avatar_label)
        self.account_header_layout.addWidget(self.label, 1)
        self.verticalLayout_2.addLayout(self.account_header_layout)
        # Horizontal layout for profile selector and manage button
        self.profileLayout = QHBoxLayout()
        self.profileLayout.setObjectName("profileLayout")
        self.profileLayout.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        self.profileLayout.setSpacing(12)
        self.profileLayout.addWidget(self.profile_selector)
        self.profileLayout.addWidget(self.btn_manage_profiles)
        self.verticalLayout_2.addLayout(self.profileLayout)

        # Populate profiles selector from config manager
        try:
            self.load_profiles_selector()
        except Exception:
            pass
        
        # Modern text input
        self.username_input = QLineEdit(self.game_tab)
        self.username_input.setObjectName("lineEdit")
        self.username_input.setMinimumSize(QSize(350, 48))
        self.username_input.setMaximumSize(QSize(400, 48))
        self.username_input.setPlaceholderText(lang(system_lang, "user_placeholder"))
        self.username_input.setAlignment(Qt.AlignCenter)
        self.username_input.setFocusPolicy(Qt.ClickFocus)
        self.username_input.textChanged.connect(self.on_username_changed)
        self.verticalLayout_2.addWidget(self.username_input)

        # Modern animated account button
        self.btn_account = AnimatedButton("", self.game_tab, "primary")
        self.btn_account.setObjectName("btn_account")
        self.btn_account.setMinimumSize(QSize(350, 48))
        self.btn_account.setMaximumSize(QSize(400, 48))

        if not variables.get_auth_headers():
            self.btn_account.clicked.connect(self.message_login_not_supported)

        self.verticalLayout_2.addWidget(self.btn_account)

        self.horizontalLayout.addLayout(self.verticalLayout_2)
        
        # Spacer between columns
        self.horizontalSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)
        self.horizontalLayout.addItem(self.horizontalSpacer)

        # Right column - Installation buttons
        self.verticalLayout = QVBoxLayout()
        self.verticalLayout.setObjectName("verticalLayout")
        self.verticalLayout.setSpacing(6)
        
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

        self.btn_mod_manager = AnimatedButton("", self.game_tab, "outlined")
        self.btn_mod_manager.setObjectName("btn_mod_manager")
        self.btn_mod_manager.setMinimumSize(QSize(350, 48))
        self.btn_mod_manager.setMaximumSize(QSize(400, 48))
        self.verticalLayout.addWidget(self.btn_mod_manager)

        # Settings button - outlined style
        self.btn_settings_nav = AnimatedButton("", self.game_tab, "outlined")
        self.btn_settings_nav.setObjectName("btn_settings_nav")
        self.btn_settings_nav.setMinimumSize(QSize(350, 48))
        self.btn_settings_nav.setMaximumSize(QSize(400, 48))
        self.btn_settings_nav.clicked.connect(self.open_settings_tab)
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
        
        # Authentication tab
        self.auth_tab = self.create_auth_tab()
        self.tab_widget.addTab(self.auth_tab, lang(self.system_lang, "authentication"))
        
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

    def message_login_not_supported(self):
        """Show message that login is not supported"""
        QMessageBox.information(
            self.centralwidget,
            lang(self.system_lang, "login_not_supported_title"),
            lang(self.system_lang, "login_not_supported_message")
        )

    def on_username_changed(self, text):
        """Detect changes in the username input"""
        # Delete the blank spaces
        text = text.strip()
        if text == "" and not self.access_token:
            self.btn_play.setDisabled(True)
        else:
            self.btn_play.setDisabled(False)
    
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

        self.snapshots_checkbox = QCheckBox(lang(self.system_lang, "checkbox_snapshots"))
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

        self.btn_create_shortcut = AnimatedButton(lang(self.system_lang, "create_shortcut"), settings_widget, "outlined")
        self.btn_create_shortcut.setMinimumHeight(40)
        self.btn_create_shortcut.clicked.connect(self.open_shortcut_dialog)
        links_hlayout.addWidget(self.btn_create_shortcut)
        
        links_layout.addLayout(links_hlayout)
        
        settings_layout.addWidget(links_card)
        
        # Spacer at bottom
        settings_layout.addStretch()
        
        # Save button
        self.save_btn = AnimatedButton(lang(self.system_lang, "save"), settings_widget, "outlined")
        self.save_btn.setMinimumHeight(48)
        self.save_btn.clicked.connect(self.save_settings)
        settings_layout.addWidget(self.save_btn)
        
        # Adjust margins and spacing for better fit in smaller windows
        settings_layout.setSpacing(10)
        settings_layout.setContentsMargins(10, 10, 10, 10)

        # Reduce margins in cards
        jvm_layout.setContentsMargins(10, 10, 10, 10)
        lang_layout.setContentsMargins(10, 10, 10, 10)
        options_layout.setContentsMargins(10, 10, 10, 10)
        links_layout.setContentsMargins(10, 10, 10, 10)

        # Ensure widgets adapt to smaller sizes
        self.entry_jvm_arguments.setMinimumHeight(30)
        self.lang_combobox.setMinimumHeight(30)
        self.btn_launcher_dir.setMinimumHeight(30)
        self.btn_minecraft_dir.setMinimumHeight(30)
        self.save_btn.setMinimumHeight(40)
        
        return settings_widget

    def open_shortcut_dialog(self):
        """Open a dialog that creates a desktop shortcut for direct launches."""
        dialog = QDialog(self.centralwidget)
        dialog.setWindowTitle(lang(self.system_lang, "shortcut_dialog_title"))
        dialog.setModal(True)
        layout = QVBoxLayout(dialog)
        form = QFormLayout()
        dialog.resize(500, 300)
        profile_combo = QComboBox(dialog)
        profiles = {"profiles": {}}
        active_profile = None
        try:
            profiles = self.config_manager.load_profiles()
            if hasattr(self.config_manager, 'get_active_profile_key'):
                active_profile = self.config_manager.get_active_profile_key()
        except Exception:
            profiles = {"profiles": {}}

        for key, profile in profiles.get('profiles', {}).items():
            display = profile.get('display_name', key)
            profile_combo.addItem(display, key)
            if active_profile and key == active_profile:
                profile_combo.setCurrentIndex(profile_combo.count() - 1)

        if profile_combo.count() == 0:
            QMessageBox.warning(
                self.centralwidget,
                lang(self.system_lang, "shortcut_error_title"),
                lang(self.system_lang, "profile_not_selected"),
            )
            return

        version_combo = QComboBox(dialog)
        for idx in range(self.comboBox.count()):
            version_combo.addItem(self.comboBox.itemText(idx))
        if version_combo.count() == 0:
            QMessageBox.warning(
                self.centralwidget,
                lang(self.system_lang, "shortcut_error_title"),
                lang(self.system_lang, "no_versions_installed"),
            )
            return
        current_idx = self.comboBox.currentIndex()
        if current_idx >= 0:
            version_combo.setCurrentIndex(current_idx)

        shortcut_name_input = QLineEdit(dialog)
        shortcut_name_input.setText(f"{profile_combo.currentText()} - {version_combo.currentText()}")

        online_checkbox = QCheckBox(lang(self.system_lang, "shortcut_online_label"), dialog)
        offline_username_input = QLineEdit(dialog)
        offline_username_input.setPlaceholderText(lang(self.system_lang, "shortcut_offline_label"))

        def update_username_state():
            offline_username_input.setDisabled(online_checkbox.isChecked())

        online_checkbox.toggled.connect(update_username_state)

        def sync_online_state():
            """Auto-toggle the online flag based on profile type and login state."""
            profile_key = profile_combo.currentData()
            profile_data = {}
            if profile_key:
                profile_data = profiles.get('profiles', {}).get(profile_key, {})
            profile_type = profile_data.get('type', 'local') if isinstance(profile_data, dict) else 'local'
            is_local_profile = profile_type == 'local'
            is_logged_in = bool(getattr(self, 'access_token', ''))
            target_checked = bool(is_logged_in and not is_local_profile)
            previous_state = online_checkbox.blockSignals(True)
            online_checkbox.setChecked(target_checked)
            online_checkbox.blockSignals(previous_state)
            update_username_state()

        profile_combo.currentIndexChanged.connect(lambda _: sync_online_state())
        sync_online_state()

        form.addRow(lang(self.system_lang, "shortcut_profile_label"), profile_combo)
        form.addRow(lang(self.system_lang, "shortcut_version_label"), version_combo)
        form.addRow(lang(self.system_lang, "shortcut_name_label"), shortcut_name_input)
        form.addRow("", online_checkbox)
        form.addRow(lang(self.system_lang, "shortcut_offline_label"), offline_username_input)
        layout.addLayout(form)

        buttons = QDialogButtonBox(QDialogButtonBox.Cancel | QDialogButtonBox.Ok, dialog)
        layout.addWidget(buttons)

        def accept_dialog():
            profile_key = profile_combo.currentData()
            mc_version = version_combo.currentText().strip()
            shortcut_name = shortcut_name_input.text().strip() or f"{profile_combo.currentText()} - {mc_version}"
            use_online = online_checkbox.isChecked()
            offline_username = offline_username_input.text().strip() or None
            if not mc_version:
                QMessageBox.warning(self.centralwidget, lang(self.system_lang, "shortcut_error_title"), lang(self.system_lang, "no_version"))
                return
            if not use_online and not offline_username:
                QMessageBox.warning(
                    self.centralwidget,
                    lang(self.system_lang, "shortcut_error_title"),
                    lang(self.system_lang, "shortcut_offline_username_required"),
                )
                return
            try:
                shortcut_path = create_launch_shortcut(
                    profile_key,
                    mc_version,
                    shortcut_name,
                    use_online=use_online,
                    offline_username=offline_username,
                )
            except ShortcutCreationError as exc:
                QMessageBox.warning(self.centralwidget, lang(self.system_lang, "shortcut_error_title"), str(exc))
                return
            QMessageBox.information(
                self.centralwidget,
                lang(self.system_lang, "shortcut_created_title"),
                lang(self.system_lang, "shortcut_created_message").format(path=shortcut_path),
            )
            dialog.accept()

        buttons.accepted.connect(accept_dialog)
        buttons.rejected.connect(dialog.reject)
        dialog.exec_()

    # --- Profile UI helpers ---
    def load_profiles_selector(self):
        """Populate the profile selector combobox from config manager."""
        try:
            profiles_obj = self.config_manager.load_profiles()
        except Exception:
            profiles_obj = {"active": "default", "profiles": {}}
        self.profile_selector.blockSignals(True)
        self.profile_selector.clear()
        for key, p in profiles_obj.get('profiles', {}).items():
            display = p.get('display_name', key)
            self.profile_selector.addItem(display, key)
        # set active
        active = profiles_obj.get('active')
        if active:
            idx = self.profile_selector.findData(active)
            if idx >= 0:
                self.profile_selector.setCurrentIndex(idx)
        self.profile_selector.blockSignals(False)

    def on_profile_changed(self, index):
        key = self.profile_selector.itemData(index)
        if not key:
            return
        try:
            # Persist active in config
            self.config_manager.set_active_profile(key)
        except Exception:
            pass
        # Apply profile into UI/state
        try:
            self.apply_profile(key)
        except Exception:
            pass

    def apply_profile(self, key):
        """Load profile data into UI state and attempt to refresh MS token if present."""
        profile = self.config_manager.get_profile(key)
        if not profile:
            return
        # Apply simple fields
        self.user_name = profile.get('account_name', '') or ''
        self.user_uuid = profile.get('user_uuid', '') or ''
        self.jvm_arguments = profile.get('jvm_arguments', variables.defaultJVM if hasattr(variables, 'defaultJVM') else '')
        # Set last selected version in UI if present
        last_version = profile.get('last_version', '')
        if last_version and hasattr(self, 'comboBox'):
            try:
                idx = self.comboBox.findText(last_version, Qt.MatchFixedString)
                if idx >= 0:
                    self.comboBox.setCurrentIndex(idx)
            except Exception:
                pass

        # Try to refresh Microsoft token for this profile
        try:
            refresh_token = variables.load_refresh_token_for(key)
            if refresh_token:
                try:
                    # Get client ID from api endpoint /get-client-id
                    client_id = requests.get(
                        f"{AUTH_API_BASE}/get-client-id",
                        timeout=15,
                        headers=variables.get_auth_headers()
                    )
                    client_id.raise_for_status()
                    client_id = client_id.json().get('client_id', None)
                    if not client_id:
                        raise Exception("Invalid client ID response")
                    profile_resp = minecraft_launcher_lib.microsoft_account.complete_refresh(
                        client_id,
                        None,
                        "http://localhost:8080/callback",
                        refresh_token
                    )
                    if profile_resp and 'id' in profile_resp:
                        self.access_token = profile_resp.get('access_token', '')
                        self.user_name = profile_resp.get('name', self.user_name)
                        self.user_uuid = profile_resp.get('id', self.user_uuid)
                except Exception:
                    # token invalid or network error — leave as local
                    self.access_token = ''
        except Exception:
            pass

        # Update visible UI
        self.update_account_display()

    def open_profile_manager(self):
        """Open a simple profile manager dialog (create/delete)."""
        from PyQt5.QtWidgets import (QDialog, QVBoxLayout, QListWidget, QHBoxLayout, QLineEdit,
                 QPushButton, QLabel, QFormLayout, QComboBox, QWidget,
                 QListWidgetItem, QSlider, QCheckBox, QSpinBox)

        dlg = QDialog(self.centralwidget)
        dlg.setWindowTitle(lang(self.system_lang, "profiles_manager") if hasattr(lang, '__call__') else "Manage Profiles")
        dlg.setMinimumSize(800, 400)
        dlg.setMaximumSize(800, 400)
        dlg.setWindowFlags(dlg.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        main_layout = QHBoxLayout(dlg)

        # Left: list of profiles
        left_widget = QWidget(dlg)
        left_layout = QVBoxLayout(left_widget)
        listw = QListWidget(left_widget)
        listw.setStyleSheet(f"""
            QListWidget {{
                background-color: {MaterialColors.SURFACE};
                color: {MaterialColors.TEXT_PRIMARY};
            }}
        """)
        left_layout.addWidget(QLabel(lang(self.system_lang, "profiles") if hasattr(lang, '__call__') else "Profiles"))
        left_layout.addWidget(listw)

        # New profile creation
        new_h = QHBoxLayout()
        name_input = QLineEdit(dlg)
        name_input.setPlaceholderText(lang(self.system_lang, "new_profile_name") if hasattr(lang, '__call__') else "New profile key")
        add_btn = QPushButton(lang(self.system_lang, "create") if hasattr(lang, '__call__') else "Create", dlg)
        new_h.addWidget(name_input)
        new_h.addWidget(add_btn)
        left_layout.addLayout(new_h)

        main_layout.addWidget(left_widget, 1)

        # Right: profile editor
        right_widget = QWidget(dlg)
        right_layout = QVBoxLayout(right_widget)
        form = QFormLayout()
        display_input = QLineEdit(right_widget)
        type_combo = QComboBox(right_widget)
        type_combo.addItem(lang(self.system_lang, "profile_type_local"), 'local')
        type_combo.addItem(lang(self.system_lang, "profile_type_online"), 'online')
        type_combo.setEnabled(False)  # Disable manual selection
        form.addRow(QLabel(lang(self.system_lang, "profile_display_name") if hasattr(lang, '__call__') else "Display name"), display_input)
        form.addRow(QLabel(lang(self.system_lang, "profile_type") if hasattr(lang, '__call__') else "Type"), type_combo)
        right_layout.addLayout(form)

        # Version selector for this profile
        version_combo = QComboBox(right_widget)
        version_combo.setMinimumHeight(30)
        try:
            # populate with installed versions only (most recent first)
            installed = minecraft_launcher_lib.utils.get_installed_versions(self.minecraft_directory)
            installed_list = [v.get('id') for v in installed] if installed else []
            installed_list = installed_list[::-1]
            if installed_list:
                for v in installed_list:
                    version_combo.addItem(v)
            else:
                # show a placeholder when no installed versions
                version_combo.addItem(lang(self.system_lang, "no_versions_installed"))
        except Exception:
            # fallback to main comboBox items if available
            try:
                if hasattr(self, 'comboBox'):
                    for i in range(self.comboBox.count()):
                        version_combo.addItem(self.comboBox.itemText(i))
            except Exception:
                version_combo.addItem(lang(self.system_lang, "no_versions_installed"))
        form.addRow(QLabel(lang(self.system_lang, "profile_version") if hasattr(lang, '__call__') else "Version"), version_combo)

        def get_total_system_ram_mb():
            """Get total system RAM in MB."""
            try:
                import psutil
                return int(psutil.virtual_memory().total / (1024 * 1024))
            except Exception:
                # Fallback to 16384 MB if psutil is not available
                return 16384

        # JVM quick/custom editor: checkbox to choose quick mode, slider for RAM and manual JVM input
        quick_jvm_checkbox = QCheckBox(lang(self.system_lang, "quick_jvm") if hasattr(lang, '__call__') else "Quick RAM (Xmx)", right_widget)
        quick_ram_slider = QSlider(Qt.Horizontal, right_widget)
        quick_ram_slider.setMinimum(512)
        # Max ram should be the user's total system ram
        quick_ram_slider.setMaximum(get_total_system_ram_mb())
        quick_ram_slider.setSingleStep(256)
        quick_ram_slider.setValue(2048)
        quick_ram_slider.setMinimumHeight(20)
        # small numeric input to the right of the slider for precise MB entry
        quick_ram_input = QSpinBox(right_widget)
        quick_ram_input.setMinimum(512)
        quick_ram_input.setMaximum(get_total_system_ram_mb())
        quick_ram_input.setSingleStep(256)
        quick_ram_input.setValue(2048)
        quick_ram_input.setMinimumWidth(80)
        # keep slider and input in sync
        try:
            quick_ram_slider.valueChanged.connect(quick_ram_input.setValue)
            quick_ram_input.valueChanged.connect(quick_ram_slider.setValue)
        except Exception:
            pass
        # unit selector (MB/GB)
        unit_selector = QComboBox(right_widget)
        unit_selector.addItem('MB')
        unit_selector.addItem('GB')
        unit_selector.setCurrentText('MB')

        # update slider/spin range depending on unit
        def _apply_unit_ranges(unit):
            if unit == 'GB':
                # set GB max based on system RAM
                try:
                    gb_max = max(1, get_total_system_ram_mb() // 1024)
                except Exception:
                    gb_max = 16
                smin, smax, sstep = 1, gb_max, 1
                imin, imax, istep = 1, gb_max, 1
            else:  # MB
                total_mb = get_total_system_ram_mb()
                smin, smax, sstep = 512, total_mb, 256
                imin, imax, istep = 512, total_mb, 256
            try:
                quick_ram_slider.blockSignals(True)
                quick_ram_input.blockSignals(True)
                quick_ram_slider.setMinimum(smin)
                quick_ram_slider.setMaximum(smax)
                quick_ram_slider.setSingleStep(sstep)
                quick_ram_input.setMinimum(imin)
                quick_ram_input.setMaximum(imax)
                quick_ram_input.setSingleStep(istep)
            finally:
                try:
                    quick_ram_slider.blockSignals(False)
                    quick_ram_input.blockSignals(False)
                except Exception:
                    pass

        def _on_unit_changed(text):
            try:
                if text == 'GB':
                    # MB -> GB
                    mb = quick_ram_input.value()
                    gb = max(1, mb // 1024)
                    _apply_unit_ranges('GB')
                    quick_ram_input.setValue(gb)
                    quick_ram_slider.setValue(gb)
                else:
                    # GB -> MB
                    gb = quick_ram_input.value()
                    mb = max(512, gb * 1024)
                    _apply_unit_ranges('MB')
                    quick_ram_input.setValue(mb)
                    quick_ram_slider.setValue(mb)
            except Exception:
                pass

        unit_selector.currentTextChanged.connect(_on_unit_changed)
        manual_jvm = QLineEdit(right_widget)
        manual_jvm.setPlaceholderText(lang(self.system_lang, "manual_jvm_placeholder") if hasattr(lang, '__call__') else "Custom JVM args (-Xms512M -Xmx2048M ...)")
        manual_jvm.setMinimumHeight(30)
        # toggle behaviors
        def _toggle_jvm(checked):
            quick_ram_slider.setEnabled(checked)
            quick_ram_input.setEnabled(checked)
            manual_jvm.setEnabled(not checked)
        quick_jvm_checkbox.toggled.connect(_toggle_jvm)
        quick_jvm_checkbox.setChecked(True)
        _toggle_jvm(True)
        form.addRow(quick_jvm_checkbox)
        # place slider and numeric input side-by-side
        ram_h = QHBoxLayout()
        ram_h.addWidget(quick_ram_slider, 1)
        ram_h.addWidget(quick_ram_input)
        ram_h.addWidget(unit_selector)
        ram_widget = QWidget(right_widget)
        ram_widget.setLayout(ram_h)
        form.addRow(QLabel(lang(self.system_lang, "quick_ram") if hasattr(lang, '__call__') else "RAM (MB)"), ram_widget)
        form.addRow(QLabel(lang(self.system_lang, "custom_jvm") if hasattr(lang, '__call__') else "Custom JVM args"), manual_jvm)

        # Token manager: show token status and allow test / revoke
        token_label = QLabel(lang(self.system_lang, "token_unknown") if hasattr(lang, '__call__') else "Token: unknown", right_widget)
        test_token_btn = QPushButton(lang(self.system_lang, "test_token") if hasattr(lang, '__call__') else "Test token", right_widget)
        token_h = QHBoxLayout()
        token_h.addWidget(token_label)
        token_h.addWidget(test_token_btn)
        right_layout.addLayout(token_h)

        btn_h = QHBoxLayout()
        save_btn = QPushButton(lang(self.system_lang, "save") if hasattr(lang, '__call__') else "Save", dlg)
        del_btn = QPushButton(lang(self.system_lang, "delete") if hasattr(lang, '__call__') else "Delete", dlg)
        btn_h.addWidget(save_btn)
        btn_h.addWidget(del_btn)
        right_layout.addLayout(btn_h)

        main_layout.addWidget(right_widget, 2)

        # Populate list: store profile key in item data (UserRole) and show display name
        profiles_obj = self.config_manager.load_profiles()
        for key, p in profiles_obj.get('profiles', {}).items():
            display = p.get('display_name', key) if p.get('display_name', None) else key
            item = QListWidgetItem(display)
            # keep the canonical profile key in UserRole so we can rename safely
            item.setData(Qt.UserRole, key)
            listw.addItem(item)

        def refresh_list():
            listw.clear()
            pobj = self.config_manager.load_profiles()
            for k, p in pobj.get('profiles', {}).items():
                display = p.get('display_name', k) if p.get('display_name', None) else k
                it = QListWidgetItem(display)
                it.setData(Qt.UserRole, k)
                listw.addItem(it)
            self.load_profiles_selector()

        def select_list_item(key):
            """Select the item in `listw` whose UserRole data matches `key`."""
            if not key:
                return
            for i in range(listw.count()):
                it = listw.item(i)
                try:
                    if it.data(Qt.UserRole) == key:
                        listw.setCurrentItem(it)
                        return
                except Exception:
                    # fallback: match text
                    if it.text() == key:
                        listw.setCurrentItem(it)
                        return

        def on_add():
            # Use the provided name as both the profile key and display name
            key = name_input.text().strip()
            if not key:
                return
            try:
                profiles = self.config_manager.load_profiles()
                if key in profiles.get('profiles', {}):
                    QMessageBox.warning(self.centralwidget, lang(self.system_lang, "error_occurred"), lang(self.system_lang, "profile_exists") if hasattr(lang, '__call__') else "Profile already exists")
                    return
                # create profile with minimal defaults
                self.config_manager.create_profile(key, display_name=key, profile_type='local')
                name_input.clear()
                refresh_list()
                # select the newly created profile
                select_list_item(key)
            except Exception as e:
                QMessageBox.warning(self.centralwidget, lang(self.system_lang, "error_occurred") + str(e), str(e))

        def on_select():
            sel = listw.currentItem()
            # retrieve stored key from the item data
            k = None
            if sel:
                try:
                    k = sel.data(Qt.UserRole)
                except Exception:
                    k = sel.text()
            if not k:
                display_input.setText("")
                type_combo.setCurrentIndex(0)
                # clear extra fields
                try:
                    version_combo.setCurrentIndex(0)
                except Exception:
                    pass
                manual_jvm.setText("")
                quick_ram_slider.setValue(2048)
                quick_jvm_checkbox.setChecked(True)
                return
            p = self.config_manager.get_profile(k)
            if not p:
                return
            # display name is the canonical profile name
            display_input.setText(p.get('display_name', k) or k)
            t = p.get('type', 'local')
            idx = type_combo.findData(t)
            if idx >= 0:
                type_combo.setCurrentIndex(idx)
            # store selected key on widget
            right_widget._selected_key = k
            # populate version selector
            try:
                last_v = p.get('last_version', '')
                if last_v:
                    vidx = version_combo.findText(last_v, Qt.MatchFixedString)
                    if vidx >= 0:
                        version_combo.setCurrentIndex(vidx)
                    else:
                        # if not found, leave blank
                        pass
            except Exception:
                pass
            # populate JVM fields
            try:
                jargs = p.get('jvm_arguments', []) or []
                # normalize stored jvm_arguments: some saved values may be a string
                if isinstance(jargs, str):
                    jargs = jargs.split()
                # prefer quick mode if there's only an -Xmx flag and nothing else
                quick_val = None
                for arg in jargs:
                    if arg.startswith('-Xmx') and arg[4:-1].isdigit() and arg.endswith('M'):
                        quick_val = int(arg[4:-1])
                if quick_val:
                    quick_jvm_checkbox.setChecked(True)
                    # if value is divisible by 1024 and reasonably large, prefer GB
                    try:
                        if quick_val >= 1024 and quick_val % 1024 == 0:
                            unit_selector.blockSignals(True)
                            _apply_unit_ranges('GB')
                            unit_selector.setCurrentText('GB')
                            quick_ram_input.setValue(quick_val // 1024)
                            quick_ram_slider.setValue(quick_val // 1024)
                            unit_selector.blockSignals(False)
                        else:
                            unit_selector.blockSignals(True)
                            _apply_unit_ranges('MB')
                            unit_selector.setCurrentText('MB')
                            # ensure values fit current ranges
                            try:
                                max_mb = get_total_system_ram_mb()
                                if quick_val > max_mb:
                                    quick_val = max_mb
                            except Exception:
                                pass
                            quick_ram_input.setValue(quick_val)
                            quick_ram_slider.setValue(quick_val)
                            unit_selector.blockSignals(False)
                    except Exception:
                        # convert safe
                        try:
                            gb_val = quick_val // 1024
                            gb_max = max(1, get_total_system_ram_mb() // 1024)
                            if gb_val > gb_max:
                                gb_val = gb_max
                        except Exception:
                            gb_val = quick_val // 1024
                        quick_ram_input.setValue(gb_val)
                        quick_ram_slider.setValue(gb_val)
                    manual_jvm.setText('')
                else:
                    quick_jvm_checkbox.setChecked(False)
                    manual_jvm.setText(' '.join(jargs))
            except Exception:
                quick_jvm_checkbox.setChecked(True)
                _apply_unit_ranges('MB')
                unit_selector.setCurrentText('MB')
                quick_ram_slider.setValue(2048)
                quick_ram_input.setValue(2048)
                manual_jvm.setText('')
            # token existence
            try:
                token_present = bool(variables.load_refresh_token_for(k))
                token_label.setText(lang(self.system_lang, "token_present") if token_present else lang(self.system_lang, "token_missing"))
            except Exception:
                token_label.setText(lang(self.system_lang, "token_unknown") if hasattr(lang, '__call__') else "Token: unknown")

        def on_save():
            k = getattr(right_widget, '_selected_key', None)
            if not k:
                return
            profiles = self.config_manager.load_profiles()
            if k not in profiles.get('profiles', {}):
                QMessageBox.warning(self.centralwidget, lang(self.system_lang, "error_occurred") + "Profile not found", "Profile not found")
                return
            new_name = display_input.text().strip() or k
            new_type = type_combo.currentData()
            # update per-profile settings
            profiles['profiles'][k]['type'] = new_type
            profiles['profiles'][k]['display_name'] = new_name
            # handle version selection
            try:
                sel_ver = version_combo.currentText()
                if sel_ver:
                    profiles['profiles'][k]['last_version'] = sel_ver
            except Exception:
                pass
            # handle JVM args: quick vs manual
            try:
                if quick_jvm_checkbox.isChecked():
                    ram = quick_ram_input.value()
                    try:
                        if unit_selector.currentText() == 'GB':
                            ram_mb = int(ram) * 1024
                        else:
                            ram_mb = int(ram)
                    except Exception:
                        ram_mb = int(ram)
                    profiles['profiles'][k]['jvm_arguments'] = [f"-Xmx{ram_mb}M"]
                else:
                    manual = manual_jvm.text().strip()
                    profiles['profiles'][k]['jvm_arguments'] = manual.split() if manual else []
            except Exception:
                pass
            # if user changed the profile name (key), rename the profile entry
            if new_name != k:
                if new_name in profiles.get('profiles', {}):
                    QMessageBox.warning(self.centralwidget, lang(self.system_lang, "error_occurred"), lang(self.system_lang, "profile_exists") if hasattr(lang, '__call__') else "Profile already exists")
                    return
                # move entry
                profiles['profiles'][new_name] = profiles['profiles'].pop(k)
                # ensure display_name matches
                profiles['profiles'][new_name]['display_name'] = new_name
                # save and refresh
                self.config_manager.save_profiles(profiles)
                refresh_list()
                # select new item
                idx = self.profile_selector.findData(new_name)
                if idx >= 0:
                    self.profile_selector.setCurrentIndex(idx)
                right_widget._selected_key = new_name
                # update main game tab version selector to saved value only if this profile is active
                try:
                    active = None
                    if hasattr(self.config_manager, 'get_active_profile_key'):
                        active = self.config_manager.get_active_profile_key()
                    if active == new_name:
                        selv = version_combo.currentText()
                        midx = self.comboBox.findText(selv, Qt.MatchFixedString)
                        if midx >= 0:
                            self.comboBox.setCurrentIndex(midx)
                        # also update JVM arguments in main settings if this is active
                        try:
                            saved_jvm = profiles['profiles'][new_name].get('jvm_arguments', variables.defaultJVM)
                            if isinstance(saved_jvm, (list, tuple)):
                                self.jvm_arguments = saved_jvm
                                if hasattr(self, 'entry_jvm_arguments'):
                                    self.entry_jvm_arguments.setText(" ".join(self.jvm_arguments) if self.jvm_arguments else "")
                            else:
                                # string fallback
                                self.jvm_arguments = saved_jvm.split() if saved_jvm else variables.defaultJVM
                                if hasattr(self, 'entry_jvm_arguments'):
                                    self.entry_jvm_arguments.setText(" ".join(self.jvm_arguments) if self.jvm_arguments else "")
                        except Exception:
                            pass
                except Exception:
                    pass
                return

            # normal save when name unchanged
            self.config_manager.save_profiles(profiles)
            refresh_list()
            # keep the saved profile selected in the list
            select_list_item(k)
            # update main game tab version selector to saved value only if this profile is active
            try:
                active = None
                if hasattr(self.config_manager, 'get_active_profile_key'):
                    active = self.config_manager.get_active_profile_key()
                if active == k:
                    selv = version_combo.currentText()
                    idx = self.comboBox.findText(selv, Qt.MatchFixedString)
                    if idx >= 0:
                        self.comboBox.setCurrentIndex(idx)
                    # update JVM arguments in main settings if this profile is active
                    try:
                        saved_jvm = profiles['profiles'][k].get('jvm_arguments', variables.defaultJVM)
                        if isinstance(saved_jvm, (list, tuple)):
                            self.jvm_arguments = saved_jvm
                            if hasattr(self, 'entry_jvm_arguments'):
                                self.entry_jvm_arguments.setText(" ".join(self.jvm_arguments) if self.jvm_arguments else "")
                        else:
                            self.jvm_arguments = saved_jvm.split() if saved_jvm else variables.defaultJVM
                            if hasattr(self, 'entry_jvm_arguments'):
                                self.entry_jvm_arguments.setText(" ".join(self.jvm_arguments) if self.jvm_arguments else "")
                    except Exception:
                        pass
            except Exception:
                pass

        def on_delete():
            k = getattr(right_widget, '_selected_key', None)
            if not k:
                return
            # Prevent deleting the last remaining profile
            try:
                profiles = self.config_manager.load_profiles()
                profile_count = len(profiles.get('profiles', {}))
                if profile_count <= 1:
                    title = lang(self.system_lang, "error_occurred") if hasattr(lang, '__call__') else "Error"
                    message = (lang(self.system_lang, "cannot_delete_last_profile") if hasattr(lang, '__call__')
                               else "No se puede eliminar el único perfil.")
                    QMessageBox.information(self.centralwidget, title, message)
                    return
            except Exception:
                pass

            resp = QMessageBox.question(self.centralwidget, lang(self.system_lang, "ask_confirm") if hasattr(lang, '__call__') else "Confirm",
                                        (lang(self.system_lang, "profile_delete_confirm") if hasattr(lang, '__call__') else "Delete this profile?"),
                                        QMessageBox.Yes | QMessageBox.No)
            if resp == QMessageBox.Yes:
                try:
                    # delete refresh token associated with profile
                    try:
                        variables.delete_refresh_token_for(k)
                    except Exception:
                        pass
                    self.config_manager.delete_profile(k)
                    refresh_list()
                except Exception as e:
                    QMessageBox.warning(self.centralwidget, (lang(self.system_lang, "error_occurred") if hasattr(lang, '__call__') else "Error") + str(e), str(e))

        listw.currentItemChanged.connect(lambda *_: on_select())
        add_btn.clicked.connect(on_add)
        save_btn.clicked.connect(on_save)
        del_btn.clicked.connect(on_delete)

        def on_test_token():
            k = getattr(right_widget, '_selected_key', None)
            if not k:
                QMessageBox.information(self.centralwidget, lang(self.system_lang, "error_occurred"), lang(self.system_lang, "profile_not_selected") if hasattr(lang, '__call__') else "No profile selected")
                return
            try:
                refresh_token = variables.load_refresh_token_for(k)
                if not refresh_token:
                    QMessageBox.information(self.centralwidget, lang(self.system_lang, "token_missing_title") if hasattr(lang, '__call__') else "No token", lang(self.system_lang, "token_missing") if hasattr(lang, '__call__') else "No refresh token for this profile")
                    return
                # attempt a refresh with short timeout
                client_resp = requests.get(f"{AUTH_API_BASE}/get-client-id", timeout=10, headers=variables.get_auth_headers())
                client_resp.raise_for_status()
                client_id = client_resp.json().get('client_id')
                prof = minecraft_launcher_lib.microsoft_account.complete_refresh(client_id, None, "http://localhost:8080/callback", refresh_token)
                if prof and 'id' in prof:
                    QMessageBox.information(self.centralwidget, lang(self.system_lang, "token_test_ok") if hasattr(lang, '__call__') else "Token OK", lang(self.system_lang, "token_test_ok_desc") if hasattr(lang, '__call__') else "Refresh token seems valid")
                    token_label.setText(lang(self.system_lang, "token_present") if hasattr(lang, '__call__') else "Token: present")
                else:
                    QMessageBox.warning(self.centralwidget, lang(self.system_lang, "token_test_failed") if hasattr(lang, '__call__') else "Token failed", lang(self.system_lang, "token_test_failed_desc") if hasattr(lang, '__call__') else "Refresh failed or token invalid")
            except Exception as e:
                QMessageBox.warning(self.centralwidget, lang(self.system_lang, "token_test_failed") if hasattr(lang, '__call__') else "Token failed", str(e))

        test_token_btn.clicked.connect(on_test_token)

        dlg.exec_()

    def open_settings_tab(self):
        """Open the settings tab"""
        self.tab_widget.setCurrentIndex(1)
        # Restore of the method remains unchanged
        if self.jvm_arguments != "" and self.jvm_arguments != variables.defaultJVM:
            self.entry_jvm_arguments.setText(" ".join(self.jvm_arguments))
        self.lang_combobox.setCurrentIndex(self.lang_combobox.findData(self.system_lang))
        self.snapshots_checkbox.setChecked(self.show_snapshots)
        self.discord_checkbox.setChecked(self.discord_manager.enabled)

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
        self.show_snapshots = self.snapshots_checkbox.isChecked()
        
        # Discord RPC
        discord_enabled = self.discord_checkbox.isChecked()
        if discord_enabled != self.discord_manager.enabled:
            if discord_enabled:
                self.discord_manager.connect(self.system_lang)
            else:
                # DiscordManager provides a cleanup method to stop RPC
                self.discord_manager.cleanup()
        
        # Save all data
        self.save_data()
        
        # Update versions list if snapshots changed
        self.update_list_versions()
                
        # Switch back to game tab
        self.tab_widget.setCurrentIndex(0)
    
    def create_mod_manager_tab(self):
        """Create mod manager tab with modern dark styling"""
        from mod_manager import ModManagerWidget
        
        mod_manager_widget = ModManagerWidget(self.system_lang)
        return mod_manager_widget
    
    def create_auth_tab(self):
        """Create authentication tab with modern styling."""
        auth_widget = QWidget()
        auth_layout = QVBoxLayout(auth_widget)
        auth_layout.setSpacing(20)
        auth_layout.setContentsMargins(20, 20, 20, 20)

        # Title label
        self.auth_title = QLabel(lang(self.system_lang, "microsoft_login_title"))
        self.auth_title.setProperty("class", "subtitle")
        self.auth_title.setAlignment(Qt.AlignCenter)
        auth_layout.addWidget(self.auth_title)

        # Description label
        self.auth_description = QLabel(lang(self.system_lang, "microsoft_login_desc"))
        self.auth_description.setWordWrap(True)
        self.auth_description.setAlignment(Qt.AlignCenter)
        auth_layout.addWidget(self.auth_description)

        # Loading spinner (programmatic, no external files)
        class LoadingSpinner(QWidget):
            def __init__(self, parent=None, size=80, line_width=6, color=QColor(0, 170, 255)):
                super().__init__(parent)
                self._angle = 0
                self._timer = QTimer(self)
                self._timer.timeout.connect(self.rotate)
                self._timer.start(16)  # ~60 FPS
                self._size = size
                self._line_width = line_width
                self._color = color
                self.setFixedSize(self._size, self._size)

            def rotate(self):
                self._angle = (self._angle + 6) % 360
                self.update()

            def paintEvent(self, event):
                painter = QPainter(self)
                painter.setRenderHint(QPainter.Antialiasing)
                rect = self.rect().adjusted(self._line_width, self._line_width, -self._line_width, -self._line_width)
                center = rect.center()
                painter.translate(center.x(), center.y())
                painter.rotate(self._angle)
                painter.translate(-center.x(), -center.y())

                pen = painter.pen()
                pen.setWidth(self._line_width)
                for i in range(12):
                    alpha = int(255 * (i + 1) / 12)
                    pen.setColor(QColor(self._color.red(), self._color.green(), self._color.blue(), alpha))
                    painter.setPen(pen)
                    start_angle = (i * 30) * 16
                    span = 20 * 16
                    painter.drawArc(rect.adjusted(self._line_width, self._line_width, -self._line_width, -self._line_width), start_angle, span)

        spinner = LoadingSpinner(self, size=100, line_width=8, color=QColor(0, 170, 255))
        spinner.setObjectName("auth_spinner")
        auth_layout.addWidget(spinner, alignment=Qt.AlignCenter)

        # Cancel button
        self.auth_cancel_btn = AnimatedButton(lang(self.system_lang, "cancel"), auth_widget, "text")
        self.auth_cancel_btn.clicked.connect(lambda: self.tab_widget.setCurrentIndex(self.tab_widget.indexOf(self.game_tab)))
        auth_layout.addWidget(self.auth_cancel_btn)

        # Status label
        self.auth_status = QLabel("")
        self.auth_status.setAlignment(Qt.AlignCenter)
        self.auth_status.setProperty("class", "caption")
        # Allow rich text and make links clickable (open in external browser)
        try:
            self.auth_status.setTextFormat(Qt.RichText)
            self.auth_status.setOpenExternalLinks(True)
        except Exception:
            # Some PyQt builds may not support these methods; ignore if unavailable
            pass
        auth_layout.addWidget(self.auth_status)

        return auth_widget
    
    def start_auth_flow(self):
        """Start the Microsoft authentication flow."""
        self.auth_status.setText(lang(self.system_lang, "microsoft_login_waiting"))

        # Start the login thread
        # use profile-scoped tokens when possible
        profile_key = None
        try:
            if hasattr(self.config_manager, 'get_active_profile_key'):
                profile_key = self.config_manager.get_active_profile_key()
        except Exception:
            profile_key = None
        self.current_profile_key = profile_key
        # default interactive=False (automatic calls should not force browser).
        # The UI (login button) will set self._auth_force_interactive = True before calling this.
        interactive = getattr(self, '_auth_force_interactive', False)
        # reset flag to default after reading
        if hasattr(self, '_auth_force_interactive'):
            try:
                del self._auth_force_interactive
            except Exception:
                pass
        self.login_thread = LoginThread(self, profile_key, force_interactive=interactive)
        self.login_thread.finished.connect(self.on_auth_finished)
        self.login_thread.error.connect(self.on_auth_error)
        self.login_thread.start()

    def on_auth_finished(self, account_info):
        """Handle successful authentication"""
        if account_info:
            self.access_token = account_info.get('access_token', '')
            self.user_uuid = account_info.get('id', '')
            self.user_name = account_info.get('name', '')
            self.auth_status.setText(lang(self.system_lang, "login_success"))
            self.update_account_display()
            # Return to the game tab after successful login
            self.tab_widget.setCurrentIndex(self.tab_widget.indexOf(self.game_tab))
            self.btn_play.setDisabled(False)
            # Save authentication data
            self.save_data()
            
            # Update profile type to online
            try:
                if hasattr(self.config_manager, 'get_active_profile_key'):
                    active = self.config_manager.get_active_profile_key()
                    if active:
                        profiles = self.config_manager.load_profiles()
                        if active in profiles.get('profiles', {}):
                            profiles['profiles'][active]['type'] = 'online'
                            self.config_manager.save_profiles(profiles)
            except Exception as e:
                print(f"Error updating profile type: {e}")
        else:
            self.auth_status.setText(lang(self.system_lang, "login_failed"))

    def on_auth_error(self, error):
        """Handle authentication error"""
        self.auth_status.setText(lang(self.system_lang, "login_error") + f": {error}")
    
    def login_microsoft(self):
        """Handle Microsoft login button click."""
        # Redirect to the authentication tab
        self.tab_widget.setCurrentIndex(self.tab_widget.indexOf(self.auth_tab))

        # Update the status label with localized text
        waiting_text = lang(self.system_lang, "microsoft_login_waiting")
        self.auth_status.setText(waiting_text)

        # Start the authentication flow
        # Ensure interactive login: always open browser for an explicit login action
        self._auth_force_interactive = True
        self.start_auth_flow()

    def update_account_display(self):
        """Update the account button and related UI elements"""
        try:
            self.btn_account.clicked.disconnect()
        except TypeError:
            pass  # No connections to disconnect
        
        if self.access_token and self.user_name:
            # User is logged in
            self.username_input.setVisible(False)
            # Show a nicer two-line welcome: small welcome line + bold username
            try:
                welcome_html = (
                    f"<div style='text-align:left'>"
                    f"<div style='font-size:12px;color:{MaterialColors.TEXT_SECONDARY};'>{lang(self.system_lang, 'welcome')}</div>"
                    f"<div style='font-size:16px;font-weight:600;color:{MaterialColors.TEXT_PRIMARY};'>{self.user_name}</div>"
                    f"</div>"
                )
                self.label.setText(welcome_html)
            except Exception:
                # Fallback to the previous plain text if something goes wrong
                self.label.setText(f"{lang(self.system_lang, 'logged_as')} {self.user_name}")
            self.btn_account.setText(lang(self.system_lang, "logout_microsoft"))
            self.btn_account.setIcon(get_cached_icon(variables.logout_icon, size=24))
            if variables.get_auth_headers():
                self.btn_account.clicked.connect(self.logout_microsoft)
            else:
                self.btn_account.clicked.connect(self.message_login_not_supported)
            # Try to load user's skin/avatar from mc-heads.net
            try:
                # Use a local cache under config/image-cache/{sanitized_username}.png
                avatar_url = f"https://mc-heads.net/avatar/{self.user_name}.png"
                try:
                    cache_dir = os.path.join(variables.config_dir, 'image-cache')
                    os.makedirs(cache_dir, exist_ok=True)
                    # sanitize filename: keep alphanumerics, dash and underscore
                    safe_name = re.sub(r'[^A-Za-z0-9_-]', '_', self.user_name)
                    cached_file = os.path.join(cache_dir, f"{safe_name}.png")

                    pix = None
                    # If cached file exists and looks valid, load from disk
                    if os.path.isfile(cached_file) and os.path.getsize(cached_file) > 0:
                        try:
                            tmp = QPixmap(cached_file)
                            if not tmp.isNull():
                                pix = tmp
                        except Exception:
                            pix = None

                    # Otherwise download from mc-heads and save locally, then load
                    if not pix:
                        try:
                            with urllib.request.urlopen(avatar_url, timeout=6) as resp:
                                data = resp.read()
                            # save file atomically
                            try:
                                with open(cached_file + '.tmp', 'wb') as f:
                                    f.write(data)
                                try:
                                    os.replace(cached_file + '.tmp', cached_file)
                                except Exception:
                                    # fallback to rename
                                    os.remove(cached_file) if os.path.exists(cached_file) else None
                                    os.rename(cached_file + '.tmp', cached_file)
                            except Exception:
                                pass
                            tmp_pix = QPixmap()
                            if tmp_pix.loadFromData(data):
                                pix = tmp_pix
                        except Exception:
                            pix = None

                    # If we have a valid pixmap, show it. Otherwise fallback to steve head.
                    if isinstance(pix, QPixmap) and not pix.isNull():
                        self.avatar_label.setPixmap(pix.scaled(self._avatar_size, self._avatar_size, Qt.KeepAspectRatio, Qt.SmoothTransformation))
                        self.avatar_label.show()
                    else:
                        # Fallback to built-in steve head image
                        try:
                            fallback = get_cached_pixmap(variables.steve_head, size=128)
                        except Exception:
                            fallback = None

                        if isinstance(fallback, QPixmap) and not fallback.isNull():
                            self.avatar_label.setPixmap(fallback.scaled(self._avatar_size, self._avatar_size, Qt.KeepAspectRatio, Qt.SmoothTransformation))
                            self.avatar_label.show()
                        else:
                            # Last resort, try get_cached_icon
                            try:
                                icon_fb = get_cached_icon(variables.steve_head, size=self._avatar_size)
                                if hasattr(icon_fb, 'pixmap'):
                                    pix_fb = icon_fb.pixmap(self._avatar_size, self._avatar_size)
                                else:
                                    pix_fb = icon_fb
                                if isinstance(pix_fb, QPixmap) and not pix_fb.isNull():
                                    self.avatar_label.setPixmap(pix_fb.scaled(self._avatar_size, self._avatar_size, Qt.KeepAspectRatio, Qt.SmoothTransformation))
                                    self.avatar_label.show()
                                else:
                                    self.avatar_label.hide()
                            except Exception:
                                self.avatar_label.hide()
                except Exception:
                    # On any error, don't block the UI; hide avatar
                    try:
                        self.avatar_label.hide()
                    except Exception:
                        pass
            except Exception:
                # On any error, don't block the UI; hide avatar
                try:
                    self.avatar_label.hide()
                except Exception:
                    pass
        else:
            # User is not logged in
            self.username_input.setVisible(True)
            self.label.setText(lang(self.system_lang, "label_username"))
            self.btn_account.setText(lang(self.system_lang, "login_microsoft"))
            self.btn_account.setIcon(get_cached_icon(variables.login_icon, size=24))
            if variables.get_auth_headers():
                self.btn_account.clicked.connect(self.login_microsoft)
            else:
                self.btn_account.clicked.connect(self.message_login_not_supported)
            # Hide avatar when not logged in
            try:
                self.avatar_label.hide()
            except Exception:
                pass
    
    def update_all_translations(self):
        """Update all UI translations after language change"""
        # Update main window title
        self.window().setWindowTitle(f'{lang(self.system_lang, "launcher_name")} — {variables.launcher_version}')
        
        # Update button texts
        self.btn_minecraft.setText(lang(self.system_lang, "btn_install_minecraft"))
        self.btn_fabric.setText(lang(self.system_lang, "btn_install_loader"))
        self.btn_forge.setText(lang(self.system_lang, "btn_install_loader").replace("Fabric", "Forge"))
        self.btn_play.setText(lang(self.system_lang, "btn_play"))
        self.btn_mod_manager.setText(lang(self.system_lang, "btn_mod_manager"))
        self.btn_settings_nav.setText(lang(self.system_lang, "settings"))
        self.btn_manage_profiles.setText(lang(self.system_lang, "profiles"))
        
        # Update account button
        if hasattr(self, 'user_name') and self.user_name:
            # Update label with rich welcome text when translations change
            try:
                welcome_html = (
                    f"<div style='text-align:left'>"
                    f"<div style='font-size:12px;color:{MaterialColors.TEXT_SECONDARY};'>{lang(self.system_lang, 'welcome')}</div>"
                    f"<div style='font-size:16px;font-weight:600;color:{MaterialColors.TEXT_PRIMARY};'>{self.user_name}</div>"
                    f"</div>"
                )
                self.label.setText(welcome_html)
            except Exception:
                self.label.setText(f"{lang(self.system_lang, 'logged_as')} {self.user_name}")
        else:
            self.label.setText(lang(self.system_lang, "label_username"))
            
        if hasattr(self, 'access_token') and self.access_token:
            self.btn_account.setText(lang(self.system_lang, "logout_microsoft"))
        else:
            self.btn_account.setText(lang(self.system_lang, "login_microsoft"))
        
        # Update placeholder
        self.username_input.setPlaceholderText(lang(self.system_lang, "user_placeholder"))
        
        # Update settings tab
        self.update_settings_translations()
        
        # Update mod manager tab
        if hasattr(self, 'mod_manager_tab') and hasattr(self.mod_manager_tab, 'update_translations'):
            self.mod_manager_tab.update_translations(self.system_lang)
        
        # Update translations for authentication tab
        self.auth_title.setText(lang(self.system_lang, "microsoft_login_title"))
        self.auth_description.setText(lang(self.system_lang, "microsoft_login_desc"))
        self.auth_status.setText("")  # Clear status text on language change
    
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
        if hasattr(self, 'snapshots_checkbox'):
            self.snapshots_checkbox.setText(lang(self.system_lang, "checkbox_snapshots"))
        
        if hasattr(self, 'discord_checkbox'):
            self.discord_checkbox.setText(lang(self.system_lang, "discord_rpc"))
        
        # Update buttons
        if hasattr(self, 'btn_launcher_dir'):
            self.btn_launcher_dir.setText(lang(self.system_lang, "open_launcher_directory"))
            
        if hasattr(self, 'btn_minecraft_dir'):
            self.btn_minecraft_dir.setText(lang(self.system_lang, "open_minecraft_directory"))

        if hasattr(self, 'btn_create_shortcut'):
            self.btn_create_shortcut.setText(lang(self.system_lang, "create_shortcut"))
            
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
        self.username_input.setPlaceholderText(lang(self.system_lang, "user_placeholder"))

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
        self.btn_mod_manager.clicked.connect(self.open_mod_manager)
        if variables.get_auth_headers():
            self.btn_account.clicked.connect(self.login_microsoft)
        else:
            self.btn_account.clicked.connect(self.message_login_not_supported)

    def initialize_ui_state(self, MainWindow):
        """Initialize UI state from saved configuration"""
        self.update_list_versions()
        
        # Check for Microsoft account authentication using active profile
        try:
            profiles_obj = self.config_manager.load_profiles()
            active_key = profiles_obj.get('active', 'default')
        except Exception:
            active_key = 'default'

        # Ensure selector matches active profile
        try:
            if hasattr(self, 'profile_selector'):
                idx = self.profile_selector.findData(active_key)
                if idx >= 0:
                    self.profile_selector.setCurrentIndex(idx)
        except Exception:
            pass

        profile = None
        # Try to refresh using profile-scoped refresh token
        try:
            # Get client ID from api endpoint /get-client-id
            client_id = requests.get(
                f"{AUTH_API_BASE}/get-client-id",
                timeout=15,
                headers=variables.get_auth_headers()
            )
            client_id.raise_for_status()
            client_id = client_id.json().get('client_id', None)
            if not client_id:
                raise Exception("Invalid client ID response")
                                     
            refresh_token = variables.load_refresh_token_for(active_key)
            if refresh_token:
                profile = minecraft_launcher_lib.microsoft_account.complete_refresh(
                    client_id,
                    None,
                    "http://localhost:8080/callback",
                    refresh_token
                )
        except Exception:
            profile = None

        if not variables.check_network():
            profile = "No connection"

        if profile == "No connection":
            self.username_input.setVisible(True)
            self.label.setText(lang(self.system_lang, "label_username"))
            self.btn_account.setText(lang(self.system_lang, "no_internet"))
            try:
                self.btn_account.clicked.disconnect()
            except Exception:
                pass
            self.btn_account.setDisabled(True)
        elif profile and 'id' in profile and 'name' in profile:
            # Successfully refreshed
            self.access_token = profile.get('access_token', '')
            self.user_name = profile.get('name', '')
            self.user_uuid = profile.get('id', '')
            self.update_account_display()
        else:
            # No active MS session; apply profile data if available
            try:
                self.apply_profile(active_key)
            except Exception:
                self.update_account_display()
        
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
                self.username_input.setText(self.user_name)
            if last_version:
                index = self.comboBox.findText(last_version, Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
            
            if discord_rpc and not self.discord_manager.is_enabled():
                self.discord_manager.connect(self.system_lang)

        if self.user_name == "" and not self.access_token:
            self.btn_play.setDisabled(True)
        else:
            self.btn_play.setDisabled(False)

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
        self.btn_mod_manager.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_mod_manager"), None))
        self.btn_account.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "login_microsoft"), None))
        self.btn_settings_nav.setText(QCoreApplication.translate("MainWindow", lang(self.system_lang, "settings"), None))
        
        # Update tab names
        self.tab_widget.setTabText(0, QCoreApplication.translate("MainWindow", lang(self.system_lang, "game"), None))
        self.tab_widget.setTabText(1, QCoreApplication.translate("MainWindow", lang(self.system_lang, "settings"), None))
        self.tab_widget.setTabText(2, QCoreApplication.translate("MainWindow", lang(self.system_lang, "btn_mod_manager"), None))
        self.tab_widget.setTabText(3, QCoreApplication.translate("MainWindow", lang(self.system_lang, "authentication"), None))

        # Set icons (using cached icons for better performance)
        self.btn_minecraft.setIcon(get_cached_icon(variables.minecraft_icon))
        self.btn_minecraft.setIconSize(QSize(20, 20))
        self.btn_fabric.setIcon(get_cached_icon(variables.fabric_icon))
        self.btn_fabric.setIconSize(QSize(20, 20))
        self.btn_forge.setIcon(get_cached_icon(variables.forge_icon))
        self.btn_forge.setIconSize(QSize(30, 30))
        self.btn_play.setIcon(get_cached_icon(variables.play_icon))
        self.btn_play.setIconSize(QSize(20, 20))
        self.btn_mod_manager.setIcon(get_cached_icon(variables.mod_icon))
        self.btn_mod_manager.setIconSize(QSize(20, 20))
        self.btn_settings_nav.setIcon(get_cached_icon(variables.settings_icon))
        self.btn_settings_nav.setIconSize(QSize(20, 20))
        self.btn_account.setIcon(get_cached_icon(variables.login_icon))
        self.btn_account.setIconSize(QSize(20, 20))

    def logout_microsoft(self):
        """Handle Microsoft account logout"""
        if not messagebox.askyesno(
            lang(self.system_lang, "ask_logout_title"),
            lang(self.system_lang, "ask_logout_desc")
        ):
            return
        
        try:
            # delete profile-scoped refresh token if available
            try:
                active = self.config_manager.get_active_profile_key() if hasattr(self.config_manager, 'get_active_profile_key') else None
            except Exception:
                active = None
            # Remove both profile-scoped and global refresh tokens to ensure logout is complete.
            # Also attempt to remove any leftover token files for all known profiles.
            try:
                if active:
                    variables.delete_refresh_token_for(active)
                    write_log(f"Deleted refresh token for profile '{active}'", "microsoft_logout")
            except Exception as e:
                write_log(f"Failed deleting profile token for {active}: {e}", "microsoft_logout")

            try:
                variables.delete_refresh_token()
                write_log("Deleted global refresh token", "microsoft_logout")
            except Exception as e:
                write_log(f"Failed deleting global token: {e}", "microsoft_logout")

            # Try to delete tokens for all profiles listed in profiles configuration
            try:
                profiles = self.config_manager.load_profiles()
                for k in profiles.get('profiles', {}).keys():
                    try:
                        variables.delete_refresh_token_for(k)
                        write_log(f"Deleted refresh token for profile '{k}' (cleanup)", "microsoft_logout")
                    except Exception:
                        pass
            except Exception:
                pass

            # Remove any lingering refresh_token files in config_dir
            try:
                cfg_dir = variables.config_dir
                if os.path.isdir(cfg_dir):
                    for fname in os.listdir(cfg_dir):
                        if fname.startswith('refresh_token') and fname.endswith('.json'):
                            fpath = os.path.join(cfg_dir, fname)
                            try:
                                os.remove(fpath)
                                write_log(f"Removed token file {fpath}", "microsoft_logout")
                            except Exception:
                                pass
            except Exception:
                pass
            self.access_token = ""
            self.user_uuid = ""
            self.user_name = ""

            self.config_manager.save_user_uuid("")
            
            # Update profile type to local
            if active:
                try:
                    profiles = self.config_manager.load_profiles()
                    if active in profiles.get('profiles', {}):
                        profiles['profiles'][active]['type'] = 'local'
                        self.config_manager.save_profiles(profiles)
                except Exception:
                    pass
            
            # Update UI
            self.update_account_display()
            self.save_data()
            if self.username_input.text().strip() == "":
                self.btn_play.setDisabled(True)
        except Exception as e:
            write_log(e, "microsoft_logout")
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
