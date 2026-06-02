import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Readable } from 'stream';
import { loadLauncherCatalog } from '../src/lib/minecraftLauncher.js';
import { loadMinecraftNews } from '../src/lib/minecraftNews.js';
import { loadLauncherState, saveLauncherState } from '../src/lib/launcherState.js';
import {
  getAuthHeaders,
  getMicrosoftAuthState,
  loginMicrosoftInteractive,
  logoutMicrosoft,
} from '../src/lib/microsoftAuth.js';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isDev;
isDev = Boolean(process.defaultApp || process.argv.includes('--dev') || process.env.OPENLAUNCHER_DEV === '1');

let mainWindow;
const runningChildren = new Map();
const activeInstalls = new Map();
const WINDOW_STATE_FILE = 'window-state.json';
const WINDOW_MIN_WIDTH = 1100;
const WINDOW_MIN_HEIGHT = 660;
const UPDATE_REPOSITORY = 'CesarGarza55/OpenLauncher';
const UPDATE_RELEASES_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_RELEASES_PAGE = `https://github.com/${UPDATE_REPOSITORY}/releases/latest`;
const MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_LOADER_URL = 'https://meta.fabricmc.net/v2/versions/loader';
const FABRIC_INSTALLER_MAVEN_METADATA_URL = 'https://maven.fabricmc.net/net/fabricmc/fabric-installer/maven-metadata.xml';
const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
let windowStateSaveTimer = null;

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

function versionToTuple(version) {
  const value = String(version || '').trim();
  const lower = value.toLowerCase();
  let versionType = 2;
  if (lower.includes('alpha')) versionType = 0;
  else if (lower.includes('beta')) versionType = 1;
  const match = value.match(/(\d+(?:\.\d+)*)/);
  if (!match) return [versionType, 0];
  return [versionType, ...match[1].split('.').map(part => Number(part) || 0)];
}

function compareVersionTuples(left, right) {
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function getMavenLibraryKey(name) {
  const parts = String(name || '').trim().split(':');
  if (parts.length < 3) return null;

  const group = parts[0] || '';
  const artifact = parts[1] || '';
  const version = parts[2] || '';
  const classifierPart = parts[3] || '';
  const classifier = classifierPart.includes('@') ? classifierPart.split('@')[0] : classifierPart;

  if (!group || !artifact || !version) return null;

  return {
    key: `${group}:${artifact}:${classifier || ''}`,
    version,
  };
}

function normalizeReleaseVersionTag(release) {
  const raw = String(release?.tag_name || release?.name || '').trim();
  return raw.replace(/^v/i, '');
}

function isLaunchableUpdateAsset(assetName) {
  const lowerName = String(assetName || '').toLowerCase();
  if (process.platform === 'win32') {
    return lowerName.endsWith('.exe') || lowerName.endsWith('.zip');
  }
  if (process.platform === 'linux') {
    return lowerName.endsWith('.deb') || lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tar.xz');
  }
  if (process.platform === 'darwin') {
    return lowerName.endsWith('.dmg') || lowerName.endsWith('.zip');
  }
  return lowerName.endsWith('.exe') || lowerName.endsWith('.appimage');
}

const UPDATER_TRANSLATIONS = {
  en: {
    checking: 'Checking for launcher updates...',
    upToDate: 'Launcher is already up to date.',
    openingReleasePage: 'Opening the release page for this update.',
    downloading: 'Downloading {assetName}',
    launching: 'Launching downloaded update',
    updateAvailableTitle: 'Update available',
    updateAvailableMessage: 'OpenLauncher {latestVersion} is available.',
    detailWithAsset: 'Current version: {currentVersion}\nUpdate file: {assetName}',
    detailWithoutAsset: 'Current version: {currentVersion}\nNo launchable asset was found for this platform, so the release page will open instead.',
    downloadAndInstall: 'Download and install',
    openReleasePage: 'Open release page',
    later: 'Later',
  },
  es: {
    checking: 'Buscando actualizaciones del launcher...',
    upToDate: 'El launcher ya está actualizado.',
    openingReleasePage: 'Abriendo la página de la versión de esta actualización.',
    downloading: 'Descargando {assetName}',
    launching: 'Iniciando la actualización descargada',
    updateAvailableTitle: 'Actualización disponible',
    updateAvailableMessage: 'OpenLauncher {latestVersion} está disponible.',
    detailWithAsset: 'Versión actual: {currentVersion}\nArchivo de actualización: {assetName}',
    detailWithoutAsset: 'Versión actual: {currentVersion}\nNo se encontró un archivo ejecutable para esta plataforma, así que se abrirá la página de la versión.',
    downloadAndInstall: 'Descargar e instalar',
    openReleasePage: 'Abrir página de versión',
    later: 'Después',
  },
};

function formatI18nMessage(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] !== undefined ? String(values[key]) : match;
  });
}

async function getPreferredLanguage() {
  try {
    const raw = await fs.promises.readFile(getLanguageFilePath(), 'utf8');
    const data = JSON.parse(raw);
    return data?.language === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

function getUpdaterStrings(language) {
  return UPDATER_TRANSLATIONS[language] || UPDATER_TRANSLATIONS.en;
}

function pickUpdateAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  if (assets.length === 0) return null;
  const platform = process.platform;
  const scoredAssets = assets
    .filter(asset => asset && typeof asset === 'object')
    .filter(asset => !/source code/i.test(String(asset.name || '')))
    .map(asset => {
      const assetName = String(asset.name || '').toLowerCase();
      let score = 0;
      if (platform === 'win32') {
        if (assetName.endsWith('.exe')) {
          if (assetName.includes('portable')) {
            score += 80; // Portable gets lower priority than installer
          } else {
            score += 100; // Installer gets highest priority
          }
        }
        if (assetName.includes('setup') || assetName.includes('installer')) score += 20;
        if (assetName.endsWith('.zip')) score += 90;
        if (assetName.includes('win')) score += 5;
      } else if (platform === 'linux') {
        if (assetName.endsWith('.deb')) {
          if (assetName.includes('portable')) {
            score += 80; // Portable deb gets lower priority
          } else {
            score += 100; // Standard deb gets highest priority
          }
        }
        if (assetName.endsWith('.tar.gz') || assetName.endsWith('.tar.xz')) {
          if (assetName.includes('portable')) {
            score += 90; // Portable tar.gz
          } else {
            score += 85; // Standard tar.gz
          }
        }
        if (assetName.includes('linux')) score += 5;
      } else if (platform === 'darwin') {
        if (assetName.endsWith('.dmg')) score += 100;
        if (assetName.endsWith('.zip')) score += 80;
        if (assetName.includes('mac')) score += 10;
      }
      return { asset, score };
    })
    .sort((left, right) => right.score - left.score);
  if (scoredAssets.length === 0) return null;
  return scoredAssets[0].asset;
}

function sendUpdateEvent(channel, payload) {
  try { mainWindow?.webContents.send(channel, payload); } catch {}
}

async function downloadFileToPath(url, outPath, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OpenLauncher-Updater', Accept: 'application/octet-stream' },
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  const total = Number(response.headers.get('content-length')) || null;
  let loaded = 0;
  const readable = Readable.fromWeb(response.body);
  const writable = fs.createWriteStream(outPath);
  readable.on('data', (chunk) => {
    loaded += chunk.length;
    const percent = total ? Math.round((loaded / total) * 100) : null;
    onProgress?.({ loaded, total, percent });
  });
  await new Promise((resolve, reject) => {
    readable.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
    readable.on('error', reject);
  });
  return outPath;
}

async function launchDownloadedUpdate(filePath) {
  const resolvedPath = String(filePath || '').trim();
  if (!resolvedPath) throw new Error('Missing update file path.');
  const extension = path.extname(resolvedPath).toLowerCase();
  const basename = path.basename(resolvedPath).toLowerCase();

  if (process.platform === 'linux') {
    if (extension === '.appimage' || extension === '' || basename.endsWith('.tar.gz') || basename.endsWith('.tar.xz')) {
      await fs.promises.chmod(resolvedPath, 0o755).catch(() => {});
    }
    if (extension === '.deb') {
      await shell.openPath(resolvedPath);
      return { ok: true, launched: true, path: resolvedPath };
    }
  }

  if (process.platform === 'win32' && extension === '.zip') {
    await shell.openPath(resolvedPath);
    return { ok: true, launched: true, path: resolvedPath };
  }

  if (isLaunchableUpdateAsset(resolvedPath)) {
    const child = spawn(resolvedPath, [], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
    child.unref();
    return { ok: true, launched: true, path: resolvedPath };
  }

  await shell.openExternal(UPDATE_RELEASES_PAGE);
  return { ok: true, launched: false, path: resolvedPath };
}

async function checkForLauncherUpdate({ promptUser = false, parentWindow = null } = {}) {
  const currentVersion = String(app.getVersion() || '').trim();
  const updaterStrings = getUpdaterStrings(await getPreferredLanguage());
  sendUpdateEvent('minecraft:update-status', { phase: 'checking', currentVersion, message: updaterStrings.checking });
  const response = await fetch(UPDATE_RELEASES_API, {
    headers: { 'User-Agent': 'OpenLauncher-Updater', Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`Failed to check updates: ${response.status}`);
  const release = await response.json();
  const latestVersion = normalizeReleaseVersionTag(release);
  console.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);
  if (!latestVersion) return { error: 'InvalidRelease', message: 'Release metadata did not include a version tag.' };
  const currentTuple = versionToTuple(currentVersion);
  const latestTuple = versionToTuple(latestVersion);
  if (compareVersionTuples(latestTuple, currentTuple) <= 0) {
    sendUpdateEvent('minecraft:update-status', { phase: 'up-to-date', currentVersion, latestVersion, message: updaterStrings.upToDate });
    return { ok: true, upToDate: true, currentVersion, latestVersion };
  }
  const asset = pickUpdateAsset(release);
  const buttons = asset && isLaunchableUpdateAsset(asset.name)
    ? [updaterStrings.downloadAndInstall, updaterStrings.later]
    : [updaterStrings.openReleasePage, updaterStrings.later];
  if (promptUser) {
    const choice = await dialog.showMessageBox(parentWindow || undefined, {
      type: 'info', buttons, defaultId: 0, cancelId: 1, noLink: true,
      title: updaterStrings.updateAvailableTitle,
      message: formatI18nMessage(updaterStrings.updateAvailableMessage, { latestVersion }),
      detail: asset
        ? formatI18nMessage(updaterStrings.detailWithAsset, { currentVersion: currentVersion || 'unknown', assetName: asset.name })
        : formatI18nMessage(updaterStrings.detailWithoutAsset, { currentVersion: currentVersion || 'unknown' }),
    });
    if (choice.response !== 0) return { ok: true, available: true, declined: true, currentVersion, latestVersion };
  }
  if (!asset) {
    sendUpdateEvent('minecraft:update-status', { phase: 'release-page', currentVersion, latestVersion, message: updaterStrings.openingReleasePage });
    await shell.openExternal(release.html_url || UPDATE_RELEASES_PAGE);
    return { ok: true, available: true, openedReleasePage: true, currentVersion, latestVersion };
  }
  if (!isLaunchableUpdateAsset(asset.name)) {
    sendUpdateEvent('minecraft:update-status', { phase: 'release-page', currentVersion, latestVersion, message: updaterStrings.openingReleasePage });
    await shell.openExternal(release.html_url || UPDATE_RELEASES_PAGE);
    return { ok: true, available: true, openedReleasePage: true, currentVersion, latestVersion };
  }
  sendUpdateEvent('minecraft:update-status', {
    phase: 'downloading', currentVersion, latestVersion, assetName: asset.name,
    message: formatI18nMessage(updaterStrings.downloading, { assetName: asset.name }),
  });
  const updatesDir = path.join(app.getPath('userData'), 'updates');
  await fs.promises.mkdir(updatesDir, { recursive: true });
  const downloadPath = path.join(updatesDir, String(asset.name || `OpenLauncher-${latestVersion}`));
  try { await fs.promises.rm(downloadPath, { force: true }).catch(() => {}); } catch {}
  await downloadFileToPath(asset.browser_download_url, downloadPath, {
    onProgress: ({ loaded, total, percent }) => {
      sendUpdateEvent('minecraft:update-progress', { phase: 'downloading', loaded, total, percent, currentVersion, latestVersion, assetName: asset.name });
    },
  });
  sendUpdateEvent('minecraft:update-status', { phase: 'launching', currentVersion, latestVersion, assetName: asset.name, message: updaterStrings.launching });
  const launchResult = await launchDownloadedUpdate(downloadPath);
  if (launchResult?.launched) app.quit();
  sendUpdateEvent('minecraft:update-complete', { phase: 'complete', currentVersion, latestVersion, assetName: asset.name, path: downloadPath });
  return { ok: true, available: true, downloaded: true, path: downloadPath, currentVersion, latestVersion };
}

async function readWindowState() {
  try {
    const raw = await fs.promises.readFile(getWindowStatePath(), 'utf8');
    return parseSavedWindowState(JSON.parse(raw));
  } catch { return null; }
}

function writeWindowStateNow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const maximized = mainWindow.isMaximized();
  const bounds = maximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  const payload = {
    x: bounds.x, y: bounds.y,
    width: Math.max(WINDOW_MIN_WIDTH, bounds.width),
    height: Math.max(WINDOW_MIN_HEIGHT, bounds.height),
    maximized,
  };
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(payload, null, 2), 'utf8');
  } catch {}
}

function scheduleWindowStateSave() {
  if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => { windowStateSaveTimer = null; writeWindowStateNow(); }, 200);
}

function getMinecraftRoot() {
  if (process.platform === 'win32') {
    const appDataDir = process.env.APPDATA || app.getPath('appData');
    return path.join(appDataDir, '.minecraft');
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Application Support', 'minecraft');
  }
  return path.join(app.getPath('home'), '.minecraft');
}

function getMinecraftRoots() { return [getMinecraftRoot()]; }

function makeInstallId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function makeOfflineUuid(seed) {
  const hash = crypto.createHash('sha1').update(`OfflinePlayer:${seed}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function resolveMinecraftVersion(version) {
  if (!version || typeof version !== 'object') {
    const rawValue = String(version || '').trim();
    if (!rawValue) return '';
    const rawMatch = rawValue.match(/(\d+(?:\.\d+)+(?:[-+._a-z0-9]*)?)$/i);
    return rawMatch ? rawMatch[1] : rawValue;
  }
  const explicitCandidates = [version.mcVer, version.minecraftVersion, version.gameVersion, version.baseVersion];
  for (const candidate of explicitCandidates) {
    if (candidate && String(candidate).trim()) return String(candidate).trim();
  }
  const versionType = String(version.type || '').toLowerCase();
  const fallbackId = String(version.id || '').trim();
  if (versionType && versionType !== 'vanilla' && fallbackId) {
    const idMatch = fallbackId.match(/(\d+(?:\.\d+)+(?:[-+._a-z0-9]*)?)$/i);
    if (idMatch) return idMatch[1];
    const labelMatch = String(version.label || '').match(/(\d+(?:\.\d+)+(?:[-+._a-z0-9]*)?)$/i);
    if (labelMatch) return labelMatch[1];
  }
  return fallbackId;
}

async function loadLocalVersionMetadata(versionDir) {
  if (!versionDir) return null;
  const baseName = path.basename(versionDir);
  const candidateFiles = [
    path.join(versionDir, 'version.json'),
    path.join(versionDir, `${baseName}.json`),
  ];
  try {
    const directoryEntries = await fs.promises.readdir(versionDir, { withFileTypes: true });
    for (const entry of directoryEntries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        const filePath = path.join(versionDir, entry.name);
        if (!candidateFiles.includes(filePath)) candidateFiles.push(filePath);
      }
    }
    for (const candidateFile of candidateFiles) {
      try {
        const raw = await fs.promises.readFile(candidateFile, 'utf8');
        const descriptor = JSON.parse(raw);
        if (descriptor?.versionJson && typeof descriptor.versionJson === 'object') return descriptor.versionJson;
        if (descriptor && typeof descriptor === 'object') {
          if (descriptor.downloads || descriptor.libraries || descriptor.mainClass || descriptor.arguments) return descriptor;
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function loadMojangVersionMetadata(versionId) {
  if (!versionId) return null;
  const manifestRes = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
  if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const versionEntry = (manifest.versions || []).find(v => v.id === String(versionId));
  if (!versionEntry) throw new Error(`Version ${versionId} not found in manifest.`);
  const versionJsonRes = await fetch(versionEntry.url);
  if (!versionJsonRes.ok) throw new Error(`Failed to fetch version data: ${versionJsonRes.status}`);
  return await versionJsonRes.json();
}

async function findFirstMatchingJar(rootDir, matcher) {
  try {
    const entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(rootDir, entry.name);
      if (entry.isFile()) {
        if (matcher(entry.name, entryPath)) return entryPath;
      } else if (entry.isDirectory()) {
        const nestedResult = await findFirstMatchingJar(entryPath, matcher);
        if (nestedResult) return nestedResult;
      }
    }
  } catch {}
  return null;
}

function mergeVersionMetadata(baseVersionJson, customVersionJson) {
  if (!baseVersionJson) return customVersionJson || null;
  if (!customVersionJson) return baseVersionJson;
  return {
    ...baseVersionJson,
    ...customVersionJson,
    libraries: [...(baseVersionJson.libraries || []), ...(customVersionJson.libraries || [])],
    arguments: { ...(baseVersionJson.arguments || {}), ...(customVersionJson.arguments || {}) },
    downloads: customVersionJson.downloads || baseVersionJson.downloads,
    assetIndex: customVersionJson.assetIndex || baseVersionJson.assetIndex,
    mainClass: customVersionJson.mainClass || baseVersionJson.mainClass,
    inheritsFrom: customVersionJson.inheritsFrom || baseVersionJson.inheritsFrom,
    minecraftArguments: customVersionJson.minecraftArguments || baseVersionJson.minecraftArguments,
    javaVersion: customVersionJson.javaVersion || baseVersionJson.javaVersion,
    assets: customVersionJson.assets || baseVersionJson.assets,
    type: customVersionJson.type || baseVersionJson.type,
  };
}

async function findLocalVersionJar(versionDir, preferredNames = []) {
  if (!versionDir) return null;
  const preferred = new Set(
    preferredNames.filter(Boolean).map(value => String(value).trim()).flatMap(value => [value, `${value}.jar`])
  );
  try {
    const entries = await fs.promises.readdir(versionDir, { withFileTypes: true });
    const jarFiles = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.jar')).map(entry => entry.name);
    for (const fileName of jarFiles) {
      if (preferred.has(fileName) || preferred.has(fileName.replace(/\.jar$/i, ''))) return path.join(versionDir, fileName);
    }
    if (jarFiles.length === 1) return path.join(versionDir, jarFiles[0]);
    return jarFiles.length > 0 ? path.join(versionDir, jarFiles.sort()[0]) : null;
  } catch { return null; }
}

function buildMavenArtifactInfo(coordinates) {
  const parts = String(coordinates || '').trim().split(':');
  if (parts.length < 3) return null;
  const group = parts[0];
  const artifact = parts[1];
  const version = parts[2];
  const classifier = parts[3] || '';
  let extension = 'jar';
  if (parts[3] && parts[3].includes('@')) {
    const [rawClassifier, rawExtension] = parts[3].split('@');
    if (rawClassifier) {
      extension = rawExtension || extension;
      const suffix = rawClassifier ? `-${rawClassifier}` : '';
      const fileName = `${artifact}-${version}${suffix}.${extension}`;
      const relativePath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${fileName}`;
      return { relativePath, fileName };
    }
  }
  if (parts[4]) extension = parts[4];
  const classifierSuffix = classifier ? `-${classifier}` : '';
  const fileName = `${artifact}-${version}${classifierSuffix}.${extension}`;
  const relativePath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${fileName}`;
  return { relativePath, fileName };
}

function getLibraryPathFromName(name, minecraftDirectory) {
  const root = path.join(minecraftDirectory, 'libraries');
  const parts = String(name || '').split(':');
  const basePath = parts[0] || '';
  const libraryName = parts[1] || '';
  let version = parts[2] || '';
  const extraParts = parts.slice(3);
  let extension = 'jar';
  if (version.includes('@')) {
    const splitVersion = version.split('@');
    version = splitVersion[0];
    extension = splitVersion[1] || extension;
  }
  let libraryPath = root;
  for (const segment of basePath.split('.').filter(Boolean)) libraryPath = path.join(libraryPath, segment);
  const suffix = extraParts.length > 0 ? `-${extraParts.join('-')}` : '';
  const fileName = `${libraryName}-${version}${suffix}.${extension}`;
  return path.join(libraryPath, libraryName, version, fileName);
}

function resolveLibraryArtifactCandidates(lib) {
  const coordinates = String(lib?.name || '').trim();
  const artifactInfo = buildMavenArtifactInfo(coordinates);
  if (!artifactInfo) return [];
  const repositories = Array.from(new Set([
    String(lib?.url || '').trim(),
    'https://libraries.minecraft.net',
    'https://maven.fabricmc.net',
    'https://repo1.maven.org/maven2',
  ].filter(Boolean)));
  return repositories.map(repo => `${repo.replace(/\/+$/g, '')}/${artifactInfo.relativePath}`);
}

function parseFabricInstallerVersionMetadata(xmlText) {
  const text = String(xmlText || '');
  const releaseMatch = text.match(/<release>([^<]+)<\/release>/i);
  if (releaseMatch?.[1]) return releaseMatch[1].trim();
  const latestMatch = text.match(/<latest>([^<]+)<\/latest>/i);
  if (latestMatch?.[1]) return latestMatch[1].trim();
  return null;
}

async function getLatestFabricInstallerVersion() {
  const response = await fetch(FABRIC_INSTALLER_MAVEN_METADATA_URL);
  if (!response.ok) throw new Error(`Failed to fetch Fabric installer metadata: ${response.status}`);
  const xmlText = await response.text();
  const version = parseFabricInstallerVersionMetadata(xmlText);
  if (!version) throw new Error('Fabric installer version not found in metadata.');
  return version;
}

function runCommand(command, args, { cwd, onStdout, onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { const text = String(chunk); stdout += text; if (onStdout) onStdout(text); });
    child.stderr?.on('data', (chunk) => { const text = String(chunk); stderr += text; if (onStderr) onStderr(text); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr, pid: child.pid }));
  });
}

async function launchJavaWithArgs(javaCmd, javaArgs, cwd, installId) {
  const argFilePath = path.join(app.getPath('temp'), `openlauncher-java-${installId || Date.now()}.args`);
  const argFileContents = javaArgs
    .map(arg => (String(arg).includes(' ') || String(arg).includes('\t') ? `"${String(arg).replaceAll('"', '\\"')}"` : String(arg)))
    .join('\n');
  await fs.promises.writeFile(argFilePath, argFileContents, 'utf8');
  const child = spawn(javaCmd, [`@${argFilePath}`], { cwd });
  return { child, argFilePath };
}

function parseJavaMajorVersion(output) {
  const text = `${output || ''}`;
  const match = text.match(/version\s+"(?:(\d+)\.(\d+)\.|(\d+))(?:[^"]*)"/i);
  if (!match) return null;
  if (match[3]) return Number(match[3]);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 1 && Number.isFinite(minor)) return minor;
  return Number.isFinite(major) ? major : null;
}

function resolveJavaCommand(javaPath) {
  if (javaPath && String(javaPath).trim()) return String(javaPath).trim();
  if (process.env.JAVA_HOME) {
    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(process.env.JAVA_HOME, 'bin', `java${ext}`);
  }
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function detectJavaMajor(javaCmd) {
  const result = spawnSync(javaCmd, ['-version'], { encoding: 'utf8' });
  if (result.error) return null;
  return parseJavaMajorVersion(`${result.stderr || ''}\n${result.stdout || ''}`);
}

function expandJavaExecutableCandidate(candidate) {
  if (!candidate) return [];
  const value = String(candidate).trim();
  if (!value) return [];
  const normalized = value.replace(/\/+$/g, '');
  const candidates = [normalized];
  const baseName = path.basename(normalized).toLowerCase();
  if (!baseName.endsWith('java') && !baseName.endsWith('java.exe')) {
    candidates.push(path.join(normalized, 'bin', `java${process.platform === 'win32' ? '.exe' : ''}`));
  }
  return candidates;
}

function collectCommonJavaCandidates() {
  const candidates = [];
  const add = (value) => { if (!value) return; const normalized = String(value).trim(); if (normalized) candidates.push(normalized); };
  const pathCandidates = process.platform === 'win32' ? ['java.exe', 'java'] : ['java'];
  for (const executable of pathCandidates) {
    const lookup = spawnSync(process.platform === 'win32' ? 'where' : 'which', [executable], { encoding: 'utf8' });
    if (!lookup.error && lookup.status === 0) {
      for (const line of String(lookup.stdout || '').split(/\r?\n/)) add(line);
    }
  }
  if (process.platform === 'win32') {
    const roots = [
      process.env.JAVA_HOME,
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\Zulu',
      'C:\\Program Files\\Amazon Corretto',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\OpenLogic',
      'C:\\Program Files\\AdoptOpenJDK',
      'C:\\Program Files (x86)\\Eclipse Adoptium',
      'C:\\Program Files (x86)\\Java',
    ].filter(Boolean);
    for (const root of roots) {
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const lower = entry.name.toLowerCase();
          if (!/(jdk|jre|java|temurin|adoptium|corretto|zulu|bellsoft|openlogic|microsoft)/.test(lower)) continue;
          add(path.join(root, entry.name, 'bin', 'java.exe'));
        }
      } catch {}
    }
  }
  return Array.from(new Set(candidates.flatMap(expandJavaExecutableCandidate)));
}

function findJavaCommand(requiredMajor, preferredPath = '') {
  const preferredCandidates = expandJavaExecutableCandidate(preferredPath);
  const fallbackCandidates = collectCommonJavaCandidates();
  const allCandidates = Array.from(new Set([...preferredCandidates, ...fallbackCandidates]));
  let bestCandidate = null;
  let bestMajor = null;
  for (const candidate of allCandidates) {
    const major = detectJavaMajor(candidate);
    if (!major) continue;
    if (!bestCandidate || major > bestMajor) { bestCandidate = candidate; bestMajor = major; }
    if (!requiredMajor || major >= requiredMajor) return { javaCmd: candidate, javaMajor: major };
  }
  return { javaCmd: bestCandidate || resolveJavaCommand(preferredPath), javaMajor: bestMajor };
}

async function downloadToFile(url, outPath, installId, fileLabel = null) {
  const controller = new AbortController();
  const signal = controller.signal;
  if (!activeInstalls.has(installId)) activeInstalls.set(installId, { controllers: new Set() });
  activeInstalls.get(installId).controllers.add(controller);
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    const total = Number(res.headers.get('content-length')) || null;
    let loaded = 0;
    const dest = fs.createWriteStream(outPath);
    const readable = Readable.fromWeb(res.body);
    readable.on('data', (chunk) => {
      loaded += chunk.length;
      const percent = total ? Math.round((loaded / total) * 100) : null;
      try { mainWindow?.webContents.send('minecraft:install-file-progress', { installId, file: fileLabel || outPath, loaded, total, percent }); } catch (e) {}
      try { mainWindow?.webContents.send('minecraft:install-progress', { installId, loaded, total, percent }); } catch (e) {}
    });
    await new Promise((resolve, reject) => {
      readable.pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
      readable.on('error', reject);
    });
    return { ok: true, path: outPath };
  } finally {
    const entry = activeInstalls.get(installId);
    if (entry) entry.controllers.delete(controller);
  }
}

async function saveResponseBodyToFile(response, outPath) {
  if (!response?.body) throw new Error('Empty response body');
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  const readable = Readable.fromWeb(response.body);
  const writable = fs.createWriteStream(outPath);
  await new Promise((resolve, reject) => {
    readable.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
    readable.on('error', reject);
  });
  return outPath;
}

function isValidJarFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size === 0) return false;
    new AdmZip(filePath);
    return true;
  } catch { return false; }
}

async function ensureJarFile(url, outPath) {
  if (isValidJarFile(outPath)) return outPath;
  try { await fs.promises.unlink(outPath); } catch {}
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  await saveResponseBodyToFile(response, outPath);
  return outPath;
}

function readZipEntryText(zip, entryName) {
  const entry = zip.getEntry(entryName);
  if (!entry) return null;
  return entry.getData().toString('utf8');
}

async function extractZipEntryToFile(zip, entryName, outPath) {
  const entry = zip.getEntry(entryName);
  if (!entry) return false;
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, entry.getData());
  return true;
}

function parseJsonFromZipEntry(zip, entryNames) {
  for (const entryName of entryNames) {
    const raw = readZipEntryText(zip, entryName);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Try the next entry name.
    }
  }
  return null;
}

function getJarMainClass(jarPath) {
  try {
    const zip = new AdmZip(jarPath);
    const manifest = readZipEntryText(zip, 'META-INF/MANIFEST.MF');
    if (!manifest) return null;
    const lines = String(manifest).split(/\r?\n/);
    const fields = {};
    let currentKey = null;
    for (const line of lines) {
      if (!line) continue;
      if (/^[\t ]/.test(line) && currentKey) {
        fields[currentKey] = `${fields[currentKey] || ''}${line.trim()}`;
        continue;
      }
      const colonIndex = line.indexOf(':');
      if (colonIndex <= 0) continue;
      currentKey = line.slice(0, colonIndex).trim();
      fields[currentKey] = line.slice(colonIndex + 1).trim();
    }
    return fields['Main-Class'] || null;
  } catch {
    return null;
  }
}

function rulesPassForCurrentSystem(rules, features = {}) {
  if (!rules) return true;
  let allow = false;
  for (const rule of rules) {
    let match = true;
    if (rule.os && rule.os.name) {
      const osName = rule.os.name;
      if (osName === 'windows') match = process.platform === 'win32';
      else if (osName === 'linux') match = process.platform === 'linux';
      else if (osName === 'osx' || osName === 'mac') match = process.platform === 'darwin';
      else match = false;
    }
    if (match && rule.features && typeof rule.features === 'object') {
      for (const [featureName, requiredValue] of Object.entries(rule.features)) {
        const actualValue = Boolean(features?.[featureName]);
        if (Boolean(requiredValue) !== actualValue) { match = false; break; }
      }
    }
    if (match) {
      if (rule.action === 'allow') allow = true;
      if (rule.action === 'disallow') allow = false;
    }
  }
  return allow;
}

function substituteTemplateString(input, substitutions) {
  let output = String(input ?? '');
  for (const [key, value] of Object.entries(substitutions)) {
    output = output.replaceAll(key, value);
  }
  return output;
}

async function installForgeLibraryEntry(library, minecraftRoot, installId) {
  if (!library || !rulesPassForCurrentSystem(library.rules)) return;

  const libsDir = path.join(minecraftRoot, 'libraries');
  const artifact = library?.downloads?.artifact || null;
  const artifactPath = artifact?.path
    ? path.join(libsDir, artifact.path)
    : library?.name
      ? getLibraryPathFromName(library.name, minecraftRoot)
      : null;

  const artifactCandidates = [];
  if (artifact?.url) artifactCandidates.push(artifact.url);
  artifactCandidates.push(...resolveLibraryArtifactCandidates(library));

  if (artifactPath && artifactCandidates.length > 0) {
    for (const candidateUrl of artifactCandidates) {
      try {
        await ensureJarFile(candidateUrl, artifactPath);
        break;
      } catch {
        // Try the next repository candidate.
      }
    }
  }

  const platformKey = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
  const classifier = library?.natives?.[platformKey];
  const nativeArtifact = classifier ? library?.downloads?.classifiers?.[classifier] : null;
  if (nativeArtifact?.url) {
    const nativePath = nativeArtifact.path
      ? path.join(libsDir, nativeArtifact.path)
      : getLibraryPathFromName(`${library.name}:${classifier}`, minecraftRoot);
    await ensureJarFile(nativeArtifact.url, nativePath);
  }
}

async function installForgeLibraries(libraries, minecraftRoot, installId) {
  for (const library of libraries || []) {
    try {
      await installForgeLibraryEntry(library, minecraftRoot, installId);
    } catch (error) {
      try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: `Forge library download failed: ${error?.message || error}` }); } catch {}
    }
  }
}

async function runForgeProcessors(versionData, minecraftRoot, lzmaPath, installerPath, javaCmd) {
  const processors = Array.isArray(versionData?.processors) ? versionData.processors : [];
  if (processors.length === 0) return;

  const pathString = String(minecraftRoot);
  const argumentVars = {
    '{MINECRAFT_JAR}': path.join(pathString, 'versions', versionData.minecraft, `${versionData.minecraft}.jar`),
    '{INSTALLER}': installerPath,
    '{BINPATCH}': lzmaPath,
    '{SIDE}': 'client',
  };

  const tempRoot = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'openlauncher-forge-root-'));
  argumentVars['{ROOT}'] = tempRoot;

  for (const [dataKey, dataValue] of Object.entries(versionData?.data || {})) {
    const clientValue = String(dataValue?.client || '');
    if (clientValue.startsWith('[') && clientValue.endsWith(']')) {
      argumentVars[`{${dataKey}}`] = getLibraryPathFromName(clientValue.slice(1, -1), pathString);
    } else {
      argumentVars[`{${dataKey}}`] = clientValue;
    }
  }

  for (const processor of processors) {
    if (!Array.isArray(processor?.sides) || !processor.sides.includes('client')) continue;

    const classpathEntries = [];
    for (const classpathItem of processor.classpath || []) {
      classpathEntries.push(getLibraryPathFromName(classpathItem, pathString));
    }
    classpathEntries.push(getLibraryPathFromName(processor.jar, pathString));

    const mainClass = getJarMainClass(getLibraryPathFromName(processor.jar, pathString));
    if (!mainClass) continue;

    const command = [javaCmd, '-cp', classpathEntries.join(process.platform === 'win32' ? ';' : ':'), mainClass];
    for (const arg of processor.args || []) {
      const value = substituteTemplateString(arg, argumentVars);
      command.push(value.startsWith('[') && value.endsWith(']') ? getLibraryPathFromName(value.slice(1, -1), pathString) : value);
    }

    await new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), { cwd: minecraftRoot });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', chunk => {
        const text = String(chunk);
        stdout += text;
        try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stdout', msg: text }); } catch {}
      });
      child.stderr?.on('data', chunk => {
        const text = String(chunk);
        stderr += text;
        try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: text }); } catch {}
      });
      child.on('error', reject);
      child.on('close', code => code === 0 ? resolve() : reject(new Error(`Forge processor failed with code ${code}. ${stderr || stdout || ''}`.trim())));
    });
  }
}

async function installForgeVersionClient(versionId, versionJson, minecraftRoot, installId) {
  const clientUrl = versionJson?.downloads?.client?.url || versionJson?.versionInfo?.downloads?.client?.url || null;
  if (!clientUrl) return null;
  const outDir = path.join(minecraftRoot, 'versions', versionId);
  await fs.promises.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${versionId}.jar`);
  await ensureJarFile(clientUrl, outPath);
  return outPath;
}

async function ensureVanillaVersionInstalled(minecraftRoot, minecraftVersion, installId) {
  const manifestRes = await fetch(MOJANG_MANIFEST_URL);
  if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const versionEntry = (manifest.versions || []).find(v => v.id === String(minecraftVersion));
  if (!versionEntry) throw new Error(`Version ${minecraftVersion} not found in manifest.`);

  const versionJsonRes = await fetch(versionEntry.url);
  if (!versionJsonRes.ok) throw new Error(`Failed to fetch version data: ${versionJsonRes.status}`);
  const versionJson = await versionJsonRes.json();

  const clientUrl = versionJson?.downloads?.client?.url;
  if (!clientUrl) {
    throw new Error(`Client download URL not found for ${minecraftVersion}.`);
  }

  const outDir = path.join(minecraftRoot, 'versions', String(minecraftVersion));
  await fs.promises.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${minecraftVersion}.jar`);
  const dl = await downloadToFile(clientUrl, outPath, installId, `${minecraftVersion}-client.jar`);
  if (!dl.ok) throw new Error(`Client download failed for ${minecraftVersion}.`);

  await persistInstalledVersion(outDir, {
    id: String(versionJson?.id || minecraftVersion),
    label: `Minecraft ${minecraftVersion}`,
    type: 'vanilla',
    mcVer: String(minecraftVersion),
    versionJson,
  });

  return { versionJson, versionDir: outDir, jarPath: outPath };
}

async function readInstalledVersions() {
  const installed = [];
  const seen = new Set();
  for (const root of getMinecraftRoots()) {
    const versionsDir = path.join(root, 'versions');
    try {
      const dirEntries = await fs.promises.readdir(versionsDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        if (!entry.isDirectory()) continue;
        const versionId = entry.name;
        const versionDir = path.join(versionsDir, versionId);
        const versionJsonPath = path.join(versionDir, 'version.json');
        let descriptor = null;
        try { const raw = await fs.promises.readFile(versionJsonPath, 'utf8'); descriptor = JSON.parse(raw); } catch { descriptor = null; }
        const jarFiles = (await fs.promises.readdir(versionDir).catch(() => [])).filter(fileName => fileName.toLowerCase().endsWith('.jar'));
        if (!descriptor && jarFiles.length === 0) continue;
        const id = descriptor?.id || versionId;
        if (seen.has(id)) continue;
        seen.add(id);
        const lowerId = id.toLowerCase();
        let detectedType = descriptor?.type || 'vanilla';
        if (lowerId.includes('fabric')) detectedType = 'fabric';
        else if (lowerId.includes('forge')) detectedType = 'forge';
        else if (lowerId.includes('neoforge') || lowerId.includes('neo forge')) detectedType = 'neoforge';
        else if (lowerId.includes('quilt')) detectedType = 'quilt';
        else if (lowerId.includes('vanilla') || descriptor?.type === 'vanilla') detectedType = 'vanilla';
        installed.push({
          id, label: versionId, type: detectedType,
          mcVer: descriptor?.mcVer || descriptor?.minecraftVersion || versionId,
          loaderVersion: descriptor?.loaderVersion || descriptor?.fabricLoaderVersion || null,
          installedAt: descriptor?.installedAt || null,
          path: versionDir,
        });
      }
    } catch {}
  }
  return installed;
}

async function readInstalledMods() {
  const installed = [];
  const seen = new Set();
  for (const root of getMinecraftRoots()) {
    const modsDir = path.join(root, 'mods');
    try {
      const dirEntries = await fs.promises.readdir(modsDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        if (!entry.isFile()) continue;
        const fileName = entry.name;
        const lowerName = fileName.toLowerCase();
        let modId = null;
        let enabled = false;
        if (lowerName.endsWith('.jar')) { modId = fileName.replace(/\.jar$/i, ''); enabled = true; }
        else if (lowerName.endsWith('.olpkg')) { modId = fileName.replace(/\.olpkg$/i, ''); enabled = false; }
        if (!modId) continue;
        if (seen.has(modId)) continue;
        seen.add(modId);
        installed.push({ id: modId, name: modId, version: 'installed', type: 'jar', enabled, path: path.join(modsDir, fileName) });
      }
    } catch {}
  }
  return installed;
}

async function resolveModFile(modsDir, modId, extension) {
  const baseId = String(modId || '').replace(/\.(jar|olpkg)$/i, '').trim();
  if (!baseId) return null;
  const directPath = path.join(modsDir, `${baseId}.${extension}`);
  if (fs.existsSync(directPath)) return directPath;
  try {
    const entries = await fs.promises.readdir(modsDir, { withFileTypes: true });
    const match = entries.find(entry => {
      if (!entry.isFile()) return false;
      return entry.name.toLowerCase() === `${baseId}.${extension}`.toLowerCase();
    });
    return match ? path.join(modsDir, match.name) : null;
  } catch { return null; }
}

async function toggleMod(modId, enable) {
  const root = getMinecraftRoot();
  const modsDir = path.join(root, 'mods');
  try {
    if (enable) {
      const disabledPath = await resolveModFile(modsDir, modId, 'olpkg');
      if (disabledPath) {
        const enabledPath = path.join(modsDir, `${String(modId || '').replace(/\.(jar|olpkg)$/i, '').trim()}.jar`);
        await fs.promises.rename(disabledPath, enabledPath);
        return { ok: true, enabled: true };
      }
      return { error: 'NotFound', message: `Disabled mod not found: ${modId}.olpkg` };
    } else {
      const enabledPath = await resolveModFile(modsDir, modId, 'jar');
      if (enabledPath) {
        const disabledPath = path.join(modsDir, `${String(modId || '').replace(/\.(jar|olpkg)$/i, '').trim()}.olpkg`);
        await fs.promises.rename(enabledPath, disabledPath);
        return { ok: true, enabled: false };
      }
      return { error: 'NotFound', message: `Enabled mod not found: ${modId}.jar` };
    }
  } catch (error) { return { error: 'RenameFailed', message: error?.message || String(error) }; }
}

async function setAllModsEnabled(enable) {
  const mods = await readInstalledMods();
  const targetMods = mods.filter(mod => Boolean(mod.enabled) !== Boolean(enable));
  for (const mod of targetMods) {
    const result = await toggleMod(mod.id, enable);
    if (result?.error) {
      return { error: result.error, message: result.message || `Failed to update mod ${mod.id}.` };
    }
  }
  return { ok: true, updated: targetMods.length };
}

async function deleteMod(modId) {
  const root = getMinecraftRoot();
  const modsDir = path.join(root, 'mods');
  const baseId = String(modId || '').replace(/\.(jar|olpkg)$/i, '').trim();
  if (!baseId) return { error: 'BadInput', message: 'Missing mod id.' };
  const targets = [path.join(modsDir, `${baseId}.jar`), path.join(modsDir, `${baseId}.olpkg`)];
  const existingPaths = targets.filter(existingPath => fs.existsSync(existingPath));
  if (existingPaths.length === 0) return { error: 'NotFound', message: `Mod not found: ${baseId}` };
  const choice = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'warning', buttons: ['Cancel', 'Delete'], defaultId: 1, cancelId: 0, noLink: true,
    title: 'Delete mod?', message: `Delete ${baseId}?`,
    detail: 'This will remove the mod file from the Minecraft mods folder.',
  });
  if (choice.response !== 1) return { canceled: true, reason: 'delete-cancelled' };
  try {
    for (const existingPath of existingPaths) await fs.promises.unlink(existingPath).catch(() => {});
    return { ok: true, removed: existingPaths };
  } catch (error) { return { error: 'DeleteFailed', message: error?.message || String(error) }; }
}

function normalizeModFileName(fileName) {
  const trimmedName = String(fileName || '').trim();
  if (!trimmedName) return null;
  const ext = path.extname(trimmedName).toLowerCase();
  if (ext !== '.jar' && ext !== '.olpkg') return null;
  return trimmedName;
}

async function importModFile(payload) {
  const sourcePath = typeof payload === 'string' ? payload : payload?.sourcePath;
  const fileName = typeof payload === 'object' ? payload?.fileName : null;
  const fileBytes = typeof payload === 'object' ? payload?.fileBytes : null;
  const resolvedSourcePath = String(sourcePath || '').trim();
  const resolvedFileName = normalizeModFileName(fileName || (resolvedSourcePath ? path.basename(resolvedSourcePath) : ''));
  if (!resolvedSourcePath && !resolvedFileName) return { error: 'BadInput', message: 'Missing mod file name.' };
  const ext = path.extname(resolvedFileName || resolvedSourcePath).toLowerCase();
  if (ext !== '.jar' && ext !== '.olpkg') return { error: 'UnsupportedFile', message: 'Only .jar and .olpkg files can be imported as mods.' };
  const root = getMinecraftRoot();
  const modsDir = path.join(root, 'mods');
  await fs.promises.mkdir(modsDir, { recursive: true });
  const sourceFileName = resolvedFileName || path.basename(resolvedSourcePath);
  const baseName = sourceFileName.replace(/\.(jar|olpkg)$/i, '');
  const destinationPath = path.join(modsDir, sourceFileName);
  const jarPath = path.join(modsDir, `${baseName}.jar`);
  const olpkgPath = path.join(modsDir, `${baseName}.olpkg`);
  const existingPaths = [destinationPath, jarPath, olpkgPath].filter(existingPath => fs.existsSync(existingPath));
  if (existingPaths.length > 0) {
    const choice = await dialog.showMessageBox(mainWindow || undefined, {
      type: 'question', buttons: ['Cancel', 'Replace'], defaultId: 1, cancelId: 0, noLink: true,
      title: 'Replace mod?', message: `A mod with the same name already exists: ${sourceFileName}`,
      detail: 'Do you want to replace the existing file in the Minecraft mods folder?',
    });
    if (choice.response !== 1) return { canceled: true, reason: 'replace-cancelled', path: destinationPath };
    for (const existingPath of existingPaths) await fs.promises.unlink(existingPath).catch(() => {});
  }
  if (resolvedSourcePath) {
    const stats = await fs.promises.stat(resolvedSourcePath).catch(() => null);
    if (!stats?.isFile()) return { error: 'NotFound', message: `File not found: ${resolvedSourcePath}` };
    if (path.resolve(resolvedSourcePath) !== path.resolve(destinationPath)) await fs.promises.copyFile(resolvedSourcePath, destinationPath);
  } else {
    const buffer = Buffer.isBuffer(fileBytes) ? fileBytes : fileBytes instanceof Uint8Array ? Buffer.from(fileBytes) : Array.isArray(fileBytes) ? Buffer.from(fileBytes) : null;
    if (!buffer || buffer.length === 0) return { error: 'BadInput', message: 'Missing mod file contents.' };
    await fs.promises.writeFile(destinationPath, buffer);
  }
  return { ok: true, path: destinationPath, enabled: ext === '.jar' };
}

async function persistInstalledVersion(versionDir, versionData) {
  await fs.promises.mkdir(versionDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(versionDir, 'version.json'),
    JSON.stringify({ ...versionData, installedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

async function createWindow() {
  const defaultBounds = computeDefaultWindowBounds();
  const savedWindowState = await readWindowState();
  const canUseSavedBounds = savedWindowState && boundsAreVisible(savedWindowState);
  const initialBounds = canUseSavedBounds ? savedWindowState : { ...defaultBounds, maximized: false };
  const browserWindowOptions = {
    width: initialBounds.width, height: initialBounds.height,
    minWidth: WINDOW_MIN_WIDTH, minHeight: WINDOW_MIN_HEIGHT,
    frame: false, backgroundColor: '#0e0e0e',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.cjs') },
  };
  if (Number.isFinite(initialBounds.x) && Number.isFinite(initialBounds.y)) {
    browserWindowOptions.x = initialBounds.x;
    browserWindowOptions.y = initialBounds.y;
  }
  mainWindow = new BrowserWindow(browserWindowOptions);
  mainWindow.on('resize', scheduleWindowStateSave);
  mainWindow.on('move', scheduleWindowStateSave);
  mainWindow.on('maximize', scheduleWindowStateSave);
  mainWindow.on('unmaximize', scheduleWindowStateSave);
  mainWindow.on('close', () => {
    if (windowStateSaveTimer) { clearTimeout(windowStateSaveTimer); windowStateSaveTimer = null; }
    writeWindowStateNow();
  });
  if (initialBounds.maximized) mainWindow.maximize();
  // Try loading dev server first when in development, otherwise try multiple
  // candidate paths for the production `index.html` to avoid issues when
  // packaging with ASAR where `__dirname` may point to a different folder.
  if (isDev) {
    try {
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      return;
    } catch (e) {
      console.error('Failed to load Vite dev server at http://localhost:5173:', e?.message || e);
      return;
    }
  }

  const candidates = [
    path.join(__dirname, 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
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
    } catch (err) {
      // ignore and try next
    }
  }

  if (!loaded) {
    try {
      // Last resort: attempt to load the default path to surface errors
      await mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
      loaded = true;
    } catch (err) {
      console.error('Failed to load index.html from candidates:', err?.message || err);
    }
  }

}

async function maybeRunStartupUpdateCheck() {
  try {
    const state = await loadLauncherState(app.getPath('userData'));
    if (state.settings?.autoUpdate === false) return;
    await checkForLauncherUpdate({ promptUser: true, parentWindow: mainWindow });
  } catch (error) {
    if (isDev) console.warn('Startup update check failed:', error?.message || error);
  }
}

app.whenReady().then(async () => { await createWindow(); void maybeRunStartupUpdateCheck(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => { if (!mainWindow) return; if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('shell:open-external', (_, url) => shell.openExternal(url));
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
ipcMain.handle('minecraft:get-catalog', async () => {
  const currentState = await loadLauncherState(app.getPath('userData'));
  const catalog = await loadLauncherCatalog({ includeSnapshots: currentState.settings?.showSnapshots === true });
  try {
    await saveLauncherState(app.getPath('userData'), { ...currentState, versions: catalog.versions, installTargets: catalog.installTargets, latest: catalog.latest });
  } catch {}
  return catalog;
});
ipcMain.handle('minecraft:get-state', async () => { const state = await loadLauncherState(app.getPath('userData')); return { ...state, minecraftRoot: getMinecraftRoot() }; });
ipcMain.handle('minecraft:get-root', async () => { return { root: getMinecraftRoot() }; });
ipcMain.handle('minecraft:get-installed-versions', async () => { return readInstalledVersions(); });
ipcMain.handle('minecraft:get-installed-mods', async () => { return readInstalledMods(); });
ipcMain.handle('minecraft:get-news', async () => {
  try {
    return await loadMinecraftNews({ limit: 8 });
  } catch (error) {
    return { error: error?.message || 'Failed to load Minecraft news.', items: [], sourceUrl: 'https://www.minecraft.net/en-us/articles' };
  }
});
ipcMain.handle('minecraft:toggle-mod', async (_, { modId, enable }) => { return toggleMod(modId, enable); });
ipcMain.handle('minecraft:set-all-mods-enabled', async (_, { enable }) => { return setAllModsEnabled(Boolean(enable)); });
ipcMain.handle('minecraft:delete-mod', async (_, { modId }) => { return deleteMod(modId); });
ipcMain.handle('minecraft:install-mod-file', async (_, { sourcePath }) => { return importModFile(sourcePath); });
ipcMain.handle('minecraft:pick-mod-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: 'Select mod files', properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Minecraft Mods', extensions: ['jar', 'olpkg'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled) return { canceled: true, filePaths: [] };
  return { canceled: false, filePaths: result.filePaths || [] };
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
ipcMain.handle('minecraft:check-update', async () => { return checkForLauncherUpdate({ promptUser: true, parentWindow: mainWindow }); });
ipcMain.handle('app:get-version', () => { return app.getVersion(); });
ipcMain.handle('minecraft:get-auth-state', async (_, profileKey = 'default') => {
  return getMicrosoftAuthState({ profileKey, storageDir: app.getPath('userData'), authHeaders: getAuthHeaders() });
});
ipcMain.handle('minecraft:login', async (event, profileKey = 'default', abortSignal) => {
  const controller = new AbortController();
  try {
    return await loginMicrosoftInteractive({ 
      profileKey, 
      storageDir: app.getPath('userData'), 
      authHeaders: getAuthHeaders(), 
      openExternal: url => shell.openExternal(url),
      abortSignal: abortSignal || controller.signal 
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

ipcMain.handle('minecraft:install', async (_, opts) => {
  const { type, version, gameVersion, loaderVersion } = opts || {};
  try {
    const installId = makeInstallId();
    if (type === 'minecraft') {
      const manifestRes = await fetch('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
      if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
      const manifest = await manifestRes.json();
      const versionEntry = (manifest.versions || []).find(v => v.id === String(version));
      if (!versionEntry) throw new Error(`Version ${version} not found in manifest.`);
      const versionJsonRes = await fetch(versionEntry.url);
      if (!versionJsonRes.ok) throw new Error(`Failed to fetch version data: ${versionJsonRes.status}`);
      const versionJson = await versionJsonRes.json();
      const clientUrl = versionJson?.downloads?.client?.url;
      if (!clientUrl) throw new Error('Client download URL not found for version.');
      const outDir = path.join(getMinecraftRoot(), 'versions', String(version));
      await fs.promises.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `${version}.jar`);
      const dl = await downloadToFile(clientUrl, outPath, installId, `${version}-client.jar`);
      if (!dl.ok) throw new Error('Client download failed');
      await persistInstalledVersion(outDir, { id: String(version), label: `Minecraft ${version}`, type: 'vanilla', mcVer: String(version) });
      try { mainWindow?.webContents.send('minecraft:install-complete', { installId, type, version, path: outPath }); } catch (e) {}
      return { ok: true, path: outPath, installId };
    }

    if (type === 'fabric') {
      let resolvedLoaderVersion = String(loaderVersion || '').trim();
      let resolvedGameVersion = String(gameVersion || '').trim();
      if ((!resolvedLoaderVersion || !resolvedGameVersion) && version) {
        const m = String(version).match(/fabric-loader-([^\s-]+)[\s-]*[-]?\s*(.+)/);
        if (m) { resolvedLoaderVersion = resolvedLoaderVersion || m[1]; resolvedGameVersion = resolvedGameVersion || m[2]; }
        else if (String(version).includes(' - ')) {
          const [left, right] = String(version).split(' - ');
          const mm = left.match(/fabric-loader-([^\s-]+)/);
          resolvedLoaderVersion = resolvedLoaderVersion || mm?.[1] || '';
          resolvedGameVersion = resolvedGameVersion || right;
        }
      }
      if (!resolvedLoaderVersion || !resolvedGameVersion) return { error: 'BadInput', message: 'Could not resolve Fabric game and loader versions.' };
      const minecraftRoot = getMinecraftRoot();
      const installerVersion = await getLatestFabricInstallerVersion();
      const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'openlauncher-fabric-'));
      const installerPath = path.join(tempDir, 'fabric-installer.jar');
      const installerUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-installer/${installerVersion}/fabric-installer-${installerVersion}.jar`;
      const installerDownload = await downloadToFile(installerUrl, installerPath, installId, `fabric-installer-${installerVersion}.jar`);
      if (!installerDownload.ok) return { error: 'DownloadFailed', message: 'Fabric installer download failed.' };
      const javaChoice = findJavaCommand(8, opts?.javaPath || '');
      const javaCmd = javaChoice?.javaCmd || resolveJavaCommand(opts?.javaPath || '');
      const installerResult = await runCommand(javaCmd, ['-jar', installerPath, 'client', '-dir', minecraftRoot, '-mcversion', resolvedGameVersion, '-loader', resolvedLoaderVersion, '-noprofile', '-snapshot'], {
        cwd: tempDir,
        onStdout: (text) => {
          try { mainWindow?.webContents.send('minecraft:install-progress', { installId, loaded: 0, total: 1, percent: null }); } catch (e) {}
          try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stdout', msg: String(text) }); } catch (e) {}
        },
        onStderr: (text) => { try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: String(text) }); } catch (e) {} },
      });
      if (installerResult.code !== 0) return { error: 'FabricInstallFailed', message: `Fabric installer exited with code ${installerResult.code}. ${installerResult.stderr || installerResult.stdout || ''}`.trim() };

      const vanillaVersionDir = path.join(minecraftRoot, 'versions', resolvedGameVersion);
      let vanillaVersionJson = await loadLocalVersionMetadata(vanillaVersionDir);
      if (!vanillaVersionJson) {
        vanillaVersionJson = await loadMojangVersionMetadata(resolvedGameVersion);
      }
      if (vanillaVersionJson) {
        await fs.promises.mkdir(vanillaVersionDir, { recursive: true });
        const vanillaClientUrl = vanillaVersionJson?.downloads?.client?.url || null;
        if (vanillaClientUrl) {
          const vanillaJarPath = path.join(vanillaVersionDir, `${resolvedGameVersion}.jar`);
          if (!fs.existsSync(vanillaJarPath)) {
            try { mainWindow?.webContents.send('minecraft:run-log', { type: 'info', msg: `Preparing vanilla ${resolvedGameVersion} client jar for Fabric...` }); } catch (e) {}
            await ensureJarFile(vanillaClientUrl, vanillaJarPath);
          }
        }
        await persistInstalledVersion(vanillaVersionDir, {
          id: String(vanillaVersionJson?.id || resolvedGameVersion),
          label: `Minecraft ${resolvedGameVersion}`,
          type: 'vanilla',
          mcVer: resolvedGameVersion,
          versionJson: vanillaVersionJson,
        });
      }

      const profileUrl = `${FABRIC_LOADER_URL}/${resolvedGameVersion}/${resolvedLoaderVersion}/profile/json`;
      let profileJson = null;
      try { const profileRes = await fetch(profileUrl); if (profileRes.ok) profileJson = await profileRes.json(); } catch { profileJson = null; }
      const profileId = String(profileJson?.id || `fabric-loader-${resolvedLoaderVersion}-${resolvedGameVersion}`).trim();
      const outDir = path.join(minecraftRoot, 'versions', profileId);
      await fs.promises.mkdir(outDir, { recursive: true });
      const profileJsonPath = path.join(outDir, `${profileId}.json`);
      if (profileJson) await fs.promises.writeFile(profileJsonPath, JSON.stringify(profileJson, null, 2), 'utf8');
      await persistInstalledVersion(outDir, { id: profileId, label: `Fabric ${resolvedLoaderVersion} - ${resolvedGameVersion}`, type: 'fabric', mcVer: resolvedGameVersion, loaderVersion: resolvedLoaderVersion, versionJson: profileJson || null });
      try { mainWindow?.webContents.send('minecraft:install-complete', { installId, type, version: `${resolvedLoaderVersion} on ${resolvedGameVersion}`, path: profileJsonPath }); } catch (e) {}
      return { ok: true, path: profileJsonPath, installId };
    }

    if (type === 'forge') {
      const forgeVersion = String(loaderVersion || version || '').trim();
      const promosRes = await fetch(FORGE_PROMOTIONS_URL);
      if (!promosRes.ok) return { error: 'NotFound', message: 'Forge promotions not available.' };
      const promos = await promosRes.json();
      const promosObj = promos?.promos || {};
      const entry = gameVersion
        ? [String(gameVersion), forgeVersion]
        : Object.entries(promosObj).find(([, v]) => String(v) === forgeVersion);
      const minecraftVersion = entry ? String(entry[0]).replace(/-(recommended|latest)$/i, '') : null;
      if (!minecraftVersion) return { error: 'NotFound', message: 'Could not map Forge version to Minecraft version.' };

      const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${forgeVersion}/forge-${minecraftVersion}-${forgeVersion}-installer.jar`;
      const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'openlauncher-forge-'));
      const installerPath = path.join(tempDir, 'forge-installer.jar');
      const installerDownload = await downloadToFile(installerUrl, installerPath, installId, `forge-installer-${forgeVersion}.jar`);
      if (!installerDownload.ok) return { error: 'DownloadFailed', message: 'Forge installer download failed' };

      const installerZip = new AdmZip(installerPath);
      const forgeInstallProfile = parseJsonFromZipEntry(installerZip, ['install_profile.json']);
      const forgeVersionJson = parseJsonFromZipEntry(installerZip, ['version.json']) || forgeInstallProfile?.versionInfo || forgeInstallProfile;
      if (!forgeVersionJson) {
        return { error: 'InvalidInstaller', message: 'Forge installer did not contain version metadata.' };
      }

      const forgeVersionId = String(
        forgeVersionJson?.version ||
        forgeInstallProfile?.install?.version ||
        forgeVersionJson?.install?.version ||
        forgeVersionJson?.id ||
        `forge-${forgeVersion}-${minecraftVersion}`
      ).trim();
      const resolvedMinecraftVersion = String(
        forgeVersionJson?.minecraft ||
        forgeInstallProfile?.install?.minecraft ||
        forgeVersionJson?.install?.minecraft ||
        minecraftVersion
      ).trim();

      if (!resolvedMinecraftVersion) {
        return { error: 'InvalidInstaller', message: 'Forge installer did not define the Minecraft base version.' };
      }

      const minecraftRoot = getMinecraftRoot();
      
      // FIRST: Ensure vanilla version is properly installed
      const vanillaResult = await ensureVanillaVersionInstalled(minecraftRoot, resolvedMinecraftVersion, installId);
      if (!vanillaResult) {
        return { error: 'VanillaInstallFailed', message: `Failed to install vanilla ${resolvedMinecraftVersion} required for Forge.` };
      }

      const outDir = path.join(minecraftRoot, 'versions', forgeVersionId);
      await fs.promises.mkdir(outDir, { recursive: true });
      
      // IMPORTANT: For Forge, we need to copy the vanilla jar to the forge directory
      const vanillaJarPath = path.join(minecraftRoot, 'versions', resolvedMinecraftVersion, `${resolvedMinecraftVersion}.jar`);
      const forgeVanillaJarPath = path.join(outDir, `${resolvedMinecraftVersion}.jar`);
      
      // Copy the vanilla jar to the forge version directory
      if (fs.existsSync(vanillaJarPath)) {
        await fs.promises.copyFile(vanillaJarPath, forgeVanillaJarPath);
      } else {
        // If the vanilla jar doesn't exist, download it directly to the forge directory
        const clientUrl = vanillaResult.versionJson?.downloads?.client?.url;
        if (clientUrl) {
          await ensureJarFile(clientUrl, forgeVanillaJarPath);
        } else {
          return { error: 'MissingVanillaJar', message: `Vanilla jar not found for ${resolvedMinecraftVersion}.` };
        }
      }

      // Run the Forge installer with the correct arguments
      // For newer Forge versions, the installer accepts:
      // --installClient <minecraft_dir> [<forge_version>]
      // or just run it in server mode which handles everything
      const javaChoice = findJavaCommand(8, opts?.javaPath || '');
      const javaCmd = javaChoice?.javaCmd || resolveJavaCommand(opts?.javaPath || '');
      
      // Method 1: Try using the installer's main method without arguments
      // The installer will detect and install automatically
      let patchResult = await runCommand(javaCmd, [
        '-jar', installerPath,
        '--installClient',
        minecraftRoot
      ], {
        cwd: tempDir,
        onStdout: (text) => {
          try { mainWindow?.webContents.send('minecraft:install-progress', { installId, loaded: 0, total: 1, percent: null }); } catch (e) {}
          try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stdout', msg: String(text) }); } catch (e) {}
        },
        onStderr: (text) => { try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: String(text) }); } catch (e) {} },
      });
      
      // If that fails, try the older argument format for compatibility
      if (patchResult.code !== 0) {
        console.log('First install attempt failed, trying alternative method...');
        patchResult = await runCommand(javaCmd, [
          '-jar', installerPath,
          minecraftRoot
        ], {
          cwd: tempDir,
          onStdout: (text) => {
            try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stdout', msg: String(text) }); } catch (e) {}
          },
          onStderr: (text) => { try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: String(text) }); } catch (e) {} },
        });
      }
      
      if (patchResult.code !== 0) {
        return { error: 'ForgePatchFailed', message: `Forge patch process failed with code ${patchResult.code}. ${patchResult.stderr || patchResult.stdout || ''}`.trim() };
      }

      // Extract Forge libraries from installer if they weren't installed
      if (Array.isArray(forgeInstallProfile?.libraries)) {
        await installForgeLibraries(forgeInstallProfile.libraries, minecraftRoot, installId);
      }

      // Write the version JSON
      const versionJsonPath = path.join(outDir, `${forgeVersionId}.json`);
      await fs.promises.writeFile(versionJsonPath, JSON.stringify(forgeVersionJson, null, 2), 'utf8');

      // Extract Forge universal jar
      const forgeLibPath = path.join(minecraftRoot, 'libraries', 'net', 'minecraftforge', 'forge', forgeVersion);
      await fs.promises.mkdir(forgeLibPath, { recursive: true });
      
      // Extract the universal jar (this is the main Forge code)
      const universalJarNames = [
        `maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-universal.jar`,
        `forge-${forgeVersion}-universal.jar`,
        `maven/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}.jar`,
        `forge-${forgeVersion}.jar`
      ];
      
      for (const jarName of universalJarNames) {
        if (installerZip.getEntry(jarName)) {
          const targetJar = path.join(forgeLibPath, path.basename(jarName));
          await extractZipEntryToFile(installerZip, jarName, targetJar);
        }
      }

      // Check if the patched jar was created (should be in the version directory)
      let patchedJarPath = path.join(outDir, `${forgeVersionId}.jar`);
      const alternativePatchedJar = path.join(outDir, `${forgeVersionId}-patched.jar`);
      const vanillaPatchedJar = path.join(outDir, `${resolvedMinecraftVersion}-patched.jar`);
      
      if (fs.existsSync(alternativePatchedJar)) {
        await fs.promises.rename(alternativePatchedJar, patchedJarPath);
      } else if (fs.existsSync(vanillaPatchedJar)) {
        await fs.promises.rename(vanillaPatchedJar, patchedJarPath);
      }

      // If no patched jar was created, the vanilla jar might be the client jar
      if (!fs.existsSync(patchedJarPath)) {
        // Check if we have the vanilla jar in the forge directory
        if (fs.existsSync(forgeVanillaJarPath)) {
          // The forge version JSON should point to the vanilla jar as the client
          // For modern Forge, the client jar is the vanilla jar
          patchedJarPath = forgeVanillaJarPath;
        } else {
          return { error: 'MissingPatchedJar', message: 'Forge installation completed but patched jar not found.' };
        }
      }

      await persistInstalledVersion(outDir, {
        id: forgeVersionId,
        label: `Forge ${forgeVersion} - ${resolvedMinecraftVersion}`,
        type: 'forge',
        mcVer: resolvedMinecraftVersion,
        forgeVersion,
        versionJson: forgeVersionJson,
        clientJar: path.basename(patchedJarPath), // Store which jar to use as client
      });

      try { mainWindow?.webContents.send('minecraft:install-complete', { installId, type, version: `${forgeVersion} / ${resolvedMinecraftVersion}`, path: versionJsonPath }); } catch (e) {}
      return { ok: true, path: versionJsonPath, installId };
    }

    return { error: 'NotImplemented', message: `Installer for '${type}' not implemented.` };
  } catch (error) {
    try { mainWindow?.webContents.send('minecraft:install-error', { type, version, message: error?.message }); } catch (e) {}
    return { error: 'InstallFailed', message: error?.message || String(error) };
  }
});

ipcMain.handle('minecraft:run', async (_, opts) => {
  const { profile, version } = opts || {};
  const mcVer = resolveMinecraftVersion(version);
  const baseDir = getMinecraftRoot();
  const versionDir = version?.path && String(version.path).trim()
    ? String(version.path).trim()
    : path.join(baseDir, 'versions', String(mcVer));

  let versionJson = version?.versionJson || null;
  if (!versionJson) versionJson = await loadLocalVersionMetadata(versionDir);

  const versionType = String(version?.type || '').toLowerCase();
  const inheritedVersionId = String(versionJson?.inheritsFrom || mcVer || '').trim();
  let inheritedVersionJson = null;

  if (inheritedVersionId) {
    try {
      inheritedVersionJson = await loadMojangVersionMetadata(inheritedVersionId);
    } catch (error) {
      if (versionType === 'vanilla') throw error;
    }
  }

  // For modded versions (Fabric, Forge, etc.) the client jar is the VANILLA jar.
  // Look for it first in the inherited version's own directory, then in the modded dir.
  let jarPath = null;
  if (inheritedVersionId && inheritedVersionId !== mcVer) {
    const vanillaVersionDir = path.join(baseDir, 'versions', inheritedVersionId);
    jarPath = await findLocalVersionJar(vanillaVersionDir, [inheritedVersionId]);
  }
  if (!jarPath) {
    jarPath = await findLocalVersionJar(versionDir, [version?.id, version?.label, mcVer]);
  }

  if (!versionJson && versionType === 'vanilla') versionJson = await loadMojangVersionMetadata(mcVer);

  if (!versionJson) {
    const customLabel = String(version?.label || version?.id || mcVer || 'custom version');
    return { error: 'CustomVersionMetadataMissing', message: `Could not read local launch metadata for '${customLabel}'.` };
  }

  versionJson = mergeVersionMetadata(inheritedVersionJson, versionJson);

  // Download client jar if missing.
  // For Fabric/modded versions, the client jar lives in the VANILLA version directory
  // (the inherited version), not in the Fabric profile directory.
  await fs.promises.mkdir(versionDir, { recursive: true });
  if (!jarPath) {
    // Try to get the client URL from the merged metadata (prefers inherited vanilla data)
    const clientUrl = inheritedVersionJson?.downloads?.client?.url || versionJson?.downloads?.client?.url;

    if (inheritedVersionId && inheritedVersionId !== mcVer) {
      // For modded versions (Fabric, Forge, etc.) look for the vanilla jar in its own dir
      const vanillaVersionDir = path.join(baseDir, 'versions', inheritedVersionId);
      await fs.promises.mkdir(vanillaVersionDir, { recursive: true });
      const vanillaJarPath = path.join(vanillaVersionDir, `${inheritedVersionId}.jar`);
      if (!clientUrl) throw new Error(`Could not find client download URL for ${inheritedVersionId}. Install vanilla ${inheritedVersionId} first or check your internet connection.`);
      try { mainWindow?.webContents.send('minecraft:run-log', { type: 'info', msg: `Downloading vanilla ${inheritedVersionId} client jar...` }); } catch (e) {}
      await ensureJarFile(clientUrl, vanillaJarPath);
      jarPath = vanillaJarPath;
    } else {
      // Vanilla version — jar goes in its own directory
      if (!clientUrl) throw new Error(`Local client jar not found for ${String(version?.label || version?.id || mcVer || 'version')}.`);
      const fallbackJarPath = path.join(versionDir, `${String(version?.id || mcVer || 'version')}.jar`);
      await ensureJarFile(clientUrl, fallbackJarPath);
      jarPath = fallbackJarPath;
    }
  }

  // ── STEP 1: Download all libraries and build classpath ──────────────────────
  const libraries = versionJson?.libraries || [];
  const libsDir = path.join(baseDir, 'libraries');
  await fs.promises.mkdir(libsDir, { recursive: true });
  const classpathParts = [];
  const classpathLibraryEntries = new Map();

  for (const lib of libraries) {
    const resolvedLibraryPath = lib?.downloads?.artifact?.path
      ? path.join(libsDir, lib.downloads.artifact.path)
      : lib?.name
        ? getLibraryPathFromName(lib.name, baseDir)
        : null;

    const artifactUrl = lib?.downloads?.artifact?.url || null;
    if (resolvedLibraryPath) {
      try {
        if (artifactUrl) await ensureJarFile(artifactUrl, resolvedLibraryPath);
        if (fs.existsSync(resolvedLibraryPath)) {
          const libraryKeyInfo = getMavenLibraryKey(lib?.name || '');
          if (libraryKeyInfo) {
            const existingEntry = classpathLibraryEntries.get(libraryKeyInfo.key);
            if (!existingEntry || compareVersionTuples(versionToTuple(libraryKeyInfo.version), versionToTuple(existingEntry.version)) > 0) {
              classpathLibraryEntries.set(libraryKeyInfo.key, {
                path: resolvedLibraryPath,
                version: libraryKeyInfo.version,
              });
            }
          } else {
            classpathParts.push(resolvedLibraryPath);
          }
        }
      } catch (e) {
        try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: `Library download failed: ${e.message}` }); } catch (ee) {}
      }
    }

    // Handle natives
    if (lib?.natives) {
      const platformKey = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
      const classifier = lib.natives[platformKey];
      const nativeArtifact = classifier ? lib?.downloads?.classifiers?.[classifier] : null;
      const nativeUrl = nativeArtifact?.url || null;
      if (nativeUrl) {
        const nativeOut = nativeArtifact?.path
          ? path.join(libsDir, nativeArtifact.path)
          : getLibraryPathFromName(`${lib.name}:${classifier}`, baseDir);
        try {
          await ensureJarFile(nativeUrl, nativeOut);
        } catch (e) {
          try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: `Native download failed: ${e.message}` }); } catch (ee) {}
        }
      }
    }
  } // ── END for (const lib of libraries) ──────────────────────────────────────

  for (const entry of classpathLibraryEntries.values()) {
    classpathParts.push(entry.path);
  }

  // ── STEP 2: Download assets (runs once, not once per library) ──────────────
  const assetIndexUrl = versionJson?.assetIndex?.url || null;
  if (assetIndexUrl) {
    const aiRes = await fetch(assetIndexUrl);
    if (aiRes.ok) {
      const ai = await aiRes.json();
      const assetIndexId = String(versionJson?.assetIndex?.id || versionJson?.assets || ai?.id || 'legacy').trim();
      const assetsBase = path.join(baseDir, 'assets');
      const indexesDir = path.join(assetsBase, 'indexes');
      const objectsDir = path.join(assetsBase, 'objects');
      await fs.promises.mkdir(indexesDir, { recursive: true });
      await fs.promises.mkdir(objectsDir, { recursive: true });
      if (assetIndexId) {
        const indexPath = path.join(indexesDir, `${assetIndexId}.json`);
        try {
          await fs.promises.writeFile(indexPath, JSON.stringify(ai, null, 2), 'utf8');
        } catch (e) {
          try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: `Asset index save failed: ${e.message}` }); } catch (ee) {}
        }
      }
      const objects = ai.objects || {};
      const keys = Object.keys(objects);
      let downloaded = 0;
      for (const key of keys) {
        const obj = objects[key];
        const hash = obj.hash;
        const sub = hash.slice(0, 2);
        const outDir = path.join(objectsDir, sub);
        const outPath = path.join(outDir, hash);
        if (!fs.existsSync(outPath)) {
          try {
            await fs.promises.mkdir(outDir, { recursive: true });
            const url = `https://resources.download.minecraft.net/${sub}/${hash}`;
            const r = await fetch(url);
            if (r.ok) {
              await saveResponseBodyToFile(r, outPath);
            } else {
              try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: `Missing asset: ${key}` }); } catch (e) {}
            }
          } catch (e) {
            try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: `Asset download failed: ${e.message}` }); } catch (ee) {}
          }
        }
        downloaded++;
        if (downloaded % 50 === 0) {
          try { mainWindow?.webContents.send('minecraft:asset-progress', { total: keys.length, done: downloaded }); } catch (e) {}
        }
      }
      try { mainWindow?.webContents.send('minecraft:asset-complete', { total: keys.length }); } catch (e) {}
    }
  }

  // ── STEP 3: Add client jar to classpath (once) ────────────────────────────
  if (jarPath) classpathParts.push(jarPath);
  const classpath = classpathParts.join(path.delimiter);

  const mainClass = versionJson?.mainClass || (versionJson?.minecraftArguments ? 'net.minecraft.client.main.Main' : null);
  if (!mainClass) return { error: 'NoMainClass', message: 'Could not determine main class for the version.' };

  // ── STEP 4: Build launch arguments ────────────────────────────────────────
  const session = opts.session || {};
  const features = opts.features || {};
  const resolvedName = session.name || session.username || profile?.localName || profile?.name || 'Player';
  const normalizedSession = {
    name: resolvedName,
    uuid: session.uuid || session.id || makeOfflineUuid(resolvedName),
    accessToken: session.accessToken || session.access_token || '0',
    userType: session.userType || session.user_type || (session.accessToken && session.accessToken !== '0' ? 'msa' : 'legacy'),
  };

  const substitutions = {
    '${auth_player_name}': normalizedSession.name,
    '${auth_uuid}': normalizedSession.uuid,
    '${auth_access_token}': normalizedSession.accessToken,
    '${auth_session}': normalizedSession.accessToken,
    '${version_name}': versionJson?.id || mcVer,
    '${game_directory}': baseDir,
    '${assets_root}': path.join(baseDir, 'assets'),
    '${assets_index_name}': versionJson?.assets || '',
    '${user_type}': normalizedSession.userType,
    '${version_type}': versionJson?.type || 'release',
    '${user_properties}': '{}',
  };

  function rulesPass(rules) {
    if (!rules) return true;
    let allow = false;
    for (const r of rules) {
      let match = true;
      if (r.os && r.os.name) {
        const osName = r.os.name;
        if (osName === 'windows') match = process.platform === 'win32';
        else if (osName === 'linux') match = process.platform === 'linux';
        else if (osName === 'osx' || osName === 'mac') match = process.platform === 'darwin';
        else match = false;
      }
      if (match && r.features && typeof r.features === 'object') {
        for (const [featureName, requiredValue] of Object.entries(r.features)) {
          const actualValue = Boolean(features?.[featureName]);
          if (Boolean(requiredValue) !== actualValue) { match = false; break; }
        }
      }
      if (match) {
        if (r.action === 'allow') allow = true;
        if (r.action === 'disallow') allow = false;
      }
    }
    return allow;
  }

  let gameArgs = [];

  // CRITICAL: Add required arguments that Minecraft client expects
  // These MUST be added for both vanilla and modded versions
  gameArgs.push('--username', normalizedSession.name);
  gameArgs.push('--version', versionJson?.id || mcVer);
  gameArgs.push('--gameDir', baseDir);
  gameArgs.push('--assetsDir', path.join(baseDir, 'assets'));
  gameArgs.push('--assetIndex', versionJson?.assets || 'legacy');
  gameArgs.push('--uuid', normalizedSession.uuid);
  gameArgs.push('--accessToken', normalizedSession.accessToken);
  gameArgs.push('--userType', normalizedSession.userType);
  gameArgs.push('--versionType', versionJson?.type || 'release');

  // Then process the version-specific arguments
  if (versionJson?.arguments?.game) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === 'string') {
        let s = arg;
        for (const [k, v] of Object.entries(substitutions)) s = s.replaceAll(k, v);
        // Skip if we already added this argument to avoid duplicates
        if (!gameArgs.includes(s)) {
          gameArgs.push(s);
        }
      } else if (arg && typeof arg === 'object') {
        if (!rulesPass(arg.rules)) continue;
        const val = arg.value;
        if (Array.isArray(val)) {
          for (let part of val) {
            for (const [k, v] of Object.entries(substitutions)) part = part.replaceAll(k, v);
            if (!gameArgs.includes(part)) {
              gameArgs.push(part);
            }
          }
        } else if (typeof val === 'string') {
          let s = val;
          for (const [k, v] of Object.entries(substitutions)) s = s.replaceAll(k, v);
          if (!gameArgs.includes(s)) {
            gameArgs.push(s);
          }
        }
      }
    }
  } else if (versionJson?.minecraftArguments) {
    const parts = String(versionJson.minecraftArguments).split(' ');
    for (let p of parts) {
      for (const [k, v] of Object.entries(substitutions)) p = p.replaceAll(k, v);
      // Skip if we already added this argument
      if (!gameArgs.includes(p)) {
        gameArgs.push(p);
      }
    }
  }

  // Ensure essential arguments are present (in case they weren't in the version.json)
  if (!gameArgs.includes('--accessToken')) {
    // Insert accessToken before any other arguments that might need it
    const accessTokenIndex = gameArgs.findIndex(arg => arg === '--uuid');
    if (accessTokenIndex !== -1) {
      gameArgs.splice(accessTokenIndex + 1, 0, '--accessToken', normalizedSession.accessToken);
    } else {
      gameArgs.unshift('--accessToken', normalizedSession.accessToken);
    }
  }

  if (!gameArgs.includes('--version')) {
    gameArgs.unshift('--version', versionJson?.id || mcVer);
  }

  if (!gameArgs.includes('--uuid')) {
    gameArgs.unshift('--uuid', normalizedSession.uuid);
  }

  if (!gameArgs.includes('--userType')) {
    gameArgs.unshift('--userType', normalizedSession.userType);
  }

  const assetsDir = path.join(baseDir, 'assets');
  const assetsIndexName = String(versionJson?.assets || versionJson?.assetIndex?.id || 'legacy');
  if (!gameArgs.includes('--gameDir')) gameArgs.push('--gameDir', baseDir);
  if (!gameArgs.includes('--assetsDir')) gameArgs.push('--assetsDir', assetsDir);
  if (!gameArgs.includes('--assetIndex')) gameArgs.push('--assetIndex', assetsIndexName);

  // Move Fabric loader jar to front of classpath
  if (String(mainClass).includes('net.fabricmc.loader.impl.launch.knot.KnotClient')) {
    const fabricLoaderRoot = path.join(baseDir, 'libraries', 'net', 'fabricmc', 'fabric-loader');
    const fabricLoaderJar = await findFirstMatchingJar(fabricLoaderRoot, (fileName) => fileName.toLowerCase().endsWith('.jar'));
    if (fabricLoaderJar) {
      const existingIndex = classpathParts.indexOf(fabricLoaderJar);
      if (existingIndex >= 0) classpathParts.splice(existingIndex, 1);
      classpathParts.unshift(fabricLoaderJar);
    }
    const hasFabricLoaderClasspath = classpathParts.some(entry => entry.includes(path.join('net', 'fabricmc', 'fabric-loader')));
    if (!hasFabricLoaderClasspath) {
      try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: 'Fabric loader jar not found in classpath.' }); } catch (e) {}
    }
  }

  const classpathFlags = {
    hasJoptSimple: classpathParts.some(entry => entry.includes(path.join('net', 'sf', 'jopt-simple'))),
    hasFabricLoader: classpathParts.some(entry => entry.includes(path.join('net', 'fabricmc', 'fabric-loader'))),
    classpathEntries: classpathParts.length,
  };

  // ── STEP 5: Spawn the game process ────────────────────────────────────────
   const jvmArgs = [
     `-Djava.library.path=${path.join(baseDir, 'native-extract', mcVer)}`,
     '-Xmx' + (profile?.ram || 4) + 'G',
     '--add-exports', 'java.base/jdk.internal.ref=ALL-UNNAMED',
     '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
     '--add-opens', 'java.base/sun.nio.ch=ALL-UNNAMED',
     '--add-opens', 'java.base/sun.security.action=ALL-UNNAMED',
     '--add-opens', 'java.base/java.util=ALL-UNNAMED',
     '--add-opens', 'java.base/java.util.concurrent=ALL-UNNAMED',
   ];

   // Additional JVM arguments from profile
   if (profile?.jvmArguments) {
     const args = String(profile.jvmArguments)
       .trim()
       .split(/\s+/)
       .filter(arg => arg.length > 0);
     jvmArgs.push(...args);
   }
   // Also check launch options (in case passed directly)
   if (opts?.jvmArguments) {
     const args = String(opts.jvmArguments)
       .trim()
       .split(/\s+/)
       .filter(arg => arg.length > 0);
     jvmArgs.push(...args);
   }

  let configuredJavaPath = '';
  let javaPathSource = '';

  // Priority 1: Java path from the profile configuration
  if (profile?.javaPath && String(profile.javaPath).trim()) {
    configuredJavaPath = String(profile.javaPath).trim();
    javaPathSource = 'profile';
  }
  // Priority 2: Java path from the launch options
  else if (opts?.javaPath && String(opts.javaPath).trim()) {
    configuredJavaPath = String(opts.javaPath).trim();
    javaPathSource = 'opts';
  }
  // Priority 3: Java path from the saved launcher settings
  else {
    try {
      const launcherState = await loadLauncherState(app.getPath('userData'));
      if (launcherState.settings?.javaPath && String(launcherState.settings.javaPath).trim()) {
        configuredJavaPath = String(launcherState.settings.javaPath).trim();
        javaPathSource = 'global';
      }
    } catch (error) {
      console.warn('Failed to load saved Java path:', error);
    }
  }

  // Get required Java version from version metadata
  const requiredJavaMajor = Number(versionJson?.javaVersion?.majorVersion || 0) || null;

  // Function to find a compatible Java version
  async function findCompatibleJava() {
    // First, try to find Java that meets the requirements
    if (requiredJavaMajor) {
      const compatibleJava = findJavaCommand(requiredJavaMajor, '');
      if (compatibleJava?.javaCmd && compatibleJava.javaMajor >= requiredJavaMajor) {
        return {
          javaCmd: compatibleJava.javaCmd,
          javaMajor: compatibleJava.javaMajor,
          source: 'auto-detected (compatible)'
        };
      }
    }
    
    // If no specific requirement or no compatible found, try to find the best Java available
    const allCandidates = collectCommonJavaCandidates();
    let bestCandidate = null;
    let bestMajor = 0;
    
    for (const candidate of allCandidates) {
      const major = detectJavaMajor(candidate);
      if (major && major > bestMajor) {
        bestMajor = major;
        bestCandidate = candidate;
      }
    }
    
    if (bestCandidate) {
      return {
        javaCmd: bestCandidate,
        javaMajor: bestMajor,
        source: 'auto-detected (best available)'
      };
    }
    
    // Last resort: use system default
    return {
      javaCmd: resolveJavaCommand(''),
      javaMajor: detectJavaMajor(resolveJavaCommand('')),
      source: 'system default'
    };
  }

  // Validate configured Java path
  let finalJavaCmd = '';
  let detectedJavaMajor = null;
  let usedConfiguredPath = false;

  if (configuredJavaPath) {
    // Check if the configured path exists
    if (fs.existsSync(configuredJavaPath)) {
      detectedJavaMajor = detectJavaMajor(configuredJavaPath);
      
      // Check if it meets the version requirements
      if (requiredJavaMajor && detectedJavaMajor && detectedJavaMajor >= requiredJavaMajor) {
        // Configured Java is compatible, use it
        finalJavaCmd = configuredJavaPath;
        usedConfiguredPath = true;
        try { 
          mainWindow?.webContents.send('minecraft:run-log', { 
            type: 'info', 
            msg: `✅ Using configured Java ${detectedJavaMajor} from ${javaPathSource} (meets requirement Java ${requiredJavaMajor}+)` 
          }); 
        } catch (e) {}
      } else if (requiredJavaMajor && detectedJavaMajor && detectedJavaMajor < requiredJavaMajor) {
        // Configured Java is too old, log warning and try to find compatible one
        try { 
          mainWindow?.webContents.send('minecraft:run-log', { 
            type: 'warn', 
            msg: `⚠️ Configured Java ${detectedJavaMajor} from ${javaPathSource} does NOT meet requirement (needs ${requiredJavaMajor}+). Looking for compatible Java...` 
          }); 
        } catch (e) {}
        
        // Try to find a compatible Java version
        const compatible = await findCompatibleJava();
        if (compatible.javaCmd && compatible.javaMajor >= requiredJavaMajor) {
          finalJavaCmd = compatible.javaCmd;
          detectedJavaMajor = compatible.javaMajor;
          usedConfiguredPath = false;
          try { 
            mainWindow?.webContents.send('minecraft:run-log', { 
              type: 'info', 
              msg: `✅ Found compatible Java ${detectedJavaMajor} from ${compatible.source} (will be used instead of configured Java)` 
            }); 
          } catch (e) {}
        } else {
          // No compatible Java found, but still try to use configured one (might still work)
          finalJavaCmd = configuredJavaPath;
          usedConfiguredPath = true;
          try { 
            mainWindow?.webContents.send('minecraft:run-log', { 
              type: 'error', 
              msg: `❌ No compatible Java found. Using configured Java ${detectedJavaMajor} (may not work properly).` 
            }); 
          } catch (e) {}
        }
      } else {
        // No specific requirement, use configured Java
        finalJavaCmd = configuredJavaPath;
        usedConfiguredPath = true;
        try { 
          mainWindow?.webContents.send('minecraft:run-log', { 
            type: 'info', 
            msg: `✅ Using configured Java ${detectedJavaMajor || '?'} from ${javaPathSource}` 
          }); 
        } catch (e) {}
      }
    } else {
      // Configured path doesn't exist
      try { 
        mainWindow?.webContents.send('minecraft:run-log', { 
          type: 'warn', 
          msg: `⚠️ Configured Java path not found: ${configuredJavaPath}. Looking for compatible Java...` 
        }); 
      } catch (e) {}
      
      const compatible = await findCompatibleJava();
      if (compatible.javaCmd) {
        finalJavaCmd = compatible.javaCmd;
        detectedJavaMajor = compatible.javaMajor;
        usedConfiguredPath = false;
        try { 
          mainWindow?.webContents.send('minecraft:run-log', { 
            type: 'info', 
            msg: `✅ Using ${compatible.source} Java ${detectedJavaMajor} from ${finalJavaCmd}` 
          }); 
        } catch (e) {}
      } else {
        // Fallback to system default
        finalJavaCmd = resolveJavaCommand('');
        detectedJavaMajor = detectJavaMajor(finalJavaCmd);
        try { 
          mainWindow?.webContents.send('minecraft:run-log', { 
            type: 'warn', 
            msg: `⚠️ Using system default Java ${detectedJavaMajor || '?'} from ${finalJavaCmd}` 
          }); 
        } catch (e) {}
      }
    }
  } else {
    // No configured Java path, auto-detect
    const compatible = await findCompatibleJava();
    if (compatible.javaCmd) {
      finalJavaCmd = compatible.javaCmd;
      detectedJavaMajor = compatible.javaMajor;
      try { 
        mainWindow?.webContents.send('minecraft:run-log', { 
          type: 'info', 
          msg: `✅ Using ${compatible.source} Java ${detectedJavaMajor} from ${finalJavaCmd}` 
        }); 
      } catch (e) {}
    } else {
      // Ultimate fallback
      finalJavaCmd = resolveJavaCommand('');
      detectedJavaMajor = detectJavaMajor(finalJavaCmd);
      try { 
        mainWindow?.webContents.send('minecraft:run-log', { 
          type: 'warn', 
          msg: `⚠️ Using system default Java ${detectedJavaMajor || '?'} from ${finalJavaCmd}` 
        }); 
      } catch (e) {}
    }
  }

  // Final version check - if still not compatible, show error but don't block (user might know better)
  if (requiredJavaMajor && detectedJavaMajor && detectedJavaMajor < requiredJavaMajor) {
    try { 
      mainWindow?.webContents.send('minecraft:run-log', { 
        type: 'error', 
        msg: `⚠️ Java ${detectedJavaMajor} is older than required ${requiredJavaMajor}. Game may not work correctly.` 
      }); 
    } catch (e) {}
    // Don't return error, let it try anyway (might still work for some versions)
  }

   const args = [...jvmArgs, '-cp', classpath, mainClass, ...gameArgs];
   const child = spawn(finalJavaCmd, args, { cwd: baseDir });

   runningChildren.set(child.pid, child);

   // Hide window when game starts unless keepOpen is enabled
   const settings = await loadLauncherState(app.getPath('userData'));
   const keepOpen = settings?.settings?.keepOpen ?? false;
   if (!keepOpen && mainWindow && !mainWindow.isDestroyed()) {
     try { mainWindow.hide(); } catch (e) {}
   }

    child.stdout.on('data', chunk => {
      try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stdout', msg: String(chunk) }); } catch (e) {}
    });
    child.stderr.on('data', chunk => {
      try { mainWindow?.webContents.send('minecraft:run-log', { type: 'stderr', msg: String(chunk) }); } catch (e) {}
    });
    child.on('close', async code => {
      runningChildren.delete(child.pid);
      try { mainWindow?.webContents.send('minecraft:run-exit', { code }); } catch (e) {}
      if (!runningChildren.size && mainWindow && mainWindow.isDestroyed?.() === false) {
        const settings = await loadLauncherState(app.getPath('userData'));
        const keepOpen = settings?.settings?.keepOpen ?? false;
        if (!keepOpen) {
          try { mainWindow.show(); } catch (e) {}
        }
      }
    });

  return { ok: true, pid: child.pid };
});

ipcMain.handle('minecraft:stop', async (_, { pid }) => {
  const child = runningChildren.get(pid);
  if (!child) return { error: 'NotFound', message: `No running process with pid ${pid}` };
  try { child.kill('SIGTERM'); runningChildren.delete(pid); return { ok: true }; }
  catch (e) { return { error: 'KillFailed', message: e?.message || String(e) }; }
});

ipcMain.handle('minecraft:install-cancel', async (_, { installId }) => {
  const entry = activeInstalls.get(installId);
  if (!entry) return { error: 'NotFound', message: `No install with id ${installId}` };
  try {
    for (const c of entry.controllers) { try { c.abort(); } catch (e) {} }
    activeInstalls.delete(installId);
    try { mainWindow?.webContents.send('minecraft:install-cancelled', { installId }); } catch (e) {}
    return { ok: true };
  } catch (e) { return { error: 'CancelFailed', message: e?.message || String(e) }; }
});

ipcMain.handle('app:get-language', async () => {
  try { const state = await loadLauncherState(app.getPath('userData')); return state.settings?.language || 'en'; }
  catch { return 'en'; }
});

ipcMain.handle('app:set-language', async (_, language) => {
  try {
    const currentState = await loadLauncherState(app.getPath('userData'));
    await saveLauncherState(app.getPath('userData'), {
      ...currentState,
      settings: { ...currentState.settings, language: typeof language === 'string' && language.trim() ? language.trim() : 'en' },
    });
    return { ok: true };
  } catch (error) { return { error: 'SaveFailed', message: error?.message || String(error) }; }
});