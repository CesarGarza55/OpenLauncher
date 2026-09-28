import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { loadLauncherState } from '../../src/lib/launcherState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPDATE_REPOSITORY = 'CesarGarza55/OpenLauncher';
const UPDATE_RELEASES_API = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`;
const UPDATE_RELEASES_PAGE = `https://github.com/${UPDATE_REPOSITORY}/releases/latest`;

const localeCache = new Map();

export async function loadLocaleData(language = 'en') {
  const lang = String(language || 'en').trim().toLowerCase();
  if (localeCache.has(lang)) return localeCache.get(lang);

  try {
    const localePath = path.resolve(__dirname, `../../src/locales/${lang}.json`);
    const content = await fs.promises.readFile(localePath, 'utf8');
    const parsed = JSON.parse(content);
    localeCache.set(lang, parsed);
    return parsed;
  } catch {
    if (lang !== 'en') {
      return loadLocaleData('en');
    }
    return {};
  }
}

export async function getUpdaterStrings(language) {
  const locale = await loadLocaleData(language);
  return locale?.updater || {};
}

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
    return lowerName.endsWith('.appimage') || lowerName.endsWith('.deb') || lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tar.xz');
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
    return state.settings?.language || 'en';
  } catch {
    return 'en';
  }
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
        if (assetName.endsWith('.appimage')) {
          score += process.env.APPIMAGE ? 120 : 100;
        }
        if (assetName.endsWith('.deb')) {
          score += 90;
        }
        if (assetName.endsWith('.tar.gz') || assetName.endsWith('.tar.xz')) {
          score += 80;
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
    if (extension === '.appimage') {
      try {
        if (process.env.APPIMAGE) {
          try {
            await fs.promises.copyFile(resolvedPath, process.env.APPIMAGE);
            await fs.promises.chmod(process.env.APPIMAGE, 0o755);
            const child = spawn(process.env.APPIMAGE, [], { detached: true, stdio: 'ignore' });
            child.unref();
            return { ok: true, launched: true, path: process.env.APPIMAGE };
          } catch { }
        }
        const child = spawn(resolvedPath, [], { detached: true, stdio: 'ignore' });
        child.unref();
        return { ok: true, launched: true, path: resolvedPath };
      } catch (e) {
        try { await shell.openExternal(UPDATE_RELEASES_PAGE); } catch { }
        return { ok: false, launched: false, path: resolvedPath, error: e?.message || String(e) };
      }
    }
    if (extension === '.deb') {
      await shell.openPath(resolvedPath);
      return { ok: true, launched: true, path: resolvedPath };
    }
    if (basename.endsWith('.tar.gz') || basename.endsWith('.tar.xz')) {
      await shell.openPath(path.dirname(resolvedPath));
      return { ok: true, launched: true, path: resolvedPath };
    }
  }

  if (process.platform === 'darwin') {
    if (extension === '.dmg' || extension === '.zip') {
      await shell.openPath(resolvedPath);
      return { ok: true, launched: true, path: resolvedPath };
    }
  }

  if (process.platform === 'win32') {
    if (extension === '.zip') {
      await shell.openPath(resolvedPath);
      return { ok: true, launched: true, path: resolvedPath };
    }
    if (extension === '.exe') {
      try {
        const child = spawn(resolvedPath, ['/S'], {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
        return { ok: true, launched: true, path: resolvedPath };
      } catch (e) {
        try { await shell.openExternal(UPDATE_RELEASES_PAGE); } catch { }
        return { ok: false, launched: false, path: resolvedPath, error: e?.message || String(e) };
      }
    }
  }

  if (isLaunchableUpdateAsset(resolvedPath)) {
    try {
      const child = spawn(resolvedPath, [], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
      child.unref();
      return { ok: true, launched: true, path: resolvedPath };
    } catch (e) {
      try { await shell.openExternal(UPDATE_RELEASES_PAGE); } catch { }
      return { ok: false, launched: false, path: resolvedPath, error: e?.message || String(e) };
    }
  }

  await shell.openExternal(UPDATE_RELEASES_PAGE);
  return { ok: true, launched: false, path: resolvedPath };
}

export async function downloadAndApplyUpdate(updatePayload = {}, { onEvent = null } = {}) {
  const currentVersion = String(app.getVersion() || '').trim();
  const latestVersion = updatePayload.latestVersion || '';
  const asset = updatePayload.asset;
  const updaterStrings = await getUpdaterStrings(await getPreferredLanguage());

  if (!asset || !asset.browser_download_url) {
    onEvent?.('minecraft:update-status', { phase: 'release-page', currentVersion, latestVersion, message: updaterStrings.openingReleasePage });
    await shell.openExternal(updatePayload.releaseUrl || UPDATE_RELEASES_PAGE);
    return { ok: true, available: true, openedReleasePage: true, currentVersion, latestVersion };
  }

  if (!isLaunchableUpdateAsset(asset.name)) {
    onEvent?.('minecraft:update-status', { phase: 'release-page', currentVersion, latestVersion, message: updaterStrings.openingReleasePage });
    await shell.openExternal(updatePayload.releaseUrl || UPDATE_RELEASES_PAGE);
    return { ok: true, available: true, openedReleasePage: true, currentVersion, latestVersion };
  }

  onEvent?.('minecraft:update-status', {
    phase: 'downloading',
    currentVersion,
    latestVersion,
    assetName: asset.name,
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
  onEvent?.('minecraft:update-complete', { phase: 'complete', currentVersion, latestVersion, assetName: asset.name, path: downloadPath });

  if (launchResult?.launched) {
    setTimeout(() => {
      app.quit();
    }, 400);
  }

  return { ok: true, available: true, downloaded: true, path: downloadPath, currentVersion, latestVersion };
}

export async function checkForLauncherUpdate({ onEvent = null } = {}) {
  const currentVersion = String(app.getVersion() || '').trim();
  const updaterStrings = await getUpdaterStrings(await getPreferredLanguage());
  onEvent?.('minecraft:update-status', { phase: 'checking', currentVersion, message: updaterStrings.checking });

  const response = await fetch(UPDATE_RELEASES_API, {
    headers: { 'User-Agent': 'OpenLauncher-Updater', Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`Failed to check updates: ${response.status}`);
  const release = await response.json();
  const latestVersion = normalizeReleaseVersionTag(release);

  if (!latestVersion) return { error: 'InvalidRelease', message: 'Release metadata did not include a version tag.' };

  const currentTuple = versionToTuple(currentVersion);
  const latestTuple = versionToTuple(latestVersion);

  if (compareVersionTuples(latestTuple, currentTuple) <= 0) {
    onEvent?.('minecraft:update-status', { phase: 'up-to-date', currentVersion, latestVersion, message: updaterStrings.upToDate });
    return { ok: true, upToDate: true, currentVersion, latestVersion };
  }

  const asset = pickUpdateAsset(release);
  const updateInfo = {
    ok: true,
    available: true,
    currentVersion,
    latestVersion,
    releaseNotes: release.body || '',
    releaseUrl: release.html_url || UPDATE_RELEASES_PAGE,
    asset,
  };

  onEvent?.('minecraft:update-available', updateInfo);
  return updateInfo;
}
