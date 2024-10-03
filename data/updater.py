import json, os, sys, requests, pathlib, minecraft_launcher_lib
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog
import variables

if variables.debug_mode:
    # Define a custom Minecraft directory for testing
    if sys.platform == "win32":
        appdata = os.environ["APPDATA"]
        minecraft_directory = os.path.join(appdata, ".launcher")
    elif sys.platform == "linux":
        minecraft_directory = os.path.join(str(pathlib.Path.home()), ".launcher")
else:
    # Gets the default Minecraft directory (.minecraft)
    minecraft_directory = minecraft_launcher_lib.utils.get_minecraft_directory()


def version_to_tuple(version):
    if 'alpha' in version:
        version_type = 0
        version = version.replace('alpha-', '')
    elif 'beta' in version:
        version_type = 1
        version = version.replace('beta-', '')
    else:
        version_type = 2
    parts = version.split('.')
    return (version_type,) + tuple(map(int, parts))


# Launcher Update
def load_user_data(filepath):
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return json.load(f)
    else:
        return {
            'name': "",
            'last_version': "",
            'toggle_snapshots': False,
            'jvm_arguments': variables.defaultJVM,
            'ask_update': "yes",
            'discord_rpc': False
        }

def save_user_data(filepath, data):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        json.dump(data, f)

class CustomDialog(simpledialog.Dialog):
    def __init__(self, parent, title=None):
        super().__init__(parent, title)

    def body(self, master):
        tk.Label(master, text="Which format would you like to download?").grid(row=0)
        self.choice = tk.StringVar()
        self.choice.set("bin")  # default value
        tk.Radiobutton(master, text=".bin", variable=self.choice, value="bin").grid(row=1, sticky=tk.W)
        tk.Radiobutton(master, text=".deb", variable=self.choice, value="deb").grid(row=2, sticky=tk.W)
        return None

    def apply(self):
        self.result = self.choice.get()

def update():
    try:
        update = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest")
        actual_version = version_to_tuple(variables.launcher_version)
        latest_version = version_to_tuple(update.url.split('/').pop())
        latest_name = update.url.split('/').pop()

        if latest_version > actual_version:
            root = tk.Tk()
            root.withdraw()
            if messagebox.askyesno("Update", "A new version is available. Would you like to download it?"):
                messagebox.showinfo("Download", "Please select the download location.")
                download_location = filedialog.askdirectory()
                if download_location:
                    if sys.platform == "win32":
                        messagebox.showinfo("Download", "The download is in progress, please wait...")
                        r = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.exe", allow_redirects=True)
                        with open(f'{download_location}/OpenLauncher-{latest_name}.exe', 'wb') as f:
                            f.write(r.content)
                        messagebox.showinfo("Download", "The download has been completed successfully.")
                    elif sys.platform == "linux":
                        dialog = CustomDialog(root, title="Select Download Format")
                        format_choice = dialog.result

                        if format_choice == 'bin':
                            messagebox.showinfo("Download", "The download is in progress, please wait...")
                            r = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.bin", allow_redirects=True)
                            bin_path = f'{download_location}/OpenLauncher-{latest_name}.bin'
                            with open(bin_path, 'wb') as f:
                                f.write(r.content)
                            os.chmod(bin_path, 0o755)  
                            messagebox.showinfo("Download", "The download has been completed successfully.")
                            messagebox.showinfo("Download", f"You can open the .bin file using the command './{bin_path}' or open it using the file manager.")
                        elif format_choice == 'deb':
                            messagebox.showinfo("Download", "The download is in progress, please wait...")
                            r = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.deb", allow_redirects=True)
                            with open(f'{download_location}/OpenLauncher-{latest_name}.deb', 'wb') as f:
                                f.write(r.content)
                            messagebox.showinfo("Download", "The download has been completed successfully.")
                            messagebox.showinfo("Download", f"You can install the .deb file using the command 'sudo apt install {download_location}/OpenLauncher-{latest_name}.deb'")
                        else:
                            messagebox.showerror("Error", "Download cancelled.")
                    sys.exit()
            else:
                messagebox.showinfo("Update", "The update has been cancelled.")
                sys.exit()
            root.destroy()
    except Exception as e:
        print("Error:", e)