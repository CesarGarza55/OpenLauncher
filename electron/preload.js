import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('launcher', {
  minecraftGetCatalog(options) {
    return ipcRenderer.invoke('minecraft:get-catalog', options);
  },
  minecraftGetState() {
    return ipcRenderer.invoke('minecraft:get-state');
  },
  minecraftOpenRootDirectory() {
    return ipcRenderer.invoke('minecraft:open-root-directory');
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
  minecraftGetSettings() {
    return ipcRenderer.invoke('minecraft:get-settings');
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
  getAppLanguage() {
    return ipcRenderer.invoke('app:get-language');
  },
  setAppLanguage(language) {
    return ipcRenderer.invoke('app:set-language', language);
  },
  invoke(channel, data) {
    return ipcRenderer.invoke(channel, data);
  },
  minecraftGetNews() {
    return ipcRenderer.invoke('minecraft:get-news');
  },
  minecraftGetInstalledMods() {
    return ipcRenderer.invoke('minecraft:get-installed-mods');
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
});
