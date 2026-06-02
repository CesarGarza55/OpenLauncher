export const VERSION_CATALOG = [];

export const INSTALL_TARGETS = {
  minecraft: { title: 'Install Minecraft', versions: [] },
  fabric: {
    title: 'Install Fabric',
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
};

const MOJANG_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const FABRIC_GAME_URL = 'https://meta.fabricmc.net/v2/versions/game';
const FABRIC_LOADER_URL = 'https://meta.fabricmc.net/v2/versions/loader';
const FORGE_PROMOTIONS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

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
    label: `fabric-loader-${entry.loaderVersion} - ${entry.gameVersion}`,
    type: 'fabric',
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

function buildFabricInstallTargets(gameVersions, loaderResponses) {
  const loadersByGameVersion = {};
  const comboLabels = [];

  loaderResponses.forEach((loaderResponse, index) => {
    const gameVersion = gameVersions[index];
    const loaderVersions = parseFabricLoaderEntries(loaderResponse);

    loadersByGameVersion[gameVersion] = uniqueBy(loaderVersions.map(entry => entry.loaderVersion), value => value);

    for (const loaderVersion of loadersByGameVersion[gameVersion]) {
      comboLabels.push(`Fabric ${loaderVersion} - ${gameVersion}`);
    }
  });

  return {
    title: 'Install Fabric',
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

function buildInstallTargets(versions) {
  const minecraftVersions = versions.filter(version => version.type === 'vanilla' || version.type === 'snapshot');
  const fabricVersions = versions.filter(version => version.type === 'fabric');
  const forgeVersions = versions.filter(version => version.type === 'forge');

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
    forge: {
      title: 'Install Forge',
      versions: uniqueBy(forgeVersions.map(version => version.label).filter(Boolean), value => value),
    },
  };
}

export async function loadLauncherCatalog({ includeSnapshots = false } = {}) {
  try {
    const [vanillaManifest, fabricGameVersions, fabricGlobalLoaders, forgePromotions] = await Promise.all([
      fetchJson(MOJANG_MANIFEST_URL),
      fetchJson(FABRIC_GAME_URL),
      fetchJson(FABRIC_LOADER_URL),
      fetchJson(FORGE_PROMOTIONS_URL),
    ]);

    const vanillaVersions = sortVersionEntriesDescending(
      (vanillaManifest?.versions || [])
        .filter(version => version && (version.type === 'release' || (includeSnapshots && version.type === 'snapshot')))
        .map(normalizeVanillaVersion),
    );

    const vanillaReleaseSet = new Set(vanillaVersions.map(version => version.mcVer));

    const fabricGameVersionList = uniqueBy((fabricGameVersions || [])
      .filter(entry => entry?.version && entry.version !== '0.0.0')
      .filter(entry => includeSnapshots || entry?.stable)
      .filter(entry => vanillaReleaseSet.has(entry.version))
      .map(entry => entry.version), value => value);

    const globalFabricLoaderEntries = parseFabricLoaderEntries(fabricGlobalLoaders);

    const fabricLoaderResponses = await Promise.all(
      fabricGameVersionList.map(async (gameVersion) => {
        try {
          return await fetchJson(`${FABRIC_LOADER_URL}/${gameVersion}`);
        } catch {
          return globalFabricLoaderEntries;
        }
      })
    );

    const fabricVersions = uniqueBy(
      fabricLoaderResponses.flatMap((loaderResponse, index) => {
        const gameVersion = fabricGameVersionList[index];
        const parsedLoaders = parseFabricLoaderEntries(loaderResponse);
        const stableLoader = parsedLoaders.find(entry => entry.stable)
          || parsedLoaders[0];

        if (!stableLoader) {
          return [];
        }

        return [normalizeFabricVersion({
          gameVersion,
          loaderVersion: stableLoader.loaderVersion,
          stable: stableLoader.stable,
        })];
      }),
      version => version.id,
    );

    const fabricInstallTargets = buildFabricInstallTargets(fabricGameVersionList, fabricLoaderResponses);

    const forgeVersions = uniqueBy(
      Object.entries(forgePromotions?.promos || {})
        .filter(([key]) => key.endsWith('-recommended') || key.endsWith('-latest'))
        .map(([key, forgeVersion]) => {
          const mcVersion = key.replace(/-(recommended|latest)$/, '');
          return normalizeForgeVersion(mcVersion, forgeVersion);
        }),
      version => version.id,
    );

    const versions = uniqueBy(
      [...vanillaVersions, ...fabricVersions, ...forgeVersions],
      version => version.id,
    );

    const forgeInstallTargets = buildForgeInstallTargets(forgePromotions);

    return {
      versions,
      installTargets: {
        ...buildInstallTargets(versions),
        fabric: {
          ...fabricInstallTargets,
          versions: uniqueBy(fabricVersions.map(version => version.label).filter(Boolean), value => value),
        },
        forge: forgeInstallTargets,
      },
      latest: {
        minecraft: includeSnapshots
          ? (vanillaManifest?.latest?.snapshot ?? vanillaManifest?.latest?.release ?? versions.find(version => version.type === 'vanilla')?.mcVer ?? 'unknown')
          : (vanillaManifest?.latest?.release ?? versions.find(version => version.type === 'vanilla')?.mcVer ?? 'unknown'),
      },
    };
  } catch {
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

export function getVersionById(versionId, catalog = VERSION_CATALOG) {
  return catalog.find(version => version.id === versionId) || null;
}

export function getInstallInfo(type, installTargets = INSTALL_TARGETS) {
  return installTargets[type] || installTargets.minecraft;
}

export async function install({ type, version, profileKey, gameVersion, loaderVersion } = {}) {
  // Prefer calling the Electron main process via the preload bridge.
  if (typeof window !== 'undefined' && window.launcher && typeof window.launcher.minecraftInstall === 'function') {
    return await window.launcher.minecraftInstall({ type, version, profileKey, gameVersion, loaderVersion });
  }

  throw new Error('Installer not available: must run inside Electron with launcher.minecraftInstall exposed.');
}

export async function run(options = {}) {
  // options should match the expected run contract (username, uuid, token, jvmArguments, etc.)
  if (typeof window !== 'undefined' && window.launcher && typeof window.launcher.minecraftRun === 'function') {
    return await window.launcher.minecraftRun(options);
  }

  throw new Error('Runner not available: must run inside Electron with launcher.minecraftRun exposed.');
}