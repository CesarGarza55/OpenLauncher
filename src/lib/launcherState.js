import fs from 'fs/promises';
import path from 'path';

const STATE_FILE_NAME = 'launcher-state.json';

export const DEFAULT_LAUNCHER_STATE = {
  profiles: [],
  mods: [],
  logs: [],
  versions: [],
  settings: {
    javaPath: '',
    keepOpen: false,
    showConsole: true,
    autoUpdate: true,
    showSnapshots: false,
    language: 'en',
  },
  installTargets: {
    minecraft: { title: 'Install Minecraft', versions: [] },
    fabric: { title: 'Install Fabric', versions: [] },
    forge: { title: 'Install Forge', versions: [] },
  },
  latest: { minecraft: 'unknown' },
};

function stateFilePath(storageDir) {
  return path.join(storageDir, STATE_FILE_NAME);
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeSettings(settings, fallbackSettings = DEFAULT_LAUNCHER_STATE.settings) {
  return {
    javaPath: typeof settings?.javaPath === 'string' ? settings.javaPath : fallbackSettings.javaPath,
    keepOpen: typeof settings?.keepOpen === 'boolean' ? settings.keepOpen : fallbackSettings.keepOpen,
    showConsole: typeof settings?.showConsole === 'boolean' ? settings.showConsole : fallbackSettings.showConsole,
    autoUpdate: typeof settings?.autoUpdate === 'boolean' ? settings.autoUpdate : fallbackSettings.autoUpdate,
    showSnapshots: typeof settings?.showSnapshots === 'boolean' ? settings.showSnapshots : fallbackSettings.showSnapshots,
    language: typeof settings?.language === 'string' && settings.language.trim()
      ? settings.language.trim()
      : fallbackSettings.language,
  };
}

export async function loadLauncherState(storageDir) {
  const state = await readJsonFile(stateFilePath(storageDir), DEFAULT_LAUNCHER_STATE);
  return {
    profiles: Array.isArray(state.profiles) ? state.profiles : [],
    mods: Array.isArray(state.mods) ? state.mods : [],
    logs: Array.isArray(state.logs) ? state.logs : [],
    versions: Array.isArray(state.versions) ? state.versions : [],
    settings: normalizeSettings(state.settings, DEFAULT_LAUNCHER_STATE.settings),
    installTargets: state.installTargets && typeof state.installTargets === 'object'
      ? state.installTargets
      : DEFAULT_LAUNCHER_STATE.installTargets,
    latest: state.latest && typeof state.latest === 'object'
      ? state.latest
      : DEFAULT_LAUNCHER_STATE.latest,
  };
}

export async function saveLauncherState(storageDir, state) {
  const normalizedState = {
    profiles: Array.isArray(state?.profiles) ? state.profiles : [],
    mods: Array.isArray(state?.mods) ? state.mods : [],
    logs: Array.isArray(state?.logs) ? state.logs : [],
    versions: Array.isArray(state?.versions) ? state.versions : [],
    settings: normalizeSettings(state?.settings, DEFAULT_LAUNCHER_STATE.settings),
    installTargets: state?.installTargets && typeof state.installTargets === 'object'
      ? state.installTargets
      : DEFAULT_LAUNCHER_STATE.installTargets,
    latest: state?.latest && typeof state.latest === 'object'
      ? state.latest
      : DEFAULT_LAUNCHER_STATE.latest,
  };

  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(stateFilePath(storageDir), JSON.stringify(normalizedState, null, 2), 'utf8');
  return normalizedState;
}