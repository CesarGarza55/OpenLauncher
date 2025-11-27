from cx_Freeze import setup, Executable
from data import variables
import os
import time
import hmac
import hashlib


def generate_build_secret():
    """Generate data/build_secret.py containing BUILD_ID and BUILD_SIGNATURE using SIGN_KEY from .env"""
    env_path = '.env'
    sign_key = None
    if os.path.isfile(env_path):
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        k, v = line.split('=', 1)
                        if k.strip() == 'SIGN_KEY':
                            sign_key = v.strip()
                            break
        except Exception:
            sign_key = None

    if not sign_key:
        print('No SIGN_KEY found in .env — skipping build signing (data/build_secret.py will not be created).')
        return

    build_id = time.strftime('%Y%m%d_%H%M%S')
    signature = hmac.new(sign_key.encode('utf-8'), build_id.encode('utf-8'), hashlib.sha256).hexdigest()
    try:
        os.makedirs('data', exist_ok=True)
        with open(os.path.join('data', 'build_secret.py'), 'w', encoding='utf-8') as f:
            f.write(f'BUILD_ID = "{build_id}"\n')
            f.write(f'BUILD_SIGNATURE = "{signature}"\n')
        print(f'Build signed with BUILD_ID: {build_id} and BUILD_SIGNATURE: {signature}')
    except Exception as e:
        print('Failed to write data/build_secret.py:', e)


# Generate build secret before running setup (so build_exe includes the file)
generate_build_secret()

def include_files(source_folder, target_folder):
    files = []
    for root, _, filenames in os.walk(source_folder):
        for filename in filenames:
            source_path = os.path.join(root, filename)
            relative_path = os.path.relpath(source_path, source_folder)
            target_path = os.path.join(target_folder, relative_path)
            files.append((source_path, target_path))
    return files

additional_files = []
for file in os.listdir("data"):
    if file.endswith(".py") and file != "main.py" and file != "no_api_microsoft_auth.py":
        additional_files.append((f"data/{file}", f"lib/{file}"))
additional_files += include_files("data/img", "lib/img/")

executables = [
    Executable(
        script="data/main.py",
        base="Win32GUI",
        target_name="OpenLauncher.exe",
        icon="data/img/icon.ico"
    )
]

setup(
    name="OpenLauncher",
    version=f"{variables.version}",
    description="",
    options={
        "build_exe": {
            "packages": [
                "tkinter", "minecraft_launcher_lib", "pypresence", "requests", "PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets", "PyQt5.QtWebEngineWidgets", "webbrowser",
                "pathlib", "time", "json", "os", "sys", "threading", "http.server", "urllib.parse", "subprocess", "shutil"
            ],
            "include_files": additional_files,
            "build_exe": "output-build"
        }
    },
    executables=executables
)