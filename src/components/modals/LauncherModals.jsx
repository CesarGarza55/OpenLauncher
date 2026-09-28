import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon, Toggle } from '../common/CommonComponents';
import { LoaderLogo } from '../common/LoaderLogo';
import { launcher } from '../../services/launcherClient';
import { getInstallInfo, loadLauncherCatalog } from '../../lib/minecraftLauncher';
import logoIcon from '/icon.webp';

export function ProfileModal({ mode = 'new', profile, versions, systemTotalRam: initialSystemRam, onClose, onSave }) {
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
          <input
            className="modal-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('profile.profileNamePlaceholder')}
            autoFocus
          />
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
            {typeof initialSystemRam === 'number' && initialSystemRam > 0 ? (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('profile.systemTotalRam', { total: initialSystemRam })}</span>
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

export function InstallModal({ initialType = 'minecraft', installTargets, showSnapshots = false, onToggleSnapshots, onClose, onInstall, onCatalogLoaded }) {
  const { t } = useI18n();
  const [selectedType, setSelectedType] = useState(initialType);
  const [loading, setLoading] = useState(false);
  const info = getInstallInfo(selectedType, installTargets);
  const usesGameAndLoader = selectedType === 'fabric' || selectedType === 'quilt' || selectedType === 'forge' || selectedType === 'neoforge';
  const hasVersions = usesGameAndLoader ? (info.gameVersions?.length > 0) : (info.versions?.length > 0);

  const fetchCatalogForSnapshots = useCallback(async (snapshotsEnabled) => {
    setLoading(true);
    try {
      const fetchFn = launcher.minecraftGetCatalog
        ? () => launcher.minecraftGetCatalog({ includeSnapshots: snapshotsEnabled, showSnapshots: snapshotsEnabled })
        : () => loadLauncherCatalog({ includeSnapshots: snapshotsEnabled });

      const catalog = await fetchFn();
      if (catalog && onCatalogLoaded) {
        onCatalogLoaded(catalog);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [onCatalogLoaded]);

  useEffect(() => {
    if (!hasVersions && !loading) {
      fetchCatalogForSnapshots(showSnapshots);
    }
  }, [hasVersions, loading, showSnapshots, fetchCatalogForSnapshots]);

  const [gameVersion, setGameVersion] = useState(usesGameAndLoader ? (info.gameVersions?.[0] || '') : (info.versions?.[0] || ''));
  const [loaderVersion, setLoaderVersion] = useState(usesGameAndLoader ? ((info.loadersByGameVersion?.[info.gameVersions?.[0] || ''] || [])[0] || '') : '');

  useEffect(() => {
    if (usesGameAndLoader) {
      const available = info.gameVersions || [];
      if (!available.includes(gameVersion)) {
        const nextGameVersion = available[0] || '';
        const nextLoaderVersion = (info.loadersByGameVersion?.[nextGameVersion] || [])[0] || '';
        setGameVersion(nextGameVersion);
        setLoaderVersion(nextLoaderVersion);
      }
      return;
    }

    const available = info.versions || [];
    if (!available.includes(gameVersion)) {
      setGameVersion(available[0] || '');
      setLoaderVersion('');
    }
  }, [selectedType, info.gameVersions, info.loadersByGameVersion, info.versions, usesGameAndLoader, gameVersion]);

  useEffect(() => {
    if (!usesGameAndLoader) return;

    const loaderOptions = info.loadersByGameVersion?.[gameVersion] || [];
    if (!loaderOptions.includes(loaderVersion)) {
      setLoaderVersion(loaderOptions[0] || '');
    }
  }, [gameVersion, info.loadersByGameVersion, usesGameAndLoader, loaderVersion]);

  const handleToggle = async () => {
    const nextVal = !showSnapshots;
    onToggleSnapshots?.(nextVal);
    await fetchCatalogForSnapshots(nextVal);
  };

  const loaderOptions = usesGameAndLoader ? (info.loadersByGameVersion?.[gameVersion] || []) : [];
  const canInstall = usesGameAndLoader ? Boolean(gameVersion && loaderVersion) : Boolean(gameVersion);

  const loaderTabs = [
    { id: 'minecraft', label: 'Vanilla' },
    { id: 'fabric', label: 'Fabric' },
    { id: 'forge', label: 'Forge' },
    { id: 'neoforge', label: 'NeoForge' },
    { id: 'quilt', label: 'Quilt' },
  ];

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-title">{t('install.title')}</div>
        <div className="modal-subtitle">{t('install.subtitle')}</div>

        <div className="install-type-selector">
          {loaderTabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`install-type-btn ${selectedType === tab.id ? 'active' : ''}`}
              onClick={() => setSelectedType(tab.id)}
            >
              <LoaderLogo type={tab.id} size={15} className="loader-tab-icon" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {usesGameAndLoader ? (
          <>
            <div className="modal-field">
              <label className="modal-label">{t('install.gameVersion')}</label>
              {info.gameVersions?.length > 0 ? (
                <select className="modal-select" value={gameVersion} onChange={e => setGameVersion(e.target.value)}>
                  {info.gameVersions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--text-muted)' }}>
                  {loading ? t('install.loadingVersions') : t('install.noVersionsAvailable')}
                </div>
              )}
            </div>

            <div className="modal-field">
              <label className="modal-label">{selectedType === 'forge' ? t('install.forgeRelease') : t('install.loader')}</label>
              {loaderOptions.length > 0 ? (
                <select className="modal-select" value={loaderVersion} onChange={e => setLoaderVersion(e.target.value)}>
                  {loaderOptions.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--text-muted)' }}>
                  {loading ? t('install.loadingLoaders') : t('install.noLoadersAvailable')}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="modal-field">
            <label className="modal-label">{t('install.version')}</label>
            {info.versions?.length > 0 ? (
              <select className="modal-select" value={gameVersion} onChange={e => setGameVersion(e.target.value)}>
                {info.versions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <div className="modal-input" style={{ display: 'flex', alignItems: 'center', minHeight: 34, color: 'var(--text-muted)' }}>
                {loading ? t('install.loadingVersions') : t('install.noVersionsAvailable')}
              </div>
            )}
          </div>
        )}

        {selectedType !== 'forge' && (
          <div className="install-snapshot-row">
            <div className="install-snapshot-copy">
              <span className="install-snapshot-title">{t('settings.showSnapshots')}</span>
              <span className="install-snapshot-desc">{t('settings.showSnapshotsDesc')}</span>
            </div>
            <Toggle on={showSnapshots} onToggle={handleToggle} />
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn-ghost" type="button" onClick={onClose}>{t('profile.cancel')}</button>
          <button
            className="btn-primary"
            type="button"
            disabled={!canInstall || loading}
            onClick={() => {
              if (usesGameAndLoader) {
                onInstall(selectedType, { gameVersion, loaderVersion });
              } else {
                onInstall(selectedType, { version: gameVersion });
              }
              onClose();
            }}
          >
            <Icon d={ICONS.download} size={13} />
            <span>{t('install.install')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({
  settings,
  onChange,
  onClose,
  onCheckUpdates,
  onOpenAbout,
  onOpenMinecraftDirectory,
  language,
  onLanguageChange,
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
              <div className="settings-option-title">{t('settings.launchBehavior')}</div>
              <div className="settings-option-description">{t('settings.launchBehaviorDesc')}</div>
            </div>
            <select
              className="modal-select settings-select"
              style={{ width: 'auto', minWidth: 210, fontSize: 12 }}
              value={settings.launchBehavior || (settings.keepOpen ? 'keepOpen' : 'hide')}
              onChange={e => {
                const val = e.target.value;
                onChange('launchBehavior', val);
                onChange('keepOpen', val === 'keepOpen');
              }}
            >
              <option value="keepOpen">{t('settings.launchBehaviorKeepOpen')}</option>
              <option value="hide">{t('settings.launchBehaviorHide')}</option>
              <option value="close">{t('settings.launchBehaviorClose')}</option>
            </select>
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

export function AboutModal({ appVersion, onClose, onOpenSourceCode, onOpenReleases }) {
  const { t } = useI18n();
  const versionLabel = appVersion || t('settings.devBuild');

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal about-modal-card">
        {/* Header Hero */}
        <div className="about-hero">
          <div className="about-logo-wrapper">
            <img
              src={logoIcon}
              alt="OpenLauncher"
              className="about-app-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div className="about-hero-details">
            <div className="about-hero-title-row">
              <h2 className="about-app-name">{t('app.name')}</h2>
              <span className="about-version-badge">v{versionLabel}</span>
            </div>
            <p className="about-app-desc">{t('settings.aboutDescription')}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} title={t('window.close')}>
            <Icon d={ICONS.x} size={14} />
          </button>
        </div>

        {/* Developer / Project Metadata */}
        <div className="about-meta-box">
          <div className="about-meta-row">
            <span className="about-meta-label">{t('settings.developedByLabel', { developer: 'CesarGarza55' })}</span>
            <span className="about-meta-pill">{t('settings.licenseLabel', { license: 'GPL-2.0' })}</span>
          </div>
        </div>

        {/* Actions / Links */}
        <div className="modal-actions about-modal-actions">
          <div className="about-external-links">
            <button className="btn-secondary about-btn-link" type="button" onClick={onOpenSourceCode}>
              <Icon d={ICONS.code} size={13} />
              <span>{t('settings.openSourceCode')}</span>
            </button>
            <button className="btn-secondary about-btn-link" type="button" onClick={onOpenReleases}>
              <Icon d={ICONS.external} size={13} />
              <span>{t('settings.openReleases')}</span>
            </button>
          </div>
          <button className="btn-primary" type="button" onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LoginLoadingModal({ onCancel }) {
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

function parseFormattedInline(text) {
  if (!text) return '';
  const parts = [];
  // Match links [text](url), bold **text**, inline `code`, italic *text*, or raw URLs https?://...
  const regex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s<>()]+)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        parts.push(
          <a
            key={match.index}
            href={url}
            onClick={(e) => {
              e.preventDefault();
              launcher.openExternal?.(url).catch(() => { });
            }}
            style={{ color: 'var(--accent-bright, #38ef7d)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 500 }}
          >
            {label}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} style={{ color: 'var(--text-bright, #fff)', fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      parts.push(
        <em key={match.index} style={{ color: 'var(--text-dim, #ccc)', fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            background: 'rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.88em',
            color: 'var(--accent-bright, #38ef7d)',
            fontFamily: 'Consolas, Monaco, monospace',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      parts.push(
        <a
          key={match.index}
          href={token}
          onClick={(e) => {
            e.preventDefault();
            launcher.openExternal?.(token).catch(() => { });
          }}
          style={{ color: 'var(--accent, #10b981)', textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
        >
          {token}
        </a>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts.length > 0 ? parts : text;
}

export function ChangelogRenderer({ content }) {
  if (!content) return null;
  const lines = String(content).split('\n');

  const elements = [];
  let currentList = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeBlockLang = '';

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ margin: '6px 0 10px 0', paddingLeft: 20, listStyleType: 'disc' }}>
          {currentList.map((item, i) => (
            <li key={i} style={{ marginBottom: 4, color: 'var(--text, #d0d0d0)', lineHeight: 1.5, fontSize: 13 }}>
              {parseFormattedInline(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <pre
          key={`code-${elements.length}`}
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '10px 14px',
            margin: '8px 0 12px 0',
            overflowX: 'auto',
            fontSize: 12,
            fontFamily: 'Consolas, Monaco, monospace',
            color: 'var(--text-bright, #fff)',
            lineHeight: 1.45,
          }}
        >
          <code>{codeBlockLines.join('\n')}</code>
        </pre>
      );
      codeBlockLines = [];
      codeBlockLang = '';
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    if (!trimmed) {
      flushList();
      return;
    }

    // Dividers
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      elements.push(
        <hr key={index} style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '14px 0' }} />
      );
      return;
    }

    // Blockquotes
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote
          key={index}
          style={{
            margin: '8px 0',
            paddingLeft: 12,
            borderLeft: '3px solid var(--accent, #10b981)',
            color: 'var(--text-dim, #aaa)',
            fontSize: 13,
            fontStyle: 'italic',
          }}
        >
          {parseFormattedInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(
        <h5 key={index} style={{ margin: '12px 0 4px 0', fontSize: 13, fontWeight: 700, color: 'var(--text-bright, #fff)' }}>
          {trimmed.slice(5)}
        </h5>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={index} style={{ margin: '14px 0 6px 0', fontSize: 14, fontWeight: 700, color: 'var(--accent-bright, #38ef7d)' }}>
          {trimmed.slice(4)}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={index} style={{ margin: '16px 0 8px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-bright, #fff)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4 }}>
          {trimmed.slice(3)}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={index} style={{ margin: '18px 0 10px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-bright, #fff)' }}>
          {trimmed.slice(2)}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
      currentList.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      currentList.push(trimmed.replace(/^\d+\.\s/, ''));
    } else {
      flushList();
      elements.push(
        <p key={index} style={{ margin: '4px 0 8px 0', color: 'var(--text, #d0d0d0)', lineHeight: 1.5, fontSize: 13 }}>
          {parseFormattedInline(trimmed)}
        </p>
      );
    }
  });

  if (inCodeBlock) {
    flushCodeBlock();
  }
  flushList();

  return <div style={{ textAlign: 'left' }}>{elements}</div>;
}

function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

export function UpdateModal({ updateInfo, onClose, onInstall }) {
  const { t } = useI18n();
  if (!updateInfo) return null;

  const latestVersion = updateInfo.latestVersion || '';
  if (latestVersion.startsWith('release-')) {
    // Strip "release-" prefix for display purposes
    updateInfo.latestVersion = latestVersion.slice(8);
  }
  const currentVersion = updateInfo.currentVersion || '';
  if (currentVersion.startsWith('release-')) {
    // Strip "release-" prefix for display purposes
    updateInfo.currentVersion = currentVersion.slice(8);
  }
  const releaseNotes = updateInfo.releaseNotes || '';
  const assetSize = typeof updateInfo.asset?.size === 'number' && updateInfo.asset.size > 0
    ? formatFileSize(updateInfo.asset.size)
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ padding: '20px 16px' }}>
      <div
        className="modal update-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '92vw',
          maxWidth: 680,
          maxHeight: 'calc(90vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
          padding: '24px 28px',
        }}
      >
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flex: '0 0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🚀</span>
            <div className="modal-title" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
              {t('updater.updateAvailableTitle')}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title={t('window.close')}>
            <Icon d={ICONS.x} size={14} />
          </button>
        </div>

        <div className="modal-subtitle" style={{ marginTop: 2, marginBottom: 14, flex: '0 0 auto' }}>
          {t('updater.updateAvailableMessage', { latestVersion })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 14,
            background: 'rgba(255,255,255,0.03)',
            padding: '12px 18px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            flex: '0 0 auto',
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
              {t('updater.currentVersionLabel')}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>v{currentVersion}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>➜</div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: 'var(--accent-bright)', display: 'block', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
              {t('updater.newVersionLabel')}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-bright)' }}>v{latestVersion}</span>
          </div>
          {assetSize ? (
            <>
              <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
                  {t('updater.downloadSizeLabel')}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright, #fff)' }}>{assetSize}</span>
              </div>
            </>
          ) : null}
        </div>

        {releaseNotes ? (
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6, flex: '0 0 auto' }}>
              {t('updater.changelogTitle')}
            </div>
            <div
              style={{
                flex: '1 1 auto',
                minHeight: 140,
                maxHeight: 360,
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.35)',
                padding: '16px 20px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <ChangelogRenderer content={releaseNotes} />
            </div>
          </div>
        ) : null}

        <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: 12, marginTop: 4, flex: '0 0 auto' }}>
          <button className="btn-secondary" type="button" onClick={onClose} style={{ minWidth: 100, padding: '9px 18px' }}>
            {t('updater.later')}
          </button>
          <button className="btn-primary" type="button" onClick={() => onInstall(updateInfo)} style={{ padding: '9px 20px' }}>
            <Icon d={ICONS.download} size={15} />
            <span>{t('updater.downloadAndInstall')}{assetSize ? ` (${assetSize})` : ''}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

