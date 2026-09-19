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

/**
 * Search mods on Modrinth with optional gameVersion, loader, and categories filters.
 */
export async function searchModrinthMods({
  query = '',
  loader = '',
  gameVersion = '',
  category = '',
  sortBy = 'relevance', // 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
  offset = 0,
  limit = 20,
} = {}) {
  const facets = [['project_type:mod']];

  if (loader && loader.toLowerCase() !== 'all' && loader.toLowerCase() !== 'vanilla') {
    facets.push([`categories:${loader.toLowerCase()}`]);
  }

  if (gameVersion && gameVersion.toLowerCase() !== 'all') {
    facets.push([`versions:${gameVersion}`]);
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
  if (gameVersions.length > 0) {
    params.set('game_versions', JSON.stringify(gameVersions));
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
  return fetchModrinth('/version_files/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hashes,
      algorithm,
      loaders: loaders.filter(Boolean),
      game_versions: gameVersions.filter(Boolean),
    }),
  });
}

