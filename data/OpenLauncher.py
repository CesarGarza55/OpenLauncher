import json
import pathlib
import re
import sys
from tkinter import filedialog, messagebox, ttk
import uuid
import webbrowser
import minecraft_launcher_lib
import os
import subprocess
import customtkinter as ctk
import tkinter as tk
import threading
import requests

# Set the default JVM arguments
# Separate the arguments with a comma ("arg1", "arg2", "arg3")
defaultJVM = ["-Xmx2G", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M"]
jvm_arguments = None

# Debug Mode
debug_mode = False

# Show snapshot versions
show_snapshots = False

# Ask for updates
ask_update = "yes"

# Launcher version
launcher_version = "alpha-0.0.6"

# Set Minecraft directory
if debug_mode:
    # Define a custom Minecraft directory for testing
    if sys.platform == "win32":
        appdata = os.environ["APPDATA"]
        minecraft_directory = os.path.join(appdata, ".launcher")
    elif sys.platform == "linux":
        minecraft_directory = os.path.join(str(pathlib.Path.home()), ".launcher")
else:
    # Gets the default Minecraft directory (.minecraft)
    minecraft_directory = minecraft_launcher_lib.utils.get_minecraft_directory()
script_dir = os.path.dirname(__file__)  # Gets the script directory

# Launcher Update
try:
    update = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest")
    def version_to_tuple(version):
        # Determines whether the version is alpha or beta
        if 'alpha' in version:
            version_type = 0
            version = version.replace('alpha-', '')
        elif 'beta' in version:
            version_type = 1
            version = version.replace('beta-', '')
        else:
            version_type = 2

        # Divide the string into parts
        parts = version.split('.')
        # Converts parts to integers and puts them in a tuple
        return (version_type,) + tuple(map(int, parts))

    # Get the current version and the latest version
    actual_version = version_to_tuple(launcher_version)
    latest_version = version_to_tuple(update.url.split('/').pop())
    latest_name = update.url.split('/').pop()
    # Compare versions
    if latest_version > actual_version:
        if latest_version > actual_version:
            # Check if ask_update is no
            if os.path.exists(f'{minecraft_directory}/launcher_options/user_data.json'):
                with open(f'{minecraft_directory}/launcher_options/user_data.json', 'r') as f:
                    user_data = json.load(f)
                    user_name = user_data.get('name')
                    last_version = user_data.get('last_version')
                    show_snapshots = user_data.get('toggle_snapshots')
                    jvm_arguments = user_data.get('jvm_arguments')
                    ask_update = user_data.get('ask_update')
            if(ask_update != "no"):
                root = tk.Tk()
                root.withdraw()  # Hide the Tkinter window
                if messagebox.askyesno("Update", "A new version is available. Would you like to download it?"):
                    messagebox.showinfo("Download", "Please select the download location.")
                    # Prompt user to select download location
                    download_location = filedialog.askdirectory()
                    if download_location:  # If the user selects a location
                        messagebox.showinfo("Download", "The download is in progress, please wait...")
                        if sys.platform == "win32":
                            r = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.exe", allow_redirects=True)
                            # Save the file to the location selected by the user
                            with open(f'{download_location}/OpenLauncher-{latest_name}.exe', 'wb') as f:
                                f.write(r.content)
                            messagebox.showinfo("Download", "The download has been completed successfully.")
                        elif sys.platform == "linux":
                            r = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.bin", allow_redirects=True)
                            # Save the file to the location selected by the user
                            with open(f'{download_location}/OpenLauncher-{latest_name}.bin', 'wb') as f:
                                f.write(r.content)
                            messagebox.showinfo("Download", "The download has been completed successfully.")
                        # Create the launcher_options directory if it does not exist
                        os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)
                        # Save the data to a file
                        data = {
                            'name': user_name, # Save the user name
                            'toggle_snapshots': show_snapshots,  # save the state of the checkbox
                            'jvm_arguments': jvm_arguments,  # Save the JVM arguments
                            'last_version': last_version,  # Save the last version used
                            'ask_update': ask_update # Save the state of the checkbox
                        }

                        # Create the launcher_options directory if it does not exist
                        os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)

                        # Save the data to a file
                        with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
                            json.dump(data, f)
                        exit()
                else:
                    ask_update = "no"
                    # Create the launcher_options directory if it does not exist
                    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)
                    # Save to file
                    data = {
                        'name': user_name, # Save the user name
                        'toggle_snapshots': show_snapshots,  # save the state of the checkbox
                        'jvm_arguments': jvm_arguments,  # Save the JVM arguments
                        'last_version': last_version,  # Save the last version used
                        'ask_update': ask_update # Save the state of the checkbox
                    }
                    # Save data to a file
                    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
                        json.dump(data, f)
                root.destroy()
except Exception as e:
    print("Error:", e)
        
# Style Settings
ctk.set_appearance_mode("dark")  # Dark mode
ctk.set_default_color_theme("blue")  # Theme color

def close_app():
    window.update_idletasks()
    window.destroy()

def center_window():
    # Update the window to get the correct size
    window.update_idletasks()

    # Calculate the position of the window
    window_width = window.winfo_width()
    window_height = window.winfo_height()
    position_right = int(window.winfo_screenwidth()/2 - window_width/2)
    position_down = int(window.winfo_screenheight()/2 - window_height/2)

    # Position the window in the center of the screen
    window.geometry("+{}+{}".format(position_right, position_down - 16))

# Set the window properties
window = ctk.CTk()
window.geometry('850x500')  # Set the window size
window.title(f'OpenLauncher for Minecraft — {launcher_version}')
window.resizable(False, False)  # Disable resizing

# Center the window
window.after_idle(center_window)

# Create the widgets
bt_run_minecraft = ctk.CTkButton(window, text='Start game', text_color="white", fg_color="#3b82f6")
bt_install_versions = ctk.CTkButton(window, text='Install versions', text_color="white", fg_color="#32a862")
bt_install_forge = ctk.CTkButton(window, text='Install Forge', text_color="white", fg_color="#ef4444")
bt_install_fabric = ctk.CTkButton(window, text='Install Fabric', text_color="white", fg_color="#32a862")
bt_settings = ctk.CTkButton(window, text='Settings', text_color="white", fg_color="#3b82f6")

label_name = ctk.CTkLabel(window, text='User name:', text_color="white", font=("Arial", 12))
entry_name = ctk.CTkEntry(window, placeholder_text="User name (Steve)", width=300)

label_snapshots = ctk.CTkLabel(window, text="Show Snapshots", text_color="white", font=("Arial", 12))
 

# Function to toggle snapshots
def toggle_snapshots():
    global check
    global show_snapshots
    if check.get() == 1:
        show_snapshots = True
    else:
        show_snapshots = False

# Define the checkbox
check = ctk.CTkCheckBox(window, width=30, height=30, fg_color="#3b82f6", text="", command=toggle_snapshots)
check.deselect()

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
        
# Create the console output widget
console_output = ctk.CTkTextbox(window, width=810, height=235)
console_output.place(x=20, y=180)

# Make the console output widget read-only
console_output.configure(state='disabled')

# Create a class to redirect the standard output to the CTkText widget
class StdoutRedirector:
    def __init__(self, console_output):
        self.text_widget = console_output

    def write(self, string):
        self.text_widget.configure(state='normal')
        self.text_widget.insert('end', string)
        self.text_widget.configure(state='disabled')
        self.text_widget.see('end')  # Auto-scroll to the end

    def flush(self):
        pass

# Redirect the standard output to the CTkText widget
sys.stdout = StdoutRedirector(console_output)

# Function to update the versions list
def update_list_versions(_=None):
    installed_versions = minecraft_launcher_lib.utils.get_installed_versions(minecraft_directory)
    installed_versions_list = [version['id'] for version in installed_versions]

    if len(installed_versions_list) != 0:
        vers = ctk.StringVar(value=installed_versions_list[0])
    else:
        vers = ctk.StringVar(value='No version installed')
        installed_versions_list.append('No version installed')
    configure_dropdown(vers,installed_versions_list)

installed_versions = minecraft_launcher_lib.utils.get_installed_versions(minecraft_directory)
installed_versions_list = [version['id'] for version in installed_versions]

if len(installed_versions_list) != 0:
    vers = ctk.StringVar(value=installed_versions_list[0])
else:
    vers = ctk.StringVar(value='No version installed')
    installed_versions_list.append('No version installed')

versions_dropdown_menu = ctk.CTkOptionMenu(window, variable=vers, values=installed_versions_list)
versions_dropdown_menu.configure()

# Function to configure the dropdown menu
def configure_dropdown(vers, installed_versions_list):
    versions_dropdown_menu.configure(variable=vers, values=installed_versions_list)
    vers = ctk.StringVar(value=installed_versions_list[0])

# Load the data from the user_data.json file
if os.path.exists(f'{minecraft_directory}/launcher_options/user_data.json'):
    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'r') as f:
        user_data = json.load(f)
        user_name = user_data.get('name')
        last_version = user_data.get('last_version')
        show_snapshots = user_data.get('toggle_snapshots')
        jvm_arguments = user_data.get('jvm_arguments')
        # Aplicar los data cargados a los campos de entrada
        if(user_name != "" and last_version != ""):
            if user_name is not None:
                entry_name.insert(0, user_name)
            if last_version is not None:
                vers.set(last_version)
        if show_snapshots == False:
            check.deselect()
        elif show_snapshots == True:
            check.select()
            
else:
    user_name = entry_name.get()
    last_version = vers.get()
    show_snapshots = False
    jvm_arguments = defaultJVM
    # Create the launcher_options directory if it does not exist
    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)

    # Save the data to a file
    data = {
        'name': user_name, # Save the user name
        'toggle_snapshots': show_snapshots,  # save the state of the checkbox
        'jvm_arguments': jvm_arguments,  # Save the JVM arguments
        'last_version': last_version,  # Save the last version used
        'ask_update': ask_update # Save the state of the checkbox
    }
    # Save data to a file
    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
        json.dump(data, f)

# Load the UUID from the user_uuid.json file
if os.path.exists(f'{minecraft_directory}/launcher_options/user_uuid.json') and os.path.getsize(f'{minecraft_directory}/launcher_options/user_uuid.json') > 0:
    with open(f'{minecraft_directory}/launcher_options/user_uuid.json', 'r') as f:
        user_uuid = json.load(f)
else:
    user_uuid = ""
    
    # Create the launcher_options directory if it does not exist
    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)
    
    with open(f'{minecraft_directory}/launcher_options/user_uuid.json', 'w') as f:
        json.dump(user_uuid, f)

# Function to save the data
def save_data():
    # Save the data to a file
    data = {
        'name': entry_name.get(), # Save the user name
        'toggle_snapshots': check.get(),  # save the state of the checkbox
        'jvm_arguments': jvm_arguments,  # Save the JVM arguments
        'last_version': vers.get(),  # Save the last version used
        'ask_update': ask_update # Save the state of the checkbox
    }

    if vers.get() != 'No version installed':
        data['last_version'] = vers.get()  # Save the last version used

    # Create the launcher_options directory if it does not exist
    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)

    # Save the data to a file
    with open(f'{minecraft_directory}/launcher_options/user_uuid.json', 'w') as f:
        json.dump(user_uuid, f)

    # Save the data to a file
    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
        json.dump(data, f)

# Variables to store the maximum value of the progress bar
current_max = 0
# Create the progress bar
progress = ctk.CTkProgressBar(window, width=810, height=10, fg_color="#0a1a33", bg_color="#242424")
progress.place(x=20, y=425)
progress.configure(progress_color="#0a1a33")
progress.set(0)

# Function to update the progress bar
def set_status(status: str):
    print(status)

# Function to set the maximum value of the progress bar
def set_max(new_max: int):
    global current_max
    current_max = new_max
    progress.set(0)  # Reset the progress bar

# Function to update the progress bar
def set_progress(progress_value: int):
    if current_max != 0:
        progress_percentage = (progress_value / current_max)
        progress.set(progress_percentage)
    if progress_value == 0:
        progress.configure(progress_color="#0a1a33")
    else:
        progress.configure(progress_color="#3b82f6")

# Function to install Minecraft version in a separate thread
def install_minecraft(version):
    if version:
        console_output.configure(state='normal') # Enable the console
        console_output.delete('1.0', 'end')  # Clear the console
        console_output.configure(state='disabled') # Disable the console

        # Print the version to be installed
        print(f'Version {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')

        # Install the version
        try:
            callback = {
                "setStatus": set_status,
                "setProgress": set_progress,
                "setMax": set_max
            }
            minecraft_launcher_lib.install.install_minecraft_version(version, minecraft_directory, callback=callback)
            print(f'Version {version} has been installed')
            messagebox.showinfo("Success", f'Version {version} has been installed')
            messagebox.showinfo("Version installed successfully", 'Please restart the launcher')
            close_app() # Close the application
        except Exception as e:
            messagebox.showerror("Error", f"Could not install version: {e}")
        finally:
            bt_install_versions.configure(state='normal')
            bt_install_forge.configure(state='normal')
            bt_install_fabric.configure(state='normal')
            bt_run_minecraft.configure(state='normal')
            update_list_versions()
            
    else:
        messagebox.showerror("Error", "No version entered")

# Function to install Forge in a separate thread
def install_forge(version):
    if version:
        console_output.configure(state='normal') # Enable the console
        console_output.delete('1.0', 'end')  # Clear the console
        console_output.configure(state='disabled') # Disable the console
        print(f'Forge for Minecraft {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')

        # Install Forge
        try:
            for i in forge_versions:
                if i == version:
                    forge = i
                    break
            if forge:
                callback = {
                "setStatus": set_status,
                "setProgress": set_progress,
                "setMax": set_max
                }
                minecraft_launcher_lib.forge.install_forge_version(forge, minecraft_directory, callback=callback)
                print('Forge installed')
                messagebox.showinfo("Success", f'Forge {version} installed')
                messagebox.showinfo("Forge installed successfully", 'Please restart the launcher')
                close_app() # Close the application
            else:
                print('No Forge version found for this version of Minecraft')
                messagebox.showerror("Error", "No Forge version found for this version of Minecraft")
        except Exception as e:
            messagebox.showerror("Error", f"Forge could not be installed: {e}")
        finally:
            bt_install_versions.configure(state='normal')
            bt_install_forge.configure(state='normal')
            bt_install_fabric.configure(state='normal')
            bt_run_minecraft.configure(state='normal')
            update_list_versions()
    else:
        messagebox.showerror("Error", "No version entered")


# Function to install Fabric in a separate thread
def install_fabric(version):
    if version:
        console_output.configure(state='normal') # Enable the console
        console_output.delete('1.0', 'end')  # Clear the console
        console_output.configure(state='disabled') # Disable the console
        print(f'Fabric for Minecraft {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')
        try:
            # Verifies that the version of Minecraft is supported by Fabric
            if minecraft_launcher_lib.fabric.is_minecraft_version_supported(version):
                # Install Fabric
                callback = {
                "setStatus": set_status,
                "setProgress": set_progress,
                "setMax": set_max
                }
                minecraft_launcher_lib.fabric.install_fabric(version, minecraft_directory, callback=callback)
                print('Fabric installed')
                messagebox.showinfo("Success", f'Fabric {version} installed')
                messagebox.showinfo("Forge installed successfully", 'Please restart the launcher')
                close_app() # Close the application
            else:
                print('No Fabric version found for this version of Minecraft')
                messagebox.showerror("Error", "No Fabric version found for this version of Minecraft")
        except Exception as e:
            messagebox.showerror("Error", f"Fabric could not be installed: {e}")
        finally:
            bt_install_versions.configure(state='normal')
            bt_install_forge.configure(state='normal')
            bt_install_fabric.configure(state='normal')
            bt_run_minecraft.configure(state='normal')
            update_list_versions()
    else:
        messagebox.showerror("Error", "No version entered")

def generate_uuid(name):
    try:
        global user_uuid  # Use the global variable
        resp = requests.get(f"https://api.mojang.com/users/profiles/minecraft/{name}")
        user_uuid = resp.json()["id"]

    except KeyError:
        # If the user is not found, generate a random UUID
        user_uuid = str(uuid.uuid4())

# Function to check if Java is installed
def is_java_installed():
    try:
        output = subprocess.check_output('java -version', stderr=subprocess.STDOUT, shell=True)
        return 'version' in output.decode('UTF-8').lower()
    except Exception:
        return False

# Function to run Minecraft
def run_minecraft():
    # Check if Java is installed
    if not is_java_installed():
        if sys.platform == 'win32':
            if messagebox.askyesno("Error", "Java is not installed. Do you want to open the download page?"):
                webbrowser.open('https://www.java.com/es/download/')
            else:
                messagebox.showerror("Java is not installed","It's necessary to install Java to run Minecraft, please install it and restart the launcher")
                close_app() # Close the application
        elif sys.platform == 'linux':
            messagebox.showinfo("Java is not installed", "Please install Java to run Minecraft.\n\nFor example, in Ubuntu you can install it with the command 'sudo apt install default-jre'") 
        return
    
    mine_user = entry_name.get()
    if(user_uuid == "" and jvm_arguments != ""):
        # Generate a UUID if it does not exist
        generate_uuid(mine_user)
    save_data()
    
    if not mine_user:
        messagebox.showerror("Error", "Please enter your user name")
        return
    if not jvm_arguments:
        messagebox.showerror("Error", "Please set the JVM arguments")
        return
    

    console_output.configure(state='normal') # Enable the console
    console_output.delete('1.0', 'end')  # Clear the console
    console_output.configure(state='disabled') # Disable the console

    # Set version to the selected version
    version = vers.get()
    
    # If version is not null then set the options
    if version:
        options = {
            'username': mine_user,
            'uuid': user_uuid,
            'token': '',
            'jvmArguments': jvm_arguments,
            'launcherName': "OpenLauncher for Minecraft",
            'launcherVersion': launcher_version
        }

        # Disable the buttons
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')

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
                    bt_install_versions.configure(state='normal')
                    bt_install_forge.configure(state='normal')
                    bt_install_fabric.configure(state='normal')
                    bt_run_minecraft.configure(state='normal')
                    progress.set(0) # Reset the progress bar

            # Start the thread to run the command 
            thread = threading.Thread(target=run_command, args=(minecraft_command,))
            thread.start()

        except Exception as e:
            messagebox.showerror("Error", f"Could not start Minecraft: {e}")
            # Enable the buttons
            bt_install_versions.configure(state='normal')
            bt_install_forge.configure(state='normal')
            bt_install_fabric.configure(state='normal')
            bt_run_minecraft.configure(state='normal')

# Function to start the installation in a separate thread
def start_installation(funcion_instalacion, version):
    installation_thread = threading.Thread(target=funcion_instalacion, args=(version,))
    installation_thread.start()

# Function to run the installation of the versions of Minecraft
def install_normal_versions():
    if not versions:
        messagebox.showerror("Error", "No internet connection")
        return
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install version')
    window_versions.update()  # Update the window
    window_versions.grab_set()  # Set the window to be on top
    window_versions.resizable(False, False)  # Disable resizing

    # Set the position to center the window
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_versions.winfo_screenheight()/2 - window_height/2)

    # Position the window in the center of the screen
    window_versions.geometry("+{}+{}".format(position_right, position_down))

    # Check if the user wants to see snapshots
    if show_snapshots == 1:
        vers = tk.StringVar(value=all_versions[0])
        versions_list = all_versions
    else:
        vers = tk.StringVar(value=releases[0])
        versions_list = releases
    
    # Create a style
    style = ttk.Style()
    style.theme_use('clam')  # Select a theme
    # Configure the background color of the Combobox
    style.configure('Custom.TCombobox')
    info_label = tk.Label(window_versions, text="Install the version of Minecraft you want", bg="#242424", fg="white")
    info_label.pack()
    # Create the Combobox with the custom style
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=20)
    
    # Create the install button
    bt_install_versions = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_minecraft, vers.get()), window_versions.destroy()])
    bt_install_versions.pack(pady=10)

# Function to install the versions of fabric
def install_fabric_versions():
    if not versions:
        messagebox.showerror("Error", "No internet connection")
        return
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install Fabric')
    window_versions.update()  # Update the window
    window_versions.grab_set()  # Set the window to be on top
    window_versions.resizable(False, False)  # Disable resizing

    # Set the position to center the window
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_versions.winfo_screenheight()/2 - window_height/2)

    # Position the window in the center of the screen
    window_versions.geometry("+{}+{}".format(position_right, position_down))
    
    if show_snapshots == 1:
        vers = tk.StringVar(value=fabric_all[0])
        versions_list = fabric_all
    else:
        vers = tk.StringVar(value=fabric_releases[0])
        versions_list = fabric_releases
    
    # Create a style
    style = ttk.Style()
    style.theme_use('clam')  # Select a theme
    # Configure the background color of the Combobox
    style.configure('Custom.TCombobox')
    info_label = tk.Label(window_versions, text="Install the latest available version of fabric for\nthe desired Minecraft version", bg="#242424", fg="white")
    info_label.pack()
    # Create the Combobox with the custom style
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=20)

    # Create the install button
    bt_install_fabric = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_fabric, vers.get()), window_versions.destroy()])
    bt_install_fabric.pack(pady=10)

def install_forge_versions():
    if not versions:
        messagebox.showerror("Error", "No internet connection")
        return
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x200')
    window_versions.title('Install Forge')
    window_versions.update()  # Update the window
    window_versions.grab_set()  # Set the window to be on top
    window_versions.resizable(False, False)  # Disable resizing
    
    # Set the position to center the window
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_versions.winfo_screenheight()/2 - window_height/2 - 32)

    # Position the window in the center of the screen
    window_versions.geometry("+{}+{}".format(position_right, position_down))
    warning_label = tk.Label(window_versions, text="Warning: Installing Forge via this feature is not\nrecommended for older versions, please consider\nusing the official installer:", bg="#242424", fg="yellow")
    warning_label.pack()
    def open_link(_=None):
        webbrowser.open('https://files.minecraftforge.net/')
    link_label = tk.Label(window_versions, text="https://files.minecraftforge.net/", fg="#6e9be6", cursor="hand2", bg="#303030")
    link_label.pack()
    link_label.bind("<Button-1>", open_link)
    
    #messagebox.showwarning("Warning", 'Installing Forge via this feature is not recommended for older versions, please consider using the official installer: https://files.minecraftforge.net/')

    # Obtaining the latest version of Forge from the official website via the promotions_slim.json file
    response = requests.get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")

    # Convert the response to a dictionary
    forge_latest = response.json()
    # Obtaining the keys of the dictionary and storing them in a list
    keys = list(forge_latest["promos"].keys())

    # Obtaining the last key and value of the dictionary
    last_key = keys[-2]
    last_value = forge_latest["promos"][last_key]

    # Concatenate the version with the value using a hyphen
    result = last_key.split('-')[0] + '-' + last_value

    if(result in forge_all):
        vers = tk.StringVar(value=result)
        versions_list = forge_all
    else:
        vers = tk.StringVar(value=forge_all[0])
        versions_list = forge_all
    
    # Create a style
    style = ttk.Style()
    style.theme_use('clam')  # Select a theme 
    # Configure the background color of the Combobox
    style.configure('Custom.TCombobox')

    # Create the Combobox with the custom style
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=30)

    # Create the install button
    bt_install_forge = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_forge, vers.get()), window_versions.destroy()])
    bt_install_forge.pack(pady=10)

def open_directory():
    # Check if the directory exists
    if os.path.exists(minecraft_directory):
        # Open the directory
        if sys.platform == "win32":
            subprocess.Popen(['explorer', minecraft_directory])
        elif sys.platform == "linux":
            subprocess.Popen(['xdg-open', minecraft_directory])
    else:
        print(f"Directory {minecraft_directory} does not exist")

def settings_window():
    window_settings = ctk.CTkToplevel(window)
    window_settings.geometry('300x270')
    window_settings.title('Settings')
    window_settings.update()  # Update the window
    window_settings.grab_set()  # Set the window to be on top
    window_settings.resizable(False, False)  # Disable resizing
    
    # Set the position to center the window
    window_width = window_settings.winfo_reqwidth()
    window_height = window_settings.winfo_reqheight()
    position_right = int(window_settings.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_settings.winfo_screenheight()/2 - window_height/2 - 48)

    # Position the window in the center of the screen
    window_settings.geometry("+{}+{}".format(position_right, position_down))
    
    # Create the jvm arguments label and entry
    label_jvm_arguments = ctk.CTkLabel(window_settings, text="JVM arguments (Expert settings)\n\nIf nothing is specified in this field, the default\nvalues ​​will be used. Don't use this option if\nyou don't know what you're doing.", text_color="white", font=("Arial", 12))
    label_jvm_arguments.pack(pady=10)
    label_tip = ctk.CTkLabel(window_settings, text="Leave blank and save to reset.", text_color="yellow", font=("Arial", 12))
    label_tip.pack()
    entry_jvm_arguments = ctk.CTkEntry(window_settings, width=260, placeholder_text="JVM arguments (-Xms512M -Xmx8G -XX:+UseG1GC -XX:+ParallelRe...)", text_color="white")
    entry_jvm_arguments.pack()
    if jvm_arguments != defaultJVM:
        entry_jvm_arguments.insert(0, " ".join(jvm_arguments))
    
    def set_jvm():
        global jvm_arguments
        entry_value = entry_jvm_arguments.get().strip()
        if entry_value != "" and not re.match("^-*$", entry_value):
            jvm_arguments = entry_value.split()
            # Filter the arguments
            jvm_arguments = [arg.replace("\n", "") for arg in jvm_arguments if arg.strip() not in ["", "-"] and not re.match("^-*$", arg)]
            # If jvm_arguments is empty after filtering, assign defaultJVM
            if not jvm_arguments:
                jvm_arguments = defaultJVM
        else:
            jvm_arguments = defaultJVM

    # Create the save button
    bt_save = ctk.CTkButton(window_settings, text='Save settings', width=260, fg_color="#32a862", command=lambda: [set_jvm(), save_data(), window_settings.destroy()])
    bt_save.pack(pady=20)
    # Create the directory button
    bt_main_path = ctk.CTkButton(window_settings, text='Open game directory', width=260, command=lambda: open_directory())
    bt_main_path.pack()

# Function to run the menu of the application
def menu():
    # Set the functions of the widgets and place them on the window
    bt_install_versions.configure(command=install_normal_versions)
    bt_install_versions.place(x=690, y=20)

    bt_install_fabric.configure(command=install_fabric_versions)
    bt_install_fabric.place(x=690, y=70)

    bt_install_forge.configure(command=install_forge_versions)
    bt_install_forge.place(x=690, y=120)

    bt_settings.configure(command=settings_window)
    bt_settings.place(x=350, y=450)

    label_name.place(x=20, y=20)
    entry_name.place(x=20, y=50)

    label_snapshots.place(x=20, y=110)
    check.place(x=120, y=110)

    bt_run_minecraft.configure(command=run_minecraft)
    bt_run_minecraft.place(x=690, y=450)

    versions_dropdown_menu.place(x=20, y=450)

    window.mainloop()

# Run the menu
menu()