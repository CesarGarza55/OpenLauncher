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

additional_files = [
    ("data/updater.py", "lib/updater.py"),
    ("data/variables.py", "lib/variables.py"),
    ("data/mod_manager.py", "lib/mod_manager.py"),
    ("data/microsoft_auth.py", "lib/microsoft_auth.py"),
    ("data/lang.py", "lib/lang.py"),
    ("data/mc_run.py", "lib/mc_run.py")
] + include_files("data/img", "lib/img/")

executables = [
    Executable(
        script="data/OpenLauncher.py",
        base="Win32GUI",
        target_name="OpenLauncher.exe",
        icon="data/img/creeper.ico"
    )
]

setup(
    name="OpenLauncher",
    version=f"{variables.version}",
    description="",
    options={
        "build_exe": {
            "packages": ["tkinter", "minecraft_launcher_lib", "pypresence", "requests", "PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets","PyQt5.QtWebEngineWidgets"],
            "include_files": additional_files,
            "build_exe": "output-build"
        }
    },
    executables=executables
)