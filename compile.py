from cx_Freeze import setup, Executable
from data import variables
import os

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
    if file.endswith(".py") and file != "main.py":
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