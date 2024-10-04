import re, time, subprocess, random, atexit, minecraft_launcher_lib
import json, os, sys, uuid, webbrowser, requests, threading
from PyQt5 import QtCore
from PyQt5.QtWidgets import (QMainWindow, QPushButton, QVBoxLayout, QWidget, QPushButton, 
                             QVBoxLayout, QLineEdit, QLabel, QComboBox, QHBoxLayout, QWidget, 
                             QGridLayout, QSpacerItem, QSizePolicy, QCheckBox, QTextEdit, 
                             QProgressBar, QApplication, QMessageBox,
                             QDialog)
from PyQt5.QtCore import QSize, Qt, QCoreApplication, QMetaObject, QRunnable, pyqtSlot, QThreadPool
from PyQt5.QtGui import QTextCursor, QIcon
from tkinter import messagebox
from pypresence import Presence
import variables
from updater import update

# I have been working on this for idk how long, i stopped counting the hours long ago
# When i fix a bug, another one appears, and when i fix that one, another four appear
# Functions that worked perfectly before, suddenly stop working and i have to rewrite them
# I considerate to rewrite the whole code from scratch, but i don't tink it will be worth it
# If someone wants to rewrite this, feel free to do it, i will not try to refactor this again
# I will keep making updates, but i'm not sure if i will be able to fix all the bugs someday
# The code is a mess, but hey, it works, and that's what matters XD

# Class to run a function in a separate thread 
# (idk why but it doesn't work with threading.Thread and i had to use QRunnable,
# I really don't know what's exactly happening here, but it works, so i will keep it like that)
class Worker(QRunnable):
    def __init__(self, fn, *args, **kwargs):
        super(Worker, self).__init__()
        self.fn = fn
        self.args = args
        self.kwargs = kwargs

    @pyqtSlot()
    def run(self):
        self.fn(*self.args, **self.kwargs)

# Check for updates and update the launcher if necessary
update()

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
        discord_error = f"Could not connect to Discord Rich Presence, ensure that Discord is running"

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

# if the Discord Rich Presence is enabled, clean up the connection when the application is closed
if discord_rpc:
    atexit.register(cleanup)

minecraft_directory = variables.minecraft_directory
app_dir = variables.app_directory
plugin_dir = variables.plugins_directory

# Function to open the plugins website
def open_plugins_website():
    webbrowser.open(os.path.join(variables.website_url, "plugins"))

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
            print("Opening directory on Windows")
            subprocess.Popen(['explorer', app_dir])
        elif sys.platform == "linux":
            subprocess.Popen(['gio', 'open',  app_dir])
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
            subprocess.Popen(['gio', 'open',  minecraft_directory])
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
    global bg_path, bg_color, icon
    
    # Dictionary with the default paths
    default_paths = {
        'bg_path': variables.bg_path,
        'icon': variables.icon,
        'bg_color': variables.bg_color
    }
    
    # Update the paths
    for key in default_paths:
        if key in theme:
            if key == 'bg_color':
                globals()[key] = theme[key]
            else:
                globals()[key] = os.path.join(plugin_dir, theme['folder'], theme[key]).replace("\\", "/")
        else:
            globals()[key] = default_paths[key]
        # print(f"{key}: {globals()[key]}")
        
# Check if there is more than one theme
if len(themes) == 0: 
    # Load the default theme
    bg_path = variables.bg_path
    icon = variables.icon
    bg_color = variables.bg_color
elif len(themes) > 1:
    if messagebox.askyesno("Multiple themes found", "Multiple themes found. Do you want to open the app directory to remove the extra themes?"):
        open_launcher_dir()
        sys.exit()
    else:
        messagebox.showinfo("Info", "The first theme found will be loaded.")
    # Load the first theme
    apply_theme(themes[0])
elif len(themes) == 1:
    apply_theme(themes[0])

# Load the versions
try:
    versions = minecraft_launcher_lib.utils.get_version_list()
    forge_versions = minecraft_launcher_lib.forge.list_forge_versions()
    fabric_versions = minecraft_launcher_lib.fabric.get_all_minecraft_versions()
except Exception as e:
    versions = list()
    forge_versions = list()
    fabric_versions = list()

# Create lists to store the versions
all_versions = list()
releases = list()
snapshots = list()
fabric_releases = list()
fabric_all = list()
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
    
for i in forge_versions:
    forge_all.append(i)


# Create a class to redirect the standard output to the QTextEdit widget
class StdoutRedirector:
    def __init__(self, console_output):
        self.text_widget = console_output

    def write(self, string):
        self.text_widget.moveCursor(QTextCursor.End)
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
        self.gridLayout = QGridLayout(self.centralwidget)
        self.gridLayout.setObjectName(u"gridLayout")
        self.verticalLayout_3 = QVBoxLayout()
        self.verticalLayout_3.setObjectName(u"verticalLayout_3")
        self.discord_e = QLabel(self.centralwidget)
        self.discord_e.setObjectName(u"discord_e")
        self.discord_e.setText(discord_error)
        self.discord_e.setStyleSheet("color: #ff0000; background-color: transparent; font-weight: bold; font-size: 12px;")
        self.discord_e.setAlignment(Qt.AlignCenter)
        self.verticalLayout_3.addWidget(self.discord_e)

        self.horizontalLayout_3 = QHBoxLayout()
        self.horizontalLayout_3.setObjectName(u"horizontalLayout_3")
        self.verticalLayout_2 = QVBoxLayout()
        self.verticalLayout_2.setObjectName(u"verticalLayout_2")
        self.horizontalLayout_2 = QHBoxLayout()
        self.horizontalLayout_2.setObjectName(u"horizontalLayout_2")
        self.label = QLabel(self.centralwidget)
        self.label.setObjectName(u"label")
        self.horizontalLayout_2.addWidget(self.label)

        self.lineEdit = QLineEdit(self.centralwidget)
        self.lineEdit.setObjectName(u"lineEdit")
        sizePolicy = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.lineEdit.sizePolicy().hasHeightForWidth())
        self.lineEdit.setSizePolicy(sizePolicy)
        self.lineEdit.setMinimumSize(QSize(200, 0))
        self.lineEdit.setMaximumSize(QSize(200, 16777215))
        self.lineEdit.setPlaceholderText("Enter your username (Steve)")

        self.horizontalLayout_2.addWidget(self.lineEdit)

        self.horizontalSpacer_2 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_2.addItem(self.horizontalSpacer_2)


        self.verticalLayout_2.addLayout(self.horizontalLayout_2)

        self.checkBox = QCheckBox(self.centralwidget)
        self.checkBox.setObjectName(u"checkBox")
        self.verticalLayout_2.addWidget(self.checkBox)

        self.verticalSpacer = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Ignored)

        self.verticalLayout_2.addItem(self.verticalSpacer)


        self.horizontalLayout_3.addLayout(self.verticalLayout_2)

        self.horizontalLayout = QHBoxLayout()
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.horizontalSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout.addItem(self.horizontalSpacer)

        self.verticalLayout = QVBoxLayout()
        self.verticalLayout.setObjectName(u"verticalLayout")
        self.pushButton = QPushButton(self.centralwidget)
        self.pushButton.setObjectName(u"pushButton")
        sizePolicy1 = QSizePolicy(QSizePolicy.MinimumExpanding, QSizePolicy.Fixed)
        sizePolicy1.setHorizontalStretch(0)
        sizePolicy1.setVerticalStretch(0)
        sizePolicy1.setHeightForWidth(self.pushButton.sizePolicy().hasHeightForWidth())
        self.pushButton.setSizePolicy(sizePolicy1)
        self.pushButton.setMinimumSize(QSize(140, 30))

        self.verticalLayout.addWidget(self.pushButton)

        self.pushButton_2 = QPushButton(self.centralwidget)
        self.pushButton_2.setObjectName(u"pushButton_2")
        sizePolicy1.setHeightForWidth(self.pushButton_2.sizePolicy().hasHeightForWidth())
        self.pushButton_2.setSizePolicy(sizePolicy1)
        self.pushButton_2.setMinimumSize(QSize(140, 30))

        self.verticalLayout.addWidget(self.pushButton_2)

        self.pushButton_3 = QPushButton(self.centralwidget)
        self.pushButton_3.setObjectName(u"pushButton_3")
        sizePolicy1.setHeightForWidth(self.pushButton_3.sizePolicy().hasHeightForWidth())
        self.pushButton_3.setSizePolicy(sizePolicy1)
        self.pushButton_3.setMinimumSize(QSize(140, 30))

        self.verticalLayout.addWidget(self.pushButton_3)

        self.verticalSpacer_2 = QSpacerItem(20, 40, QSizePolicy.Minimum, QSizePolicy.Ignored)

        self.verticalLayout.addItem(self.verticalSpacer_2)


        self.horizontalLayout.addLayout(self.verticalLayout)


        self.horizontalLayout_3.addLayout(self.horizontalLayout)


        self.verticalLayout_3.addLayout(self.horizontalLayout_3)

        self.console_output = QTextEdit(self.centralwidget)
        self.console_output.setObjectName(u"console_output")
        sizePolicy2 = QSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        sizePolicy2.setHorizontalStretch(0)
        sizePolicy2.setVerticalStretch(0)
        sizePolicy2.setHeightForWidth(self.console_output.sizePolicy().hasHeightForWidth())
        self.console_output.setSizePolicy(sizePolicy2)
        self.console_output.setMinimumSize(QSize(0, 300))
        self.console_output.setInputMethodHints(Qt.ImhMultiLine|Qt.ImhNoEditMenu)
        self.console_output.setTextInteractionFlags(Qt.TextSelectableByKeyboard|Qt.TextSelectableByMouse)
        self.console_output.setReadOnly(True)

        self.verticalLayout_3.addWidget(self.console_output)

        self.progressBar = QProgressBar(self.centralwidget)
        self.progressBar.setObjectName(u"progressBar")
        self.progressBar.setMaximumSize(QSize(16777215, 15))
        self.progressBar.setValue(0)
        self.progressBar.setTextVisible(True)
        self.progressBar.setVisible(False)

        self.verticalLayout_3.addWidget(self.progressBar)

        self.horizontalLayout_4 = QHBoxLayout()
        self.horizontalLayout_4.setObjectName(u"horizontalLayout_4")
        self.comboBox = QComboBox(self.centralwidget)
        self.comboBox.setObjectName(u"comboBox")
        self.comboBox.setMinimumSize(QSize(140, 30))

        self.horizontalLayout_4.addWidget(self.comboBox)

        self.horizontalSpacer_3 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_4.addItem(self.horizontalSpacer_3)

        self.pushButton_4 = QPushButton(self.centralwidget)
        self.pushButton_4.setObjectName(u"pushButton_4")
        self.pushButton_4.setMinimumSize(QSize(140, 30))

        self.horizontalLayout_4.addWidget(self.pushButton_4)

        self.horizontalSpacer_4 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_4.addItem(self.horizontalSpacer_4)

        self.pushButton_5 = QPushButton(self.centralwidget)
        self.pushButton_5.setObjectName(u"pushButton_5")
        self.pushButton_5.setMinimumSize(QSize(140, 30))

        self.horizontalLayout_4.addWidget(self.pushButton_5)


        self.verticalLayout_3.addLayout(self.horizontalLayout_4)


        self.gridLayout.addLayout(self.verticalLayout_3, 0, 0, 1, 1)

        MainWindow.setCentralWidget(self.centralwidget)

        self.retranslateUi(MainWindow)

        QMetaObject.connectSlotsByName(MainWindow)

        # Establish the style of the widgets
        MainWindow.setStyleSheet("background-color: rgba("f'{bg_color}'", 1);")
        self.centralwidget.setStyleSheet(f"""
            QWidget#centralwidget {{
                border-image: url("{bg_path}");
            }}
        """)
        self.pushButton.setStyleSheet("""
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6); 
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
        """)
        
        self.pushButton_2.setStyleSheet("""
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6); 
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
        """)
        
        self.pushButton_3.setStyleSheet("""
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6);; 
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
        """)
        
        self.pushButton_4.setStyleSheet("""
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
        """)
        
        self.pushButton_5.setStyleSheet("""
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
        """)
        
        self.console_output.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.5); color: #ffffff;")
        self.label.setStyleSheet("background-color: transparent; color: #ffffff;")
        self.lineEdit.setStyleSheet("""
            QLineEdit {
                background-color: rgba("""f'{bg_color}'""", 0.5); 
                color: #ffffff;
            }
            QLineEdit:hover {
                background-color: rgba("""f'{bg_color}'""", 0.8);
            }
            QLineEdit:disabled {
                background-color: rgba(128, 128, 128, 0.6);
                color: #cccccc;
            }
        """)
        self.checkBox.setStyleSheet(f"""
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
                border: 2px solid rgb(255, 255, 255);
                background-color: transparent;
            }}
            QCheckBox::indicator:checked {{
                border-radius: 5px;
                border: 2px solid rgba({bg_color}, 0.5);
                background-color: rgba({bg_color}, 0.5);
            }}
            QCheckBox::indicator:unchecked:hover {{
                border-radius: 5px;
                border: 2px solid rgb({bg_color});
            }}
            QCheckBox::indicator:checked:hover {{
                border-radius: 5px;
                border: 2px solid rgba({bg_color}, 0.8);
                background-color: rgba({bg_color}, 0.8);
            }}
            QCheckBox:disabled {{
                color: #cccccc;
            }}
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
        """)
        self.progressBar.setStyleSheet("""
            QProgressBar {
                background-color: rgba("""f'{bg_color}'""", 0.5);
                color: #ffffff;
                border-radius: 5px;
                text-align: right;
            }
            QProgressBar::chunk {
                background-color: rgb("""f'{bg_color}'""");
                width: 20px;
            }
        """)
        tooltip_stylesheet = "QToolTip { color: #ffffff; background-color: #333333; border: 1px solid white; }"
        QApplication.instance().setStyleSheet(tooltip_stylesheet)

        # Connect the buttons to the functions
        self.pushButton.clicked.connect(self.install_normal_versions)
        self.pushButton_2.clicked.connect(self.install_fabric_versions)
        self.pushButton_3.clicked.connect(self.install_forge_versions)
        self.pushButton_4.clicked.connect(self.settings_window)
        self.pushButton_5.clicked.connect(self.run_minecraft)
        self.checkBox.clicked.connect(self.toggle_snapshots)

        self.update_list_versions()
        global jvm_arguments
        global maximize
        global discord_rpc
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
                if show_snapshots == False:
                    self.checkBox.setChecked(False)
                elif show_snapshots == True:
                    self.checkBox.setChecked(True)
                first_load = True
                if discord_rpc == True and first_load == True:
                    connect_discord()  
                    first_load = False
                if maximize == True:
                    MainWindow.showMaximized()                      
        else:
            user_name = self.lineEdit.text()
            last_version = self.comboBox.currentText()
            show_snapshots = False
            jvm_arguments = variables.defaultJVM
            discord_rpc = False
            ask_update = "yes"
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
                'maximized': self.isMaximized()
            }
            # Save data to a file
            with open(f'{app_dir}/config/user_data.json', 'w') as f:
                json.dump(data, f)
        global user_uuid
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
        MainWindow.setWindowTitle(QCoreApplication.translate("MainWindow", f'OpenLauncher for Minecraft — {variables.launcher_version}', None))
        self.label.setText(QCoreApplication.translate("MainWindow", u"Username: ", None))
        self.checkBox.setText(QCoreApplication.translate("MainWindow", u"Show Snapshots", None))
        self.pushButton.setText(QCoreApplication.translate("MainWindow", u"Install versions", None))
        self.pushButton_2.setText(QCoreApplication.translate("MainWindow", u"Install Fabric", None))
        self.pushButton_3.setText(QCoreApplication.translate("MainWindow", u"Install Forge", None))
        self.pushButton_4.setText(QCoreApplication.translate("MainWindow", u"Settings", None))
        self.pushButton_5.setText(QCoreApplication.translate("MainWindow", u"Play", None))
    # retranslateUi

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
        print(status)

    # Function to set the maximum value of the progress bar
    def set_max(self, new_max: int):
        pass
        """global current_max
        current_max = new_max
        self.progressBar.setValue(0)  # Reset the progress bar
"""
    # Function to update the progress bar
    def set_progress(self, progress_value: int):
        """if current_max != 0:
            progress_percentage = int(progress_value / current_max) * 100
            self.progressBar.setValue(progress_percentage)
"""     
        pass
    # Function to install Minecraft version in a separate thread
    def install_minecraft(self, version):
        if version:
            # Print the version to be installed
            print(f'Version {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
            # Disable the buttons
            self.pushButton.setEnabled(False)
            self.pushButton_2.setEnabled(False)
            self.pushButton_3.setEnabled(False)
            self.pushButton_4.setEnabled(False)
            self.pushButton_5.setEnabled(False)
            self.lineEdit.setEnabled(False)
            self.comboBox.setEnabled(False)
            self.checkBox.setEnabled(False)

            # Install the version
            try:
                callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                }
                minecraft_launcher_lib.install.install_minecraft_version(version, minecraft_directory, callback=callback)
                #print(f'Version {version} has been installed')
                messagebox.showinfo("Success", f'Version {version} has been installed')
            except Exception as e:
                messagebox.showerror("Error", f"Could not install version: {e}")
                print("Error durante la instalación:", e)
                raise
            finally:
                # Enable the buttons
                self.pushButton.setEnabled(True)
                self.pushButton_2.setEnabled(True)
                self.pushButton_3.setEnabled(True)
                self.pushButton_4.setEnabled(True)
                self.pushButton_5.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                self.checkBox.setEnabled(True)
                # Update the list of versions
                self.update_list_versions()
                # Set the selected version
                index = self.comboBox.findText(version, QtCore.Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
                
        else:
            messagebox.showerror("Error", "No version entered")

    # Function to install Fabric in a separate thread
    def install_fabric(self, version):
        if version:
            
            print(f'Fabric for Minecraft {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
            # Disable the buttons
            self.pushButton.setEnabled(False)
            self.pushButton_2.setEnabled(False)
            self.pushButton_3.setEnabled(False)
            self.pushButton_4.setEnabled(False)
            self.pushButton_5.setEnabled(False)
            self.lineEdit.setEnabled(False)
            self.comboBox.setEnabled(False)
            self.checkBox.setEnabled(False)
            try:
                # Verifies that the version of Minecraft is supported by Fabric
                if minecraft_launcher_lib.fabric.is_minecraft_version_supported(version):
                    # Install Fabric
                    callback = {
                    "setStatus": self.set_status,
                    "setProgress": self.set_progress,
                    "setMax": self.set_max
                    }
                    minecraft_launcher_lib.fabric.install_fabric(version, minecraft_directory, callback=callback)
                    print('Fabric installed')
                    messagebox.showinfo("Success", f'Fabric {version} has been installed')
                else:
                    print('No Fabric version found for this version of Minecraft')
                    messagebox.showerror("Error", "No Fabric version found for this version of Minecraft")
            except Exception as e:
                messagebox.showerror("Error", f"Fabric could not be installed: {e}")
            finally:
                # Enable the buttons
                self.pushButton.setEnabled(True)
                self.pushButton_2.setEnabled(True)
                self.pushButton_3.setEnabled(True)
                self.pushButton_4.setEnabled(True)
                self.pushButton_5.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                self.checkBox.setEnabled(True)
                # Update the list of versions
                self.update_list_versions()
                # Set the selected version
                codename = f"fabric-loader-{minecraft_launcher_lib.fabric.get_latest_loader_version()}-{version}"
                print(codename)
                index = self.comboBox.findText(codename, QtCore.Qt.MatchFixedString)
                if index >= 0:
                    self.comboBox.setCurrentIndex(index)
        else:
            messagebox.showerror("Error", "No version entered")
            
    # Function to install Forge in a separate thread
    def install_forge(self, version):
        if version:
            print(f'Forge for Minecraft {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
            # Disable the buttons
            self.pushButton.setEnabled(False)
            self.pushButton_2.setEnabled(False)
            self.pushButton_3.setEnabled(False)
            self.pushButton_4.setEnabled(False)
            self.pushButton_5.setEnabled(False)
            self.lineEdit.setEnabled(False)
            self.comboBox.setEnabled(False)
            self.checkBox.setEnabled(False)

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
                    print('Forge installed')
                    messagebox.showinfo("Success", f'Forge {version} has been installed')
                else:
                    print('No Forge version found for this version of Minecraft')
                    messagebox.showerror("Error", "No Forge version found for this version of Minecraft")
            except Exception as e:
                messagebox.showerror("Error", f"Forge could not be installed: {e}")
            finally:
                # Enable the buttons
                self.pushButton.setEnabled(True)
                self.pushButton_2.setEnabled(True)
                self.pushButton_3.setEnabled(True)
                self.pushButton_4.setEnabled(True)
                self.pushButton_5.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                self.checkBox.setEnabled(True)
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
        else:
            messagebox.showerror("Error", "No version entered")

    # Function to toggle snapshots
    def toggle_snapshots(self):
        global show_snapshots
        if self.checkBox.isChecked():
            show_snapshots = True
        else:
            show_snapshots = False

    # Function to configure the dropdown
    def configure_dropdown(self, vers, installed_versions_list):
        self.comboBox.clear()
        self.comboBox.addItems(installed_versions_list)
        index = self.comboBox.findText(vers, QtCore.Qt.MatchFixedString)
        if index >= 0:
            self.comboBox.setCurrentIndex(index)

    # Function to update the list of versions
    def update_list_versions(self):
        installed_versions = minecraft_launcher_lib.utils.get_installed_versions(minecraft_directory)
        installed_versions_list = [version['id'] for version in installed_versions]

        if len(installed_versions_list) != 0:
            vers = installed_versions_list[0]
        else:
            vers = 'No version installed'
            installed_versions_list.append('No version installed')

        self.configure_dropdown(vers, installed_versions_list)
    
    # Function to save the data
    def save_data(self):
        global jvm_arguments
        if jvm_arguments != "":
            arg = jvm_arguments
        else:
            arg = variables.defaultJVM

        # Save the data to a file
        data = {
            'name': self.lineEdit.text(), # Save the user name
            'toggle_snapshots': self.checkBox.isChecked(),  # save the state of the checkbox
            'jvm_arguments': arg,  # Save the JVM arguments
            'last_version': self.comboBox.currentText(),  # Save the last version used
            'ask_update': variables.ask_update, # Save the state of the checkbox
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
        print(f"UUID: {user_uuid}")

    # Function to check if Java is installed
    def is_java_installed(self):
        try:
            output = subprocess.check_output('java -version', stderr=subprocess.STDOUT, shell=True)
            return 'version' in output.decode('UTF-8').lower()
        except Exception:
            return False

    # Function to run Minecraft
    def run_minecraft(self):
        # Clear the console output
        self.console_output.clear()
        # Check if Java is installed
        if not self.is_java_installed():
            if sys.platform == 'win32':
                if messagebox.askyesno("Error", "Java is not installed. Do you want to open the download page?"):
                    webbrowser.open('https://www.java.com/es/download/')
                else:
                    messagebox.showerror("Java is not installed","It's necessary to install Java to run Minecraft, please install it and restart the launcher")
                    sys.exit() # Close the application
            elif sys.platform == 'linux':
                messagebox.showinfo("Java is not installed", "Please install Java to run Minecraft.\n\nFor example, in Ubuntu you can install it with the command 'sudo apt install default-jre'") 
            return
        
        mine_user = self.lineEdit.text()  
        if not mine_user:
            messagebox.showerror("Error", "Please enter your user name")
            return
        global jvm_arguments
        if not jvm_arguments:
            print("No JVM arguments")
            arg = variables.defaultJVM
        else:
            arg = jvm_arguments
        
        if(user_uuid == ""):
            # Generate a UUID if it does not exist
            self.generate_uuid(mine_user)
        self.save_data()

        # Disable the buttons
        self.pushButton.setEnabled(False)
        self.pushButton_2.setEnabled(False)
        self.pushButton_3.setEnabled(False)
        self.pushButton_4.setEnabled(False)
        self.pushButton_5.setEnabled(False)
        self.lineEdit.setEnabled(False)
        self.comboBox.setEnabled(False)
        self.checkBox.setEnabled(False)

        # Set version to the selected version
        version = self.comboBox.currentText()
        
        # If version is not null then set the options
        if version:
            options = {
                'username': mine_user,
                'uuid': user_uuid,
                'token': '',
                'jvmArguments': arg,
                'launcherName': "OpenLauncher for Minecraft",
                'launcherVersion': variables.launcher_version
            }

            # Start Minecraft with the selected version and options in a separate thread
            try:
                minecraft_command = minecraft_launcher_lib.command.get_minecraft_command(version, minecraft_directory, options)
                
                def run_command(command):
                    try:
                        if sys.platform == 'win32':
                            # Don't show the console window
                            startupinfo = subprocess.STARTUPINFO()
                            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, startupinfo=startupinfo, universal_newlines=True)
                        elif sys.platform == 'linux':
                            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

                        for line in iter(process.stdout.readline, ''):
                            print(line.strip())  # Print the output to the console widget
                        process.stdout.close()
                        process.wait()
                    except Exception as e:
                        messagebox.showerror("Error", f"Could not start Minecraft: {e}")
                    finally:
                        self.progressBar.setValue(0)
                    # Enable the buttons
                    self.pushButton.setEnabled(True)
                    self.pushButton_2.setEnabled(True)
                    self.pushButton_3.setEnabled(True)
                    self.pushButton_4.setEnabled(True)
                    self.pushButton_5.setEnabled(True)
                    self.lineEdit.setEnabled(True)
                    self.comboBox.setEnabled(True)
                    self.checkBox.setEnabled(True)
                # Start the thread to run the command 

                thread = threading.Thread(target=run_command, args=(minecraft_command,))
                thread.start()

            except Exception as e:
                messagebox.showerror("Error", f"Could not start Minecraft: {e}")
                # Enable the buttons
                self.pushButton.setEnabled(True)
                self.pushButton_2.setEnabled(True)
                self.pushButton_3.setEnabled(True)
                self.pushButton_4.setEnabled(True)
                self.pushButton_5.setEnabled(True)
                self.lineEdit.setEnabled(True)
                self.comboBox.setEnabled(True)
                self.checkBox.setEnabled(True)

    # Function to start the installation of the versions in a separate thread
    # It's weird but it works and it's the only way I found to make it work with the QThreadPool
    def start_installation(self, install_function, version):
        worker = Worker(install_function, version)
        QThreadPool.globalInstance().start(worker)

    # Function to run the installation of the versions of Minecraft
    def install_normal_versions(self):
        self.toggle_snapshots()
        self.save_data()
        if not versions:
            QMessageBox.critical(None, "Error", "No internet connection")
            return
        # Create the window
        window_versions = QDialog()
        window_versions.setWindowTitle('Install versions')
        window_versions.setFixedSize(300, 150)
        window_versions.setWindowFlags(window_versions.windowFlags() & ~Qt.WindowContextHelpButtonHint) 
        window_versions.setStyleSheet("background-color: rgb(45, 55, 65);")
        # Place the window in the center of the screen
        window_width = window_versions.width()
        window_height = window_versions.height()
        position_right = int(window_versions.screen().geometry().width()/2 - window_width/2)
        position_down = int(window_versions.screen().geometry().height()/2 - window_height/2)
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

        # Label with the information
        info_label = QLabel("Install the version of Minecraft you want")
        info_label.setStyleSheet("background-color: transparent; color: white;")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Create the dropdown
        versions_drop = QComboBox()
        versions_drop.addItems(versions_list)
        versions_drop.setCurrentText(vers)
        versions_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px;")
        layout.addWidget(versions_drop)

        # Create the install button
        bt_install_versions = QPushButton('Install')
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
        self.toggle_snapshots()
        self.save_data()
        if not versions:
            QMessageBox.critical(None, "Error", "No internet connection")
            return
        # Create the window
        window_versions = QDialog()
        window_versions.setWindowTitle('Install Fabric')
        window_versions.setFixedSize(300, 150)
        window_versions.setWindowFlags(window_versions.windowFlags() & ~Qt.WindowContextHelpButtonHint)
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

        # Label with the information
        info_label = QLabel("Install the latest available version of Fabric for the desired Minecraft version")
        info_label.setStyleSheet("background-color: transparent; color: white;")
        info_label.setAlignment(Qt.AlignCenter)
        info_label.setWordWrap(True)
        layout.addWidget(info_label)

        # Create the dropdown
        versions_drop = QComboBox()
        versions_drop.addItems(versions_list)
        versions_drop.setCurrentText(vers)
        versions_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px;")
        layout.addWidget(versions_drop)

        # Create the install button
        bt_install_fabric = QPushButton('Install')
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
        bt_install_fabric.clicked.connect(lambda: [window_versions.accept(), self.start_installation(self.install_fabric, versions_drop.currentText())])
        layout.addWidget(bt_install_fabric)

        # Execute the window
        window_versions.setLayout(layout)
        window_versions.exec_()

    # Function to install the forge versions
    def install_forge_versions(self):
        self.toggle_snapshots()
        self.save_data()
        if not forge_versions:
            QMessageBox.critical(None, "Error", "No internet connection")
            return# Create the window
        window_versions = QDialog()
        window_versions.setWindowTitle('Install Forge')
        window_versions.setFixedSize(300, 200)
        window_versions.setWindowFlags(window_versions.windowFlags() & ~Qt.WindowContextHelpButtonHint)
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

        # Forge label
        info_label = QLabel("Install the latest available version of Forge for the desired Minecraft version")
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
        versions_drop.addItems(versions_list)
        versions_drop.setCurrentText(vers)
        versions_drop.setStyleSheet("background-color: rgba("f'{bg_color}'", 0.6); color: white; border-radius: 5px; min-height: 30px;")
        layout.addWidget(versions_drop)

        # Create the install button
        bt_install_forge = QPushButton('Install')
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

    def settings_window(self):
        # Crear la ventana
        window_settings = QDialog()
        window_settings.setWindowTitle('Settings')
        window_settings.setFixedSize(350, 350)
        window_settings.setWindowFlags(window_settings.windowFlags() & ~Qt.WindowContextHelpButtonHint)
        window_settings.setStyleSheet("background-color: rgb(45, 55, 65); border-radius: 10px;")

        # Centrar la ventana en la pantalla
        screen_geometry = QApplication.primaryScreen().availableGeometry()
        window_width = window_settings.width()
        window_height = window_settings.height()
        position_right = int(screen_geometry.width()/2 - window_width/2)
        position_down = int(screen_geometry.height()/2 - window_height/2)
        window_settings.move(position_right, position_down)

        # Crear el layout
        layout = QVBoxLayout()
        layout.setAlignment(Qt.AlignHCenter)  # Centrar los widgets
        layout.setSpacing(15)  # Añadir más espacio entre los elementos

        # Crear el label de JVM arguments
        label_jvm_arguments = QLabel("JVM arguments (Expert settings)\nIf nothing is specified, default values will be used.\nDon't use this option if you're unsure.")
        label_jvm_arguments.setStyleSheet("color: white; font-size: 12px;")
        label_jvm_arguments.setAlignment(Qt.AlignCenter)
        label_jvm_arguments.setWordWrap(True)
        layout.addWidget(label_jvm_arguments)

        # Crear label tip
        label_tip = QLabel("Leave blank and save to reset.")
        label_tip.setStyleSheet("color: yellow; font-size: 11px;")
        label_tip.setAlignment(Qt.AlignCenter)
        layout.addWidget(label_tip)

        bt_style = """
            QPushButton {
                background-color: rgba("""f'{bg_color}'""", 0.6);
                color: #ffffff; 
                border-radius: 5px;
                padding: 8px;
            }
            QPushButton:hover {
                background-color: rgba("""f'{bg_color}'""", 1);
            }
        """

        # Crear el campo de entrada para JVM arguments
        entry_jvm_arguments = QLineEdit()
        entry_jvm_arguments.setFixedWidth(300)
        entry_jvm_arguments.setPlaceholderText("JVM arguments (-Xms512M -Xmx8G ...)")
        entry_jvm_arguments.setStyleSheet("""
            color: white; 
            background-color: rgba("""f'{bg_color}'""", 0.6);
            border-radius: 5px; 
            padding: 5px;
        """)
        layout.addWidget(entry_jvm_arguments)

        # Checkbox para Discord
        discord_checkbox = QCheckBox("Enable Discord Rich Presence")
        discord_checkbox.setStyleSheet(f"""
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
                border: 2px solid rgb(255, 255, 255);
                background-color: transparent;
            }}
            QCheckBox::indicator:checked {{
                border-radius: 5px;
                border: 2px solid rgba({bg_color}, 0.5);
                background-color: rgba({bg_color}, 0.5);
            }}
            QCheckBox::indicator:unchecked:hover {{
                border-radius: 5px;
                border: 2px solid rgb({bg_color});
            }}
            QCheckBox::indicator:checked:hover {{
                border-radius: 5px;
                border: 2px solid rgba({bg_color}, 0.8);
                background-color: rgba({bg_color}, 0.8);
            }}
            QCheckBox:disabled {{
                color: #cccccc;
            }}
        """)
        discord_checkbox.clicked.connect(lambda: [discord_controller(), self.update_error_discord(), self.save_data()])
        layout.addWidget(discord_checkbox)

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

        # Botón para guardar la configuración
        bt_save = QPushButton('Save settings')
        bt_save.setFixedWidth(300)
        bt_save.setStyleSheet(bt_style)
        bt_save.clicked.connect(lambda: [set_jvm(), self.save_data(), window_settings.accept()])
        layout.addWidget(bt_save)

        # Botones para abrir directorios
        bt_mine_path = QPushButton('Open game directory')
        bt_mine_path.setFixedWidth(300)
        bt_mine_path.setStyleSheet(bt_style)
        bt_mine_path.clicked.connect(open_minecraft_dir)
        layout.addWidget(bt_mine_path)

        bt_app_path = QPushButton('Open launcher directory')
        bt_app_path.setFixedWidth(300)
        bt_app_path.setStyleSheet(bt_style)
        bt_app_path.clicked.connect(open_launcher_dir)
        layout.addWidget(bt_app_path)

        bt_plugins_path = QPushButton('Open plugins website')
        bt_plugins_path.setFixedWidth(300)
        bt_plugins_path.setStyleSheet(bt_style)
        bt_plugins_path.clicked.connect(open_plugins_website)
        layout.addWidget(bt_plugins_path)

        # Configurar el layout y ejecutar la ventana
        window_settings.setLayout(layout)
        window_settings.exec_()


class MainWindow(QMainWindow, Ui_MainWindow):
    def __init__(self):
        super().__init__()
        self.setupUi(self)
        # Redirect the standard output to the QTextEdit widget
        sys.stdout = StdoutRedirector(self.console_output)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    window = MainWindow()
    window.show()
    window.update_error_discord()
    sys.exit(app.exec_())

# Hello, idk what to put here but I'm going to put it anyway :D

# I'm not sure what i'm doing anymore, but I'm going to keep going (maybe XD)
# I'm going to put a lot of comments here, I don't know why, but I'm going to do it anyway
# I hate you Qt, I hate you so much, but I love you at the same time <3
# and you too threadings