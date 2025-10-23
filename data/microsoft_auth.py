from PyQt5.QtWidgets import QApplication, QDialog, QVBoxLayout, QLabel, QMessageBox, QWidget
from PyQt5.QtCore import QLocale, Qt, pyqtSignal, QThread
from PyQt5.QtGui import QIcon, QPixmap
from tkinter import messagebox
from variables import write_log
from lang import lang, current_language
import minecraft_launcher_lib
import json
import sys
import os
import variables
import webbrowser
import http.server
import threading
import urllib.parse
from material_design import AnimatedButton

config_dir = os.path.join(variables.app_directory, "config")

# Constants
CLIENT_ID = "3f59fbe7-2c4b-4343-9a61-c03104ddaedf"
REDIRECT_URL = "http://localhost:8080/callback"

class AuthCallback:
    def __init__(self):
        self.event = threading.Event()
        self.auth_code = None
        self.state = None
        self.error = None

auth_callback = AuthCallback()

class LoginThread(QThread):
    finished = pyqtSignal(object)
    error = pyqtSignal(str)

    def __init__(self, parent):
        super().__init__()
        self.parent = parent

    def run(self):
        self.do_login()

    def do_login(self):
        refresh_token_file = os.path.join(config_dir, "refresh_token.json")

        if os.path.isfile(refresh_token_file):
            with open(refresh_token_file, "r", encoding="utf-8") as f:
                refresh_token = json.load(f)
                try:
                    account_info = minecraft_launcher_lib.microsoft_account.complete_refresh(CLIENT_ID, None, REDIRECT_URL, refresh_token)
                    self.finished.emit(account_info)
                    return
                except minecraft_launcher_lib.exceptions.InvalidRefreshToken:
                    pass  # Ignore invalid refresh token and proceed to login

        # Need to login
        global auth_callback
        auth_callback = AuthCallback()
        login_url, state, code_verifier = minecraft_launcher_lib.microsoft_account.get_secure_login_data(CLIENT_ID, REDIRECT_URL)
        login_url += "&prompt=select_account"

        # Start server
        server = http.server.HTTPServer(('localhost', 8080), CallbackHandler)
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()

        # Open browser
        webbrowser.open(login_url)

        # Wait for callback
        if auth_callback.event.wait(timeout=300):
            if auth_callback.error:
                self.error.emit(lang(self.parent.system_lang, "login_error"))
            elif auth_callback.auth_code and auth_callback.state == state:
                try:
                    account_info = minecraft_launcher_lib.microsoft_account.complete_login(CLIENT_ID, None, REDIRECT_URL, auth_callback.auth_code, code_verifier)
                    if "refresh_token" in account_info:
                        with open(refresh_token_file, "w", encoding="utf-8") as f:
                            json.dump(account_info["refresh_token"], f, ensure_ascii=False, indent=4)
                    self.finished.emit(account_info)
                except Exception:
                    self.error.emit(lang(self.parent.system_lang, "login_error"))
            else:
                self.error.emit(lang(self.parent.system_lang, "invalid_state"))
        else:
            self.error.emit(lang(self.parent.system_lang, "timeout_error"))

        # Stop server
        server.shutdown()
        server.server_close()

class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_callback
        write_log(f"Callback received: {self.path}", "latest")  # Log the callback path
        if self.path == '/favicon.ico':
            self.send_response(204)  # No Content
            self.end_headers()
            return  # Ignore favicon requests

        if self.path.startswith('/callback'):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            code = params.get('code', [None])[0]
            state = params.get('state', [None])[0]
            error = params.get('error', [None])[0]
            write_log(f"Parsed params - code: {code}, state: {state}, error: {error}", "latest")  # Log parsed parameters
            if error:
                auth_callback.error = error
            else:
                auth_callback.auth_code = code
                auth_callback.state = state
            auth_callback.event.set()
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            if error:
                self.wfile.write(b'<html><body><h1>Login Failed</h1><p>You can close this window.</p></body></html>')
            else:
                self.wfile.write(b'<html><body><h1>Login Successful</h1><p>You can close this window.</p></body></html>')
        else:
            write_log("Invalid callback path", "latest")  # Log invalid callback
            self.send_response(404)
            self.end_headers()

def login(system_lang, icon, main_window):
    """Start the Microsoft authentication process."""
    write_log("Starting Microsoft authentication process.", "latest")
    main_window.start_auth_flow()