import json, random, string, requests, sys
import tkinter as tk
from tkinter import messagebox
from urllib.parse import parse_qs, urlparse
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import webbrowser

# Constants
CLIENT_ID = "e16699bb-2aa8-46da-b5e3-45cbcce29091"
AUTHORIZE_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize"
TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
XBOX_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate"
XBOX_XSTS_URL = "https://xsts.auth.xboxlive.com/xsts/authorize"
MC_AUTH_URL = "https://api.minecraftservices.com/authentication/login_with_xbox"
MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile"
LOGOUT_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/logout"
REDIRECT_URI = "http://localhost:8000/callback"
SCOPE = "XboxLive.signin offline_access"

class AuthWindow:
    def __init__(self, auth_url=None, state=None):
        self.state = state
        self.auth_code = None
        self.root = tk.Tk()
        self.root.title("Microsoft Authentication")
        self.root.geometry("400x200")  # Smaller window size

        self.label = tk.Label(self.root, text="Waiting for authentication...")
        self.label.pack(pady=20)

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        if auth_url:
            self.start_http_server()
            self.root.after(100, lambda: webbrowser.open(auth_url))  # Open browser after window is created

    def start_http_server(self):
        server_address = ('', 8000)
        self.httpd = HTTPServer(server_address, self.RequestHandler)
        self.httpd.auth_window = self
        threading.Thread(target=self.httpd.serve_forever).start()

    def on_close(self):
        self.auth_code = None
        self.root.quit()

    class RequestHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass # Suppress logging messages to prevent writing to a NoneType object

        def do_GET(self):
            try:
                parsed_url = urlparse(self.path)
                query = parse_qs(parsed_url.query)
                if "code" in query and "state" in query and query["state"][0] == self.server.auth_window.state:
                    self.server.auth_window.auth_code = query["code"][0]
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    if self.wfile:
                        try:
                            self.wfile.write(b"AUTHENTICATION SUCCESSFUL - You can close this window now.")
                        except:
                            messagebox.showerror("Success", "Authentication Successful - You can close this window now.")
                    self.server.auth_window.root.quit()
                else:
                    self.send_response(400)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    if self.wfile:
                        try:
                            self.wfile.write(b"AUTHENTICATION FAILED - Please try again.")
                        except:
                            messagebox.showerror("Error", "Authentication Failed - Please try again.")
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                if self.wfile:
                    self.wfile.write(f"<html><body><h1>Internal Server Error</h1><p>{str(e)}</p></body></html>".encode('utf-8'))

def generate_state_and_code_verifier():
    state = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    code_verifier = ''.join(random.choices(string.ascii_letters + string.digits, k=128))
    return state, code_verifier

def build_authorization_url(state, code_verifier):
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": REDIRECT_URI,
        "scope": SCOPE,
        "state": state,
        "code_challenge": code_verifier,
        "code_challenge_method": "plain"
    }
    auth_url = f"{AUTHORIZE_URL}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    return auth_url

def exchange_code_for_tokens(auth_code, code_verifier):
    data = {
        "client_id": CLIENT_ID,
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": code_verifier
    }
    response = requests.post(TOKEN_URL, data=data)
    return response.json()

def exchange_microsoft_token_for_xbox_token(access_token):
    xbox_data = {
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": f"d={access_token}"
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    }
    xbox_response = requests.post(XBOX_AUTH_URL, json=xbox_data)
    return xbox_response.json()

def exchange_xbox_token_for_xsts_token(xbox_token):
    xsts_data = {
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbox_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    }
    xsts_response = requests.post(XBOX_XSTS_URL, json=xsts_data)
    return xsts_response.json()

def exchange_xsts_token_for_mc_token(xsts_token, uhs):
    mc_data = {
        "identityToken": f"XBL3.0 x={uhs};{xsts_token}"
    }
    mc_response = requests.post(MC_AUTH_URL, json=mc_data)
    return mc_response.json()

def fetch_minecraft_profile(mc_access_token):
    headers = {"Authorization": f"Bearer {mc_access_token}"}
    profile_response = requests.get(MC_PROFILE_URL, headers=headers)
    return profile_response.json()

def authenticate_and_fetch_profile():
    state, code_verifier = generate_state_and_code_verifier()
    auth_url = build_authorization_url(state, code_verifier)

    auth_window = AuthWindow(auth_url, state)
    
    try:
        auth_window.root.mainloop()
    except Exception as e:
        messagebox.showerror("Error", str(e))
    finally:
        if auth_window.httpd:
            auth_window.httpd.shutdown()
            auth_window.httpd.server_close()
        auth_window.root.destroy()

    if auth_window.auth_code:
        tokens = exchange_code_for_tokens(auth_window.auth_code, code_verifier)
        xbox_tokens = exchange_microsoft_token_for_xbox_token(tokens['access_token'])
        xsts_tokens = exchange_xbox_token_for_xsts_token(xbox_tokens['Token'])
        mc_tokens = exchange_xsts_token_for_mc_token(xsts_tokens['Token'], xsts_tokens['DisplayClaims']['xui'][0]['uhs'])
        profile = fetch_minecraft_profile(mc_tokens['access_token'])
        return profile, mc_tokens['access_token']
    else:
        return None, None
    
def logout():
    webbrowser.open(LOGOUT_URL)