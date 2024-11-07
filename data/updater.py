import json, os, sys, requests, pathlib, minecraft_launcher_lib, shutil
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk
from pathlib import Path
from lang import lang, current_language
import variables

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

class CustomDialog(simpledialog.Dialog):
    def __init__(self, parent, title=None):
        super().__init__(parent, title)

    def body(self, master):
        tk.Label(master, text="Which format would you like to download?", font=("Arial", 12)).grid(row=0, pady=10)
        self.choice = tk.StringVar()
        self.choice.set("bin")
        tk.Radiobutton(master, text=".bin", variable=self.choice, value="bin", font=("Arial", 10)).grid(row=1, sticky=tk.W, padx=20)
        tk.Radiobutton(master, text=".deb", variable=self.choice, value="deb", font=("Arial", 10)).grid(row=2, sticky=tk.W, padx=20)
        return None

    def apply(self):
        self.result = self.choice.get()

def download_file(url, dest, progress_var, progress_bar, progress_label):
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0)) or 1
    block_size = 1024
    downloaded_size = 0
    
    if os.path.exists(dest):
        # if the file already exists, check if the file is the same size as the one being downloaded
        if os.path.getsize(dest) == total_size:
            return True
        else:
            os.remove(dest)

    with open(dest, 'wb') as file:
        for data in response.iter_content(block_size):
            file.write(data)
            downloaded_size += len(data)
            progress_var.set((downloaded_size / total_size) * 100)
            progress_bar['value'] = (downloaded_size / total_size) * 100
            progress_label.config(text=f"{int((downloaded_size / total_size) * 100)}%")
            progress_bar.update_idletasks()

    if total_size != 0 and downloaded_size != total_size:
        show_custom_message("Error", "Something went wrong during the download.", "error")
        return False
    return True

def center_window(window):
    window.update_idletasks()
    width = window.winfo_width()
    height = window.winfo_height()
    x = (window.winfo_screenwidth() // 2) - (width // 2)
    y = (window.winfo_screenheight() // 2) - (height // 2)
    window.geometry(f'{width}x{height}+{x}+{y}')

def show_custom_message(title, message, msg_type="info"):
    custom_window = tk.Toplevel()
    custom_window.title(title)
    custom_window.iconphoto(False, tk.PhotoImage(file=variables.icon))
    tk.Label(custom_window, text=message, padx=20, pady=20, font=("Arial", 12)).pack()
    tk.Button(custom_window, text="OK", command=custom_window.destroy, width=15, font=("Arial", 10)).pack(pady=10)
    center_window(custom_window)
    custom_window.transient()
    custom_window.grab_set()
    custom_window.wait_window()

def clean_up():
    try:
        os.remove(os.path.join(variables.app_directory, "updates", "update.exe"))
    except:
        pass
    try:
        os.remove(os.path.join(variables.app_directory, "updates", "update.bin"))
    except:
        pass
    try:
        os.remove(os.path.join(variables.app_directory, "updates", "update.deb"))
    except:
        pass
    try:
        os.rmdir(os.path.join(variables.app_directory, "updates"))
    except:
        pass

def update():
    repo_latest = "https://github.com/CesarGarza55/OpenLauncher/releases/latest"
    try:
        update = requests.get(f"{repo_latest}")
        actual_version = version_to_tuple(variables.launcher_version)
        latest_version = version_to_tuple(update.url.split('/').pop())
        latest_name = update.url.split('/').pop()

        if latest_version > actual_version:
            root = tk.Tk()
            root.withdraw()
            root.iconphoto(False, tk.PhotoImage(file=variables.icon))
            if messagebox.askyesno("Update", lang(current_language, "update_available")):
                os.makedirs(os.path.join(variables.app_directory, "updates"), exist_ok=True)
                download_location = os.path.join(variables.app_directory, "updates")
                if sys.platform == "win32":
                    url = f"{repo_latest}/download/OpenLauncher.exe"
                    dest = f'{download_location}/update.exe'

                    progress_window = tk.Toplevel(root)
                    progress_window.title(lang(current_language, "downloading"))
                    progress_window.geometry("400x150")
                    progress_window.iconphoto(False, tk.PhotoImage(file=variables.icon))
                    # Get the size of the file
                    response = requests.get(url, stream=True)
                    total_size = int(response.headers.get('content-length', 0)) or 1
                    tk.Label(progress_window, text=f"{lang(current_language, 'downloading')} ({total_size / 1024 / 1024:.2f} MB)", font=("Arial", 12)).pack(pady=10)
                    progress_var = tk.DoubleVar()
                    progress_bar = ttk.Progressbar(progress_window, variable=progress_var, maximum=100)
                    progress_bar.pack(fill=tk.X, padx=20, pady=10)
                    progress_label = tk.Label(progress_window, text="0%", font=("Arial", 10))
                    progress_label.pack()

                    center_window(progress_window)

                    root.update()
                    if download_file(url, dest, progress_var, progress_bar, progress_label):
                        progress_window.destroy()
                        os.system(f'start {dest}')
                    sys.exit()
                elif sys.platform == "linux":
                    if not shutil.which("openlauncher"):
                        dialog = CustomDialog(root, title=lang(current_language, "download_format"))
                        format_choice = dialog.result
                    else:
                        format_choice = "deb"
                    if format_choice == 'bin':
                        url = f"{repo_latest}/download/OpenLauncher.bin"
                        messagebox.showinfo("Download", lang(current_language, "select_folder"))
                        down_location = filedialog.askdirectory()
                        if not down_location:
                            show_custom_message("Error", lang(current_language, "download_cancelled"), "error")
                            sys.exit()
                        dest = f'{down_location}/update.bin'
                    elif format_choice == 'deb':
                        url = f"{repo_latest}/download/OpenLauncher.deb"
                        dest = f'{download_location}/update.deb'
                    else:
                        show_custom_message("Error", lang(current_language, "download_cancelled"), "error")
                        sys.exit()

                    progress_window = tk.Toplevel(root)
                    progress_window.title(lang(current_language, "downloading"))
                    progress_window.geometry("400x150")
                    progress_window.iconphoto(False, tk.PhotoImage(file=variables.icon))
                    # Get the size of the file
                    response = requests.get(url, stream=True)
                    total_size = int(response.headers.get('content-length', 0)) or 1
                    
                    tk.Label(progress_window, text=f"{lang(current_language, 'downloading')} ({total_size / 1024 / 1024:.2f} MB)", font=("Arial", 12)).pack(pady=10)
                    progress_var = tk.DoubleVar()
                    progress_bar = ttk.Progressbar(progress_window, variable=progress_var, maximum=100)
                    progress_bar.pack(fill=tk.X, padx=20, pady=10)
                    progress_label = tk.Label(progress_window, text="0%", font=("Arial", 10))
                    progress_label.pack()

                    center_window(progress_window)

                    root.update()
                    if download_file(url, dest, progress_var, progress_bar, progress_label):
                        progress_window.destroy()
                        if format_choice == 'bin':
                            os.chmod(dest, 0o755)
                            show_custom_message("Download", lang(current_language, "download_success"))
                            show_custom_message("Download", lang(current_language, "open_bin")).replace("dest", dest)
                        elif format_choice == 'deb':
                            # Try with xterm
                            if shutil.which("xterm"):
                                os.system(f'xterm -e sudo dpkg -i {dest}')
                            else:
                                show_custom_message("Error", lang(current_language, "xterm_not_found"), "error").replace("dest", dest)
                            show_custom_message("Download", lang(current_language, "update_complete"))
                            clean_up()
                            os.system("openlauncher")
                    else:
                        show_custom_message("Error", lang(current_language, "download_cancelled"), "error")
                    sys.exit()
            else:
                pass
            root.destroy()
        else:
            clean_up()
    except Exception as e:
        show_custom_message("Error", f"{e}", "error")
        sys.exit()

if __name__ == "__main__":
    update()