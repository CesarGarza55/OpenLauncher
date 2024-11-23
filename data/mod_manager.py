import os, subprocess, sys, shutil
from tkinter import messagebox
from PyQt5 import QtWidgets, QtCore
from PyQt5.QtWidgets import QFileDialog, QDialog, QVBoxLayout, QHBoxLayout, QLabel, QListWidget, QListWidgetItem, QPushButton, QGraphicsBlurEffect
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QIcon, QBrush, QColor, QPixmap
import variables
from lang import lang

# Class to manage mods in the launcher (install, activate, deactivate)
class ModManager(QDialog):
    # Constructor
    def __init__(self, bg_color=f"{variables.bg_color}", icon=f"{variables.icon}", version="", bg_path=variables.bg_path, bg_blur=variables.bg_blur, current_lang="en"):
        super().__init__()
        self.bg_color = bg_color
        self.icon = icon
        self.version = version
        self.bg_path = bg_path
        self.bg_blur = bg_blur
        self.current_lang = current_lang
        self.init_ui()

    # Function to initialize the UI
    def init_ui(self):

        if not "forge" in self.version and not "fabric" in self.version and not "quilt" in self.version and not "neoforge" in self.version:
            self.version = "No version installed"

        if self.version == "No version installed":
            self.version_text = "1.21.1"
        else:
            self.version_text = self.version

        # Gets the Minecraft directory and the mods directory
        self.minecraft_directory = variables.minecraft_directory
        self.mod_directory = os.path.join(self.minecraft_directory, "mods")

        # Creates the mods directory if it doesn't exist
        os.makedirs(self.mod_directory, exist_ok=True)
        
        # List all the mods in the mods directory
        self.active_mods = {}
        self.inactive_mods = {}
        for mod in os.listdir(self.mod_directory):
            mod_path = os.path.join(self.mod_directory, mod)
            mod_size = os.path.getsize(mod_path) / (1024 * 1024)  # Size in MB
            mod_text = f"{mod} ({mod_size:.2f} MB)"
            mod_text = mod_text.split('_')[1]
            version = mod.split('_')[0]
            if mod.endswith(".jar"):  # Jar mod
                if version not in self.active_mods:
                    self.active_mods[version] = []
                self.active_mods[version].append(mod_text)
            elif mod.endswith(".olpkg"):  # OpenLauncher Package
                if version not in self.inactive_mods:
                    self.inactive_mods[version] = []
                self.inactive_mods[version].append(mod_text)

        for version in self.active_mods:
            self.active_mods[version].sort()
        for version in self.inactive_mods:
            self.inactive_mods[version].sort()

        self.setWindowTitle(lang(self.current_lang, "btn_mod_manager"))
        self.setWindowIcon(QIcon(self.icon))
        self.setFixedSize(800, 480)
        self.setWindowFlags(Qt.WindowCloseButtonHint)
        self.setStyleSheet("background-color: rgb(45, 55, 65);")

        # Create the main layout
        main_layout = QVBoxLayout(self)

        # Get the window settings
        window_width = self.width()
        window_height = self.height()

         # Create the background label
        bg_label = QLabel(self)
        bg_label.setPixmap(QPixmap(f'{self.bg_path}').scaled(self.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))
        bg_label.setGeometry(0, 0, window_width, window_height)

        # Apply blur effect to the background label
        blur_effect = QGraphicsBlurEffect()
        blur_effect.setBlurRadius(self.bg_blur)
        bg_label.setGraphicsEffect(blur_effect)

        # Create the horizontal layout for the lists
        lists_layout = QHBoxLayout()

        # Create the label of information
        info_label = QLabel(lang(self.current_lang, "mod_manager_info").replace("VERSION_TEXT", self.version_text))
        info_label.setStyleSheet(f"color: white; font-size: 14px; background-color: rgba({self.bg_color}, 0.6); padding: 8px; border-radius: 5px;")
        info_label.setWordWrap(True)

        # Create the label of disabled state
        disabled_label = QLabel(lang(self.current_lang, "mod_manager_disabled"))
        disabled_label.setStyleSheet(f"color: yellow; font-size: 16px; background-color: rgba({self.bg_color}, 0.6); border-radius: 5px;")
        disabled_label.setAlignment(Qt.AlignCenter)
        disabled_label.setWordWrap(True)
        # Create the label for the active mods list
        active_mods_label = QLabel(lang(self.current_lang, "active_mods"))
        active_mods_label.setStyleSheet(f"color: white; font-size: 14px; background-color: rgba({self.bg_color}, 0.6); border-radius: 5px;")
        active_mods_label.setAlignment(Qt.AlignCenter)

        list_style = """
            QListWidget {
                color: white;
                background-color: rgba("""f'{self.bg_color}'""", 0.6);
                border-radius: 5px;
                padding: 5px;
            }
            QListWidget:disabled {
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }
        """
        # Function to handle the item clicked event to only allow selecting items from the same list
        def on_item_clicked(item):
            list_widget = item.listWidget()
            modifiers = QtWidgets.QApplication.keyboardModifiers()
            if not (modifiers & QtCore.Qt.ControlModifier or modifiers & QtCore.Qt.ShiftModifier):
                for i in range(list_widget.count()):
                    if list_widget.item(i) != item:
                        list_widget.item(i).setSelected(False)
            if list_widget == self.active_mods_list:
                self.inactive_mods_list.clearSelection()
            elif list_widget == self.inactive_mods_list:
                self.active_mods_list.clearSelection()

        # Create the list of active mods
        self.active_mods_list = QListWidget()
        self.active_mods_list.setSelectionMode(QtWidgets.QAbstractItemView.ExtendedSelection)
        self.populate_mod_list(self.active_mods_list, self.active_mods)
        self.active_mods_list.setStyleSheet(list_style)
        self.active_mods_list.itemClicked.connect(on_item_clicked)

        # Create the label for the inactive mods list
        inactive_mods_label = QLabel(lang(self.current_lang, "inactive_mods"))
        inactive_mods_label.setStyleSheet(f"color: white; font-size: 14px; background-color: rgba({self.bg_color}, 0.6); border-radius: 5px;")
        inactive_mods_label.setAlignment(Qt.AlignCenter)

        # Create the list of inactive mods
        self.inactive_mods_list = QListWidget()
        self.inactive_mods_list.setSelectionMode(QtWidgets.QAbstractItemView.ExtendedSelection)
        self.populate_mod_list(self.inactive_mods_list, self.inactive_mods)
        self.inactive_mods_list.setStyleSheet(list_style)
        self.inactive_mods_list.itemClicked.connect(on_item_clicked)

        # Add the lists and labels to the horizontal layout
        active_mods_layout = QVBoxLayout()
        active_mods_layout.addWidget(active_mods_label)
        active_mods_layout.addWidget(self.active_mods_list)
        inactive_mods_layout = QVBoxLayout()
        inactive_mods_layout.addWidget(inactive_mods_label)
        inactive_mods_layout.addWidget(self.inactive_mods_list)

        # Add the layouts to the lists layout
        lists_layout.addLayout(active_mods_layout)
        lists_layout.addLayout(inactive_mods_layout)

        # Button style
        bt_style = """
            QPushButton {
                background-color: rgba("""f'{self.bg_color}'""", 0.5);
                color: #ffffff; 
                border-radius: 5px;
                padding: 8px;
                width: 150px;
            }
            QPushButton:hover {
                background-color: rgba("""f'{self.bg_color}'""", 1);
            }
            QPushButton:disabled {
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }
        """

        # Function to move selected mods from active to inactive
        def deactivate_mods():
            selected_mods = self.active_mods_list.selectedItems()
            i = 0
            for mod in selected_mods:
                mod_name = mod.text().split(" (")[0]
                # Find the mod in the files searching for file with name in file
                for file in os.listdir(self.mod_directory):
                    if mod_name in file:
                        old_path = os.path.join(self.mod_directory, file)
                new_path = old_path.replace(".jar", ".olpkg")
                if os.path.exists(old_path):
                    if not os.path.exists(new_path):
                        os.rename(old_path, new_path)
                        self.active_mods_list.takeItem(self.active_mods_list.row(mod))
                        mod_size = os.path.getsize(new_path) / (1024 * 1024) # Size in MB
                        mod_text = f"{mod_name.replace('.jar', '.olpkg')} ({mod_size:.2f} MB)"
                        if self.is_in_list(self.inactive_mods_list, mod_name.replace(f"{self.version}_", "")):
                            self.update_list_item(self.inactive_mods_list, mod_name.replace(f"{self.version}_", ""), mod_text)
                        else:
                            version = mod_name.split('_')[0]
                            if version not in self.inactive_mods:
                                self.inactive_mods[version] = []
                            self.inactive_mods[version].append(mod_text)
                            self.inactive_mods[version].sort()
                            i+=1
                    else:
                        messagebox.showerror("Error", lang(self.current_lang, "mod_already_exists"))
                else:
                    pass
            self.sort_mods()
            self.remove_empty_versions()
            self.populate_mod_list(self.active_mods_list, self.active_mods)
            self.populate_mod_list(self.inactive_mods_list, self.inactive_mods)
            # Restart the window to update the list because idk why it doesn't update correctly, it's a bug but restarting the window fixes it even if it's not the best solution
            if i > 0:
                self.close()
                show_mod_manager(self.bg_color, self.icon, self.version, self.bg_path, self.bg_blur, self.current_lang)

        # Function to move selected mods from inactive to active
        def activate_mods():
            selected_mods = self.inactive_mods_list.selectedItems()
            i = 0
            for mod in selected_mods:
                mod_name = mod.text().split(" (")[0]
                # Find the mod in the files searching for file with name in file
                for file in os.listdir(self.mod_directory):
                    if mod_name in file:
                        old_path = os.path.join(self.mod_directory, file)
                new_path = old_path.replace(".olpkg", ".jar")
                if os.path.exists(old_path):
                    if not os.path.exists(new_path):
                        os.rename(old_path, new_path)
                        self.inactive_mods_list.takeItem(self.inactive_mods_list.row(mod))
                        mod_size = os.path.getsize(new_path) / (1024 * 1024)
                        mod_text = f"{mod_name.replace('.olpkg', '.jar')} ({mod_size:.2f} MB)"
                        if self.is_in_list(self.active_mods_list, mod_name.replace(f"{self.version}_", "")):
                            self.update_list_item(self.active_mods_list, mod_name.replace(f"{self.version}_", ""), mod_text)
                        else:
                            version = mod_name.split('_')[0]
                            if version not in self.active_mods:
                                self.active_mods[version] = []
                            self.active_mods[version].append(mod_text)
                            self.active_mods[version].sort()
                            i+=1
                    else:
                        messagebox.showerror("Error", lang(self.current_lang, "mod_already_exists"))
                else:
                    pass
            self.sort_mods()
            self.remove_empty_versions()
            self.populate_mod_list(self.active_mods_list, self.active_mods)
            self.populate_mod_list(self.inactive_mods_list, self.inactive_mods)
            # Restart the window to update the list because idk why it doesn't update correctly, it's a bug but restarting the window fixes it even if it's not the best solution
            if i > 0:
                self.close()
                show_mod_manager(self.bg_color, self.icon, self.version, self.bg_path, self.bg_blur, self.current_lang)

        # Function to install mods
        def install_mods():
            file_dialog = QFileDialog()
            file_dialog.setFileMode(QFileDialog.ExistingFiles)
            file_dialog.setNameFilter("Mod files (*.jar *.olpkg)")
            if file_dialog.exec_():
                selected_files = file_dialog.selectedFiles()
                for file in selected_files:
                    new_name = f"{self.version}_{os.path.basename(file)}"
                    new_path = os.path.join(self.mod_directory, new_name)
                    mod_size = os.path.getsize(file) / (1024 * 1024)  # Size in MB
                    mod_text = f"{new_name} ({mod_size:.2f} MB)"
                    mod_text = mod_text.replace(f"{self.version}_", "")
                    version = new_name.split('_')[0]

                    if file.endswith(".jar"):
                        if os.path.exists(new_path):
                            if messagebox.askyesno("Warning", lang(self.current_lang, "file_exists")):
                                # Remove the old file from the list
                                self.remove_mod_from_list(self.active_mods_list, new_name)
                                for version, mods in self.active_mods.items():
                                    if new_name.replace(f"{self.version}_", "") in [mod.split(" (")[0] for mod in mods]:
                                        self.active_mods[version] = [mod for mod in mods if mod.split(" (")[0] != new_name.replace(f"{self.version}_", "")]  # Delete the mod from the list
                                shutil.copy(file, new_path)
                                # Add the new file to the list
                                if version not in self.active_mods:
                                    self.active_mods[version] = []
                                self.active_mods[version].append(mod_text)
                        else:
                            shutil.copy(file, new_path)
                            if version not in self.active_mods:
                                self.active_mods[version] = []
                            self.active_mods[version].append(mod_text)
                    elif file.endswith(".olpkg"):
                        if os.path.exists(new_path):
                            if messagebox.askyesno("Warning", lang(self.current_lang, "file_exists")):
                                # Remove the old file from the list
                                self.remove_mod_from_list(self.inactive_mods_list, new_name)
                                for version, mods in self.inactive_mods.items():
                                    if new_name.replace(f"{self.version}_", "") in [mod.split(" (")[0] for mod in mods]:
                                        self.inactive_mods[version] = [mod for mod in mods if mod.split(" (")[0] != new_name.replace(f"{self.version}_", "")]
                                shutil.copy(file, new_path)
                                # Add the new file to the list
                                if version not in self.inactive_mods:
                                    self.inactive_mods[version] = []
                                self.inactive_mods[version].append(mod_text)
                        else:
                            shutil.copy(file, new_path)
                            if version not in self.inactive_mods:
                                self.inactive_mods[version] = []
                            self.inactive_mods[version].append(mod_text)
                    else:
                        messagebox.showerror("Error", lang(self.current_lang, "invalid_file_format"))
                self.sort_mods()
                self.remove_empty_versions()
                self.populate_mod_list(self.active_mods_list, self.active_mods)
                self.populate_mod_list(self.inactive_mods_list, self.inactive_mods)
            else:
                pass

        # Function to open the mods directory
        def open_mods_dir():
            if os.path.exists(self.mod_directory):
                if sys.platform == "win32":
                    subprocess.Popen(['explorer', self.mod_directory])
                else:
                    # subprocess.Popen(['gio', 'open',  self.mod_directory]) Use this if xdg-open doesn't work on your system
                    subprocess.Popen(['xdg-open',  self.mod_directory])

        # Create the buttons
        activate_button = QPushButton(lang(self.current_lang, "btn_activate"))
        activate_button.setFixedWidth(254)
        activate_button.setStyleSheet(bt_style)
        activate_button.clicked.connect(activate_mods)

        install_button = QPushButton(lang(self.current_lang, "btn_install"))
        install_button.setFixedWidth(254)
        install_button.setStyleSheet(bt_style)
        install_button.clicked.connect(install_mods)

        deactivate_button = QPushButton(lang(self.current_lang, "btn_deactivate"))
        deactivate_button.setFixedWidth(254)
        deactivate_button.setStyleSheet(bt_style)
        deactivate_button.clicked.connect(deactivate_mods)

        # Add the horizontal layout and buttons to the main layout
        buttons_layout = QHBoxLayout()
        buttons_layout.addWidget(deactivate_button)
        buttons_layout.addWidget(install_button)
        buttons_layout.addWidget(activate_button)

        main_layout.addWidget(info_label)
        if self.version == "No version installed":
            main_layout.addWidget(disabled_label)
        main_layout.addLayout(lists_layout)
        main_layout.addLayout(buttons_layout)

        mod_dir_button = QPushButton(lang(self.current_lang, "btn_open_mods_dir"))
        mod_dir_button.setStyleSheet(bt_style)
        mod_dir_button.clicked.connect(open_mods_dir)
        main_layout.addWidget(mod_dir_button)

        self.setLayout(main_layout)

        # Enable drag and drop
        self.setAcceptDrops(True)

        # Disable button if no version is installed
        if self.version == "No version installed":
            install_button.setEnabled(False)
            info_label.hide()

    # Function to remove a mod from the list
    def remove_mod_from_list(self, list_widget, mod_name):
        for index in range(list_widget.count()):
            if list_widget.item(index).text().split(" (")[0] == mod_name.replace(f"{self.version}_", ""):
                list_widget.takeItem(index)
                break

    # Function to accept drops
    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    # Function to drop files
    def dropEvent(self, event):
        if self.version == "No version installed":
            messagebox.showerror("Error", lang(self.current_lang, "error_no_version"))
            return
        for url in event.mimeData().urls():
            file_path = url.toLocalFile()
            new_name = f"{self.version}_{os.path.basename(file_path)}"
            new_path = os.path.join(self.mod_directory, new_name)
            if file_path.endswith(".jar"):
                if os.path.exists(new_path):
                    if messagebox.askyesno("Warning", lang(self.current_lang, "file_exists")):
                        self.remove_mod_from_list(self.active_mods_list, new_name)
                        for version, mods in self.active_mods.items():
                            if new_name.replace(f"{self.version}_", "") in [mod.split(" (")[0] for mod in mods]:
                                self.active_mods[version] = [mod for mod in mods if mod.split(" (")[0] != new_name.replace(f"{self.version}_", "")]  # Delete the mod from the list
                        shutil.copy(file_path, new_path)
                        mod_size = os.path.getsize(new_path) / (1024 * 1024)  # Size in MB
                        mod_text = f"{new_name} ({mod_size:.2f} MB)"
                        mod_text = mod_text.replace(f"{self.version}_", "")
                        version = new_name.split('_')[0]
                        if version not in self.active_mods:
                            self.active_mods[version] = []
                        self.active_mods[version].append(mod_text)
                    else:
                        return
                else:
                    shutil.copy(file_path, new_path)
                    mod_size = os.path.getsize(new_path) / (1024 * 1024)  # Size in MB
                    mod_text = f"{new_name} ({mod_size:.2f} MB)"
                    mod_text = mod_text.replace(f"{self.version}_", "")
                    version = new_name.split('_')[0]
                    if version not in self.active_mods:
                        self.active_mods[version] = []
                    self.active_mods[version].append(mod_text)
            elif file_path.endswith(".olpkg"):
                if os.path.exists(new_path):
                    if messagebox.askyesno("Warning", lang(self.current_lang, "file_exists")):
                        self.remove_mod_from_list(self.inactive_mods_list, new_name)
                        for version, mods in self.inactive_mods.items():
                            if new_name.replace(f"{self.version}_", "") in [mod.split(" (")[0] for mod in mods]:
                                self.inactive_mods[version] = [mod for mod in mods if mod.split(" (")[0] != new_name.replace(f"{self.version}_", "")] # Delete the mod from the list
                        shutil.copy(file_path, new_path)
                        mod_size = os.path.getsize(new_path) / (1024 * 1024)  # Size in MB
                        mod_text = f"{new_name} ({mod_size:.2f} MB)"
                        mod_text = mod_text.replace(f"{self.version}_", "")
                        version = new_name.split('_')[0]
                        if version not in self.inactive_mods:
                            self.inactive_mods[version] = []
                        self.inactive_mods[version].append(mod_text)
                    else:
                        return
                else:
                    shutil.copy(file_path, new_path)
                    mod_size = os.path.getsize(new_path) / (1024 * 1024)  # Size in MB
                    mod_text = f"{new_name} ({mod_size:.2f} MB)"
                    mod_text = mod_text.replace(f"{self.version}_", "")
                    version = new_name.split('_')[0]
                    if version not in self.inactive_mods:
                        self.inactive_mods[version] = []
                    self.inactive_mods[version].append(mod_text)
            else:
                messagebox.showerror("Error", lang(self.current_lang, "invalid_file_format"))
        self.sort_mods()
        self.remove_empty_versions()
        self.populate_mod_list(self.active_mods_list, self.active_mods)
        self.populate_mod_list(self.inactive_mods_list, self.inactive_mods)

    # Function to check if an item is in the list
    def is_in_list(self, list_widget, item_text):
        for index in range(list_widget.count()):
            if list_widget.item(index).text().split(" (")[0] == item_text:
                return True
        return False

    # Function to update the text of an item in the list
    def update_list_item(self, list_widget, item_text, new_text):
        for index in range(list_widget.count()):
            if list_widget.item(index).text().split(" (")[0] == item_text:
                list_widget.item(index).setText(new_text)
                break

    # Function to sort mods alphabetically
    def sort_mods(self):
        for version in self.active_mods:
            self.active_mods[version].sort()
        for version in self.inactive_mods:
            self.inactive_mods[version].sort()

    # Function to remove empty versions
    def remove_empty_versions(self):
        self.active_mods = {version: mods for version, mods in self.active_mods.items() if mods}
        self.inactive_mods = {version: mods for version, mods in self.inactive_mods.items() if mods}

    # Function to populate the mod list with version sections
    def populate_mod_list(self, list_widget, mods_dict):
        list_widget.clear()
        r, g, b = map(int, self.bg_color.split(','))  # Background color
        if r > 50: r -= 50 
        else: r = 0
        if g > 50: g -= 50
        else: g = 0
        if b > 50: b -= 50
        else: b = 0
        for version, mods in sorted(mods_dict.items()):
            version_item = QListWidgetItem(f"Version: {version}")
            version_item.setFlags(version_item.flags() & ~Qt.ItemIsSelectable)
            version_item.setBackground(QBrush(QColor(r, g, b, 255)))
            list_widget.addItem(version_item)
            for mod in mods:
                list_widget.addItem(mod)

# Function to show the mod manager dialog
def show_mod_manager(bg_color=f"{variables.bg_color}", icon=f"{variables.icon}", version="", bg_path=variables.bg_path, bg_blur=variables.bg_blur, current_lang="en"):
    mod_manager = ModManager(bg_color, icon, version, bg_path, bg_blur, current_lang)
    mod_manager.exec_()