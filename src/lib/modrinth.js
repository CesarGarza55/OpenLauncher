const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const USER_AGENT = 'CesarGarza55/OpenLauncher/1.0.2 (support@codevbox.com)';

async function fetchModrinth(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${MODRINTH_API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Modrinth API error ${res.status}: ${errorText || res.statusText}`);
  }

  return res.json();
}

export function cleanMinecraftVersion(version) {
  if (!version) return '';
  const str = String(version).trim();
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

/**
 * Search projects on Modrinth (mods, shaders, resourcepacks) with optional gameVersion, loader, and categories filters.
 */
export async function searchModrinthProjects({
  projectType = 'mod', // 'mod' | 'shader' | 'resourcepack'
  query = '',
  loader = '',
  gameVersion = '',
  category = '',
  sortBy = 'relevance', // 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  offset = 0,
  limit = 20,
} = {}) {
  const typeStr = projectType === 'shader' ? 'shader' : projectType === 'resourcepack' ? 'resourcepack' : 'mod';
  const facets = [[`project_type:${typeStr}`]];

  if (typeStr === 'mod') {
    if (loader && loader.toLowerCase() !== 'all' && loader.toLowerCase() !== 'vanilla') {
      facets.push([`categories:${loader.toLowerCase()}`]);
    }
  }

  const cleanGameVer = cleanMinecraftVersion(gameVersion);
  if (cleanGameVer) {
    facets.push([`versions:${cleanGameVer}`]);
  }

  if (category && category.toLowerCase() !== 'all') {
    facets.push([`categories:${category.toLowerCase()}`]);
  }

  const params = new URLSearchParams({
    query: String(query || '').trim(),
    index: sortBy,
    offset: String(offset),
    limit: String(limit),
    facets: JSON.stringify(facets),
  });

  return fetchModrinth(`/search?${params.toString()}`);
}

// Backward-compatible alias
export const searchModrinthMods = searchModrinthProjects;

/**
 * Get project details by ID or slug.
 */
export async function getModrinthProject(idOrSlug) {
  return fetchModrinth(`/project/${encodeURIComponent(idOrSlug)}`);
}

/**
 * Get versions list for a project, optionally filtered by loader and game version.
 */
export async function getModrinthProjectVersions({
  idOrSlug,
  loaders = [],
  gameVersions = [],
} = {}) {
  const params = new URLSearchParams();
  if (loaders.length > 0) {
    params.set('loaders', JSON.stringify(loaders));
  }
  const cleanGameVersions = (gameVersions || []).map(cleanMinecraftVersion).filter(Boolean);
  if (cleanGameVersions.length > 0) {
    params.set('game_versions', JSON.stringify(cleanGameVersions));
  }

  const queryStr = params.toString();
  return fetchModrinth(`/project/${encodeURIComponent(idOrSlug)}/version${queryStr ? `?${queryStr}` : ''}`);
}

/**
 * Get specific version details.
 */
export async function getModrinthVersion(versionId) {
  return fetchModrinth(`/version/${encodeURIComponent(versionId)}`);
}

/**
 * Check updates for multiple mod files by their hashes.
 */
export async function checkModrinthVersionFilesUpdate({
  hashes = [],
  algorithm = 'sha512',
  loaders = [],
  gameVersions = [],
} = {}) {
  if (!hashes || hashes.length === 0) return {};
  const cleanGameVersions = (gameVersions || []).map(cleanMinecraftVersion).filter(Boolean);
  return fetchModrinth('/version_files/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hashes,
      algorithm,
      loaders: loaders.filter(Boolean),
      game_versions: cleanGameVersions,
    }),
  });
}

