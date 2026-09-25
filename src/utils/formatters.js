export function createOfflineSession(name) {
  return {
    name,
    username: name,
    userType: 'legacy',
  };
}

export function getMcHeadsAvatarUrl(username, size = 256) {
  const resolvedUsername = String(username || '').trim();
  if (!resolvedUsername || resolvedUsername.toLowerCase() === 'steve' || resolvedUsername.toLowerCase() === 'player') {
    return `https://minotar.net/avatar/MHF_Steve/${size}`;
  }

  return `https://minotar.net/avatar/${encodeURIComponent(resolvedUsername)}/${size}`;
}

export function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (!text || text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${clipped}…`;
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.round((now - date) / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function findModInList(mods = [], targetId = '', displayName = '') {
  if (!Array.isArray(mods) || !targetId) return null;
  const cleanId = String(targetId).toLowerCase().trim();
  const cleanName = displayName ? String(displayName).toLowerCase().trim() : '';

  // 1. Exact match on internal modId (from jar metadata)
  const exactModId = mods.find(m => m.modId && String(m.modId).toLowerCase().trim() === cleanId);
  if (exactModId) return exactModId;

  // 2. Exact match on mod display name
  if (cleanName) {
    const exactName = mods.find(m => m.name && String(m.name).toLowerCase().trim() === cleanName);
    if (exactName) return exactName;
  }

  // 3. Exact filename prefix match (excluding companion mods like -extra)
  return mods.find(m => {
    const fn = String(m.fileName || m.id || '').toLowerCase();
    if (cleanId === 'sodium' && (fn.includes('extra') || fn.includes('reeses') || fn.includes('options'))) {
      return false;
    }
    if (fn === `${cleanId}.jar` || fn === `${cleanId}.olpkg`) return true;
    const prefixRegex = new RegExp(`^${cleanId}(?:[-_+v0-9.mc]|fabric|neoforge|forge)`, 'i');
    return prefixRegex.test(fn);
  }) || null;
}
