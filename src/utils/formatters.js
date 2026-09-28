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

export function extractTextComponent(component) {
  if (!component) return '';
  if (typeof component === 'string') return component;
  if (typeof component === 'number' || typeof component === 'boolean') return String(component);

  if (Array.isArray(component)) {
    return component.map(extractTextComponent).join('');
  }

  if (typeof component === 'object') {
    let result = '';
    if (component.fallback && typeof component.fallback === 'string') {
      result += component.fallback;
    } else if (component.text && typeof component.text === 'string') {
      result += component.text;
    } else if (component.translate && typeof component.translate === 'string') {
      result += component.translate;
    }

    if (component.extra) {
      result += extractTextComponent(component.extra);
    }

    if (component.with && Array.isArray(component.with)) {
      result += ' ' + component.with.map(extractTextComponent).join(' ');
    }

    return result;
  }

  return '';
}

export function cleanMinecraftText(raw) {
  if (raw === null || raw === undefined) return '';

  let text = raw;

  if (typeof text === 'object') {
    text = extractTextComponent(text);
  }

  if (typeof text !== 'string') {
    text = String(text || '');
  }

  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        text = extractTextComponent(parsed);
      }
    } catch {}
  }

  // Strip Minecraft color codes and formatting markers (§0-§9, §a-§f, §k-§o, §r)
  text = text
    .replace(/(?:§|\\u00a7|&)[0-9a-fk-or]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

