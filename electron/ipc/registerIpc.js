import { app, dialog, ipcMain, shell } from 'electron';
import fs from 'fs';
import os from 'os';
import { getMinecraftRoot } from '../services/paths.js';
import { getMainWindow } from '../services/windowManager.js';
import { checkForLauncherUpdate } from '../services/updater.js';
import {
  readInstalledMods,
  readInstalledShaders,
  readInstalledResourcePacks,
  toggleMod,
  setAllModsEnabled,
  deleteMod,
  deleteShader,
  deleteResourcePack,
  openContentFolder,
  importModFile,
  importContentFile,
  pickContentFiles,
  installModrinthProject,
  checkInstalledModsUpdates,
} from '../services/contentManager.js';
import {
  readInstalledVersions,
  installMinecraft,
  cancelInstall,
} from '../services/minecraftInstaller.js';
import {
  launchMinecraft,
  stopMinecraft,
} from '../services/minecraftRunner.js';
import { loadLauncherCatalog } from '../../src/lib/minecraftLauncher.js';
import { loadMinecraftNews } from '../../src/lib/minecraftNews.js';
import { loadLauncherState, saveLauncherState } from '../../src/lib/launcherState.js';
import {
  getMicrosoftAuthState,
  loginMicrosoftInteractive,
  logoutMicrosoft,
} from '../../src/lib/microsoftAuth.js';
import {
  searchModrinthProjects,
  getModrinthProject,
  getModrinthProjectVersions,
} from '../../src/lib/modrinth.js';

export function registerAllIpc() {
  const sendToRenderer = (channel, payload) => {
    try {
      const win = getMainWindow();
      win?.webContents.send(channel, payload);
    } catch { }
  };

  const sendLog = (type, msg) => {
    sendToRenderer('minecraft:run-log', { type, msg });
  };

  // ── Window and Shell Controls ──
  ipcMain.handle('window:minimize', () => getMainWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window:close', () => getMainWindow()?.close());
  ipcMain.handle('shell:open-external', (_, url) => shell.openExternal(url));

  // ── Directory and System Information ──
  ipcMain.handle('minecraft:open-root-directory', async () => {
    const minecraftRoot = getMinecraftRoot();
    try {
      await fs.promises.mkdir(minecraftRoot, { recursive: true });
      const result = await shell.openPath(minecraftRoot);
      if (result) {
        return { error: 'OpenPathFailed', message: result, path: minecraftRoot };
      }
      return { ok: true, path: minecraftRoot };
    } catch (error) {
      return { error: 'OpenPathFailed', message: error?.message || String(error), path: minecraftRoot };
    }
  });

  ipcMain.handle('minecraft:get-root', async () => ({ root: getMinecraftRoot() }));
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('system:get-info', async () => {
    const totalBytes = os.totalmem();
    const totalRamGb = Math.max(2, Math.round(totalBytes / (1024 * 1024 * 1024)));
    return {
      totalRamGb,
      platform: process.platform,
      arch: process.arch,
    };
  });

  // ── State and Settings ──
  ipcMain.handle('minecraft:get-state', async () => {
    const state = await loadLauncherState(app.getPath('userData'));
    return { ...state, minecraftRoot: getMinecraftRoot() };
  });

  ipcMain.handle('minecraft:save-state', async (_, state) => {
    if (state.settings && typeof state.settings === 'object') {
      state.settings.javaPath = state.settings.javaPath || '';
    }
    return saveLauncherState(app.getPath('userData'), state);
  });

  ipcMain.handle('minecraft:get-settings', async () => {
    const state = await loadLauncherState(app.getPath('userData'));
    return {
      keepOpen: state.settings?.keepOpen ?? false,
      showConsole: state.settings?.showConsole ?? true,
      autoUpdate: state.settings?.autoUpdate ?? true,
      showSnapshots: state.settings?.showSnapshots ?? false,
    };
  });

  ipcMain.handle('app:get-language', async () => {
    try {
      const state = await loadLauncherState(app.getPath('userData'));
      return state.settings?.language || 'en';
    } catch {
      return 'en';
    }
  });

  ipcMain.handle('app:set-language', async (_, language) => {
    try {
      const currentState = await loadLauncherState(app.getPath('userData'));
      await saveLauncherState(app.getPath('userData'), {
        ...currentState,
        settings: { ...currentState.settings, language: typeof language === 'string' && language.trim() ? language.trim() : 'en' },
      });
      return { ok: true };
    } catch (error) {
      return { error: 'SaveFailed', message: error?.message || String(error) };
    }
  });

  // ── Catalog and News ──
  ipcMain.handle('minecraft:get-catalog', async (_, options) => {
    const currentState = await loadLauncherState(app.getPath('userData'));
    const includeSnapshots = options?.includeSnapshots !== undefined
      ? Boolean(options.includeSnapshots)
      : (options?.showSnapshots !== undefined
        ? Boolean(options.showSnapshots)
        : currentState.settings?.showSnapshots === true);
    const catalog = await loadLauncherCatalog({ includeSnapshots });
    try {
      const nextSettings = { ...(currentState.settings || {}), showSnapshots: includeSnapshots };
      await saveLauncherState(app.getPath('userData'), {
        ...currentState,
        settings: nextSettings,
        versions: catalog.versions,
        installTargets: catalog.installTargets,
        latest: catalog.latest,
      });
    } catch { }
    return catalog;
  });

  ipcMain.handle('minecraft:get-news', async (_, options = {}) => {
    try {
      const limit = Number(options?.limit) > 0 ? Number(options.limit) : 24;
      return await loadMinecraftNews({ limit });
    } catch (error) {
      return { error: error?.message || 'Failed to load Minecraft news.', items: [], sourceUrl: 'https://www.minecraft.net/en-us/articles' };
    }
  });

  // ── Authentication ──
  ipcMain.handle('minecraft:get-auth-state', async (_, profileKey = 'default') => {
    return getMicrosoftAuthState({ profileKey, storageDir: app.getPath('userData') });
  });

  ipcMain.handle('minecraft:login', async (event, profileKey = 'default', abortSignal) => {
    const controller = new AbortController();
    try {
      return await loginMicrosoftInteractive({
        profileKey,
        storageDir: app.getPath('userData'),
        openExternal: url => shell.openExternal(url),
        abortSignal: abortSignal || controller.signal,
      });
    } catch (error) {
      if (error?.message === 'Login cancelled by user') {
        return { error: error.message, cancelled: true };
      }
      return { error: error?.message || 'Microsoft login failed.' };
    }
  });

  ipcMain.handle('minecraft:logout', async (_, profileKey = 'default') => {
    return logoutMicrosoft({ profileKey, storageDir: app.getPath('userData') });
  });

  // ── Content Management (Mods, Shaders, Resource Packs) ──
  ipcMain.handle('minecraft:get-installed-versions', async () => readInstalledVersions());
  ipcMain.handle('minecraft:get-installed-mods', async () => readInstalledMods());
  ipcMain.handle('minecraft:get-installed-shaders', async () => readInstalledShaders());
  ipcMain.handle('minecraft:get-installed-resourcepacks', async () => readInstalledResourcePacks());

  ipcMain.handle('minecraft:toggle-mod', async (_, { modId, enable }) => toggleMod(modId, enable));
  ipcMain.handle('minecraft:set-all-mods-enabled', async (_, { enable }) => setAllModsEnabled(Boolean(enable)));
  ipcMain.handle('minecraft:delete-mod', async (_, { modId }) => deleteMod(modId));
  ipcMain.handle('minecraft:delete-shader', async (_, { fileName }) => deleteShader(fileName));
  ipcMain.handle('minecraft:delete-resourcepack', async (_, { fileName }) => deleteResourcePack(fileName));
  ipcMain.handle('minecraft:open-content-folder', async (_, folderType) => openContentFolder(folderType));
  ipcMain.handle('minecraft:install-mod-file', async (_, { sourcePath }) => importModFile(sourcePath));
  ipcMain.handle('minecraft:import-content-file', async (_, payload) => importContentFile(payload));

  ipcMain.handle('minecraft:pick-mod-files', async () => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(win || undefined, {
      title: 'Select mod files',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Minecraft Mods', extensions: ['jar', 'olpkg'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled) return { canceled: true, filePaths: [] };
    return { canceled: false, filePaths: result.filePaths || [] };
  });

  ipcMain.handle('minecraft:pick-content-files', async (_, type) => pickContentFiles(type));

  // ── Modrinth Integration ──
  ipcMain.handle('minecraft:modrinth-search', async (_, params) => searchModrinthProjects(params));
  ipcMain.handle('minecraft:modrinth-get-project', async (_, idOrSlug) => getModrinthProject(idOrSlug));
  ipcMain.handle('minecraft:modrinth-get-versions', async (_, params) => getModrinthProjectVersions(params));
  ipcMain.handle('minecraft:modrinth-install', async (_, payload) => installModrinthProject(payload, { onLog: sendLog }));
  ipcMain.handle('minecraft:check-mod-updates', async (_, params) => checkInstalledModsUpdates(params));

  // ── Updates ──
  ipcMain.handle('minecraft:check-update', async () => {
    return checkForLauncherUpdate({
      promptUser: true,
      parentWindow: getMainWindow(),
      onEvent: sendToRenderer,
    });
  });

  // ── Game Installation and Execution ──
  ipcMain.handle('minecraft:install', async (_, opts) => {
    return installMinecraft(opts, {
      onLog: sendLog,
      onProgress: (p) => {
        sendToRenderer('minecraft:install-file-progress', p);
        sendToRenderer('minecraft:install-progress', p);
      },
      onComplete: (c) => sendToRenderer('minecraft:install-complete', c),
    });
  });

  ipcMain.handle('minecraft:install-cancel', async (_, { installId }) => {
    const result = cancelInstall(installId);
    if (result.ok) {
      sendToRenderer('minecraft:install-cancelled', { installId });
    }
    return result;
  });

  ipcMain.handle('minecraft:run', async (_, opts) => {
    return launchMinecraft(opts, {
      onLog: sendLog,
      onAssetProgress: (p) => sendToRenderer('minecraft:asset-progress', p),
      onExit: (e) => sendToRenderer('minecraft:run-exit', e),
      onConflict: (c) => sendToRenderer('minecraft:mod-conflict', c),
    });
  });

  ipcMain.handle('minecraft:stop', async (_, { pid }) => stopMinecraft(pid));
}
