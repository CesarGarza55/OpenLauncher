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
