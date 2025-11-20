import sys
from PyQt5.QtCore import pyqtSignal, QThread
from variables import write_log
from lang import lang
import os
import variables
import webbrowser
import http.server
import threading
import urllib.parse
import requests

# Redirect sys.stderr and sys.stdout to a log file in the compiled environment
if getattr(sys, 'frozen', False):  # Check if running in a frozen/compiled state
    log_file = os.path.join(variables.config_dir, 'server.log')
    sys.stdout = open(log_file, 'a', encoding='utf-8')
    sys.stderr = open(log_file, 'a', encoding='utf-8')

# Constants
# CLIENT_ID intentionally removed from client. Use a remote auth API that keeps
# the client secret/ID on the server. Configure the API base URL via
# environment variable OPENLAUNCHER_AUTH_API or it defaults to the public API.
AUTH_API_BASE = 'https://openlauncher.api.codevbox.com'
# Local redirect where the launcher listens for the final redirect from the API
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

    def __init__(self, parent, profile_key=None, force_interactive=False):
        super().__init__()
        self.parent = parent
        # optional profile key to scope refresh tokens
        self.profile_key = profile_key
        # when True, skip any refresh-token automatic flow and force the interactive browser login
        self.force_interactive = bool(force_interactive)

    def run(self):
        self.do_login()

    def do_login(self):
        # Try loading a stored refresh token (keyring first, fallback file)
        # If force_interactive is requested, skip automatic refresh and go straight to interactive login.
        refresh_token = None
        if not getattr(self, 'force_interactive', False):
            # load profile-scoped when possible
            if getattr(self, 'profile_key', None):
                try:
                    refresh_token = variables.load_refresh_token_for(self.profile_key)
                except Exception:
                    refresh_token = None
            if not refresh_token:
                try:
                    refresh_token = variables.load_refresh_token()
                except Exception:
                    refresh_token = None

        # Quick check: ensure we can write to the config directory where
        # refresh tokens are stored. If not, show a clear, human-friendly
        # error so the user knows it's a permissions issue.
        try:
            os.makedirs(variables.config_dir, exist_ok=True)
            test_path = os.path.join(variables.config_dir, '.__ol_write_test')
            with open(test_path, 'w', encoding='utf-8') as _tf:
                _tf.write('ok')
            try:
                os.remove(test_path)
            except Exception:
                pass
        except Exception:
            self.error.emit(lang(self.parent.system_lang, 'login_error_no_system_access'))
            return

        if refresh_token:
            try:
                # Ask the remote auth API to complete a refresh using the stored refresh token.
                resp = requests.post(
                    f"{AUTH_API_BASE}/refresh",
                    json={"refresh_token": refresh_token},
                    timeout=15,
                    headers=variables.get_auth_headers(),
                )
                resp.raise_for_status()
                account_info = resp.json()
                # Save any returned refresh token (API may rotate it)
                if "refresh_token" in account_info:
                    # save token scoped to the profile if available
                    if getattr(self, 'profile_key', None):
                        variables.save_refresh_token_for(self.profile_key, account_info["refresh_token"])
                    else:
                        variables.save_refresh_token(account_info["refresh_token"])
                self.finished.emit(account_info)
                return
            except requests.RequestException:
                # Stored token is invalid or API refused it; remove it and continue to interactive login
                if getattr(self, 'profile_key', None):
                    variables.delete_refresh_token_for(self.profile_key)
                else:
                    variables.delete_refresh_token()
                # fallthrough to interactive login
                pass

        # Need to login via remote auth API to keep client_id on server.
        global auth_callback
        auth_callback = AuthCallback()

        # Ask the auth API to start a login. The API will present Microsoft's login page
        # and then redirect back to the API which will in turn redirect the browser to
        # the launcher's local callback (REDIRECT_URL) with the code and state.
        # Ensure this is an official compiled launcher that supplies the
        # build secret headers; if not present, emit a clear error.
        auth_headers = variables.get_auth_headers()
        if not auth_headers:
            # Not an official/frozen launcher with a build secret
            self.error.emit(lang(self.parent.system_lang, 'login_error_official_only'))
            return

        try:
            start_resp = requests.get(
                f"{AUTH_API_BASE}/start",
                params={"launcher_redirect_uri": REDIRECT_URL},
                timeout=15,
                headers=auth_headers,
            )
            start_resp.raise_for_status()
            data = start_resp.json()
            login_url = data.get("url")
            state = data.get("state")
        except requests.RequestException as e:
            # Network or server error; emit a readable message and include
            # a short detail for debugging (not a raw stack trace).
            msg = lang(self.parent.system_lang, 'login_error_network')
            self.error.emit(msg)
            return

        if not login_url:
            self.error.emit(lang(self.parent.system_lang, "login_error"))
            return

        # Start server to receive the final redirect from the API (which will redirect
        # the browser to our local REDIRECT_URL with the authorization code)
        server = http.server.HTTPServer(('localhost', 8080), CallbackHandler)
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()

        # Open browser
        webbrowser.open(login_url)

        # Wait for callback
        if auth_callback.event.wait(timeout=300):
            if auth_callback.error:
                # The callback reported an error; surface it clearly.
                self.error.emit(lang(self.parent.system_lang, 'login_error') + f": {auth_callback.error}")
            elif auth_callback.auth_code and auth_callback.state == state:
                try:
                    # Ask the remote API to complete the login exchange using the code.
                    complete_resp = requests.post(
                        f"{AUTH_API_BASE}/complete",
                        json={
                            "code": auth_callback.auth_code,
                            "state": auth_callback.state,
                        },
                        timeout=15,
                        headers=variables.get_auth_headers(),
                    )
                    complete_resp.raise_for_status()
                    account_info = complete_resp.json()
                    if "refresh_token" in account_info:
                        if getattr(self, 'profile_key', None):
                            variables.save_refresh_token_for(self.profile_key, account_info["refresh_token"])
                        else:
                            variables.save_refresh_token(account_info["refresh_token"])
                    self.finished.emit(account_info)
                except requests.RequestException as e:
                    self.error.emit(lang(self.parent.system_lang, 'login_error_network') + f": {str(e)}")
                except Exception as e:
                    # Generic fallback with readable text
                    self.error.emit(lang(self.parent.system_lang, 'login_error') + f": {str(e)}")
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
    # Force interactive login when invoked programmatically
    try:
        main_window._auth_force_interactive = True
    except Exception:
        pass
    main_window.start_auth_flow()