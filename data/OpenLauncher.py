import json
import sys
from tkinter import messagebox, ttk
import uuid
import minecraft_launcher_lib
import os
import subprocess
import customtkinter as ctk
import tkinter as tk
import threading
import shutil
import requests

# Mostrar versiones snapshot
show_snapshots = False

# Versión del launcher
launcher_version = "alpha 0.0.3"

# Definir directorio de Minecraft
user_window = os.environ["USERNAME"]
minecraft_directory = f"C:/Users/{user_window}/AppData/Roaming/.minecraft"  # Directorio de Minecraft
script_dir = os.path.dirname(__file__)  # Obtiene el directorio del script
modpack = os.path.join(script_dir, "mods")  # Directorio del modpack
mods = os.path.join(minecraft_directory, "mods")  # Directorio de mods de Minecraft

# Crear el directorio mods si no existe
if not os.path.exists(mods):
    os.makedirs(mods)

# Copiar todos los archivos de la carpeta de origen a la de destino
def copy_mods():
    for file_name in os.listdir(modpack):
        source = os.path.join(modpack, file_name)
        destination = os.path.join(mods, file_name)
        shutil.copy2(source, destination)  # copy2 preserva metadatos
        
# Configuración de estilos
ctk.set_appearance_mode("dark")  # Modo oscuro
ctk.set_default_color_theme("blue")  # Tema de color

# Configuración de la ventana principal
window = ctk.CTk()
window.geometry('850x500')  # Tamaño de la pantalla
window.title(f'OpenLauncher for Minecraft — {launcher_version}')
window.resizable(False, False)  # Para que no se pueda cambiar el tamaño

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
check.toggle(False)
check.place(x=650, y=17)

versions = minecraft_launcher_lib.utils.get_version_list()
all_versions = list()
releases = list()
snapshots = list()

for i in range(1, len(versions)):
    all_versions.append(versions[i]['id'])
    if versions[i]['type'] == 'release':
        releases.append(versions[i]['id'])
    elif versions[i]['type'] == 'snapshot':
        snapshots.append(versions[i]['id'])

# Creación del widget CTkTextbox
console_output = ctk.CTkTextbox(window, width=810, height=250)
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
            check.toggle(False)
        elif show_snapshots == False:
            check.toggle(True)
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
            minecraft_launcher_lib.install.install_minecraft_version(version, minecraft_directory)
            print(f'Version {version} has been installed')
            messagebox.showinfo("Success", f'Version {version} has been installed')
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
            forge = minecraft_launcher_lib.forge.find_forge_version(version)
            if forge:
                minecraft_launcher_lib.forge.install_forge_version(forge, minecraft_directory)
                print('Forge installed')
                messagebox.showinfo("Success", 'Forge installed')
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
                minecraft_launcher_lib.fabric.install_fabric(version, minecraft_directory)
                print('Fabric installed')
                messagebox.showinfo("Success", 'Fabric installed')
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
    console_output.configure(state='normal')
    console_output.delete('1.0', 'end')  # Limpiar la consola
    console_output.configure(state='disabled')
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
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install version')
    window_versions.grab_set()  # Para que quede por encima
    window_versions.resizable(False, False)  # Para que no se pueda cambiar el tamaño

    # Calcula la posición para centrar la ventana
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2)
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

    # Crear el Combobox con el estilo personalizado
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=30)
    
    bt_install_versions = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_minecraft, vers.get()), window_versions.destroy()])
    bt_install_versions.pack(pady=10)

def install_fabric_versions():
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install Fabric')
    window_versions.grab_set()  # Para que quede por encima
    window_versions.resizable(False, False)  # Para que no se pueda cambiar el tamaño

    # Calcula la posición para centrar la ventana
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2)
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

    # Crear el Combobox con el estilo personalizado
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=30)

    bt_install_fabric = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_fabric, vers.get()), window_versions.destroy()])
    bt_install_fabric.pack(pady=10)

def install_forge_versions():
    window_versions = ctk.CTkToplevel(window)
    window_versions.geometry('300x150')
    window_versions.title('Install Forge')
    window_versions.grab_set()  # Para que quede por encima
    window_versions.resizable(False, False)  # Para que no se pueda cambiar el tamaño

    # Calcula la posición para centrar la ventana
    window_width = window_versions.winfo_reqwidth()
    window_height = window_versions.winfo_reqheight()
    position_right = int(window_versions.winfo_screenwidth()/2 - window_width/2)
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

    # Crear el Combobox con el estilo personalizado
    versions_drop = ttk.Combobox(window_versions, textvariable=vers, values=versions_list, state='readonly', style='Custom.TCombobox')
    versions_drop.pack(pady=30)

    bt_install_forge = ctk.CTkButton(window_versions, text='Install', command=lambda: [start_installation(install_forge, vers.get()), window_versions.destroy()])
    bt_install_forge.pack(pady=10)

def open_directory():
    appdata = os.environ["APPDATA"]
    directorio = os.path.join(appdata, ".minecraft")
    # Verificar si el directorio existe
    if os.path.exists(directorio):
        # Abrir el directorio
        subprocess.Popen(['explorer', directorio])
    else:
        print(f"Directory {directorio} does not exist")

# Configuración del menú
def menu():
    bt_install_versions.configure(command=install_normal_versions)
    bt_install_versions.place(x=690, y=20)

    bt_install_forge.configure(command=install_forge_versions)
    bt_install_forge.place(x=690, y=70)

    bt_install_fabric.configure(command=install_fabric_versions)
    bt_install_fabric.place(x=690, y=120)

    label_name.place(x=20, y=10)
    entry_name.place(x=20, y=40)

    label_ram.place(x=20, y=100)
    entry_ram.place(x=20, y=130)

    bt_run_minecraft.configure(command=run_minecraft)
    bt_run_minecraft.place(x=690, y=450)

    bt_main_path.configure(command=open_directory)
    bt_main_path.place(x=350, y=450)

    versions_dropdown_menu.place(x=20, y=450)
    
    window.mainloop()

menu()
