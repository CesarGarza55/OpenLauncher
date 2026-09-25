import { app, dialog, shell } from 'electron';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { getMinecraftRoot, getMinecraftRoots } from './paths.js';
import { downloadFileToPath } from './updater.js';
import { getMainWindow } from './windowManager.js';
import {
  getModrinthProject,
  getModrinthProjectVersions,
  getModrinthVersion,
  checkModrinthVersionFilesUpdate,
} from '../../src/lib/modrinth.js';

const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

const MODS_METADATA_FILE = 'mods-metadata.json';

export async function readModsMetadataStore() {
  try {
    const raw = await fs.promises.readFile(path.join(app.getPath('userData'), MODS_METADATA_FILE), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveModMetadataStore(newMeta) {
  try {
    const current = await readModsMetadataStore();
    const merged = { ...current, ...newMeta };
    await fs.promises.writeFile(
      path.join(app.getPath('userData'), MODS_METADATA_FILE),
      JSON.stringify(merged, null, 2),
      'utf8'
    );
  } catch {}
}

export async function fetchAndCacheIconAsBase64(iconUrl) {
  if (!iconUrl || typeof iconUrl !== 'string' || !iconUrl.startsWith('http')) return iconUrl || null;
  try {
    const res = await fetch(iconUrl, { headers: { 'User-Agent': 'CesarGarza55/OpenLauncher/1.0.2 (support@codevbox.com)' } });
    if (!res.ok) return iconUrl;
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.warn('Failed to fetch and cache mod icon:', e);
    return iconUrl;
  }
}

export function extractJarMetadata(jarFilePath) {
  try {
    const zip = new AdmZip(jarFilePath);

    // 1. Quilt mod
    const quiltEntry = zip.getEntry('quilt.mod.json');
    if (quiltEntry) {
      const data = JSON.parse(quiltEntry.getData().toString('utf8'));
      const qmod = data?.quilt_loader?.metadata || data;
      let iconBase64 = null;
      if (qmod?.icon) {
        const iconEntry = zip.getEntry(qmod.icon);
        if (iconEntry) {
          iconBase64 = `data:image/png;base64,${iconEntry.getData().toString('base64')}`;
        }
      }
      return {
        id: qmod?.id || data?.quilt_loader?.id || null,
        displayName: qmod?.name || qmod?.id || null,
        version: qmod?.version || data?.quilt_loader?.version || '',
        description: qmod?.description || '',
        authors: Array.isArray(qmod?.contributors)
          ? Object.keys(qmod.contributors).join(', ')
          : '',
        iconUrl: iconBase64,
        loader: 'quilt',
      };
    }

    // 2. Fabric mod
    const fabricEntry = zip.getEntry('fabric.mod.json');
    if (fabricEntry) {
      const data = JSON.parse(fabricEntry.getData().toString('utf8'));
      let iconBase64 = null;
      if (data.icon) {
        const iconEntry = zip.getEntry(data.icon);
        if (iconEntry) {
          iconBase64 = `data:image/png;base64,${iconEntry.getData().toString('base64')}`;
        }
      }
      return {
        id: data.id || null,
        displayName: data.name || data.id,
        version: data.version || '',
        description: data.description || '',
        authors: Array.isArray(data.authors)
          ? data.authors.map(a => typeof a === 'string' ? a : a.name).join(', ')
          : (data.authors || ''),
        iconUrl: iconBase64,
        loader: 'fabric',
      };
    }

    // 3. NeoForge mods.toml
    const neoForgeEntry = zip.getEntry('META-INF/neoforge.mods.toml');
    if (neoForgeEntry) {
      const text = neoForgeEntry.getData().toString('utf8');
      const idMatch = text.match(/modId\s*=\s*["']([^"']+)["']/i);
      const nameMatch = text.match(/displayName\s*=\s*["']([^"']+)["']/i);
      const verMatch = text.match(/version\s*=\s*["']([^"']+)["']/i);
      const descMatch = text.match(/description\s*=\s*'''([^']+)'''/i) || text.match(/description\s*=\s*"""([^"]+)"""/i) || text.match(/description\s*=\s*["']([^"']+)["']/i);
      const logoMatch = text.match(/logoFile\s*=\s*["']([^"']+)["']/i);
      let iconBase64 = null;
      if (logoMatch && logoMatch[1]) {
        const logoEntry = zip.getEntry(logoMatch[1]) || zip.getEntry(`META-INF/${logoMatch[1]}`);
        if (logoEntry) {
          iconBase64 = `data:image/png;base64,${logoEntry.getData().toString('base64')}`;
        }
      }
      return {
        id: idMatch ? idMatch[1] : null,
        displayName: nameMatch ? nameMatch[1] : null,
        version: verMatch ? verMatch[1] : '',
        description: descMatch ? descMatch[1].trim() : '',
        iconUrl: iconBase64,
        loader: 'neoforge',
      };
    }

    // 4. Forge mods.toml
    const forgeEntry = zip.getEntry('META-INF/mods.toml');
    if (forgeEntry) {
      const text = forgeEntry.getData().toString('utf8');
      const idMatch = text.match(/modId\s*=\s*["']([^"']+)["']/i);
      const nameMatch = text.match(/displayName\s*=\s*["']([^"']+)["']/i);
      const verMatch = text.match(/version\s*=\s*["']([^"']+)["']/i);
      const descMatch = text.match(/description\s*=\s*'''([^']+)'''/i) || text.match(/description\s*=\s*"""([^"]+)"""/i) || text.match(/description\s*=\s*["']([^"']+)["']/i);
      const logoMatch = text.match(/logoFile\s*=\s*["']([^"']+)["']/i);
      let iconBase64 = null;
      if (logoMatch && logoMatch[1]) {
        const logoEntry = zip.getEntry(logoMatch[1]) || zip.getEntry(`META-INF/${logoMatch[1]}`);
        if (logoEntry) {
          iconBase64 = `data:image/png;base64,${logoEntry.getData().toString('base64')}`;
        }
      }
      return {
        id: idMatch ? idMatch[1] : null,
        displayName: nameMatch ? nameMatch[1] : null,
        version: verMatch ? verMatch[1] : '',
        description: descMatch ? descMatch[1].trim() : '',
        iconUrl: iconBase64,
        loader: 'forge',
      };
    }

    // 5. mcmod.info (Legacy Forge)
    const mcmodEntry = zip.getEntry('mcmod.info');
    if (mcmodEntry) {
      const info = JSON.parse(mcmodEntry.getData().toString('utf8'));
      const item = Array.isArray(info) ? info[0] : (info?.modList?.[0] || info);
      return {
        id: item?.modid || null,
        displayName: item?.name || item?.modid,
        version: item?.version || '',
        description: item?.description || '',
        authors: Array.isArray(item?.authorList) ? item.authorList.join(', ') : '',
        loader: 'forge',
      };
    }
  } catch {}
  return null;
}

export async function readInstalledMods() {
  const installed = [];
  const seen = new Set();
  const metadataStore = await readModsMetadataStore();

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

        const baseKey = modId.toLowerCase();
        const fullPath = path.join(modsDir, fileName);

        let meta = metadataStore[baseKey] || metadataStore[fileName.toLowerCase()] || null;

        if (!meta && fs.existsSync(fullPath)) {
          meta = extractJarMetadata(fullPath);
        }

        installed.push({
          id: modId,
          modId: meta?.id || null,
          name: meta?.displayName || meta?.title || modId,
          fileName,
          version: meta?.version || 'installed',
          type: meta?.loader || 'jar',
          description: meta?.description || '',
          authors: meta?.authors || meta?.author || '',
          iconUrl: meta?.iconUrl || meta?.icon_url || null,
          enabled,
          path: fullPath,
        });
      }
    } catch { }
  }
  return installed;
}

export async function resolveModFile(modsDir, modId, extension) {
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

export async function toggleMod(modId, enable) {
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

export async function setAllModsEnabled(enable) {
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

export async function deleteMod(modId) {
  const root = getMinecraftRoot();
  const modsDir = path.join(root, 'mods');
  const baseId = String(modId || '').replace(/\.(jar|olpkg)$/i, '').trim();
  if (!baseId) return { error: 'BadInput', message: 'Missing mod id.' };
  let targets = [path.join(modsDir, `${baseId}.jar`), path.join(modsDir, `${baseId}.olpkg`)];
  let existingPaths = targets.filter(existingPath => fs.existsSync(existingPath));
  if (existingPaths.length === 0) {
    try {
      const files = await fs.promises.readdir(modsDir);
      for (const file of files) {
        if (file.toLowerCase() === `${baseId.toLowerCase()}.jar` ||
            file.toLowerCase() === `${baseId.toLowerCase()}.olpkg` ||
            file.replace(/\.(jar|olpkg)$/i, '').toLowerCase() === baseId.toLowerCase()) {
          existingPaths.push(path.join(modsDir, file));
        }
      }
    } catch {}
  }
  if (existingPaths.length === 0) return { error: 'NotFound', message: `Mod not found: ${baseId}` };
  const mainWindow = getMainWindow();
  const choice = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'warning', buttons: ['Cancel', 'Delete'], defaultId: 1, cancelId: 0, noLink: true,
    title: 'Delete mod?', message: `Delete ${baseId}?`,
    detail: 'This will remove the mod file from the Minecraft mods folder.',
  });
  if (choice.response !== 1) return { canceled: true, reason: 'delete-cancelled' };
  try {
    const metaStore = await readModsMetadataStore();
    let metaChanged = false;
    for (const existingPath of existingPaths) {
      const fn = path.basename(existingPath);
      const fnKey = fn.toLowerCase();
      const baseKey = fn.replace(/\.(jar|olpkg)$/i, '').toLowerCase();
      if (metaStore[fnKey]) { delete metaStore[fnKey]; metaChanged = true; }
      if (metaStore[baseKey]) { delete metaStore[baseKey]; metaChanged = true; }
      await fs.promises.unlink(existingPath).catch(() => { });
    }
    if (metaChanged) {
      await fs.promises.writeFile(
        path.join(app.getPath('userData'), MODS_METADATA_FILE),
        JSON.stringify(metaStore, null, 2),
        'utf8'
      ).catch(() => {});
    }
    return { ok: true, removed: existingPaths };
  } catch (error) { return { error: 'DeleteFailed', message: error?.message || String(error) }; }
}

export function normalizeModFileName(fileName) {
  const trimmedName = String(fileName || '').trim();
  if (!trimmedName) return null;
  const ext = path.extname(trimmedName).toLowerCase();
  if (ext !== '.jar' && ext !== '.olpkg') return null;
  return trimmedName;
}

export async function importModFile(payload) {
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
    const mainWindow = getMainWindow();
    const choice = await dialog.showMessageBox(mainWindow || undefined, {
      type: 'question', buttons: ['Cancel', 'Replace'], defaultId: 1, cancelId: 0, noLink: true,
      title: 'Replace mod?', message: `A mod with the same name already exists: ${sourceFileName}`,
      detail: 'Do you want to replace the existing file in the Minecraft mods folder?',
    });
    if (choice.response !== 1) return { canceled: true, reason: 'replace-cancelled', path: destinationPath };
    for (const existingPath of existingPaths) await fs.promises.unlink(existingPath).catch(() => { });
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

export async function cleanupOldModVersions(modsDir, modId, targetFileName, onLog = null) {
  if (!modsDir || !modId || !targetFileName) return;
  const cleanModId = String(modId).toLowerCase().trim();
  const cleanTargetFile = String(targetFileName).toLowerCase().trim();

  try {
    const files = await fs.promises.readdir(modsDir);
    for (const file of files) {
      const lowerFile = file.toLowerCase().trim();
      if (lowerFile === cleanTargetFile) continue;

      if (!lowerFile.endsWith('.jar') && !lowerFile.endsWith('.olpkg') && !lowerFile.endsWith('.jar.disabled')) {
        continue;
      }

      const filePath = path.join(modsDir, file);
      let shouldDelete = false;

      try {
        const meta = extractJarMetadata(filePath);
        if (meta?.id && String(meta.id).toLowerCase().trim() === cleanModId) {
          shouldDelete = true;
        }
      } catch {}

      if (!shouldDelete) {
        const isCompanion = (cleanModId === 'sodium' && (lowerFile.includes('extra') || lowerFile.includes('reeses') || lowerFile.includes('options'))) ||
                            (cleanModId === 'iris' && lowerFile.includes('flawless'));
        if (!isCompanion) {
          if (lowerFile.startsWith(`${cleanModId}-`) || lowerFile.startsWith(`${cleanModId}_`) || lowerFile.startsWith(`${cleanModId}+`) ||
              lowerFile === `${cleanModId}.jar` || lowerFile === `${cleanModId}.olpkg`) {
            shouldDelete = true;
          }
        }
      }

      if (shouldDelete) {
        try {
          await fs.promises.unlink(filePath);
          onLog?.('info', `[Mod Manager] Removed older version: ${file}`);
        } catch {}
      }
    }
  } catch {}
}

export async function cleanupOldFileVersions(dir, projectId, targetFileName, onLog = null) {
  if (!dir || !projectId || !targetFileName) return;
  const cleanId = String(projectId).toLowerCase().trim();
  const cleanTarget = String(targetFileName).toLowerCase().trim();
  try {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      const lower = file.toLowerCase().trim();
      if (lower === cleanTarget) continue;
      if (
        lower.startsWith(`${cleanId}-`) ||
        lower.startsWith(`${cleanId}_`) ||
        lower.startsWith(`${cleanId}+`) ||
        lower === `${cleanId}.zip` ||
        lower.replace(/\.zip$/i, '') === cleanId
      ) {
        try {
          const fp = path.join(dir, file);
          const stat = await fs.promises.stat(fp);
          if (stat.isDirectory()) {
            await fs.promises.rm(fp, { recursive: true, force: true });
          } else {
            await fs.promises.unlink(fp);
          }
          onLog?.('info', `[File Manager] Removed older version: ${file}`);
        } catch {}
      }
    }
  } catch {}
}

export async function readInstalledShaders() {
  const installed = [];
  const seen = new Set();
  const metadataStore = await readModsMetadataStore();

  for (const root of getMinecraftRoots()) {
    const shadersDir = path.join(root, 'shaderpacks');
    try {
      const dirEntries = await fs.promises.readdir(shadersDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        const fileName = entry.name;
        if (fileName.startsWith('.') || fileName === 'desktop.ini' || fileName === 'Thumbs.db') continue;
        const lowerName = fileName.toLowerCase();
        const baseKey = lowerName.replace(/\.zip$/i, '');
        if (seen.has(baseKey)) continue;
        seen.add(baseKey);

        const fullPath = path.join(shadersDir, fileName);
        let stat = null;
        try { stat = await fs.promises.stat(fullPath); } catch {}

        const meta = metadataStore[baseKey] || metadataStore[lowerName] || null;

        installed.push({
          id: baseKey,
          name: meta?.displayName || fileName.replace(/\.zip$/i, ''),
          fileName,
          version: meta?.version || '',
          description: meta?.description || '',
          authors: meta?.authors || '',
          iconUrl: meta?.iconUrl || null,
          size: stat?.size || 0,
          isDirectory: entry.isDirectory(),
          path: fullPath,
        });
      }
    } catch {}
  }
  return installed;
}

export async function readInstalledResourcePacks() {
  const installed = [];
  const seen = new Set();
  const metadataStore = await readModsMetadataStore();

  for (const root of getMinecraftRoots()) {
    const packsDir = path.join(root, 'resourcepacks');
    try {
      const dirEntries = await fs.promises.readdir(packsDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        const fileName = entry.name;
        if (fileName.startsWith('.') || fileName === 'desktop.ini' || fileName === 'Thumbs.db') continue;
        const lowerName = fileName.toLowerCase();
        const baseKey = lowerName.replace(/\.zip$/i, '');
        if (seen.has(baseKey)) continue;
        seen.add(baseKey);

        const fullPath = path.join(packsDir, fileName);
        let stat = null;
        try { stat = await fs.promises.stat(fullPath); } catch {}

        let packMetaDesc = '';
        let packIcon = null;

        if (entry.isFile() && lowerName.endsWith('.zip')) {
          try {
            const zip = new AdmZip(fullPath);
            const mcmetaEntry = zip.getEntry('pack.mcmeta');
            if (mcmetaEntry) {
              const text = mcmetaEntry.getData().toString('utf8');
              const json = JSON.parse(text);
              const desc = json?.pack?.description;
              if (typeof desc === 'string') {
                packMetaDesc = desc;
              } else if (desc && typeof desc === 'object') {
                packMetaDesc = desc.text || JSON.stringify(desc);
              }
            }
            const iconEntry = zip.getEntry('pack.png');
            if (iconEntry) {
              packIcon = `data:image/png;base64,${iconEntry.getData().toString('base64')}`;
            }
          } catch {}
        } else if (entry.isDirectory()) {
          try {
            const mcmetaPath = path.join(fullPath, 'pack.mcmeta');
            if (fs.existsSync(mcmetaPath)) {
              const text = await fs.promises.readFile(mcmetaPath, 'utf8');
              const json = JSON.parse(text);
              const desc = json?.pack?.description;
              if (typeof desc === 'string') packMetaDesc = desc;
              else if (desc && typeof desc === 'object') packMetaDesc = desc.text || JSON.stringify(desc);
            }
            const iconPath = path.join(fullPath, 'pack.png');
            if (fs.existsSync(iconPath)) {
              const buf = await fs.promises.readFile(iconPath);
              packIcon = `data:image/png;base64,${buf.toString('base64')}`;
            }
          } catch {}
        }

        const meta = metadataStore[baseKey] || metadataStore[lowerName] || null;

        installed.push({
          id: baseKey,
          name: meta?.displayName || fileName.replace(/\.zip$/i, ''),
          fileName,
          version: meta?.version || '',
          description: meta?.description || packMetaDesc || '',
          authors: meta?.authors || '',
          iconUrl: meta?.iconUrl || packIcon || null,
          size: stat?.size || 0,
          isDirectory: entry.isDirectory(),
          path: fullPath,
        });
      }
    } catch {}
  }
  return installed;
}

export async function deleteShader(fileName) {
  const root = getMinecraftRoot();
  const shadersDir = path.join(root, 'shaderpacks');
  const targetPath = path.join(shadersDir, fileName);
  if (!fs.existsSync(targetPath)) {
    return { error: 'NotFound', message: `Shader pack not found: ${fileName}` };
  }
  const mainWindow = getMainWindow();
  const choice = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'warning', buttons: ['Cancel', 'Delete'], defaultId: 1, cancelId: 0, noLink: true,
    title: 'Delete shader?', message: `Delete ${fileName}?`,
    detail: 'This will remove the shader pack from your Minecraft shaderpacks folder.',
  });
  if (choice.response !== 1) return { canceled: true, reason: 'delete-cancelled' };
  try {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    return { ok: true, removed: targetPath };
  } catch (err) {
    return { error: 'DeleteFailed', message: err?.message || String(err) };
  }
}

export async function deleteResourcePack(fileName) {
  const root = getMinecraftRoot();
  const packsDir = path.join(root, 'resourcepacks');
  const targetPath = path.join(packsDir, fileName);
  if (!fs.existsSync(targetPath)) {
    return { error: 'NotFound', message: `Texture pack not found: ${fileName}` };
  }
  const mainWindow = getMainWindow();
  const choice = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'warning', buttons: ['Cancel', 'Delete'], defaultId: 1, cancelId: 0, noLink: true,
    title: 'Delete texture pack?', message: `Delete ${fileName}?`,
    detail: 'This will remove the texture pack from your Minecraft resourcepacks folder.',
  });
  if (choice.response !== 1) return { canceled: true, reason: 'delete-cancelled' };
  try {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
    return { ok: true, removed: targetPath };
  } catch (err) {
    return { error: 'DeleteFailed', message: err?.message || String(err) };
  }
}

export async function openContentFolder(folderType = 'mods') {
  const root = getMinecraftRoot();
  let subDir = 'mods';
  if (folderType === 'shaders' || folderType === 'shaderpacks') {
    subDir = 'shaderpacks';
  } else if (folderType === 'texturepacks' || folderType === 'resourcepacks' || folderType === 'textures') {
    subDir = 'resourcepacks';
  }
  const targetPath = path.join(root, subDir);
  try {
    await fs.promises.mkdir(targetPath, { recursive: true });
    const result = await shell.openPath(targetPath);
    if (result) {
      return { error: 'OpenPathFailed', message: result, path: targetPath };
    }
    return { ok: true, path: targetPath };
  } catch (error) {
    return { error: 'OpenPathFailed', message: error?.message || String(error), path: targetPath };
  }
}

export async function importContentFile(payload) {
  const { type = 'mod', sourcePath, fileName, fileBytes } = (typeof payload === 'object' ? payload : { sourcePath: payload });
  const root = getMinecraftRoot();
  let targetSubDir = 'mods';
  if (type === 'shader' || type === 'shaders' || type === 'shaderpacks') targetSubDir = 'shaderpacks';
  else if (type === 'resourcepack' || type === 'texturepack' || type === 'textures' || type === 'resourcepacks') targetSubDir = 'resourcepacks';

  if (targetSubDir === 'mods') {
    return importModFile(payload);
  }

  const destDir = path.join(root, targetSubDir);
  await fs.promises.mkdir(destDir, { recursive: true });

  const resolvedSourcePath = String(sourcePath || '').trim();
  const sourceFileName = fileName || (resolvedSourcePath ? path.basename(resolvedSourcePath) : '');
  if (!resolvedSourcePath && !sourceFileName) return { error: 'BadInput', message: 'Missing file name.' };

  const destPath = path.join(destDir, sourceFileName);
  if (fs.existsSync(destPath)) {
    const mainWindow = getMainWindow();
    const choice = await dialog.showMessageBox(mainWindow || undefined, {
      type: 'question', buttons: ['Cancel', 'Replace'], defaultId: 1, cancelId: 0, noLink: true,
      title: 'Replace file?', message: `A file with the same name already exists: ${sourceFileName}`,
      detail: `Do you want to replace the existing file in the Minecraft ${targetSubDir} folder?`,
    });
    if (choice.response !== 1) return { canceled: true, reason: 'replace-cancelled', path: destPath };
    await fs.promises.unlink(destPath).catch(() => {});
  }

  if (resolvedSourcePath) {
    const stats = await fs.promises.stat(resolvedSourcePath).catch(() => null);
    if (!stats) return { error: 'NotFound', message: `File not found: ${resolvedSourcePath}` };
    if (stats.isDirectory()) {
      await fs.promises.cp(resolvedSourcePath, destPath, { recursive: true });
    } else {
      if (path.resolve(resolvedSourcePath) !== path.resolve(destPath)) {
        await fs.promises.copyFile(resolvedSourcePath, destPath);
      }
    }
  } else {
    const buffer = Buffer.isBuffer(fileBytes) ? fileBytes : fileBytes instanceof Uint8Array ? Buffer.from(fileBytes) : Array.isArray(fileBytes) ? Buffer.from(fileBytes) : null;
    if (!buffer || buffer.length === 0) return { error: 'BadInput', message: 'Missing file contents.' };
    await fs.promises.writeFile(destPath, buffer);
  }

  return { ok: true, path: destPath, fileName: sourceFileName };
}

export async function pickContentFiles(type = 'mod') {
  let title = 'Select files';
  let filters = [{ name: 'All Files', extensions: ['*'] }];
  if (type === 'shader' || type === 'shaders' || type === 'shaderpacks') {
    title = 'Select Shader Packs';
    filters = [{ name: 'Shader Packs (.zip)', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }];
  } else if (type === 'resourcepack' || type === 'texturepack' || type === 'textures' || type === 'resourcepacks') {
    title = 'Select Texture Packs';
    filters = [{ name: 'Texture Packs (.zip)', extensions: ['zip'] }, { name: 'All Files', extensions: ['*'] }];
  } else {
    title = 'Select Mod Files';
    filters = [{ name: 'Minecraft Mods (.jar, .olpkg)', extensions: ['jar', 'olpkg'] }, { name: 'All Files', extensions: ['*'] }];
  }

  const mainWindow = getMainWindow();
  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title,
    properties: ['openFile', 'multiSelections'],
    filters,
  });
  if (result.canceled) return { canceled: true, filePaths: [] };
  return { canceled: false, filePaths: result.filePaths || [] };
}

export async function installModrinthProject({
  projectId,
  versionId,
  versionNumber,
  fileUrl,
  fileName,
  gameVersion,
  loader,
  projectType = 'mod',
}, { onLog = null } = {}) {
  const root = getMinecraftRoot();
  const normalizedType = projectType === 'shader' ? 'shader' : projectType === 'resourcepack' ? 'resourcepack' : 'mod';

  let targetDir = path.join(root, 'mods');
  if (normalizedType === 'shader') {
    targetDir = path.join(root, 'shaderpacks');
  } else if (normalizedType === 'resourcepack') {
    targetDir = path.join(root, 'resourcepacks');
  }

  await fs.promises.mkdir(targetDir, { recursive: true });

  let targetVersion = null;
  if (versionId) {
    targetVersion = await getModrinthVersion(versionId).catch(() => null);
  }

  if (!targetVersion && projectId) {
    const versions = await getModrinthProjectVersions({
      idOrSlug: projectId,
      loaders: normalizedType === 'mod' && loader && loader !== 'all' ? [loader.toLowerCase()] : [],
      gameVersions: gameVersion && gameVersion !== 'all' ? [gameVersion] : [],
    }).catch(() => []);

    if (versionNumber) {
      const searchNum = String(versionNumber).toLowerCase().replace(/^v/i, '').trim();
      targetVersion = versions.find(v => {
        const vNum = String(v.version_number || '').toLowerCase().replace(/^v/i, '').trim();
        const vName = String(v.name || '').toLowerCase();
        const fileNames = (v.files || []).map(f => String(f.filename || '').toLowerCase());
        return vNum === searchNum || vNum.includes(searchNum) || vName.includes(searchNum) || fileNames.some(fn => fn.includes(searchNum));
      }) || versions?.[0] || null;
    } else {
      targetVersion = versions?.[0] || null;
    }
  }

  let downloadUrl = fileUrl;
  let targetFileName = fileName;

  if (targetVersion) {
    const primaryFile = targetVersion.files?.find(f => f.primary) || targetVersion.files?.[0];
    if (primaryFile) {
      downloadUrl = primaryFile.url;
      targetFileName = primaryFile.filename || targetFileName;
    }
  }

  if (!downloadUrl) {
    throw new Error(`Could not resolve download URL for this ${normalizedType} version.`);
  }

  if (normalizedType === 'mod') {
    targetFileName = normalizeModFileName(targetFileName) || `${projectId || 'mod'}.jar`;
  } else {
    targetFileName = String(targetFileName || `${projectId || normalizedType}.zip`).trim();
  }

  const destPath = path.join(targetDir, targetFileName);
  const typeLabel = normalizedType === 'shader' ? 'Shader' : normalizedType === 'resourcepack' ? 'Resource Pack' : 'Mod';

  onLog?.('info', `[Modrinth] Downloading ${typeLabel}: ${targetFileName}...`);

  await downloadFileToPath(downloadUrl, destPath);

  const detectedId = String(projectId || '').toLowerCase().trim() ||
    (normalizedType === 'mod' ? (() => { try { return extractJarMetadata(destPath)?.id?.toLowerCase()?.trim() || ''; } catch { return ''; } })() : '');

  if (detectedId) {
    if (normalizedType === 'mod') {
      await cleanupOldModVersions(targetDir, detectedId, targetFileName, onLog);
    } else {
      await cleanupOldFileVersions(targetDir, detectedId, targetFileName, onLog);
    }
  }

  const metaEntries = {};
  if (projectId) {
    try {
      const project = await getModrinthProject(projectId).catch(() => null);
      if (project) {
        const fileKey = targetFileName.replace(/\.(jar|zip|olpkg)$/i, '').toLowerCase();
        let cachedIcon = null;
        if (project.icon_url) {
          cachedIcon = await fetchAndCacheIconAsBase64(project.icon_url);
        }
        metaEntries[fileKey] = {
          displayName: project.title,
          description: project.description,
          iconUrl: cachedIcon || project.icon_url || null,
          authors: project.team_members || project.client_side || '',
          loader: loader || (project.loaders ? project.loaders.join(', ') : ''),
          version: targetVersion?.version_number || '',
          projectType: normalizedType,
        };
        metaEntries[targetFileName.toLowerCase()] = metaEntries[fileKey];
      }
    } catch {}
  }

  const installedDeps = [];
  if (normalizedType === 'mod' && targetVersion?.dependencies && Array.isArray(targetVersion.dependencies)) {
    const requiredDeps = targetVersion.dependencies.filter(
      d => d.dependency_type === 'required' && (d.project_id || d.version_id)
    );
    for (const dep of requiredDeps) {
      try {
        let depVersion = null;
        let depProject = null;

        if (dep.project_id) {
          depProject = await getModrinthProject(dep.project_id).catch(() => null);
        }

        const candidateIds = new Set([
          String(dep.project_id || '').toLowerCase().trim(),
          String(depProject?.slug || '').toLowerCase().trim()
        ].filter(Boolean));

        let isDepAlreadyInstalled = false;
        try {
          const currentFiles = await fs.promises.readdir(targetDir);
          for (const file of currentFiles) {
            if (!file.toLowerCase().endsWith('.jar') && !file.toLowerCase().endsWith('.olpkg')) continue;
            const checkPath = path.join(targetDir, file);
            try {
              const meta = extractJarMetadata(checkPath);
              if (meta?.id && candidateIds.has(String(meta.id).toLowerCase().trim())) {
                isDepAlreadyInstalled = true;
                break;
              }
            } catch {}
          }
        } catch {}

        if (isDepAlreadyInstalled) {
          continue;
        }

        if (dep.version_id) {
          depVersion = await getModrinthVersion(dep.version_id).catch(() => null);
        } else if (dep.project_id) {
          const depVersions = await getModrinthProjectVersions({
            idOrSlug: dep.project_id,
            loaders: loader && loader !== 'all' ? [loader.toLowerCase()] : [],
            gameVersions: gameVersion && gameVersion !== 'all' ? [gameVersion] : [],
          }).catch(() => []);
          depVersion = depVersions?.[0] || null;
        }

        if (depVersion?.files?.[0]?.url) {
          const depFile = depVersion.files.find(f => f.primary) || depVersion.files[0];
          const depFileName = normalizeModFileName(depFile.filename) || 'dependency.jar';
          const depPath = path.join(targetDir, depFileName);
          if (!fs.existsSync(depPath)) {
            onLog?.('info', `[Modrinth] Downloading required dependency: ${depFileName}...`);
            await downloadFileToPath(depFile.url, depPath);
            installedDeps.push(depFileName);

            const depDetectedId = depProject?.slug || dep.project_id || '';
            if (depDetectedId) {
              await cleanupOldModVersions(targetDir, depDetectedId, depFileName, onLog);
            }

            if (depProject) {
              const depKey = depFileName.replace(/\.jar$/i, '').toLowerCase();
              let depCachedIcon = null;
              if (depProject.icon_url) {
                depCachedIcon = await fetchAndCacheIconAsBase64(depProject.icon_url);
              }
              metaEntries[depKey] = {
                displayName: depProject.title,
                description: depProject.description,
                iconUrl: depCachedIcon || depProject.icon_url || null,
                loader: loader || '',
                version: depVersion?.version_number || '',
                projectType: 'mod',
              };
              metaEntries[depFileName.toLowerCase()] = metaEntries[depKey];
            }
          }
        }
      } catch (depErr) {
        console.warn('Failed to install dependency:', depErr);
      }
    }
  }

  if (Object.keys(metaEntries).length > 0) {
    await saveModMetadataStore(metaEntries);
  }

  onLog?.('success', `[Modrinth] Installed ${typeLabel} ${targetFileName}${installedDeps.length > 0 ? ` (+ ${installedDeps.length} dependencies)` : ''} successfully.`);

  let updatedContent = null;
  if (normalizedType === 'shader') {
    updatedContent = await readInstalledShaders();
  } else if (normalizedType === 'resourcepack') {
    updatedContent = await readInstalledResourcePacks();
  } else {
    updatedContent = await readInstalledMods();
  }

  return {
    ok: true,
    fileName: targetFileName,
    path: destPath,
    projectType: normalizedType,
    installedDependencies: installedDeps,
    items: updatedContent,
    mods: updatedContent,
  };
}

export async function getFileSha512(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);
  return crypto.createHash('sha512').update(fileBuffer).digest('hex');
}

export async function checkInstalledModsUpdates({ gameVersion, loader } = {}) {
  const root = getMinecraftRoot();
  const modsDir = path.join(root, 'mods');
  try {
    const entries = await fs.promises.readdir(modsDir, { withFileTypes: true });
    const modFiles = entries
      .filter(e => e.isFile() && (e.name.toLowerCase().endsWith('.jar') || e.name.toLowerCase().endsWith('.jar.disabled')))
      .map(e => e.name);

    if (modFiles.length === 0) return { updates: {}, count: 0 };

    const hashMap = new Map();
    const hashes = [];

    for (const fileName of modFiles) {
      const filePath = path.join(modsDir, fileName);
      try {
        const hash = await getFileSha512(filePath);
        hashMap.set(hash, fileName);
        hashes.push(hash);
      } catch {}
    }

    if (hashes.length === 0) return { updates: {}, count: 0 };

    const loaders = loader && loader.toLowerCase() !== 'all' && loader.toLowerCase() !== 'vanilla'
      ? [loader.toLowerCase()]
      : ['fabric', 'quilt', 'forge', 'neoforge'];
    const gameVersions = gameVersion && gameVersion.toLowerCase() !== 'all' ? [gameVersion] : [];

    const response = await checkModrinthVersionFilesUpdate({
      hashes,
      algorithm: 'sha512',
      loaders,
      gameVersions,
    });

    const updates = {};
    if (response && typeof response === 'object') {
      for (const [hash, versionObj] of Object.entries(response)) {
        const fileName = hashMap.get(hash);
        if (!fileName || !versionObj) continue;
        const primaryFile = versionObj.files?.find(f => f.primary) || versionObj.files?.[0];
        const primaryHash = primaryFile?.hashes?.sha512 || '';
        if (primaryHash && primaryHash !== hash) {
          const fileKey = fileName.replace(/\.jar(\.disabled)?$/i, '').toLowerCase();
          const updateInfo = {
            fileName,
            fileKey,
            currentHash: hash,
            newVersionNumber: versionObj.version_number,
            newVersionName: versionObj.name,
            versionId: versionObj.id,
            projectId: versionObj.project_id,
            changelog: versionObj.changelog,
            datePublished: versionObj.date_published,
            fileUrl: primaryFile?.url || null,
            targetFileName: primaryFile?.filename || fileName,
            fileSize: primaryFile?.size || null,
          };
          updates[fileName] = updateInfo;
          updates[fileKey] = updateInfo;
        }
      }
    }

    return { updates, count: Object.keys(updates).filter(k => k.includes('.jar')).length };
  } catch (error) {
    console.warn('Failed to check mod updates:', error);
    return { updates: {}, count: 0, error: error?.message || String(error) };
  }
}
