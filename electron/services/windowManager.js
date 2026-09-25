import { app, BrowserWindow, Menu, screen } from 'electron';
import path from 'path';
import fs from 'fs';

const WINDOW_STATE_FILE = 'window-state.json';
const WINDOW_MIN_WIDTH = 1100;
const WINDOW_MIN_HEIGHT = 660;

let mainWindow = null;
let windowStateSaveTimer = null;

export function getMainWindow() {
  return mainWindow;
}

function getWindowStatePath() {
  return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function computeDefaultWindowBounds() {
  const display = screen.getPrimaryDisplay();
  const workArea = display?.workAreaSize || { width: 1600, height: 900 };
  return {
    width: Math.min(workArea.width - 40, Math.max(1440, Math.floor(workArea.width * 0.60))),
    height: Math.min(workArea.height - 40, Math.max(900, Math.floor(workArea.height * 0.50))),
  };
}

function parseSavedWindowState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const width = Number(raw.width);
  const height = Number(raw.height);
  const x = Number(raw.x);
  const y = Number(raw.y);
  const maximized = Boolean(raw.maximized);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    width: Math.max(WINDOW_MIN_WIDTH, Math.floor(width)),
    height: Math.max(WINDOW_MIN_HEIGHT, Math.floor(height)),
    x: Number.isFinite(x) ? Math.floor(x) : undefined,
    y: Number.isFinite(y) ? Math.floor(y) : undefined,
    maximized,
  };
}

function boundsAreVisible(bounds) {
  if (!bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return false;
  }
  const rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  return screen.getAllDisplays().some((display) => {
    const wa = display.workArea;
    const overlapX = Math.max(0, Math.min(rect.x + rect.width, wa.x + wa.width) - Math.max(rect.x, wa.x));
    const overlapY = Math.max(0, Math.min(rect.y + rect.height, wa.y + wa.height) - Math.max(rect.y, wa.y));
    return overlapX > 120 && overlapY > 120;
  });
}

async function readWindowState() {
  try {
    const raw = await fs.promises.readFile(getWindowStatePath(), 'utf8');
    return parseSavedWindowState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeWindowStateNow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const maximized = mainWindow.isMaximized();
  const bounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  const payload = {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(WINDOW_MIN_WIDTH, bounds.width),
    height: Math.max(WINDOW_MIN_HEIGHT, bounds.height),
    maximized,
  };
  try {
    await fs.promises.mkdir(app.getPath('userData'), { recursive: true });
    await fs.promises.writeFile(getWindowStatePath(), JSON.stringify(payload, null, 2), 'utf8');
  } catch { }
}

export function scheduleWindowStateSave() {
  if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    writeWindowStateNow().catch(() => {});
  }, 200);
}

export async function createMainWindow({ isDev, electronDir }) {
  const defaultBounds = computeDefaultWindowBounds();
  const savedWindowState = await readWindowState();
  const canUseSavedBounds = savedWindowState && boundsAreVisible(savedWindowState);
  const initialBounds = canUseSavedBounds ? savedWindowState : { ...defaultBounds, maximized: false };
  const isMac = process.platform === 'darwin';

  const browserWindowOptions = {
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: WINDOW_MIN_WIDTH,
    minHeight: WINDOW_MIN_HEIGHT,
    frame: isMac ? true : false,
    title: 'OpenLauncher',
    backgroundColor: '#0e0e0e',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      backgroundThrottling: false,
      v8CacheOptions: 'bypassHeatCheckAndEagerCompile',
      preload: path.join(electronDir, 'preload.cjs'),
    },
  };

  if (Number.isFinite(initialBounds.x) && Number.isFinite(initialBounds.y)) {
    browserWindowOptions.x = initialBounds.x;
    browserWindowOptions.y = initialBounds.y;
  }

  mainWindow = new BrowserWindow(browserWindowOptions);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('resize', scheduleWindowStateSave);
  mainWindow.on('move', scheduleWindowStateSave);
  mainWindow.on('maximize', scheduleWindowStateSave);
  mainWindow.on('unmaximize', scheduleWindowStateSave);
  mainWindow.on('minimize', () => {
    if (typeof global.gc === 'function') {
      try { global.gc(); } catch { }
    }
  });
  mainWindow.on('close', () => {
    if (windowStateSaveTimer) {
      clearTimeout(windowStateSaveTimer);
      windowStateSaveTimer = null;
    }
    writeWindowStateNow();
  });

  if (isMac) {
    // Build a macOS menu where "About OpenLauncher" opens the in-app modal
    // instead of Electron's default native About dialog.
    const macMenu = Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          {
            label: `About ${app.name}`,
            click() {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('app:show-about');
              }
            },
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
    ]);
    Menu.setApplicationMenu(macMenu);
  }

  if (initialBounds.maximized) mainWindow.maximize();

  if (isDev) {
    try {
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      return mainWindow;
    } catch (e) {
      console.error('Failed to load Vite dev server at http://localhost:5173:', e?.message || e);
      return mainWindow;
    }
  }

  const candidates = [
    path.join(electronDir, 'dist', 'index.html'),
    path.join(electronDir, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'app', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'dist', 'index.html'),
  ];

  let loaded = false;
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        await mainWindow.loadFile(candidate);
        loaded = true;
        break;
      }
    } catch { }
  }

  if (!loaded) {
    const fallback = path.join(electronDir, 'dist', 'index.html');
    await mainWindow.loadFile(fallback).catch((err) => {
      console.error('Error loading fallback index.html:', err);
    });
  }

  return mainWindow;
}
