import os, shutil
from tkinter import messagebox
from PyQt5.QtWidgets import QFileDialog, QDialog, QVBoxLayout, QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QPushButton, QGraphicsBlurEffect, QAbstractItemView, QWidget, QListWidget, QSplitter, QTabWidget
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QIcon, QPixmap
import variables
from lang import lang
from material_design import MaterialCard, AnimatedButton, MaterialColors

# Class to manage mods in the launcher (install, activate, deactivate)
class ModManager(QDialog):
    # Constructor
    def __init__(self, icon=f"{variables.icon}", current_lang="en"):
        super().__init__()
        self.icon = icon
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
            base_name = os.path.basename(file_name)
            dest_path = os.path.join(self.mod_directory, base_name)

            # Normalize paths for comparison to avoid SameFileError when paths differ only by separators
            try:
                src_norm = os.path.normcase(os.path.abspath(file_name))
                dst_norm = os.path.normcase(os.path.abspath(dest_path))
            except Exception:
                src_norm = file_name
                dst_norm = dest_path

            # If source and destination are the same file, inform the user and do nothing
            if src_norm == dst_norm:
                try:
                    messagebox.showinfo(lang(self.current_lang, "file_exists"), lang(self.current_lang, "file_exists"))
                except Exception:
                    pass
                return

            # If destination exists (different file), ask before overwriting
            if os.path.exists(dest_path):
                if not messagebox.askyesno(lang(self.current_lang, "file_exists"), lang(self.current_lang, "file_exists")):
                    return
                try:
                    os.remove(dest_path)
                except Exception:
                    pass

            try:
                shutil.copy(file_name, dest_path)
            except shutil.SameFileError:
                # Already handled above, but catch defensively
                return
            except Exception as e:
                messagebox.showerror("Error", f"Could not install mod: {e}")
                return

            self.list_mods()
            self.load_mods_to_list()

# Function to show the mod manager dialog
def show_mod_manager(icon=f"{variables.icon}", current_lang="en"):
    mod_manager = ModManager(icon, current_lang)
    mod_manager.exec_()


# Modern Mod Manager Widget for tabs
class ModManagerWidget(QWidget):
    """Mod Manager as a widget for tab integration"""
    
    def __init__(self, current_lang="en"):
        super().__init__()
        self.current_lang = current_lang
        self.init_ui()

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

        # Main layout
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # Header with back button
        header_layout = QHBoxLayout()
        self.back_btn = AnimatedButton("← " + lang(self.current_lang, "back"), self, "text")
        # Use a safe go-back handler that finds the QTabWidget ancestor instead of relying on parent()
        self.back_btn.clicked.connect(self.go_back_to_home)
        header_layout.addWidget(self.back_btn)
        header_layout.addStretch()
        layout.addLayout(header_layout)

        # Title
        self.title_label = QLabel(lang(self.current_lang, 'mod_manager_title'))
        self.title_label.setProperty("class", "title")
        layout.addWidget(self.title_label)

        # Info text
        self.info_label = QLabel(lang(self.current_lang, 'mod_manager_info'))
        self.info_label.setWordWrap(True)
        self.info_label.setStyleSheet(f"color: {MaterialColors.TEXT_SECONDARY}; font-size: 12px;")
        layout.addWidget(self.info_label)

        # Splitter for active/inactive mods
        splitter = QSplitter(Qt.Horizontal)
        
        # Active mods card
        active_card = MaterialCard()
        active_layout = QVBoxLayout(active_card)
        active_layout.setSpacing(12)
        active_layout.setContentsMargins(20, 20, 20, 20)
        
        self.active_title = QLabel(lang(self.current_lang, "active_mods"))
        self.active_title.setProperty("class", "subtitle")
        active_layout.addWidget(self.active_title)
        
        self.active_list = QListWidget()
        self.active_list.setStyleSheet(f"""
            QListWidget {{
                background-color: {MaterialColors.SURFACE};
                border: 1px solid {MaterialColors.BORDER};
                border-radius: 4px;
                color: {MaterialColors.TEXT_PRIMARY};
                padding: 8px;
            }}
            QListWidget::item {{
                padding: 8px;
                border-bottom: 1px solid {MaterialColors.DIVIDER};
            }}
            QListWidget::item:selected {{
                background-color: {MaterialColors.PRIMARY};
                color: #ffffff;
            }}
        """)
        active_layout.addWidget(self.active_list)
        
        # Active mods buttons
        active_btn_layout = QHBoxLayout()
        self.deactivate_btn = AnimatedButton(lang(self.current_lang, "btn_deactivate"), active_card, "outlined")
        self.deactivate_btn.clicked.connect(self.deactivate_mod)
        active_btn_layout.addWidget(self.deactivate_btn)
        
        active_layout.addLayout(active_btn_layout)
        
        # Inactive mods card
        inactive_card = MaterialCard()
        inactive_layout = QVBoxLayout(inactive_card)
        inactive_layout.setSpacing(12)
        inactive_layout.setContentsMargins(20, 20, 20, 20)
        
        self.inactive_title = QLabel(lang(self.current_lang, "inactive_mods"))
        self.inactive_title.setProperty("class", "subtitle")
        inactive_layout.addWidget(self.inactive_title)
        
        self.inactive_list = QListWidget()
        self.inactive_list.setStyleSheet(f"""
            QListWidget {{
                background-color: {MaterialColors.SURFACE};
                border: 1px solid {MaterialColors.BORDER};
                border-radius: 4px;
                color: {MaterialColors.TEXT_PRIMARY};
                padding: 8px;
            }}
            QListWidget::item {{
                padding: 8px;
                border-bottom: 1px solid {MaterialColors.DIVIDER};
            }}
            QListWidget::item:selected {{
                background-color: {MaterialColors.PRIMARY};
                color: #ffffff;
            }}
        """)
        inactive_layout.addWidget(self.inactive_list)
        
        # Inactive mods buttons
        inactive_btn_layout = QHBoxLayout()
        self.activate_btn = AnimatedButton(lang(self.current_lang, "btn_activate"), inactive_card, "outlined")
        self.activate_btn.clicked.connect(self.activate_mod)
        inactive_btn_layout.addWidget(self.activate_btn)
        
        self.install_btn = AnimatedButton(lang(self.current_lang, "btn_install"), inactive_card, "primary")
        self.install_btn.clicked.connect(self.install_mod)
        inactive_btn_layout.addWidget(self.install_btn)
        
        inactive_layout.addLayout(inactive_btn_layout)
        
        # Add cards to splitter
        splitter.addWidget(active_card)
        splitter.addWidget(inactive_card)
        splitter.setSizes([400, 400])
        
        layout.addWidget(splitter)
        
        # Load mods to lists
        self.load_mods_to_list()

    def go_back_to_home(self):
        """Find the nearest QTabWidget ancestor and switch to the first tab (home/game)."""
        parent = self.parent()
        # Walk up the parent chain to find the QTabWidget
        while parent is not None and not isinstance(parent, QTabWidget):
            try:
                parent = parent.parent()
            except Exception:
                parent = None

        if isinstance(parent, QTabWidget):
            try:
                parent.setCurrentIndex(0)
            except Exception:
                pass
        else:
            # Fallback: try to close/hide if used as a dialog
            try:
                self.hide()
            except Exception:
                pass

    def list_mods(self):
        """List all mods in the mods directory"""
        self.active_mods = {}
        self.inactive_mods = {}
        
        if not os.path.exists(self.mod_directory):
            return
            
        for file in os.listdir(self.mod_directory):
            if file.endswith('.jar'):
                self.active_mods[file] = os.path.join(self.mod_directory, file)
            elif file.endswith('.olpkg'):
                self.inactive_mods[file] = os.path.join(self.mod_directory, file)

    def load_mods_to_list(self):
        """Load mods to the list widgets"""
        self.active_list.clear()
        self.inactive_list.clear()
        
        for mod_name in self.active_mods.keys():
            self.active_list.addItem(mod_name)
            
        for mod_name in self.inactive_mods.keys():
            self.inactive_list.addItem(mod_name)

    def activate_mod(self):
        """Activate selected inactive mod"""
        current_item = self.inactive_list.currentItem()
        if not current_item:
            return
            
        mod_name = current_item.text()
        if mod_name in self.inactive_mods:
            old_path = self.inactive_mods[mod_name]
            new_mod_name = mod_name.replace('.olpkg', '.jar')
            new_mod_path = os.path.join(self.mod_directory, new_mod_name)
            
            if os.path.exists(new_mod_path):
                if not messagebox.askyesno(lang(self.current_lang, "file_exists"), lang(self.current_lang, "file_exists")):
                    return
                os.remove(new_mod_path)
                
            os.rename(old_path, new_mod_path)
            self.active_mods[new_mod_name] = new_mod_path
            del self.inactive_mods[mod_name]
        self.load_mods_to_list()

    def deactivate_mod(self):
        """Deactivate selected active mod"""
        current_item = self.active_list.currentItem()
        if not current_item:
            return
            
        mod_name = current_item.text()
        if mod_name in self.active_mods:
            old_path = self.active_mods[mod_name]
            new_mod_name = mod_name.replace('.jar', '.olpkg')
            new_mod_path = os.path.join(self.mod_directory, new_mod_name)
            
            if os.path.exists(new_mod_path):
                if not messagebox.askyesno(lang(self.current_lang, "file_exists"), lang(self.current_lang, "file_exists")):
                    return
                os.remove(new_mod_path)
                
            os.rename(old_path, new_mod_path)
            self.inactive_mods[new_mod_name] = new_mod_path
            del self.active_mods[mod_name]
        self.load_mods_to_list()

    def install_mod(self):
        """Install a new mod"""
        options = QFileDialog.Options()
        file_name, _ = QFileDialog.getOpenFileName(self, lang(self.current_lang, "select_mod"), "", "Mod Files (*.jar);;All Files (*)", options=options)
        if file_name:
            base_name = os.path.basename(file_name)
            dest_path = os.path.join(self.mod_directory, base_name)

            # Normalize paths for comparison to avoid SameFileError when paths differ only by separators
            try:
                src_norm = os.path.normcase(os.path.abspath(file_name))
                dst_norm = os.path.normcase(os.path.abspath(dest_path))
            except Exception:
                src_norm = file_name
                dst_norm = dest_path

            # If source and destination are the same file, inform the user and do nothing
            if src_norm == dst_norm:
                try:
                    messagebox.showinfo(lang(self.current_lang, "same_file_title"), lang(self.current_lang, "same_file"))
                except Exception:
                    pass
                return

            # If destination exists (different file), ask before overwriting
            if os.path.exists(dest_path):
                if not messagebox.askyesno(lang(self.current_lang, "file_exists"), lang(self.current_lang, "file_exists")):
                    return
                try:
                    os.remove(dest_path)
                except Exception:
                    pass

            try:
                shutil.copy(file_name, dest_path)
            except shutil.SameFileError:
                return
            except Exception as e:
                messagebox.showerror("Error", f"Could not install mod: {e}")
                return

            self.list_mods()
            self.load_mods_to_list()
    
    def update_translations(self, new_lang):
        """Update translations when language changes"""
        self.current_lang = new_lang
        
        # Update all stored widget references
        if hasattr(self, 'back_btn'):
            self.back_btn.setText("← " + lang(self.current_lang, "back"))
        
        if hasattr(self, 'title_label'):
            self.title_label.setText(lang(self.current_lang, 'mod_manager_title'))
        
        if hasattr(self, 'info_label'):
            self.info_label.setText(lang(self.current_lang, 'mod_manager_info'))
        
        if hasattr(self, 'active_title'):
            self.active_title.setText(lang(self.current_lang, "active_mods"))
        
        if hasattr(self, 'inactive_title'):
            self.inactive_title.setText(lang(self.current_lang, "inactive_mods"))
        
        if hasattr(self, 'deactivate_btn'):
            self.deactivate_btn.setText(lang(self.current_lang, "btn_deactivate"))
        
        if hasattr(self, 'activate_btn'):
            self.activate_btn.setText(lang(self.current_lang, "btn_activate"))
        
        if hasattr(self, 'install_btn'):
            self.install_btn.setText(lang(self.current_lang, "btn_install"))