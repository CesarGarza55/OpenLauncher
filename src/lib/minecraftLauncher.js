export const VERSION_CATALOG = [];

export const INSTALL_TARGETS = {
  minecraft: { title: 'Install Minecraft', versions: [] },
  fabric: {
    title: 'Install Fabric',
    versions: [],
    gameVersions: [],
    loadersByGameVersion: {},
  },
  quilt: {
    title: 'Install Quilt',
    versions: [],
    gameVersions: [],
    loadersByGameVersion: {},
  },
  forge: {
    title: 'Install Forge',
    versions: [],
    gameVersions: [],
    loadersByGameVersion: {},
  },
  neoforge: {
    title: 'Install NeoForge',
    versions: [],
    gameVersions: [],
    loadersByGameVersion: {},
  },
};

const MOJANG_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_GAME_URL = 'https://meta.fabricmc.net/v2/versions/game';
const FABRIC_LOADER_URL = 'https://meta.fabricmc.net/v2/versions/loader';
const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const QUILT_GAME_URL = 'https://meta.quiltmc.org/v3/versions/game';
const QUILT_LOADER_URL = 'https://meta.quiltmc.org/v3/versions/loader';
const NEOFORGE_MAVEN_DETAILS_URL = 'https://maven.neoforged.net/api/maven/details/releases/net/neoforged/neoforge';

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function tokenizeVersion(value) {
  return String(value || '').match(/\d+|[A-Za-z]+/g) || [String(value || '')];
}

function compareVersionStringsDescending(left, right) {
  const leftTokens = tokenizeVersion(left);
  const rightTokens = tokenizeVersion(right);
  const maxLength = Math.max(leftTokens.length, rightTokens.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];

    if (leftToken === undefined) return 1;
    if (rightToken === undefined) return -1;

    const leftNumber = Number(leftToken);
    const rightNumber = Number(rightToken);
    const leftIsNumber = Number.isFinite(leftNumber) && String(leftNumber) === leftToken;
    const rightIsNumber = Number.isFinite(rightNumber) && String(rightNumber) === rightToken;

    if (leftIsNumber && rightIsNumber) {
      if (leftNumber !== rightNumber) return rightNumber - leftNumber;
      continue;
    }

    if (leftIsNumber !== rightIsNumber) {
      return leftIsNumber ? -1 : 1;
    }

    const comparison = String(rightToken).localeCompare(String(leftToken), undefined, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) return comparison;
  }

  return 0;
}

function sortVersionsDescending(values) {
  return [...values].sort(compareVersionStringsDescending);
}

function compareVersionEntriesByReleaseTimeDescending(left, right) {
  const leftTime = Date.parse(left?.releaseTime || '');
  const rightTime = Date.parse(right?.releaseTime || '');
  const leftHasTime = Number.isFinite(leftTime);
  const rightHasTime = Number.isFinite(rightTime);

  if (leftHasTime && rightHasTime && leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  if (leftHasTime !== rightHasTime) {
    return leftHasTime ? -1 : 1;
  }

  return compareVersionStringsDescending(String(left?.id || left?.label || ''), String(right?.id || right?.label || ''));
}

function sortVersionEntriesDescending(values) {
  return [...values].sort(compareVersionEntriesByReleaseTimeDescending);
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeVanillaVersion(entry) {
  const isSnapshot = entry.type === 'snapshot';
  return {
    id: `${isSnapshot ? 'snapshot' : 'vanilla'}-${entry.id}`,
    label: `${isSnapshot ? 'Snapshot' : 'Vanilla'} - ${entry.id}`,
    type: isSnapshot ? 'snapshot' : 'vanilla',
    mcVer: entry.id,
    releaseTime: entry.releaseTime,
  };
}

function normalizeFabricVersion(entry) {
  return {
    id: `fabric-loader-${entry.loaderVersion}-${entry.gameVersion}`,
    label: `Fabric ${entry.loaderVersion} - ${entry.gameVersion}`,
    type: 'fabric',
    mcVer: entry.gameVersion,
    loaderVersion: entry.loaderVersion,
    stable: Boolean(entry.stable),
  };
}

function normalizeQuiltVersion(entry) {
  return {
    id: `quilt-loader-${entry.loaderVersion}-${entry.gameVersion}`,
    label: `Quilt ${entry.loaderVersion} - ${entry.gameVersion}`,
    type: 'quilt',
    mcVer: entry.gameVersion,
    loaderVersion: entry.loaderVersion,
    stable: Boolean(entry.stable),
  };
}

function normalizeForgeVersion(mcVersion, forgeVersion) {
  return {
    id: `forge-${forgeVersion}-${mcVersion}`,
    label: `Forge ${forgeVersion} - ${mcVersion}`,
    type: 'forge',
    mcVer: mcVersion,
    forgeVersion,
  };
}

function normalizeNeoForgeVersion(mcVersion, neoVersion) {
  return {
    id: `neoforge-${neoVersion}`,
    label: `NeoForge ${neoVersion} - ${mcVersion}`,
    type: 'neoforge',
    mcVer: mcVersion,
    loaderVersion: neoVersion,
  };
}

function parseFabricLoaderEntries(loaderResponse) {
  return uniqueBy(
    (Array.isArray(loaderResponse) ? loaderResponse : [])
      .map(entry => {
        if (entry?.loader?.version) {
          return {
            loaderVersion: String(entry.loader.version),
            stable: Boolean(entry.stable),
          };
        }

        if (entry?.version) {
          return {
            loaderVersion: String(entry.version),
            stable: Boolean(entry.stable),
          };
        }

        return null;
      })
      .filter(Boolean),
    entry => entry.loaderVersion,
  );
}

function parseQuiltLoaderEntries(loaderResponse) {
  return uniqueBy(
    (Array.isArray(loaderResponse) ? loaderResponse : [])
      .map(entry => {
        if (entry?.version) {
          const verStr = String(entry.version);
          return {
            loaderVersion: verStr,
            stable: !verStr.includes('beta') && !verStr.includes('alpha'),
          };
        }
        return null;
      })
      .filter(Boolean),
    entry => entry.loaderVersion,
  );
}

function buildFabricInstallTargets(gameVersions, globalLoaders) {
  const loaderVersions = parseFabricLoaderEntries(globalLoaders).map(entry => entry.loaderVersion);
  const loadersByGameVersion = {};
  const comboLabels = [];

  for (const gameVersion of gameVersions) {
    loadersByGameVersion[gameVersion] = loaderVersions;
    for (const loaderVersion of loaderVersions) {
      comboLabels.push(`Fabric ${loaderVersion} - ${gameVersion}`);
    }
  }

  return {
    title: 'Install Fabric',
    versions: uniqueBy(comboLabels, value => value),
    gameVersions: uniqueBy(gameVersions.filter(Boolean), value => value),
    loadersByGameVersion,
  };
}

function buildQuiltInstallTargets(gameVersions, globalLoaders) {
  const loaderVersions = parseQuiltLoaderEntries(globalLoaders).map(entry => entry.loaderVersion);
  const loadersByGameVersion = {};
  const comboLabels = [];

  for (const gameVersion of gameVersions) {
    loadersByGameVersion[gameVersion] = loaderVersions;
    for (const loaderVersion of loaderVersions) {
      comboLabels.push(`Quilt ${loaderVersion} - ${gameVersion}`);
    }
  }

  return {
    title: 'Install Quilt',
    versions: uniqueBy(comboLabels, value => value),
    gameVersions: uniqueBy(gameVersions.filter(Boolean), value => value),
    loadersByGameVersion,
  };
}

function buildForgeInstallTargets(forgePromotions) {
  const loadersByGameVersion = {};
  const comboLabels = [];

  Object.entries(forgePromotions?.promos || {})
    .filter(([key]) => key.endsWith('-recommended') || key.endsWith('-latest'))
    .forEach(([key, forgeVersion]) => {
      const gameVersion = key.replace(/-(recommended|latest)$/, '');
      if (!loadersByGameVersion[gameVersion]) {
        loadersByGameVersion[gameVersion] = [];
      }
      if (!loadersByGameVersion[gameVersion].includes(forgeVersion)) {
        loadersByGameVersion[gameVersion].push(forgeVersion);
      }
      comboLabels.push(`Forge ${forgeVersion} - ${gameVersion}`);
    });

  for (const gameVersion of Object.keys(loadersByGameVersion)) {
    loadersByGameVersion[gameVersion] = sortVersionsDescending(uniqueBy(loadersByGameVersion[gameVersion], value => value));
  }

  return {
    title: 'Install Forge',
    versions: uniqueBy(comboLabels, value => value),
    gameVersions: sortVersionsDescending(uniqueBy(Object.keys(loadersByGameVersion), value => value)),
    loadersByGameVersion,
  };
}

function buildNeoForgeInstallTargets(neoForgeDetails) {
  const rawVersions = Array.isArray(neoForgeDetails?.files)
    ? neoForgeDetails.files.filter(f => f.type === 'DIRECTORY').map(f => f.name)
    : [];
  const loadersByGameVersion = {};
  const comboLabels = [];

  for (const v of rawVersions) {
    const m = v.match(/^(\d+)\.(\d+)(?:\.|$)/);
    if (!m) continue;
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2], 10);
    let mcVer;
    if (major >= 20 && major <= 25) {
      mcVer = `1.${major}.${minor}`;
    } else {
      mcVer = `${major}.${minor}`;
    }
    if (!loadersByGameVersion[mcVer]) loadersByGameVersion[mcVer] = [];
    loadersByGameVersion[mcVer].push(v);
    comboLabels.push(`NeoForge ${v} - ${mcVer}`);
  }

  for (const gameVersion of Object.keys(loadersByGameVersion)) {
    loadersByGameVersion[gameVersion] = sortVersionsDescending(uniqueBy(loadersByGameVersion[gameVersion], value => value));
  }

  const sortedGameVersions = sortVersionsDescending(uniqueBy(Object.keys(loadersByGameVersion), value => value));

  return {
    title: 'Install NeoForge',
    versions: uniqueBy(comboLabels, value => value),
    gameVersions: sortedGameVersions,
    loadersByGameVersion,
  };
}

function buildInstallTargets(versions) {
  const minecraftVersions = versions.filter(version => version.type === 'vanilla' || version.type === 'snapshot');
  const fabricVersions = versions.filter(version => version.type === 'fabric');
  const quiltVersions = versions.filter(version => version.type === 'quilt');
  const forgeVersions = versions.filter(version => version.type === 'forge');
  const neoforgeVersions = versions.filter(version => version.type === 'neoforge');

  return {
    minecraft: {
      title: 'Install Minecraft',
      versions: uniqueBy(sortVersionEntriesDescending(minecraftVersions).map(version => version.mcVer), value => value),
    },
    fabric: {
      title: 'Install Fabric',
      versions: sortVersionsDescending(uniqueBy(fabricVersions.map(version => version.mcVer).filter(Boolean), value => value)),
      gameVersions: sortVersionsDescending(uniqueBy(fabricVersions.map(version => version.mcVer).filter(Boolean), value => value)),
      loadersByGameVersion: {},
    },
    quilt: {
      title: 'Install Quilt',
      versions: sortVersionsDescending(uniqueBy(quiltVersions.map(version => version.mcVer).filter(Boolean), value => value)),
      gameVersions: sortVersionsDescending(uniqueBy(quiltVersions.map(version => version.mcVer).filter(Boolean), value => value)),
      loadersByGameVersion: {},
    },
    forge: {
      title: 'Install Forge',
      versions: uniqueBy(forgeVersions.map(version => version.label).filter(Boolean), value => value),
    },
    neoforge: {
      title: 'Install NeoForge',
      versions: uniqueBy(neoforgeVersions.map(version => version.label).filter(Boolean), value => value),
    },
  };
}

export async function loadLauncherCatalog({ includeSnapshots = false } = {}) {
  // If running in renderer with Electron bridge available, prefer IPC to avoid CORS on Forge/Mojang
  if (typeof window !== 'undefined' && window.launcher && typeof window.launcher.minecraftGetCatalog === 'function') {
    try {
      const catalog = await window.launcher.minecraftGetCatalog({ includeSnapshots });
      if (catalog && Array.isArray(catalog.versions) && catalog.versions.length > 0) {
        return catalog;
      }
    } catch (e) {
      console.warn('IPC catalog fetch failed, falling back to direct fetch:', e);
    }
  }

  try {
    const [
      vanillaResult,
      fabricGameResult,
      fabricLoaderResult,
      forgeResult,
      quiltGameResult,
      quiltLoaderResult,
      neoForgeResult,
    ] = await Promise.allSettled([
      fetchJson(MOJANG_MANIFEST_URL),
      fetchJson(FABRIC_GAME_URL),
      fetchJson(FABRIC_LOADER_URL),
      fetchJson(FORGE_PROMOTIONS_URL),
      fetchJson(QUILT_GAME_URL),
      fetchJson(QUILT_LOADER_URL),
      fetchJson(NEOFORGE_MAVEN_DETAILS_URL),
    ]);

    const vanillaManifest = vanillaResult.status === 'fulfilled' ? vanillaResult.value : null;
    const fabricGameVersions = fabricGameResult.status === 'fulfilled' ? fabricGameResult.value : null;
    const fabricGlobalLoaders = fabricLoaderResult.status === 'fulfilled' ? fabricLoaderResult.value : null;
    const forgePromotions = forgeResult.status === 'fulfilled' ? forgeResult.value : null;
    const quiltGameVersions = quiltGameResult.status === 'fulfilled' ? quiltGameResult.value : null;
    const quiltGlobalLoaders = quiltLoaderResult.status === 'fulfilled' ? quiltLoaderResult.value : null;
    const neoForgeDetails = neoForgeResult.status === 'fulfilled' ? neoForgeResult.value : null;

    const vanillaVersions = sortVersionEntriesDescending(
      (vanillaManifest?.versions || [])
        .filter(version => version && (version.type === 'release' || (includeSnapshots && version.type === 'snapshot')))
        .map(normalizeVanillaVersion),
    );

    const vanillaReleaseSet = new Set(vanillaVersions.map(version => version.mcVer));

    const fabricGameVersionList = uniqueBy((fabricGameVersions || [])
      .filter(entry => entry?.version && entry.version !== '0.0.0')
      .filter(entry => includeSnapshots || entry?.stable)
      .filter(entry => vanillaReleaseSet.size === 0 || vanillaReleaseSet.has(entry.version))
      .map(entry => entry.version), value => value);

    const globalFabricLoaderEntries = parseFabricLoaderEntries(fabricGlobalLoaders);

    const fabricVersions = uniqueBy(
      fabricGameVersionList.flatMap(gameVersion => {
        const stableLoader = globalFabricLoaderEntries.find(entry => entry.stable) || globalFabricLoaderEntries[0];
        if (!stableLoader) return [];
        return [normalizeFabricVersion({
          gameVersion,
          loaderVersion: stableLoader.loaderVersion,
          stable: stableLoader.stable,
        })];
      }),
      version => version.id,
    );

    const fabricInstallTargets = buildFabricInstallTargets(fabricGameVersionList, fabricGlobalLoaders);

    // Quilt versions & targets
    const quiltGameVersionList = uniqueBy((quiltGameVersions || [])
      .filter(entry => entry?.version && entry.version !== '0.0.0')
      .filter(entry => includeSnapshots || entry?.stable)
      .filter(entry => vanillaReleaseSet.size === 0 || vanillaReleaseSet.has(entry.version))
      .map(entry => entry.version), value => value);

    const globalQuiltLoaderEntries = parseQuiltLoaderEntries(quiltGlobalLoaders);

    const quiltVersions = uniqueBy(
      quiltGameVersionList.flatMap(gameVersion => {
        const stableLoader = globalQuiltLoaderEntries.find(entry => entry.stable) || globalQuiltLoaderEntries[0];
        if (!stableLoader) return [];
        return [normalizeQuiltVersion({
          gameVersion,
          loaderVersion: stableLoader.loaderVersion,
          stable: stableLoader.stable,
        })];
      }),
      version => version.id,
    );

    const quiltInstallTargets = buildQuiltInstallTargets(quiltGameVersionList, quiltGlobalLoaders);

    // Forge versions & targets
    const forgeVersions = uniqueBy(
      Object.entries(forgePromotions?.promos || {})
        .filter(([key]) => key.endsWith('-recommended') || key.endsWith('-latest'))
        .map(([key, forgeVersion]) => {
          const mcVersion = key.replace(/-(recommended|latest)$/, '');
          return normalizeForgeVersion(mcVersion, forgeVersion);
        }),
      version => version.id,
    );

    const forgeInstallTargets = buildForgeInstallTargets(forgePromotions);

    // NeoForge versions & targets
    const neoForgeInstallTargets = buildNeoForgeInstallTargets(neoForgeDetails);

    const neoForgeVersions = uniqueBy(
      Object.entries(neoForgeInstallTargets.loadersByGameVersion || {}).flatMap(([mcVersion, loaders]) => {
        const latestLoader = loaders[0];
        if (!latestLoader) return [];
        return [normalizeNeoForgeVersion(mcVersion, latestLoader)];
      }),
      version => version.id,
    );

    const versions = uniqueBy(
      [...vanillaVersions, ...fabricVersions, ...quiltVersions, ...forgeVersions, ...neoForgeVersions],
      version => version.id,
    );

    return {
      versions,
      installTargets: {
        ...buildInstallTargets(versions),
        fabric: {
          ...fabricInstallTargets,
          versions: uniqueBy(fabricVersions.map(version => version.label).filter(Boolean), value => value),
        },
        quilt: {
          ...quiltInstallTargets,
          versions: uniqueBy(quiltVersions.map(version => version.label).filter(Boolean), value => value),
        },
        forge: forgeInstallTargets,
        neoforge: {
          ...neoForgeInstallTargets,
          versions: uniqueBy(neoForgeVersions.map(version => version.label).filter(Boolean), value => value),
        },
      },
      latest: {
        minecraft: includeSnapshots
          ? (vanillaManifest?.latest?.snapshot ?? vanillaManifest?.latest?.release ?? versions.find(version => version.type === 'vanilla')?.mcVer ?? 'unknown')
          : (vanillaManifest?.latest?.release ?? versions.find(version => version.type === 'vanilla')?.mcVer ?? 'unknown'),
      },
    };
  } catch (error) {
    console.error('Failed to load launcher catalog:', error);
    return {
      versions: VERSION_CATALOG,
      installTargets: INSTALL_TARGETS,
      latest: { minecraft: 'unknown' },
    };
  }
}

export function formatClock(date = new Date()) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map(value => String(value).padStart(2, '0'))
    .join(':');
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

export function formatVersionLabel(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const clean = resolveMinecraftVersion(v);
    if (v.includes('fabric')) return `Fabric ${clean || v}`;
    if (v.includes('neoforge')) return `NeoForge ${clean || v}`;
    if (v.includes('forge')) return `Forge ${clean || v}`;
    if (v.includes('quilt')) return `Quilt ${clean || v}`;
    return `Minecraft ${clean || v}`;
  }
  let label = String(v.label || '').trim();
  const id = String(v.id || '').trim();
  const type = String(v.type || '').toLowerCase();
  const mcVer = resolveMinecraftVersion(v.inheritsFrom || v.mcVer || id);

  if (!label || label === id || label.startsWith('fabric-loader-') || label.startsWith('quilt-loader-') || label === mcVer) {
    if (type.includes('fabric') || id.includes('fabric')) {
      const loaderVer = v.loaderVersion || id.match(/fabric-loader-([^\s-]+)/i)?.[1] || '';
      return loaderVer && mcVer ? `Fabric ${loaderVer} - ${mcVer}` : `Fabric ${mcVer || id}`;
    }
    if (type.includes('neoforge') || id.includes('neoforge')) {
      const loaderVer = v.loaderVersion || id.match(/(?:^|\b|-)neoforge-([^\s-]+)/i)?.[1] || '';
      return loaderVer && mcVer ? `NeoForge ${loaderVer} - ${mcVer}` : `NeoForge ${mcVer || id}`;
    }
    if (type.includes('forge') || id.includes('forge')) {
      const loaderVer = v.loaderVersion || id.match(/(?:^|\b|-)forge-([^\s-]+)/i)?.[1] || '';
      return loaderVer && mcVer ? `Forge ${loaderVer} - ${mcVer}` : `Forge ${mcVer || id}`;
    }
    if (type.includes('quilt') || id.includes('quilt')) {
      const loaderVer = v.loaderVersion || id.match(/quilt-loader-([^\s-]+)/i)?.[1] || '';
      return loaderVer && mcVer ? `Quilt ${loaderVer} - ${mcVer}` : `Quilt ${mcVer || id}`;
    }
    return `Minecraft ${mcVer || id}`;
  }

  return label;
}

export function getVersionById(versionId, catalog = VERSION_CATALOG) {
  return catalog.find(version => version.id === versionId) || null;
}

export function getInstallInfo(type, installTargets = INSTALL_TARGETS) {
  return installTargets[type] || installTargets.minecraft;
}

export async function install({ type, version, profileKey, gameVersion, loaderVersion } = {}) {
  // Prefer calling the Electron main process via the preload bridge.
  if (typeof window !== 'undefined' && window.launcher) {
    if (typeof window.launcher.minecraftInstall === 'function') {
      return await window.launcher.minecraftInstall({ type, version, profileKey, gameVersion, loaderVersion });
    }
    if (typeof window.launcher.invoke === 'function') {
      return await window.launcher.invoke('minecraft:install', { type, version, profileKey, gameVersion, loaderVersion });
    }
  }

  throw new Error('Installer not available: must run inside Electron with launcher.minecraftInstall exposed.');
}

export async function run(options = {}) {
  // options should match the expected run contract (username, uuid, token, jvmArguments, etc.)
  if (typeof window !== 'undefined' && window.launcher) {
    if (typeof window.launcher.minecraftRun === 'function') {
      return await window.launcher.minecraftRun(options);
    }
    if (typeof window.launcher.invoke === 'function') {
      return await window.launcher.invoke('minecraft:run', options);
    }
  }

  throw new Error('Runner not available: must run inside Electron with launcher.minecraftRun exposed.');
}