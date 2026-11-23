import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { listen as tauriListen } from '@tauri-apps/api/event';
import { open as tauriOpenDialog } from '@tauri-apps/plugin-dialog';

const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

function channelToTauriCommand(channel) {
  if (channel === 'instances:get-all') return 'instances_get_all';
  if (channel === 'shell:open-external') return 'shell_open_external';
  return channel.replace(/[:\-]/g, '_');
}

const tauriLauncher = {
  platform: typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'darwin' : (navigator.platform.includes('Win') ? 'win32' : 'linux'),
  isMac: typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
  systemTotalRamGb: 8,

  // Window Controls
  windowMinimize: () => tauriInvoke('window_minimize'),
  windowMaximize: () => tauriInvoke('window_maximize'),
  windowClose: () => tauriInvoke('window_close'),
  openExternal: (url) => tauriInvoke('shell_open_external', { url }),

  // System & Directories
  minecraftGetRoot: () => tauriInvoke('minecraft_get_root'),
  minecraftOpenRootDirectory: () => tauriInvoke('minecraft_open_root_directory'),
  getAppVersion: () => tauriInvoke('app_get_version'),
  getSystemInfo: () => tauriInvoke('system_get_info'),

  // State & Settings
  minecraftGetState: () => tauriInvoke('minecraft_get_state'),
  minecraftSaveState: (state) => tauriInvoke('minecraft_save_state', { state }),
  minecraftGetSettings: () => tauriInvoke('minecraft_get_settings'),
  getAppLanguage: () => tauriInvoke('app_get_language'),
  setAppLanguage: (language) => tauriInvoke('app_set_language', { language }),

  // Catalog & News
  minecraftGetCatalog: (options) => tauriInvoke('minecraft_get_catalog', { options }),
  minecraftGetNews: (options) => tauriInvoke('minecraft_get_news', { options }),
  minecraftGetArticle: (url) => tauriInvoke('minecraft_get_article', { url }),

  // Auth
  minecraftGetAuthState: (profileKey, _options) => tauriInvoke('minecraft_get_auth_state', { profileKey }),
  minecraftLogin: (profileKey) => tauriInvoke('minecraft_login', { profileKey }),
  minecraftLogout: (profileKey) => tauriInvoke('minecraft_logout', { profileKey }),

  // Instances
  getInstances: () => tauriInvoke('instances_get_all'),
  createInstance: (payload) => tauriInvoke('instances_create', { payload }),
  updateInstance: (id, updates) => tauriInvoke('instances_update', { id, updates }),
  deleteInstance: (id) => tauriInvoke('instances_delete', { id }),
  scanBaseDirectory: () => tauriInvoke('instances_scan_base'),
  migrateBaseToInstance: (payload) => tauriInvoke('instances_migrate_base', { payload }),
  pickInstanceImage: async () => {
    try {
      const selected = await tauriOpenDialog({
        title: 'Select instance icon image',
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }],
      });
      if (!selected) return { canceled: true };
      const path = typeof selected === 'string' ? selected : selected.path;
      const dataUri = await tauriInvoke('instances_read_image_data_uri', { path });
      return { canceled: false, dataUri };
    } catch (err) {
      return { canceled: true, error: String(err) };
    }
  },

  // Content
  minecraftGetInstalledVersions: () => tauriInvoke('minecraft_get_installed_versions'),
  minecraftGetInstalledMods: (instanceId) => tauriInvoke('minecraft_get_installed_mods', { instanceId: instanceId || null }),
  minecraftGetInstalledShaders: (instanceId) => tauriInvoke('minecraft_get_installed_shaders', { instanceId: instanceId || null }),
  minecraftGetInstalledResourcePacks: (instanceId) => tauriInvoke('minecraft_get_installed_resourcepacks', { instanceId: instanceId || null }),
  minecraftGetInstalledDatapacks: (instanceId) => tauriInvoke('minecraft_get_installed_datapacks', { instanceId: instanceId || null }),
  minecraftModrinthEnrichInstalledContent: (items, projectType) => tauriInvoke('minecraft_modrinth_enrich_installed_content', { items, projectType }),
  minecraftToggleMod: (modId, enable, instanceId) => tauriInvoke('minecraft_toggle_mod', { modId, enable, instanceId: instanceId || null }),
  minecraftSetAllModsEnabled: (enable, instanceId) => tauriInvoke('minecraft_set_all_mods_enabled', { enable, instanceId: instanceId || null }),
  minecraftDeleteMod: (modId, instanceId) => tauriInvoke('minecraft_delete_mod', { modId, instanceId: instanceId || null }),
  minecraftDeleteShader: (fileName, instanceId) => tauriInvoke('minecraft_delete_shader', { fileName, instanceId: instanceId || null }),
  minecraftDeleteResourcePack: (fileName, instanceId) => tauriInvoke('minecraft_delete_resourcepack', { fileName, instanceId: instanceId || null }),
  minecraftDeleteDatapack: (fileName, instanceId) => tauriInvoke('minecraft_delete_datapack', { fileName, instanceId: instanceId || null }),
  minecraftOpenContentFolder: (folderType, instanceId) => tauriInvoke('minecraft_open_content_folder', { folderType, instanceId: instanceId || null }),
  minecraftInstallModFile: (sourcePath, instanceId) => tauriInvoke('minecraft_install_mod_file', { sourcePath, instanceId: instanceId || null }),
  minecraftImportContentFile: (payload, instanceId) => tauriInvoke('minecraft_import_content_file', { payload, instanceId: instanceId || null }),
  minecraftPickModFiles: async () => {
    try {
      const selected = await tauriOpenDialog({
        title: 'Select mod files',
        multiple: true,
        filters: [{ name: 'Minecraft Mods', extensions: ['jar', 'olpkg'] }, { name: 'All Files', extensions: ['*'] }],
      });
      if (!selected) return { canceled: true, filePaths: [] };
      const filePaths = Array.isArray(selected) ? selected : [selected];
      return { canceled: false, filePaths: filePaths.map(p => typeof p === 'string' ? p : p.path) };
    } catch {
      return { canceled: true, filePaths: [] };
    }
  },
  minecraftPickContentFiles: async (type) => {
    try {
      const selected = await tauriOpenDialog({
        title: `Select ${type} files`,
        multiple: true,
        filters: [{ name: 'Packs / Archives', extensions: ['zip', 'jar'] }, { name: 'All Files', extensions: ['*'] }],
      });
      if (!selected) return { canceled: true, filePaths: [] };
      const filePaths = Array.isArray(selected) ? selected : [selected];
      return { canceled: false, filePaths: filePaths.map(p => typeof p === 'string' ? p : p.path) };
    } catch {
      return { canceled: true, filePaths: [] };
    }
  },

  // Modrinth
  minecraftModrinthSearch: (params) => tauriInvoke('minecraft_modrinth_search', { params }),
  minecraftModrinthGetProject: (idOrSlug) => tauriInvoke('minecraft_modrinth_get_project', { idOrSlug }),
  minecraftModrinthGetVersions: (params) => tauriInvoke('minecraft_modrinth_get_versions', { params }),
  minecraftModrinthGetVersion: (versionId) => tauriInvoke('minecraft_modrinth_get_version', { versionId }),
  minecraftModrinthInstall: (payload) => tauriInvoke('minecraft_modrinth_install', { payload }),
  minecraftCheckModUpdates: (params) => tauriInvoke('minecraft_check_mod_updates', { params }),

  // Install & Run
  minecraftInstall: (opts) => tauriInvoke('minecraft_install', { opts }),
  minecraftInstallCancel: (opts) => tauriInvoke('minecraft_install_cancel', { installId: opts?.installId || 'default' }),
  minecraftRun: (opts) => tauriInvoke('minecraft_run', { opts }),
  minecraftStop: (opts) => tauriInvoke('minecraft_stop', { pid: opts?.pid }),

  // Updater
  minecraftCheckUpdate: () => tauriInvoke('minecraft_check_update'),
  minecraftApplyUpdate: (payload) => tauriInvoke('minecraft_apply_update', { payload }),

  // Generic IPC Bridge
  invoke: (channel, data) => {
    const cmd = channelToTauriCommand(channel);
    return tauriInvoke(cmd, typeof data === 'object' && data !== null ? data : { payload: data });
  },

  on: (channel, listener) => {
    let unlisten = null;
    tauriListen(channel, (event) => {
      listener(event.payload);
    }).then((fn) => {
      unlisten = fn;
    }).catch(console.error);

    return () => {
      if (unlisten) unlisten();
    };
  },
};

const launcherFallback = {
  platform: 'browser',
  isMac: typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
  systemTotalRamGb: 8,
  minecraftGetCatalog: () => Promise.resolve(null),
  minecraftGetState: () => Promise.resolve(null),
  minecraftGetRoot: () => Promise.resolve({ root: '' }),
  minecraftOpenRootDirectory: () => Promise.resolve({ skipped: true }),
  minecraftGetInstalledVersions: () => Promise.resolve([]),
  minecraftGetInstalledMods: () => Promise.resolve([]),
  minecraftGetInstalledShaders: () => Promise.resolve([]),
  minecraftGetInstalledResourcePacks: () => Promise.resolve([]),
  minecraftGetInstalledDatapacks: () => Promise.resolve([]),
  getInstances: () => Promise.resolve([]),
  createInstance: (payload) => Promise.resolve({ ok: true, instance: payload }),
  updateInstance: (id, updates) => Promise.resolve({ ok: true, instance: { id, ...updates } }),
  deleteInstance: (id) => Promise.resolve({ ok: true, id }),
  scanBaseDirectory: () => Promise.resolve({ modsCount: 0, shaderpacksCount: 0, resourcepacksCount: 0, savesCount: 0, hasConfig: false, hasOptions: false }),
  migrateBaseToInstance: (payload) => Promise.resolve({ ok: true, instance: { id: 'migrated', ...payload } }),
  pickInstanceImage: () => Promise.resolve({ canceled: true }),
  minecraftGetNews: () => Promise.resolve({ items: [], sourceUrl: 'https://www.minecraft.net/en-us/articles' }),
  minecraftGetArticle: () => Promise.resolve(null),
  minecraftToggleMod: () => Promise.resolve({ ok: true }),
  minecraftDeleteMod: () => Promise.resolve({ ok: true }),
  minecraftDeleteShader: () => Promise.resolve({ ok: true }),
  minecraftDeleteResourcePack: () => Promise.resolve({ ok: true }),
  minecraftDeleteDatapack: () => Promise.resolve({ ok: true }),
  minecraftOpenContentFolder: () => Promise.resolve({ ok: true }),
  minecraftImportContentFile: () => Promise.resolve({ ok: true }),
  minecraftPickContentFiles: () => Promise.resolve({ canceled: true, filePaths: [] }),
  minecraftInstallModFile: () => Promise.resolve({ ok: true }),
  minecraftPickModFiles: () => Promise.resolve({ canceled: true, filePaths: [] }),
  minecraftSaveState: () => Promise.resolve({ ok: true }),
  minecraftSetAllModsEnabled: () => Promise.resolve({ ok: true }),
  minecraftGetAuthState: () => Promise.resolve(null),
  minecraftLogin: () => Promise.resolve({ error: 'Desktop application required.' }),
  minecraftLogout: () => Promise.resolve(null),
  minecraftCheckUpdate: () => Promise.resolve({ skipped: true }),
  minecraftApplyUpdate: () => Promise.resolve({ skipped: true }),
  getAppVersion: () => Promise.resolve('1.2.0'),
  getSystemInfo: () => Promise.resolve({ totalRamGb: 8, platform: 'browser', arch: 'x64' }),
  minecraftInstall: () => Promise.resolve({ installId: 'mock' }),
  minecraftRun: () => Promise.resolve({ pid: 1234 }),
  minecraftStop: () => Promise.resolve({ stopped: true }),
  minecraftInstallCancel: () => Promise.resolve({ cancelled: true }),
  windowMinimize: () => { },
  windowMaximize: () => { },
  windowClose: () => { },
  openExternal: () => { },
  invoke: () => Promise.resolve(),
  on: () => () => { },
};

export const launcher = isTauri ? tauriLauncher : launcherFallback;

if (typeof window !== 'undefined') {
  window.launcher = launcher;
}

export const minecraftLoginWithAbort = async (profileKey, _abortSignal) => {
  return await launcher.minecraftLogin(profileKey);
};
