import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMainWindow } from './services/windowManager.js';
import { registerAllIpc } from './ipc/registerIpc.js';
import { checkForLauncherUpdate } from './services/updater.js';
import { loadLauncherState } from '../src/lib/launcherState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = Boolean(process.defaultApp || process.argv.includes('--dev') || process.env.OPENLAUNCHER_DEV === '1');

// Only load dotenv during development to save production cold startup time
if (isDev) {
  import('dotenv').then(dotenv => dotenv.default.config()).catch(() => {});
}

app.setName('OpenLauncher');

// Electron & Chromium engine optimizations (Ultra low RAM, disk cache, background processes)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128 --expose-gc');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disk-cache-size', '16777216');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-print-preview');
app.commandLine.appendSwitch('disable-features', 'Autofill,CalculateNativeWinOcclusion,InterestFeedContentSuggestions,MediaSessionService,Translate,PreloadMediaEngagementData');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWin = BrowserWindow.getAllWindows()[0];
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });
}

async function init() {
  Menu.setApplicationMenu(null);

  registerAllIpc();

  const mainWindow = await createMainWindow({
    isDev,
    electronDir: __dirname,
  });

  // Auto-check for updates if enabled in settings
  setTimeout(async () => {
    try {
      const state = await loadLauncherState(app.getPath('userData'));
      if (state.settings?.autoUpdate !== false) {
        checkForLauncherUpdate({
          promptUser: true,
          parentWindow: mainWindow,
          onEvent: (channel, payload) => {
            try { mainWindow?.webContents.send(channel, payload); } catch { }
          },
        }).catch((err) => {
          console.warn('Auto update check error:', err?.message || err);
        });
      }
    } catch { }
  }, 3000);
}

app.whenReady().then(init);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow({ isDev, electronDir: __dirname });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});