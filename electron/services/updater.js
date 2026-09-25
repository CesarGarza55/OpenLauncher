import { app, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { loadLauncherState } from '../../src/lib/launcherState.js';

const UPDATE_REPOSITORY = 'CesarGarza55/OpenLauncher';
const UPDATE_RELEASES_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_RELEASES_PAGE = `https://github.com/${UPDATE_REPOSITORY}/releases/latest`;

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

export function versionToTuple(version) {
  const value = String(version || '').trim();
  const lower = value.toLowerCase();
  let versionType = 2;
  if (lower.includes('alpha')) versionType = 0;
  else if (lower.includes('beta')) versionType = 1;
  const match = value.match(/(\d+(?:\.\d+)*)/);
  if (!match) return [versionType, 0];
  return [versionType, ...match[1].split('.').map(part => Number(part) || 0)];
}

export function compareVersionTuples(left, right) {
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

export function normalizeReleaseVersionTag(release) {
  const raw = String(release?.tag_name || release?.name || '').trim();
  return raw.replace(/^v/i, '');
}

export function isLaunchableUpdateAsset(assetName) {
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

export function formatI18nMessage(template, values = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (match, key) => {
    return values[key] !== undefined ? String(values[key]) : match;
  });
}

export async function getPreferredLanguage() {
  try {
    const state = await loadLauncherState(app.getPath('userData'));
    return state.settings?.language === 'es' ? 'es' : 'en';
  } catch {
    return 'en';
  }
}

export function getUpdaterStrings(language) {
  return UPDATER_TRANSLATIONS[language] || UPDATER_TRANSLATIONS.en;
}

export function pickUpdateAsset(release) {
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
            score += 80;
          } else {
            score += 100;
          }
        }
        if (assetName.includes('setup') || assetName.includes('installer')) score += 20;
        if (assetName.endsWith('.zip')) score += 90;
        if (assetName.includes('win')) score += 5;
      } else if (platform === 'linux') {
        if (assetName.endsWith('.deb')) {
          if (assetName.includes('portable')) {
            score += 80;
          } else {
            score += 100;
          }
        }
        if (assetName.endsWith('.tar.gz') || assetName.endsWith('.tar.xz')) {
          if (assetName.includes('portable')) {
            score += 90;
          } else {
            score += 85;
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

export async function downloadFileToPath(url, outPath, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OpenLauncher-Updater', Accept: 'application/octet-stream' },
  });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  const total = Number(response.headers.get('content-length')) || null;
  let loaded = 0;
  let lastProgressTime = 0;
  const readable = Readable.fromWeb(response.body);
  const writable = fs.createWriteStream(outPath);
  readable.on('data', (chunk) => {
    loaded += chunk.length;
    const now = Date.now();
    if (now - lastProgressTime > 100 || (total && loaded >= total)) {
      lastProgressTime = now;
      const percent = total ? Math.round((loaded / total) * 100) : null;
      onProgress?.({ loaded, total, percent });
    }
  });
  await new Promise((resolve, reject) => {
    readable.pipe(writable);
    writable.on('finish', resolve);
    writable.on('error', reject);
    readable.on('error', reject);
  });
  return outPath;
}

export async function launchDownloadedUpdate(filePath) {
  const resolvedPath = String(filePath || '').trim();
  if (!resolvedPath) throw new Error('Missing update file path.');
  const extension = path.extname(resolvedPath).toLowerCase();
  const basename = path.basename(resolvedPath).toLowerCase();

  if (process.platform === 'linux') {
    if (extension === '.appimage' || extension === '' || basename.endsWith('.tar.gz') || basename.endsWith('.tar.xz')) {
      await fs.promises.chmod(resolvedPath, 0o755).catch(() => { });
    }
    if (extension === '.deb') {
      await shell.openPath(resolvedPath);
      return { ok: true, launched: true, path: resolvedPath };
    }
  }

  if (process.platform === 'darwin') {
    if (extension === '.dmg' || extension === '.zip') {
      await shell.openPath(resolvedPath);
      return { ok: true, launched: true, path: resolvedPath };
    }
  }

  if (process.platform === 'win32' && extension === '.zip') {
    await shell.openPath(resolvedPath);
    return { ok: true, launched: true, path: resolvedPath };
  }

  if (isLaunchableUpdateAsset(resolvedPath)) {
    try {
      const child = spawn(resolvedPath, [], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
      child.unref();
    } catch (e) {
      try { await shell.openExternal(UPDATE_RELEASES_PAGE); } catch { }
      return { ok: false, launched: false, path: resolvedPath, error: e?.message || String(e) };
    }
    return { ok: true, launched: true, path: resolvedPath };
  }

  await shell.openExternal(UPDATE_RELEASES_PAGE);
  return { ok: true, launched: false, path: resolvedPath };
}

export async function checkForLauncherUpdate({ promptUser = false, parentWindow = null, onEvent = null } = {}) {
  const currentVersion = String(app.getVersion() || '').trim();
  const updaterStrings = getUpdaterStrings(await getPreferredLanguage());
  onEvent?.('minecraft:update-status', { phase: 'checking', currentVersion, message: updaterStrings.checking });
  const response = await fetch(UPDATE_RELEASES_API, {
    headers: { 'User-Agent': 'OpenLauncher-Updater', Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`Failed to check updates: ${response.status}`);
  const release = await response.json();
  const latestVersion = normalizeReleaseVersionTag(release);
  //console.log(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);
  if (!latestVersion) return { error: 'InvalidRelease', message: 'Release metadata did not include a version tag.' };
  const currentTuple = versionToTuple(currentVersion);
  const latestTuple = versionToTuple(latestVersion);
  if (compareVersionTuples(latestTuple, currentTuple) <= 0) {
    onEvent?.('minecraft:update-status', { phase: 'up-to-date', currentVersion, latestVersion, message: updaterStrings.upToDate });
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
    onEvent?.('minecraft:update-status', { phase: 'release-page', currentVersion, latestVersion, message: updaterStrings.openingReleasePage });
    await shell.openExternal(release.html_url || UPDATE_RELEASES_PAGE);
    return { ok: true, available: true, openedReleasePage: true, currentVersion, latestVersion };
  }
  if (!isLaunchableUpdateAsset(asset.name)) {
    onEvent?.('minecraft:update-status', { phase: 'release-page', currentVersion, latestVersion, message: updaterStrings.openingReleasePage });
    await shell.openExternal(release.html_url || UPDATE_RELEASES_PAGE);
    return { ok: true, available: true, openedReleasePage: true, currentVersion, latestVersion };
  }
  onEvent?.('minecraft:update-status', {
    phase: 'downloading', currentVersion, latestVersion, assetName: asset.name,
    message: formatI18nMessage(updaterStrings.downloading, { assetName: asset.name }),
  });
  const updatesDir = path.join(app.getPath('userData'), 'updates');
  await fs.promises.mkdir(updatesDir, { recursive: true });
  const downloadPath = path.join(updatesDir, String(asset.name || `OpenLauncher-${latestVersion}`));
  try { await fs.promises.rm(downloadPath, { force: true }).catch(() => { }); } catch { }
  await downloadFileToPath(asset.browser_download_url, downloadPath, {
    onProgress: ({ loaded, total, percent }) => {
      onEvent?.('minecraft:update-progress', { phase: 'downloading', loaded, total, percent, currentVersion, latestVersion, assetName: asset.name });
    },
  });
  onEvent?.('minecraft:update-status', { phase: 'launching', currentVersion, latestVersion, assetName: asset.name, message: updaterStrings.launching });
  const launchResult = await launchDownloadedUpdate(downloadPath);
  if (launchResult?.launched) app.quit();
  onEvent?.('minecraft:update-complete', { phase: 'complete', currentVersion, latestVersion, assetName: asset.name, path: downloadPath });
  return { ok: true, available: true, downloaded: true, path: downloadPath, currentVersion, latestVersion };
}
