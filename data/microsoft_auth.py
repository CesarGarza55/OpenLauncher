from PyQt5.QtWidgets import QApplication, QDialog, QMessageBox, QVBoxLayout
from PyQt5.QtWebEngineWidgets import QWebEngineView, QWebEngineProfile
from PyQt5.QtCore import QUrl, QLocale
from variables import write_log
import minecraft_launcher_lib
import json
import sys
import os
import variables

config_dir = os.path.join(variables.app_directory, "config")

# Constants
CLIENT_ID = "3f59fbe7-2c4b-4343-9a61-c03104ddaedf"
REDIRECT_URL = "https://login.microsoftonline.com/common/oauth2/nativeclient"

class LoginDialog(QDialog):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("Microsoft Account Login")
        self.resize(800, 600)

        layout = QVBoxLayout(self)
        self.web_view = QWebEngineView(self)
        layout.addWidget(self.web_view)

        self.refresh_token_file = os.path.join(config_dir, "refresh_token.json")
        self.account_information = None

        if os.path.isfile(self.refresh_token_file):
            with open(self.refresh_token_file, "r", encoding="utf-8") as f:
                refresh_token = json.load(f)
                try:
                    self.account_information = minecraft_launcher_lib.microsoft_account.complete_refresh(CLIENT_ID, None, REDIRECT_URL, refresh_token)
                    self.accept()  # Close the dialog if login is successful
                except minecraft_launcher_lib.exceptions.InvalidRefreshToken:
                    write_log("Invalid refresh token", "latest")

        if not self.account_information:
            login_url, self.state, self.code_verifier = minecraft_launcher_lib.microsoft_account.get_secure_login_data(CLIENT_ID, REDIRECT_URL)
            self.web_view.load(QUrl(login_url))
            self.web_view.urlChanged.connect(self.new_url)
            self.show()

    def new_url(self, url: QUrl):
        try:
            auth_code = minecraft_launcher_lib.microsoft_account.parse_auth_code_url(url.toString(), self.state)
            self.account_information = minecraft_launcher_lib.microsoft_account.complete_login(CLIENT_ID, None, REDIRECT_URL, auth_code, self.code_verifier)
            self.save_refresh_token(self.account_information["refresh_token"])
            self.accept()  # Close the dialog if login is successful
        except Exception as e:
            pass

    def save_refresh_token(self, refresh_token):
        with open(self.refresh_token_file, "w", encoding="utf-8") as f:
            json.dump(refresh_token, f, ensure_ascii=False, indent=4)

    def get_account_information(self):
        return self.account_information


def login_qt():
    app = QApplication(sys.argv)
    QWebEngineProfile.defaultProfile().setHttpAcceptLanguage(QLocale.system().name().split("_")[0])
    dialog = LoginDialog()
    if dialog.account_information:
        return dialog.get_account_information()
    dialog.exec_()  # Use exec_() in PyQt5
    return dialog.get_account_information()

def login():
    QWebEngineProfile.defaultProfile().setHttpAcceptLanguage(QLocale.system().name().split("_")[0])
    dialog = LoginDialog()
    if dialog.account_information:
        return dialog.get_account_information()
    dialog.exec_()  # Use exec_() in PyQt5
    return dialog.get_account_information()


if __name__ == "__main__":
    account_info = login()
    if account_info:
        print(account_info)
    else:
        print("Login failed or was cancelled")