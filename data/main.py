"""Unified entry point for OpenLauncher.

This module parses CLI arguments before importing any PyQt modules so the same
binary can safely act as either the graphical launcher or a direct Minecraft
runner on Windows (cx_Freeze) and Linux (PyInstaller or .deb installs).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from tkinter import messagebox

import minecraft_launcher_lib
import requests

import variables
from config_manager import ConfigManager
from discord_manager import DiscordManager
from lang import change_language, current_language, lang
from mc_run import run_minecraft
from microsoft_auth import AUTH_API_BASE
from updater import update


class HeadlessArgumentParser(argparse.ArgumentParser):
    """Argument parser that mirrors help text in a dialog when no console exists."""

    def print_help(self, file=None):
        help_text = self.format_help()
        super()._print_message(help_text, file or sys.stdout)
        if not has_console_output():
            show_help_dialog(help_text)


def has_console_output() -> bool:
    stdout_tty = hasattr(sys.stdout, "isatty") and sys.stdout.isatty()
    stderr_tty = hasattr(sys.stderr, "isatty") and sys.stderr.isatty()
    return stdout_tty or stderr_tty


def show_help_dialog(text: str) -> None:
    if sys.platform != "win32":
        return
    try:
        from tkinter import Tk

        root = Tk()
        root.withdraw()
        messagebox.showinfo("OpenLauncher", text)
        root.destroy()
    except Exception:
        pass


def report_cli_message(message: str, *, error: bool = False) -> None:
    stream = sys.stderr if error else sys.stdout
    print(message, file=stream)
    if has_console_output():
        return
    try:
        from tkinter import Tk

        root = Tk()
        root.withdraw()
        if error:
            messagebox.showerror("OpenLauncher", message)
        else:
            messagebox.showinfo("OpenLauncher", message)
        root.destroy()
    except Exception:
        pass


def build_argument_parser() -> argparse.ArgumentParser:
    parser = HeadlessArgumentParser(
        prog="OpenLauncher",
        description=(
            "Run OpenLauncher in GUI mode (default) or use the 'launch' subcommand "
            "to start Minecraft directly without opening the interface."
        ),
    )
    subparsers = parser.add_subparsers(dest="command")
    subparsers.required = False

    launch_parser = subparsers.add_parser(
        "launch",
        help="Run Minecraft directly without opening the GUI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    launch_parser.add_argument("--profile", required=True, help="Profile key to use for this launch")
    launch_parser.add_argument(
        "--mc-version",
        required=True,
        help="Minecraft version identifier (e.g. 1.20.4)",
    )
    launch_parser.add_argument(
        "--username",
        help="Offline username override. Defaults to the profile name when not playing online.",
    )
    launch_parser.add_argument(
        "--online",
        action="store_true",
        help="Use the stored Microsoft session for the selected profile.",
    )
    launch_parser.add_argument(
        "--jvm-args",
        help="Override JVM arguments just for this launch (quoted string)",
    )
    launch_parser.add_argument(
        "--mc-dir",
        help="Custom Minecraft directory. Defaults to the launcher-managed directory.",
    )
    return parser


def migrate_legacy_refresh_token(config_manager: ConfigManager) -> None:
    """Move a legacy global refresh token into the active profile once."""

    active_profile = None
    try:
        if hasattr(config_manager, "get_active_profile_key"):
            active_profile = config_manager.get_active_profile_key()
    except Exception as exc:
        variables.write_log(
            f"Unable to determine active profile for token migration: {exc}",
            "auth_migration",
        )
        return

    if not active_profile:
        return

    try:
        existing_profile_token = variables.load_refresh_token_for(active_profile)
    except Exception:
        existing_profile_token = None

    if existing_profile_token:
        return

    try:
        legacy_token = variables.load_refresh_token()
    except Exception:
        legacy_token = None

    if not legacy_token:
        return

    try:
        variables.save_refresh_token_for(active_profile, legacy_token)
        variables.delete_refresh_token()
        variables.write_log(
            f"Migrated legacy refresh token into profile '{active_profile}' and removed global token",
            "auth_migration",
        )
    except Exception as exc:
        variables.write_log(
            f"Failed migrating legacy refresh token into profile '{active_profile}': {exc}",
            "auth_migration",
        )


def create_config_manager() -> ConfigManager:
    config_manager = ConfigManager(variables.app_directory)
    migrate_legacy_refresh_token(config_manager)
    return config_manager


def refresh_profile_session(profile_key: str) -> dict:
    refresh_token = variables.load_refresh_token_for(profile_key)
    if not refresh_token:
        raise RuntimeError(
            f"No refresh token stored for profile '{profile_key}'. Launch the GUI and sign in first."
        )

    client_resp = requests.get(
        f"{AUTH_API_BASE}/get-client-id",
        timeout=15,
        headers=variables.get_auth_headers(),
    )
    client_resp.raise_for_status()
    client_id = client_resp.json().get("client_id")
    if not client_id:
        raise RuntimeError("Authentication service returned an invalid client identifier.")

    session = minecraft_launcher_lib.microsoft_account.complete_refresh(
        client_id,
        None,
        "http://localhost:8080/callback",
        refresh_token,
    )
    if not session or "access_token" not in session:
        raise RuntimeError("Unable to refresh Microsoft session for this profile.")

    if "refresh_token" in session:
        variables.save_refresh_token_for(profile_key, session["refresh_token"])
    return session


# Function to handle exceptions

def handle_exception(exc_type, exc_value, exc_traceback):
    """Log exceptions instead of crashing"""

    variables.write_log(f"Exception: {exc_type}, {exc_value}", "exception")


# sys.excepthook = handle_exception


def _normalize_jvm_arguments(value):
    if isinstance(value, (list, tuple)):
        return " ".join(value)
    if isinstance(value, str) and value.strip():
        return value
    return " ".join(variables.defaultJVM)


def run_direct_launch(args: argparse.Namespace) -> int:
    config_manager = create_config_manager()
    profile_key = args.profile
    profile = config_manager.get_profile(profile_key)
    if not profile:
        report_cli_message(f"Profile '{profile_key}' was not found.", error=True)
        return 1

    mc_version = args.mc_version
    username = args.username or profile.get("account_name", "")
    jvm_args = args.jvm_args or _normalize_jvm_arguments(profile.get("jvm_arguments", []))
    minecraft_dir = args.mc_dir or None

    access_token = None
    if args.online:
        try:
            session = refresh_profile_session(profile_key)
            access_token = session.get("access_token")
            username = session.get("name", username)
        except Exception as exc:
            report_cli_message(str(exc), error=True)
            return 1
        if not access_token:
            report_cli_message("Authentication did not return an access token.", error=True)
            return 1
    elif not username:
        report_cli_message(
            "A username is required in offline mode. Provide --username or set one on the selected profile.",
            error=True,
        )
        return 1

    result = run_minecraft(
        mc_version,
        username,
        jvm_args,
        access_token,
        minecraft_dir,
        headless=True,
        wait_for_exit=True,
    )

    if isinstance(result, int):
        return result

    if isinstance(result, str):
        error_map = {
            "No version": lang(current_language, "no_version"),
            "MC_FAIL": lang(current_language, "mc_fail"),
            "USERNAME_REQUIRED": lang(current_language, "offline_mode_error"),
            "JAVA_NOT_INSTALLED": lang(current_language, "java_not_installed"),
        }
        report_cli_message(error_map.get(result, lang(current_language, "error_occurred") + result), error=True)
        return 1

    return 0


def launch_gui_mode() -> None:
    from PyQt5.QtWidgets import QApplication

    from main_window import MainWindow
    from material_design import apply_material_theme
    from ui_methods import LoadingScreen, MainWindowLoader

    system_lang = current_language
    config_manager = create_config_manager()
    config = config_manager.load_config()

    if config.get("first_time", True):
        pass
    elif config.get("lang", ""):
        change_language(config["lang"])
        system_lang = config["lang"]
    else:
        change_language("en")
        system_lang = "en"
        config["lang"] = "en"
        config_manager.save_config(config)

    if config_manager.get_ask_update() == "yes":
        update()

    discord_manager = DiscordManager()
    icon = variables.icon

    versions = []
    forge_versions = []
    fabric_versions = []
    fabric_loaders = []

    def load_versions_async():
        nonlocal versions, forge_versions, fabric_versions, fabric_loaders
        try:
            versions = minecraft_launcher_lib.utils.get_version_list()
            forge_versions = minecraft_launcher_lib.forge.list_forge_versions()
            fabric_versions = minecraft_launcher_lib.fabric.get_all_minecraft_versions()
            fabric_loaders = minecraft_launcher_lib.fabric.get_all_loader_versions()
        except Exception as exc:
            variables.write_log(f"Error loading versions: {exc}", "version_load")
            versions = []
            forge_versions = []
            fabric_versions = []
            fabric_loaders = []

    def show_main_window(loading_screen, window):
        if sys.platform == "linux":
            time.sleep(2)
        loading_screen.close()
        window.show()

    def initialize_main_window(loading_screen, app, version_loader):
        version_loader.wait()

        window = MainWindow(
            icon,
            system_lang,
            versions,
            forge_versions,
            fabric_versions,
            fabric_loaders,
            discord_manager,
            config_manager,
            app,
        )

        loading_screen.loader_thread = MainWindowLoader()
        loading_screen.loader_thread.finished.connect(
            lambda: show_main_window(loading_screen, window)
        )
        loading_screen.loader_thread.start()

        return window

    app = QApplication(sys.argv)
    apply_material_theme(app)

    loading_screen = LoadingScreen()
    loading_screen.show()
    app.processEvents()

    from PyQt5.QtCore import QThread

    class VersionLoader(QThread):
        def run(self):
            load_versions_async()

    version_loader = VersionLoader()
    version_loader.start()

    window = initialize_main_window(loading_screen, app, version_loader)

    while loading_screen.isVisible():
        app.processEvents()

    if config.get("first_time", True):
        window.add_get_started_tab()
        config["first_time"] = True
        config["lang"] = system_lang
        config_manager.save_config(config)

    window.show()
    window.update_error_discord()
    discord_manager.register_cleanup()

    sys.exit(app.exec_())


def main(argv: list[str] | None = None) -> None:
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    if getattr(args, "command", None) == "launch":
        sys.exit(run_direct_launch(args))

    launch_gui_mode()


if __name__ == "__main__":
    main()
