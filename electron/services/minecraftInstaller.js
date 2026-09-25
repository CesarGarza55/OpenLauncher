import { app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { createRequire } from 'module';
import { getMinecraftRoot, getMinecraftRoots } from './paths.js';
import { findJavaCommand, resolveJavaCommand } from './javaDetector.js';
import { getMainWindow } from './windowManager.js';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

const MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_LOADER_URL = 'https://meta.fabricmc.net/v2/versions/loader';
const FABRIC_INSTALLER_MAVEN_METADATA_URL = 'https://maven.fabricmc.net/net/fabricmc/fabric-installer/maven-metadata.xml';
const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const QUILT_GAME_URL = 'https://meta.quiltmc.org/v3/versions/game';
const QUILT_LOADER_URL = 'https://meta.quiltmc.org/v3/versions/loader';
const QUILT_INSTALLER_MAVEN_METADATA_URL = 'https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/maven-metadata.xml';
const NEOFORGE_MAVEN_DETAILS_URL = 'https://maven.neoforged.net/api/maven/details/releases/net/neoforged/neoforge';

export const activeInstalls = new Map();

export function makeInstallId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isValidJarFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile() || stats.size < 22) return false;
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
  } catch { return false; }
}

export async function findFirstMatchingJar(directoryPath, filterFn = null) {
  try {
    if (!fs.existsSync(directoryPath)) return null;
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const found = await findFirstMatchingJar(fullPath, filterFn);
        if (found) return found;
      } else if (entry.isFile()) {
        if (filterFn ? filterFn(entry.name, fullPath) : entry.name.toLowerCase().endsWith('.jar')) {
          if (isValidJarFile(fullPath)) return fullPath;
        }
      }
    }
  } catch { }
  return null;
}

export async function downloadToFile(url, outPath, installId, fileLabel = null, { onLog = null, onProgress = null } = {}) {
  const controller = new AbortController();
  const signal = controller.signal;
  if (!activeInstalls.has(installId)) activeInstalls.set(installId, { controllers: new Set() });
  activeInstalls.get(installId).controllers.add(controller);
  const displayName = fileLabel || path.basename(outPath);
  try {
    onLog?.('info', `Downloading ${displayName}...`);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    const total = Number(res.headers.get('content-length')) || null;
    let loaded = 0;
    let lastLoggedPercent = 0;
    const dest = fs.createWriteStream(outPath);
    const readable = Readable.fromWeb(res.body);
    let lastProgressTime = 0;
    readable.on('data', (chunk) => {
      loaded += chunk.length;
      const now = Date.now();
      if (now - lastProgressTime > 100 || (total && loaded >= total)) {
        lastProgressTime = now;
        const percent = total ? Math.round((loaded / total) * 100) : null;
        onProgress?.({ installId, file: displayName, loaded, total, percent });
      }
      const percent = total ? Math.round((loaded / total) * 100) : null;
      if (percent !== null && percent >= lastLoggedPercent + 25) {
        lastLoggedPercent = Math.floor(percent / 25) * 25;
        onLog?.('info', `[${displayName}] ${percent}% downloaded`);
      }
    });
    await new Promise((resolve, reject) => {
      readable.pipe(dest);
      dest.on('finish', resolve);
      dest.on('error', reject);
      readable.on('error', reject);
    });
    onLog?.('info', `Finished downloading ${displayName}.`);
    return { ok: true, path: outPath };
  } finally {
    const entry = activeInstalls.get(installId);
    if (entry) entry.controllers.delete(controller);
  }
}

export async function saveResponseBodyToFile(response, outPath) {
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

export async function ensureJarFile(url, outPath, { onLog = null } = {}) {
  if (isValidJarFile(outPath)) return outPath;
  try { await fs.promises.unlink(outPath); } catch { }
  const fileName = path.basename(outPath);
  onLog?.('info', `Downloading ${fileName}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  await saveResponseBodyToFile(response, outPath);
  return outPath;
}

export function buildMavenArtifactInfo(coordinates) {
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

export function getLibraryPathFromName(name, minecraftDirectory) {
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

export function resolveLibraryArtifactCandidates(lib) {
  const coordinates = String(lib?.name || '').trim();
  const artifactInfo = buildMavenArtifactInfo(coordinates);
  if (!artifactInfo) return [];
  const baseUrls = [];
  if (lib?.url) {
    const customUrl = String(lib.url).trim();
    if (customUrl) baseUrls.push(customUrl);
  }
  baseUrls.push(
    'https://maven.quiltmc.org/repository/release',
    'https://maven.quiltmc.org/repository/snapshot',
    'https://maven.fabricmc.net',
    'https://maven.neoforged.net/releases',
    'https://maven.minecraftforge.net',
    'https://libraries.minecraft.net',
    'https://repo1.maven.org/maven2',
  );
  const repositories = Array.from(new Set(baseUrls.filter(Boolean)));
  return repositories.map(repo => `${repo.replace(/\/+$/g, '')}/${artifactInfo.relativePath}`);
}

export function readZipEntryText(zip, entryName) {
  const entry = zip.getEntry(entryName);
  if (!entry) return null;
  return entry.getData().toString('utf8');
}

export async function extractZipEntryToFile(zip, entryName, outPath) {
  const entry = zip.getEntry(entryName);
  if (!entry) return false;
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, entry.getData());
  return true;
}

export function parseJsonFromZipEntry(zip, entryNames) {
  for (const entryName of entryNames) {
    const raw = readZipEntryText(zip, entryName);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

export function getJarMainClass(jarPath) {
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

export function rulesPassForCurrentSystem(rules, features = {}) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) return true;
  let allow = rules.some(r => r.action === 'allow') ? false : true;
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

export function substituteTemplateString(input, substitutions) {
  let output = String(input ?? '');
  for (const [key, value] of Object.entries(substitutions)) {
    output = output.replaceAll(key, value);
  }
  return output;
}

export async function installForgeLibraryEntry(library, minecraftRoot, installId, { onLog = null } = {}) {
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
        await ensureJarFile(candidateUrl, artifactPath, { onLog });
        break;
      } catch {}
    }
  }

  const platformKey = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
  const classifier = library?.natives?.[platformKey];
  const nativeArtifact = classifier ? library?.downloads?.classifiers?.[classifier] : null;
  if (nativeArtifact?.url) {
    const nativePath = nativeArtifact.path
      ? path.join(libsDir, nativeArtifact.path)
      : getLibraryPathFromName(`${library.name}:${classifier}`, minecraftRoot);
    await ensureJarFile(nativeArtifact.url, nativePath, { onLog });
  }
}

export async function installForgeLibraries(libraries, minecraftRoot, installId, { onLog = null } = {}) {
  for (const library of libraries || []) {
    try {
      await installForgeLibraryEntry(library, minecraftRoot, installId, { onLog });
    } catch (error) {
      onLog?.('stderr', `Forge library download failed: ${error?.message || error}`);
    }
  }
}

export function runCommand(command, args, { cwd, onStdout, onStderr } = {}) {
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

export function parseMavenReleaseVersion(xmlText) {
  const text = String(xmlText || '');
  const releaseMatch = text.match(/<release>([^<]+)<\/release>/i);
  if (releaseMatch?.[1]) return releaseMatch[1].trim();
  const latestMatch = text.match(/<latest>([^<]+)<\/latest>/i);
  if (latestMatch?.[1]) return latestMatch[1].trim();
  return null;
}

export async function getLatestFabricInstallerVersion() {
  const response = await fetch(FABRIC_INSTALLER_MAVEN_METADATA_URL);
  if (!response.ok) throw new Error(`Failed to fetch Fabric installer metadata: ${response.status}`);
  const xmlText = await response.text();
  const version = parseMavenReleaseVersion(xmlText);
  if (!version) throw new Error('Fabric installer version not found in metadata.');
  return version;
}

export async function getLatestQuiltInstallerVersion() {
  const response = await fetch(QUILT_INSTALLER_MAVEN_METADATA_URL);
  if (!response.ok) throw new Error(`Failed to fetch Quilt installer metadata: ${response.status}`);
  const xmlText = await response.text();
  const version = parseMavenReleaseVersion(xmlText);
  if (!version) throw new Error('Quilt installer version not found in metadata.');
  return version;
}

export async function loadMojangVersionMetadata(versionId) {
  if (!versionId) return null;
  const manifestRes = await fetch(MOJANG_MANIFEST_URL);
  if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const versionEntry = (manifest.versions || []).find(v => v.id === String(versionId));
  if (!versionEntry) throw new Error(`Version ${versionId} not found in manifest.`);
  const versionJsonRes = await fetch(versionEntry.url);
  if (!versionJsonRes.ok) throw new Error(`Failed to fetch version data: ${versionJsonRes.status}`);
  return await versionJsonRes.json();
}

export async function loadLocalVersionMetadata(versionDir) {
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
      } catch { }
    }
  } catch { }
  return null;
}

export async function persistInstalledVersion(versionDir, versionData) {
  await fs.promises.mkdir(versionDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(versionDir, 'version.json'),
    JSON.stringify({ ...versionData, installedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

export function resolveMinecraftVersionHelper(versionCandidate) {
  if (!versionCandidate) return '';
  if (typeof versionCandidate === 'object') {
    const raw = versionCandidate.inheritsFrom || versionCandidate.mcVer || versionCandidate.minecraftVersion || versionCandidate.gameVersion || versionCandidate.baseVersion || versionCandidate.id || '';
    if (!raw || raw === versionCandidate) return '';
    return resolveMinecraftVersionHelper(raw);
  }
  const str = String(versionCandidate).trim();
  if (!str || str.toLowerCase() === 'all' || str.toLowerCase() === 'auto') return '';

  const loaderMatch = str.match(/(?:fabric|quilt)-loader-[^-]+-(.+)$/i);
  if (loaderMatch) return loaderMatch[1];

  const spaceHyphenMatch = str.match(/(?:fabric|forge|neoforge|quilt)\s+[^\s-]+\s*-\s*(.+)/i);
  if (spaceHyphenMatch) return spaceHyphenMatch[1];

  const forgeMatch = str.match(/(\d+\.\d+(?:\.\d+)?)[-_](?:forge|neoforge)/i) || str.match(/(?:^|\b)(?:forge|neoforge)[-_](\d+\.\d+(?:\.\d+)?)/i);
  if (forgeMatch) return forgeMatch[1];

  const trailingMatch = str.match(/(?:^|[^0-9.])(\d+\.\d+(?:\.\d+)?)$/);
  if (trailingMatch && (str.includes('-') || str.includes('_') || str.includes(' '))) {
    return trailingMatch[1];
  }

  return str;
}

export async function readInstalledVersions() {
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

        let descriptor = null;
        const namedJsonPath = path.join(versionDir, `${versionId}.json`);
        const fallbackJsonPath = path.join(versionDir, 'version.json');
        try {
          const raw = await fs.promises.readFile(namedJsonPath, 'utf8')
            .catch(() => fs.promises.readFile(fallbackJsonPath, 'utf8'));
          descriptor = JSON.parse(raw);
        } catch {
          try {
            descriptor = await loadLocalVersionMetadata(versionDir);
          } catch {
            descriptor = null;
          }
        }

        const jarFiles = (await fs.promises.readdir(versionDir).catch(() => [])).filter(fileName => fileName.toLowerCase().endsWith('.jar'));
        if (!descriptor && jarFiles.length === 0) continue;
        const id = descriptor?.id || versionId;
        if (seen.has(id)) continue;
        seen.add(id);

        const lowerId = id.toLowerCase();
        let detectedType = descriptor?.type || 'vanilla';
        if (lowerId.includes('fabric')) detectedType = 'fabric';
        else if (lowerId.includes('neoforge') || lowerId.includes('neo forge')) detectedType = 'neoforge';
        else if (lowerId.includes('forge')) detectedType = 'forge';
        else if (lowerId.includes('quilt')) detectedType = 'quilt';
        else if (lowerId.includes('vanilla') || descriptor?.type === 'vanilla') detectedType = 'vanilla';

        let loaderVersion = descriptor?.loaderVersion || descriptor?.fabricLoaderVersion || null;
        if (!loaderVersion) {
          if (detectedType === 'fabric') {
            const m = id.match(/fabric-loader-([^\s-]+)/i);
            if (m) loaderVersion = m[1];
          } else if (detectedType === 'quilt') {
            const m = id.match(/quilt-loader-([^\s-]+)/i);
            if (m) loaderVersion = m[1];
          } else if (detectedType === 'forge') {
            const m = id.match(/(?:^|\b|-)forge-([^\s-]+)/i) || id.match(/forge-(\d+\.\d+(?:\.\d+)?)-([^\s-]+)/i);
            if (m) loaderVersion = m[2] || m[1];
          } else if (detectedType === 'neoforge') {
            const m = id.match(/(?:^|\b|-)neoforge-([^\s-]+)/i);
            if (m) loaderVersion = m[1];
          }
        }

        const inheritsFrom = (descriptor?.inheritsFrom || descriptor?.versionJson?.inheritsFrom)
          ? String(descriptor.inheritsFrom || descriptor.versionJson.inheritsFrom).trim()
          : null;
        const resolvedMcVer = inheritsFrom || descriptor?.mcVer || descriptor?.versionJson?.mcVer || descriptor?.minecraftVersion || resolveMinecraftVersionHelper(id);

        let label = descriptor?.label;
        if (!label || label === versionId || label === resolvedMcVer || label.startsWith('fabric-loader-') || label.startsWith('quilt-loader-')) {
          if (detectedType === 'fabric') {
            label = loaderVersion && resolvedMcVer
              ? `Fabric ${loaderVersion} - ${resolvedMcVer}`
              : `Fabric ${resolvedMcVer || versionId}`;
          } else if (detectedType === 'neoforge') {
            label = loaderVersion && resolvedMcVer
              ? `NeoForge ${loaderVersion} - ${resolvedMcVer}`
              : `NeoForge ${resolvedMcVer || versionId}`;
          } else if (detectedType === 'forge') {
            label = loaderVersion && resolvedMcVer
              ? `Forge ${loaderVersion} - ${resolvedMcVer}`
              : `Forge ${resolvedMcVer || versionId}`;
          } else if (detectedType === 'quilt') {
            label = loaderVersion && resolvedMcVer
              ? `Quilt ${loaderVersion} - ${resolvedMcVer}`
              : `Quilt ${resolvedMcVer || versionId}`;
          } else {
            label = `Minecraft ${resolvedMcVer || versionId}`;
          }
        }

        installed.push({
          id,
          label,
          type: detectedType,
          mcVer: resolvedMcVer || versionId,
          loaderVersion,
          inheritsFrom,
          installedAt: descriptor?.installedAt || null,
          path: versionDir,
        });
      }
    } catch { }
  }
  return installed;
}

export async function ensureLauncherProfilesExists(minecraftRoot) {
  const profilePath = path.join(minecraftRoot, 'launcher_profiles.json');
  if (!fs.existsSync(profilePath)) {
    const dummyProfiles = {
      profiles: {
        openlauncher: {
          name: 'OpenLauncher',
          type: 'custom',
          created: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          icon: 'Grass',
        },
      },
      settings: {},
      version: 3,
    };
    try {
      await fs.promises.mkdir(minecraftRoot, { recursive: true });
      await fs.promises.writeFile(profilePath, JSON.stringify(dummyProfiles, null, 2), 'utf8');
    } catch { }
  }
}

export async function ensureVanillaVersionInstalled(minecraftRoot, minecraftVersion, installId, { onLog = null, onProgress = null } = {}) {
  await ensureLauncherProfilesExists(minecraftRoot);
  const manifestRes = await fetch(MOJANG_MANIFEST_URL);
  if (!manifestRes.ok) throw new Error(`Failed to fetch manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const versionEntry = (manifest.versions || []).find(v => v.id === String(minecraftVersion));
  if (!versionEntry) throw new Error(`Version ${minecraftVersion} not found in manifest.`);

  const versionJsonRes = await fetch(versionEntry.url);
  if (!versionJsonRes.ok) throw new Error(`Failed to fetch version data: ${versionJsonRes.status}`);
  const versionJson = await versionJsonRes.json();

  const clientUrl = versionJson?.downloads?.client?.url;
  if (!clientUrl) throw new Error(`Client download URL not found for ${minecraftVersion}.`);

  const outDir = path.join(minecraftRoot, 'versions', String(minecraftVersion));
  await fs.promises.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${minecraftVersion}.jar`);
  const dl = await downloadToFile(clientUrl, outPath, installId, `${minecraftVersion}-client.jar`, { onLog, onProgress });
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

export async function installMinecraft(opts, { onLog = null, onProgress = null, onComplete = null } = {}) {
  const { type, version, gameVersion, loaderVersion } = opts || {};
  const installId = makeInstallId();
  const minecraftRoot = getMinecraftRoot();
  await ensureLauncherProfilesExists(minecraftRoot);

  if (type === 'minecraft') {
    onLog?.('info', `Resolving Minecraft ${version} release manifest...`);
    const res = await ensureVanillaVersionInstalled(minecraftRoot, String(version), installId, { onLog, onProgress });
    onLog?.('info', `Minecraft ${version} installed successfully.`);
    onComplete?.({ installId, type, version, path: res.jarPath });
    return { ok: true, path: res.jarPath, installId };
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
    const installerVersion = await getLatestFabricInstallerVersion();
    const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'openlauncher-fabric-'));
    const installerPath = path.join(tempDir, 'fabric-installer.jar');
    const installerUrl = `https://maven.fabricmc.net/net/fabricmc/fabric-installer/${installerVersion}/fabric-installer-${installerVersion}.jar`;
    const installerDownload = await downloadToFile(installerUrl, installerPath, installId, `fabric-installer-${installerVersion}.jar`, { onLog, onProgress });
    if (!installerDownload.ok) return { error: 'DownloadFailed', message: 'Fabric installer download failed.' };
    const javaChoice = findJavaCommand(8, opts?.javaPath || '');
    const javaCmd = javaChoice?.javaCmd || resolveJavaCommand(opts?.javaPath || '');
    const installerResult = await runCommand(javaCmd, ['-jar', installerPath, 'client', '-dir', minecraftRoot, '-mcversion', resolvedGameVersion, '-loader', resolvedLoaderVersion, '-noprofile', '-snapshot'], {
      cwd: tempDir,
      onStdout: (text) => {
        onProgress?.({ installId, loaded: 0, total: 1, percent: null });
        onLog?.('stdout', String(text));
      },
      onStderr: (text) => onLog?.('stderr', String(text)),
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
          onLog?.('info', `Preparing vanilla ${resolvedGameVersion} client jar for Fabric...`);
          await ensureJarFile(vanillaClientUrl, vanillaJarPath, { onLog });
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
    onComplete?.({ installId, type, version: `${resolvedLoaderVersion} on ${resolvedGameVersion}`, path: profileJsonPath });
    return { ok: true, path: profileJsonPath, installId };
  }

  if (type === 'quilt') {
    let resolvedLoaderVersion = String(loaderVersion || '').trim();
    let resolvedGameVersion = String(gameVersion || '').trim();
    if ((!resolvedLoaderVersion || !resolvedGameVersion) && version) {
      const m = String(version).match(/quilt-loader-([^\s-]+)[\s-]*[-]?\s*(.+)/);
      if (m) { resolvedLoaderVersion = resolvedLoaderVersion || m[1]; resolvedGameVersion = resolvedGameVersion || m[2]; }
      else if (String(version).includes(' - ')) {
        const [left, right] = String(version).split(' - ');
        const mm = left.match(/quilt-loader-([^\s-]+)/);
        resolvedLoaderVersion = resolvedLoaderVersion || mm?.[1] || '';
        resolvedGameVersion = resolvedGameVersion || right;
      }
    }
    if (!resolvedLoaderVersion || !resolvedGameVersion) return { error: 'BadInput', message: 'Could not resolve Quilt game and loader versions.' };

    const installerVersion = await getLatestQuiltInstallerVersion();
    const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'openlauncher-quilt-'));
    const installerPath = path.join(tempDir, 'quilt-installer.jar');
    const installerUrl = `https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-installer/${installerVersion}/quilt-installer-${installerVersion}.jar`;
    const installerDownload = await downloadToFile(installerUrl, installerPath, installId, `quilt-installer-${installerVersion}.jar`, { onLog, onProgress });
    if (!installerDownload.ok) return { error: 'DownloadFailed', message: 'Quilt installer download failed.' };

    const javaChoice = findJavaCommand(8, opts?.javaPath || '');
    const javaCmd = javaChoice?.javaCmd || resolveJavaCommand(opts?.javaPath || '');

    const quiltArgs = [
      '-jar', installerPath,
      'install', 'client',
      resolvedGameVersion,
      resolvedLoaderVersion,
      `--install-dir=${minecraftRoot}`,
      '--no-profile',
    ];
    const installerResult = await runCommand(javaCmd, quiltArgs, {
      cwd: tempDir,
      onStdout: (text) => {
        onProgress?.({ installId, loaded: 0, total: 1, percent: null });
        onLog?.('stdout', String(text));
      },
      onStderr: (text) => onLog?.('stderr', String(text)),
    });
    if (installerResult.code !== 0) return { error: 'QuiltInstallFailed', message: `Quilt installer exited with code ${installerResult.code}. ${installerResult.stderr || installerResult.stdout || ''}`.trim() };

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
          onLog?.('info', `Preparing vanilla ${resolvedGameVersion} client jar for Quilt...`);
          await ensureJarFile(vanillaClientUrl, vanillaJarPath, { onLog });
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

    const profileUrl = `https://meta.quiltmc.org/v3/versions/loader/${resolvedGameVersion}/${resolvedLoaderVersion}/profile/json`;
    let profileJson = null;
    try { const profileRes = await fetch(profileUrl); if (profileRes.ok) profileJson = await profileRes.json(); } catch { profileJson = null; }
    const profileId = String(profileJson?.id || `quilt-loader-${resolvedLoaderVersion}-${resolvedGameVersion}`).trim();
    const outDir = path.join(minecraftRoot, 'versions', profileId);
    await fs.promises.mkdir(outDir, { recursive: true });
    const profileJsonPath = path.join(outDir, `${profileId}.json`);
    if (profileJson) await fs.promises.writeFile(profileJsonPath, JSON.stringify(profileJson, null, 2), 'utf8');
    await persistInstalledVersion(outDir, { id: profileId, label: `Quilt ${resolvedLoaderVersion} - ${resolvedGameVersion}`, type: 'quilt', mcVer: resolvedGameVersion, loaderVersion: resolvedLoaderVersion, versionJson: profileJson || null });
    onComplete?.({ installId, type, version: `${resolvedLoaderVersion} on ${resolvedGameVersion}`, path: profileJsonPath });
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
    const installerDownload = await downloadToFile(installerUrl, installerPath, installId, `forge-installer-${forgeVersion}.jar`, { onLog, onProgress });
    if (!installerDownload.ok) return { error: 'DownloadFailed', message: 'Forge installer download failed' };

    const installerZip = new AdmZip(installerPath);
    const forgeInstallProfile = parseJsonFromZipEntry(installerZip, ['install_profile.json']);
    const forgeVersionJson = parseJsonFromZipEntry(installerZip, ['version.json']) || forgeInstallProfile?.versionInfo || forgeInstallProfile;
    if (!forgeVersionJson) return { error: 'InvalidInstaller', message: 'Forge installer did not contain version metadata.' };

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

    if (!resolvedMinecraftVersion) return { error: 'InvalidInstaller', message: 'Forge installer did not define the Minecraft base version.' };

    const vanillaResult = await ensureVanillaVersionInstalled(minecraftRoot, resolvedMinecraftVersion, installId, { onLog, onProgress });
    if (!vanillaResult) return { error: 'VanillaInstallFailed', message: `Failed to install vanilla ${resolvedMinecraftVersion} required for Forge.` };

    const outDir = path.join(minecraftRoot, 'versions', forgeVersionId);
    await fs.promises.mkdir(outDir, { recursive: true });

    const vanillaJarPath = path.join(minecraftRoot, 'versions', resolvedMinecraftVersion, `${resolvedMinecraftVersion}.jar`);
    const forgeVanillaJarPath = path.join(outDir, `${resolvedMinecraftVersion}.jar`);

    if (fs.existsSync(vanillaJarPath)) {
      await fs.promises.copyFile(vanillaJarPath, forgeVanillaJarPath);
    } else {
      const clientUrl = vanillaResult.versionJson?.downloads?.client?.url;
      if (clientUrl) {
        await ensureJarFile(clientUrl, forgeVanillaJarPath, { onLog });
      } else {
        return { error: 'MissingVanillaJar', message: `Vanilla jar not found for ${resolvedMinecraftVersion}.` };
      }
    }

    const javaChoice = findJavaCommand(8, opts?.javaPath || '');
    const javaCmd = javaChoice?.javaCmd || resolveJavaCommand(opts?.javaPath || '');

    let patchResult = await runCommand(javaCmd, ['-jar', installerPath, '--installClient', minecraftRoot], {
      cwd: tempDir,
      onStdout: (text) => {
        onProgress?.({ installId, loaded: 0, total: 1, percent: null });
        onLog?.('stdout', String(text));
      },
      onStderr: (text) => onLog?.('stderr', String(text)),
    });

    if (patchResult.code !== 0) {
      patchResult = await runCommand(javaCmd, ['-jar', installerPath, minecraftRoot], {
        cwd: tempDir,
        onStdout: (text) => {
          onProgress?.({ installId, loaded: 0, total: 1, percent: null });
          onLog?.('stdout', String(text));
        },
        onStderr: (text) => onLog?.('stderr', String(text)),
      });
    }

    if (patchResult.code !== 0) {
      return { error: 'ForgePatchFailed', message: `Forge patch process failed with code ${patchResult.code}. ${patchResult.stderr || patchResult.stdout || ''}`.trim() };
    }

    if (Array.isArray(forgeInstallProfile?.libraries)) {
      await installForgeLibraries(forgeInstallProfile.libraries, minecraftRoot, installId, { onLog });
    }

    const versionJsonPath = path.join(outDir, `${forgeVersionId}.json`);
    await fs.promises.writeFile(versionJsonPath, JSON.stringify(forgeVersionJson, null, 2), 'utf8');

    const forgeLibPath = path.join(minecraftRoot, 'libraries', 'net', 'minecraftforge', 'forge', forgeVersion);
    await fs.promises.mkdir(forgeLibPath, { recursive: true });

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

    let patchedJarPath = path.join(outDir, `${forgeVersionId}.jar`);
    const alternativePatchedJar = path.join(outDir, `${forgeVersionId}-patched.jar`);
    const vanillaPatchedJar = path.join(outDir, `${resolvedMinecraftVersion}-patched.jar`);

    if (fs.existsSync(alternativePatchedJar)) {
      await fs.promises.rename(alternativePatchedJar, patchedJarPath);
    } else if (fs.existsSync(vanillaPatchedJar)) {
      await fs.promises.rename(vanillaPatchedJar, patchedJarPath);
    }

    if (!fs.existsSync(patchedJarPath)) {
      if (fs.existsSync(forgeVanillaJarPath)) {
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
      clientJar: path.basename(patchedJarPath),
    });

    onComplete?.({ installId, type, version: `${forgeVersion} / ${resolvedMinecraftVersion}`, path: versionJsonPath });
    return { ok: true, path: versionJsonPath, installId };
  }

  if (type === 'neoforge') {
    const neoVersion = String(loaderVersion || version || '').trim();
    if (!neoVersion) return { error: 'BadInput', message: 'NeoForge version is required.' };

    let resolvedMinecraftVersion = String(gameVersion || '').trim();
    if (!resolvedMinecraftVersion) {
      const m = neoVersion.match(/^(\d+)\.(\d+)(?:\.|$)/);
      if (m) {
        const major = parseInt(m[1], 10);
        const minor = parseInt(m[2], 10);
        resolvedMinecraftVersion = (major >= 20 && major <= 25) ? `1.${major}.${minor}` : `${major}.${minor}`;
      }
    }
    if (!resolvedMinecraftVersion) return { error: 'NotFound', message: 'Could not map NeoForge version to Minecraft version.' };

    onLog?.('info', `Ensuring vanilla ${resolvedMinecraftVersion} is installed for NeoForge...`);
    await ensureVanillaVersionInstalled(minecraftRoot, resolvedMinecraftVersion, installId, { onLog, onProgress });

    const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-installer.jar`;
    const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'openlauncher-neoforge-'));
    const installerPath = path.join(tempDir, 'neoforge-installer.jar');
    const installerDownload = await downloadToFile(installerUrl, installerPath, installId, `neoforge-${neoVersion}-installer.jar`, { onLog, onProgress });
    if (!installerDownload.ok) return { error: 'DownloadFailed', message: `NeoForge installer download failed: ${installerDownload.status || 'unknown'}` };

    const majorVerMatch = neoVersion.match(/^(\d+)\./);
    const neoMajor = majorVerMatch ? parseInt(majorVerMatch[1], 10) : 21;
    const isJava21Required = neoMajor >= 21 || neoVersion.startsWith('20.5') || neoVersion.startsWith('20.6') || resolvedMinecraftVersion.startsWith('1.20.5') || resolvedMinecraftVersion.startsWith('1.20.6') || resolvedMinecraftVersion.startsWith('1.21') || resolvedMinecraftVersion.startsWith('26.');
    const reqJava = isJava21Required ? 21 : 17;

    const javaChoice = findJavaCommand(reqJava, opts?.javaPath || '') || findJavaCommand(8, opts?.javaPath || '');
    const javaCmd = javaChoice?.javaCmd || resolveJavaCommand(opts?.javaPath || '');

    onLog?.('info', `Running NeoForge installer using ${javaCmd}...`);

    const installerResult = await runCommand(javaCmd, ['-jar', installerPath, '--installClient', minecraftRoot], {
      cwd: tempDir,
      onStdout: (text) => {
        onProgress?.({ installId, loaded: 0, total: 1, percent: null });
        onLog?.('stdout', String(text));
      },
      onStderr: (text) => onLog?.('stderr', String(text)),
    });

    if (installerResult.code !== 0) {
      return { error: 'NeoForgeInstallFailed', message: `NeoForge installer exited with code ${installerResult.code}. ${installerResult.stderr || installerResult.stdout || ''}`.trim() };
    }

    const possibleDirs = [
      path.join(minecraftRoot, 'versions', `neoforge-${neoVersion}`),
      path.join(minecraftRoot, 'versions', `${resolvedMinecraftVersion}-neoforge-${neoVersion}`),
      path.join(minecraftRoot, 'versions', neoVersion),
    ];
    let outDir = possibleDirs.find(d => fs.existsSync(d)) || possibleDirs[0];
    const versionId = path.basename(outDir);
    const versionJsonPath = path.join(outDir, `${versionId}.json`);

    let neoVersionJson = null;
    try {
      const raw = await fs.promises.readFile(versionJsonPath, 'utf8').catch(() => fs.promises.readFile(path.join(outDir, 'version.json'), 'utf8'));
      neoVersionJson = JSON.parse(raw);
    } catch { }

    await persistInstalledVersion(outDir, {
      id: versionId,
      label: `NeoForge ${neoVersion} - ${resolvedMinecraftVersion}`,
      type: 'neoforge',
      mcVer: resolvedMinecraftVersion,
      loaderVersion: neoVersion,
      versionJson: neoVersionJson,
    });

    onComplete?.({ installId, type, version: `${neoVersion} / ${resolvedMinecraftVersion}`, path: versionJsonPath });
    return { ok: true, path: versionJsonPath, installId };
  }

  return { error: 'NotImplemented', message: `Installer for '${type}' not implemented.` };
}

export function cancelInstall(installId) {
  const entry = activeInstalls.get(installId);
  if (!entry) return { error: 'NotFound', message: `No install with id ${installId}` };
  try {
    for (const c of entry.controllers) {
      try { c.abort(); } catch {}
    }
    activeInstalls.delete(installId);
    return { ok: true };
  } catch (e) {
    return { error: 'CancelFailed', message: e?.message || String(e) };
  }
}
