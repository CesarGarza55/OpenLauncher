const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcher', {
  platform: process.platform,
  isMac: process.platform === 'darwin',
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
  minecraftGetInstalledShaders() {
    return ipcRenderer.invoke('minecraft:get-installed-shaders');
  },
  minecraftGetInstalledResourcePacks() {
    return ipcRenderer.invoke('minecraft:get-installed-resourcepacks');
  },
  minecraftGetNews() {
    return ipcRenderer.invoke('minecraft:get-news');
  },
  minecraftToggleMod(modId, enable) {
    return ipcRenderer.invoke('minecraft:toggle-mod', { modId, enable });
  },
  minecraftSetAllModsEnabled(enable) {
    return ipcRenderer.invoke('minecraft:set-all-mods-enabled', { enable });
  },
  minecraftDeleteMod(modId) {
    return ipcRenderer.invoke('minecraft:delete-mod', { modId });
  },
  minecraftDeleteShader(fileName) {
    return ipcRenderer.invoke('minecraft:delete-shader', { fileName });
  },
  minecraftDeleteResourcePack(fileName) {
    return ipcRenderer.invoke('minecraft:delete-resourcepack', { fileName });
  },
  minecraftOpenContentFolder(folderType) {
    return ipcRenderer.invoke('minecraft:open-content-folder', folderType);
  },
  minecraftInstallModFile(sourcePath) {
    return ipcRenderer.invoke('minecraft:install-mod-file', { sourcePath });
  },
  minecraftImportContentFile(payload) {
    return ipcRenderer.invoke('minecraft:import-content-file', payload);
  },
  minecraftModrinthSearch(params) {
    return ipcRenderer.invoke('minecraft:modrinth-search', params);
  },
  minecraftModrinthGetProject(idOrSlug) {
    return ipcRenderer.invoke('minecraft:modrinth-get-project', idOrSlug);
  },
  minecraftModrinthGetVersions(params) {
    return ipcRenderer.invoke('minecraft:modrinth-get-versions', params);
  },
  minecraftModrinthInstall(payload) {
    return ipcRenderer.invoke('minecraft:modrinth-install', payload);
  },
  minecraftCheckModUpdates(params) {
    return ipcRenderer.invoke('minecraft:check-mod-updates', params);
  },
  minecraftPickModFiles() {
    return ipcRenderer.invoke('minecraft:pick-mod-files');
  },
  minecraftPickContentFiles(type) {
    return ipcRenderer.invoke('minecraft:pick-content-files', type);
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
  minecraftGetSettings() {
    return ipcRenderer.invoke('minecraft:get-settings');
  },
  getAppLanguage() {
    return ipcRenderer.invoke('app:get-language');
  },
  setAppLanguage(language) {
    return ipcRenderer.invoke('app:set-language', language);
  },
  getAppVersion() {
    return ipcRenderer.invoke('app:get-version');
  },
  getSystemInfo() {
    return ipcRenderer.invoke('system:get-info');
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