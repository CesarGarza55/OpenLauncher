import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import {
  VERSION_CATALOG,
  INSTALL_TARGETS,
  formatClock,
  getInstallInfo,
  getVersionById,
  loadLauncherCatalog,
  install,
  run,
} from './lib/minecraftLauncher';
import { loadMinecraftNews } from './lib/minecraftNews';
import {
  searchModrinthMods,
  getModrinthProject,
  getModrinthProjectVersions,
  getModrinthVersion,
} from './lib/modrinth';
import { useI18n } from './context/I18nContext';
import logoIcon from '/icon.webp';

function createOfflineSession(name) {
  return {
    name,
    username: name,
    userType: 'legacy',
  };
}

function getMcHeadsAvatarUrl(username, size = 256) {
  const resolvedUsername = String(username || '').trim();
  if (!resolvedUsername || resolvedUsername.toLowerCase() === 'steve' || resolvedUsername.toLowerCase() === 'player') {
    return `https://minotar.net/avatar/MHF_Steve/${size}`;
  }

  return `https://minotar.net/avatar/${encodeURIComponent(resolvedUsername)}/${size}`;
}

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (!text || text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  return `${clipped}…`;
}

const APP_SOURCE_URL = 'https://github.com/CesarGarza55/OpenLauncher';
const APP_RELEASES_URL = 'https://github.com/CesarGarza55/OpenLauncher/releases/latest';

// ── IPC helper (dynamic proxy safe for Electron preload timing & browser dev mode) ──
const launcherFallback = {
  platform: 'browser',
  isMac: typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
  systemTotalRamGb: 8,
  minecraftGetCatalog: () => Promise.resolve(null),
  minecraftGetState: () => Promise.resolve(null),
  minecraftGetRoot: () => Promise.resolve({ root: '' }),
  minecraftOpenRootDirectory: () => Promise.resolve({ skipped: true }),
  minecraftGetInstalledVersions: () => Promise.resolve([]),
  minecraftGetInstalledMods: () => Promise.resolve([]),
  minecraftGetNews: () => Promise.resolve({ items: [], sourceUrl: 'https://www.minecraft.net/en-us/articles' }),
  minecraftToggleMod: () => Promise.resolve({ ok: true }),
  minecraftDeleteMod: () => Promise.resolve({ ok: true }),
  minecraftInstallModFile: () => Promise.resolve({ ok: true }),
  minecraftPickModFiles: () => Promise.resolve([]),
  minecraftSaveState: () => Promise.resolve({ ok: true }),
  minecraftSetAllModsEnabled: () => Promise.resolve({ ok: true }),
  minecraftGetAuthState: (profileKey) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:get-auth-state', profileKey);
    }
    return Promise.resolve(null);
  },
  minecraftLogin: (profileKey) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:login', profileKey);
    }
    return Promise.resolve({
      error: 'El inicio de sesión interactivo con Microsoft requiere ejecutar la aplicación de escritorio Electron. En modo navegador puedes usar tu nombre de perfil offline en Configuración.',
    });
  },
  minecraftLogout: (profileKey) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:logout', profileKey);
    }
    return Promise.resolve(null);
  },
  minecraftCheckUpdate: () => Promise.resolve({ skipped: true }),
  getAppVersion: () => Promise.resolve(''),
  getSystemInfo: () => Promise.resolve({}),
  minecraftInstall: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:install', opts);
    }
    return Promise.resolve({ installId: 'mock' });
  },
  minecraftRun: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:run', opts);
    }
    return Promise.resolve({ pid: 1234 });
  },
  minecraftStop: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:stop', opts);
    }
    return Promise.resolve({ stopped: true });
  },
  minecraftInstallCancel: (opts) => {
    if (typeof window !== 'undefined' && window.launcher?.invoke) {
      return window.launcher.invoke('minecraft:install-cancel', opts);
    }
    return Promise.resolve({ cancelled: true });
  },
  windowMinimize: () => { },
  windowMaximize: () => { },
  windowClose: () => { },
  openExternal: () => { },
  invoke: () => Promise.resolve(),
  on: () => () => { },
};

const launcher = new Proxy({}, {
  get(_target, prop) {
    if (typeof window !== 'undefined' && window.launcher) {
      const val = window.launcher[prop];
      if (typeof val === 'function') {
        return val.bind(window.launcher);
      }
      if (val !== undefined) {
        return val;
      }
      if (typeof window.launcher.invoke === 'function') {
        if (prop === 'minecraftInstall') return (opts) => window.launcher.invoke('minecraft:install', opts);
        if (prop === 'minecraftRun') return (opts) => window.launcher.invoke('minecraft:run', opts);
        if (prop === 'minecraftStop') return (opts) => window.launcher.invoke('minecraft:stop', opts);
        if (prop === 'minecraftInstallCancel') return (opts) => window.launcher.invoke('minecraft:install-cancel', opts);
        if (prop === 'minecraftLogin') return (key) => window.launcher.invoke('minecraft:login', key);
        if (prop === 'minecraftLogout') return (key) => window.launcher.invoke('minecraft:logout', key);
        if (prop === 'minecraftGetAuthState') return (key) => window.launcher.invoke('minecraft:get-auth-state', key);
      }
    }
    if (prop in launcherFallback) {
      return launcherFallback[prop];
    }
    return () => Promise.resolve();
  }
});

// Wrapper function for minecraftLogin to support abortSignal
const minecraftLoginWithAbort = async (profileKey, abortSignal) => {
  if (typeof window !== 'undefined' && window.launcher?.minecraftLogin) {
    return await window.launcher.minecraftLogin(profileKey, abortSignal);
  }
  return await launcher.minecraftLogin(profileKey);
};

// ── Icon components (inline SVG, crisp at small sizes) ──────────────────────
const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  play: 'M5 3l14 9-14 9V3z',
  stop: 'M6 6h12v12H6z',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  cube: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  console: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm0 2v10h16V7H4zm3 7.5l3-2.5-3-2.5v5zm6-1.5h4v2h-4v-2z',
  logout: 'M10 17l5-5-5-5M15 12H3M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  copy: 'M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 012-2h4a2 2 0 012 2M8 4a2 2 0 000 4h8a2 2 0 000-4',
  clear: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x: 'M18 6L6 18M6 6l12 12',
  news: 'M4 5h16v12H4zM7 8h10M7 11h10M7 14h6',
  external: 'M14 5h5v5M10 14L19 5M19 14v5H5V5h5',
  minimize: 'M5 12h14',
  maximize: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  microsoft: null,
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  spinner: 'M21 12a9 9 0 1 1-6.219-8.56',
  wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  check: 'M20 6L9 17l-5-5',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  wifiOff: 'M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  wifi: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  code: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  chevronDown: 'M19 9l-7 7-7-7',
  chevronUp: 'M5 15l7-7 7 7',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

// ── Sub-components ───────────────────────────────────────────────────────────
function EmptyState({ icon = ICONS.cube, title, description, actionText, onAction, actionIcon, secondaryText, onSecondary, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon d={icon} size={26} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {children}
      {(actionText || secondaryText) && (
        <div className="empty-state-actions">
          {actionText && (
            <button className="btn-primary" onClick={onAction}>
              {actionIcon && <Icon d={actionIcon} size={13} />}
              <span>{actionText}</span>
            </button>
          )}
          {secondaryText && (
            <button className="btn-secondary" onClick={onSecondary}>
              <span>{secondaryText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle-switch ${on ? 'on' : ''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  );
}

function ModCard({ mod, updateInfo, updating, onToggle, onDelete, onUpdate }) {
  const { t } = useI18n();
  const displayName = mod.name || mod.fileName || mod.id;
  const iconUrl = mod.iconUrl;
  const typeBadge = mod.type && mod.type !== 'jar' ? mod.type.toUpperCase() : null;

  return (
    <div className={`mod-card ${!mod.enabled ? 'mod-card-disabled' : ''} ${updateInfo ? 'has-update' : ''}`}>
      <div className="mod-card-header">
        <div className="mod-card-icon-box">
          {iconUrl ? (
            <img src={iconUrl} alt={displayName} className="mod-card-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="mod-card-icon-fallback"><Icon d={ICONS.cube} size={20} /></div>
          )}
        </div>
        <div className="mod-card-main-info">
          <div className="mod-card-title-row">
            <span className="mod-card-name" title={displayName}>{displayName}</span>
            {typeBadge && <span className="mod-loader-badge">{typeBadge}</span>}
            {updateInfo && (
              <span className="mod-update-badge" title={updateInfo.newVersionName || updateInfo.newVersionNumber}>
                <Icon d={ICONS.download} size={9} />
                v{updateInfo.newVersionNumber}
              </span>
            )}
          </div>
          <div className="mod-card-sub-info">
            {mod.version && mod.version !== 'installed' && (
              <span className="mod-card-version" title={`v${mod.version}`}>v{mod.version}</span>
            )}
            {mod.authors ? (
              <span className="mod-card-authors" title={mod.authors}>by {mod.authors}</span>
            ) : (
              <span className="mod-card-filename" title={mod.fileName}>{mod.fileName}</span>
            )}
          </div>
        </div>
      </div>

      {mod.description ? (
        <div className="mod-card-desc" title={mod.description}>{mod.description}</div>
      ) : null}

      <div className="mod-card-footer">
        <span className="mod-card-filename-pill" title={mod.fileName}>
          {mod.fileName}
        </span>
        <div className="mod-card-actions">
          {updateInfo && onUpdate && (
            <button
              className="btn-primary mod-card-update-action-btn"
              type="button"
              onClick={() => onUpdate(updateInfo)}
              disabled={updating}
              title={t('mods.updateAvailableBadge', { version: updateInfo.newVersionNumber })}
            >
              <Icon d={ICONS.download} size={11} className={updating ? 'spin-infinite' : ''} />
              <span>{updating ? t('mods.updating') : t('mods.updateMod')}</span>
            </button>
          )}
          <Toggle on={mod.enabled} onToggle={() => onToggle(mod.id)} />
          <button
            className="profile-action-btn delete"
            type="button"
            title={t('mods.deleteMod')}
            onClick={() => onDelete(mod.id)}
          >
            <Icon d={ICONS.trash} size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ModConflictModal({ conflict, mods = [], onClose, onResolveUpdate, onAutoFixAll, fixingAll, onOpenModsFolder }) {
  const { t } = useI18n();
  if (!conflict) return null;

  const autoFixes = conflict.compatFixes?.length > 0
    ? conflict.compatFixes
    : (conflict.suggestedUpdates || []).map(update => ({
      modId: update.modId,
      targetVersion: update.targetVersion,
      cascade: [],
    }));
  const hasAutoFixes = autoFixes.length > 0;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal mod-conflict-modal">
        <div className="mod-conflict-header">
          <div className="mod-conflict-title-icon-box">
            <span className="mod-conflict-warning-icon">⚠️</span>
          </div>
          <div className="mod-conflict-title-text">
            <h3 className="modal-title">{t('mods.conflictTitle')}</h3>
            <p className="modal-subtitle">{t('mods.conflictSubtitle')}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} title={t('window.close')}>
            <Icon d={ICONS.x} size={14} />
          </button>
        </div>

        <div className="mod-conflict-body">
          {onAutoFixAll && (
            <div className="mod-conflict-autofix-banner">
              <div className="mod-conflict-autofix-info">
                <strong className="mod-conflict-autofix-title">
                  {t('mods.conflictFixAllBtn')}
                </strong>
                <span className="mod-conflict-autofix-desc">
                  {hasAutoFixes ? t('mods.conflictFixAllDesc') : t('mods.conflictFixUnavailable')}
                </span>
              </div>
              <button
                className="btn-primary mod-conflict-autofix-btn"
                type="button"
                onClick={() => onAutoFixAll(autoFixes)}
                disabled={!hasAutoFixes || fixingAll}
              >
                <Icon d={ICONS.sparkles || ICONS.download} size={13} className={fixingAll ? 'spin-infinite' : ''} />
                <span>{fixingAll ? t('mods.conflictFixing') : t('mods.conflictFixAllBtn')}</span>
              </button>
            </div>
          )}

          {conflict.suggestedUpdates && conflict.suggestedUpdates.length > 0 && (() => {
            const pendingUpdates = conflict.suggestedUpdates.filter(rec => {
              const installedMod = mods.find(m =>
                (m.id && String(m.id).toLowerCase() === String(rec.modId).toLowerCase()) ||
                (m.name && String(m.name).toLowerCase() === String(rec.displayName || rec.modId).toLowerCase()) ||
                (m.fileName && m.fileName.toLowerCase().startsWith(`${rec.modId}-`)) ||
                (m.fileName && m.fileName.toLowerCase().includes(rec.modId))
              );
              // Hide update button if the user already has this targetVersion installed
              if (installedMod?.version && rec.targetVersion && String(installedMod.version).trim() === String(rec.targetVersion).trim()) {
                return false;
              }
              return true;
            });

            if (pendingUpdates.length === 0) return null;

            return (
              <div className="mod-conflict-recommendations-section">
                <span className="mod-conflict-rec-header-label">{t('mods.conflictRecommendation')}:</span>
                <div className="mod-conflict-rec-list">
                  {pendingUpdates.map((rec, idx) => (
                    <div key={idx} className="mod-conflict-rec-item">
                      <div className="mod-conflict-rec-item-info">
                        <strong className="mod-conflict-rec-name">{rec.displayName || rec.modId}</strong>
                        <span className="mod-conflict-rec-badge">&rarr; v{rec.targetVersion}</span>
                      </div>
                      {onResolveUpdate && (
                        <button
                          className="btn-primary mod-conflict-rec-btn"
                          type="button"
                          onClick={() => onResolveUpdate(rec)}
                        >
                          <Icon d={ICONS.download} size={12} />
                          <span>{t('mods.conflictUpdateBtn', { version: rec.targetVersion })}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {conflict.conflictingMods && conflict.conflictingMods.length > 0 && (
            <div className="mod-conflict-incompatible-section">
              <span className="mod-conflict-rec-header-label" style={{ color: 'var(--warning)' }}>
                {t('mods.conflictTitle')}:
              </span>
              <div className="mod-conflict-rec-list">
                {conflict.conflictingMods.map((modItem, idx) => {
                  const targetMod = mods.find(m => {
                    const mId = String(m.id || '').toLowerCase();
                    const mName = String(m.name || '').toLowerCase();
                    const mFile = String(m.fileName || '').toLowerCase();
                    const itemId = String(modItem.id || '').toLowerCase();
                    const itemName = String(modItem.name || '').toLowerCase();
                    return mId === itemId || mName === itemName || mFile.startsWith(`${itemId}-`) || mFile.includes(itemId);
                  });
                  return (
                    <div key={idx} className="mod-conflict-rec-item">
                      <div className="mod-conflict-rec-item-info">
                        <strong className="mod-conflict-rec-name">{targetMod?.name || modItem.name || modItem.id}</strong>
                        {targetMod?.version && targetMod.version !== 'installed' && (
                          <span className="mod-conflict-rec-badge" style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)' }}>
                            v{targetMod.version}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mod-conflict-raw-box">
            <div className="mod-conflict-raw-label">{t('mods.conflictLoaderOutput')}</div>
            <pre className="mod-conflict-raw-text">
              {conflict.rawDescription || t('mods.conflictRawFallback')}
            </pre>
          </div>
        </div>

        <div className="modal-actions mod-conflict-actions">
          <button className="btn-secondary" type="button" onClick={onOpenModsFolder}>
            <Icon d={ICONS.folder} size={12} />
            <span>{t('mods.conflictOpenModsFolder')}</span>
          </button>
          <button className="btn-primary" type="button" onClick={onClose}>
            <span>{t('mods.conflictDismiss')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}d ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function formatFileSize(bytes) {
  if (!bytes || typeof bytes !== 'number') return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ModrinthCard({ project, installed, installing, onInstall, onOpenDetails }) {
  const { t } = useI18n();
  const title = project.title || project.slug;
  const author = project.author;
  const description = project.description || '';
  const downloads = Number(project.downloads || 0).toLocaleString();
  const follows = Number(project.follows || 0).toLocaleString();
  const iconUrl = project.icon_url;

  // Extract loaders and tags
  const allCategories = project.categories || [];
  const loaders = allCategories.filter(c => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c.toLowerCase()));
  const tags = allCategories.filter(c => !['fabric', 'forge', 'neoforge', 'quilt'].includes(c.toLowerCase())).slice(0, 2);

  const clientSide = project.client_side;
  const serverSide = project.server_side;

  return (
    <div className="modrinth-card" onClick={() => onOpenDetails(project)} style={{ cursor: 'pointer' }}>
      <div className="modrinth-card-header">
        <div className="modrinth-icon-box">
          {iconUrl ? (
            <img src={iconUrl} alt={title} className="modrinth-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="modrinth-icon-fallback"><Icon d={ICONS.cube} size={20} /></div>
          )}
        </div>
        <div className="modrinth-title-group">
          <div className="modrinth-title-row">
            <span className="modrinth-title" title={title}>{title}</span>
            {installed && <span className="modrinth-installed-badge">{t('mods.installed')}</span>}
          </div>
          <span className="modrinth-author">{t('mods.author', { author })}</span>
        </div>
      </div>

      {/* Badges Row */}
      <div className="modrinth-badges-row">
        {loaders.map(l => (
          <span key={l} className="modrinth-loader-pill">{l.toUpperCase()}</span>
        ))}
        {tags.map(tag => (
          <span key={tag} className="modrinth-tag-pill">{tag}</span>
        ))}
        {clientSide && serverSide && (
          <span className="modrinth-side-pill">
            {clientSide === 'required' && serverSide === 'required'
              ? t('mods.clientAndServer')
              : clientSide === 'required'
                ? t('mods.clientOnly')
                : t('mods.serverOnly')}
          </span>
        )}
      </div>

      <div className="modrinth-desc" title={description}>
        {description}
      </div>

      <div className="modrinth-card-footer">
        <div className="modrinth-stats">
          <span className="modrinth-stat" title={t('mods.downloads')}>
            <Icon d={ICONS.download} size={11} /> {downloads}
          </span>
          <span className="modrinth-stat" title={t('mods.follows')}>
            <Icon d={ICONS.star} size={11} /> {follows}
          </span>
        </div>

        <div className="modrinth-card-actions">
          {installed ? (
            <button
              className="btn-secondary modrinth-btn-installed"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              <Icon d={ICONS.check} size={12} /> {t('mods.installed')}
            </button>
          ) : (
            <button
              className="btn-primary modrinth-btn-install"
              disabled={installing}
              onClick={(e) => {
                e.stopPropagation();
                onInstall(project);
              }}
            >
              {installing ? (
                <>
                  <span className="btn-spinner" />
                  <span>{t('mods.installing')}</span>
                </>
              ) : (
                <>
                  <Icon d={ICONS.download} size={12} />
                  <span>{t('mods.install')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModDetailModal({
  project,
  initialTab = 'overview',
  currentLoader,
  currentMcVer,
  mods = [],
  onClose,
  onInstallVersion,
  installingVersionId,
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loaderFilter, setLoaderFilter] = useState(currentLoader || 'all');
  const [mcVersionFilter, setMcVersionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedChangelog, setExpandedChangelog] = useState({});
  const [activeGalleryImg, setActiveGalleryImg] = useState(null);

  const projectId = project.project_id || project.slug || project.id;
  const title = projectDetails?.title || project.title || project.slug;
  const author = projectDetails?.team_members || project.author || '';
  const description = projectDetails?.description || project.description || '';
  const iconUrl = projectDetails?.icon_url || project.icon_url;
  const downloads = Number(projectDetails?.downloads ?? project.downloads ?? 0).toLocaleString();
  const followers = Number(projectDetails?.followers ?? project.follows ?? 0).toLocaleString();
  const license = projectDetails?.license?.name || projectDetails?.license?.id || '';

  // Load project details
  useEffect(() => {
    let isMounted = true;
    setLoadingDetails(true);
    const fetchDetails = async () => {
      try {
        let data = null;
        if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetProject) {
          data = await window.launcher.minecraftModrinthGetProject(projectId);
        } else {
          data = await getModrinthProject(projectId);
        }
        if (isMounted && data) {
          setProjectDetails(data);
        }
      } catch (e) {
        console.warn('Failed to load project details:', e);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [projectId]);

  // Load versions
  useEffect(() => {
    let isMounted = true;
    setLoadingVersions(true);
    const fetchVersions = async () => {
      try {
        let vers = [];
        if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetVersions) {
          vers = await window.launcher.minecraftModrinthGetVersions({ idOrSlug: projectId });
        } else {
          vers = await getModrinthProjectVersions({ idOrSlug: projectId });
        }
        if (isMounted && Array.isArray(vers)) {
          setVersions(vers);
        }
      } catch (e) {
        console.warn('Failed to load project versions:', e);
      } finally {
        if (isMounted) setLoadingVersions(false);
      }
    };
    fetchVersions();
    return () => { isMounted = false; };
  }, [projectId]);

  // Filter versions
  const availableGameVersions = Array.from(
    new Set(versions.flatMap(v => v.game_versions || []))
  ).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const availableLoaders = Array.from(
    new Set(versions.flatMap(v => v.loaders || []))
  );

  const filteredVersions = versions.filter(v => {
    if (typeFilter !== 'all' && v.version_type !== typeFilter) return false;
    if (loaderFilter !== 'all' && !(v.loaders || []).includes(loaderFilter.toLowerCase())) return false;
    if (mcVersionFilter !== 'all' && !(v.game_versions || []).includes(mcVersionFilter)) return false;
    return true;
  });

  const toggleChangelog = (verId) => {
    setExpandedChangelog(prev => ({ ...prev, [verId]: !prev[verId] }));
  };

  const isVersionInstalled = (ver) => {
    const file = ver.files?.find(f => f.primary) || ver.files?.[0];
    if (!file) return false;
    const fn = (file.filename || '').toLowerCase();
    const verNum = (ver.version_number || '').toLowerCase();
    return mods.some(m => {
      const mFn = (m.fileName || '').toLowerCase();
      const mVer = (m.version || '').toLowerCase();
      return mFn === fn || (m.id.toLowerCase().includes(project.slug?.toLowerCase() || '') && mVer === verNum);
    });
  };

  const gallery = projectDetails?.gallery || [];

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal mod-detail-modal">
        {/* Header */}
        <div className="mod-detail-header">
          <div className="mod-detail-icon-box">
            {iconUrl ? (
              <img src={iconUrl} alt={title} className="mod-detail-icon-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="mod-detail-icon-fallback"><Icon d={ICONS.cube} size={32} /></div>
            )}
          </div>
          <div className="mod-detail-info">
            <div className="mod-detail-title-row">
              <h2 className="mod-detail-title">{title}</h2>
              {projectDetails?.client_side && projectDetails?.server_side && (
                <span className="mod-env-badge">
                  {projectDetails.client_side === 'required' && projectDetails.server_side === 'required'
                    ? t('mods.clientAndServer')
                    : projectDetails.client_side === 'required'
                      ? t('mods.clientOnly')
                      : t('mods.serverOnly')}
                </span>
              )}
            </div>
            <div className="mod-detail-meta-row">
              {author && <span className="mod-detail-author">{t('mods.author', { author })}</span>}
              {license && <span className="mod-detail-license"><Icon d={ICONS.book} size={11} /> {license}</span>}
              <span className="mod-detail-stat"><Icon d={ICONS.download} size={11} /> {downloads}</span>
              <span className="mod-detail-stat"><Icon d={ICONS.star} size={11} /> {followers}</span>
            </div>
            <p className="mod-detail-desc">{description}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} title={t('window.close')}>
            <Icon d={ICONS.x} size={14} />
          </button>
        </div>

        {/* Project Links */}
        {(projectDetails?.source_url || projectDetails?.issues_url || projectDetails?.wiki_url || projectDetails?.discord_url) && (
          <div className="mod-detail-links-bar">
            {projectDetails.source_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.source_url);
                  } else {
                    window.open(projectDetails.source_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.code} size={12} />
                <span>{t('mods.sourceCode')}</span>
              </button>
            )}
            {projectDetails.issues_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.issues_url);
                  } else {
                    window.open(projectDetails.issues_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.info} size={12} />
                <span>{t('mods.issues')}</span>
              </button>
            )}
            {projectDetails.wiki_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.wiki_url);
                  } else {
                    window.open(projectDetails.wiki_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.book} size={12} />
                <span>{t('mods.wiki')}</span>
              </button>
            )}
            {projectDetails.discord_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.discord_url);
                  } else {
                    window.open(projectDetails.discord_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.globe} size={12} />
                <span>{t('mods.discord')}</span>
              </button>
            )}
          </div>
        )}

        {/* Nav tabs */}
        <div className="mod-detail-tabs">
          <button
            className={`mod-detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Icon d={ICONS.news} size={12} />
            <span>{t('mods.overview')}</span>
          </button>
          <button
            className={`mod-detail-tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
            onClick={() => setActiveTab('versions')}
          >
            <Icon d={ICONS.cube} size={12} />
            <span>{t('mods.versions')} ({versions.length})</span>
          </button>
          {gallery.length > 0 && (
            <button
              className={`mod-detail-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              <Icon d={ICONS.copy} size={12} />
              <span>{t('mods.gallery')} ({gallery.length})</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="mod-detail-body">
          {activeTab === 'overview' && (
            <div className="mod-overview-content">
              {gallery.length > 0 && (
                <div className="mod-gallery-preview">
                  {gallery.slice(0, 4).map((img, i) => (
                    <div key={i} className="mod-gallery-thumb" onClick={() => setActiveGalleryImg(img.url)}>
                      <img src={img.url} alt={img.title || `Screenshot ${i + 1}`} />
                      {img.title && <span className="mod-gallery-thumb-title">{img.title}</span>}
                    </div>
                  ))}
                </div>
              )}

              {loadingDetails ? (
                <div className="mod-detail-spinner-box">
                  <span className="btn-spinner" />
                  <span>{t('account.loading')}</span>
                </div>
              ) : projectDetails?.body ? (
                <div className="mod-detail-body-text">
                  {projectDetails.body.split('\n\n').map((para, idx) => {
                    const cleanPara = para.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').trim();
                    if (!cleanPara) return null;
                    if (para.startsWith('#')) {
                      return <h4 key={idx} className="mod-body-heading">{cleanPara}</h4>;
                    }
                    if (para.startsWith('- ') || para.startsWith('* ')) {
                      return (
                        <ul key={idx} className="mod-body-list">
                          {para.split('\n').map((li, lidx) => (
                            <li key={lidx}>{li.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={idx} className="mod-body-p">{cleanPara}</p>;
                  })}
                </div>
              ) : (
                <p className="mod-body-p">{description}</p>
              )}
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="mod-versions-content">
              {/* Version Filters */}
              <div className="mod-versions-filters">
                <div className="modrinth-filter-select-wrapper">
                  <span className="modrinth-filter-label">{t('mods.filterLoader')}:</span>
                  <select
                    className="select-input modrinth-filter-select"
                    value={loaderFilter}
                    onChange={e => setLoaderFilter(e.target.value)}
                  >
                    <option value="all">{t('mods.allLoaders')}</option>
                    {availableLoaders.map(l => (
                      <option key={l} value={l}>{l.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div className="modrinth-filter-select-wrapper">
                  <span className="modrinth-filter-label">{t('mods.filterVersion')}:</span>
                  <select
                    className="select-input modrinth-filter-select"
                    value={mcVersionFilter}
                    onChange={e => setMcVersionFilter(e.target.value)}
                  >
                    <option value="all">{t('mods.allVersions')}</option>
                    {availableGameVersions.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="modrinth-filter-select-wrapper">
                  <span className="modrinth-filter-label">{t('mods.releaseType')}:</span>
                  <select
                    className="select-input modrinth-filter-select"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                  >
                    <option value="all">{t('mods.allReleaseTypes')}</option>
                    <option value="release">{t('mods.release')}</option>
                    <option value="beta">{t('mods.beta')}</option>
                    <option value="alpha">{t('mods.alpha')}</option>
                  </select>
                </div>
              </div>

              {/* Version List */}
              {loadingVersions ? (
                <div className="mod-detail-spinner-box">
                  <span className="btn-spinner" />
                  <span>{t('account.loading')}</span>
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="mod-versions-empty">
                  <Icon d={ICONS.cube} size={24} />
                  <span>{t('mods.noVersionsFound')}</span>
                </div>
              ) : (
                <div className="mod-versions-list">
                  {filteredVersions.map(ver => {
                    const isInstalled = isVersionInstalled(ver);
                    const isInstalling = installingVersionId === ver.id;
                    const primaryFile = ver.files?.find(f => f.primary) || ver.files?.[0];
                    const fileSize = primaryFile?.size ? formatFileSize(primaryFile.size) : '';
                    const dateStr = formatRelativeTime(ver.date_published);
                    const isExpanded = Boolean(expandedChangelog[ver.id]);

                    return (
                      <div key={ver.id} className="mod-version-item">
                        <div className="mod-version-main-row">
                          <div className="mod-version-info">
                            <div className="mod-version-title-row">
                              <span className="mod-version-title" title={ver.name || ver.version_number}>
                                {ver.name || `v${ver.version_number}`}
                              </span>
                              <span className={`version-type-badge ${ver.version_type}`}>
                                {ver.version_type}
                              </span>
                              {isInstalled && (
                                <span className="modrinth-installed-badge">{t('mods.installed')}</span>
                              )}
                            </div>
                            <div className="mod-version-details-row">
                              <span className="mod-version-loaders">
                                {(ver.loaders || []).map(l => l.toUpperCase()).join(', ')}
                              </span>
                              <span>·</span>
                              <span className="mod-version-mcvers">
                                MC {(ver.game_versions || []).slice(0, 3).join(', ')}
                                {(ver.game_versions || []).length > 3 ? ` +${ver.game_versions.length - 3}` : ''}
                              </span>
                              {fileSize && (
                                <>
                                  <span>·</span>
                                  <span className="mod-version-size">{fileSize}</span>
                                </>
                              )}
                              {dateStr && (
                                <>
                                  <span>·</span>
                                  <span className="mod-version-date">{dateStr}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="mod-version-actions">
                            {ver.changelog && (
                              <button
                                className="btn-secondary mod-changelog-toggle-btn"
                                onClick={() => toggleChangelog(ver.id)}
                                title={t('mods.changelog')}
                              >
                                <Icon d={isExpanded ? ICONS.chevronUp : ICONS.chevronDown} size={11} />
                                <span>{t('mods.changelog')}</span>
                              </button>
                            )}

                            {isInstalled ? (
                              <button className="btn-secondary modrinth-btn-installed" disabled>
                                <Icon d={ICONS.check} size={12} />
                                <span>{t('mods.installed')}</span>
                              </button>
                            ) : (
                              <button
                                className="btn-primary mod-version-install-btn"
                                disabled={isInstalling}
                                onClick={() => onInstallVersion(project, ver)}
                              >
                                {isInstalling ? (
                                  <>
                                    <span className="btn-spinner" />
                                    <span>{t('mods.installing')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Icon d={ICONS.download} size={12} />
                                    <span>{t('mods.install')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Changelog Accordion */}
                        {isExpanded && (
                          <div className="mod-version-changelog">
                            <div className="mod-changelog-header">{t('mods.changelog')}:</div>
                            <div className="mod-changelog-text">
                              {ver.changelog ? (
                                ver.changelog.split('\n').map((line, lidx) => (
                                  <div key={lidx}>{line.replace(/#{1,4}\s*/g, '').replace(/\*\*/g, '')}</div>
                                ))
                              ) : (
                                <em>{t('mods.noChangelog')}</em>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="mod-gallery-grid">
              {gallery.map((img, i) => (
                <div key={i} className="mod-gallery-card" onClick={() => setActiveGalleryImg(img.url)}>
                  <img src={img.url} alt={img.title || `Screenshot ${i + 1}`} />
                  {img.title && <div className="mod-gallery-caption">{img.title}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen Gallery Lightbox */}
        {activeGalleryImg && (
          <div className="gallery-lightbox" onClick={() => setActiveGalleryImg(null)}>
            <img src={activeGalleryImg} alt="Enlarged screenshot" />
            <button className="lightbox-close-btn" onClick={() => setActiveGalleryImg(null)}>
              <Icon d={ICONS.x} size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewsCard({ item, onOpen }) {
  const { t } = useI18n();
  const metaText = [item.author, item.published].filter(Boolean).join(' · ');
  const cardMeta = truncateText(metaText, 42);
  const cardTitle = truncateText(item.title, 58);
  const cardSummary = truncateText(item.summary, 132);

  return (
    <article className="news-card">
      <div className="news-card-media">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" />
        ) : (
          <div className="news-card-media-fallback">
            <Icon d={ICONS.news} size={24} />
          </div>
        )}
      </div>
      <div className="news-card-body">
        <div className="news-card-meta">
          <span>{t('news.officialLabel')}</span>
          {cardMeta ? <span>• {cardMeta}</span> : null}
        </div>
        <div className="news-card-title">{cardTitle}</div>
        {cardSummary ? <div className="news-card-summary">{cardSummary}</div> : null}
        <div className="news-card-actions">
          <button className="btn-secondary" type="button" onClick={() => onOpen(item.url)} style={{ fontSize: 11, padding: '4px 10px' }}>
            <Icon d={ICONS.external} size={11} />
            {t('news.openArticle')}
          </button>
        </div>
      </div>
    </article>
  );
}

function ProfileCardActions({ active, name, disabled, onEdit, onDuplicate, onDelete }) {
  const { t } = useI18n();

  return (
    <div className="profile-actions" onClick={e => e.stopPropagation()}>
      <button
        className="profile-action-btn"
        title={t('profile.edit')}
        aria-label={`${t('profile.edit')} ${name}`}
        onClick={onEdit}
        disabled={disabled}
      >
        <Icon d={ICONS.edit} size={11} />
      </button>
      <button
        className="profile-action-btn"
        title={t('profile.duplicate')}
        aria-label={`${t('profile.duplicate')} ${name}`}
        onClick={onDuplicate}
        disabled={disabled}
      >
        <Icon d={ICONS.copy} size={11} />
      </button>
      <button
        className="profile-action-btn delete"
        title={t('profile.delete')}
        aria-label={`${t('profile.delete')} ${name}`}
        onClick={onDelete}
        disabled={disabled}
      >
        <Icon d={ICONS.trash} size={11} />
      </button>
    </div>
  );
}

function LogLine({ entry }) {
  if (entry && entry.msg.includes('WARN')) {
    entry.level = 'warn';
  }
  return (
    <div className="log-line">
      <span className="log-time">{entry.time}</span>
      <span className={`log-prefix ${entry.level}`}>
        [{entry.level.toUpperCase().padEnd(7)}]
      </span>
      <span className={`log-msg ${entry.level}`}>{entry.msg}</span>
    </div>
  );
}

function Toast({ toast, onClose }) {
  const { t } = useI18n();
  const toneIcon = toast.tone === 'error'
    ? ICONS.x
    : toast.tone === 'success'
      ? ICONS.play
      : toast.tone === 'warning'
        ? ICONS.wrench
        : ICONS.refresh;

  return (
    <div className={`toast ${toast.tone || 'info'}`} role="status" aria-live="polite">
      <div className="toast-icon">
        <Icon d={toneIcon} size={12} />
      </div>
      <div className="toast-body">
        {toast.title ? <div className="toast-title">{toast.title}</div> : null}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" type="button" onClick={() => onClose(toast.id)} aria-label={t('window.close')}>
        <Icon d={ICONS.x} size={10} />
      </button>
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────
function ProfileModal({ mode = 'new', profile, versions, systemTotalRam: initialSystemRam, onClose, onSave }) {
  const { t } = useI18n();
  const [detectedRam, setDetectedRam] = useState(
    typeof initialSystemRam === 'number' && initialSystemRam > 0
      ? initialSystemRam
      : (typeof launcher?.systemTotalRamGb === 'number' && launcher.systemTotalRamGb > 0
        ? launcher.systemTotalRamGb
        : (typeof navigator !== 'undefined' && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0
          ? navigator.deviceMemory
          : null))
  );

  useEffect(() => {
    if (typeof initialSystemRam === 'number' && initialSystemRam > 0) {
      setDetectedRam(initialSystemRam);
      return;
    }
    launcher.getSystemInfo?.()
      .then(info => {
        if (info?.totalRamGb && info.totalRamGb > 0) {
          setDetectedRam(info.totalRamGb);
        }
      })
      .catch(() => { });
  }, [initialSystemRam]);

  const maxRam = detectedRam && detectedRam > 0 ? detectedRam : (profile?.ram ? Math.max(1, profile.ram) : 8);
  const [name, setName] = useState(profile?.name || '');
  const [localName, setLocalName] = useState(profile?.localName || '');
  const [version, setVersion] = useState(profile?.version || '');
  const [ram, setRam] = useState(Math.min(profile?.ram || 4, maxRam));
  const [jvmArguments, setJvmArguments] = useState(profile?.jvmArguments || '');
  const [javaPath, setJavaPath] = useState(profile?.javaPath || '');
  const canSave = Boolean(name.trim() && localName.trim());

  useEffect(() => {
    setName(profile?.name || '');
    setLocalName(profile?.localName || '');
    setVersion(profile?.version || '');
    setRam(Math.min(profile?.ram || 4, maxRam));
    setJvmArguments(profile?.jvmArguments || '');
    setJavaPath(profile?.javaPath || '');
  }, [profile, versions, maxRam]);

  const rawPresets = [2, 4, 6, 8, 12, 16, 24, 32, 64];
  const presets = rawPresets.filter(amount => amount <= maxRam);
  if (presets.length === 0 || presets[presets.length - 1] < maxRam) {
    if (!presets.includes(maxRam)) presets.push(maxRam);
    presets.sort((a, b) => a - b);
  }

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedLocalName = localName.trim();
    const trimmedJvmArguments = jvmArguments.trim();
    const trimmedJavaPath = javaPath.trim();
    if (!trimmedName || !trimmedLocalName) return;
    onSave({
      id: profile?.id ?? null,
      name: trimmedName,
      localName: trimmedLocalName,
      skinName: profile?.skinName || '',
      microsoftAccount: profile?.microsoftAccount || '',
      version: version || null,
      ram,
      jvmArguments: trimmedJvmArguments,
      javaPath: trimmedJavaPath,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{mode === 'edit' ? t('profile.editProfile') : t('profile.newProfile')}</div>
        <div className="modal-subtitle">
          {mode === 'edit'
            ? t('profile.adjustProfile')
            : t('profile.createProfile')}
        </div>

        <div className="modal-field">
          <label className="modal-label">
            <span>{t('profile.profileName')}</span>
            <span style={{ color: 'var(--accent)', fontSize: 10 }}>{t('common.required')}</span>
          </label>
          <input className="modal-input" value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('profile.profileNamePlaceholder')} autoFocus />
        </div>

        <div className="modal-field">
          <label className="modal-label">
            <span>{t('profile.localAccountName')}</span>
            <span style={{ color: 'var(--accent)', fontSize: 10 }}>{t('common.required')}</span>
          </label>
          <input
            className="modal-input"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            placeholder={t('profile.localAccountPlaceholder')}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">
            <span>{t('profile.version')}</span>
          </label>
          {versions.length > 0 ? (
            <select className="modal-select" value={version} onChange={e => setVersion(e.target.value)}>
              <option value="">{t('profile.useLauncherSelector')}</option>
              {versions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          ) : (
            <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34 }}>
              {t('profile.noVersionsInstalled')}
            </div>
          )}
        </div>

        <div className="modal-field">
          <label className="modal-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('profile.allocatedRAM', { ram })}</span>
            {typeof systemTotalRam === 'number' && systemTotalRam > 0 ? (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('profile.systemTotalRam', { total: systemTotalRam })}</span>
            ) : null}
          </label>
          <div className="ram-presets-row">
            {presets.map(amount => (
              <button
                key={amount}
                type="button"
                className={`ram-preset-btn ${ram === amount ? 'active' : ''}`}
                onClick={() => setRam(amount)}
              >
                {amount}G
              </button>
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={maxRam}
            step={1}
            value={ram}
            onChange={e => setRam(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 6 }}
          />
          {ram >= maxRam && (
            <div style={{ fontSize: 11, color: 'var(--warning, #f59e0b)', marginTop: 4 }}>
              {t('profile.ramWarning')}
            </div>
          )}
        </div>

        <div className="modal-field">
          <label className="modal-label">{t('profile.jvmArguments')}</label>
          <input
            className="modal-input"
            value={jvmArguments}
            onChange={e => setJvmArguments(e.target.value)}
            placeholder={t('profile.jvmArgumentsPlaceholder')}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">{t('profile.customJVMPath')}</label>
          <input
            className="modal-input"
            value={javaPath}
            onChange={e => setJavaPath(e.target.value)}
            placeholder={t('profile.customJVMPathPlaceholder')}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('profile.cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={!canSave}>
            {mode === 'edit' ? t('profile.saveChanges') : t('profile.createProfileButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

function InstallModal({ type, installTargets, showSnapshots = false, onClose, onInstall, onCatalogLoaded }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const info = getInstallInfo(type, installTargets);
  const usesGameAndLoader = type === 'fabric' || type === 'forge';
  const hasVersions = usesGameAndLoader ? (info.gameVersions?.length > 0) : (info.versions?.length > 0);

  useEffect(() => {
    if (!hasVersions && !loading) {
      setLoading(true);
      const fetchCatalog = launcher.minecraftGetCatalog
        ? () => launcher.minecraftGetCatalog({ includeSnapshots: showSnapshots })
        : () => loadLauncherCatalog({ includeSnapshots: showSnapshots });

      fetchCatalog()
        .then(catalog => {
          if (catalog && onCatalogLoaded) {
            onCatalogLoaded(catalog);
          }
        })
        .catch(err => console.error('Failed to load catalog:', err))
        .finally(() => setLoading(false));
    }
  }, [hasVersions, loading, showSnapshots, onCatalogLoaded]);

  const [gameVersion, setGameVersion] = useState(usesGameAndLoader ? (info.gameVersions?.[0] || '') : (info.versions?.[0] || ''));
  const [loaderVersion, setLoaderVersion] = useState(usesGameAndLoader ? ((info.loadersByGameVersion?.[info.gameVersions?.[0] || ''] || [])[0] || '') : '');

  useEffect(() => {
    if (usesGameAndLoader) {
      const nextGameVersion = info.gameVersions?.[0] || '';
      const nextLoaderVersion = (info.loadersByGameVersion?.[nextGameVersion] || [])[0] || '';
      setGameVersion(nextGameVersion);
      setLoaderVersion(nextLoaderVersion);
      return;
    }

    setGameVersion(info.versions?.[0] || '');
    setLoaderVersion('');
  }, [info.gameVersions, info.loadersByGameVersion, info.versions, usesGameAndLoader]);

  useEffect(() => {
    if (!usesGameAndLoader) return;

    const loaderOptions = info.loadersByGameVersion?.[gameVersion] || [];
    if (!loaderOptions.includes(loaderVersion)) {
      setLoaderVersion(loaderOptions[0] || '');
    }
  }, [gameVersion, info.loadersByGameVersion, usesGameAndLoader, loaderVersion]);

  const loaderOptions = usesGameAndLoader ? (info.loadersByGameVersion?.[gameVersion] || []) : [];
  const canInstall = usesGameAndLoader ? Boolean(gameVersion && loaderVersion) : Boolean(gameVersion);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{info.title}</div>
        <div className="modal-subtitle">
          {usesGameAndLoader
            ? (type === 'forge' ? t('install.selectGameAndForgeRelease') : t('install.selectLoaderAndVersion'))
            : t('install.selectVersion')}
        </div>

        {usesGameAndLoader ? (
          <>
            <div className="modal-field">
              <label className="modal-label">{t('install.gameVersion')}</label>
              {info.gameVersions?.length > 0 ? (
                <select className="modal-select" value={gameVersion} onChange={e => setGameVersion(e.target.value)}>
                  {info.gameVersions.map(version => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              ) : (
                <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--text-muted)' }}>
                  {loading ? 'Cargando versiones...' : t('install.noVersionsAvailable')}
                </div>
              )}
            </div>

            <div className="modal-field">
              <label className="modal-label">{type === 'forge' ? t('install.forgeRelease') : t('install.loader')}</label>
              {loaderOptions.length > 0 ? (
                <select className="modal-select" value={loaderVersion} onChange={e => setLoaderVersion(e.target.value)}>
                  {loaderOptions.map(version => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              ) : (
                <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--text-muted)' }}>
                  {loading ? 'Cargando loaders...' : t('install.noLoadersAvailable')}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="modal-field">
            <label className="modal-label">{t('install.version')}</label>
            {info.versions?.length > 0 ? (
              <select className="modal-select" value={gameVersion} onChange={e => setGameVersion(e.target.value)}>
                {info.versions.map(version => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>
            ) : (
              <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--text-muted)' }}>
                {loading ? 'Cargando versiones...' : t('install.noVersionsAvailable')}
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>{t('profile.cancel')}</button>
          <button
            className="btn-primary"
            disabled={!canInstall}
            onClick={() => {
              if (usesGameAndLoader) {
                onInstall(type, { gameVersion, loaderVersion });
              } else {
                onInstall(type, { version: gameVersion });
              }
              onClose();
            }}
          >
            {t('install.install')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  settings,
  onChange,
  onClose,
  onCheckUpdates,
  onOpenAbout,
  onOpenMinecraftDirectory,
  onOpenSourceCode,
  onOpenReleases,
  language,
  onLanguageChange,
  appVersion,
}) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal">
        <div className="modal-title">{t('settings.title')}</div>
        <div className="modal-subtitle">{t('settings.subtitle')}</div>

        <div className="settings-list">
          <div className="settings-option">
            <div className="settings-option-copy">
              <div className="settings-option-title">{t('settings.language')}</div>
              <div className="settings-option-description">{t('settings.languageDesc')}</div>
            </div>
            <select className="modal-select settings-option-control settings-language-select" value={language} onChange={e => onLanguageChange(e.target.value)}>
              <option value="en">{t('settings.english')}</option>
              <option value="es">{t('settings.spanish')}</option>
              <option value="fr">{t('settings.french')}</option>
            </select>
          </div>

          <div className="settings-option">
            <div className="settings-option-copy">
              <div className="settings-option-title">{t('settings.showSnapshots')}</div>
              <div className="settings-option-description">{t('settings.showSnapshotsDesc')}</div>
            </div>
            <Toggle on={settings.showSnapshots} onToggle={() => onChange('showSnapshots', !settings.showSnapshots)} />
          </div>

          <div className="settings-option">
            <div className="settings-option-copy">
              <div className="settings-option-title">{t('settings.keepLauncherOpen')}</div>
              <div className="settings-option-description">{t('settings.keepLauncherOpenDesc')}</div>
            </div>
            <Toggle on={settings.keepOpen} onToggle={() => onChange('keepOpen', !settings.keepOpen)} />
          </div>

          <div className="settings-option">
            <div className="settings-option-copy">
              <div className="settings-option-title">{t('settings.showConsoleOutput')}</div>
              <div className="settings-option-description">{t('settings.showConsoleOutputDesc')}</div>
            </div>
            <Toggle on={settings.showConsole} onToggle={() => onChange('showConsole', !settings.showConsole)} />
          </div>

          <div className="settings-option">
            <div className="settings-option-copy">
              <div className="settings-option-title">{t('settings.autoUpdateLauncher')}</div>
              <div className="settings-option-description">{t('settings.autoUpdateLauncherDesc')}</div>
            </div>
            <Toggle on={settings.autoUpdate} onToggle={() => onChange('autoUpdate', !settings.autoUpdate)} />
          </div>

          <div className="modal-field settings-field">
            <label className="modal-label">{t('settings.minecraftDirectory')}</label>
            <div className="settings-row-sub">{t('settings.minecraftDirectoryDesc')}</div>
            <div className="settings-path-row">
              <input
                className="modal-input"
                value={settings.minecraftRoot || ''}
                readOnly
                placeholder="~/.minecraft"
              />
              <button
                className="btn-secondary"
                type="button"
                onClick={onOpenMinecraftDirectory}
                title={t('settings.openMinecraftDirectory')}
              >
                <Icon d={ICONS.folder} size={13} />
                <span>{t('settings.openMinecraftDirectory')}</span>
              </button>
            </div>
          </div>

          <div className="modal-field settings-field">
            <label className="modal-label">{t('settings.javaPath')}</label>
            <div className="settings-row-sub">{t('settings.javaPathDesc')}</div>
            <input
              className="modal-input"
              value={settings.javaPath || ''}
              onChange={e => onChange('javaPath', e.target.value)}
              placeholder={t('settings.autoDetect')}
            />
          </div>
        </div>

        <div className="modal-actions settings-modal-actions">
          <div className="settings-modal-links">
            <button className="btn-ghost" type="button" onClick={onOpenAbout}>{t('settings.aboutButton')}</button>
            <button className="btn-ghost" type="button" onClick={onCheckUpdates}>{t('settings.checkForUpdates')}</button>
          </div>
          <button className="btn-primary" onClick={onClose}>{t('settings.done')}</button>
        </div>
      </div>
    </div>
  );
}

function AboutModal({ appVersion, language, onClose, onOpenSourceCode, onOpenReleases, onCheckUpdates }) {
  const { t } = useI18n();
  const versionLabel = appVersion || t('settings.devBuild');

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <img src={logoIcon} alt="OpenLauncher" style={{ width: 44, height: 44, borderRadius: 12 }} onError={(event) => {
            event.currentTarget.style.display = 'none';
          }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{t('app.name')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>v{versionLabel} • {t('settings.licenseLabel', { license: 'GPL-2.0' })}</div>
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {t('settings.aboutDescription')}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <span className="profile-chip">{t('settings.developedByLabel', { developer: 'CesarGarza55' })}</span>
          <span className="profile-chip">{t('settings.openSourceLabel')}</span>
        </div>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn-ghost" type="button" onClick={onOpenSourceCode}>
            <Icon d={ICONS.external} size={11} />
            {t('settings.openSourceCode')}
          </button>
          <button className="btn-ghost" type="button" onClick={onOpenReleases}>
            <Icon d={ICONS.external} size={11} />
            {t('settings.openReleases')}
          </button>
          <button className="btn-primary" type="button" onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginLoadingModal({ onCancel }) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 360 }}>
        <div className="modal-title">{t('account.loginWithMicrosoft')}</div>
        <div className="modal-subtitle">{t('account.loginInProgress')}</div>

        <div style={{ padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <span className="spinning" style={{ color: 'var(--accent)' }}>
            <Icon d={ICONS.spinner} size={28} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {t('account.waitingForAuthentication')}
          </span>
        </div>

        <div className="modal-actions" style={{ width: '100%', justifyContent: 'center' }}>
          <button className="btn-ghost" type="button" onClick={onCancel}>
            {t('account.cancelLogin')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { language, setLanguage, t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [stateHydrated, setStateHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState('news');
  const [modSearch, setModSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState('all');
  const [versionCatalog, setVersionCatalog] = useState([]);
  const [installedVersions, setInstalledVersions] = useState([]);
  const [installTargets, setInstallTargets] = useState(INSTALL_TARGETS);
  const [mods, setMods] = useState([]);
  const [modsSubTab, setModsSubTab] = useState('installed'); // 'installed' | 'browse'
  const [modrinthQuery, setModrinthQuery] = useState('');
  const [modrinthSort, setModrinthSort] = useState('relevance');
  const [modrinthCategory, setModrinthCategory] = useState('all');
  const [modrinthLoaderFilter, setModrinthLoaderFilter] = useState('auto');
  const [modrinthVersionFilter, setModrinthVersionFilter] = useState('auto');
  const [modrinthResults, setModrinthResults] = useState([]);
  const [modrinthTotalHits, setModrinthTotalHits] = useState(0);
  const [modrinthLoading, setModrinthLoading] = useState(false);
  const [modrinthLoadingMore, setModrinthLoadingMore] = useState(false);
  const [modrinthInstalling, setModrinthInstalling] = useState({});
  const [selectedModDetail, setSelectedModDetail] = useState(null); // null | { project, initialTab: 'overview' | 'versions' }
  const [installingVersionId, setInstallingVersionId] = useState(null);
  const [modUpdates, setModUpdates] = useState({});
  const [checkingModUpdates, setCheckingModUpdates] = useState(false);
  const [updatingMods, setUpdatingMods] = useState(new Set());
  const [modConflict, setModConflict] = useState(null);
  const [logs, setLogs] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [newsSourceUrl, setNewsSourceUrl] = useState('https://www.minecraft.net/en-us/articles');
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [gameState, setGameState] = useState('idle'); // idle | loading | running
  const [progress, setProgress] = useState(0);
  const [runPid, setRunPid] = useState(null);
  const [installId, setInstallId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [updateState, setUpdateState] = useState({ phase: 'idle', progress: 0, message: '' });
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // null | 'newProfile' | 'install-minecraft' | 'install-fabric' | 'install-forge' | 'settings' | 'about'
  const [profileEditor, setProfileEditor] = useState(null); // null | { mode: 'new' | 'edit', profileId: number | null }
  const [account, setAccount] = useState({ name: '', loggedIn: false, profileKey: 'default', kind: 'none', session: null });
  const [authRefreshing, setAuthRefreshing] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [systemTotalRam, setSystemTotalRam] = useState(
    typeof launcher?.systemTotalRamGb === 'number' && launcher.systemTotalRamGb > 0
      ? launcher.systemTotalRamGb
      : null
  );
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [settings, setSettings] = useState({
    keepOpen: false, showConsole: true, autoUpdate: true, showSnapshots: false, javaPath: '', minecraftRoot: '', language,
  });
  const consoleRef = useRef(null);
  const modrinthSentinelRef = useRef(null);
  const gameTimerRef = useRef(null);
  const toastTimersRef = useRef(new Map());
  const loginAbortControllerRef = useRef(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || null;
  const activeProfileVersion = activeProfile?.version
    ? installedVersions.find(v => v.id === activeProfile.version) || getVersionById(activeProfile.version, versionCatalog)
    : null;
  const activeVersion = activeProfileVersion || installedVersions[0] || versionCatalog[0] || null;
  const selectedInstalledVersionId = activeProfile?.version || (installedVersions[0] ? installedVersions[0].id : '');

  const stateRef = useRef({ profiles, activeProfileId, mods, logs, settings, versionCatalog, installTargets });
  useEffect(() => {
    stateRef.current = { profiles, activeProfileId, mods, logs, settings, versionCatalog, installTargets };
  }, [profiles, activeProfileId, mods, logs, settings, versionCatalog, installTargets]);

  const addLog = useCallback((level, msg) => {
    setLogs(prev => {
      const next = [...prev, { level, msg, time: formatClock() }];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const pushToast = useCallback(({ tone = 'info', title = '', message = '', duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, tone, title, message }]);
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);
      toastTimersRef.current.set(id, timer);
    }
    return id;
  }, [dismissToast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      pushToast({
        tone: 'warning',
        title: t('offline.badge'),
        message: t('offline.noConnectionToast'),
      });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t, pushToast]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      let payload = null;
      if (typeof launcher?.minecraftGetNews === 'function') {
        payload = await launcher.minecraftGetNews({ limit: 24 });
      }
      if (!payload || !payload.items || payload.items.length === 0) {
        payload = await loadMinecraftNews({ limit: 24 });
      }

      if (!payload) {
        setNewsError(t('news.errorNoNewsFound'));
        return;
      }
      if (payload.error && (!payload.items || payload.items.length === 0)) {
        setNewsError(payload.error);
        return;
      }
      if (Array.isArray(payload)) {
        setNewsItems(payload);
        return;
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      setNewsItems(items);
      if (payload.sourceUrl) {
        setNewsSourceUrl(payload.sourceUrl);
      }
    } catch (error) {
      try {
        const fallbackPayload = await loadMinecraftNews({ limit: 16 });
        if (fallbackPayload?.items?.length > 0) {
          setNewsItems(fallbackPayload.items);
          return;
        }
      } catch { }
      setNewsError(error?.message || t('news.errorNoNewsFound'));
    } finally {
      setNewsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const persistState = useCallback((updates = {}) => {
    const currentState = stateRef.current;
    const nextState = {
      profiles: updates.profiles !== undefined ? updates.profiles : currentState.profiles,
      activeProfileId: updates.activeProfileId !== undefined ? updates.activeProfileId : currentState.activeProfileId,
      mods: updates.mods !== undefined ? updates.mods : currentState.mods,
      logs: updates.logs !== undefined ? updates.logs : currentState.logs,
      versions: updates.versions !== undefined ? updates.versions : currentState.versionCatalog,
      installTargets: updates.installTargets !== undefined ? updates.installTargets : currentState.installTargets,
      settings: updates.settings !== undefined ? updates.settings : currentState.settings,
    };
    stateRef.current = { ...currentState, ...nextState, versionCatalog: nextState.versions, logs: nextState.logs };
    launcher.minecraftSaveState?.(nextState);
  }, []);

  // Event listeners for installation and launcher lifecycle + state hydration
  useEffect(() => {
    const installProgressOff = launcher.on?.('minecraft:install-progress', (p) => {
      if (typeof p?.percent === 'number' && Number.isFinite(p.percent)) setProgress(p.percent);
      if (p?.message) addLog('info', p.message);
      if (p?.installId) setInstallId(p.installId);
    });

    const installFileOff = launcher.on?.('minecraft:install-file-progress', (f) => {
      if (typeof f?.percent === 'number' && Number.isFinite(f.percent)) {
        setProgress(f.percent);
      }
    });

    const installCompleteOff = launcher.on?.('minecraft:install-complete', (r) => {
      addLog('success', `Installation completed: ${r?.version || r?.label || 'version'}`);
      setProgress(100);
      setInstallId(null);
      launcher.minecraftGetInstalledVersions?.().then((versions) => {
        if (Array.isArray(versions)) {
          setInstalledVersions(versions);
          const currentProfiles = stateRef.current.profiles;
          const curActiveId = stateRef.current.activeProfileId;
          const curActiveProfile = currentProfiles.find(p => p.id === curActiveId);
          if (versions.length > 0 && !curActiveProfile?.version) {
            const nextProfiles = currentProfiles.map(p => p.id === curActiveId ? { ...p, version: versions[0].id } : p);
            setProfiles(nextProfiles);
            persistState({ profiles: nextProfiles });
          }
        }
      });
    });

    const installErrorOff = launcher.on?.('minecraft:install-error', (e) => {
      addLog('error', `Installation error: ${e?.message || e}`);
      setInstallId(null);
    });

    const installCancelledOff = launcher.on?.('minecraft:install-cancelled', (e) => {
      addLog('info', `Installation cancelled: ${e?.message || 'user cancelled'}`);
      setInstallId(null);
    });

    const updateStatusOff = launcher.on?.('minecraft:update-status', (u) => {
      if (u?.phase) {
        setUpdateState(prev => ({
          ...prev,
          phase: u.phase,
          message: u.message || '',
          currentVersion: u.currentVersion,
          latestVersion: u.latestVersion,
        }));
      }
    });

    const updateProgressOff = launcher.on?.('minecraft:update-progress', (u) => {
      if (typeof u?.percent === 'number') {
        setUpdateState(prev => ({
          ...prev,
          phase: u.phase || 'downloading',
          progress: u.percent,
          assetName: u.assetName,
        }));
      }
    });

    const updateCompleteOff = launcher.on?.('minecraft:update-complete', () => {
      setUpdateState(prev => ({
        ...prev,
        phase: 'complete',
        message: 'Update ready',
      }));
    });

    const runLogOff = launcher.on?.('minecraft:run-log', (l) => {
      const type = l?.type === 'stderr' || l?.type === 'error' ? 'error' : l?.type === 'warn' ? 'warn' : 'info';
      addLog(type, l?.msg || '');
    });

    const assetProgressOff = launcher.on?.('minecraft:asset-progress', (a) => {
      if (typeof a?.percent === 'number' && Number.isFinite(a.percent)) {
        setProgress(a.percent);
      }
    });

    const runExitOff = launcher.on?.('minecraft:run-exit', (s) => {
      addLog('info', `Game process exited with code ${s?.code}`);
      setGameState('idle');
      setRunPid(null);
    });

    const modConflictOff = launcher.on?.('minecraft:mod-conflict', (conflictData) => {
      setModConflict(conflictData);
    });

    const openAboutOff = launcher.on?.('app:open-about', () => {
      setModal('about');
    });

    const initializeLauncher = async () => {
      try {
        const state = await launcher.minecraftGetState();
        if (state?.profiles && Array.isArray(state.profiles) && state.profiles.length > 0) {
          setProfiles(state.profiles);
          const activeId = state.activeProfileId && state.profiles.some(p => p.id === state.activeProfileId)
            ? state.activeProfileId
            : state.profiles[0].id;
          setActiveProfileId(activeId);
        } else {
          const defaultProfile = {
            id: 'default',
            name: 'Default',
            localName: 'Player',
            version: null,
            ram: 4,
            jvmArguments: '',
            javaPath: '',
          };
          setProfiles([defaultProfile]);
          setActiveProfileId('default');
        }

        if (state?.settings) {
          setSettings(prev => ({
            ...prev,
            ...state.settings,
            language: state.settings.language || language,
          }));
        }

        if (state?.mods && Array.isArray(state.mods)) {
          setMods(state.mods);
        }

        if (state?.logs && Array.isArray(state.logs)) {
          setLogs(state.logs);
        }

        const rootRes = await launcher.minecraftGetRoot?.();
        if (rootRes?.root) {
          setSettings(prev => ({ ...prev, minecraftRoot: rootRes.root }));
        }

        const instVers = await launcher.minecraftGetInstalledVersions?.();
        if (Array.isArray(instVers)) {
          setInstalledVersions(instVers);
        }

        const instMods = await launcher.minecraftGetInstalledMods?.();
        if (Array.isArray(instMods)) {
          setMods(instMods);
        }

        let snapshot = null;
        if (launcher.minecraftGetCatalog) {
          snapshot = await launcher.minecraftGetCatalog({ includeSnapshots: state?.settings?.showSnapshots === true });
        }
        if (!snapshot || !snapshot.versions || snapshot.versions.length === 0) {
          snapshot = await loadLauncherCatalog({ includeSnapshots: state?.settings?.showSnapshots === true });
        }

        if (snapshot?.versions?.length > 0) {
          setVersionCatalog(snapshot.versions);
        }
        if (snapshot?.installTargets) {
          setInstallTargets(snapshot.installTargets);
        }
      } catch (err) {
        console.error('Failed to initialize launcher state:', err);
      } finally {
        setStateHydrated(true);
      }
    };

    launcher.getAppVersion?.()
      .then(ver => {
        if (ver) setAppVersion(String(ver));
      })
      .catch(() => { });

    launcher.getSystemInfo?.()
      .then(info => {
        if (info?.totalRamGb && info.totalRamGb > 0) {
          setSystemTotalRam(info.totalRamGb);
        }
      })
      .catch(() => { });

    initializeLauncher();
    loadNews();

    return () => {
      installProgressOff?.();
      installFileOff?.();
      installCompleteOff?.();
      installErrorOff?.();
      installCancelledOff?.();
      updateStatusOff?.();
      updateProgressOff?.();
      updateCompleteOff?.();
      runLogOff?.();
      assetProgressOff?.();
      runExitOff?.();
      modConflictOff?.();
      openAboutOff?.();
    };
  }, [addLog, loadNews, language, persistState]);

  const handleOpenNewsSource = () => {
    launcher.openExternal?.(newsSourceUrl).catch(() => { });
  };

  const handleOpenNewsArticle = (url) => {
    launcher.openExternal?.(url).catch(() => { });
  };

  const handleOpenSourceCode = () => {
    launcher.openExternal?.(APP_SOURCE_URL).catch(() => { });
  };

  const handleOpenReleases = () => {
    launcher.openExternal?.(APP_RELEASES_URL).catch(() => { });
  };

  // Account sync with active profile
  useEffect(() => {
    if (!activeProfile) return;
    const profileKey = String(activeProfile.id || 'default');
    let isMounted = true;
    setAuthRefreshing(true);

    launcher.minecraftGetAuthState(profileKey)
      .then(auth => {
        if (!isMounted) return;
        if (auth?.loggedIn && auth.name) {
          setAccount({
            name: auth.name,
            loggedIn: true,
            profileKey,
            kind: 'microsoft',
            session: auth,
          });
          if (activeProfile.skinName !== auth.name || activeProfile.microsoftAccount !== auth.name) {
            setProfiles(prev => {
              const next = prev.map(p => p.id === profileKey ? { ...p, skinName: auth.name, microsoftAccount: auth.name, localName: auth.name } : p);
              persistState({ profiles: next, activeProfileId: profileKey });
              return next;
            });
          }
        } else {
          const fallbackName = String(activeProfile.skinName || activeProfile.localName || activeProfile.name || '').trim();
          if (fallbackName) {
            setAccount({
              name: fallbackName,
              loggedIn: true,
              profileKey,
              kind: 'local',
              session: createOfflineSession(fallbackName),
            });
          } else {
            setAccount({ name: '', loggedIn: false, profileKey, kind: 'none', session: null });
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallbackName = String(activeProfile.skinName || activeProfile.localName || activeProfile.name || '').trim();
        setAccount({
          name: fallbackName,
          loggedIn: Boolean(fallbackName),
          profileKey,
          kind: fallbackName ? 'local' : 'none',
          session: fallbackName ? createOfflineSession(fallbackName) : null,
        });
      })
      .finally(() => {
        if (isMounted) setAuthRefreshing(false);
      });

    return () => { isMounted = false; };
  }, [activeProfile?.id, activeProfile?.localName, activeProfile?.name, activeProfile?.skinName, activeProfile?.microsoftAccount]);

  const handleSaveProfile = (profileData) => {
    setProfiles(prev => {
      let next;
      const targetId = profileData.id || `profile-${Date.now()}`;
      if (profileData.id) {
        next = prev.map(p => p.id === profileData.id ? { ...p, ...profileData } : p);
      } else {
        const newProfile = { ...profileData, id: targetId };
        next = [...prev, newProfile];
        setActiveProfileId(targetId);
      }
      persistState({
        profiles: next,
        activeProfileId: profileData.id ? activeProfileId : targetId,
      });
      return next;
    });
  };

  const handleDeleteProfile = (profileId) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== profileId);
      let nextActiveId = activeProfileId;
      if (next.length === 0) {
        const defaultProfile = {
          id: 'default',
          name: 'Default',
          localName: 'Player',
          version: null,
          ram: 4,
          jvmArguments: '',
          javaPath: '',
        };
        next.push(defaultProfile);
        nextActiveId = 'default';
      } else if (activeProfileId === profileId) {
        nextActiveId = next[0].id;
      }
      if (nextActiveId !== activeProfileId) {
        setActiveProfileId(nextActiveId);
      }
      persistState({
        profiles: next,
        activeProfileId: nextActiveId,
      });
      return next;
    });
  };

  const handleDuplicateProfile = (profileId, e) => {
    e?.stopPropagation();
    const sourceProfile = profiles.find(p => p.id === profileId);
    if (!sourceProfile) return;
    const newId = `profile-${Date.now()}`;
    const duplicatedProfile = {
      ...sourceProfile,
      id: newId,
      name: `${sourceProfile.name} (Copy)`,
    };
    setProfiles(prev => {
      const next = [...prev, duplicatedProfile];
      setActiveProfileId(newId);
      persistState({
        profiles: next,
        activeProfileId: newId,
      });
      return next;
    });
  };

  const handleInstall = async (type, opts) => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: t('install.minecraft') || 'Install',
        message: t('offline.installRequiresInternet'),
      });
      return;
    }
    const installPayload = typeof opts === 'string' ? { version: opts } : (opts || {});
    addLog('info', `Starting ${type} installation...`);
    setActiveTab('console');
    setProgress(0);
    try {
      const res = await launcher.minecraftInstall({ type, ...installPayload });
      if (res?.error) {
        addLog('error', `Installation failed: ${res.message || res.error}`);
        setInstallId(null);
      } else if (res?.installId) {
        setInstallId(res.installId);
      }
    } catch (e) {
      addLog('error', `Install launch failed: ${e?.message || e}`);
      setInstallId(null);
    }
  };

  const handleCancelInstall = async () => {
    if (!installId) return;
    try {
      await launcher.minecraftInstallCancel({ installId });
    } catch (e) {
      addLog('error', `Failed to cancel install: ${e?.message || e}`);
    }
  };

  const handlePlay = async () => {
    if (gameState === 'running') {
      if (runPid) {
        try {
          await launcher.minecraftStop({ pid: runPid });
          setGameState('idle');
          setRunPid(null);
        } catch (e) {
          addLog('error', `Failed to stop game: ${e?.message || e}`);
        }
      }
      return;
    }

    if (!activeProfile) return;
    setLogs([]);
    persistState({ logs: [] });
    setGameState('loading');
    setProgress(0);
    if (settings.showConsole !== false) {
      setActiveTab('console');
    }
    addLog('info', `Launching profile: ${activeProfile.name}`);

    try {
      const runOpts = {
        profile: activeProfile,
        version: activeVersion || activeProfile?.version,
        session: account.session || createOfflineSession(activeProfile.localName || 'Player'),
      };
      const res = await launcher.minecraftRun(runOpts);
      if (res?.error) {
        addLog('error', `Launch failed: ${res.message || res.error}`);
        setGameState('idle');
        return;
      }
      if (res?.pid) {
        setRunPid(res.pid);
        setGameState('running');
        addLog('success', `Minecraft process started (PID: ${res.pid})`);
      }
    } catch (e) {
      addLog('error', `Launch exception: ${e?.message || e}`);
      setGameState('idle');
    }
  };

  const handleSettingChange = (key, val) => {
    setSettings(prev => {
      const next = { ...prev, [key]: val };
      persistState({
        profiles,
        mods,
        logs,
        versions: versionCatalog,
        installTargets,
        settings: next,
      });
      if (key === 'showSnapshots') {
        const refreshCatalog = async () => {
          let catalog = null;
          if (launcher.minecraftGetCatalog) {
            catalog = await launcher.minecraftGetCatalog({ showSnapshots: Boolean(val) });
          } else {
            catalog = await fetchVersionCatalog(Boolean(val));
          }
          if (catalog?.versions) setVersionCatalog(catalog.versions);
          if (catalog?.installTargets) setInstallTargets(catalog.installTargets);
        };
        refreshCatalog().catch(() => { });
      }
      return next;
    });
  };

  const handleLogin = async () => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: t('account.loginWithMicrosoft'),
        message: t('offline.loginRequiresInternet'),
      });
      return;
    }
    const profileKey = String(activeProfile?.id || 'default');
    setLoginLoading(true);
    addLog('info', t('account.loginWithMicrosoft') + '...');
    const abortController = new AbortController();
    loginAbortControllerRef.current = abortController;

    try {
      const accountInfo = await minecraftLoginWithAbort(profileKey, abortController.signal);
      if (accountInfo?.error) {
        if (accountInfo.cancelled) {
          addLog('info', t('account.loginCancelled'));
        } else {
          addLog('error', `Login failed: ${accountInfo.error}`);
          pushToast({
            tone: 'error',
            title: t('account.loginWithMicrosoft'),
            message: accountInfo.error,
          });
        }
        return;
      }

      if (accountInfo?.name) {
        setAccount({
          name: accountInfo.name,
          loggedIn: true,
          profileKey,
          kind: 'microsoft',
          session: accountInfo,
        });
        setProfiles(prev => {
          const next = prev.map(p => {
            if (p.id === profileKey) {
              return {
                ...p,
                skinName: accountInfo.name,
                microsoftAccount: accountInfo.name,
                localName: accountInfo.name,
              };
            }
            return p;
          });
          persistState({ profiles: next, activeProfileId: profileKey });
          return next;
        });
        addLog('success', `Logged in as ${accountInfo.name}`);
        pushToast({
          tone: 'success',
          title: t('account.loginWithMicrosoft'),
          message: t('messages.loginSuccess', { name: accountInfo.name }),
        });
      } else {
        addLog('error', 'Login did not return account information.');
      }
    } catch (error) {
      if (error?.name === 'AbortError' || error?.message?.includes('cancelled')) {
        addLog('info', t('account.loginCancelled'));
      } else {
        addLog('error', `Login failed: ${error?.message || error}`);
        pushToast({
          tone: 'error',
          title: t('account.loginWithMicrosoft'),
          message: error?.message || t('messages.loginFailed', { error: '' }),
        });
      }
    } finally {
      setLoginLoading(false);
      loginAbortControllerRef.current = null;
    }
  };

  const handleLogout = async () => {
    const profileKey = String(activeProfile?.id || 'default');
    try {
      await launcher.minecraftLogout(profileKey);
      const fallbackName = (activeProfile?.name && activeProfile?.name !== 'Default') ? activeProfile.name : 'Player';
      setProfiles(prev => {
        const next = prev.map(p => {
          if (p.id === profileKey) {
            return {
              ...p,
              microsoftAccount: '',
              skinName: '',
              localName: fallbackName,
            };
          }
          return p;
        });
        persistState({ profiles: next, activeProfileId: profileKey });
        return next;
      });
      setAccount({
        name: fallbackName,
        loggedIn: Boolean(fallbackName),
        profileKey,
        kind: fallbackName ? 'local' : 'none',
        session: fallbackName ? createOfflineSession(fallbackName) : null,
      });
      addLog('info', 'Logged out from Microsoft.');
      pushToast({
        tone: 'info',
        title: t('account.logout'),
        message: t('messages.logoutSuccess'),
      });
    } catch (e) {
      addLog('error', `Logout failed: ${e?.message || e}`);
    }
  };

  const handleModToggle = async (modId) => {
    const targetMod = mods.find(m => m.id === modId);
    if (!targetMod) return;
    const nextState = !targetMod.enabled;
    try {
      await launcher.minecraftToggleMod(modId, nextState);
      const updated = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updated)) setMods(updated);
    } catch (e) {
      addLog('error', `Failed to toggle mod: ${e?.message || e}`);
    }
  };

  const handleSetAllModsEnabled = async (enable) => {
    try {
      await launcher.minecraftSetAllModsEnabled(enable);
      const updated = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updated)) setMods(updated);
    } catch (e) {
      addLog('error', `Failed to set all mods enabled: ${e?.message || e}`);
    }
  };

  const handleModDelete = async (modId) => {
    try {
      await launcher.minecraftDeleteMod(modId);
      const updated = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updated)) setMods(updated);
    } catch (e) {
      addLog('error', `Failed to delete mod: ${e?.message || e}`);
    }
  };

  const handleAddModClick = async () => {
    try {
      const picked = await launcher.minecraftPickModFiles?.();
      const filePaths = Array.isArray(picked) ? picked : (picked?.filePaths || []);
      if (filePaths.length > 0) {
        for (const filePath of filePaths) {
          await launcher.minecraftInstallModFile(filePath);
        }
        const updated = await launcher.minecraftGetInstalledMods();
        if (Array.isArray(updated)) setMods(updated);
        pushToast({ tone: 'success', title: t('sidebar.modManager'), message: t('mods.modsImportedSuccess', { count: filePaths.length }) });
      }
    } catch (e) {
      addLog('error', `Failed to add mod: ${e?.message || e}`);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []).filter(f =>
      f.name.endsWith('.jar') || f.name.endsWith('.olpkg') || f.name.endsWith('.zip')
    );
    if (files.length === 0) return;

    addLog('info', t('mods.importingCount', { count: files.length }));
    try {
      for (const file of files) {
        const filePath = file.path || file.name;
        await launcher.minecraftInstallModFile(filePath);
      }
      const updated = await launcher.minecraftGetInstalledMods?.();
      if (Array.isArray(updated)) setMods(updated);
      pushToast({ tone: 'success', title: t('sidebar.modManager'), message: t('mods.modsImportedSuccess', { count: files.length }) });
      setActiveTab('mods');
    } catch (err) {
      addLog('error', `Error importing mod files: ${err?.message || err}`);
    }
  };

  // ── Modrinth Search & Install logic ──
  const profileLoader = String(activeVersion?.type || '').toLowerCase();
  const currentLoader = profileLoader.includes('fabric') ? 'fabric' : profileLoader.includes('forge') ? 'forge' : '';
  const currentMcVer = activeProfileVersion?.mcVer || activeVersion?.mcVer || '';

  const effectiveLoader = modrinthLoaderFilter === 'auto' ? currentLoader : (modrinthLoaderFilter === 'all' ? '' : modrinthLoaderFilter);
  const effectiveMcVer = modrinthVersionFilter === 'auto' ? currentMcVer : '';

  const executeModrinthSearch = useCallback(async (isLoadMore = false) => {
    if (!isOnline) {
      setModrinthLoading(false);
      setModrinthLoadingMore(false);
      return;
    }

    if (isLoadMore) {
      if (modrinthLoading || modrinthLoadingMore) return;
      setModrinthLoadingMore(true);
    } else {
      setModrinthLoading(true);
    }

    const currentOffset = isLoadMore ? modrinthResults.length : 0;

    try {
      let data;
      if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthSearch) {
        data = await window.launcher.minecraftModrinthSearch({
          query: modrinthQuery,
          loader: effectiveLoader,
          gameVersion: effectiveMcVer,
          category: modrinthCategory === 'all' ? '' : modrinthCategory,
          sortBy: modrinthSort,
          offset: currentOffset,
          limit: 24,
        });
      } else {
        data = await searchModrinthMods({
          query: modrinthQuery,
          loader: effectiveLoader,
          gameVersion: effectiveMcVer,
          category: modrinthCategory === 'all' ? '' : modrinthCategory,
          sortBy: modrinthSort,
          offset: currentOffset,
          limit: 24,
        });
      }
      if (data?.hits) {
        if (isLoadMore) {
          setModrinthResults(prev => {
            const existingIds = new Set(prev.map(p => p.project_id || p.slug));
            const freshHits = data.hits.filter(h => !existingIds.has(h.project_id || h.slug));
            return [...prev, ...freshHits];
          });
        } else {
          setModrinthResults(data.hits);
        }
        setModrinthTotalHits(data.total_hits || (isLoadMore ? modrinthResults.length + data.hits.length : data.hits.length));
      }
    } catch (e) {
      console.error('Modrinth search failed:', e);
      if (!isLoadMore) {
        pushToast({ tone: 'error', title: 'Modrinth', message: e?.message || 'Failed to search mods.' });
      }
    } finally {
      if (isLoadMore) {
        setModrinthLoadingMore(false);
      } else {
        setModrinthLoading(false);
      }
    }
  }, [isOnline, modrinthQuery, effectiveLoader, effectiveMcVer, modrinthCategory, modrinthSort, modrinthLoading, modrinthLoadingMore, modrinthResults.length, pushToast]);

  useEffect(() => {
    if (activeTab === 'mods' && modsSubTab === 'browse') {
      if (!isOnline) return;
      const timer = setTimeout(() => {
        executeModrinthSearch(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, modsSubTab, isOnline, modrinthQuery, effectiveLoader, effectiveMcVer, modrinthCategory, modrinthSort]);

  const hasMoreModrinth = modrinthResults.length < modrinthTotalHits;

  useEffect(() => {
    if (activeTab !== 'mods' || modsSubTab !== 'browse') return;
    if (!isOnline || !hasMoreModrinth || modrinthLoading || modrinthLoadingMore) return;

    const sentinel = modrinthSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        executeModrinthSearch(true);
      }
    }, { rootMargin: '250px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, modsSubTab, isOnline, hasMoreModrinth, modrinthLoading, modrinthLoadingMore, executeModrinthSearch]);

  const handleInstallModrinthMod = async (project) => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: 'Modrinth',
        message: t('offline.noConnectionToast'),
      });
      return;
    }
    const projectId = project.project_id || project.slug;
    setModrinthInstalling(prev => ({ ...prev, [projectId]: true }));
    addLog('info', `Installing mod '${project.title || projectId}' from Modrinth...`);

    try {
      let res;
      if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthInstall) {
        res = await window.launcher.minecraftModrinthInstall({
          projectId,
          gameVersion: effectiveMcVer || currentMcVer,
          loader: effectiveLoader || currentLoader,
        });
      } else {
        res = { ok: true, fileName: `${projectId}.jar`, mods };
      }

      if (res?.ok) {
        if (Array.isArray(res.mods)) setMods(res.mods);
        addLog('success', `Mod '${project.title || projectId}' installed.`);
        pushToast({
          tone: 'success',
          title: t('mods.install'),
          message: t('mods.installedSuccess', { name: project.title || projectId }),
        });
      } else {
        throw new Error(res?.error || 'Installation failed');
      }
    } catch (err) {
      addLog('error', `Failed to install '${project.title || projectId}': ${err?.message || err}`);
      pushToast({
        tone: 'error',
        title: t('mods.install'),
        message: t('mods.installError', { name: project.title || projectId, error: err?.message || '' }),
      });
    } finally {
      setModrinthInstalling(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleOpenModDetails = (project) => {
    setSelectedModDetail({ project, initialTab: 'overview' });
  };

  const handleInstallSpecificVersion = async (project, version) => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: 'Modrinth',
        message: t('offline.noConnectionToast'),
      });
      return;
    }
    const projectId = project.project_id || project.slug || project.id;
    setInstallingVersionId(version.id);
    const primaryFile = version.files?.find(f => f.primary) || version.files?.[0];
    const verNumber = version.version_number || version.name || '';
    addLog('info', `[Modrinth] Installing ${project.title || projectId} (v${verNumber})...`);

    try {
      let res;
      if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthInstall) {
        res = await window.launcher.minecraftModrinthInstall({
          projectId,
          versionId: version.id,
          fileUrl: primaryFile?.url,
          fileName: primaryFile?.filename,
          gameVersion: version.game_versions?.[0] || effectiveMcVer || currentMcVer,
          loader: version.loaders?.[0] || effectiveLoader || currentLoader,
        });
      } else {
        res = { ok: true, fileName: primaryFile?.filename || `${projectId}.jar`, mods };
      }

      if (res?.ok) {
        if (Array.isArray(res.mods)) setMods(res.mods);
        addLog('success', `[Modrinth] Mod '${project.title || projectId}' (v${verNumber}) installed.`);
        pushToast({
          tone: 'success',
          title: t('mods.install'),
          message: t('mods.installedSuccess', { name: `${project.title || projectId} v${verNumber}` }),
        });
      } else {
        throw new Error(res?.error || 'Installation failed');
      }
    } catch (err) {
      addLog('error', `[Modrinth] Failed to install version: ${err?.message || err}`);
      pushToast({
        tone: 'error',
        title: t('mods.install'),
        message: t('mods.installError', { name: project.title || projectId, error: err?.message || '' }),
      });
    } finally {
      setInstallingVersionId(null);
    }
  };

  const isModInstalled = (project) => {
    const slug = String(project.slug || '').toLowerCase();
    const title = String(project.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return mods.some(m => {
      const mName = String(m.name || m.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return mName.includes(slug) || (title.length > 3 && mName.includes(title));
    });
  };

  const checkingModUpdatesRef = useRef(false);
  const hasCheckedModsOnTabOpenRef = useRef(false);

  const handleCheckModUpdates = useCallback(async (options = {}) => {
    const silent = options?.silent ?? false;
    if (checkingModUpdatesRef.current) return;
    checkingModUpdatesRef.current = true;
    setCheckingModUpdates(true);
    try {
      if (!isOnline) {
        if (!silent) {
          pushToast({
            tone: 'warning',
            title: t('mods.checkUpdates'),
            message: t('offline.noConnectionToast'),
          });
        }
        return;
      }
      const loader = effectiveLoader || currentLoader || 'fabric';
      const gameVersion = effectiveMcVer || currentMcVer || '';

      const res = await launcher.minecraftCheckModUpdates?.({ loader, gameVersion });
      if (res?.updates) {
        setModUpdates(res.updates);
        const count = Object.keys(res.updates).filter(k => k.includes('.jar')).length;
        if (!silent) {
          if (count > 0) {
            pushToast({
              tone: 'success',
              title: t('mods.checkUpdates'),
              message: t('mods.updatesAvailable', { count }),
            });
          } else {
            pushToast({
              tone: 'info',
              title: t('mods.checkUpdates'),
              message: t('mods.upToDate'),
            });
          }
        }
      }
    } catch (e) {
      if (!silent) {
        pushToast({
          tone: 'error',
          title: t('mods.checkUpdates'),
          message: e?.message || String(e),
        });
      }
    } finally {
      checkingModUpdatesRef.current = false;
      setCheckingModUpdates(false);
    }
  }, [isOnline, effectiveLoader, currentLoader, effectiveMcVer, currentMcVer, pushToast, t]);

  const handleUpdateMod = async (updateInfo) => {
    if (!updateInfo) return;
    const key = updateInfo.fileName || updateInfo.fileKey;
    setUpdatingMods(prev => new Set(prev).add(key));
    try {
      const loader = effectiveLoader || currentLoader || 'fabric';
      const gameVersion = effectiveMcVer || currentMcVer || '';
      const res = await launcher.minecraftModrinthInstall?.({
        projectId: updateInfo.projectId,
        versionId: updateInfo.versionId,
        fileUrl: updateInfo.fileUrl,
        fileName: updateInfo.targetFileName || updateInfo.fileName,
        loader,
        gameVersion,
      });

      if (res?.error) {
        pushToast({
          tone: 'error',
          title: t('mods.updateMod'),
          message: res.message || res.error,
        });
        return;
      }

      if (res?.mods && Array.isArray(res.mods)) {
        setMods(res.mods);
      } else {
        const loadedMods = await launcher.minecraftGetInstalledMods?.();
        if (Array.isArray(loadedMods)) setMods(loadedMods);
      }

      setModUpdates(prev => {
        const next = { ...prev };
        delete next[updateInfo.fileName];
        delete next[updateInfo.fileKey];
        return next;
      });

      pushToast({
        tone: 'success',
        title: t('mods.updateMod'),
        message: t('mods.installedSuccess', { name: updateInfo.newVersionName || updateInfo.fileName }),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('mods.updateMod'),
        message: e?.message || String(e),
      });
    } finally {
      setUpdatingMods(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleUpdateAllMods = async () => {
    const updateEntries = Object.values(modUpdates).filter((u, i, arr) => arr.findIndex(x => x.fileName === u.fileName) === i);
    if (updateEntries.length === 0) return;
    for (const updateInfo of updateEntries) {
      await handleUpdateMod(updateInfo);
    }
  };

  const handleResolveConflictUpdate = async (rec) => {
    if (!rec) return;
    try {
      pushToast({
        tone: 'info',
        title: t('mods.updating'),
        message: `${rec.displayName || rec.modId} -> v${rec.targetVersion}`,
      });
      const loader = currentLoader || 'fabric';
      const gameVersion = currentMcVer || '';
      const res = await launcher.minecraftModrinthInstall?.({
        projectId: rec.modId,
        versionId: null,
        versionNumber: rec.targetVersion,
        loader,
        gameVersion,
      });
      if (res?.error) {
        pushToast({
          tone: 'error',
          title: t('mods.conflictTitle'),
          message: res.message || res.error,
        });
        return;
      }
      if (res?.mods && Array.isArray(res.mods)) {
        setMods(res.mods);
      } else {
        const loadedMods = await launcher.minecraftGetInstalledMods?.();
        if (Array.isArray(loadedMods)) setMods(loadedMods);
      }
      setModConflict(null);
      pushToast({
        tone: 'success',
        title: t('mods.installedSuccess', { name: rec.displayName || rec.modId }),
        message: t('mods.installedSuccess', { name: rec.displayName || rec.modId }),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('mods.conflictTitle'),
        message: e?.message || String(e),
      });
    }
  };

  const [fixingAllConflicts, setFixingAllConflicts] = useState(false);

  const handleAutoFixAllConflicts = async (compatFixes) => {
    if (!compatFixes || compatFixes.length === 0) return;
    setFixingAllConflicts(true);
    pushToast({
      tone: 'info',
      title: t('mods.conflictFixAllBtn'),
      message: t('mods.conflictFixing'),
    });
    try {
      const loader = currentLoader || 'fabric';
      const gameVersion = currentMcVer || '';

      for (const fix of compatFixes) {
        // Install base compatible version
        await launcher.minecraftModrinthInstall?.({
          projectId: fix.modId,
          versionNumber: fix.targetVersion,
          loader,
          gameVersion,
        });

        // Cascade updates/downgrades for companion mods
        if (Array.isArray(fix.cascade)) {
          for (const item of fix.cascade) {
            const isInstalled = mods.some(m => {
              const mId = String(m.id || '').toLowerCase();
              const mFile = String(m.fileName || '').toLowerCase();
              return mId === item.modId || mFile.startsWith(`${item.modId}-`);
            });
            if (isInstalled) {
              await launcher.minecraftModrinthInstall?.({
                projectId: item.modId,
                versionNumber: item.targetVersion,
                loader,
                gameVersion,
              });
            }
          }
        }
      }

      // Re-enable Iris if it was disabled
      const irisMod = mods.find(m => String(m.id || '').toLowerCase() === 'iris' || String(m.fileName || '').toLowerCase().includes('iris'));
      if (irisMod && !irisMod.enabled) {
        await launcher.minecraftToggleMod?.(irisMod.id || irisMod.fileName, true);
      }

      const refreshed = await launcher.minecraftGetInstalledMods?.();
      if (Array.isArray(refreshed)) setMods(refreshed);
      setModConflict(null);

      pushToast({
        tone: 'success',
        title: t('mods.conflictFixAllBtn'),
        message: t('mods.conflictFixedSuccess'),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('mods.conflictTitle'),
        message: e?.message || String(e),
      });
    } finally {
      setFixingAllConflicts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mods' && isOnline) {
      if (!hasCheckedModsOnTabOpenRef.current) {
        hasCheckedModsOnTabOpenRef.current = true;
        handleCheckModUpdates({ silent: true });
      }
    } else {
      hasCheckedModsOnTabOpenRef.current = false;
    }
  }, [activeTab, isOnline]);

  const handleCheckForUpdates = async () => {
    addLog('info', 'Checking for launcher updates...');
    try {
      const res = await launcher.minecraftCheckUpdate?.();
      if (res?.upToDate) {
        pushToast({ tone: 'info', title: t('update.launcherUpdate'), message: t('messages.alreadyUpToDate') });
      }
    } catch (e) {
      addLog('error', `Update check failed: ${e?.message || e}`);
    }
  };

  const handleOpenMinecraftDirectory = async () => {
    try {
      await launcher.minecraftOpenRootDirectory?.();
    } catch (e) {
      addLog('error', `Failed to open directory: ${e?.message || e}`);
    }
  };

  const handleCopyConsole = () => {
    const text = logs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
    navigator.clipboard?.writeText(text);
    pushToast({ tone: 'info', title: t('console.copy'), message: t('console.copiedToClipboard') });
  };

  const handleClearConsole = () => {
    setLogs([]);
    persistState({ logs: [] });
  };

  // Avatar resolution helper
  const profileAvatarName = (account.loggedIn && account.name)
    ? account.name
    : (activeProfile?.skinName || activeProfile?.microsoftAccount || (activeProfile?.localName && activeProfile?.localName !== 'Player' ? activeProfile?.localName : '') || 'MHF_Steve');
  const profileAvatarUrl = getMcHeadsAvatarUrl(profileAvatarName, 64);

  // Version Loader Type badge helper
  const loaderType = String(activeVersion?.type || '').toLowerCase();
  const loaderBadgeClass = loaderType.includes('fabric') ? 'fabric' : loaderType.includes('forge') ? 'forge' : 'vanilla';
  const loaderBadgeLabel = loaderType.includes('fabric') ? 'Fabric' : loaderType.includes('forge') ? 'Forge' : 'Vanilla';

  const profileToEdit = profileEditor?.mode === 'edit'
    ? profiles.find(p => p.id === profileEditor.profileId) || null
    : null;

  return (
    <>
      <div className="toast-stack" aria-live="polite">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </div>

      {/* ── WINDOW TITLEBAR ── */}
      <div className="titlebar">
        <div className="titlebar-brand">
          <div className="titlebar-logo">
            <img src={logoIcon} alt="Logo" style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="titlebar-name">{t('app.name')}</span>
          <span className="titlebar-version">{appVersion ? `v${appVersion}` : '1.0.0'}</span>
        </div>
        {!launcher?.isMac && launcher?.platform !== 'darwin' && (
          <div className="titlebar-controls">
            <button className="win-btn" onClick={() => launcher.windowMinimize()} title={t('window.minimize')}>
              <Icon d={ICONS.minimize} size={11} />
            </button>
            <button className="win-btn" onClick={() => launcher.windowMaximize()} title={t('window.maximize')}>
              <Icon d={ICONS.maximize} size={10} />
            </button>
            <button className="win-btn close" onClick={() => launcher.windowClose()} title={t('window.close')}>
              <Icon d={ICONS.x} size={11} />
            </button>
          </div>
        )}
      </div>

      {/* ── APP LAYOUT ── */}
      <div className="app-layout">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <div className="sidebar-heading">
              <span className="sidebar-title">{t('sidebar.profiles')}</span>
            </div>

            <div className="profile-list">
              {profiles.map(p => {
                const installedProfileVersion = p.version
                  ? installedVersions.find(v => v.id === p.version) || getVersionById(p.version, versionCatalog)
                  : null;
                const profileVersionLabel = installedProfileVersion?.mcVer || 'Auto';
                const isSelected = p.id === activeProfileId;
                const avatarName = (account.loggedIn && account.profileKey === p.id && account.name)
                  ? account.name
                  : (p.skinName || p.microsoftAccount || (p.localName && p.localName !== 'Player' ? p.localName : '') || 'MHF_Steve');

                return (
                  <div
                    key={p.id}
                    className={`profile-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (authRefreshing || gameState === 'running') return;
                      setActiveProfileId(p.id);
                      persistState({ activeProfileId: p.id });
                    }}
                  >
                    <div className="profile-avatar">
                      <img
                        key={`profile-avatar-${p.id}-${avatarName}`}
                        src={getMcHeadsAvatarUrl(avatarName, 64)}
                        alt={avatarName}
                        onLoad={(e) => {
                          e.currentTarget.style.display = 'block';
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="profile-info">
                      <div className="profile-name-row">
                        <span className="profile-name">{p.name}</span>
                        <ProfileCardActions
                          active={isSelected}
                          name={p.name}
                          disabled={authRefreshing || gameState === 'running'}
                          onEdit={(e) => {
                            e.stopPropagation();
                            setProfileEditor({ mode: 'edit', profileId: p.id });
                          }}
                          onDuplicate={(e) => handleDuplicateProfile(p.id, e)}
                          onDelete={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(p.id);
                          }}
                        />
                      </div>
                      <div className="profile-badges-row">
                        <span className="profile-chip version">{profileVersionLabel}</span>
                        <span className="profile-chip">{p.ram || 4} GB</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                className="add-profile-btn"
                onClick={() => setProfileEditor({ mode: 'new', profileId: null })}
                disabled={authRefreshing || gameState === 'running'}
              >
                <Icon d={ICONS.plus} size={13} />
                <span>{t('sidebar.newProfile')}</span>
              </button>
            </div>

            <div className="sidebar-heading" style={{ marginTop: 10 }}>
              <span className="sidebar-title">{t('sidebar.navigation')}</span>
            </div>

            <div className="sidebar-nav">
              <div
                className={`nav-item ${activeTab === 'news' ? 'active' : ''}`}
                onClick={() => setActiveTab('news')}
              >
                <span className="nav-icon"><Icon d={ICONS.news} size={14} /></span>
                <span>{t('sidebar.news')}</span>
              </div>
              <div
                className={`nav-item ${activeTab === 'mods' ? 'active' : ''}`}
                onClick={() => setActiveTab('mods')}
              >
                <span className="nav-icon"><Icon d={ICONS.cube} size={14} /></span>
                <span>{t('sidebar.modManager')}</span>
                <span className="nav-counter">{mods.filter(m => m.enabled).length}</span>
              </div>
              <div
                className={`nav-item ${activeTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                <span className="nav-icon"><Icon d={ICONS.console} size={14} /></span>
                <span>{t('sidebar.console')}</span>
                {gameState === 'running' && <span className="status-dot in-game" style={{ marginLeft: 'auto' }} />}
              </div>
            </div>
          </div>

          {/* ── ACCOUNT AREA ── */}
          <div className="sidebar-account">
            <div className="account-card">
              <div className="account-avatar">
                <img
                  key={`account-avatar-${profileAvatarName}`}
                  src={profileAvatarUrl}
                  alt={profileAvatarName}
                  onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="account-info">
                <span className="account-name">{account.name || t('account.loggedOut')}</span>
                <span className="account-status-label">
                  <span className={`status-dot ${gameState === 'running' ? 'in-game' : account.loggedIn ? 'online' : ''}`} />
                  {authRefreshing ? (
                    <span>{t('account.refreshingAuth')}</span>
                  ) : gameState === 'running' ? (
                    <span>{t('account.inGame')}</span>
                  ) : account.kind === 'microsoft' ? (
                    <span>{t('account.microsoftBadge')}</span>
                  ) : account.loggedIn ? (
                    <span>{t('account.offline')}</span>
                  ) : (
                    <span>{t('account.guest')}</span>
                  )}
                </span>
              </div>
              {account.kind === 'microsoft' ? (
                <button className="account-auth-btn logout" onClick={handleLogout} title={t('account.logout')}>
                  <Icon d={ICONS.logout} size={12} />
                </button>
              ) : (
                <button className="account-auth-btn" onClick={handleLogin} title={t('account.loginWithMicrosoft')}>
                  <MicrosoftLogo />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="main-content">
          {/* Top Action Toolbar */}
          <div className="action-bar">
            <div className="action-bar-tabs">
              <button
                className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
                onClick={() => setActiveTab('news')}
              >
                <Icon d={ICONS.news} size={13} />
                <span>{t('sidebar.news')}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'mods' ? 'active' : ''}`}
                onClick={() => setActiveTab('mods')}
              >
                <Icon d={ICONS.cube} size={13} />
                <span>{t('sidebar.modManager')}</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                <Icon d={ICONS.console} size={13} />
                <span>{t('sidebar.console')}</span>
              </button>
            </div>

            <div className="action-bar-actions">
              {!isOnline && (
                <div className="offline-pill" title={t('offline.newsDesc')}>
                  <Icon d={ICONS.wifiOff} size={12} />
                  <span>{t('offline.badge')}</span>
                </div>
              )}
              <button
                className="btn-secondary"
                onClick={() => setModal('install-minecraft')}
                disabled={gameState === 'running'}
                title={t('install.minecraft')}
              >
                <Icon d={ICONS.download} size={12} />
                <span>{t('install.minecraft')}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => setModal('install-fabric')}
                disabled={gameState === 'running'}
                title={t('install.fabric')}
              >
                <Icon d={ICONS.download} size={12} />
                <span>{t('install.fabric')}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => setModal('install-forge')}
                disabled={gameState === 'running'}
                title={t('install.forge')}
              >
                <Icon d={ICONS.download} size={12} />
                <span>{t('install.forge')}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={handleOpenMinecraftDirectory}
                title={t('settings.openMinecraftDirectory')}
              >
                <Icon d={ICONS.folder} size={12} />
              </button>
              <button
                className="btn-secondary"
                onClick={() => setModal('settings')}
                title={t('settings.title')}
              >
                <Icon d={ICONS.settings} size={12} />
              </button>
            </div>
          </div>

          {/* Update Notification Banner */}
          {updateState.phase === 'downloading' || updateState.phase === 'launching' || updateState.phase === 'complete' ? (
            <div className="update-banner">
              <div className="update-banner-header">
                <span className="update-banner-title">{t('update.launcherUpdate')} — {updateState.latestVersion || ''}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>
                  {updateState.phase === 'downloading' ? `${updateState.progress || 0}%` : updateState.phase}
                </span>
              </div>
              <div className="update-banner-progress">
                <div className="update-banner-fill" style={{ width: `${Math.max(0, Math.min(100, updateState.progress || 0))}%` }} />
              </div>
            </div>
          ) : null}

          {/* ── TAB: NEWS ── */}
          <div className="tab-panel" style={{ display: activeTab === 'news' ? 'flex' : 'none' }}>
            <div className="news-header">
              <div>
                <h2 className="news-title">{t('news.title')}</h2>
                <div className="news-subtitle">{t('news.subtitle')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" type="button" onClick={loadNews} disabled={newsLoading}>
                  <Icon d={ICONS.refresh} size={11} />
                  {newsLoading ? t('news.loading') : t('news.refresh')}
                </button>
                <button className="btn-primary" type="button" onClick={handleOpenNewsSource} style={{ fontSize: 12, padding: '6px 12px' }}>
                  <Icon d={ICONS.external} size={11} />
                  {t('news.openSource')}
                </button>
              </div>
            </div>

            {!isOnline && newsItems.length === 0 ? (
              <EmptyState
                icon={ICONS.wifiOff}
                title={t('offline.newsTitle')}
                description={t('offline.newsDesc')}
                actionText={t('news.refresh')}
                actionIcon={ICONS.refresh}
                onAction={loadNews}
              />
            ) : newsError ? (
              <EmptyState
                icon={ICONS.news}
                title={t('news.errorTitle')}
                description={newsError}
                actionText={t('news.refresh')}
                actionIcon={ICONS.refresh}
                onAction={loadNews}
                secondaryText={t('news.openSource')}
                onSecondary={handleOpenNewsSource}
              />
            ) : newsLoading && newsItems.length === 0 ? (
              <div className="news-grid">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="news-card-skeleton">
                    <div className="skeleton-media" />
                    <div className="skeleton-body">
                      <div className="skeleton-line short" />
                      <div className="skeleton-line" />
                      <div className="skeleton-line sub" />
                    </div>
                  </div>
                ))}
              </div>
            ) : newsItems.length === 0 ? (
              <EmptyState
                icon={ICONS.news}
                title={t('news.emptyTitle')}
                description={t('news.emptyText')}
                actionText={t('news.refresh')}
                actionIcon={ICONS.refresh}
                onAction={loadNews}
                secondaryText={t('news.openSource')}
                onSecondary={handleOpenNewsSource}
              />
            ) : (
              <div className="news-grid">
                {newsItems.map(item => (
                  <NewsCard key={item.url} item={item} onOpen={handleOpenNewsArticle} />
                ))}
              </div>
            )}
          </div>

          {/* ── TAB: MODS ── */}
          <div
            className={`tab-panel ${isDragging ? 'dragging-over' : ''}`}
            style={{ display: activeTab === 'mods' ? 'flex' : 'none', position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="dropzone-overlay">
                <div className="dropzone-content">
                  <Icon d={ICONS.download} size={36} />
                  <span className="dropzone-title">{t('mods.dropzone')}</span>
                  <span className="dropzone-sub">{t('mods.dropzoneSub')}</span>
                </div>
              </div>
            )}

            {/* Sub-tabs header */}
            <div className="mods-header-row">
              <div className="tab-pill-group">
                <button
                  className={`tab-pill ${modsSubTab === 'installed' ? 'active' : ''}`}
                  onClick={() => setModsSubTab('installed')}
                >
                  <Icon d={ICONS.cube} size={13} />
                  <span>{t('mods.tabInstalled')} ({mods.length})</span>
                </button>
                <button
                  className={`tab-pill ${modsSubTab === 'browse' ? 'active' : ''}`}
                  onClick={() => setModsSubTab('browse')}
                >
                  <Icon d={ICONS.download} size={13} />
                  <span>{t('mods.tabBrowse')}</span>
                </button>
              </div>

              {modsSubTab === 'installed' && (
                <div className="mods-header-actions">
                  <span className="mods-count-badge">
                    {mods.filter(m => m.enabled).length}/{mods.length} {t('mods.active')}
                  </span>
                </div>
              )}
            </div>

            {modsSubTab === 'installed' ? (
              <>
                <div className="mods-toolbar">
                  <div className="mods-search-box">
                    <Icon d={ICONS.search} size={13} />
                    <input
                      type="text"
                      className="mods-search-input"
                      placeholder={t('mods.searchPlaceholder')}
                      value={modSearch}
                      onChange={e => setModSearch(e.target.value)}
                    />
                    {modSearch && (
                      <button className="search-clear-btn" onClick={() => setModSearch('')}>
                        <Icon d={ICONS.x} size={11} />
                      </button>
                    )}
                  </div>

                  <div className="mods-toolbar-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => handleCheckModUpdates({ silent: false })}
                      disabled={checkingModUpdates}
                      title={t('mods.checkUpdates')}
                    >
                      <Icon d={ICONS.refresh} size={12} className={checkingModUpdates ? 'spin-infinite' : ''} />
                      <span>{checkingModUpdates ? t('mods.checkingUpdates') : t('mods.checkUpdates')}</span>
                    </button>
                    {Object.keys(modUpdates).filter(k => k.includes('.jar')).length > 0 && (
                      <button
                        className="btn-primary"
                        onClick={handleUpdateAllMods}
                        disabled={updatingMods.size > 0}
                        style={{ fontSize: 12, padding: '6px 14px' }}
                      >
                        <Icon d={ICONS.download} size={12} />
                        <span>{t('mods.updateAll')} ({Object.keys(modUpdates).filter(k => k.includes('.jar')).length})</span>
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => handleSetAllModsEnabled(true)} disabled={mods.length === 0}>
                      {t('mods.enableAll')}
                    </button>
                    <button className="btn-secondary" onClick={() => handleSetAllModsEnabled(false)} disabled={mods.length === 0}>
                      {t('mods.disableAll')}
                    </button>
                    <button className="btn-primary" onClick={handleAddModClick} style={{ fontSize: 12, padding: '6px 14px' }}>
                      <Icon d={ICONS.plus} size={12} />
                      {t('mods.addMod')}
                    </button>
                  </div>
                </div>

                {mods.length === 0 ? (
                  <EmptyState
                    icon={ICONS.cube}
                    title={t('mods.emptyTitle')}
                    description={t('mods.emptyText')}
                    actionText={t('mods.tabBrowse')}
                    actionIcon={ICONS.download}
                    onAction={() => setModsSubTab('browse')}
                    secondaryText={t('settings.openMinecraftDirectory')}
                    onSecondary={handleOpenMinecraftDirectory}
                  />
                ) : (() => {
                  const filtered = mods.filter(mod => String(mod.name || '').toLowerCase().includes(modSearch.toLowerCase()));
                  if (filtered.length === 0) {
                    return (
                      <EmptyState
                        icon={ICONS.search}
                        title={t('mods.noMatchTitle')}
                        description={t('mods.noMatchText')}
                        actionText={t('common.clearSearch')}
                        onAction={() => setModSearch('')}
                      />
                    );
                  }
                  return (
                    <div className="mods-grid">
                      {filtered.map(mod => {
                        const fileKey = mod.fileName ? mod.fileName.replace(/\.jar(\.disabled)?$/i, '').toLowerCase() : '';
                        const updateInfo = modUpdates[mod.fileName] || modUpdates[fileKey] || modUpdates[mod.name] || modUpdates[mod.id] || null;
                        const isUpdating = updatingMods.has(mod.fileName) || updatingMods.has(fileKey);
                        return (
                          <ModCard
                            key={mod.id}
                            mod={mod}
                            updateInfo={updateInfo}
                            updating={isUpdating}
                            onToggle={handleModToggle}
                            onDelete={handleModDelete}
                            onUpdate={handleUpdateMod}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="modrinth-browser">
                <div className="modrinth-beta-notice" role="status">
                  <div className="modrinth-beta-badge">{t('mods.modrinthBetaTitle')}</div>
                  <div className="modrinth-beta-copy">{t('mods.modrinthBetaDescription')}</div>
                </div>
                <div className="modrinth-controls-bar">
                  <div className="mods-search-box modrinth-search-box">
                    <Icon d={ICONS.search} size={14} />
                    <input
                      type="text"
                      className="mods-search-input"
                      placeholder={t('mods.searchModrinthPlaceholder')}
                      value={modrinthQuery}
                      onChange={e => setModrinthQuery(e.target.value)}
                    />
                    {modrinthQuery && (
                      <button className="search-clear-btn" onClick={() => setModrinthQuery('')}>
                        <Icon d={ICONS.x} size={11} />
                      </button>
                    )}
                  </div>

                  <div className="modrinth-filters-row">
                    <div className="modrinth-filter-select-wrapper">
                      <span className="modrinth-filter-label">{t('mods.filterSort')}:</span>
                      <select
                        className="select-input modrinth-filter-select"
                        value={modrinthSort}
                        onChange={e => setModrinthSort(e.target.value)}
                      >
                        <option value="relevance">{t('mods.sortRelevance')}</option>
                        <option value="downloads">{t('mods.sortDownloads')}</option>
                        <option value="follows">{t('mods.sortFollows')}</option>
                        <option value="newest">{t('mods.sortNewest')}</option>
                        <option value="updated">{t('mods.sortUpdated')}</option>
                      </select>
                    </div>

                    <div className="modrinth-filter-select-wrapper">
                      <span className="modrinth-filter-label">{t('mods.filterLoader')}:</span>
                      <select
                        className="select-input modrinth-filter-select"
                        value={modrinthLoaderFilter}
                        onChange={e => setModrinthLoaderFilter(e.target.value)}
                      >
                        <option value="auto">
                          {currentLoader ? `Auto (${currentLoader.toUpperCase()})` : t('mods.allLoaders')}
                        </option>
                        <option value="fabric">Fabric</option>
                        <option value="forge">Forge</option>
                        <option value="all">{t('mods.allLoaders')}</option>
                      </select>
                    </div>

                    <div className="modrinth-filter-select-wrapper">
                      <span className="modrinth-filter-label">{t('mods.filterVersion')}:</span>
                      <select
                        className="select-input modrinth-filter-select"
                        value={modrinthVersionFilter}
                        onChange={e => setModrinthVersionFilter(e.target.value)}
                      >
                        <option value="auto">
                          {currentMcVer ? `Auto (${currentMcVer})` : t('mods.allVersions')}
                        </option>
                        <option value="all">{t('mods.allVersions')}</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Category Pills */}
                <div className="modrinth-category-pills">
                  {[
                    { id: 'all', label: t('mods.allCategories') },
                    { id: 'optimization', label: 'Optimization' },
                    { id: 'technology', label: 'Technology' },
                    { id: 'adventure', label: 'Adventure' },
                    { id: 'decoration', label: 'Decoration' },
                    { id: 'utility', label: 'Utility' },
                    { id: 'magic', label: 'Magic' },
                    { id: 'worldgen', label: 'World Gen' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      className={`category-pill ${modrinthCategory === cat.id ? 'active' : ''}`}
                      onClick={() => setModrinthCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Modrinth Grid */}
                {!isOnline ? (
                  <EmptyState
                    icon={ICONS.wifiOff}
                    title={t('offline.modrinthTitle')}
                    description={t('offline.modrinthDesc')}
                    actionText={t('mods.tabInstalled')}
                    actionIcon={ICONS.cube}
                    onAction={() => setModsSubTab('installed')}
                  />
                ) : modrinthLoading ? (
                  <div className="modrinth-loading-state">
                    <span className="modrinth-spinner" />
                    <span>{t('account.loading')}</span>
                  </div>
                ) : modrinthResults.length === 0 ? (
                  <EmptyState
                    icon={ICONS.search}
                    title={t('mods.noMatchTitle')}
                    description={t('mods.noModrinthResults')}
                    actionText={t('common.clearSearch')}
                    onAction={() => {
                      setModrinthQuery('');
                      setModrinthCategory('all');
                      setModrinthLoaderFilter('auto');
                      setModrinthVersionFilter('auto');
                    }}
                  />
                ) : (
                  <>
                    <div className="modrinth-grid">
                      {modrinthResults.map(proj => (
                        <ModrinthCard
                          key={proj.project_id || proj.slug}
                          project={proj}
                          installed={isModInstalled(proj)}
                          installing={Boolean(modrinthInstalling[proj.project_id || proj.slug])}
                          onInstall={handleInstallModrinthMod}
                          onOpenDetails={handleOpenModDetails}
                        />
                      ))}
                    </div>
                    <div ref={modrinthSentinelRef} className="modrinth-sentinel">
                      {modrinthLoadingMore && (
                        <div className="modrinth-load-more">
                          <span className="modrinth-spinner small" />
                          <span>{t('account.loading')}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── TAB: CONSOLE ── */}
          <div className="tab-panel" style={{ display: activeTab === 'console' ? 'flex' : 'none' }}>
            <div className="console-wrapper">
              <div className="console-header">
                <div className="console-title">
                  <div className={`console-indicator ${gameState === 'running' ? 'running' : ''}`} />
                  <span>{t('console.outputLog')}</span>
                  {gameState === 'running' && (
                    <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      • {t('console.runningWithPid', { pid: runPid })}
                    </span>
                  )}
                </div>
                <div className="console-actions">
                  <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 6 }}>
                    {['all', 'info', 'warn', 'error'].map(lvl => (
                      <button
                        key={lvl}
                        className={`tab-btn ${logFilter === lvl ? 'active' : ''}`}
                        style={{ fontSize: 10, padding: '2px 8px', textTransform: 'uppercase' }}
                        onClick={() => setLogFilter(lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <button className="btn-secondary" onClick={() => setAutoScroll(prev => !prev)} title={t('console.autoScroll')} style={{ padding: '4px 8px' }}>
                    <Icon d={autoScroll ? ICONS.play : ICONS.stop} size={11} />
                  </button>
                  <button className="btn-secondary" onClick={handleCopyConsole} title={t('console.copy')} style={{ padding: '4px 8px' }}>
                    <Icon d={ICONS.copy} size={11} />
                  </button>
                  <button className="btn-secondary" onClick={handleClearConsole} title={t('console.clear')} style={{ padding: '4px 8px' }}>
                    <Icon d={ICONS.clear} size={11} />
                  </button>
                </div>
              </div>
              <div className="console-body" ref={consoleRef}>
                {logs.length === 0 ? (
                  <div className="console-empty-box">
                    <Icon d={ICONS.console} size={28} />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t('console.noLogsYet')}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{t('console.noLogsYetSub')}</span>
                  </div>
                ) : (() => {
                  const filteredLogs = logs.filter(entry => {
                    if (logFilter === 'all') return true;
                    const entryLevel = String(entry.level || '').toLowerCase();
                    if (logFilter === 'warn') return entryLevel === 'warn' || String(entry.msg || '').includes('WARN');
                    if (logFilter === 'error') return entryLevel === 'error' || String(entry.msg || '').includes('ERROR');
                    if (logFilter === 'info') return entryLevel === 'info' && !String(entry.msg || '').includes('WARN') && !String(entry.msg || '').includes('ERROR');
                    return true;
                  });
                  if (filteredLogs.length === 0) {
                    return <span style={{ color: 'var(--text-faint)', padding: 12 }}>{t('console.noLogsWithFilter', { filter: logFilter })}</span>;
                  }
                  return filteredLogs.map((entry, i) => <LogLine key={i} entry={entry} />);
                })()}
              </div>
            </div>
          </div>

          {/* ── THE PLAY DECK (BOTTOM DOCK) ── */}
          <div className="play-deck">
            <div className="play-deck-controls">
              {/* Version capsule */}
              <div className="version-capsule">
                <select
                  className="version-select"
                  value={selectedInstalledVersionId}
                  onChange={e => {
                    if (gameState === 'running') return;
                    const newVer = e.target.value;
                    if (!activeProfileId) return;
                    setProfiles(prev => {
                      const nextProfiles = prev.map(p =>
                        p.id === activeProfileId ? { ...p, version: newVer } : p
                      );
                      persistState({ profiles: nextProfiles });
                      return nextProfiles;
                    });
                  }}
                  disabled={gameState === 'running'}
                >
                  {installedVersions.length > 0 ? (
                    installedVersions.map(v => (
                      <option key={v.id} value={v.id}>{v.label || v.id}</option>
                    ))
                  ) : (
                    <option value="">{t('profile.noVersionsInstalled')}</option>
                  )}
                </select>
                <span className={`loader-badge ${loaderBadgeClass}`}>
                  {loaderBadgeLabel}
                </span>
              </div>

              {/* RAM meter */}
              <div className="ram-pill">
                <span>{activeProfile?.ram || 4} GB</span>
                <div className="ram-gauge">
                  <div
                    className="ram-gauge-fill"
                    style={{
                      width: `${Math.min(100, ((activeProfile?.ram || 4) / (systemTotalRam || Math.max(activeProfile?.ram || 4, 4))) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Play Button Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {installId && (
                <button className="btn-secondary" onClick={handleCancelInstall}>
                  {t('game.cancelInstall')}
                </button>
              )}
              <button
                className={`hero-play-btn ${gameState === 'loading' || authRefreshing ? 'loading' : gameState === 'running' ? 'running' : ''}`}
                onClick={() => {
                  if (installedVersions.length === 0 && !activeProfile?.version) {
                    setModal('install-minecraft');
                    return;
                  }
                  handlePlay();
                }}
                disabled={gameState === 'loading' || authRefreshing}
              >
                {gameState === 'loading' || authRefreshing ? (
                  <>
                    <span className="spinning"><Icon d={ICONS.spinner} size={16} /></span>
                    <span>{authRefreshing ? t('game.authenticating') : t('game.loading')}</span>
                  </>
                ) : gameState === 'running' ? (
                  <>
                    <Icon d={ICONS.stop} size={16} />
                    <span>{t('game.stop')}</span>
                  </>
                ) : (
                  <>
                    <Icon d={ICONS.play} size={16} />
                    <span>{t('game.play')}</span>
                  </>
                )}
                {gameState === 'loading' && (
                  <div className="progress-capsule">
                    <div className="progress-capsule-fill" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODALS ── */}
      {profileEditor && (
        <ProfileModal
          mode={profileEditor.mode}
          profile={profileToEdit}
          versions={installedVersions}
          systemTotalRam={systemTotalRam}
          onClose={() => setProfileEditor(null)}
          onSave={handleSaveProfile}
        />
      )}
      {(modal === 'install-minecraft' || modal === 'install-fabric' || modal === 'install-forge') && (
        <InstallModal
          type={modal.replace('install-', '')}
          installTargets={installTargets}
          showSnapshots={settings.showSnapshots}
          onClose={() => setModal(null)}
          onInstall={handleInstall}
          onCatalogLoaded={(catalog) => {
            if (catalog?.versions) setVersionCatalog(catalog.versions);
            if (catalog?.installTargets) setInstallTargets(catalog.installTargets);
          }}
        />
      )}
      {modal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingChange}
          onClose={() => setModal(null)}
          onCheckUpdates={handleCheckForUpdates}
          onOpenAbout={() => setModal('about')}
          onOpenMinecraftDirectory={handleOpenMinecraftDirectory}
          onOpenSourceCode={handleOpenSourceCode}
          onOpenReleases={handleOpenReleases}
          language={language}
          onLanguageChange={setLanguage}
          appVersion={appVersion}
        />
      )}
      {modal === 'about' && (
        <AboutModal
          appVersion={appVersion}
          language={language}
          onClose={() => setModal(null)}
          onOpenSourceCode={handleOpenSourceCode}
          onOpenReleases={handleOpenReleases}
          onCheckUpdates={handleCheckForUpdates}
        />
      )}
      {modConflict && (
        <ModConflictModal
          conflict={modConflict}
          mods={mods}
          onClose={() => setModConflict(null)}
          onResolveUpdate={handleResolveConflictUpdate}
          onAutoFixAll={handleAutoFixAllConflicts}
          fixingAll={fixingAllConflicts}
          onOpenModsFolder={handleOpenMinecraftDirectory}
        />
      )}
      {selectedModDetail && (
        <ModDetailModal
          project={selectedModDetail.project}
          initialTab={selectedModDetail.initialTab || 'overview'}
          currentLoader={currentLoader}
          currentMcVer={currentMcVer}
          mods={mods}
          installingVersionId={installingVersionId}
          onClose={() => setSelectedModDetail(null)}
          onInstallVersion={handleInstallSpecificVersion}
        />
      )}
      {loginLoading && (
        <LoginLoadingModal
          onCancel={() => {
            if (loginAbortControllerRef.current) {
              loginAbortControllerRef.current.abort();
            }
            setLoginLoading(false);
            addLog('info', 'Login cancelled by user');
          }}
        />
      )}
    </>
  );
}

// Microsoft official 4-color square logo SVG
function MicrosoftLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}