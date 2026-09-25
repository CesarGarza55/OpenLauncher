import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getMinecraftRoot } from './paths.js';
import {
  findJavaCommand,
  resolveJavaCommand,
  detectJavaMajor,
  collectCommonJavaCandidates,
} from './javaDetector.js';
import {
  ensureJarFile,
  findFirstMatchingJar,
  getLibraryPathFromName,
  loadLocalVersionMetadata,
  loadMojangVersionMetadata,
  persistInstalledVersion,
  saveResponseBodyToFile,
  isValidJarFile,
  resolveLibraryArtifactCandidates,
} from './minecraftInstaller.js';
import { loadLauncherState } from '../../src/lib/launcherState.js';
import { getMainWindow } from './windowManager.js';

export const runningChildren = new Map();

export function makeOfflineUuid(seed) {
  const hash = crypto.createHash('sha1').update(`OfflinePlayer:${seed}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function resolveMinecraftVersion(versionCandidate) {
  if (!versionCandidate) return '';
  if (typeof versionCandidate === 'object') {
    const raw = versionCandidate.inheritsFrom || versionCandidate.mcVer || versionCandidate.minecraftVersion || versionCandidate.gameVersion || versionCandidate.baseVersion || versionCandidate.id || '';
    if (!raw || raw === versionCandidate) return '';
    return resolveMinecraftVersion(raw);
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

export function mergeVersionMetadata(baseVersionJson, customVersionJson) {
  if (!baseVersionJson) return customVersionJson || null;
  if (!customVersionJson) return baseVersionJson;

  const baseGameArgs = Array.isArray(baseVersionJson.arguments?.game)
    ? baseVersionJson.arguments.game
    : (baseVersionJson.arguments?.game ? [baseVersionJson.arguments.game] : []);
  const customGameArgs = Array.isArray(customVersionJson.arguments?.game)
    ? customVersionJson.arguments.game
    : (customVersionJson.arguments?.game ? [customVersionJson.arguments.game] : []);

  const baseJvmArgs = Array.isArray(baseVersionJson.arguments?.jvm)
    ? baseVersionJson.arguments.jvm
    : (baseVersionJson.arguments?.jvm ? [baseVersionJson.arguments.jvm] : []);
  const customJvmArgs = Array.isArray(customVersionJson.arguments?.jvm)
    ? customVersionJson.arguments.jvm
    : (customVersionJson.arguments?.jvm ? [customVersionJson.arguments.jvm] : []);

  return {
    ...baseVersionJson,
    ...customVersionJson,
    libraries: [...(baseVersionJson.libraries || []), ...(customVersionJson.libraries || [])],
    arguments: {
      game: [...baseGameArgs, ...customGameArgs],
      jvm: [...baseJvmArgs, ...customJvmArgs],
    },
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

export async function findLocalVersionJar(versionDir, preferredNames = []) {
  if (!versionDir) return null;
  const preferred = new Set(
    preferredNames.filter(Boolean).map(value => String(value).trim()).flatMap(value => [value, `${value}.jar`])
  );
  try {
    const entries = await fs.promises.readdir(versionDir, { withFileTypes: true });
    const jarFiles = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.jar')).map(entry => entry.name);
    for (const fileName of jarFiles) {
      if (preferred.has(fileName) || preferred.has(fileName.replace(/\.jar$/i, ''))) {
        const fullPath = path.join(versionDir, fileName);
        if (isValidJarFile(fullPath)) return fullPath;
        try { await fs.promises.unlink(fullPath); } catch { }
      }
    }
    for (const fileName of jarFiles.sort()) {
      const fullPath = path.join(versionDir, fileName);
      if (isValidJarFile(fullPath)) return fullPath;
      try { await fs.promises.unlink(fullPath); } catch { }
    }
    return null;
  } catch { return null; }
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

export function getMavenLibraryKey(name) {
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

export function parseFabricModConflict(logText) {
  if (!logText || typeof logText !== 'string') return null;
  const isConflict = logText.includes('Incompatible mods found!') ||
    logText.includes('net.fabricmc.loader.impl.FormattedException') ||
    logText.includes('Mod resolution failed') ||
    logText.includes('Some of your mods are incompatible');
  if (!isConflict) return null;

  let description = '';
  const match = logText.match(/(?:Incompatible mods found!|Some of your mods are incompatible[^\n]*)([\s\S]*?)(?=at net\.fabricmc\.loader|$)/i);
  if (match) {
    description = match[0].trim();
  } else {
    const fallback = logText.match(/FormattedException:([\s\S]*?)(?=at net\.fabricmc\.loader|$)/i);
    if (fallback) {
      description = fallback[0].trim();
    } else {
      const modRes = logText.match(/(?:Mod resolution failed[\s\S]*?)(?=\n\s*\n\s*\n|$)/i);
      if (modRes) {
        description = modRes[0].trim();
      }
    }
  }

  const suggestedUpdates = [];
  const fixMatches = logText.matchAll(/replace\s*\[\[([a-z0-9_-]+)[^\]]*\]\s*->\s*add:([a-z0-9_-]+)\s+([0-9a-z.+_-]+)/gi);
  for (const fm of fixMatches) {
    suggestedUpdates.push({
      oldModId: fm[1],
      modId: fm[2],
      targetVersion: fm[3],
    });
  }

  const textMatches = logText.matchAll(/(?:Cambia el mod|Replace mod)\s+'([^']+)'\s*\(([^)]+)\)[^\n]+?(?:la versión|version)\s+([0-9a-z.+_-]+)/gi);
  for (const tm of textMatches) {
    const cleanVersion = String(tm[3] || '').replace(/[.,;:!]+$/, '');
    if (!suggestedUpdates.some(u => u.modId.toLowerCase() === tm[2].toLowerCase())) {
      suggestedUpdates.push({
        displayName: tm[1],
        modId: tm[2],
        targetVersion: cleanVersion,
      });
    }
  }

  const compatFixes = [];
  const compatTargetMatches = logText.matchAll(/(?:Cambia el mod|Replace mod)\s+'([^']+)'\s*\(([^)]+)\)[^\n]+?(?:compatible con|compatible with):\s*\n\s*-\s*([a-z0-9_-]+)\s+([0-9a-z.+_-]+)/gi);
  for (const cm of compatTargetMatches) {
    const modId = cm[2].toLowerCase();
    const requiredBy = cm[3].toLowerCase();
    if (modId === 'sodium' && requiredBy === 'iris') {
      compatFixes.push({
        type: 'downgrade_to_compatible',
        modId: 'sodium',
        displayName: 'Sodium',
        targetVersion: '0.8.7',
        cascade: [
          { modId: 'sodium-extra', targetVersion: '0.8.3' },
          { modId: 'reeses-sodium-options', targetVersion: '2.1.0' },
        ]
      });
    }
  }

  const conflictingMods = [];
  const incompMatches = logText.matchAll(/['"]([^'"]+)['"]\s*\(([a-z0-9_-]+)\)[^\n]+?(?:no es compatible con|is incompatible with)[^\n]+?['"]([^'"]+)['"]\s*\(([a-z0-9_-]+)\)/gi);
  for (const im of incompMatches) {
    const modA = { name: im[1], id: im[2] };
    const modB = { name: im[3], id: im[4] };
    if (!conflictingMods.some(m => m.id.toLowerCase() === modA.id.toLowerCase())) {
      conflictingMods.push(modA);
    }
    if (!conflictingMods.some(m => m.id.toLowerCase() === modB.id.toLowerCase())) {
      conflictingMods.push(modB);
    }
  }

  return {
    isConflict: true,
    rawDescription: description || logText.slice(-1500),
    suggestedUpdates,
    conflictingMods,
    compatFixes,
  };
}

export async function launchMinecraft(opts, { onLog = null, onAssetProgress = null, onExit = null, onConflict = null } = {}) {
  const { profile, version: rawVersion } = opts || {};
  let version = rawVersion || profile?.version || null;
  if (typeof version === 'string') {
    version = { id: version, label: version, mcVer: version, type: 'vanilla' };
  }
  const rawId = String(version?.id || profile?.version || (typeof rawVersion === 'string' ? rawVersion : rawVersion?.id) || '').trim();
  const mcVer = resolveMinecraftVersion(version) || resolveMinecraftVersion(rawId) || rawId;
  const baseDir = getMinecraftRoot();
  const versionDir = version?.path && String(version.path).trim()
    ? String(version.path).trim()
    : path.join(baseDir, 'versions', rawId || mcVer);

  let versionJson = version?.versionJson || null;
  if (!versionJson) versionJson = await loadLocalVersionMetadata(versionDir);
  if (!versionJson && rawId && rawId !== path.basename(versionDir)) {
    versionJson = await loadLocalVersionMetadata(path.join(baseDir, 'versions', rawId));
  }
  if (!versionJson && mcVer && mcVer !== rawId) {
    versionJson = await loadLocalVersionMetadata(path.join(baseDir, 'versions', mcVer));
  }

  const versionType = String(version?.type || '').toLowerCase();
  const inheritedVersionId = String(versionJson?.inheritsFrom || (versionType !== 'vanilla' && mcVer !== rawId ? mcVer : '')).trim();
  let inheritedVersionJson = null;

  if (inheritedVersionId) {
    const vanillaVersionDir = path.join(baseDir, 'versions', inheritedVersionId);
    inheritedVersionJson = await loadLocalVersionMetadata(vanillaVersionDir);
    if (!inheritedVersionJson) {
      try {
        inheritedVersionJson = await loadMojangVersionMetadata(inheritedVersionId);
      } catch (error) {
        if (versionType === 'vanilla') throw error;
      }
    }
  }

  let jarPath = null;
  if (inheritedVersionId) {
    const vanillaVersionDir = path.join(baseDir, 'versions', inheritedVersionId);
    jarPath = await findLocalVersionJar(vanillaVersionDir, [inheritedVersionId]);
  }
  if (!jarPath) {
    jarPath = await findLocalVersionJar(versionDir, [rawId, version?.id, version?.label, mcVer]);
  }
  if (!jarPath && mcVer && mcVer !== rawId) {
    const mcVerDir = path.join(baseDir, 'versions', mcVer);
    jarPath = await findLocalVersionJar(mcVerDir, [mcVer]);
  }

  if (!versionJson && (versionType === 'vanilla' || !versionType)) {
    try {
      versionJson = await loadMojangVersionMetadata(mcVer || rawId);
    } catch (e) { }
  }

  if (!versionJson) {
    const customLabel = String(version?.label || version?.id || mcVer || 'custom version');
    return { error: 'CustomVersionMetadataMissing', message: `Could not read local launch metadata for '${customLabel}'.` };
  }

  versionJson = mergeVersionMetadata(inheritedVersionJson, versionJson);

  await fs.promises.mkdir(versionDir, { recursive: true });
  if (!jarPath) {
    const clientUrl = inheritedVersionJson?.downloads?.client?.url || versionJson?.downloads?.client?.url;

    if (inheritedVersionId) {
      const vanillaVersionDir = path.join(baseDir, 'versions', inheritedVersionId);
      await fs.promises.mkdir(vanillaVersionDir, { recursive: true });
      const vanillaJarPath = path.join(vanillaVersionDir, `${inheritedVersionId}.jar`);
      if (!clientUrl) throw new Error(`Could not find client download URL for ${inheritedVersionId}. Install vanilla ${inheritedVersionId} first or check your internet connection.`);
      onLog?.('info', `Downloading vanilla ${inheritedVersionId} client jar...`);
      await ensureJarFile(clientUrl, vanillaJarPath, { onLog });
      jarPath = vanillaJarPath;
    } else {
      if (!clientUrl) throw new Error(`Local client jar not found for ${String(version?.label || rawId || mcVer || 'version')}.`);
      const targetJarName = mcVer || rawId || 'version';
      const targetJarDir = path.join(baseDir, 'versions', targetJarName);
      await fs.promises.mkdir(targetJarDir, { recursive: true });
      const fallbackJarPath = path.join(targetJarDir, `${targetJarName}.jar`);
      await ensureJarFile(clientUrl, fallbackJarPath, { onLog });
      jarPath = fallbackJarPath;
    }
  }

  const libraries = versionJson?.libraries || [];
  const libsDir = path.join(baseDir, 'libraries');
  await fs.promises.mkdir(libsDir, { recursive: true });
  const classpathParts = [];
  const classpathLibraryEntries = new Map();

  onLog?.('info', 'Verifying game libraries...');

  const missingLibraries = [];
  for (const lib of libraries) {
    const resolvedLibraryPath = lib?.downloads?.artifact?.path
      ? path.join(libsDir, lib.downloads.artifact.path)
      : lib?.name
        ? getLibraryPathFromName(lib.name, baseDir)
        : null;

    const candidateUrls = [];
    if (lib?.downloads?.artifact?.url) candidateUrls.push(lib.downloads.artifact.url);
    candidateUrls.push(...resolveLibraryArtifactCandidates(lib));

    if (resolvedLibraryPath) {
      if (!fs.existsSync(resolvedLibraryPath) && candidateUrls.length > 0) {
        missingLibraries.push({ urls: candidateUrls, path: resolvedLibraryPath });
      }
      if (lib?.name) {
        const libraryKeyInfo = getMavenLibraryKey(lib.name);
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
      } else {
        classpathParts.push(resolvedLibraryPath);
      }
    }

    if (lib?.natives) {
      const platformKey = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
      const classifier = lib.natives[platformKey];
      const nativeArtifact = classifier ? lib?.downloads?.classifiers?.[classifier] : null;
      const nativeUrl = nativeArtifact?.url || null;
      if (nativeUrl) {
        const nativeOut = nativeArtifact?.path
          ? path.join(libsDir, nativeArtifact.path)
          : getLibraryPathFromName(`${lib.name}:${classifier}`, baseDir);
        if (!fs.existsSync(nativeOut)) {
          missingLibraries.push({ urls: [nativeUrl], path: nativeOut });
        }
      }
    }
  }

  if (missingLibraries.length > 0) {
    onLog?.('info', `Downloading ${missingLibraries.length} missing libraries...`);
    let libIdx = 0;
    const libWorker = async () => {
      while (libIdx < missingLibraries.length) {
        const item = missingLibraries[libIdx++];
        if (!item) break;
        if (fs.existsSync(item.path)) continue;
        let downloaded = false;
        for (const url of item.urls) {
          try {
            await ensureJarFile(url, item.path, { onLog });
            downloaded = true;
            break;
          } catch { }
        }
        if (!downloaded) {
          onLog?.('stderr', `Library download failed for ${path.basename(item.path)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(16, missingLibraries.length) }, () => libWorker()));
    onLog?.('info', 'Libraries verified.');
  }

  for (const entry of classpathLibraryEntries.values()) {
    classpathParts.push(entry.path);
  }

  const assetIndexUrl = versionJson?.assetIndex?.url || null;
  if (assetIndexUrl) {
    try {
      const assetIndexId = String(versionJson?.assetIndex?.id || versionJson?.assets || 'legacy').trim();
      const assetsBase = path.join(baseDir, 'assets');
      const indexesDir = path.join(assetsBase, 'indexes');
      const objectsDir = path.join(assetsBase, 'objects');
      await fs.promises.mkdir(indexesDir, { recursive: true });
      await fs.promises.mkdir(objectsDir, { recursive: true });
      const indexPath = path.join(indexesDir, `${assetIndexId}.json`);

      let ai = null;
      if (fs.existsSync(indexPath)) {
        try {
          ai = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
        } catch { }
      }

      if (!ai) {
        onLog?.('info', `Fetching asset index (${assetIndexId})...`);
        const aiRes = await fetch(assetIndexUrl);
        if (aiRes.ok) {
          ai = await aiRes.json();
          try {
            await fs.promises.writeFile(indexPath, JSON.stringify(ai, null, 2), 'utf8');
          } catch { }
        }
      }

      if (ai?.objects) {
        const objects = ai.objects;
        const keys = Object.keys(objects);
        const missing = [];
        for (const key of keys) {
          const hash = objects[key].hash;
          const sub = hash.slice(0, 2);
          const outDir = path.join(objectsDir, sub);
          const outPath = path.join(outDir, hash);
          if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
            missing.push({ hash, sub, outDir, outPath });
          }
        }

        if (missing.length > 0) {
          onLog?.('info', `Downloading ${missing.length} game assets...`);
          let completed = 0;
          let lastPercent = 0;
          let assetIdx = 0;
          const assetWorker = async () => {
            while (assetIdx < missing.length) {
              const item = missing[assetIdx++];
              if (!item) break;
              try {
                await fs.promises.mkdir(item.outDir, { recursive: true });
                const url = `https://resources.download.minecraft.net/${item.sub}/${item.hash}`;
                const r = await fetch(url);
                if (r.ok) {
                  await saveResponseBodyToFile(r, item.outPath);
                }
              } catch (e) { }
              completed++;
              const percent = Math.round((completed / missing.length) * 100);
              if (percent >= lastPercent + 25) {
                lastPercent = Math.floor(percent / 25) * 25;
                onLog?.('info', `Assets: ${percent}% (${completed}/${missing.length})`);
              }
              if (completed % 50 === 0 || completed === missing.length) {
                onAssetProgress?.({ total: missing.length, done: completed, percent });
              }
            }
          };
          await Promise.all(Array.from({ length: Math.min(24, missing.length) }, () => assetWorker()));
          onLog?.('info', 'Game assets ready.');
        }
      }
    } catch (e) {
      onLog?.('stderr', `Asset download warning: ${e.message}`);
    }
  }

  if (jarPath) classpathParts.push(jarPath);
  const classpath = classpathParts.join(path.delimiter);

  const mainClass = versionJson?.mainClass || (versionJson?.minecraftArguments ? 'net.minecraft.client.main.Main' : null);
  if (!mainClass) return { error: 'NoMainClass', message: 'Could not determine main class for the version.' };

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
    if (!rules || !Array.isArray(rules) || rules.length === 0) return true;
    let allow = rules.some(r => r.action === 'allow') ? false : true;
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

  if (versionJson?.arguments?.game) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === 'string') {
        let s = arg;
        for (const [k, v] of Object.entries(substitutions)) s = s.replaceAll(k, v);
        gameArgs.push(s);
      } else if (arg && typeof arg === 'object') {
        if (!rulesPass(arg.rules)) continue;
        const val = arg.value;
        if (Array.isArray(val)) {
          for (let part of val) {
            for (const [k, v] of Object.entries(substitutions)) part = part.replaceAll(k, v);
            gameArgs.push(part);
          }
        } else if (typeof val === 'string') {
          let s = val;
          for (const [k, v] of Object.entries(substitutions)) s = s.replaceAll(k, v);
          gameArgs.push(s);
        }
      }
    }
  } else if (versionJson?.minecraftArguments) {
    const parts = String(versionJson.minecraftArguments).split(' ');
    for (let p of parts) {
      for (const [k, v] of Object.entries(substitutions)) p = p.replaceAll(k, v);
      if (!gameArgs.includes(p)) gameArgs.push(p);
    }
  } else {
    gameArgs.push('--username', normalizedSession.name);
    gameArgs.push('--version', versionJson?.id || mcVer);
    gameArgs.push('--gameDir', baseDir);
    gameArgs.push('--assetsDir', path.join(baseDir, 'assets'));
    gameArgs.push('--assetIndex', versionJson?.assets || 'legacy');
    gameArgs.push('--uuid', normalizedSession.uuid);
    gameArgs.push('--accessToken', normalizedSession.accessToken);
    gameArgs.push('--userType', normalizedSession.userType);
    gameArgs.push('--versionType', versionJson?.type || 'release');
  }

  if (!gameArgs.includes('--username')) gameArgs.push('--username', normalizedSession.name);
  if (!gameArgs.includes('--version')) gameArgs.push('--version', versionJson?.id || mcVer);
  if (!gameArgs.includes('--gameDir')) gameArgs.push('--gameDir', baseDir);
  if (!gameArgs.includes('--assetsDir')) gameArgs.push('--assetsDir', path.join(baseDir, 'assets'));
  if (!gameArgs.includes('--assetIndex')) gameArgs.push('--assetIndex', String(versionJson?.assets || versionJson?.assetIndex?.id || 'legacy'));
  if (!gameArgs.includes('--uuid')) gameArgs.push('--uuid', normalizedSession.uuid);
  if (!gameArgs.includes('--accessToken')) gameArgs.push('--accessToken', normalizedSession.accessToken);
  if (!gameArgs.includes('--userType')) gameArgs.push('--userType', normalizedSession.userType);
  if (!gameArgs.includes('--versionType')) gameArgs.push('--versionType', versionJson?.type || 'release');

  if (String(mainClass).includes('net.fabricmc.loader.impl.launch.knot.KnotClient') || String(mainClass).includes('org.quiltmc.loader.impl.launch.knot.KnotClient')) {
    const fabricLoaderRoot = path.join(baseDir, 'libraries', 'net', 'fabricmc', 'fabric-loader');
    const quiltLoaderRoot = path.join(baseDir, 'libraries', 'org', 'quiltmc', 'quilt-loader');
    const loaderJar = await findFirstMatchingJar(fabricLoaderRoot, (fileName) => fileName.toLowerCase().endsWith('.jar'))
      || await findFirstMatchingJar(quiltLoaderRoot, (fileName) => fileName.toLowerCase().endsWith('.jar'));
    if (loaderJar) {
      const existingIndex = classpathParts.indexOf(loaderJar);
      if (existingIndex >= 0) classpathParts.splice(existingIndex, 1);
      classpathParts.unshift(loaderJar);
    }
  }

  const jvmArgs = [
    `-Djava.library.path=${path.join(baseDir, 'native-extract', mcVer)}`,
    `-DlibraryDirectory=${path.join(baseDir, 'libraries')}`,
    '-Xmx' + (profile?.ram || 4) + 'G',
    '--add-exports', 'java.base/jdk.internal.ref=ALL-UNNAMED',
    '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
    '--add-opens', 'java.base/sun.nio.ch=ALL-UNNAMED',
    '--add-opens', 'java.base/java.util=ALL-UNNAMED',
    '--add-opens', 'java.base/java.util.concurrent=ALL-UNNAMED',
  ];

  const jvmSubstitutions = {
    ...substitutions,
    '${natives_directory}': path.join(baseDir, 'native-extract', mcVer),
    '${launcher_name}': 'OpenLauncher',
    '${launcher_version}': '1.1.2',
    '${classpath}': classpath,
    '${classpath_separator}': path.delimiter,
    '${library_directory}': path.join(baseDir, 'libraries'),
  };

  if (versionJson?.arguments?.jvm) {
    for (const arg of versionJson.arguments.jvm) {
      if (typeof arg === 'string') {
        let s = arg;
        for (const [k, v] of Object.entries(jvmSubstitutions)) s = s.replaceAll(k, v);
        jvmArgs.push(s);
      } else if (arg && typeof arg === 'object') {
        if (!rulesPass(arg.rules)) continue;
        const val = arg.value;
        if (Array.isArray(val)) {
          for (let part of val) {
            for (const [k, v] of Object.entries(jvmSubstitutions)) part = part.replaceAll(k, v);
            jvmArgs.push(part);
          }
        } else if (typeof val === 'string') {
          let s = val;
          for (const [k, v] of Object.entries(jvmSubstitutions)) s = s.replaceAll(k, v);
          jvmArgs.push(s);
        }
      }
    }
  }

  const userArgs = [];
  if (profile?.jvmArguments) {
    const args = String(profile.jvmArguments).trim().split(/\s+/).filter(arg => arg.length > 0);
    userArgs.push(...args);
  }
  if (opts?.jvmArguments) {
    const args = String(opts.jvmArguments).trim().split(/\s+/).filter(arg => arg.length > 0);
    userArgs.push(...args);
  }

  const allCurrentArgs = [...jvmArgs, ...userArgs];
  const hasExplicitGC = allCurrentArgs.some(arg => /^-XX:\+(UseG1GC|UseZGC|UseParallelGC|UseSerialGC|UseConcMarkSweepGC|UseShenandoahGC)/i.test(arg));

  const hasUserXmx = userArgs.some(arg => arg.startsWith('-Xmx'));
  let finalJvmArgs = [...jvmArgs];
  if (hasUserXmx) {
    finalJvmArgs = jvmArgs.filter(arg => !arg.startsWith('-Xmx'));
  }

  for (const arg of userArgs) {
    if (!finalJvmArgs.includes(arg)) finalJvmArgs.push(arg);
  }
  jvmArgs.length = 0;
  jvmArgs.push(...finalJvmArgs);

  if (process.platform === 'darwin' && !jvmArgs.includes('-XstartOnFirstThread')) {
    jvmArgs.push('-XstartOnFirstThread');
  }

  let configuredJavaPath = '';
  let javaPathSource = '';

  if (profile?.javaPath && String(profile.javaPath).trim()) {
    configuredJavaPath = String(profile.javaPath).trim();
    javaPathSource = 'profile';
  } else if (opts?.javaPath && String(opts.javaPath).trim()) {
    configuredJavaPath = String(opts.javaPath).trim();
    javaPathSource = 'opts';
  } else {
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

  const requiredJavaMajor = Number(versionJson?.javaVersion?.majorVersion || 0) || null;

  async function findCompatibleJava() {
    if (requiredJavaMajor) {
      const compatibleJava = findJavaCommand(requiredJavaMajor, '');
      if (compatibleJava?.javaCmd && compatibleJava.javaMajor >= requiredJavaMajor) {
        return { javaCmd: compatibleJava.javaCmd, javaMajor: compatibleJava.javaMajor, source: 'auto-detected (compatible)' };
      }
    }
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
      return { javaCmd: bestCandidate, javaMajor: bestMajor, source: 'auto-detected (best available)' };
    }
    return { javaCmd: resolveJavaCommand(''), javaMajor: detectJavaMajor(resolveJavaCommand('')), source: 'system default' };
  }

  let finalJavaCmd = '';
  let detectedJavaMajor = null;

  if (configuredJavaPath) {
    if (fs.existsSync(configuredJavaPath)) {
      detectedJavaMajor = detectJavaMajor(configuredJavaPath);
      if (requiredJavaMajor && detectedJavaMajor && detectedJavaMajor >= requiredJavaMajor) {
        finalJavaCmd = configuredJavaPath;
        onLog?.('info', `✅ Using configured Java ${detectedJavaMajor} from ${javaPathSource} (meets requirement Java ${requiredJavaMajor}+)`);
      } else if (requiredJavaMajor && detectedJavaMajor && detectedJavaMajor < requiredJavaMajor) {
        onLog?.('warn', `⚠️ Configured Java ${detectedJavaMajor} from ${javaPathSource} does NOT meet requirement (needs ${requiredJavaMajor}+). Looking for compatible Java...`);
        const compatible = await findCompatibleJava();
        if (compatible.javaCmd && compatible.javaMajor >= requiredJavaMajor) {
          finalJavaCmd = compatible.javaCmd;
          detectedJavaMajor = compatible.javaMajor;
          onLog?.('info', `✅ Found compatible Java ${detectedJavaMajor} from ${compatible.source} (will be used instead of configured Java)`);
        } else {
          finalJavaCmd = configuredJavaPath;
          onLog?.('error', `❌ No compatible Java found. Using configured Java ${detectedJavaMajor} (may not work properly).`);
        }
      } else {
        finalJavaCmd = configuredJavaPath;
        onLog?.('info', `✅ Using configured Java ${detectedJavaMajor || '?'} from ${javaPathSource}`);
      }
    } else {
      onLog?.('warn', `⚠️ Configured Java path not found: ${configuredJavaPath}. Looking for compatible Java...`);
      const compatible = await findCompatibleJava();
      if (compatible.javaCmd) {
        finalJavaCmd = compatible.javaCmd;
        detectedJavaMajor = compatible.javaMajor;
        onLog?.('info', `✅ Using ${compatible.source} Java ${detectedJavaMajor} from ${finalJavaCmd}`);
      } else {
        finalJavaCmd = resolveJavaCommand('');
        detectedJavaMajor = detectJavaMajor(finalJavaCmd);
        onLog?.('warn', `⚠️ Using system default Java ${detectedJavaMajor || '?'} from ${finalJavaCmd}`);
      }
    }
  } else {
    const compatible = await findCompatibleJava();
    if (compatible.javaCmd) {
      finalJavaCmd = compatible.javaCmd;
      detectedJavaMajor = compatible.javaMajor;
      onLog?.('info', `✅ Using ${compatible.source} Java ${detectedJavaMajor} from ${finalJavaCmd}`);
    } else {
      finalJavaCmd = resolveJavaCommand('');
      detectedJavaMajor = detectJavaMajor(finalJavaCmd);
      onLog?.('warn', `⚠️ Using system default Java ${detectedJavaMajor || '?'} from ${finalJavaCmd}`);
    }
  }

  if (requiredJavaMajor && detectedJavaMajor && detectedJavaMajor < requiredJavaMajor) {
    onLog?.('error', `⚠️ Java ${detectedJavaMajor} is older than required ${requiredJavaMajor}. Game may not work correctly.`);
  }

  if (!hasExplicitGC) {
    let gcFlags = [];
    if (detectedJavaMajor && detectedJavaMajor >= 21) {
      gcFlags = [
        '-XX:+IgnoreUnrecognizedVMOptions',
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+UseZGC',
        '-XX:+ZGenerational'
      ];
    } else {
      // Default optimized GC flags (Aikar's G1GC) for low latency, smooth FPS, and full Java 8/17 compatibility
      gcFlags = [
        '-XX:+IgnoreUnrecognizedVMOptions',
        '-XX:+UnlockExperimentalVMOptions',
        '-XX:+UseG1GC',
        '-XX:+ParallelRefProcEnabled',
        '-XX:MaxGCPauseMillis=200',
        '-XX:+DisableExplicitGC',
        '-XX:+AlwaysPreTouch',
        '-XX:G1NewSizePercent=30',
        '-XX:G1MaxNewSizePercent=40',
        '-XX:G1ReservePercent=20',
        '-XX:G1HeapWastePercent=5',
        '-XX:G1MixedGCCountTarget=4',
        '-XX:InitiatingHeapOccupancyPercent=15',
        '-XX:G1MixedGCLiveThresholdPercent=90',
        '-XX:G1RSetUpdatingPauseTimePercent=5',
        '-XX:SurvivorRatio=32',
        '-XX:+PerfDisableSharedMem',
        '-XX:MaxTenuringThreshold=1',
      ];
    }
    for (const flag of gcFlags) {
      if (!jvmArgs.includes(flag)) jvmArgs.push(flag);
    }
  }

  let sanitizedJvmArgs = [...jvmArgs];
  if (detectedJavaMajor && detectedJavaMajor < 9) {
    const cleaned = [];
    for (let i = 0; i < sanitizedJvmArgs.length; i++) {
      const current = sanitizedJvmArgs[i];
      if (current === '--add-opens' || current === '--add-exports') {
        i++;
        continue;
      }
      cleaned.push(current);
    }
    sanitizedJvmArgs = cleaned;
  }

  const cleanedJvmArgs = [];
  for (let i = 0; i < sanitizedJvmArgs.length; i++) {
    const current = sanitizedJvmArgs[i];
    if (current === '-cp' || current === '-classpath') {
      i++;
      continue;
    }
    cleanedJvmArgs.push(current);
  }

  const args = [...cleanedJvmArgs, '-cp', classpath, mainClass, ...gameArgs];

  let child;
  try {
    child = spawn(finalJavaCmd, args, { cwd: baseDir });
  } catch (e) {
    onLog?.('error', `Failed to launch Java: ${finalJavaCmd}. Error: ${e?.message || e}. Make sure Java is installed.`);
    return { ok: false, error: 'JavaNotFound', message: `Java not found at ${finalJavaCmd}` };
  }

  runningChildren.set(child.pid, child);

  const mainWindow = getMainWindow();
  const settings = await loadLauncherState(app.getPath('userData'));
  const rawBehavior = settings?.settings?.launchBehavior;
  const launchBehavior = (rawBehavior === 'keepOpen' || rawBehavior === 'hide' || rawBehavior === 'close')
    ? rawBehavior
    : (settings?.settings?.keepOpen ? 'keepOpen' : 'hide');

  if (launchBehavior === 'close') {
    // True 0 MB Mode: Spawn lightweight native background supervisor and quit Electron completely
    const targetPid = child.pid;
    const execPath = process.execPath;
    const isDarwin = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    try {
      if (isDarwin || process.platform === 'linux') {
        const appBundlePath = isDarwin && execPath.includes('.app')
          ? `${execPath.split('.app')[0]}.app`
          : execPath;
        const launchCmd = isDarwin && execPath.includes('.app')
          ? `open "${appBundlePath}"`
          : `"${execPath}"`;
        const shScript = `while kill -0 ${targetPid} 2>/dev/null; do sleep 1; done; ${launchCmd}`;
        const supervisor = spawn('/bin/sh', ['-c', shScript], {
          detached: true,
          stdio: 'ignore',
        });
        supervisor.unref();
      } else if (isWin) {
        const escapedPath = execPath.replace(/'/g, "''");
        const psScript = `while (Get-Process -Id ${targetPid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 1 }; Start-Process -FilePath '${escapedPath}'`;
        const supervisor = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psScript], {
          detached: true,
          stdio: 'ignore',
        });
        supervisor.unref();
      }

      setTimeout(() => {
        app.exit(0);
      }, 500);
    } catch (e) {
      try { mainWindow?.hide(); } catch (err) {}
    }
  } else if (launchBehavior === 'hide' && mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.hide();
      mainWindow.webContents.setAudioMuted(true);
      mainWindow.webContents.setBackgroundThrottling(true);
      if (typeof global.gc === 'function') {
        try { global.gc(); } catch (e) { }
      }
      try {
        mainWindow.webContents.session.clearCache();
      } catch (e) { }
    } catch (e) { }
  }

  child.on('error', (err) => {
    onLog?.('error', `Java process error: ${err?.message || err}. Make sure Java is installed and accessible.`);
    runningChildren.delete(child.pid);
    onExit?.({ code: -1 });
  });

  let processOutput = '';

  child.stdout.on('data', chunk => {
    const text = String(chunk);
    processOutput += text;
    onLog?.('stdout', text);
  });
  child.stderr.on('data', chunk => {
    const text = String(chunk);
    processOutput += text;
    onLog?.('stderr', text);
  });
  child.on('close', async code => {
    runningChildren.delete(child.pid);
    onExit?.({ code });

    if (code !== 0) {
      const conflict = parseFabricModConflict(processOutput);
      if (conflict) {
        onConflict?.(conflict);
      }
    }

    if (!runningChildren.size && mainWindow && mainWindow.isDestroyed?.() === false) {
      const currentSettings = await loadLauncherState(app.getPath('userData'));
      const currentBehavior = currentSettings?.settings?.launchBehavior || (currentSettings?.settings?.keepOpen ? 'keepOpen' : 'hide');
      if (currentBehavior === 'hide') {
        try {
          mainWindow.webContents.setBackgroundThrottling(false);
          mainWindow.webContents.setAudioMuted(false);
          mainWindow.show();
          mainWindow.focus();
        } catch (e) { }
      }
    }
  });

  return { ok: true, pid: child.pid };
}

export function stopMinecraft(pid) {
  const child = runningChildren.get(pid);
  if (!child) return { error: 'NotFound', message: `No running process with pid ${pid}` };
  try {
    child.kill('SIGTERM');
    runningChildren.delete(pid);
    return { ok: true };
  } catch (e) {
    return { error: 'KillFailed', message: e?.message || String(e) };
  }
}
