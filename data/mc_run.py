import variables
import os, sys, subprocess, webbrowser, uuid, requests, time
import minecraft_launcher_lib
from PyQt5.QtCore import QObject, pyqtSignal
from tkinter import messagebox
from lang import lang, current_language
import threading

user_uuid = None

class WorkerSignals(QObject):
    finished = pyqtSignal()
    error = pyqtSignal(str)

def write_log(text = "", log_type = "latest"):
    text = f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {text}\n"
    os.makedirs(f'{variables.app_directory}/logs', exist_ok=True)
    with open(f'{variables.app_directory}/logs/{log_type}.log', 'a') as f:
        f.write(text)

def generate_uuid(name):
    try:
        global user_uuid
        resp = requests.get(f"https://api.mojang.com/users/profiles/minecraft/{name}")
        user_uuid = resp.json()["id"]
    except KeyError:
        user_uuid = str(uuid.uuid4())

def is_java_installed():
    try:
        output = subprocess.check_output('java -version', stderr=subprocess.STDOUT, shell=True)
        return 'version' in output.decode('UTF-8').lower()
    except Exception:
        return False

def run_minecraft(mc_ver, mc_name, jvm_args=None, online=None, mc_dir=None):
    global user_uuid

    signals = WorkerSignals()

    if not mc_dir:
        minecraft_directory = variables.minecraft_directory
    else:
        minecraft_directory = mc_dir
    
    if not os.path.exists(minecraft_directory):
        os.makedirs(minecraft_directory)
    
    if not mc_ver:
        return "No version"
    
    if mc_name:
        generate_uuid(mc_name)

    if not jvm_args:
        arg = variables.defaultJVM
    else:
        arg = jvm_args
        arg = list(filter(None, arg.split(" ")))
    if not online or online == "false":
        online = ""
        if not mc_name:
            messagebox.showerror(lang(current_language,"offline_mode"), lang(current_language,"offline_mode_error"))
            sys.exit()

    if not is_java_installed():
        if sys.platform == 'win32':
            if messagebox.askyesno(lang(current_language,"java_not_installed"), lang(current_language,"ask_install_java")):
                webbrowser.open('https://www.java.com/es/download/')
            else:
                messagebox.showerror(lang(current_language,"java_not_installed"), lang(current_language,"java_not_installed_win"))
                sys.exit()
        elif sys.platform == 'linux':
            messagebox.showinfo(lang(current_language,"java_not_installed"), lang(current_language,"java_not_installed_linux"))
            sys.exit()
        return

    if mc_ver:
        options = {
            'username': mc_name,
            'uuid': user_uuid,
            'token': online,
            'jvmArguments': arg,
            'launcherName': "OpenLauncher for Minecraft",
            'launcherVersion': variables.launcher_version
        }

        try:
            minecraft_command = minecraft_launcher_lib.command.get_minecraft_command(mc_ver, minecraft_directory, options)

            def run_command(command):
                process = None
                try:
                    if sys.platform == 'win32':
                        startupinfo = subprocess.STARTUPINFO()
                        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, startupinfo=startupinfo, universal_newlines=True)
                    elif sys.platform == 'linux':
                        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

                    for line in iter(process.stdout.readline, ''):
                        print(line.strip())
                    process.stdout.close()
                    process.wait()
                except Exception as e:
                    signals.error.emit(f"Could not start Minecraft: {e}")
                finally:
                    if process:
                        process.stdout.close()
                        process.stderr.close()
                        process.wait()
                    signals.finished.emit()

            thread = threading.Thread(target=run_command, args=(minecraft_command,))
            thread.start()

        except Exception as e:
            return "MC_FAIL"

def on_minecraft_error(self, error_message):
    write_log(error_message, "minecraft_startup")