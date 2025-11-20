"""
Workers and Thread classes for OpenLauncher
Handles background task execution for Minecraft commands and functions
"""

import sys
import subprocess
from PyQt5.QtCore import QRunnable, pyqtSlot, pyqtSignal, QObject
from PyQt5.QtGui import QTextCursor

class CommandWorkerSignals(QObject):
    """Signals for CommandWorker to communicate with the main thread"""
    finished = pyqtSignal()
    error = pyqtSignal(str)
    output = pyqtSignal(str)

class CommandWorker(QRunnable):
    """Worker to execute shell commands in a separate thread"""
    
    def __init__(self, command):
        super(CommandWorker, self).__init__()
        self.command = command
        self.signals = CommandWorkerSignals()

    @pyqtSlot()
    def run(self):
        process = None
        try:
            if sys.platform == 'win32':
                # Don't show the console window
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                process = subprocess.Popen(
                    self.command, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE, 
                    startupinfo=startupinfo, 
                    universal_newlines=True
                )
            elif sys.platform == 'linux':
                process = subprocess.Popen(
                    self.command, 
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.PIPE, 
                    universal_newlines=True
                )

            for line in iter(process.stdout.readline, ''):
                self.signals.output.emit(line.strip())  # Emit the output to be handled in the main thread
            process.stdout.close()
            process.wait()
        except Exception as e:
            self.signals.error.emit(f"Could not start Minecraft: {e}")
        finally:
            if process:
                process.stdout.close()
                process.stderr.close()
                process.wait()
            self.signals.finished.emit()


class FunctionWorkerSignals(QObject):
    """Signals for FunctionWorker to communicate with the main thread"""
    finished = pyqtSignal()
    error = pyqtSignal(str)
    output = pyqtSignal(str)


class FunctionWorker(QRunnable):
    """Worker to execute functions in a separate thread"""
    
    def __init__(self, fn, *args, **kwargs):
        super(FunctionWorker, self).__init__()
        self.fn = fn
        self.args = args
        self.kwargs = kwargs
        self.signals = FunctionWorkerSignals()

    @pyqtSlot()
    def run(self):
        try:
            # Redirect stdout to capture the output
            original_stdout = sys.stdout
            sys.stdout = self

            result = self.fn(*self.args, **self.kwargs)
            if result is not None:
                self.signals.output.emit(str(result))
        except Exception as e:
            self.signals.error.emit(str(e))
        finally:
            # Restore original stdout
            sys.stdout = original_stdout
            self.signals.finished.emit()

    def write(self, message):
        # Emit each line separately to avoid extra newlines
        for line in message.splitlines():
            if line:
                self.signals.output.emit(line)

    def flush(self):
        pass


class StdoutRedirector:
    """Redirect standard output to QTextEdit widget"""
    
    def __init__(self, console_output):
        self.text_widget = console_output

    def write(self, string):
        self.text_widget.moveCursor(QTextCursor.End)
        self.text_widget.ensureCursorVisible()
        self.text_widget.insertPlainText(string)

    def flush(self):
        pass
