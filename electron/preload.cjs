const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  minecraftGetCatalog(options) {
    return ipcRenderer.invoke('minecraft:get-catalog', options);
  },
  minecraftGetState() {
    return ipcRenderer.invoke('minecraft:get-state');
  },
  minecraftGetRoot() {
    return ipcRenderer.invoke('minecraft:get-root');
  },
  minecraftOpenRootDirectory() {
    return ipcRenderer.invoke('minecraft:open-root-directory');
  },
  minecraftGetInstalledVersions() {
    return ipcRenderer.invoke('minecraft:get-installed-versions');
  },
  minecraftGetInstalledMods() {
    return ipcRenderer.invoke('minecraft:get-installed-mods');
  },
  minecraftGetNews() {
    return ipcRenderer.invoke('minecraft:get-news');
  },
  minecraftToggleMod(modId, enable) {
    return ipcRenderer.invoke('minecraft:toggle-mod', { modId, enable });
  },
  minecraftDeleteMod(modId) {
    return ipcRenderer.invoke('minecraft:delete-mod', { modId });
  },
  minecraftInstallModFile(sourcePath) {
    return ipcRenderer.invoke('minecraft:install-mod-file', { sourcePath });
  },
  minecraftPickModFiles() {
    return ipcRenderer.invoke('minecraft:pick-mod-files');
  },
  minecraftSaveState(state) {
    return ipcRenderer.invoke('minecraft:save-state', state);
  },
  minecraftGetAuthState(profileKey) {
    return ipcRenderer.invoke('minecraft:get-auth-state', profileKey);
  },
  minecraftLogin(profileKey) {
    return ipcRenderer.invoke('minecraft:login', profileKey);
  },
  minecraftLogout(profileKey) {
    return ipcRenderer.invoke('minecraft:logout', profileKey);
  },
  minecraftCheckUpdate() {
    return ipcRenderer.invoke('minecraft:check-update');
  },
  getAppVersion() {
    return ipcRenderer.invoke('app:get-version');
  },
  minecraftInstall(opts) {
    return ipcRenderer.invoke('minecraft:install', opts);
  },
  minecraftRun(opts) {
    return ipcRenderer.invoke('minecraft:run', opts);
  },
  minecraftStop(opts) {
    return ipcRenderer.invoke('minecraft:stop', opts);
  },
  minecraftInstallCancel(opts) {
    return ipcRenderer.invoke('minecraft:install-cancel', opts);
  },
  windowMinimize() {
    return ipcRenderer.invoke('window:minimize');
  },
  windowMaximize() {
    return ipcRenderer.invoke('window:maximize');
  },
  windowClose() {
    return ipcRenderer.invoke('window:close');
  },
  openExternal(url) {
    return ipcRenderer.invoke('shell:open-external', url);
  },
  invoke(channel, data) {
    return ipcRenderer.invoke(channel, data);
  },
  on(channel, listener) {
    const cb = (_, ...args) => listener(...args);
    // store reference so caller can remove if needed
    ipcRenderer.on(channel, cb);
    return () => ipcRenderer.removeListener(channel, cb);
  },
});