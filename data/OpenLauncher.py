import json
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

# Debug Mode
debug_mode = False

# Mostrar versiones snapshot
show_snapshots = False

# Versión del launcher
launcher_version = "alpha-0.0.4"

# Definir directorio de Minecraft
if debug_mode:
    # Define un directorio de Minecraft personalizado para pruebas
    appdata = os.environ["APPDATA"]
    minecraft_directory = os.path.join(appdata, ".launcher")
else:
    # Obtiene el directorio de Minecraft por defecto (.minecraft)
    minecraft_directory = minecraft_launcher_lib.utils.get_minecraft_directory()
script_dir = os.path.dirname(__file__)  # Obtiene el directorio del script

# Actualización del launcher
try:
    update = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest")
    def version_to_tuple(version):
        # Determina si la versión es alfa o beta
        if 'alpha' in version:
            version_type = 0
            version = version.replace('alpha-', '')
        elif 'beta' in version:
            version_type = 1
            version = version.replace('beta-', '')
        else:
            version_type = 2

        # Divide la cadena en partes
        parts = version.split('.')
        # Convierte las partes en enteros y los pone en una tupla
        return (version_type,) + tuple(map(int, parts))

    # Obtén la versión actual y la última versión
    actual_version = version_to_tuple(launcher_version)
    latest_version = version_to_tuple(update.url.split('/').pop())
    latest_name = update.url.split('/').pop()
    # Compara las versiones
    if latest_version > actual_version:
        if latest_version > actual_version:
            # Verificar si ask_update es no
            if os.path.exists(f'{minecraft_directory}/launcher_options/user_data.json'):
                with open(f'{minecraft_directory}/launcher_options/user_data.json', 'r') as f:
                    user_data = json.load(f)
                    ask_update = user_data.get('ask_update')
            if(ask_update != "no"):
                root = tk.Tk()
                root.withdraw()  # Oculta la ventana de Tkinter
                if messagebox.askyesno("Update", "A new version is available. Would you like to download it?"):
                    messagebox.showinfo("Download", "Please select the download location.")
                    # Solicitar al usuario que seleccione la ubicación de descarga
                    download_location = filedialog.askdirectory()
                    if download_location:  # Si el usuario selecciona una ubicación
                        messagebox.showinfo("Download", "The download is in progress, please wait...")
                        r = requests.get("https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.exe", allow_redirects=True)
                        # Guardar el archivo en la ubicación seleccionada por el usuario
                        with open(f'{download_location}/OpenLauncher-{latest_name}.exe', 'wb') as f:
                            f.write(r.content)
                        messagebox.showinfo("Download", "The download has been completed successfully.")
                        # Crear el directorio launcher_options si no existe
                        os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)
                        # Guardar namem ram y toggle en un archivo
                        datos = {
                            'ask_update': 'yes'
                        }
                        # Guardar los datos en un archivo
                        with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
                            json.dump(datos, f)
                        exit()
                else:
                    # Crear el directorio launcher_options si no existe
                    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)
                    # Guardar namem ram y toggle en un archivo
                    datos = {
                        'ask_update': 'no'
                    }
                    # Guardar los datos en un archivo
                    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
                        json.dump(datos, f)
                root.destroy()
except Exception as e:
    print("Error:", e)
        
# Configuración de estilos
ctk.set_appearance_mode("dark")  # Modo oscuro
ctk.set_default_color_theme("blue")  # Tema de color

def close_app():
    window.update_idletasks()
    window.destroy()

def center_window():
    # Actualiza la ventana para obtener el tamaño correcto
    window.update_idletasks()

    # Calcula la posición para centrar la ventana
    window_width = window.winfo_width()
    window_height = window.winfo_height()
    position_right = int(window.winfo_screenwidth()/2 - window_width/2)
    position_down = int(window.winfo_screenheight()/2 - window_height/2)

    # Posiciona la ventana en el centro de la pantalla
    window.geometry("+{}+{}".format(position_right, position_down - 16))

# Configuración de la ventana principal
window = ctk.CTk()
window.geometry('850x500')  # Tamaño de la pantalla
window.title(f'OpenLauncher for Minecraft — {launcher_version}')
window.resizable(False, False)  # No se puede cambiar el tamaño

# Centra la ventana después de que se haya renderizado
window.after_idle(center_window)

# Creación de los widgets
bt_run_minecraft = ctk.CTkButton(window, text='Start game', text_color="white", fg_color="#3b82f6")
bt_main_path = ctk.CTkButton(window, text='Open game folder', text_color="white", fg_color="#3b82f6")
bt_install_versions = ctk.CTkButton(window, text='Install versions', text_color="white", fg_color="#32a862")
bt_install_forge = ctk.CTkButton(window, text='Install Forge', text_color="white", fg_color="#ef4444")
bt_install_fabric = ctk.CTkButton(window, text='Install Fabric', text_color="white", fg_color="#10b981")

label_name = ctk.CTkLabel(window, text='User name:', text_color="white", font=("Arial", 12))
label_ram = ctk.CTkLabel(window, text='RAM (GB):', text_color="white", font=("Arial", 12))

entry_name = ctk.CTkEntry(window, placeholder_text="User name (Steve)", width=300)
entry_ram = ctk.CTkEntry(window, placeholder_text="6", width=300)

label_snapshots = ctk.CTkLabel(window, text="Show Snapshots", text_color="white", font=("Arial", 12))
label_snapshots.place(x=550, y=17) 

   
def toggle_snapshots():
    global check
    global show_snapshots
    if check.get() == 1:
        show_snapshots = True
    else:
        show_snapshots = False

check = ctk.CTkCheckBox(window, width=30, height=30, fg_color="#3b82f6", text="", command=toggle_snapshots)
check.deselect()
check.place(x=650, y=17)
try:
    versions = minecraft_launcher_lib.utils.get_version_list()
    forge_versions = minecraft_launcher_lib.forge.list_forge_versions()
    fabric_versions = minecraft_launcher_lib.fabric.get_all_minecraft_versions()
except Exception as e:
    versions = list()
    forge_versions = list()
    fabric_versions = list()

all_versions = list()
releases = list()
snapshots = list()
fabric_releases = list()
fabric_all = list()
forge_all = list()

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
        
# Creación del widget CTkTextbox
console_output = ctk.CTkTextbox(window, width=810, height=235)
console_output.place(x=20, y=180)

# Hacer que el widget sea de solo lectura
console_output.configure(state='disabled')

# Clase para redirigir la salida estándar al widget CTkTextbox
class StdoutRedirector:
    def __init__(self, console_output):
        self.text_widget = console_output

    def write(self, string):
        self.text_widget.configure(state='normal')
        self.text_widget.insert('end', string)
        self.text_widget.configure(state='disabled')
        self.text_widget.see('end')  # Auto-scroll al final

    def flush(self):
        pass

# Redirigir la salida estándar al widget CTkText
sys.stdout = StdoutRedirector(console_output)

# Ver todas las versiones que tengo instaladas y mostrarlas en un desplegable
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

def configure_dropdown(vers, installed_versions_list):
    versions_dropdown_menu.configure(variable=vers, values=installed_versions_list)
    vers = ctk.StringVar(value=installed_versions_list[0])


# Cargar el uuid y los datos del usuario desde un archivo
if os.path.exists(f'{minecraft_directory}/launcher_options/user_data.json'):
    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'r') as f:
        user_data = json.load(f)
        user_name = user_data.get('name')
        user_ram = user_data.get('ram')
        last_version = user_data.get('last_version')
        show_snapshots = user_data.get('toggle_snapshots')
        # Aplicar los datos cargados a los campos de entrada
        if(user_name != "" and user_ram != "" and last_version != ""):
            if user_name is not None:
                entry_name.insert(0, user_name)
            if user_ram is not None:
                entry_ram.insert(0, user_ram)
            if last_version is not None:
                vers.set(last_version)
        if show_snapshots == False:
            check.deselect()
        elif show_snapshots == True:
            check.select()
else:
    user_name = entry_name.get()
    user_ram = entry_ram.get()
    last_version = vers.get()
    show_snapshots = False
    # Crear el directorio launcher_options si no existe
    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)

    # Guardar los datos del usuario en un archivo
    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
        json.dump({'name': user_name, 'ram': user_ram, 'last_version': last_version}, f)

# Cargar el uuid desde un archivo
if os.path.exists(f'{minecraft_directory}/launcher_options/user_uuid.json') and os.path.getsize(f'{minecraft_directory}/launcher_options/user_uuid.json') > 0:
    with open(f'{minecraft_directory}/launcher_options/user_uuid.json', 'r') as f:
        user_uuid = json.load(f)
else:
    user_uuid = ""
    
    # Crear el directorio launcher_options si no existe
    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)
    
    with open(f'{minecraft_directory}/launcher_options/user_uuid.json', 'w') as f:
        json.dump(user_uuid, f)

def save_data():
    # Guardar namem ram y toggle en un archivo
    datos = {
        'name': entry_name.get(),
        'ram': entry_ram.get(),
        'toggle_snapshots': check.get()  # Guardar el estado del checkbox 'Show Snapshots
    }

    if vers.get() != 'No version installed':
        datos['last_version'] = vers.get()  # Guardar la última versión seleccionada solo si no es 'No version installed'

    # Crear el directorio launcher_options si no existe
    os.makedirs(f'{minecraft_directory}/launcher_options', exist_ok=True)

    # Guardar el UUID en un archivo
    with open(f'{minecraft_directory}/launcher_options/user_uuid.json', 'w') as f:
        json.dump(user_uuid, f)

    # Guardar los datos en un archivo
    with open(f'{minecraft_directory}/launcher_options/user_data.json', 'w') as f:
        json.dump(datos, f)

current_max = 0
# Crear una barra de progreso
progress = ctk.CTkProgressBar(window, width=810, height=10, fg_color="#0a1a33", bg_color="#242424")
progress.place(x=20, y=425)
progress.configure(progress_color="#0a1a33")
progress.set(0)

def set_status(status: str):
    print(status)

def set_max(new_max: int):
    global current_max
    current_max = new_max
    progress.set(0)  # Reiniciar la barra de progreso

def set_progress(progress_value: int):
    if current_max != 0:
        progress_percentage = (progress_value / current_max)
        progress.set(progress_percentage)
    if progress_value == 0:
        progress.configure(progress_color="#0a1a33")
    else:
        progress.configure(progress_color="#3b82f6")

def install_minecraft(version):
    if version:
        console_output.configure(state='normal')
        console_output.delete('1.0', 'end')  # Limpiar la consola
        console_output.configure(state='disabled')

        print(f'Version {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')
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
            close_app()
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

def install_forge(version):
    if version:
        console_output.configure(state='normal')
        console_output.delete('1.0', 'end')  # Limpiar la consola
        console_output.configure(state='disabled')
        print(f'Forge for Minecraft {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')
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
                close_app()
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

def install_fabric(version):
    if version:
        console_output.configure(state='normal')
        console_output.delete('1.0', 'end')  # Limpiar la consola
        console_output.configure(state='disabled')
        print(f'Fabric for Minecraft {version} will be installed, this may take a few minutes depending on your internet connection, please wait...')
        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')
        try:
            # Verifica si la versión de Minecraft es soportada por Fabric
            if minecraft_launcher_lib.fabric.is_minecraft_version_supported(version):
                # Instala Fabric para la versión especificada
                callback = {
                "setStatus": set_status,
                "setProgress": set_progress,
                "setMax": set_max
                }
                minecraft_launcher_lib.fabric.install_fabric(version, minecraft_directory, callback=callback)
                print('Fabric installed')
                messagebox.showinfo("Success", f'Fabric {version} installed')
                messagebox.showinfo("Forge installed successfully", 'Please restart the launcher')
                close_app()
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
        global user_uuid  # Indicar que vamos a usar la variable global user_uuid
        resp = requests.get(f"https://api.mojang.com/users/profiles/minecraft/{name}")
        user_uuid = resp.json()["id"]

    except KeyError:
        user_uuid = str(uuid.uuid4())

def run_minecraft():
    mine_user = entry_name.get()
    ram = entry_ram.get()
    if(user_uuid == "" and mine_user != ""):
        generate_uuid(mine_user)
    save_data()
    
    if not mine_user:
        messagebox.showerror("Error", "Please enter your user name")
        return
    if not ram:
        messagebox.showerror("Error", "Please enter the amount of RAM to use")
        return
    console_output.configure(state='normal')
    console_output.delete('1.0', 'end')  # Limpiar la consola
    console_output.configure(state='disabled')
    version = vers.get()
    
    if version:
        options = {
            'username': mine_user,
            'uuid': user_uuid,
            'token': '',
            'jvmArguments': [f"-Xms{ram}G", f"-Xmx{ram}G", "-XX:+UseG1GC", "-XX:+ParallelRefProcEnabled", "-XX:MaxGCPauseMillis=200", "-XX:+UnlockExperimentalVMOptions", "-XX:+DisableExplicitGC", "-XX:+AlwaysPreTouch", "-XX:G1NewSizePercent=30", "-XX:G1MaxNewSizePercent=40", "-XX:G1HeapRegionSize=8M", "-XX:G1ReservePercent=20", "-XX:G1HeapWastePercent=5", "-XX:G1MixedGCCountTarget=4", "-XX:InitiatingHeapOccupancyPercent=15", "-XX:G1MixedGCLiveThresholdPercent=90", "-XX:G1RSetUpdatingPauseTimePercent=5", "-XX:SurvivorRatio=32", "-XX:+PerfDisableSharedMem"],
            'launcherName': "OpenLauncher for Minecraft",
            'launcherVersion': launcher_version
        }

        bt_install_versions.configure(state='disabled')
        bt_install_forge.configure(state='disabled')
        bt_install_fabric.configure(state='disabled')
        bt_run_minecraft.configure(state='disabled')

        try:
            minecraft_command = minecraft_launcher_lib.command.get_minecraft_command(version, minecraft_directory, options)
            
            def run_command(command):
                try:
                    # Configuración para no mostrar la ventana de comandos
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, startupinfo=startupinfo, universal_newlines=True)
                    for line in iter(process.stdout.readline, ''):
                        print(line.strip())  # Imprime la salida en tiempo real
                    process.stdout.close()
                    process.wait()
                except Exception as e:
                    messagebox.showerror("Error", f"Could not start Minecraft: {e}")
                finally:
                    bt_install_versions.configure(state='normal')
                    bt_install_forge.configure(state='normal')
                    bt_install_fabric.configure(state='normal')
                    bt_run_minecraft.configure(state='normal')
                    progress.set(0) # Reiniciar la barra de progreso 

            # Ejecuta el comando en un hilo separado
            thread = threading.Thread(target=run_command, args=(minecraft_command,))
            thread.start()

        except Exception as e:
            messagebox.showerror("Error", f"Could not start Minecraft: {e}")
            bt_install_versions.configure(state='normal')
            bt_install_forge.configure(state='normal')
            bt_install_fabric.configure(state='normal')
            bt_run_minecraft.configure(state='normal')

def start_installation(funcion_instalacion, version):
    installation_thread = threading.Thread(target=funcion_instalacion, args=(version,))
    installation_thread.start()

def install_normal_versions():
    if not versions:
        messagebox.showerror("Error", "No internet connection")
        return
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install version')
    window_versions.grab_set()  # Para que quede por encima
    window_versions.resizable(False, False)  # Para que no se pueda cambiar el tamaño

    # Calcula la posición para centrar la ventana
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_versions.winfo_screenheight()/2 - window_height/2)

    # Posiciona la ventana en el centro de la pantalla
    window_versions.geometry("+{}+{}".format(position_right, position_down))

    if show_snapshots == 1:
        vers = tk.StringVar(value=all_versions[0])
        versions_list = all_versions
    else:
        vers = tk.StringVar(value=releases[0])
        versions_list = releases
    
    # Crear un estilo
    style = ttk.Style()
    style.theme_use('clam')  # Selecciona un tema
    # Configurar el color de fondo del Combobox
    style.configure('Custom.TCombobox')
    info_label = tk.Label(window_versions, text="Install the version of Minecraft you want", bg="#242424", fg="white")
    info_label.pack()
    # Crear el Combobox con el estilo personalizado
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=20)
    
    bt_install_versions = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_minecraft, vers.get()), window_versions.destroy()])
    bt_install_versions.pack(pady=10)

def install_fabric_versions():
    if not versions:
        messagebox.showerror("Error", "No internet connection")
        return
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install Fabric')
    window_versions.grab_set()  # Para que quede por encima
    window_versions.resizable(False, False)  # Para que no se pueda cambiar el tamaño

    # Calcula la posición para centrar la ventana
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_versions.winfo_screenheight()/2 - window_height/2)

    # Posiciona la ventana en el centro de la pantalla
    window_versions.geometry("+{}+{}".format(position_right, position_down))
    
    if show_snapshots == 1:
        vers = tk.StringVar(value=fabric_all[0])
        versions_list = fabric_all
    else:
        vers = tk.StringVar(value=fabric_releases[0])
        versions_list = fabric_releases
    
    # Crear un estilo
    style = ttk.Style()
    style.theme_use('clam')  # Selecciona un tema 
    # Configurar el color de fondo del Combobox
    style.configure('Custom.TCombobox')
    info_label = tk.Label(window_versions, text="Install the latest available version of fabric for\nthe desired Minecraft version", bg="#242424", fg="white")
    info_label.pack()
    # Crear el Combobox con el estilo personalizado
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=20)

    bt_install_fabric = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_fabric, vers.get()), window_versions.destroy()])
    bt_install_fabric.pack(pady=10)

def install_forge_versions():
    if not versions:
        messagebox.showerror("Error", "No internet connection")
        return
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x200')
    window_versions.title('Install Forge')
    window_versions.grab_set()  # Para que quede por encima
    window_versions.resizable(False, False)  # Para que no se pueda cambiar el tamaño
    
    # Calcula la posición para centrar la ventana
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2 - 48)
    position_down = int(window_versions.winfo_screenheight()/2 - window_height/2)

    # Posiciona la ventana en el centro de la pantalla
    window_versions.geometry("+{}+{}".format(position_right, position_down))
    warning_label = tk.Label(window_versions, text="Warning: Installing Forge via this feature is not\nrecommended for older versions, please consider\nusing the official installer:", bg="#242424", fg="yellow")
    warning_label.pack()
    def open_link(_=None):
        webbrowser.open('https://files.minecraftforge.net/')
    link_label = tk.Label(window_versions, text="https://files.minecraftforge.net/", fg="#6e9be6", cursor="hand2", bg="#303030")
    link_label.pack()
    link_label.bind("<Button-1>", open_link)
    
    #messagebox.showwarning("Warning", 'Installing Forge via this feature is not recommended for older versions, please consider using the official installer: https://files.minecraftforge.net/')

    # Hacer una solicitud HTTP a la URL
    response = requests.get("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")

    # Convertir la respuesta en un objeto JSON
    forge_latest = response.json()
    # Obtener las claves del diccionario 'promos' y convertirlas en una lista
    keys = list(forge_latest["promos"].keys())

    # Obtener la última clave y su valor correspondiente
    last_key = keys[-2]
    last_value = forge_latest["promos"][last_key]

    # Concatenar la versión con el valor usando un guión
    result = last_key.split('-')[0] + '-' + last_value

    if(result in forge_all):
        vers = tk.StringVar(value=result)
        versions_list = forge_all
    else:
        vers = tk.StringVar(value=forge_all[0])
        versions_list = forge_all
    
    # Crear un estilo
    style = ttk.Style()
    style.theme_use('clam')  # Selecciona un tema 
    # Configurar el color de fondo del Combobox
    style.configure('Custom.TCombobox')

    # Crear el Combobox con el estilo personalizado
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=30)

    bt_install_forge = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_forge, vers.get()), window_versions.destroy()])
    bt_install_forge.pack(pady=10)

def open_directory():
    # Verificar si el directorio existe
    if os.path.exists(minecraft_directory):
        # Abrir el directorio
        subprocess.Popen(['explorer', minecraft_directory])
    else:
        print(f"Directory {minecraft_directory} does not exist")

# Configuración del menú
def menu():
    bt_install_versions.configure(command=install_normal_versions)
    bt_install_versions.place(x=690, y=20)

    bt_install_fabric.configure(command=install_fabric_versions)
    bt_install_fabric.place(x=690, y=70)

    bt_install_forge.configure(command=install_forge_versions)
    bt_install_forge.place(x=690, y=120)

    label_name.place(x=20, y=10)
    entry_name.place(x=20, y=40)

    label_ram.place(x=20, y=90)
    entry_ram.place(x=20, y=120)

    bt_run_minecraft.configure(command=run_minecraft)
    bt_run_minecraft.place(x=690, y=450)

    bt_main_path.configure(command=open_directory)
    bt_main_path.place(x=350, y=450)

    versions_dropdown_menu.place(x=20, y=450)

    window.mainloop()

menu()
