import fs from 'fs/promises';
import path from 'path';

const STATE_FILE_NAME = 'launcher-state.json';

export const DEFAULT_LAUNCHER_STATE = {
  profiles: [],
  activeProfileId: null,
  mods: [],
  logs: [],
  versions: [],
  settings: {
    javaPath: '',
    keepOpen: false,
    launchBehavior: 'hide',
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

export function normalizeProfile(profile, index = 0) {
  if (!profile || typeof profile !== 'object') {
    return {
      id: index === 0 ? 'default' : `profile-${Date.now()}-${index}`,
      name: index === 0 ? 'Default' : `Profile ${index + 1}`,
      localName: 'Player',
      skinName: '',
      microsoftAccount: '',
      version: null,
      ram: 4,
      jvmArguments: '',
      javaPath: '',
    };
  }

  return {
    id: String(profile.id || (index === 0 ? 'default' : `profile-${Date.now()}-${index}`)),
    name: String(profile.name || (index === 0 ? 'Default' : `Profile ${index + 1}`)).trim(),
    localName: String(profile.localName || profile.name || 'Player').trim(),
    skinName: typeof profile.skinName === 'string' ? profile.skinName.trim() : '',
    microsoftAccount: typeof profile.microsoftAccount === 'string' ? profile.microsoftAccount.trim() : '',
    version: profile.version ? String(profile.version) : null,
    ram: typeof profile.ram === 'number' && Number.isFinite(profile.ram) && profile.ram > 0 ? profile.ram : 4,
    jvmArguments: typeof profile.jvmArguments === 'string' ? profile.jvmArguments : '',
    javaPath: typeof profile.javaPath === 'string' ? profile.javaPath : '',
  };
}

function normalizeSettings(settings, fallbackSettings = DEFAULT_LAUNCHER_STATE.settings) {
  const rawBehavior = settings?.launchBehavior;
  let launchBehavior = 'hide';
  if (rawBehavior === 'keepOpen' || rawBehavior === 'hide' || rawBehavior === 'close') {
    launchBehavior = rawBehavior;
  } else if (settings?.keepOpen === true) {
    launchBehavior = 'keepOpen';
  } else if (fallbackSettings?.launchBehavior) {
    launchBehavior = fallbackSettings.launchBehavior;
  }

  return {
    javaPath: typeof settings?.javaPath === 'string' ? settings.javaPath : fallbackSettings.javaPath,
    keepOpen: launchBehavior === 'keepOpen',
    launchBehavior,
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
  const authStore = await readJsonFile(path.join(storageDir, 'auth-store.json'), {});
  const rawProfiles = Array.isArray(state.profiles) ? state.profiles : [];
  const profiles = rawProfiles.map((p, i) => {
    const normalized = normalizeProfile(p, i);
    const authProfile = authStore?.profiles?.[normalized.id];
    if (authProfile?.name) {
      if (!normalized.skinName) normalized.skinName = authProfile.name;
      if (!normalized.microsoftAccount) normalized.microsoftAccount = authProfile.name;
      if (normalized.localName === 'Player') normalized.localName = authProfile.name;
    }
    return normalized;
  });
  return {
    profiles,
    activeProfileId: typeof state.activeProfileId === 'string' && state.activeProfileId ? state.activeProfileId : (profiles[0]?.id || 'default'),
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
  const profiles = Array.isArray(state?.profiles) ? state.profiles.map((p, i) => normalizeProfile(p, i)) : [];
  const normalizedState = {
    profiles,
    activeProfileId: typeof state?.activeProfileId === 'string' && state.activeProfileId ? state.activeProfileId : (profiles[0]?.id || 'default'),
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