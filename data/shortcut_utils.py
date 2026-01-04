"""Utilities for creating desktop shortcuts that launch Minecraft directly with OpenLauncher."""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
import tempfile
from typing import List

import variables


class ShortcutCreationError(Exception):
    """Raised when a desktop shortcut cannot be created."""


def _launcher_command_parts() -> List[str]:
    """Return the command used to invoke the launcher in the current environment."""
    if getattr(sys, "frozen", False):
        return [sys.executable]
    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "main.py"))
    return [sys.executable, script_path]


def _build_launch_arguments(profile_key: str, mc_version: str, use_online: bool,
                             offline_username: str | None) -> List[str]:
    args: List[str] = [
        "launch",
        "--profile",
        profile_key,
        "--mc-version",
        mc_version,
    ]
    if use_online:
        args.append("--online")
    elif offline_username:
        args.extend(["--username", offline_username])
    return args


def _sanitize_shortcut_name(name: str) -> str:
    cleaned = name.strip() or "OpenLauncher"
    invalid = '<>:"/\\|?*'
    return "".join(("_" if ch in invalid else ch) for ch in cleaned)


def _get_desktop_dir() -> str:
    home = os.path.expanduser("~")
    candidates = []
    if sys.platform == "win32":
        candidates.append(os.path.join(os.environ.get("USERPROFILE", home), "Desktop"))
    else:
        try:
            result = subprocess.check_output(["xdg-user-dir", "DESKTOP"], text=True).strip()
            if result:
                candidates.append(result)
        except Exception:
            pass
        candidates.append(os.path.join(home, "Desktop"))
    for candidate in candidates:
        if not candidate:
            continue
        try:
            os.makedirs(candidate, exist_ok=True)
            return candidate
        except Exception:
            continue
    raise ShortcutCreationError("Unable to locate a writable desktop directory")


def _quote_windows_argument(arg: str) -> str:
    if not arg or " " in arg or "\t" in arg:
        return f'"{arg}"'
    return arg


def _quote_unix_arguments(parts: List[str]) -> str:
    return " ".join(shlex.quote(part) for part in parts)


def _resolve_windows_icon_path() -> str:
    """Return an icon source usable by Windows shortcuts."""
    if getattr(sys, "frozen", False):
        exe_path = os.path.abspath(sys.executable)
        if os.path.isfile(exe_path):
            return exe_path

    icon_path = getattr(variables, "icon", "")
    if icon_path:
        base, _ = os.path.splitext(icon_path)
        ico_candidate = base + ".ico"
        for candidate in (ico_candidate, icon_path):
            candidate = os.path.abspath(candidate)
            if os.path.isfile(candidate):
                return candidate

    return os.path.abspath(sys.executable)


def _create_windows_shortcut(path: str, base_cmd: List[str], extra_args: List[str]) -> None:
    target = base_cmd[0]
    arguments = " ".join(_quote_windows_argument(part) for part in (base_cmd[1:] + extra_args))
    working_dir = variables.app_directory
    icon_path = _resolve_windows_icon_path()

    script = f"""
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{path}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "{target}"
oLink.Arguments = "{arguments}"
oLink.WorkingDirectory = "{working_dir}"
oLink.IconLocation = "{icon_path}"
oLink.Save
"""
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".vbs", encoding="utf-8") as temp_script:
        temp_script.write(script)
        temp_path = temp_script.name
    try:
        subprocess.run(["cscript", "//Nologo", temp_path], check=True)
    except subprocess.CalledProcessError as exc:
        raise ShortcutCreationError("Failed to create Windows shortcut") from exc
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


def _create_linux_shortcut(path: str, base_cmd: List[str], extra_args: List[str], name: str) -> None:
    exec_command = _quote_unix_arguments(base_cmd + extra_args)
    icon_path = os.path.abspath(variables.icon)
    display_name = name.strip() or "OpenLauncher"
    desktop_entry = """[Desktop Entry]
Type=Application
Version=1.0
Name={name}
Comment=Launch Minecraft directly with OpenLauncher
Exec={exec_cmd}
Icon={icon_path}
Path={work_dir}
Terminal=false
Categories=Game;
""".format(
        name=display_name,
        exec_cmd=exec_command,
        icon_path=icon_path,
        work_dir=variables.app_directory,
    )
    try:
        with open(path, "w", encoding="utf-8") as desktop_file:
            desktop_file.write(desktop_entry)
        os.chmod(path, 0o755)
    except Exception as exc:
        raise ShortcutCreationError("Failed to create .desktop file") from exc


def create_launch_shortcut(profile_key: str, mc_version: str, shortcut_name: str,
                           *, use_online: bool, offline_username: str | None) -> str:
    """Create a desktop shortcut that starts the launcher in direct-run mode."""
    if not profile_key:
        raise ShortcutCreationError("Profile key is required")
    if not mc_version:
        raise ShortcutCreationError("Minecraft version is required")
    if not use_online and not offline_username:
        raise ShortcutCreationError("Offline username is required for offline shortcuts")

    base_cmd = _launcher_command_parts()
    extra_args = _build_launch_arguments(profile_key, mc_version, use_online, offline_username)
    desktop_dir = _get_desktop_dir()
    safe_name = _sanitize_shortcut_name(shortcut_name)

    if sys.platform == "win32":
        shortcut_path = os.path.join(desktop_dir, f"{safe_name}.lnk")
        _create_windows_shortcut(shortcut_path, base_cmd, extra_args)
    else:
        shortcut_path = os.path.join(desktop_dir, f"{safe_name}.desktop")
        _create_linux_shortcut(shortcut_path, base_cmd, extra_args, shortcut_name)

    variables.write_log(f"Created launch shortcut at {shortcut_path}", "shortcuts")
    return shortcut_path
