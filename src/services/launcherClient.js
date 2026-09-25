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
  minecraftGetNews: () => Promise.resolve({ items: [], sourceUrl: 'https://www.minecraft.net/en-us/articles' }),
  minecraftToggleMod: () => Promise.resolve({ ok: true }),
  minecraftDeleteMod: () => Promise.resolve({ ok: true }),
  minecraftInstallModFile: () => Promise.resolve({ ok: true }),
  minecraftPickModFiles: () => Promise.resolve([]),
  minecraftSaveState: () => Promise.resolve({ ok: true }),
  minecraftSetAllModsEnabled: () => Promise.resolve({ ok: true }),
  minecraftGetAuthState: (profileKey) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:get-auth-state', profileKey);
    }
    return Promise.resolve(null);
  },
  minecraftLogin: (profileKey) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:login', profileKey);
    }
    return Promise.resolve({
      error: 'El inicio de sesión interactivo con Microsoft requiere ejecutar la aplicación de escritorio Electron.',
    });
  },
  minecraftLogout: (profileKey) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:logout', profileKey);
    }
    return Promise.resolve(null);
  },
  minecraftCheckUpdate: () => Promise.resolve({ skipped: true }),
  getAppVersion: () => Promise.resolve(''),
  getSystemInfo: () => Promise.resolve({}),
  minecraftInstall: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:install', opts);
    }
    return Promise.resolve({ installId: 'mock' });
  },
  minecraftRun: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:run', opts);
    }
    return Promise.resolve({ pid: 1234 });
  },
  minecraftStop: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:stop', opts);
    }
    return Promise.resolve({ stopped: true });
  },
  minecraftInstallCancel: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:install-cancel', opts);
    }
    return Promise.resolve({ cancelled: true });
  },
  windowMinimize: () => { },
  windowMaximize: () => { },
  windowClose: () => { },
  openExternal: () => { },
  invoke: () => Promise.resolve(),
  on: () => () => { },
};

export const launcher = new Proxy({}, {
  get(_target, prop) {
    if (typeof window !== 'undefined' && window.launcher) {
      const val = window.launcher[prop];
      if (typeof val === 'function') {
        return val.bind(window.launcher);
      }
      if (val !== undefined) {
        return val;
      }
      if (typeof window.launcher.invoke === 'function') {
        if (prop === 'minecraftInstall') return (opts) => window.launcher.invoke('minecraft:install', opts);
        if (prop === 'minecraftRun') return (opts) => window.launcher.invoke('minecraft:run', opts);
        if (prop === 'minecraftStop') return (opts) => window.launcher.invoke('minecraft:stop', opts);
        if (prop === 'minecraftInstallCancel') return (opts) => window.launcher.invoke('minecraft:install-cancel', opts);
        if (prop === 'minecraftLogin') return (key) => window.launcher.invoke('minecraft:login', key);
        if (prop === 'minecraftLogout') return (key) => window.launcher.invoke('minecraft:logout', key);
        if (prop === 'minecraftGetAuthState') return (key) => window.launcher.invoke('minecraft:get-auth-state', key);
      }
    }
    if (prop in launcherFallback) {
      return launcherFallback[prop];
    }
    return () => Promise.resolve();
  }
});

export const minecraftLoginWithAbort = async (profileKey, abortSignal) => {
  if (typeof window !== 'undefined' && window.launcher?.minecraftLogin) {
    return await window.launcher.minecraftLogin(profileKey, abortSignal);
  }
  return await launcher.minecraftLogin(profileKey);
};
