"""
Lightweight Microsoft authentication example without using external APIs.
Intended for custom Microsoft Entra applications where you manage CLIENT_ID and REDIRECT_URL.
Make sure to set the correct permissions/scopes for Xbox Live / Minecraft in your app registration.
Refer to the README.md for setup instructions.
References:
- https://minecraft-launcher-lib.readthedocs.io/en/stable/tutorial/microsoft_login.html

If you want to use your own Microsoft Entra app, copy this file to `data/microsoft_auth.py`
and update CLIENT_ID and REDIRECT_URL accordingly.

Note: OpenLauncher does not use this file by default; it's an example for custom app 
integration, we use our own API app in production for better control and security over the auth flow.
"""

import sys
from PyQt5.QtCore import pyqtSignal, QThread
from variables import write_log
from lang import lang
import minecraft_launcher_lib
import json
import os
import variables
import webbrowser
import http.server
import threading
import urllib.parse

# Redirect sys.stderr and sys.stdout to a log file in the compiled environment
if getattr(sys, 'frozen', False):  # Check if running in a frozen/compiled state
    log_file = os.path.join(variables.config_dir, 'server.log')
    sys.stdout = open(log_file, 'a', encoding='utf-8')
    sys.stderr = open(log_file, 'a', encoding='utf-8')

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


# Use centralized token storage helpers from variables.py (keyring + safe file fallback)

class LoginThread(QThread):
    finished = pyqtSignal(object)
    error = pyqtSignal(str)

    def __init__(self, parent):
        super().__init__()
        self.parent = parent

    def run(self):
        self.do_login()

    def do_login(self):
        # Try loading a stored refresh token (keyring first, fallback file)
        refresh_token = variables.load_refresh_token()

        if refresh_token:
            try:
                account_info = minecraft_launcher_lib.microsoft_account.complete_refresh(CLIENT_ID, None, REDIRECT_URL, refresh_token)
                self.finished.emit(account_info)
                return
            except minecraft_launcher_lib.exceptions.InvalidRefreshToken:
                # Stored token is invalid, remove it and continue to interactive login
                variables.delete_refresh_token()
                pass

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
                        # Save refresh token securely (keyring or protected file)
                        variables.save_refresh_token(account_info["refresh_token"])
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
            if error:
                auth_callback.error = error
            else:
                auth_callback.auth_code = code
                auth_callback.state = state
            auth_callback.event.set()
            # Redirect the user's browser to the provided URL on success.
            if error:
                # Keep showing a simple failure page when there's an error
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                try:
                    redirect_url = 'https://openlauncher.codevbox.com/login-failed'  # Desired redirect URL after failed login
                    # Send a 302 redirect to the desired location
                    self.send_response(302)
                    self.send_header('Location', redirect_url)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    # Also include a small HTML page with a link in case automatic redirects are blocked
                    body = (f"<html><head><meta http-equiv=\"refresh\" content=\"0;url={redirect_url}\" />"
                            f"</head><body>If you are not redirected automatically, <a href=\"{redirect_url}\">click here</a>.</body></html>")
                    self.wfile.write(body.encode('utf-8'))
                except Exception:
                    # Fallback to a simple failure page if redirect fails
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(b'<html><body><h1>Login Failed</h1><p>You can close this window.</p></body></html>')
            else:
                try:
                    redirect_url = 'https://openlauncher.codevbox.com/login-success'  # Desired redirect URL after successful login
                    # Send a 302 redirect to the desired location
                    self.send_response(302)
                    self.send_header('Location', redirect_url)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    # Also include a small HTML page with a link in case automatic redirects are blocked
                    body = (f"<html><head><meta http-equiv=\"refresh\" content=\"0;url={redirect_url}\" />"
                            f"</head><body>If you are not redirected automatically, <a href=\"{redirect_url}\">click here</a>.</body></html>")
                    self.wfile.write(body.encode('utf-8'))
                except Exception:
                    # Fallback to a simple success page if redirect fails
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(b'<html><body><h1>Login Successful</h1><p>You can close this window.</p></body></html>')
        else:
            write_log("Invalid callback path", "latest")  # Log invalid callback
            self.send_response(404)
            self.end_headers()

def login(system_lang, icon, main_window):
    """Start the Microsoft authentication process."""
    write_log("Starting Microsoft authentication process.", "latest")
    main_window.start_auth_flow()