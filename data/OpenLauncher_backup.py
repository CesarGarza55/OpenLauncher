"""
OpenLauncher - Open Source Minecraft Launcher
Main entry point for the application

Refactored for better maintainability with modular structure
"""

import time
import os
import sys
import json
import argparse
import minecraft_launcher_lib
from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt
from tkinter import messagebox

import variables
from variables import write_log
from updater import update
from microsoft_auth import login_qt
from lang import lang, change_language, current_language
from mc_run import run_minecraft
from discord_manager import DiscordManager
from config_manager import ConfigManager
from utils import load_theme_plugins, apply_theme
from main_window import MainWindow
from ui_methods import LoadingScreen, MainWindowLoader

# Function to handle exceptions
def handle_exception(exc_type, exc_value, exc_traceback):
    """Log exceptions instead of crashing"""
    write_log(f"Exception: {exc_type}, {exc_value}", "exception")

# Set exception hook
# sys.excepthook = handle_exception

# Parse command line arguments for CLI mode
parser = argparse.ArgumentParser(description='Run the desired Minecraft version without using a GUI')
parser.add_argument('-mc_ver', type=str, help='Minecraft version to run')
parser.add_argument('-mc_name', type=str, help='Minecraft username (only for offline mode)')
parser.add_argument('-jvm_args', type=str, help='JVM arguments (optional)')
parser.add_argument('-online', type=str, help='Use the online mode (optional) (true/false)')
parser.add_argument('-mc_dir', type=str, help='Minecraft directory (optional)')
args = parser.parse_args()

if args.mc_ver or args.mc_name or args.jvm_args or args.online or args.mc_dir:
    if args.online == "true":
        if not os.path.exists(variables.refresh_token_file):
            messagebox.showerror("Error", lang(current_language,"no_refresh_token"))
            sys.exit()
        try:
            profile = login_qt()
            if 'id' in profile and 'name' in profile:
                args.mc_name = profile['name']
                args.online = profile['access_token']
            else:
                messagebox.showerror("Error", "Could not authenticate")
                sys.exit()
        except Exception as e:
            messagebox.showerror("Error", f"Could not authenticate: {e}")
            sys.exit()
    mc = run_minecraft(args.mc_ver, args.mc_name, args.jvm_args, args.online, args.mc_dir)
    if mc == "No version":
        messagebox.showerror("Error", lang(current_language,"no_version"))
    if mc == "MC_FAIL":
        messagebox.showerror("Error", lang(current_language,"mc_fail"))
    sys.exit()

# When qt.qpa.plugin: Could not find the Qt platform plugin "wayland" in "" error appears on Linux use this
# This is a workaround to use x11 instead of Wayland to avoid the error and make the application work properly
# When the error appears, the application works, but i'ts better to avoid it to prevent future problems
# It's only necessary to uncomment the code below when the error appears, in the most cases it's not necessary
#if sys.platform == "linux" and "wayland" in os.environ.get("XDG_SESSION_TYPE", "").lower():
#    os.environ["QT_QPA_PLATFORM"] = "x11"

# Load the system language
system_lang = current_language

# I have been working on this for idk how long, i stopped counting the hours long ago
# When i fix a bug, another one appears, and when i fix that one, another four appear
# Functions that worked perfectly before, suddenly stop working and i have to rewrite them
# I considerate to rewrite the whole code from scratch, but i don't tink it will be worth it
# If someone wants to rewrite this, feel free to do it, i will not try to refactor this again
# I will keep making updates, but i'm not sure if i will be able to fix all the bugs someday
# The code is a mess, but hey, it works, and that's what matters XD

# Authenticate the user and fetch the profile
def authenticate():
    try:
        profile = login(system_lang, icon)
        return profile
    except Exception as e:
        messagebox.showerror("Error", f"Could not authenticate: {e}")

def logout():
    try:
        os.remove(variables.refresh_token_file)
    except Exception as e:
        messagebox.showerror("Error", f"Could not log out: {e}")

# Check for updates and update the launcher if necessary
if os.path.exists(os.path.join(variables.app_directory, "config/user_data.json")):
    with open(os.path.join(variables.app_directory, "config/user_data.json"), "r") as f:
        user_data = json.load(f)
        ask_update = user_data.get("ask_update")
        if ask_update == "yes":
            update()
else:
    ask_update = variables.ask_update

access_token = ""

# Create the Discord Rich Presence object
rpc = Presence(variables.CLIENT_ID)

discord_error = ""

# Set the default value for the Discord Rich Presence
discord_rpc = False

def connect_discord():
    global discord_error
    try:
        # Connect to the Discord Rich Presence
        rpc.connect()

        # Update the Discord Rich Presence
        rpc.update(
            details="OpenSource Minecraft Launcher",
            state=random.choice(variables.state_list),
            large_image="preview",
            large_text="Minecraft Java Edition",
            start=time.time()
        )
        discord_error = ""
    except Exception as e:
        discord_error = lang(system_lang,"discord_error")

# Function to clean up the Discord Rich Presence
def cleanup():
    global discord_error
    try:
        rpc.clear()
        rpc.close()
        discord_error = ""
    except Exception as e:
        pass

# Function to enable or disable the Discord Rich Presence
def discord_controller():
    global discord_rpc, discord_error
    if not discord_rpc:
        connect_discord()
        discord_rpc = True
    else:
        cleanup()
        discord_rpc = False
        discord_error = ""

def ask_update_controller():
    global ask_update
    if ask_update == "yes":
        ask_update = "no"
    else:
        ask_update = "yes"

# if the Discord Rich Presence is enabled, clean up the connection when the application is closed
if discord_rpc:
    atexit.register(cleanup)

minecraft_directory = variables.minecraft_directory
app_dir = variables.app_directory
plugin_dir = variables.plugins_directory

# Function to open the plugins website
def open_website():
    webbrowser.open(variables.website_url)

# Function to open the launcher directory
# For some reason, the function to open the directory on Linux suddenly stopped working
# so i had to change it to use gio instead of xdg-open (i don't know why it stopped working)
# when i use xdg-open, the kde-open5 start to use all the RAM and the system freezes
# so i had to use gio, i don't know if it will work on all the linux distros, but it works on mine (Ubuntu with KDE)
def open_launcher_dir():
    # Check if the directory exists
    if os.path.exists(app_dir):
        # Open the directory
        if sys.platform == "win32":
            subprocess.Popen(['explorer', app_dir])
        elif sys.platform == "linux":
            try:
                subprocess.Popen(['gio', 'open',  app_dir])
            except Exception as e:
                subprocess.Popen(['xdg-open',  app_dir])
    else:
        messagebox.showerror("Error", f"Directory {app_dir} does not exist")

# Function to open the Minecraft directory (the same case as the open_launcher_dir function)
def open_minecraft_dir():
    # Check if the directory exists
    if os.path.exists(minecraft_directory):
        # Open the directory
        if sys.platform == "win32":
            subprocess.Popen(['explorer', minecraft_directory])
        elif sys.platform == "linux":
            try:
                subprocess.Popen(['gio', 'open',  minecraft_directory])
            except Exception as e:
                subprocess.Popen(['xdg-open',  minecraft_directory])
    else:
        print(f"Directory {minecraft_directory} does not exist")

def load_theme_plugins(plugin_dir):
    themes = []
    if os.path.exists(plugin_dir):
        for folder in os.listdir(plugin_dir):
            folder_path = os.path.join(plugin_dir, folder)
            if os.path.isdir(folder_path):
                config_path = os.path.join(folder_path, 'theme.json')
                if os.path.isfile(config_path):
                    with open(config_path, 'r') as f:
                        try:
                            theme = json.load(f)
                            theme['folder'] = folder  # Add the folder name to the theme
                            themes.append(theme)
                        except Exception as e:
                            print(f"Could not load theme from {config_path}: {e}")
    return themes

# Load the themes
themes = load_theme_plugins(plugin_dir)

bg_color = variables.bg_color

# Function to apply the theme
def apply_theme(theme):
    global bg_path, bg_color, icon, bg_blur
    
    # Dictionary with the default paths
    default_paths = {
        'bg_path': variables.bg_path,
        'icon': variables.icon,
        'bg_color': variables.bg_color,
        'bg_blur': variables.bg_blur
    }
    
    # Update the paths
    for key in default_paths:
        if key in theme:
            if key == 'bg_color':
                # Validate bg_color format
                if isinstance(theme[key], str) and all(0 <= int(c) <= 255 for c in theme[key].split(',')):
                    globals()[key] = theme[key]
                else:
                    messagebox.showerror("Error", f"The theme {theme['folder']} has an invalid bg_color value (must be in the format 'R, G, B') for example '25, 45, 75' the values must be between 0 and 255.\nThe default color will be used")
                    globals()[key] = default_paths[key]
            elif key == 'bg_blur':
                # Validate bg_blur range
                if isinstance(theme[key], int) and 0 <= theme[key] <= 64:
                    globals()[key] = theme[key]
                else:
                    messagebox.showerror("Error", f"The theme {theme['folder']} has an invalid bg_blur value (must be an number between 0 and 64).\nThe default value will be used")
                    globals()[key] = default_paths[key]
            elif key == 'folder':
                pass
            else:
                # Validate image path
                image_path = os.path.join(plugin_dir, theme['folder'], theme[key]).replace("\\", "/")
                if os.path.isfile(image_path):
                    globals()[key] = image_path
                else:
                    messagebox.showerror("Error", f"The theme {theme['folder']} has an invalid {key} path.\nThe default path will be used")
                    globals()[key] = default_paths[key]
        else:
            globals()[key] = default_paths[key]
        # print(f"{key}: {globals()[key]}")
        
# Check if there is more than one theme
if len(themes) == 0: 
    # Load the default theme
    bg_path = variables.bg_path
    icon = variables.icon
    bg_color = variables.bg_color
    bg_blur = variables.bg_blur
elif len(themes) > 1:
    if messagebox.askyesno("Information", lang(system_lang,"theme_ask")):
        open_launcher_dir()
        sys.exit()
    else:
        messagebox.showinfo("Information", lang(system_lang,"theme_error"))
    # Load the first theme
    apply_theme(themes[0])
elif len(themes) == 1:
    apply_theme(themes[0])

# Load the versions
try:
    versions = minecraft_launcher_lib.utils.get_version_list()
    forge_versions = minecraft_launcher_lib.forge.list_forge_versions()
    fabric_versions = minecraft_launcher_lib.fabric.get_all_minecraft_versions()
    fabric_loaders = minecraft_launcher_lib.fabric.get_all_loader_versions()
except Exception as e:
    versions = list()
    forge_versions = list()
    fabric_versions = list()
    fabric_loaders = list()

# Create lists to store the versions
all_versions = list()
releases = list()
snapshots = list()
fabric_releases = list()
fabric_all = list()
fabric_loader = list()
forge_all = list()

# Add the versions to the lists
for i in range(0, len(versions)):
    all_versions.append(versions[i]['id'])
    if versions[i]['type'] == 'release':
        releases.append(versions[i]['id'])
    elif versions[i]['type'] == 'snapshot':
        snapshots.append(versions[i]['id'])

for i in range(0, len(fabric_versions)):
    if fabric_versions[i]['stable'] == True:
        fabric_releases.append(fabric_versions[i]['version'])

    fabric_all.append(fabric_versions[i]['version'])

for i in range(0, len(fabric_loaders)):
    fabric_loader.append(fabric_loaders[i]['version'])

for i in forge_versions:
    forge_all.append(i)

# Class to run a function in a separate thread 
# (idk why but it doesn't work with threading.Thread and i had to use QRunnable,
# I really don't know what's exactly happening here, but it works, so i will keep it like that)
class CommandWorkerSignals(QObject):
    finished = pyqtSignal()
    error = pyqtSignal(str)
    output = pyqtSignal(str)

class CommandWorker(QRunnable):
    def __init__(self, command):
        super(CommandWorker, self).__init__()
        self.command = command
        self.signals = CommandWorkerSignals()

    @pyqtSlot()
    def run(self):
        process = None
        try:
            if sys.platform == 'win32':
                # Don't show the console window
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                process = subprocess.Popen(self.command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, startupinfo=startupinfo, universal_newlines=True)
            elif sys.platform == 'linux':
                process = subprocess.Popen(self.command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

            for line in iter(process.stdout.readline, ''):
                self.signals.output.emit(line.strip())  # Emit the output to be handled in the main thread
            process.stdout.close()
            process.wait()
        except Exception as e:
            self.signals.error.emit(f"Could not start Minecraft: {e}")
        finally:
            if process:
                process.stdout.close()
                process.stderr.close()
                process.wait()
            self.signals.finished.emit()

class FunctionWorkerSignals(QObject):
    finished = pyqtSignal()
    error = pyqtSignal(str)
    output = pyqtSignal(str)

class FunctionWorker(QRunnable):
    def __init__(self, fn, *args, **kwargs):
        super(FunctionWorker, self).__init__()
        self.fn = fn
        self.args = args
        self.kwargs = kwargs
        self.signals = FunctionWorkerSignals()

    @pyqtSlot()
    def run(self):
        try:
            # Redirect stdout to capture the output
            original_stdout = sys.stdout
            sys.stdout = self

            result = self.fn(*self.args, **self.kwargs)
            if result is not None:
                self.signals.output.emit(str(result))
        except Exception as e:
            self.signals.error.emit(str(e))
        finally:
            # Restore original stdout
            sys.stdout = original_stdout
            self.signals.finished.emit()

    def write(self, message):
        # Emit each line separately to avoid extra newlines
        for line in message.splitlines():
            if line:
                self.signals.output.emit(line)

    def flush(self):
        pass

# Create a class to redirect the standard output to the QTextEdit widget
class StdoutRedirector:
    def __init__(self, console_output):
        self.text_widget = console_output

    def write(self, string):
        self.text_widget.moveCursor(QTextCursor.End)
        self.text_widget.ensureCursorVisible()
        self.text_widget.insertPlainText(string)

    def flush(self):
        pass
            
class Ui_MainWindow(object):
    def setupUi(self, MainWindow):
        global discord_error
        if not MainWindow.objectName():
            MainWindow.setObjectName(u"MainWindow")
        MainWindow.resize(850, 500)
        MainWindow.setMinimumSize(QSize(850, 500))
        MainWindow.setWindowIcon(QIcon(icon))
        self.centralwidget = QWidget(MainWindow)
        self.centralwidget.setObjectName(u"centralwidget")
        self.resizeEvent = self.on_resize

        # Create the background image for the central widget with blur effect
        self.background = QLabel(self.centralwidget)
        self.background.setObjectName(u"background")
        self.background.setGeometry(0, 0, 850, 500)
        self.background.setPixmap(QPixmap(bg_path).scaled(850, 500, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))

        self.blur_effect = QGraphicsBlurEffect()
        self.blur_effect.setBlurRadius(bg_blur)
        self.background.setGraphicsEffect(self.blur_effect)

        self.gridLayout = QGridLayout(self.centralwidget)
        self.gridLayout.setObjectName(u"gridLayout")

        # Top group
        self.top_group = QGroupBox(self.centralwidget)
        self.top_group.setStyleSheet(f"background-color: rgba({bg_color}, 0.3); border-radius: 5px;")
        self.top_group_layout = QVBoxLayout(self.top_group)
        self.top_group_layout.setObjectName(u"top_group_layout")

        self.discord_e = QLabel(self.centralwidget)
        self.discord_e.setObjectName(u"discord_e")
        self.discord_e.setText(discord_error)
        self.discord_e.setStyleSheet("color: #ffffff; background-color: transparent; font-size: 14px; font: bold;")
        self.discord_e.setAlignment(Qt.AlignCenter)
        self.top_group_layout.addWidget(self.discord_e)

        self.horizontalLayout = QHBoxLayout()
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.verticalLayout_2 = QVBoxLayout()
        self.verticalLayout_2.setObjectName(u"verticalLayout_2")
        self.horizontalLayout_2 = QHBoxLayout()
        self.horizontalLayout_2.setObjectName(u"horizontalLayout_2")

        self.label = QLabel(self.centralwidget)
        self.label.setObjectName(u"label")
        self.label.setAlignment(Qt.AlignCenter | Qt.AlignVCenter)
        self.label.setWordWrap(True)
        self.verticalLayout_2.addWidget(self.label)
        self.lineEdit = QLineEdit(self.centralwidget)
        self.lineEdit.setObjectName(u"lineEdit")
        sizePolicy = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.lineEdit.sizePolicy().hasHeightForWidth())
        self.lineEdit.setSizePolicy(sizePolicy)
        self.lineEdit.setMinimumSize(QSize(350, 30))
        self.lineEdit.setMaximumSize(QSize(350, 16777215))
        self.lineEdit.setPlaceholderText(lang(system_lang,"user_placeholder"))
        self.lineEdit.setAlignment(Qt.AlignCenter)

        # Don't focus the line edit when the window is opened
        self.lineEdit.setFocusPolicy(Qt.ClickFocus)

        self.verticalLayout_2.addWidget(self.lineEdit)

        self.btn_account = QPushButton(self.centralwidget)
        self.btn_account.setObjectName(u"btn_account")
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
        self.verticalLayout.setObjectName(u"verticalLayout")
        self.btn_minecraft = QPushButton(self.centralwidget)
        self.btn_minecraft.setObjectName(u"pushButton")
        sizePolicy1.setHorizontalStretch(0)
        sizePolicy1.setVerticalStretch(0)
        sizePolicy1.setHeightForWidth(self.btn_minecraft.sizePolicy().hasHeightForWidth())
        self.btn_minecraft.setSizePolicy(sizePolicy1)
        self.btn_minecraft.setMinimumSize(QSize(350, 30))
        self.btn_minecraft.setMaximumSize(QSize(350, 30))

        self.verticalLayout.addWidget(self.btn_minecraft)

        self.btn_fabric = QPushButton(self.centralwidget)
        self.btn_fabric.setObjectName(u"btn_fabric")
        sizePolicy1.setHeightForWidth(self.btn_fabric.sizePolicy().hasHeightForWidth())
        self.btn_fabric.setSizePolicy(sizePolicy1)
        self.btn_fabric.setMinimumSize(QSize(350, 30))
        self.btn_fabric.setMaximumSize(QSize(350, 30))

        self.verticalLayout.addWidget(self.btn_fabric)

        self.btn_forge = QPushButton(self.centralwidget)
        self.btn_forge.setObjectName(u"btn_forge")
        sizePolicy1.setHeightForWidth(self.btn_forge.sizePolicy().hasHeightForWidth())
        self.btn_forge.setSizePolicy(sizePolicy1)
        self.btn_forge.setMinimumSize(QSize(350, 30))
        self.btn_forge.setMaximumSize(QSize(350, 30))

        self.verticalLayout.addWidget(self.btn_forge)

        self.btn_mod_manger = QPushButton(self.centralwidget)
        self.btn_mod_manger.setObjectName(u"btn_mod_manger")
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
        self.bottom_group_layout.setObjectName(u"bottom_group_layout")

        self.console_output = QTextEdit(self.centralwidget)
        self.console_output.setObjectName(u"console_output")
        sizePolicy2 = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        sizePolicy2.setHorizontalStretch(0)
        sizePolicy2.setVerticalStretch(0)
        sizePolicy2.setHeightForWidth(self.console_output.sizePolicy().hasHeightForWidth())
        self.console_output.setSizePolicy(sizePolicy2)
        self.console_output.setMinimumSize(QSize(0, 200))
        self.console_output.setInputMethodHints(Qt.ImhMultiLine|Qt.ImhNoEditMenu)
        self.console_output.setTextInteractionFlags(Qt.TextSelectableByKeyboard|Qt.TextSelectableByMouse)
        self.console_output.setReadOnly(True)

        self.bottom_group_layout.addWidget(self.console_output)

        self.horizontalLayout_4 = QHBoxLayout()
        self.horizontalLayout_4.setObjectName(u"horizontalLayout_4")
        self.comboBox = QComboBox(self.centralwidget)
        self.comboBox.setObjectName(u"comboBox")
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
        self.btn_settings.setObjectName(u"btn_settings")
        self.btn_settings.setMinimumSize(QSize(200, 30))
        self.btn_settings.setMaximumSize(QSize(500, 30))
        self.btn_settings.setSizePolicy(sizePolicy3)

        self.horizontalLayout_4.addWidget(self.btn_settings)

        self.horizontalSpacer_5 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_4.addItem(self.horizontalSpacer_5)

        self.btn_play = QPushButton(self.centralwidget)
        self.btn_play.setObjectName(u"btn_play")
        self.btn_play.setMinimumSize(QSize(200, 30))
        self.btn_play.setMaximumSize(QSize(500, 30))
        self.btn_play.setSizePolicy(sizePolicy3)

        self.horizontalLayout_4.addWidget(self.btn_play)

        self.bottom_group_layout.addLayout(self.horizontalLayout_4)

        self.gridLayout.addWidget(self.bottom_group, 1, 0, 1, 1)

        MainWindow.setCentralWidget(self.centralwidget)

        self.retranslateUi(MainWindow)

        QMetaObject.connectSlotsByName(MainWindow)

        # Establish the style of the widgets
        MainWindow.setStyleSheet("background-color: rgba("f'{bg_color}'", 1);")
        self.bt_style = """
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.5);
                color: #ffffff; 
                border-radius: 5px;
            }
            QPushButton:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
            QPushButton:disabled {
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }
            QPushButton:focus {
                outline: none;
                border: none;
            }
            QPushButton {
                border: none;
            }
        """
        self.btn_minecraft.setStyleSheet(self.bt_style)
        self.btn_fabric.setStyleSheet(self.bt_style)
        self.btn_forge.setStyleSheet(self.bt_style)
        self.btn_settings.setStyleSheet(self.bt_style)
        self.btn_play.setStyleSheet(self.bt_style)
        self.btn_mod_manger.setStyleSheet(self.bt_style)
        self.btn_account.setStyleSheet(self.bt_style)
        
        self.console_output.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.5); color: #ffffff; border: none; border-radius: 5px; font-size: 12px;")
        self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
        self.lineEdit.setStyleSheet("""
            QLineEdit {
                background-color: rgba("""f'{bg_color}'""", 0.5); 
                color: #ffffff;
                border-radius: 5px;
                border: none;
                padding: 5px;
            }
            QLineEdit:hover {
                background-color: rgba("""f'{bg_color}'""", 0.8);
            }
            QLineEdit:disabled {
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }
        """)
        self.comboBox.setStyleSheet("""
            QComboBox {
                background-color: rgba("""f'{bg_color}'""", 0.5); 
                color: #ffffff; 
                border-radius: 5px;
            }
            QComboBox:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
            QComboBox:disabled {
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }
            QComboBox QAbstractItemView {
                background-color: rgba("""f'{bg_color}'""", 0.5); 
                color: #ffffff; 
                border-radius: 5px;
            }
        """)
        self.comboBox.setMaxVisibleItems(10)
        tooltip_stylesheet = "QToolTip { color: #ffffff; background-color: #333333; border: 1px solid white; }"
        QApplication.instance().setStyleSheet(tooltip_stylesheet)

        # Connect the buttons to the functions
        self.btn_minecraft.clicked.connect(self.install_normal_versions)
        self.btn_fabric.clicked.connect(self.install_fabric_versions)
        self.btn_forge.clicked.connect(self.install_forge_versions)
        self.btn_settings.clicked.connect(self.settings_window)
        self.btn_play.clicked.connect(self.run_minecraft)
        self.btn_mod_manger.clicked.connect(self.open_mod_manager)

        self.update_list_versions()
        global jvm_arguments
        global maximize
        global discord_rpc
        global user_name
        global access_token
        global ask_update
        global user_uuid
        if os.path.exists(variables.refresh_token_file):
            try:
                profile = login(system_lang, icon)
            except Exception as e:
                profile = None
            if not variables.check_network():
                profile = "No connection"
            if profile == "No connection":
                self.lineEdit.setVisible(True)
                self.label.setText(lang(system_lang,"label_username"))
                self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
                self.btn_account.setText(lang(system_lang,"no_internet"))
                self.btn_account.setStyleSheet(self.bt_style)
                self.btn_account.clicked.disconnect()
                self.btn_account.setDisabled(True)
            elif profile and 'id' in profile and 'name' in profile:
                access_token = profile['access_token']
                user_name = profile['name']
                user_uuid = profile['id']
                self.lineEdit.setVisible(False)
                self.label.setText(f"{lang(system_lang,'logged_as')} {profile['name']}")
                self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
                self.btn_account.setText(lang(system_lang,"logout_microsoft"))
                self.btn_account.setIcon(QIcon(variables.logout_icon))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.logout_microsoft)
            else:
                self.lineEdit.setVisible(True)
                self.label.setText(lang(system_lang,"label_username"))
                self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
                self.btn_account.setText(lang(system_lang,"login_microsoft"))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.login_microsoft)
        # Load the data from the user_data.json file
        if os.path.exists(f'{app_dir}/config/user_data.json'):
            with open(f'{app_dir}/config/user_data.json', 'r') as f:
                user_data = json.load(f)
                user_name = user_data.get('name')
                last_version = user_data.get('last_version')
                show_snapshots = user_data.get('toggle_snapshots')
                jvm_arguments = user_data.get('jvm_arguments')
                ask_update = user_data.get('ask_update')
                discord_rpc = user_data.get('discord_rpc')
                maximize = user_data.get('maximized')
                # Apply the data to the widgets and variables
                if(user_name != "" and last_version != ""):
                    if user_name is not None:
                        self.lineEdit.setText(user_name)
                    if last_version is not None:
                        index = self.comboBox.findText(last_version, QtCore.Qt.MatchFixedString)
                        if index >= 0:
                            self.comboBox.setCurrentIndex(index)
                first_load = True
                if discord_rpc == True and first_load == True:
                    connect_discord()  
                    first_load = False
                if maximize == True:
                    #MainWindow.showMaximized()
                    #self.on_resize(MainWindow)
                    # Idk why but it's buggy when the window starts maximized so i will keep it like this for now
                    pass
        else:
            if user_name == "" or user_name == None:
                user_name = self.lineEdit.text()
            else:
                self.lineEdit.setText(user_name)
            last_version = self.comboBox.currentText()
            show_snapshots = False
            jvm_arguments = variables.defaultJVM
            discord_rpc = False
            ask_update = "yes"
            access_token = ""
            # Create the config directory if it does not exist
            os.makedirs(f'{app_dir}/config', exist_ok=True)

            # Save the data to a file
            data = {
                'name': user_name, # Save the user name
                'toggle_snapshots': show_snapshots,  # save the state of the checkbox
                'jvm_arguments': jvm_arguments,  # Save the JVM arguments
                'last_version': last_version,  # Save the last version used
                'ask_update': ask_update, # Save the state of the checkbox
                'discord_rpc': discord_rpc, # Save the state of the discord rpc
                'maximized': self.isMaximized() # Save the state of the window
            }
            # Save data to a file
            with open(f'{app_dir}/config/user_data.json', 'w') as f:
                json.dump(data, f)
        # Load the UUID from the user_uuid.json file
        if os.path.exists(f'{app_dir}/config/user_uuid.json') and os.path.getsize(f'{app_dir}/config/user_uuid.json') > 0:
            with open(f'{app_dir}/config/user_uuid.json', 'r') as f:
                user_uuid = json.load(f)
        else:
            user_uuid = ""
            
            # Create the config directory if it does not exist
            os.makedirs(f'{app_dir}/config', exist_ok=True)
            
            with open(f'{app_dir}/config/user_uuid.json', 'w') as f:
                json.dump(user_uuid, f)

    # setupUi

    def retranslateUi(self, MainWindow):
        MainWindow.setWindowTitle(QCoreApplication.translate("MainWindow", f'{lang(system_lang,"launcher_name")} — {variables.launcher_version}', None))
        self.label.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"label_username"), None))
        self.btn_minecraft.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_install_minecraft"), None))
        self.btn_fabric.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_install_loader"), None))
        self.btn_forge.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_install_loader").replace("Fabric", "Forge"), None))
        self.btn_settings.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"settings"), None))
        self.btn_play.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_play"), None))
        self.btn_mod_manger.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_mod_manager"), None))
        self.btn_account.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"login_microsoft"), None))

        # Set the icons for the buttons
        self.btn_minecraft.setIcon(QIcon(variables.minecraft_icon))
        self.btn_minecraft.setIconSize(QSize(20, 20))
        self.btn_fabric.setIcon(QIcon(variables.fabric_icon))
        self.btn_fabric.setIconSize(QSize(20, 20))
        self.btn_forge.setIcon(QIcon(variables.forge_icon))
        self.btn_forge.setIconSize(QSize(30, 30))
        self.btn_settings.setIcon(QIcon(variables.settings_icon))
        self.btn_settings.setIconSize(QSize(20, 20))
        self.btn_play.setIcon(QIcon(variables.play_icon))
        self.btn_play.setIconSize(QSize(20, 20))
        self.btn_mod_manger.setIcon(QIcon(variables.mod_icon))
        self.btn_mod_manger.setIconSize(QSize(20, 20))
        self.btn_account.setIcon(QIcon(variables.login_icon))
        self.btn_account.setIconSize(QSize(20, 20))
        
        # Create an action with an icon
        icon_action = QAction(QIcon(variables.steve_icon), "", self.lineEdit)

        # Add the action to the line edit (currently disabled for better visibility)
        # self.lineEdit.addAction(icon_action, QLineEdit.LeadingPosition)
        
    # retranslateUi

    def login_microsoft(self):
        global access_token, user_name
        try:
            profile = authenticate()
            if profile and 'id' in profile and 'name' in profile:
                access_token = profile['access_token']
                user_name = profile['name']
                self.lineEdit.setText(profile['name'])
                self.lineEdit.setVisible(False)
                self.label.setText(f"{lang(system_lang,'logged_as')} {profile['name']}")
                self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
                self.btn_account.setText(lang(system_lang,"logout_microsoft"))
                self.btn_account.setIcon(QIcon(variables.logout_icon))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.logout_microsoft)
                with open(f'{app_dir}/config/user_uuid.json', 'w') as f:
                    json.dump(profile['id'], f)

                self.save_data()    
            else:
                if 'error' in profile and profile['error'] == 'NOT_FOUND':
                    if messagebox.askyesno(lang(system_lang,"microsoft_account_not_found"), lang(system_lang,"microsoft_account_not_found_desc")):
                        webbrowser.open("https://www.minecraft.net/")

                self.lineEdit.setVisible(True)
                self.label.setText(lang(system_lang,"label_username"))
                
                self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
                self.lineEdit.setText("")
                self.btn_account.setText(lang(system_lang,"login_microsoft"))
                self.btn_account.clicked.disconnect()
                self.btn_account.clicked.connect(self.login_microsoft)
                with open(f'{app_dir}/config/user_uuid.json', 'w') as f:
                    json.dump("", f)
                access_token = ""
                self.save_data()
        except Exception as e:
            write_log(e, "microsoft_auth")

    def logout_microsoft(self):
        if not messagebox.askyesno(lang(system_lang,"ask_logout_title"), lang(system_lang,"ask_logout_desc")):
            return
        try:
            logout()
            global access_token
            access_token = ""
            with open(f'{app_dir}/config/user_uuid.json', 'w') as f:
                json.dump("", f)
            
            self.lineEdit.setVisible(True)
            self.label.setText(lang(system_lang,"label_username"))
            
            self.label.setStyleSheet(f"background-color: rgba({bg_color}, 0.5); color: #ffffff; font-size: 14px; border-radius: 5px;")
            self.lineEdit.setText("")
            self.btn_account.setText(lang(system_lang,"login_microsoft"))
            self.btn_account.setIcon(QIcon(variables.login_icon))
            self.btn_account.clicked.disconnect()
            self.btn_account.clicked.connect(self.login_microsoft)
            self.save_data()
        except Exception as e:
            write_log(e, "microsoft_logout")

    def on_resize(self, event):
        size = event.size()
        self.background.setGeometry(0, 0, size.width(), size.height())
        self.background.setPixmap(QPixmap(bg_path).scaled(size.width(), size.height(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))

    # Function to update the discord error label
    def update_error_discord(self):
        global discord_error
        if discord_error != "":
            self.discord_e.setText(discord_error)
            self.discord_e.show()
        else:
            self.discord_e.setText("")
            self.discord_e.hide()

    # Function to clear the console output from the main thread
    def clear_console(self):
        self.console_output.clear()

    # Function to update the progress bar
    def set_status(self, status: str):
        global output
        output = status
        print(output)

    # Function to set the maximum value of the progress bar
    def set_max(self, new_max: int):
        pass
    
    # Function to update the progress bar
    def set_progress(self, progress_value: int):
        pass

    # Function to install Minecraft version in a separate thread
    def install_minecraft(self, version, loader=None):
        if version:
            # Print the version to be installed
            print(lang(system_lang, "minecraft_installation").replace("1.0", version))
            # Disable the buttons
            self.btn_minecraft.setEnabled(False)
            self.btn_fabric.setEnabled(False)
            self.btn_forge.setEnabled(False)
            self.btn_play.setEnabled(False)
            self.btn_account.setEnabled(False)
            self.lineEdit.setEnabled(False)
            self.comboBox.setEnabled(False)

            # Install the version
            try:
                callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                }
                minecraft_launcher_lib.install.install_minecraft_version(version, minecraft_directory, callback=callback)
                messagebox.showinfo("Minecraft", lang(system_lang, "minecraft_installed").replace("1.0", version))
            except Exception as e:
                messagebox.showerror("Error", f"Could not install version: {e}")
                self.signals.error.emit(str(e))
                raise
            finally:
                # Enable the buttons
                self.btn_minecraft.setEnabled(True)
                self.btn_fabric.setEnabled(True)
                self.btn_forge.setEnabled(True)
                self.btn_play.setEnabled(True)
                self.btn_account.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                # Update the list of versions
                self.update_list_versions()
                # Set the selected version
                index = self.comboBox.findText(version, QtCore.Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
                self.signals.finished.emit()
        else:
            messagebox.showerror("Error", "No version entered")

    # Function to install Fabric in a separate thread
    def install_fabric(self, version, loader = None):
        if version:
            print(lang(system_lang,"forge_installation").replace("1.0", version).replace("Forge", "Fabric"))
            # Disable the buttons
            self.btn_minecraft.setEnabled(False)
            self.btn_fabric.setEnabled(False)
            self.btn_forge.setEnabled(False)
            self.btn_play.setEnabled(False)
            self.btn_account.setEnabled(False)
            self.lineEdit.setEnabled(False)
            self.comboBox.setEnabled(False)
            try:
                # Verifies that the version of Minecraft is supported by Fabric
                if minecraft_launcher_lib.fabric.is_minecraft_version_supported(version):
                    # Install Fabric
                    callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                    }
                    if loader == None:
                        minecraft_launcher_lib.fabric.install_fabric(version, minecraft_directory, callback=callback)
                    else:
                        minecraft_launcher_lib.fabric.install_fabric(version, minecraft_directory, callback=callback, loader_version=loader)
                    messagebox.showinfo("Fabric", lang(system_lang,"forge_installed").replace("1.0", version).replace("Forge", "Fabric"))
                else:
                    messagebox.showerror("Error", lang(system_lang,"forge_not_found").replace("Forge", "Fabric"))
            except Exception as e:
                messagebox.showerror("Error", f"Fabric could not be installed: {e}")
                self.signals.error.emit(str(e))
            finally:
                # Enable the buttons
                self.btn_minecraft.setEnabled(True)
                self.btn_fabric.setEnabled(True)
                self.btn_forge.setEnabled(True)
                self.btn_play.setEnabled(True)
                self.btn_account.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                # Update the list of versions
                self.update_list_versions()
                # Set the selected version
                codename = f"fabric-loader-{loader}-{version}"
                index = self.comboBox.findText(codename, QtCore.Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
                self.signals.finished.emit()
        else:
            messagebox.showerror("Error", "No version entered")
            
    # Function to install Forge in a separate thread
    def install_forge(self, version, loader = None):
        if version:
            print(lang(system_lang,"forge_installation").replace("1.0", version))
            # Disable the buttons
            self.btn_minecraft.setEnabled(False)
            self.btn_fabric.setEnabled(False)
            self.btn_forge.setEnabled(False)
            self.btn_play.setEnabled(False)
            self.btn_account.setEnabled(False)
            self.lineEdit.setEnabled(False)
            self.comboBox.setEnabled(False)

            # Install Forge
            try:
                for i in forge_versions:
                    if i == version:
                        forge = i
                        break
                if forge:
                    callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                    }
                    minecraft_launcher_lib.forge.install_forge_version(forge, minecraft_directory, callback=callback)
                    messagebox.showinfo("Forge", lang(system_lang,"forge_installed").replace("1.0", version))
                else:
                    messagebox.showerror("Error", lang(system_lang,"forge_not_found"))
            except Exception as e:
                messagebox.showerror("Error", f"Forge could not be installed: {e}")
                self.signals.error.emit(str(e))
            finally:
                # Enable the buttons
                self.btn_minecraft.setEnabled(True)
                self.btn_fabric.setEnabled(True)
                self.btn_forge.setEnabled(True)
                self.btn_play.setEnabled(True)
                self.btn_account.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                # Update the list of versions
                self.update_list_versions()
                # Set the selected version
                codename = version.split('-')
                version = codename[0]
                loader = codename[1]
                try:
                    extra = codename[2]
                except:
                    extra = ""
                type1 = f"{version}-forge-{loader}"
                type2 = f"{version}-Forge{loader}-{version}"
                type3 = f"{version}-forge{version}-{loader}-{extra}"
                index1 = self.comboBox.findText(type1, QtCore.Qt.MatchFixedString)
                index2 = self.comboBox.findText(type2, QtCore.Qt.MatchFixedString)
                index3 = self.comboBox.findText(type3, QtCore.Qt.MatchFixedString)
                if index1 >= 0:
                    self.comboBox.setCurrentIndex(index1)
                elif index2 >= 0:
                    self.comboBox.setCurrentIndex(index2)
                elif index3 >= 0:
                    self.comboBox.setCurrentIndex(index3)
                self.signals.finished.emit()
        else:
            messagebox.showerror("Error", "No version entered")

    # Function to toggle snapshots
    def toggle_snapshots(self):
        global show_snapshots
        show_snapshots = not show_snapshots

    # Function to configure the dropdown
    def configure_dropdown(self, vers, installed_versions_list):
        self.comboBox.clear()
        # Add versions with icons
        for version in installed_versions_list:
            if "forge" in version:
                self.comboBox.addItem(QIcon(variables.forge_icon), version)
            elif "fabric" in version:
                self.comboBox.addItem(QIcon(variables.fabric_icon), version)
            else:
                self.comboBox.addItem(QIcon(variables.minecraft_icon), version)
        index = self.comboBox.findText(vers, QtCore.Qt.MatchFixedString)
        if index >= 0:
            self.comboBox.setCurrentIndex(index)

    # Function to update the list of versions
    def update_list_versions(self):
        installed_versions = minecraft_launcher_lib.utils.get_installed_versions(minecraft_directory)
        installed_versions_list = [version['id'] for version in installed_versions]

        # Invert the list to show the latest versions first
        installed_versions_list = installed_versions_list[::-1]

        if len(installed_versions_list) != 0:
            vers = installed_versions_list[0]
        else:
            vers = lang(system_lang,"no_versions_installed")
            installed_versions_list.append(vers)

        self.configure_dropdown(vers, installed_versions_list)
    
    # Function to save the data
    def save_data(self):
        global jvm_arguments, discord_rpc, access_token, ask_update, show_snapshots, user_uuid
        if jvm_arguments != "":
            arg = jvm_arguments
        else:
            arg = variables.defaultJVM
        
        # Save the data to a file
        data = {
            'name': self.lineEdit.text(), # Save the user name
            'toggle_snapshots': show_snapshots,  # save the state of the checkbox
            'jvm_arguments': arg,  # Save the JVM arguments
            'last_version': self.comboBox.currentText(),  # Save the last version used
            'ask_update': ask_update, # Save the state of the checkbox
            'discord_rpc': discord_rpc, # Save the state of the discord rpc
            'maximized': MainWindow.isMaximized(self)
        }

        # Create the config directory if it does not exist
        os.makedirs(f'{app_dir}/config', exist_ok=True)

        # Save the data to a file
        with open(f'{app_dir}/config/user_uuid.json', 'w') as f:
            json.dump(user_uuid, f)

        # Save the data to a file
        with open(f'{app_dir}/config/user_data.json', 'w') as f:
            json.dump(data, f)

    # Function to generate a UUID
    def generate_uuid(self, name):
        try:
            global user_uuid  # Use the global variable
            resp = requests.get(f"https://api.mojang.com/users/profiles/minecraft/{name}")
            user_uuid = resp.json()["id"]

        except KeyError:
            # If the user is not found, generate a random UUID
            user_uuid = str(uuid.uuid4())

    # Function to check if Java is installed
    def is_java_installed(self):
        try:
            output = subprocess.check_output('java -version', stderr=subprocess.STDOUT, shell=True)
            return 'version' in output.decode('UTF-8').lower()
        except Exception:
            return False
        
    # Function to verify the username
    def verify_username(self, username):
        if len(username) < 3 or len(username) > 16:
            return False
        if not re.match("^[a-zA-Z0-9_]*$", username):
            return False
        return True

    # Function to run Minecraft 
    def run_minecraft(self):
        global jvm_arguments, access_token, user_uuid, user_name
        # Clear the console output
        self.console_output.clear()
        
        # Check if Java is installed
        if not self.is_java_installed():
            if sys.platform == 'win32':
                if messagebox.askyesno(lang(system_lang,"java_not_installed"), lang(system_lang,"ask_install_java")):
                    webbrowser.open('https://www.java.com/es/download/')
                else:
                    messagebox.showerror(lang(system_lang,"java_not_installed"), lang(system_lang,"java_not_installed_win"))
                    sys.exit()  # Close the application
            elif sys.platform == 'linux':
                messagebox.showinfo(lang(system_lang,"java_not_installed"), lang(system_lang,"java_not_installed_linux"))
            return

        if access_token == "" or access_token is None:
            mine_user = self.lineEdit.text()
        else:
            mine_user = user_name
        if not mine_user:
            messagebox.showerror("Error", lang(system_lang,"no_username"))
            return
        
        # Verify if the username is valid
        if not self.verify_username(mine_user):
            messagebox.showerror("Error", lang(system_lang,"invalid_username"))
            return

        if not jvm_arguments:
            arg = variables.defaultJVM
        else:
            arg = jvm_arguments

        if user_uuid == "":
            # Generate a UUID if it does not exist
            self.generate_uuid(mine_user)
        self.save_data()

        # Disable the buttons
        self.btn_minecraft.setEnabled(False)
        self.btn_fabric.setEnabled(False)
        self.btn_forge.setEnabled(False)
        self.btn_play.setEnabled(False)
        self.btn_account.setEnabled(False)
        self.btn_mod_manger.setEnabled(False)
        self.lineEdit.setEnabled(False)
        self.comboBox.setEnabled(False)

        # Set version to the selected version
        version = self.comboBox.currentText()

        # If version is not null then set the options
        if version:
            options = {
                'username': mine_user,
                'uuid': user_uuid,
                'token': access_token,
                'jvmArguments': arg,
                'launcherName': "OpenLauncher for Minecraft",
                'launcherVersion': variables.launcher_version
            }

            # Start Minecraft with the selected version and options in a separate thread
            try:
                minecraft_command = minecraft_launcher_lib.command.get_minecraft_command(version, minecraft_directory, options)

                self.worker = CommandWorker(minecraft_command)
                self.worker.signals.output.connect(self.handle_output)
                self.worker.signals.error.connect(self.on_minecraft_error)
                self.worker.signals.finished.connect(self.on_minecraft_finished)
                QThreadPool.globalInstance().start(self.worker)

            except Exception as e:
                messagebox.showerror("Error", f"Could not start Minecraft: {e}")
                self.enable_buttons()

    def handle_output(self, output):
        self.console_output.append(output)
        # Scroll to the bottom of the console
        self.console_output.verticalScrollBar().setValue(self.console_output.verticalScrollBar().maximum())
    
    def on_installation_finished(self):
        self.enable_buttons()

    def on_installation_error(self, error_message):
        # Create the log file
        write_log(error_message, "installation_error")

    def on_minecraft_finished(self):
        self.enable_buttons()

    def on_minecraft_error(self, error_message):
        # Create the log file
        write_log(error_message, "minecraft_startup")
        
        # Enable the buttons
        self.enable_buttons()

    def enable_buttons(self):
        self.btn_minecraft.setEnabled(True)
        self.btn_fabric.setEnabled(True)
        self.btn_forge.setEnabled(True)
        self.btn_play.setEnabled(True)
        self.btn_account.setEnabled(True)
        self.btn_mod_manger.setEnabled(True)
        self.lineEdit.setEnabled(True)
        self.comboBox.setEnabled(True)

    # Function to start the installation of the versions in a separate thread with worker
    def start_installation(self, install_function, version, loader=None):
        # Clear the console output
        self.console_output.clear()
        # Create the worker
        worker = FunctionWorker(install_function, version, loader)
        worker.signals.output.connect(self.handle_output)
        worker.signals.error.connect(self.on_installation_error)
        worker.signals.finished.connect(self.on_installation_finished)
        QThreadPool.globalInstance().start(worker)

    # Function to run the installation of the versions of Minecraft
    def install_normal_versions(self):
        global show_snapshots
        self.save_data()
        if not versions:
            QMessageBox.critical(None, "Error", lang(system_lang, "no_internet"))
            return
        # Create the window
        window_versions = QDialog()
        window_versions.setWindowTitle(f"{lang(system_lang, 'install')} Minecraft")
        window_versions.setFixedSize(300, 150)
        window_versions.setWindowFlags(window_versions.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        window_versions.setWindowIcon(QIcon(icon))
        window_versions.setStyleSheet("background-color: rgb(45, 55, 65);")
        # Place the window in the center of the screen
        window_width = window_versions.width()
        window_height = window_versions.height()
        position_right = int(window_versions.screen().geometry().width() / 2 - window_width / 2)
        position_down = int(window_versions.screen().geometry().height() / 2 - window_height / 2)
        window_versions.move(position_right, position_down)

        # Verify if the snapshots are shown
        if show_snapshots == 1:
            vers = all_versions[0]
            versions_list = all_versions
        else:
            vers = releases[0]
            versions_list = releases

        # Create the layout
        layout = QVBoxLayout()

        # Create the background label
        bg_label = QLabel(window_versions)
        bg_label.setPixmap(QPixmap(f'{bg_path}').scaled(window_versions.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))
        bg_label.setGeometry(0, 0, window_width, window_height)

        # Apply blur effect to the background label
        blur_effect = QGraphicsBlurEffect()
        blur_effect.setBlurRadius(bg_blur)
        bg_label.setGraphicsEffect(blur_effect)

        bg_label_2 = QLabel(window_versions)
        bg_label_2.setStyleSheet("background-color: rgba(0, 0, 0, 0.4);")
        bg_label_2.setGeometry(0, 0, window_width, window_height)

        # Label with the information
        info_label = QLabel(lang(system_lang, "info_label_minecraft"))
        info_label.setStyleSheet("background-color: transparent; color: white;")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Create the dropdown
        versions_drop = QComboBox()
        for i in versions_list:
            versions_drop.addItem(QIcon(variables.minecraft_icon), i)
        versions_drop.setCurrentText(vers)
        versions_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px; font-size: 12px;")
        versions_drop.setMaxVisibleItems(10)
        layout.addWidget(versions_drop)

        # Create the install button
        bt_install_versions = QPushButton(lang(system_lang, "install"))
        bt_install_versions.setStyleSheet("""
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6);
                color: #ffffff; 
                border-radius: 5px;
                min-height: 30px;
            }
            QPushButton:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
        """)
        bt_install_versions.clicked.connect(lambda: [window_versions.accept(), self.start_installation(self.install_minecraft, versions_drop.currentText())])
        layout.addWidget(bt_install_versions)

        # Execute the window
        window_versions.setLayout(layout)
        window_versions.exec_()

    # Function to install the versions of fabric
    def install_fabric_versions(self):
        global show_snapshots
        self.save_data()
        if not versions:
            QMessageBox.critical(None, "Error", lang(system_lang,"no_internet"))
            return
        # Create the window
        window_versions = QDialog()
        window_versions.setWindowTitle(f"{lang(system_lang,'install')} Fabric")
        window_versions.setFixedSize(300, 200)
        window_versions.setWindowFlags(window_versions.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        window_versions.setWindowIcon(QIcon(icon))
        window_versions.setStyleSheet("background-color: rgb(45, 55, 65);")

        # Center the window on the screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = window_versions.width()
        window_height = window_versions.height()
        position_right = int(screen_geometry.width()/2 - window_width/2)
        position_down = int(screen_geometry.height()/2 - window_height/2)
        window_versions.move(position_right, position_down)

        # Determine the version list to display
        if show_snapshots == 1:
            vers = fabric_all[0]
            versions_list = fabric_all
        else:
            vers = fabric_releases[0]
            versions_list = fabric_releases

        # Create the layout
        layout = QVBoxLayout()

        # Create the background label
        bg_label = QLabel(window_versions)
        bg_label.setPixmap(QPixmap(f'{bg_path}').scaled(window_versions.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))
        bg_label.setGeometry(0, 0, window_width, window_height)

        # Apply blur effect to the background label
        blur_effect = QGraphicsBlurEffect()
        blur_effect.setBlurRadius(bg_blur)
        bg_label.setGraphicsEffect(blur_effect)

        bg_label_2 = QLabel(window_versions)
        bg_label_2.setStyleSheet("background-color: rgba(0, 0, 0, 0.4);")
        bg_label_2.setGeometry(0, 0, window_width, window_height)

        # Label with the information
        info_label = QLabel(lang(system_lang,"info_label_loader"))
        info_label.setStyleSheet("background-color: transparent; color: white;")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Create the dropdown for the versions
        versions_drop = QComboBox()
        for i in versions_list:
            versions_drop.addItem(QIcon(variables.minecraft_icon), i)
        #versions_drop.addItems(versions_list)
        versions_drop.setCurrentText(vers)
        versions_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px; font-size: 12px;")
        versions_drop.setMaxVisibleItems(10)
        layout.addWidget(versions_drop)

        # Create the label for the loader
        loader_label = QLabel(lang(system_lang,"loader_label"))
        loader_label.setStyleSheet("background-color: transparent; color: white;")
        loader_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(loader_label)

        # Create the dropdown for the loader
        loader_drop = QComboBox()
        #loader_drop.addItems(fabric_loader)
        for i in fabric_loader:
            loader_drop.addItem(QIcon(variables.fabric_icon), i)
        loader_drop.setCurrentText(fabric_loader[0])
        loader_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px;")
        loader_drop.setMaxVisibleItems(10)
        layout.addWidget(loader_drop)

        # Create the install button
        bt_install_fabric = QPushButton(lang(system_lang,"install"))
        bt_install_fabric.setStyleSheet("""
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6);
                color: #ffffff; 
                border-radius: 5px;
                min-height: 30px;
            }
            QPushButton:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
        """)
        bt_install_fabric.clicked.connect(lambda: [window_versions.accept(), self.start_installation(self.install_fabric, versions_drop.currentText(), loader_drop.currentText())])
        layout.addWidget(bt_install_fabric)

        # Execute the window
        window_versions.setLayout(layout)
        window_versions.exec_()

    # Function to install the forge versions
    def install_forge_versions(self):
        global show_snapshots
        self.save_data()
        if not forge_versions:
            QMessageBox.critical(None, "Error", lang(system_lang,"no_internet"))
            return# Create the window
        window_versions = QDialog()
        window_versions.setWindowTitle(f"{lang(system_lang,'install')} Forge")
        window_versions.setFixedSize(300, 200)
        window_versions.setWindowFlags(window_versions.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        window_versions.setWindowIcon(QIcon(icon))
        window_versions.setStyleSheet("background-color: rgb(45, 55, 65);")

        # Center the window on the screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = window_versions.width()
        window_height = window_versions.height()
        position_right = int(screen_geometry.width()/2 - window_width/2)
        position_down = int(screen_geometry.height()/2 - window_height/2)
        window_versions.move(position_right, position_down)
        
        # Create the layout
        layout = QVBoxLayout()

        # Create the background label
        bg_label = QLabel(window_versions)
        bg_label.setPixmap(QPixmap(f'{bg_path}').scaled(window_versions.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))
        bg_label.setGeometry(0, 0, window_width, window_height)

        # Apply blur effect to the background label
        blur_effect = QGraphicsBlurEffect()
        blur_effect.setBlurRadius(bg_blur)
        bg_label.setGraphicsEffect(blur_effect)

        bg_label_2 = QLabel(window_versions)
        bg_label_2.setStyleSheet("background-color: rgba(0, 0, 0, 0.4);")
        bg_label_2.setGeometry(0, 0, window_width, window_height)

        # Forge label
        info_label = QLabel(lang(system_lang,"info_label_loader").replace("Fabric", "Forge"))
        info_label.setStyleSheet("background-color: transparent; color: white;")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Obtain the latest version of Forge
        response = requests.get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")
        forge_latest = response.json()
        keys = list(forge_latest["promos"].keys())
        last_key = keys[-2]
        last_value = forge_latest["promos"][last_key]
        result = last_key.split('-')[0] + '-' + last_value

        # Determine the version list to display
        if result in forge_all:
            vers = result
            versions_list = forge_all
        else:
            vers = forge_all[0]
            versions_list = forge_all

        # Create the dropdown
        versions_drop = QComboBox()
        for i in forge_versions:
            versions_drop.addItem(QIcon(variables.forge_icon), i)
        #versions_drop.addItems(versions_list)
        versions_drop.setCurrentText(vers)
        versions_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px; font-size: 12px;")
        versions_drop.setMaxVisibleItems(10)
        layout.addWidget(versions_drop)

        # Create the install button
        bt_install_forge = QPushButton(lang(system_lang,"install"))
        bt_install_forge.setStyleSheet("""
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6);
                color: #ffffff; 
                border-radius: 5px;
                min-height: 30px;
            }
            QPushButton:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
        """)
        bt_install_forge.clicked.connect(lambda: [window_versions.accept(), self.start_installation(self.install_forge, versions_drop.currentText())])
        layout.addWidget(bt_install_forge)

        # Execute the window
        window_versions.setLayout(layout)
        window_versions.exec_()

    def set_language(self, new_lang):
    # Set the new language
        global system_lang, user_name, access_token
        system_lang = new_lang
        if access_token != "":
            self.label.setText(f"{lang(system_lang,'logged_as')} {user_name}")
            self.btn_account.setText(lang(system_lang,"logout_microsoft"))
        else:
            self.label.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"label_username"), None))
            self.btn_account.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"login_microsoft"), None))
        self.lineEdit.setPlaceholderText(lang(system_lang,"user_placeholder"))
        self.btn_minecraft.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_install_minecraft"), None))
        self.btn_fabric.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_install_loader"), None))
        self.btn_forge.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_install_loader").replace("Fabric", "Forge"), None))
        self.btn_settings.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"settings"), None))
        self.btn_play.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_play"), None))
        self.btn_mod_manger.setText(QCoreApplication.translate("MainWindow", lang(system_lang,"btn_mod_manager"), None))
        

    def settings_window(self):
        global show_snapshots
        # Create the window
        window_settings = QDialog()
        window_settings.setWindowTitle(lang(system_lang, "settings"))
        window_settings.setFixedSize(500, 450)
        window_settings.setWindowFlags(window_settings.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        window_settings.setWindowIcon(QIcon(icon))
        window_settings.setStyleSheet("background-color: rgb(45, 55, 65); border-radius: 10px;")

        # Center the window on the screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = window_settings.width()
        window_height = window_settings.height()
        position_right = int(screen_geometry.width()/2 - window_width/2)
        position_down = int(screen_geometry.height()/2 - window_height/2)
        window_settings.move(position_right, position_down)

        # Create the layout
        layout = QVBoxLayout()
        layout.setAlignment(Qt.AlignHCenter)
        layout.setSpacing(10)  # Add spacing between elements
        layout.setContentsMargins(10, 10, 10, 10)  # Add margins around the layout

        # Create the background label
        bg_label = QLabel(window_settings)
        bg_label.setPixmap(QPixmap(f'{bg_path}').scaled(window_settings.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))
        bg_label.setGeometry(0, 0, window_width, window_height)

        # Apply blur effect to the background label
        blur_effect = QGraphicsBlurEffect()
        blur_effect.setBlurRadius(bg_blur)
        bg_label.setGraphicsEffect(blur_effect)

        # Create a group box for JVM settings
        jvm_group = QGroupBox()
        jvm_group.setStyleSheet("background-color: rgba(0, 0, 0, 0.3); border-radius: 10px;")
        jvm_group.setMaximumHeight(100)
        jvm_layout = QVBoxLayout()

        # Create the label for the JVM arguments
        label_jvm_arguments = QLabel(lang(system_lang, "label_jvm_args"))
        label_jvm_arguments.setStyleSheet("color: white; font-size: 12px; background-color: transparent;")
        label_jvm_arguments.setAlignment(Qt.AlignCenter)
        label_jvm_arguments.setWordWrap(True)
        jvm_layout.addWidget(label_jvm_arguments)

        # Create the tip label
        label_tip = QLabel(lang(system_lang, "jvm_tip"))
        label_tip.setStyleSheet("color: yellow; font-size: 12px; background-color: transparent;")
        label_tip.setAlignment(Qt.AlignCenter)
        label_tip.setWordWrap(True)
        jvm_layout.addWidget(label_tip)

        # Create the entry for the JVM arguments
        entry_jvm_arguments = QLineEdit()
        entry_jvm_arguments.setPlaceholderText("JVM arguments (-Xms512M -Xmx8G ...)")
        entry_jvm_arguments.setStyleSheet("""
            color: white; 
            background-color: rgba("""f'{bg_color}'""", 0.6);
            border-radius: 5px; 
            padding: 5px;
        """)
        if jvm_arguments != "" and jvm_arguments != variables.defaultJVM:
            entry_jvm_arguments.setText(" ".join(jvm_arguments))
        jvm_layout.addWidget(entry_jvm_arguments)

        # Add JVM settings layout to the group box
        jvm_group.setLayout(jvm_layout)
        layout.addWidget(jvm_group)
        
        lang_combobox = QComboBox()
        # Set lang_combobox to expand horizontally and have a fixed height
        lang_combobox.setFixedHeight(30)
        lang_combobox.setSizePolicy(QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed))
        available_langs = lang(system_lang, "available_languages")
        for key, value in available_langs.items():
            lang_combobox.addItem(value, key)
        lang_combobox.setStyleSheet("""
            QComboBox {
                background-color: rgba("""f'{bg_color}'""", 0.5); 
                color: #ffffff; 
                border-radius: 5px;
                font-size: 12px;
            }
            QComboBox:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
            QComboBox QAbstractItemView {
                background-color: rgba("""f'{bg_color}'""", 0.5); 
                color: #ffffff; 
                border-radius: 5px;
            }
        """)
        lang_combobox.setCurrentText(available_langs[system_lang])
        lang_combobox.setMaxVisibleItems(10)

        # Language selection as horizontal layout
        horizontal_layout = QHBoxLayout()
        label_lang = QLabel(lang(system_lang, "language"))
        label_lang.setStyleSheet("color: white; font-size: 14px; background-color: transparent;")
        horizontal_layout.addWidget(label_lang)

        horizontal_layout.addWidget(lang_combobox)
        layout.addLayout(horizontal_layout)

        # Checkbox style
        checkbox_style = f"""
            QCheckBox {{
                background-color: rgba({bg_color}, 0.5);
                color: #ffffff;
                font-size: 14px;
                font-weight: bold;
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
        """

        # Show snapshot versions Checkbox
        snapshots_checkbox = QCheckBox(lang(system_lang, "checkbox_snapshots"))
        snapshots_checkbox.setStyleSheet(checkbox_style)
        snapshots_checkbox.setChecked(show_snapshots)
        snapshots_checkbox.clicked.connect(lambda: [self.toggle_snapshots(), self.save_data()])
        layout.addWidget(snapshots_checkbox)

        # Discord Rich Presence Checkbox
        discord_checkbox = QCheckBox(lang(system_lang, "discord_rpc"))
        discord_checkbox.setStyleSheet(checkbox_style)
        discord_checkbox.clicked.connect(lambda: [discord_controller(), self.update_error_discord(), self.save_data()])
        discord_checkbox.setChecked(discord_rpc == True)
        layout.addWidget(discord_checkbox)

        # Ask for updates Checkbox
        ask_update_checkbox = QCheckBox(lang(system_lang, "ask_update"))
        ask_update_checkbox.setStyleSheet(checkbox_style)
        ask_update_checkbox.setChecked(ask_update == "yes")
        ask_update_checkbox.clicked.connect(lambda: [ask_update_controller(), self.save_data()])
        layout.addWidget(ask_update_checkbox)
        
        def set_lang():
            global system_lang
            new_lang = lang_combobox.currentData()
            system_lang = new_lang
            config_path = os.path.join(app_dir, 'config/config.json')
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            
            # Read the configuration file
            if os.path.exists(config_path):
                with open(config_path, 'r') as f:
                    try:
                        config = json.load(f)
                    except json.JSONDecodeError:
                        config = {"first_time": False, "lang": "en"}
            else:
                config = {"first_time": False, "lang": "en"}
            
            # Update the language in the configuration file
            config["lang"] = new_lang

            # Set the language in the application
            self.set_language(new_lang)

            # Set the language in the settings window
            window_settings.setWindowTitle(lang(new_lang, "settings"))
            label_jvm_arguments.setText(lang(new_lang, "label_jvm_args"))
            label_tip.setText(lang(new_lang, "jvm_tip"))
            snapshots_checkbox.setText(lang(new_lang, "checkbox_snapshots"))
            discord_checkbox.setText(lang(new_lang, "discord_rpc"))
            ask_update_checkbox.setText(lang(new_lang, "ask_update"))
            label_lang.setText(lang(new_lang, "language"))
            bt_save.setText(lang(new_lang, "save"))
            bt_open_minecraft.setText(lang(new_lang, "open_minecraft_directory"))
            bt_open_launcher.setText(lang(new_lang, "open_launcher_directory"))
            bt_open_themes.setText(lang(new_lang, "open_website"))
            
            # Temporarily disconnect the signal to avoid recursion
            lang_combobox.blockSignals(True)
            lang_combobox.clear()
            available_langs = lang(new_lang, "available_languages")
            for key, value in available_langs.items():
                lang_combobox.addItem(value, key)
            lang_combobox.setCurrentText(available_langs[system_lang])
            lang_combobox.blockSignals(False)

            # Write the configuration file
            with open(config_path, 'w') as f:
                json.dump(config, f, indent=4)

        # Connect the combobox to the function
        lang_combobox.currentIndexChanged.connect(set_lang)

        def set_jvm():
            global jvm_arguments
            entry_value = entry_jvm_arguments.text().strip()
            if entry_value != "" and not re.match("^-*$", entry_value):
                jvm_arguments = entry_value.split()
                # Filter the arguments
                jvm_arguments = [arg.replace("\n", "") for arg in jvm_arguments if arg.strip() not in ["", "-"] and not re.match("^-*$", arg)]
                # If jvm_arguments is empty after filtering, assign defaultJVM
                if not jvm_arguments:
                    jvm_arguments = variables.defaultJVM
            else:
                jvm_arguments = variables.defaultJVM

        # Save button
        bt_save = QPushButton(lang(system_lang, "save"))
        bt_save.setFixedSize(480, 30)
        bt_save.setStyleSheet(self.bt_style)
        bt_save.clicked.connect(lambda: [set_jvm(), self.save_data(), window_settings.accept()])
        layout.addWidget(bt_save)

        bt_open_minecraft = QPushButton(lang(system_lang, "open_minecraft_directory"))
        bt_open_minecraft.setFixedSize(480, 30)
        bt_open_minecraft.setStyleSheet(self.bt_style)
        bt_open_minecraft.clicked.connect(open_minecraft_dir)
        layout.addWidget(bt_open_minecraft)

        bt_open_launcher = QPushButton(lang(system_lang, "open_launcher_directory"))
        bt_open_launcher.setFixedSize(480, 30)
        bt_open_launcher.setStyleSheet(self.bt_style)
        bt_open_launcher.clicked.connect(open_launcher_dir)
        layout.addWidget(bt_open_launcher)

        bt_open_themes = QPushButton(lang(system_lang, "open_website"))
        bt_open_themes.setFixedSize(480, 30)
        bt_open_themes.setStyleSheet(self.bt_style)
        bt_open_themes.clicked.connect(open_website)
        layout.addWidget(bt_open_themes)

        # Configure the layout
        window_settings.setLayout(layout)
        window_settings.exec_()
    
    # Function to open the mod manager (currently disabled and replaced by opening the mods directory)
    def open_mod_manager(self):
        show_mod_manager(bg_color, icon, bg_path, bg_blur, system_lang)

    def get_started(self):
        # Create the window
        window_get_started = QDialog()
        window_get_started.setWindowTitle(lang(system_lang,"get_started"))
        window_get_started.setFixedSize(800, 600)
        window_get_started.setWindowFlags(window_get_started.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        window_get_started.setWindowIcon(QIcon(icon))
        window_get_started.setStyleSheet("background-color: rgb(45, 55, 65);")

        # Center the window on the screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = window_get_started.width()
        window_height = window_get_started.height()
        position_right = int(screen_geometry.width()/2 - window_width/2)
        position_down = int(screen_geometry.height()/2 - window_height/2)
        window_get_started.move(position_right, position_down)

        # Create the layout
        layout = QVBoxLayout()
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)

        # Create the background label
        bg_label = QLabel(window_get_started)
        bg_label.setPixmap(QPixmap(f'{bg_path}').scaled(window_get_started.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation))
        bg_label.setGeometry(0, 0, window_width, window_height)

        # Apply blur effect to the background label
        blur_effect = QGraphicsBlurEffect()
        blur_effect.setBlurRadius(bg_blur)
        bg_label.setGraphicsEffect(blur_effect)

        bg_label_2 = QLabel(window_get_started)
        bg_label_2.setStyleSheet("background-color: rgba(0, 0, 0, 0.4);")
        bg_label_2.setGeometry(0, 0, window_width, window_height)

        # Create the labels
        welcome_label = QLabel(lang(system_lang,"welcome"))
        welcome_label.setStyleSheet("color: white; font-size: 16px; background-color: transparent;")
        welcome_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(welcome_label)

        # Add welcome message and launcher information
        welcome_message = lang(system_lang,"welcome_message")
        welcome_label = QLabel(welcome_message)
        welcome_label.setStyleSheet("color: white; font-size: 14px; background-color: transparent;")
        welcome_label.setAlignment(Qt.AlignLeft)
        welcome_label.setWordWrap(True)
        welcome_label.setOpenExternalLinks(False)
        welcome_label.setTextInteractionFlags(Qt.TextBrowserInteraction)
        layout.addWidget(welcome_label)

        # Connect the links to the website
        welcome_label.linkActivated.connect(lambda link: webbrowser.open(link))

        # Create the bottom layout
        bottom_layout = QHBoxLayout()
        bottom_layout.setAlignment(Qt.AlignCenter)

        # Create the checkbox to not show the window again
        gs_checkbox = QCheckBox(lang(system_lang,"dont_show_again"))
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

        # Function to close the window
        def close_window():
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

        # Create the close button
        bt_close = QPushButton(lang(system_lang,"close"))
        bt_close.setFixedSize(100, 30)
        bt_close.setStyleSheet(self.bt_style)
        bt_close.clicked.connect(close_window)
        bottom_layout.addWidget(gs_checkbox)
        bottom_layout.addWidget(bt_close)

        # Add the bottom layout to the main layout
        layout.addLayout(bottom_layout)

        window_get_started.setLayout(layout)

        # Show the window
        window_get_started.exec_()

class MainWindow(QMainWindow, Ui_MainWindow):
    def __init__(self):
        super().__init__()
        self.setupUi(self)
        # Center the window on the screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = self.width()
        window_height = self.height()
        position_right = int(screen_geometry.width() / 2 - window_width / 2)
        position_down = int(screen_geometry.height() / 2 - window_height / 2)
        self.move(position_right, position_down)
        # Ensure console_output is a QTextEdit
        if not isinstance(self.console_output, QTextEdit):
            raise TypeError("console_output must be a QTextEdit")

        # Redirect the standard output to the QTextEdit widget
        sys.stdout = StdoutRedirector(self.console_output)
        self.update_error_discord()

class LoadingScreen(QSplashScreen):
    def __init__(self):
        super().__init__(QPixmap(variables.splash_screen))
        self.setWindowFlag(Qt.FramelessWindowHint)

        # Center the splash screen on the screen
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        self.move(
            int(screen_geometry.width() / 2 - self.width() / 2),
            int(screen_geometry.height() / 2 - self.height() / 2)
        )

class MainWindowLoader(QThread):
    finished = pyqtSignal()

    def run(self):
        self.finished.emit() # Emit the finished signal

def initialize_main_window(loading_screen):
    # Create the main window
    window = MainWindow()
    loading_screen.loader_thread = MainWindowLoader() # Save the loader thread as an attribute
    loading_screen.loader_thread.finished.connect(lambda: show_main_window(loading_screen, window)) # Connect the finished signal to show_main_window
    loading_screen.loader_thread.start() # Start the loader thread
    return window

def show_main_window(loading_screen, window):
    if sys.platform == "linux":
        time.sleep(2)  # Add delay to ensure splash screen is visible on Linux
    loading_screen.close() # Close the splash screen
    window.show() # Show the main window

if __name__ == "__main__":
    app = QApplication(sys.argv)

    try:
        app.setStyle("Windows")
    except:
        pass

    # Create the loading screen and show it
    loading_screen = LoadingScreen()
    loading_screen.show()

    # Initialize the main window in a separate thread
    window = initialize_main_window(loading_screen)

    # Ensure the loading screen is visible while the main window is being initialized
    while loading_screen.isVisible():
        app.processEvents() # Process events to keep the application responsive

    # Load configuration and show the main window
    config_path = os.path.join(app_dir, 'config/config.json').replace('\\', '/')
    if not os.path.exists(config_path):
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, 'w') as f:
            json.dump({"first_time": True, "lang": current_language}, f)
        window.get_started()
    else:
        with open(config_path, 'r') as f:
            try:
                data = json.load(f)
                if data.get("first_time", True):
                    window.get_started()
                if data.get("lang", ""):
                    change_language(data["lang"])
                    system_lang = data["lang"]
                else:
                    change_language("en")
                    system_lang = "en"
            except json.JSONDecodeError:
                with open(config_path, 'w') as f:
                    json.dump({"first_time": True, "lang": "en"}, f)
                change_language("en")
                system_lang = "en"
                window.get_started()
    window.show() # Show the window
    window.update_error_discord() # Update the discord error label
    sys.exit(app.exec_()) # When the application is closed, exit the application

# Hello, idk what to put here but I'm going to put it anyway :D

# I'm not sure what i'm doing anymore, but I'm going to keep going (maybe XD)
# I'm going to put a lot of comments here, I don't know why, but I'm going to do it anyway
# I hate you Qt, I hate you so much, but I love you at the same time <3
# and you too threadings