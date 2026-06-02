import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import {
  VERSION_CATALOG,
  INSTALL_TARGETS,
  formatClock,
  getInstallInfo,
  getVersionById,
  install,
  run,
} from './lib/minecraftLauncher';
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
  if (!resolvedUsername) {
    return '';
  }

  return `https://api.mcheads.org/head/${encodeURIComponent(resolvedUsername)}/${size}`;
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

// ── IPC helper (safe for browser dev mode) ──────────────────────────────────
const launcher = window?.launcher ?? {
  minecraftGetCatalog: () => Promise.resolve(null),
  minecraftGetState: () => Promise.resolve(null),
  minecraftGetRoot: () => Promise.resolve({ root: '' }),
  minecraftOpenRootDirectory: () => Promise.resolve({ skipped: true }),
  minecraftGetInstalledVersions: () => Promise.resolve([]),
  minecraftGetInstalledMods: () => Promise.resolve([]),
  minecraftGetNews: () => Promise.resolve({ items: [], sourceUrl: 'https://www.minecraft.net/en-us/articles' }),
  minecraftSetAllModsEnabled: () => Promise.resolve({ ok: true }),
  minecraftGetAuthState: () => Promise.resolve(null),
  minecraftLogin: () => Promise.resolve(null),
  minecraftLogout: () => Promise.resolve(null),
  minecraftCheckUpdate: () => Promise.resolve({ skipped: true }),
  getAppVersion: () => Promise.resolve(''),
  windowMinimize: () => {},
  windowMaximize: () => {},
  windowClose: () => {},
  openExternal: () => {},
  invoke: () => Promise.resolve(),
};

// Wrapper function for minecraftLogin to support abortSignal
const minecraftLoginWithAbort = async (profileKey, abortSignal) => {
  if (window?.launcher?.minecraftLogin) {
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
  play:      'M5 3l14 9-14 9V3z',
  stop:      'M6 6h12v12H6z',
  edit:      'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z',
  download:  'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  settings:  'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  folder:    'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  cube:      'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  console:   'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm0 2v10h16V7H4zm3 7.5l3-2.5-3-2.5v5zm6-1.5h4v2h-4v-2z',
  logout:    'M10 17l5-5-5-5M15 12H3M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4',
  plus:      'M12 5v14M5 12h14',
  trash:     'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2',
  copy:      'M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2M8 4a2 2 0 012-2h4a2 2 0 012 2M8 4a2 2 0 000 4h8a2 2 0 000-4',
  clear:     'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x:         'M18 6L6 18M6 6l12 12',
  news:      'M4 5h16v12H4zM7 8h10M7 11h10M7 14h6',
  external:  'M14 5h5v5M10 14L19 5M19 14v5H5V5h5',
  minimize:  'M5 12h14',
  maximize:  'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  microsoft: null,
  refresh:   'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  wrench:    'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
};

// ── Sub-components ───────────────────────────────────────────────────────────
function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  );
}

function ModCard({ mod, onToggle, onDelete }) {
  const { t } = useI18n();

  return (
    <div className="mod-card">
      <div className="mod-card-name">{mod.name}</div>
      <div className="mod-card-ver">{mod.version} · {mod.type}</div>
      <div className="mod-card-row">
        <div className={`mod-status ${mod.enabled ? 'enabled' : 'disabled'}`}>
          <div className={`mod-dot ${mod.enabled ? 'enabled' : 'disabled'}`} />
          {mod.enabled ? 'ENABLED' : 'DISABLED'}
        </div>
        <div className="mod-card-actions">
          <button
            className={`action-btn mod-card-toggle ${mod.enabled ? 'enabled' : 'disabled'}`}
            type="button"
            title={mod.enabled ? t('mods.disableMod') : t('mods.enableMod')}
            onClick={() => onToggle(mod.id)}
            style={{ padding: '6px 8px', fontSize: 10 }}
          >
            <Icon d={mod.enabled ? ICONS.stop : ICONS.play} size={11} />
          </button>
          <button
            className="action-btn mod-card-delete"
            type="button"
            title={t('mods.deleteMod')}
            onClick={() => onDelete(mod.id)}
            style={{ padding: '6px 8px', fontSize: 10 }}
          >
            <Icon d={ICONS.trash} size={11} />
          </button>
        </div>
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
            <Icon d={ICONS.news} size={18} />
          </div>
        )}
      </div>
      <div className="news-card-body">
        <div className="news-card-meta">
          {t('news.officialLabel')}
          {cardMeta ? <span className="news-card-separator">·</span> : null}
          {cardMeta}
        </div>
        <div className="news-card-title">{cardTitle}</div>
        {cardSummary ? <div className="news-card-summary">{cardSummary}</div> : null}
        <div className="news-card-actions">
          <button className="btn-ghost news-open-btn" type="button" onClick={() => onOpen(item.url)}>
            <Icon d={ICONS.external} size={11} />
            {t('news.openArticle')}
          </button>
        </div>
      </div>
    </article>
  );
}

function ProfileCardActions({ active, name, disabled, onEdit, onDelete }) {
  const { t } = useI18n();

  return (
    <div className="profile-card-actions">
      {active && <span className="profile-badge">{t('profile.active')}</span>}
      <button
        className="profile-edit-btn"
        title={t('profile.edit')}
        aria-label={`${t('profile.edit')} ${name}`}
        onClick={onEdit}
        disabled={disabled}
      >
        <Icon d={ICONS.edit} size={11} />
      </button>
      <button
        className="profile-delete-btn"
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
function ProfileModal({ mode = 'new', profile, versions, onClose, onSave }) {
  const { t } = useI18n();
   const [name, setName] = useState(profile?.name || '');
   const [localName, setLocalName] = useState(profile?.localName || '');
   const [version, setVersion] = useState(profile?.version || '');
   const [ram, setRam] = useState(profile?.ram || 4);
   const [jvmArguments, setJvmArguments] = useState(profile?.jvmArguments || '');
  const canSave = Boolean(name.trim() && localName.trim());

   useEffect(() => {
     setName(profile?.name || '');
     setLocalName(profile?.localName || '');
     setVersion(profile?.version || '');
     setRam(profile?.ram || 4);
     setJvmArguments(profile?.jvmArguments || '');
   }, [profile, versions]);

   const handleSave = () => {
     const trimmedName = name.trim();
     const trimmedLocalName = localName.trim();
     const trimmedJvmArguments = jvmArguments.trim();
     if (!trimmedName || !trimmedLocalName) return;
     onSave({
       id: profile?.id ?? null,
       name: trimmedName,
       localName: trimmedLocalName,
       version: version || null,
       ram,
       jvmArguments: trimmedJvmArguments,
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
          <label className="modal-label modal-label-required">
            <span>{t('profile.profileName')}</span>
            <span className="modal-required">Required</span>
          </label>
          <input className="modal-input" value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('profile.profileNamePlaceholder')} autoFocus />
          <div className="modal-field-desc">{t('profile.shownInSidebar')}</div>
        </div>

        <div className="modal-field">
          <label className="modal-label modal-label-required">
            <span>{t('profile.localAccountName')}</span>
            <span className="modal-required">Required</span>
          </label>
          <input
            className="modal-input"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            placeholder={t('profile.localAccountPlaceholder')}
          />
          <div className="modal-field-desc">{t('profile.usedForOffline')}</div>
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
          <div className="modal-field-desc">{t('profile.optional')} {t('profile.mainLauncherDecision')}</div>
        </div>

        <div className="modal-field">
          <label className="modal-label">{t('profile.allocatedRAM', { ram })}</label>
          <input type="range" className="ram-slider" min={1} max={16} step={1}
            value={ram} onChange={e => setRam(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
          <div className="modal-field-desc">{t('profile.moreRAMHelps')}</div>
        </div>

         <div className="modal-field">
           <label className="modal-label">{t('profile.jvmArguments')}</label>
           <input
             className="modal-input"
             value={jvmArguments}
             onChange={e => setJvmArguments(e.target.value)}
             placeholder={t('profile.jvmArgumentsPlaceholder')}
           />
           <div className="modal-field-desc">{t('profile.jvmArgumentsDescription')}</div>
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

function InstallModal({ type, installTargets, onClose, onInstall }) {
  const { t } = useI18n();
  const info = getInstallInfo(type, installTargets);
  const usesGameAndLoader = type === 'fabric' || type === 'forge';
  const [gameVersion, setGameVersion] = useState(usesGameAndLoader ? (info.gameVersions?.[0] || '') : (info.versions[0] || ''));
  const [loaderVersion, setLoaderVersion] = useState(usesGameAndLoader ? ((info.loadersByGameVersion?.[info.gameVersions?.[0] || ''] || [])[0] || '') : '');

  useEffect(() => {
    if (usesGameAndLoader) {
      const nextGameVersion = info.gameVersions?.[0] || '';
      const nextLoaderVersion = (info.loadersByGameVersion?.[nextGameVersion] || [])[0] || '';
      setGameVersion(nextGameVersion);
      setLoaderVersion(nextLoaderVersion);
      return;
    }

    setGameVersion(info.versions[0] || '');
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
                <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34 }}>
                  {t('install.noVersionsAvailable')}
                </div>
              )}
              <div className="modal-select-meta">
                {t('install.availableVersions', { count: info.gameVersions?.length || 0, plural: (info.gameVersions?.length || 0) === 1 ? '' : 's' })}
              </div>
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
                <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34 }}>
                  {t('install.noLoadersAvailable')}
                </div>
              )}
              <div className="modal-select-meta">
                {t('install.availableLoaders', { count: loaderOptions.length, plural: loaderOptions.length === 1 ? '' : 's' })}
              </div>
            </div>
          </>
        ) : (
          <div className="modal-field">
            <label className="modal-label">{t('install.version')}</label>
            {info.versions.length > 0 ? (
              <select className="modal-select" value={gameVersion} onChange={e => setGameVersion(e.target.value)}>
                {info.versions.map(version => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>
            ) : (
              <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34 }}>
                {t('install.noVersionsAvailable')}
              </div>
            )}
            <div className="modal-select-meta">
              {t('install.availableVersions', { count: info.versions.length, plural: info.versions.length === 1 ? '' : 's' })}
            </div>
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
                onInstall(type, gameVersion);
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
      <div className="modal">
        <div className="modal-title">{t('settings.title')}</div>
        <div className="modal-subtitle">{t('settings.subtitle')}</div>

        <div className="settings-section">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.language')}</div>
              <div className="settings-row-desc">{t('settings.languageDesc')}</div>
            </div>
            <select
              className="modal-select"
              value={language}
              onChange={e => onLanguageChange(e.target.value)}
              style={{ maxWidth: '40%', fontSize: 12 }}
            >
              <option value="en">{t('settings.english')}</option>
              <option value="es">{t('settings.spanish')}</option>
              <option value="fr">{t('settings.french')}</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.showSnapshots')}</div>
              <div className="settings-row-desc">{t('settings.showSnapshotsDesc')}</div>
            </div>
            <Toggle on={settings.showSnapshots} onToggle={() => onChange('showSnapshots', !settings.showSnapshots)} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.keepLauncherOpen')}</div>
              <div className="settings-row-desc">{t('settings.keepLauncherOpenDesc')}</div>
            </div>
            <Toggle on={settings.keepOpen} onToggle={() => onChange('keepOpen', !settings.keepOpen)} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.showConsoleOutput')}</div>
              <div className="settings-row-desc">{t('settings.showConsoleOutputDesc')}</div>
            </div>
            <Toggle on={settings.showConsole} onToggle={() => onChange('showConsole', !settings.showConsole)} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.autoUpdateLauncher')}</div>
              <div className="settings-row-desc">{t('settings.autoUpdateLauncherDesc')}</div>
            </div>
            <Toggle on={settings.autoUpdate} onToggle={() => onChange('autoUpdate', !settings.autoUpdate)} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.minecraftDirectory')}</div>
              <div className="settings-row-desc">{t('settings.minecraftDirectoryDesc')}</div>
            </div>
            <div className="settings-directory-controls" style={{ maxWidth: '60%' }}>
              <input
                className="modal-input"
                style={{ fontSize: 11 }}
                value={settings.minecraftRoot}
                readOnly
              />
              <button className="btn-ghost settings-open-folder-btn" type="button" onClick={onOpenMinecraftDirectory}>
                <Icon d={ICONS.folder} size={12} />
                {t('settings.openMinecraftDirectory')}
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row-label">{t('settings.javaPath')}</div>
              <div className="settings-row-desc">{t('settings.javaPathDesc')}</div>
            </div>
            <input
              className="modal-input"
              style={{ maxWidth: '60%', fontSize: 11 }}
              value={settings.javaPath}
              onChange={e => onChange('javaPath', e.target.value)}
              placeholder={t('settings.autoDetect')}
            />
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" type="button" onClick={onOpenAbout}>{t('settings.aboutButton')}</button>
          <button className="btn-ghost" type="button" onClick={onCheckUpdates}>{t('settings.checkForUpdates')}</button>
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
      <div className="modal about-modal">
        <button className="about-close-btn" type="button" onClick={onClose} aria-label={t('window.close')} title={t('window.close')}>
          <Icon d={ICONS.x} size={12} />
        </button>
        <div className="about-hero">
          <div className="about-brand-mark">
            <img src={logoIcon} alt="OpenLauncher" onError={(event) => {
              event.currentTarget.style.display = 'none';
            }} />
          </div>
          <div className="about-hero-copy">
            <div className="about-kicker">{t('settings.aboutTitle')}</div>
            <div className="about-title">{t('app.name')}</div>
            <div className="about-subtitle">{t('settings.aboutDescription')}</div>
          </div>
          <div className="about-version-card">
            <span className="about-version-label">{t('settings.versionLabel')}</span>
            <span className="about-version-value">{versionLabel}</span>
            <span className="about-version-meta">{t('settings.aboutPlatform')}</span>
          </div>
        </div>

        <div className="about-pills">
          <span className="about-pill">{t('settings.licenseLabel', { license: 'GPL-2.0' })}</span>
          <span className="about-pill">{t('settings.developedByLabel', { developer: 'CesarGarza55' })}</span>
          <span className="about-pill">{t('settings.openSourceLabel')}</span>
        </div>

        <div className="about-grid">
          <div className="about-card">
            <div className="about-card-title">{t('about.cards.launcherTitle')}</div>
            <div className="about-card-text">{t('about.cards.launcherText')}</div>
          </div>
          <div className="about-card">
            <div className="about-card-title">{t('about.cards.profilesTitle')}</div>
            <div className="about-card-text">{t('about.cards.profilesText')}</div>
          </div>
          <div className="about-card">
            <div className="about-card-title">{t('about.cards.modsTitle')}</div>
            <div className="about-card-text">{t('about.cards.modsText')}</div>
          </div>
        </div>

        <div className="about-links">
          <button className="btn-ghost" type="button" onClick={onOpenSourceCode}>
            <Icon d={ICONS.external} size={11} />
            {t('settings.openSourceCode')}
          </button>
          <button className="btn-ghost" type="button" onClick={onOpenReleases}>
            <Icon d={ICONS.external} size={11} />
            {t('settings.openReleases')}
          </button>
          <button className="btn-primary" type="button" onClick={onCheckUpdates}>
            <Icon d={ICONS.refresh} size={11} />
            {t('settings.checkForUpdates')}
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
      <div className="modal" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="modal-title">{t('account.loginWithMicrosoft')}</div>
        <div className="modal-subtitle">{t('account.loginInProgress')}</div>
        
        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <span className="play-btn-icon spinning" style={{ fontSize: 24 }}>
              <Icon d={ICONS.refresh} size={24} />
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {t('account.waitingForAuthentication')}
            </span>
          </div>
        </div>

        <div className="modal-actions">
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
  const [activeTab, setActiveTab] = useState('console');
  const [versionCatalog, setVersionCatalog] = useState([]);
  const [installedVersions, setInstalledVersions] = useState([]);
  const [installTargets, setInstallTargets] = useState(INSTALL_TARGETS);
  const [mods, setMods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [newsSourceUrl, setNewsSourceUrl] = useState('https://www.minecraft.net/en-us/articles');
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [gameState, setGameState] = useState('idle'); // idle | loading | running
  const [progress, setProgress] = useState(0);
  const [runPid, setRunPid] = useState(null);
  const [installId, setInstallId] = useState(null);
  const [updateState, setUpdateState] = useState({ phase: 'idle', progress: 0, message: '' });
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // null | 'newProfile' | 'install-minecraft' | 'install-fabric' | 'install-forge' | 'settings' | 'about'
  const [profileEditor, setProfileEditor] = useState(null); // null | { mode: 'new' | 'edit', profileId: number | null }
  const [account, setAccount] = useState({ name: '', loggedIn: false, profileKey: 'default', kind: 'none', session: null });
  const [authRefreshing, setAuthRefreshing] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [settings, setSettings] = useState({
    keepOpen: false, showConsole: true, autoUpdate: true, showSnapshots: false, javaPath: '', minecraftRoot: '', language,
  });
  const consoleRef = useRef(null);
  const gameTimerRef = useRef(null);
  const toastTimersRef = useRef(new Map());
  const loginAbortControllerRef = useRef(null);
  const stateRef = useRef({
    profiles: [],
    mods: [],
    logs: [],
    settings: { keepOpen: false, showConsole: true, autoUpdate: true, showSnapshots: false, javaPath: '', minecraftRoot: '', language },
  });

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];
  const profileToEdit = profileEditor?.profileId != null
    ? profiles.find(p => p.id === profileEditor.profileId) || null
    : null;
  const accountAvatarUrl = account.loggedIn ? getMcHeadsAvatarUrl(account.name, 256) : '';
  const activeInstalledVersion = installedVersions.find(version => version.id === activeProfile?.version) || null;
  const selectedInstalledVersionId = installedVersions.some(version => version.id === activeProfile?.version)
    ? activeProfile?.version
    : installedVersions[0]?.id || '';
  const selectedInstalledVersion = installedVersions.find(version => version.id === selectedInstalledVersionId) || null;
  const activeVersion = selectedInstalledVersion || activeInstalledVersion || getVersionById(activeProfile?.version, versionCatalog);
  const dismissToast = useCallback((toastId) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }
  }, []);

  const pushToast = useCallback((input) => {
    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast = {
      id: toastId,
      tone: input?.tone || 'info',
      title: input?.title || '',
      message: input?.message || '',
      timeout: typeof input?.timeout === 'number' ? input.timeout : 4200,
    };

    setToasts(prev => [nextToast, ...prev].slice(0, 4));

    if (nextToast.timeout > 0) {
      const timer = setTimeout(() => {
        dismissToast(toastId);
      }, nextToast.timeout);
      toastTimersRef.current.set(toastId, timer);
    }

    return toastId;
  }, [dismissToast]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      const payload = await launcher.minecraftGetNews?.();
      if (!payload || payload.error) {
        throw new Error(payload?.error || 'Failed to load Minecraft news.');
      }

      setNewsItems(Array.isArray(payload.items) ? payload.items : []);
      if (typeof payload.sourceUrl === 'string' && payload.sourceUrl.trim()) {
        setNewsSourceUrl(payload.sourceUrl.trim());
      }
    } catch (error) {
      setNewsItems([]);
      setNewsError(error?.message || 'Failed to load Minecraft news.');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  useEffect(() => {
    let cancelled = false;
    // IPC event listeners
    const installProgressOff = launcher.on?.('minecraft:install-progress', (p) => {
      if (!p) return;
      if (p.installId) setInstallId(p.installId);
      if (p && typeof p.percent === 'number') setProgress(p.percent);
      if (p && p.percent == null && typeof p.loaded === 'number') addLog('info', `Installing: ${p.loaded}/${p.total || 'unknown'}`);
    });
    const installFileOff = launcher.on?.('minecraft:install-file-progress', (f) => {
      if (!f) return;
      if (f.installId) setInstallId(f.installId);
      addLog('info', `Downloading ${f.file} — ${f.percent ?? '??'}%`);
    });
    const installCompleteOff = launcher.on?.('minecraft:install-complete', (r) => {
      addLog('success', `Installed ${r.type} ${r.version} -> ${r.path}`);
      setProgress(0);
      setInstallId(null);
      launcher.minecraftGetInstalledVersions?.().then((versions) => {
        if (Array.isArray(versions)) setInstalledVersions(versions);
      }).catch(() => {});
      pushToast({
        tone: 'success',
        title: t(`install.${r.type}`),
        message: t('messages.installSuccessToast', { type: t(`install.${r.type}`), version: r.version }),
      });
    });
    const installErrorOff = launcher.on?.('minecraft:install-error', (e) => {
      addLog('error', `Install error: ${e?.message}`);
      setProgress(0);
      setInstallId(null);
    });
    const installCancelledOff = launcher.on?.('minecraft:install-cancelled', (e) => {
      addLog('warn', `Install cancelled: ${e?.installId}`);
      setInstallId(null);
      setProgress(0);
    });
    const updateStatusOff = launcher.on?.('minecraft:update-status', (u) => {
      if (!u) return;
      setUpdateState(prev => ({
        ...prev,
        phase: u.phase || prev.phase,
        message: u.message || prev.message,
      }));
      if (u.message) {
        addLog('info', u.message);
      }
    });
    const updateProgressOff = launcher.on?.('minecraft:update-progress', (u) => {
      if (!u) return;
      setUpdateState(prev => ({
        ...prev,
        phase: u.phase || 'downloading',
        progress: typeof u.percent === 'number' ? u.percent : prev.progress,
        message: u.assetName ? `Downloading ${u.assetName}` : (prev.message || 'Downloading update'),
      }));
    });
    const updateCompleteOff = launcher.on?.('minecraft:update-complete', (u) => {
      if (!u) return;
      setUpdateState({ phase: 'complete', progress: 100, message: u.assetName ? `Update ready: ${u.assetName}` : 'Update ready' });
      setTimeout(() => {
        setUpdateState(prev => (prev.phase === 'complete' ? { phase: 'idle', progress: 0, message: '' } : prev));
      }, 1400);
    });
    const runLogOff = launcher.on?.('minecraft:run-log', (l) => {
      if (!l) return;
      const msg = String(l.msg || '').trim();
      addLog(l.type === 'stderr' ? 'error' : 'info', msg);
    });
    const runExitOff = launcher.on?.('minecraft:run-exit', (s) => {
      addLog('info', `Game process exited with code ${s?.code}`);
      setGameState('idle');
      setProgress(0);
      setRunPid(null);
    });

    const hydrateCatalog = async () => {
      const currentState = await launcher.minecraftGetState();
      const snapshot = await launcher.minecraftGetCatalog({ includeSnapshots: currentState?.settings?.showSnapshots === true });
      if (cancelled || !snapshot) return;

      if (Array.isArray(snapshot.versions) && snapshot.versions.length > 0) {
        setVersionCatalog(snapshot.versions);
      }

      if (snapshot.installTargets) {
        setInstallTargets(snapshot.installTargets);
      }
    };

    hydrateCatalog();

    launcher.getAppVersion?.()
      .then((version) => {
        if (!cancelled && typeof version === 'string') {
          setAppVersion(version.trim());
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      try { installProgressOff?.(); installFileOff?.(); installCompleteOff?.(); installErrorOff?.(); installCancelledOff?.(); updateStatusOff?.(); updateProgressOff?.(); updateCompleteOff?.(); runLogOff?.(); runExitOff?.(); } catch (e) {}
    };
  }, []);

  const handleOpenNewsSource = useCallback(() => {
    launcher.openExternal?.(newsSourceUrl).catch(() => {});
  }, [newsSourceUrl]);

  const handleOpenNewsArticle = useCallback((url) => {
    launcher.openExternal?.(url).catch(() => {});
  }, []);

  const handleOpenSourceCode = useCallback(() => {
    launcher.openExternal?.(APP_SOURCE_URL).catch(() => {});
  }, []);

  const handleOpenReleases = useCallback(() => {
    launcher.openExternal?.(APP_RELEASES_URL).catch(() => {});
  }, []);

  const handleOpenAbout = useCallback(() => {
    setModal('about');
  }, []);

  useEffect(() => {
    stateRef.current = { profiles, mods, logs, settings };
  }, [profiles, mods, logs, settings]);

  useEffect(() => {
    return () => {
      for (const timer of toastTimersRef.current.values()) {
        clearTimeout(timer);
      }
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    setSettings(prev => (prev.language === language ? prev : { ...prev, language }));
  }, [language]);

  useEffect(() => {
    let cancelled = false;

const hydrateState = async () => {
        const state = await launcher.minecraftGetState();
        if (cancelled || !state) return;

        const incomingProfiles = Array.isArray(state.profiles) ? state.profiles : [];
        const defaultProfile = {
          id: 'Default',
          name: 'Default',
          localName: 'Steve',
          version: null,
          ram: null,
          jvmArguments: '',
          active: true,
        };
        const nextProfiles = incomingProfiles.length > 0 ? incomingProfiles : [defaultProfile];

        setProfiles(nextProfiles);
        setLogs([]);
        if (state.minecraftRoot) {
          setSettings(prev => ({ ...prev, minecraftRoot: state.minecraftRoot }));
        }
        if (state.settings && typeof state.settings === 'object') {
         setSettings(prev => ({
           ...prev,
           keepOpen: typeof state.settings.keepOpen === 'boolean' ? state.settings.keepOpen : prev.keepOpen,
           showConsole: typeof state.settings.showConsole === 'boolean' ? state.settings.showConsole : prev.showConsole,
           autoUpdate: typeof state.settings.autoUpdate === 'boolean' ? state.settings.autoUpdate : prev.autoUpdate,
           showSnapshots: typeof state.settings.showSnapshots === 'boolean' ? state.settings.showSnapshots : prev.showSnapshots,
           javaPath: typeof state.settings.javaPath === 'string' ? state.settings.javaPath : prev.javaPath,
           language: typeof state.settings.language === 'string' && state.settings.language.trim()
             ? state.settings.language.trim()
             : prev.language,
         }));
       }
       if (Array.isArray(state.versions) && state.versions.length > 0) {
         setVersionCatalog(state.versions);
       }
       const hasInstallTargets = state.installTargets
         && typeof state.installTargets === 'object'
         && Object.values(state.installTargets).some(target => Array.isArray(target?.versions) && target.versions.length > 0);
       if (hasInstallTargets) {
         setInstallTargets(state.installTargets);
       }
       const savedMods = Array.isArray(state.mods) ? state.mods : [];
       launcher.minecraftGetInstalledVersions?.().then((versions) => {
         if (Array.isArray(versions)) setInstalledVersions(versions);
       }).catch(() => {});
       launcher.minecraftGetInstalledMods?.().then((mods) => {
         if (!Array.isArray(mods)) {
           setMods(savedMods);
           return;
         }

         const savedById = new Map(savedMods.map(mod => [mod.id, mod]));
         const mergedMods = mods.map(mod => ({ ...mod, ...(savedById.get(mod.id) || {}) }));
         setMods(mergedMods.length > 0 ? mergedMods : savedMods);
       }).catch(() => {
         setMods(savedMods);
       });
       setActiveProfileId(prev => prev ?? nextProfiles?.[0]?.id ?? null);
       setStateHydrated(true);
       if (incomingProfiles.length === 0) {
         persistState({
           profiles: nextProfiles,
           mods: savedMods,
           logs: [],
           versions: state.versions && Array.isArray(state.versions) ? state.versions : [],
           installTargets: state.installTargets && typeof state.installTargets === 'object'
             ? state.installTargets
             : installTargets,
           settings: state.settings && typeof state.settings === 'object'
             ? {
                 javaPath: typeof state.settings.javaPath === 'string' ? state.settings.javaPath : '',
                 keepOpen: typeof state.settings.keepOpen === 'boolean' ? state.settings.keepOpen : false,
                 showConsole: typeof state.settings.showConsole === 'boolean' ? state.settings.showConsole : true,
                 autoUpdate: typeof state.settings.autoUpdate === 'boolean' ? state.settings.autoUpdate : true,
                 showSnapshots: typeof state.settings.showSnapshots === 'boolean' ? state.settings.showSnapshots : false,
                 language: typeof state.settings.language === 'string' && state.settings.language.trim()
                   ? state.settings.language.trim()
                   : language,
               }
             : {
                 javaPath: '',
                 keepOpen: false,
                 showConsole: true,
                 autoUpdate: true,
                 showSnapshots: false,
                 language,
               },
         });
       } else {
         clearConsole({
           profiles: nextProfiles,
           mods: Array.isArray(state.mods) ? state.mods : [],
           versions: state.versions && Array.isArray(state.versions) ? state.versions : [],
           installTargets: state.installTargets && typeof state.installTargets === 'object'
             ? state.installTargets
             : installTargets,
           settings: state.settings && typeof state.settings === 'object'
             ? {
                 javaPath: typeof state.settings.javaPath === 'string' ? state.settings.javaPath : '',
                 keepOpen: typeof state.settings.keepOpen === 'boolean' ? state.settings.keepOpen : false,
                 showConsole: typeof state.settings.showConsole === 'boolean' ? state.settings.showConsole : true,
                 autoUpdate: typeof state.settings.autoUpdate === 'boolean' ? state.settings.autoUpdate : true,
                 showSnapshots: typeof state.settings.showSnapshots === 'boolean' ? state.settings.showSnapshots : false,
                 language: typeof state.settings.language === 'string' && state.settings.language.trim()
                   ? state.settings.language.trim()
                   : language,
               }
             : {
                 javaPath: '',
                 keepOpen: false,
                 showConsole: true,
                 autoUpdate: true,
                 showSnapshots: false,
                 language,
               },
         });
       }
    };

    hydrateState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!stateHydrated) {
      return () => {
        cancelled = true;
      };
    }
    const profileKey = String(activeProfileId ?? 'default');
    const localName = String(activeProfile?.localName || activeProfile?.name || '').trim();

    const hydrateAccount = async () => {
      setAuthRefreshing(true);
      const authState = await launcher.minecraftGetAuthState(profileKey);
      if (cancelled || !authState) {
        setAuthRefreshing(false);
        return;
      }

      if (authState.loggedIn && authState.name) {
        setAccount({
          name: authState.name,
          loggedIn: true,
          profileKey,
          kind: 'microsoft',
          session: {
            ...authState,
            userType: authState.userType || 'msa',
          },
        });
        setAuthRefreshing(false);
        return;
      }

      if (localName) {
        setAccount({
          name: localName,
          loggedIn: true,
          profileKey,
          kind: 'local',
          session: createOfflineSession(localName),
        });
        setAuthRefreshing(false);
        return;
      }

      setAccount({
        name: '',
        loggedIn: false,
        profileKey,
        kind: 'none',
        session: null,
      });
      setAuthRefreshing(false);
    };

    hydrateAccount();

    return () => {
      cancelled = true;
    };
  }, [activeProfile?.localName, activeProfile?.name, activeProfileId, stateHydrated]);

  const persistState = useCallback((nextState) => {
    const nextSettings = {
      ...(nextState?.settings || {}),
      language: nextState?.settings?.language ?? language,
    };
    launcher.minecraftSaveState({
      ...nextState,
      settings: nextSettings,
    }).catch(() => {});
  }, [language]);

  const clearConsole = useCallback((nextState = {}) => {
    setLogs([]);
    const currentState = stateRef.current;
    persistState({
      profiles: nextState.profiles ?? currentState.profiles,
      mods: nextState.mods ?? currentState.mods,
      logs: [],
      versions: nextState.versions ?? versionCatalog,
      installTargets: nextState.installTargets ?? installTargets,
      settings: nextState.settings ?? currentState.settings,
    });
  }, [installTargets, persistState, versionCatalog]);

  useEffect(() => () => {
    if (typeof gameTimerRef.current === 'function') {
      gameTimerRef.current();
    } else if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
    }
  }, []);

  const addLog = useCallback((level, msg) => {
    const time = formatClock();
    setLogs(prev => {
      const nextLogs = [...prev, { time, level, msg }];
      const currentState = stateRef.current;
      persistState({
        profiles: currentState.profiles,
        mods: currentState.mods,
        logs: nextLogs,
        versions: versionCatalog,
        installTargets,
        settings: currentState.settings,
      });
      return nextLogs;
    });
  }, [installTargets, persistState, versionCatalog]);

  const handlePlay = async () => {
    if (!activeProfile) {
      addLog('warn', 'Create or select a profile before launching.');
      return;
    }

    if (!account.loggedIn || !account.name) {
      addLog('warn', 'Create a local account name or link Microsoft before launching.');
      return;
    }

    if (!activeVersion) {
      addLog('warn', 'No Minecraft version is available yet.');
      return;
    }

    if (gameState === 'running') {
      if (runPid) {
        try {
          await launcher.minecraftStop({ pid: runPid });
          addLog('warn', 'Stop requested for running process.');
        } catch (e) {
          addLog('error', 'Failed to stop process.');
        }
      }
      setGameState('idle');
      setProgress(0);
      setRunPid(null);
      return;
    }
    if (gameState === 'loading') return;

    setGameState('loading');
    setProgress(0);
    setActiveTab('console');
    clearConsole();
    addLog('info', `Launching "${activeProfile.name}" — ${activeVersion.label}`);

    try {
      const authSession = account.session || {
        name: account.name,
        username: account.name,
        userType: account.kind === 'local' ? 'legacy' : 'msa',
      };
       const result = await run({
         profile: activeProfile,
         version: activeVersion,
         profileKey: String(activeProfileId ?? 'default'),
         javaPath: activeProfile?.javaPath || settings.javaPath,
         jvmArguments: activeProfile?.jvmArguments || '',
         session: authSession,
       });
      if (result?.error) {
        addLog('error', result.message || result.error);
        setGameState('idle');
        setProgress(0);
        return;
      }
      setRunPid(result.pid || null);
      setGameState('running');
      addLog('info', `Spawned game pid=${result.pid}`);
    } catch (err) {
      addLog('error', `Launch failed: ${err?.message || err}`);
      setGameState('idle');
      setProgress(0);
    }
  };

  const handleInstall = async (type, selection) => {
    const usesGameAndLoader = type === 'fabric' || type === 'forge';
    const payload = usesGameAndLoader && selection && typeof selection === 'object'
      ? {
          gameVersion: String(selection.gameVersion || '').trim(),
          loaderVersion: String(selection.loaderVersion || '').trim(),
        }
      : { version: String(selection || '').trim() };
    const logLabel = usesGameAndLoader
      ? `${payload.loaderVersion} / ${payload.gameVersion}`
      : payload.version;

    setInstallId(null);
    setProgress(0);
    clearConsole();
    addLog('info', `Requesting install ${type} ${logLabel}...`);
    try {
      const res = await install({
        type,
        ...payload,
        profileKey: String(activeProfileId ?? 'default'),
      });
      if (res?.error) {
        addLog('error', res.message || res.error);
        pushToast({
          tone: 'error',
          title: t(`install.${type}`),
          message: t('messages.installFailedToast', { type: t(`install.${type}`), version: logLabel, error: res.message || res.error }),
        });
      } else {
        addLog('success', `${type} ${logLabel} installation requested.`);
        pushToast({
          tone: 'success',
          title: t(`install.${type}`),
          message: t('messages.installSuccessToast', { type: t(`install.${type}`), version: logLabel }),
        });
      }
    } catch (err) {
      addLog('error', `Install failed: ${err?.message || err}`);
    }
  };

  const handleCancelInstall = async () => {
    if (!installId) return;
    try {
      const res = await launcher.minecraftInstallCancel({ installId });
      if (res?.ok) addLog('info', 'Install cancellation requested.');
      else addLog('error', res?.message || 'Cancel failed');
    } catch (e) {
      addLog('error', `Cancel failed: ${e?.message || e}`);
    }
  };

  const handleStop = async () => {
    if (!runPid) return;
    try {
      const res = await launcher.minecraftStop({ pid: runPid });
      if (res?.ok) addLog('info', 'Stop requested.');
      else addLog('error', res?.message || 'Stop failed');
    } catch (e) {
      addLog('error', `Stop failed: ${e?.message || e}`);
    }
  };

  const handleSettingChange = (key, val) => {
    setSettings(prev => {
      const nextSettings = { ...prev, [key]: val };
      const currentState = stateRef.current;
      persistState({
        profiles: currentState.profiles,
        mods: currentState.mods,
        logs: currentState.logs,
        versions: versionCatalog,
        installTargets,
        settings: { ...currentState.settings, [key]: val, javaPath: nextSettings.javaPath, language: currentState.settings.language ?? language },
      });
      if (key === 'showSnapshots') {
        launcher.minecraftGetCatalog?.({ includeSnapshots: Boolean(val) }).then((catalog) => {
          if (!catalog) return;
          if (Array.isArray(catalog.versions)) setVersionCatalog(catalog.versions);
          if (catalog.installTargets) setInstallTargets(catalog.installTargets);
        }).catch(() => {});
      }
      return nextSettings;
    });
  };

   const handleSaveProfile = ({ id, name, localName, version, ram, jvmArguments }) => {
     const resolvedLocalName = String(localName || '').trim();
     const newProfileId = id == null ? Date.now() : id;
     setProfiles(prev => {
       const nextProfiles = id == null
         ? [...prev, { id: newProfileId, name, localName: resolvedLocalName, version: version || null, ram, jvmArguments, active: false }]
         : prev.map(profile => profile.id === id
           ? { ...profile, name, localName: resolvedLocalName, version: version || null, ram, jvmArguments }
           : profile);
       const currentState = stateRef.current;
       persistState({
         profiles: nextProfiles,
         mods: currentState.mods,
         logs: currentState.logs,
         versions: versionCatalog,
         installTargets,
         settings: currentState.settings,
       });
       return nextProfiles;
     });
    if (id == null) {
      setActiveProfileId(newProfileId);
      addLog('info', `Profile "${name}" created.`);
    } else {
      addLog('info', `Profile "${name}" updated.`);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    const target = profiles.find(profile => profile.id === profileId);
    if (!target) return;
    if (authRefreshing || gameState === 'running') return;

    try {
      const result = await launcher.minecraftLogout(String(profileId));
      if (result?.error) {
        throw new Error(result.message || result.error);
      }

      setProfiles(prev => {
        const nextProfiles = prev.filter(profile => profile.id !== profileId);
        const nextActiveId = activeProfileId === profileId
          ? (nextProfiles[0]?.id ?? null)
          : activeProfileId;

        setActiveProfileId(nextActiveId);
        if (profileEditor?.profileId === profileId) {
          setProfileEditor(null);
        }

        if (activeProfileId === profileId) {
          setAccount({ name: '', loggedIn: false, profileKey: String(nextActiveId ?? 'default'), kind: 'none', session: null });
        }

        const currentState = stateRef.current;
        persistState({
          profiles: nextProfiles,
          mods: currentState.mods,
          logs: currentState.logs,
          versions: versionCatalog,
          installTargets,
          settings: currentState.settings,
        });

        return nextProfiles;
      });

      addLog('info', `Deleted profile "${target.name}".`);
    } catch (error) {
      addLog('error', `Profile delete failed: ${error?.message || error}`);
    }
  };

  const handleModToggle = async (id) => {
    const target = mods.find(mod => mod.id === id);
    if (!target) return;

    const nextEnabled = !target.enabled;
    setMods(prev => prev.map(mod => mod.id === id ? { ...mod, enabled: nextEnabled } : mod));

    try {
      const result = await launcher.minecraftToggleMod(id, nextEnabled);
      if (result?.error) {
        throw new Error(result.message || result.error);
      }

      const updatedMods = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updatedMods)) {
        setMods(updatedMods);
      }

      const currentState = stateRef.current;
      persistState({
        profiles: currentState.profiles,
        mods: Array.isArray(updatedMods) ? updatedMods : currentState.mods,
        logs: currentState.logs,
        versions: versionCatalog,
        installTargets,
        settings: currentState.settings,
      });
    } catch (error) {
      setMods(prev => prev.map(mod => mod.id === id ? { ...mod, enabled: target.enabled } : mod));
      addLog('error', `Mod toggle failed: ${error?.message || error}`);
    }
  };

  const handleSetAllModsEnabled = async (enable) => {
    if (!mods.length) return;

    const previousMods = mods;
    const targetMods = mods.filter(mod => Boolean(mod.enabled) !== Boolean(enable));
    if (!targetMods.length) return;

    setMods(prev => prev.map(mod => (Boolean(mod.enabled) !== Boolean(enable) ? { ...mod, enabled: enable } : mod)));

    try {
      for (const mod of targetMods) {
        const result = await launcher.minecraftToggleMod(mod.id, enable);
        if (result?.error) {
          throw new Error(result.message || result.error);
        }
      }

      const updatedMods = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updatedMods)) {
        setMods(updatedMods);
      }

      const currentState = stateRef.current;
      persistState({
        profiles: currentState.profiles,
        mods: Array.isArray(updatedMods) ? updatedMods : currentState.mods,
        logs: currentState.logs,
        versions: versionCatalog,
        installTargets,
        settings: currentState.settings,
      });

      addLog('info', enable ? t('messages.modsEnabledAll') : t('messages.modsDisabledAll'));
    } catch (error) {
      setMods(previousMods);
      addLog('error', `Bulk mod toggle failed: ${error?.message || error}`);
    }
  };

  const handleModDelete = async (id) => {
    const target = mods.find(mod => mod.id === id);
    if (!target) return;

    try {
      const result = await launcher.minecraftDeleteMod(id);
      if (result?.canceled) {
        addLog('info', `Delete cancelled for ${target.name}.`);
        return;
      }
      if (result?.error) {
        throw new Error(result.message || result.error);
      }

      addLog('info', `Deleted mod ${target.name}.`);
      const updatedMods = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updatedMods)) {
        setMods(updatedMods);
      }

      const currentState = stateRef.current;
      persistState({
        profiles: currentState.profiles,
        mods: Array.isArray(updatedMods) ? updatedMods : currentState.mods,
        logs: currentState.logs,
        versions: versionCatalog,
        installTargets,
        settings: currentState.settings,
      });
    } catch (error) {
      addLog('error', `Mod delete failed: ${error?.message || error}`);
    }
  };

  const refreshInstalledMods = useCallback(async () => {
    try {
      const installed = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(installed)) {
        setMods(installed);
      }
    } catch {
      // Keep the current list if refresh fails.
    }
  }, []);

  const importModFiles = useCallback(async (files) => {
    const acceptedFiles = Array.from(files || []).filter(file => /\.(jar|olpkg)$/i.test(file?.path || file?.name || ''));
    if (acceptedFiles.length === 0) {
      addLog('warn', 'Select only .jar or .olpkg files.');
      return;
    }

    for (const file of acceptedFiles) {
      const sourcePath = String(file?.path || '').trim();
      if (!sourcePath) {
        addLog('error', `No file path available for ${file?.name || 'mod file'}.`);
        continue;
      }

      const result = await launcher.minecraftInstallModFile(sourcePath);
      if (result?.error) {
        if (result.canceled) {
          addLog('info', `Skipped ${file.name || sourcePath}.`);
          continue;
        }
        addLog('error', result.message || result.error);
      } else {
        addLog('info', `Imported mod ${file.name || result.path}`);
      }
    }

    await refreshInstalledMods();
  }, [addLog, refreshInstalledMods]);

  const handleAddModClick = useCallback(() => {
    launcher.minecraftPickModFiles?.()
      .then(async (result) => {
        if (!result || result.canceled) {
          return;
        }

        await importModFiles((result.filePaths || []).map(filePath => ({
          path: filePath,
          name: filePath.split(/[\\/]/).pop(),
        })));
      })
      .catch((error) => {
        addLog('error', `Could not open mod file picker: ${error?.message || error}`);
      });
  }, [addLog, importModFiles]);

  const handleClearConsole = () => {
    clearConsole();
  };
  const handleCopyConsole = () => {
    const text = logs.map(l => `${l.time} [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
    navigator.clipboard?.writeText(text);
  };

  const handleLogin = async () => {
    const profileKey = String(activeProfileId ?? 'default');
    addLog('info', 'Opening Microsoft login...');
    setLoginLoading(true);
    
    const controller = new AbortController();
    loginAbortControllerRef.current = controller;
    
    try {
      const session = await minecraftLoginWithAbort(profileKey, controller.signal);
      if (session?.error) {
        addLog('error', session.error);
        pushToast({
          tone: 'error',
          title: t('account.loginWithMicrosoft'),
          message: t('messages.loginFailed', { error: session.error }),
        });
        return;
      }
      setAccount({
        name: session?.name || '',
        loggedIn: Boolean(session?.name),
        profileKey,
        kind: 'microsoft',
        session,
      });
      addLog('success', `Authenticated as ${session?.name || 'Microsoft account'}.`);
      pushToast({
        tone: 'success',
        title: t('account.loginWithMicrosoft'),
        message: t('messages.loginSuccess', { name: session?.name || 'Microsoft account' }),
      });
    } catch (error) {
      addLog('error', `Microsoft login failed: ${error?.message || error}`);
      pushToast({
        tone: 'error',
        title: t('account.loginWithMicrosoft'),
        message: t('messages.loginFailed', { error: error?.message || error }),
      });
    } finally {
      setLoginLoading(false);
      loginAbortControllerRef.current = null;
    }
  };

  const handleLogout = async () => {
    const profileKey = String(activeProfileId ?? 'default');
    addLog('info', 'Closing Microsoft session...');

    try {
      const result = await launcher.minecraftLogout(profileKey);
      if (result?.error) {
        throw new Error(result.message || result.error);
      }

      const fallbackName = String(activeProfile?.localName || activeProfile?.name || '').trim();
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

      addLog('success', 'Microsoft session closed.');
      pushToast({
        tone: 'info',
        title: t('account.logout'),
        message: t('messages.logoutSuccess'),
      });
    } catch (error) {
      addLog('error', `Logout failed: ${error?.message || error}`);
      pushToast({
        tone: 'error',
        title: t('account.logout'),
        message: t('messages.logoutFailed', { error: error?.message || error }),
      });
    }
  };

  const handleCheckForUpdates = async () => {
    addLog('info', 'Checking for launcher updates...');
    try {
      const result = await launcher.minecraftCheckUpdate?.();
      if (result?.error) {
        addLog('error', result.message || result.error);
        pushToast({
          tone: 'error',
          title: t('update.launcherUpdate'),
          message: result.message || result.error,
        });
      } else if (result?.upToDate) {
        addLog('info', 'Launcher is already up to date.');
        pushToast({
          tone: 'info',
          title: t('update.launcherUpdate'),
          message: t('messages.alreadyUpToDate'),
        });
      } else if (result?.skipped) {
        addLog('info', result.reason || 'Update check skipped.');
        pushToast({
          tone: 'info',
          title: t('update.launcherUpdate'),
          message: result.reason || t('messages.updateCheckSkipped'),
        });
      }
    } catch (error) {
      addLog('error', `Update check failed: ${error?.message || error}`);
      pushToast({
        tone: 'error',
        title: t('update.launcherUpdate'),
        message: t('messages.updateCheckFailed', { error: error?.message || error }),
      });
    }
  };

  const handleOpenMinecraftDirectory = async () => {
    try {
      const result = await launcher.minecraftOpenRootDirectory?.();
      if (result?.error) {
        addLog('error', t('messages.openMinecraftDirectoryFailed', { error: result.message || result.error }));
        return;
      }
      if (result?.ok) {
        addLog('info', t('messages.openMinecraftDirectorySuccess', { path: result.path || settings.minecraftRoot }));
      }
    } catch (error) {
      addLog('error', t('messages.openMinecraftDirectoryFailed', { error: error?.message || error }));
    }
  };

  return (
    <>
      <div className="toast-stack" aria-live="polite" aria-label={t('settings.title')}>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </div>

      {/* Title bar */}
      <div className="titlebar">
        <div className="titlebar-brand">
          <div className="titlebar-logo">
            <img src={logoIcon} alt="Logo" style={{ width: 24, height: 24 }} onError={(event) => {
              event.currentTarget.style.display = 'none';
            }} />
          </div>
          <span className="titlebar-name">{t('app.name')}</span>
          <span className="titlebar-version">{appVersion || '...'}</span>
        </div>
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
      </div>

      {/* Main layout */}
      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">{t('sidebar.profiles')}</div>
            {profiles.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', padding: '8px 2px' }}>
                {t('sidebar.noProfiles')}
              </div>
            ) : profiles.map(p => {
              const installedProfileVersion = p.version
                ? installedVersions.find(version => version.id === p.version) || getVersionById(p.version, versionCatalog)
                : null;
              const profileVersionLabel = installedProfileVersion?.mcVer || 'No version';
              const profileVersionType = installedProfileVersion?.type || t('profile.launcherSelector');

              return (
                <div
                  key={p.id}
                  className={`profile-card ${p.id === activeProfileId ? 'active' : ''}`}
                  onClick={() => {
                    if (authRefreshing || gameState === 'running') return;
                    setActiveProfileId(p.id);
                  }}
                  style={{ opacity: authRefreshing || gameState === 'running' ? 0.6 : 1, cursor: authRefreshing || gameState === 'running' ? 'not-allowed' : 'pointer' }}
                >
                  <div className="profile-card-header">
                    <span className="profile-name">{p.name}</span>
                    <ProfileCardActions
                      active={p.id === activeProfileId}
                      name={p.name}
                      disabled={authRefreshing || gameState === 'running'}
                      onEdit={(e) => {
                        if (authRefreshing || gameState === 'running') return;
                        e.stopPropagation();
                        setProfileEditor({ mode: 'edit', profileId: p.id });
                      }}
                      onDelete={(e) => {
                        if (authRefreshing || gameState === 'running') return;
                        e.stopPropagation();
                        handleDeleteProfile(p.id);
                      }}
                    />
                  </div>
                  <div className="profile-version">
                    {profileVersionLabel}
                    {' · '}
                    {profileVersionType}
                    {' · '}
                    {p.ram}GB
                    {p.localName ? ` · ${p.localName}` : ''}
                    {p.javaPath ? ' · custom JVM' : ''}
                  </div>
                </div>
              );
            })}
            <button className="add-profile-btn" onClick={() => setProfileEditor({ mode: 'new', profileId: null })} disabled={authRefreshing || gameState === 'running'}>
              <Icon d={ICONS.plus} size={12} />
              {t('sidebar.newProfile')}
            </button>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section" style={{ paddingTop: 8 }}>
            <div className="sidebar-label">{t('sidebar.navigation')}</div>
            {[
              { key: 'news', label: t('sidebar.news'), icon: ICONS.news },
              { key: 'console', label: t('sidebar.console'), icon: ICONS.console },
              { key: 'mods', label: t('sidebar.modManager'), icon: ICONS.cube },
            ].map(item => (
              <div key={item.key} className="nav-item" onClick={() => setActiveTab(item.key)} disabled={authRefreshing}>
                <span className="nav-icon"><Icon d={item.icon} size={14} /></span>
                {item.label}
              </div>
            ))}
          </div>

          <div className="account-area">
            {account.loggedIn ? (
              <div className="account-card">
                <div className="account-top">
                  <div className="account-avatar">
                    {accountAvatarUrl ? (
                      <img
                        src={accountAvatarUrl}
                        alt={`${account.name} avatar`}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Icon d={ICONS.cube} size={12} />
                    )}
                  </div>
                  <div className="account-info">
                    <div className="account-name">{account.name}</div>
                    <div className={`account-status ${gameState === 'running' ? 'online' : 'offline'}`}>
                      {authRefreshing ? (
                        <>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="play-btn-icon spinning"><Icon d={ICONS.refresh} size={10} /></span>
                            {t('account.refreshingAuth')}
                          </span>
                        </>
                      ) : account.kind === 'microsoft' ? (
                        gameState === 'running'
                          ? `● ${t('account.microsoft')} · ${t('account.inGame')}`
                          : `○ ${t('account.microsoft')}`
                      ) : (
                        gameState === 'running'
                          ? `● ${t('account.local')} · ${t('account.inGame')}`
                          : `○ ${t('account.local')}`
                      )}
                    </div>
                  </div>
                </div>
                {!authRefreshing && account.kind === 'microsoft' ? (
                  <button className="ms-link-btn account-action-btn" onClick={handleLogout}>
                    <Icon d={ICONS.logout} size={12} />
                    <span>{t('account.logout')}</span>
                  </button>
                ) : account.kind !== 'microsoft' && !authRefreshing ? (
                  <button className="ms-link-btn account-action-btn" onClick={handleLogin}>
                    <MicrosoftLogo />
                    <span>{t('account.loginWithMicrosoft')}</span>
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="account-card">
                <div className="account-top">
                  <div className="account-avatar">
                    <Icon d={ICONS.cube} size={12} />
                  </div>
                  <div className="account-info">
                    <div className="account-name">{t('account.loggedOut')}</div>
                    <div className="account-status offline">
                      {authRefreshing ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="play-btn-icon spinning"><Icon d={ICONS.refresh} size={10} /></span>
                          {t('account.loading')}
                        </span>
                      ) : t('account.createOrSelectProfile')}
                    </div>
                  </div>
                </div>
                <button className="ms-link-btn account-action-btn" onClick={handleLogin}>
                  <MicrosoftLogo />
                  <span>{t('account.loginWithMicrosoft')}</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          {updateState.phase === 'downloading' || updateState.phase === 'launching' || updateState.phase === 'complete' ? (
            <div className={`update-banner ${updateState.phase}`}>
              <div className="update-banner-copy">
                <div className="update-banner-title">{t('update.launcherUpdate')}</div>
                <div className="update-banner-text">{updateState.message || t('update.preparingUpdate')}</div>
              </div>
              <div className="update-banner-meta">
                {updateState.phase === 'downloading' && typeof updateState.progress === 'number'
                  ? `${updateState.progress}%`
                  : updateState.phase === 'launching'
                    ? t('update.installing')
                    : t('update.done')}
              </div>
              <div className="update-banner-track">
                <div className="update-banner-fill" style={{ width: `${Math.max(0, Math.min(100, updateState.progress || 0))}%` }} />
              </div>
            </div>
          ) : null}
            {/* Action bar */}
           <div className="action-bar">
             <button className="action-btn" onClick={() => setModal('install-minecraft')} disabled={gameState === 'running'}>
               <span className="btn-icon"><Icon d={ICONS.download} size={13} /></span>
                 {t('install.minecraft')}
             </button>
             <button className="action-btn" onClick={() => setModal('install-fabric')} disabled={gameState === 'running'}>
               <span className="btn-icon"><Icon d={ICONS.download} size={13} /></span>
                 {t('install.fabric')}
             </button>
             <button className="action-btn" onClick={() => setModal('install-forge')} disabled={gameState === 'running'}>
               <span className="btn-icon"><Icon d={ICONS.download} size={13} /></span>
                 {t('install.forge')}
             </button>
             <button className="action-btn" style={{ marginLeft: 'auto' }} onClick={() => setModal('settings')} disabled={gameState === 'running'}>
               <span className="btn-icon"><Icon d={ICONS.settings} size={13} /></span>
                 {t('settings.title')}
             </button>
           </div>

{/* Console tab */}
           <div className={`tab-panel ${activeTab === 'console' ? 'active' : ''}`}
             style={{ display: activeTab === 'console' ? 'flex' : 'none' }}>
             <div className="console-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
               <div className="console-header">
                 <div className="console-title">
                   <div className={`console-indicator ${gameState === 'running' ? 'running' : ''}`} />
                   {t('console.outputLog')}
                   {gameState === 'loading' && (
                     <span style={{ color: 'var(--warning)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                       — {t('console.loading', { progress })}
                     </span>
                   )}
                   {gameState === 'running' && (
                     <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                       — {t('console.running')}
                     </span>
                   )}
                 </div>
                 {settings.showConsole ? (
                   <div className="console-actions">
                     <button className="console-icon-btn" title={t('console.copy')} onClick={handleCopyConsole}>
                       <Icon d={ICONS.copy} size={11} />
                     </button>
                     <button className="console-icon-btn" title={t('console.clear')} onClick={handleClearConsole}>
                       <Icon d={ICONS.clear} size={11} />
                     </button>
                   </div>
                 ) : (
                   <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                     {t('console.hiddenInSettings')}
                   </div>
                 )}
               </div>
               {settings.showConsole ? (
                 <div className="console-body" ref={consoleRef} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                   {logs.length === 0 ? (
                     <span style={{ color: 'var(--text-muted)' }}>{t('console.noLogsYet')}</span>
                   ) : (
                     logs.map((entry, i) => <LogLine key={i} entry={entry} />)
                   )}
                 </div>
               ) : (
                 <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                   {t('console.consoleOutputHidden')}
                 </div>
               )}
             </div>
           </div>

          {/* News tab */}
          <div className={`tab-panel ${activeTab === 'news' ? 'active' : ''}`}
            style={{ display: activeTab === 'news' ? 'flex' : 'none', flexDirection: 'column', gap: 16 }}>
            <div className="news-header">
              <div>
                <div className="news-title">{t('news.title')}</div>
                <div className="news-subtitle">{t('news.subtitle')}</div>
              </div>
              <div className="news-actions">
                <button className="btn-ghost news-refresh-btn" type="button" onClick={loadNews} disabled={newsLoading}>
                  <Icon d={ICONS.refresh} size={11} />
                  {newsLoading ? t('news.loading') : t('news.refresh')}
                </button>
                <button className="btn-primary news-source-btn" type="button" onClick={handleOpenNewsSource}>
                  <Icon d={ICONS.external} size={11} />
                  {t('news.openSource')}
                </button>
              </div>
            </div>

            {newsError ? (
              <div className="news-state news-state-error">
                <div className="news-state-title">{t('news.errorTitle')}</div>
                <div className="news-state-text">{newsError}</div>
              </div>
            ) : null}

            {!newsError && newsLoading && newsItems.length === 0 ? (
              <div className="news-state news-state-loading">
                <span className="play-btn-icon spinning"><Icon d={ICONS.refresh} size={12} /></span>
                <span>{t('news.loading')}</span>
              </div>
            ) : null}

            {!newsLoading && !newsError && newsItems.length === 0 ? (
              <div className="news-state news-state-empty">
                <div className="news-state-title">{t('news.emptyTitle')}</div>
                <div className="news-state-text">{t('news.emptyText')}</div>
              </div>
            ) : null}

            {newsItems.length > 0 ? (
              <div className="news-grid">
                {newsItems.map(item => (
                  <NewsCard key={item.url} item={item} onOpen={handleOpenNewsArticle} />
                ))}
              </div>
            ) : null}
          </div>

          {/* Mods tab */}
          <div className={`tab-panel ${activeTab === 'mods' ? 'active' : ''}`}
            style={{ display: activeTab === 'mods' ? 'flex' : 'none', flexDirection: 'column', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 2px'
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {mods.filter(m => m.enabled).length} {t('mods.active')} · {mods.filter(m => !m.enabled).length} {t('mods.disabled')}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="action-btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => handleSetAllModsEnabled(true)} disabled={!mods.some(mod => !mod.enabled)}>
                  <Icon d={ICONS.download} size={11} />
                  {t('mods.enableAll')}
                </button>
                <button className="action-btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => handleSetAllModsEnabled(false)} disabled={!mods.some(mod => mod.enabled)}>
                  <Icon d={ICONS.stop} size={11} />
                  {t('mods.disableAll')}
                </button>
                <button className="action-btn" style={{ fontSize: 11, padding: '5px 10px' }} onClick={handleAddModClick}>
                  <Icon d={ICONS.plus} size={11} />
                  {t('mods.addMod')}
                </button>
              </div>
            </div>
            <div className="mod-grid">
              {mods.map(mod => (
                <ModCard key={mod.id} mod={mod} onToggle={handleModToggle} onDelete={handleModDelete} />
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bottom-bar">
            <div className="version-selector">
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
                    const currentState = stateRef.current;
                    persistState({
                      profiles: nextProfiles,
                      mods: currentState.mods,
                      logs: currentState.logs,
                      versions: versionCatalog,
                      installTargets,
                      settings: currentState.settings,
                    });
                    return nextProfiles;
                  });
                }}
                disabled={gameState === 'running'}
              >
                {installedVersions.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <span className="version-tag">{activeVersion?.type?.toUpperCase()}</span>
            </div>

            <div className="ram-indicator">
              <div className="ram-bar">
                <div className="ram-fill" style={{ width: `${Math.min(100, (activeProfile?.ram / 16) * 100)}%` }} />
              </div>
              {activeProfile?.ram}{t('game.ram')}
            </div>

            <div style={{ position: 'relative' }}>
              {installId && (
                <button className="btn-ghost" style={{ marginRight: 8 }} onClick={handleCancelInstall}>
                  {t('game.cancelInstall')}
                </button>
              )}
              <button
                className={`play-btn ${gameState === 'loading' || authRefreshing ? 'loading' : ''}`}
                onClick={handlePlay}
                disabled={gameState === 'loading' || authRefreshing}
              >
{gameState === 'loading' || authRefreshing ? (
                   <>
                     <span className="play-btn-icon spinning"><Icon d={ICONS.refresh} size={14} /></span>
                     <span className="play-btn-text">{authRefreshing ? t('game.authenticating') : t('game.loading')}</span>
                   </>
                 ) : gameState === 'running' ? (
                  <>
                    <span className="play-btn-icon"><Icon d={ICONS.stop} size={14} /></span>
                    <span className="play-btn-text">{t('game.stop')}</span>
                  </>
                ) : (
                  <>
                    <span className="play-btn-icon"><Icon d={ICONS.play} size={14} /></span>
                    <span className="play-btn-text">{t('game.play')}</span>
                  </>
                )}
              </button>
              {gameState === 'loading' && (
                <div className="progress-wrapper">
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      {profileEditor && (
        <ProfileModal
          mode={profileEditor.mode}
          profile={profileToEdit}
          versions={installedVersions}
          onClose={() => setProfileEditor(null)}
          onSave={handleSaveProfile}
        />
      )}
      {(modal === 'install-minecraft' || modal === 'install-fabric' || modal === 'install-forge') && (
        <InstallModal
          type={modal.replace('install-', '')}
          installTargets={installTargets}
          onClose={() => setModal(null)}
          onInstall={handleInstall}
        />
      )}
      {modal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingChange}
          onClose={() => setModal(null)}
          onCheckUpdates={handleCheckForUpdates}
          onOpenAbout={handleOpenAbout}
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

// Microsoft logo SVG (simple, no external asset needed)
function MicrosoftLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}