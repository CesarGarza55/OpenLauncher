import { useState, useRef } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';
import { MINECRAFT_INSTANCE_ICONS, getInstanceIconSrc } from '../../constants/instanceIcons';
import { launcher } from '../../services/launcherClient';

export function InstanceModal({
  mode = 'create', // 'create' | 'edit'
  instance = null,
  availableVersions = [],
  systemTotalRam = 8,
  onClose,
  onSave,
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  const detectLoader = (verId) => {
    if (!verId) return 'vanilla';
    const lower = verId.toLowerCase();
    if (lower.includes('fabric')) return 'fabric';
    if (lower.includes('neoforge')) return 'neoforge';
    if (lower.includes('forge')) return 'forge';
    if (lower.includes('quilt')) return 'quilt';
    return 'vanilla';
  };

  const initialVersion = instance?.version || (availableVersions[0]?.id || '1.21.1');
  const [name, setName] = useState(instance?.name || '');
  const [version, setVersion] = useState(initialVersion);
  const [loader, setLoader] = useState(instance?.loader || detectLoader(initialVersion));
  const [icon, setIcon] = useState(instance?.icon || 'grass_block');
  const [customIconData, setCustomIconData] = useState(
    instance?.icon && (instance.icon === 'custom' || instance.icon.startsWith('data:image/'))
      ? instance.icon
      : null
  );
  const [ram, setRam] = useState(instance?.ram || 4);
  const [jvmArguments, setJvmArguments] = useState(instance?.jvmArguments || '');
  const [javaPath, setJavaPath] = useState(instance?.javaPath || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const detectedFromVersion = detectLoader(version);
  const hasInstalledVersions = availableVersions.length > 0;

  const handleVersionChange = (newVer) => {
    setVersion(newVer);
    const detected = detectLoader(newVer);
    setLoader(detected);
  };

  const handlePickCustomImage = async () => {
    // If running in Electron with native file picker available
    if (typeof window !== 'undefined' && window.launcher?.pickInstanceImage) {
      try {
        const res = await launcher.pickInstanceImage();
        if (!res?.canceled && res?.dataUri) {
          setCustomIconData(res.dataUri);
          setIcon('custom');
        }
        return;
      } catch (err) {
        console.warn('Native dialog error, falling back to file input:', err);
      }
    }
    // Fallback only if native picker is not available or throws
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result;
      if (dataUri && typeof dataUri === 'string') {
        setCustomIconData(dataUri);
        setIcon('custom');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveCustomIcon = () => {
    setCustomIconData(null);
    setIcon('grass_block');
  };

  const canSubmit = Boolean(name.trim());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    onSave({
      id: instance?.id,
      name: name.trim(),
      version: version.trim(),
      loader: detectedFromVersion !== 'vanilla' ? detectedFromVersion : loader,
      icon,
      customIconData: icon === 'custom' ? customIconData : null,
      ram: Number(ram) || 4,
      jvmArguments: jvmArguments.trim(),
      javaPath: javaPath.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        <div className="modal-title">
          {mode === 'edit'
            ? t('instances.editTitle')
            : t('instances.createTitle')}
        </div>
        <div className="modal-subtitle">
          {mode === 'edit'
            ? t('instances.editSubtitle')
            : t('instances.createSubtitle')}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Nombre */}
          <div className="modal-field" style={{ margin: 0 }}>
            <label className="modal-label">
              <span>{t('instances.nameLabel')}</span>
              <span style={{ color: 'var(--accent)', fontSize: 10 }}>{t('common.required')}</span>
            </label>
            <input
              className="modal-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('instances.namePlaceholder')}
              autoFocus
            />
          </div>

          {/* Selector de Icono de Bloques / Items de Minecraft */}
          <div className="modal-field" style={{ margin: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="modal-label" style={{ margin: 0 }}>
                <span>{t('instances.iconLabel')}</span>
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePickCustomImage}
                style={{ padding: '4px 10px', fontSize: 11, gap: 5 }}
              >
                <Icon d={ICONS.download} size={12} />
                <span>{t('instances.chooseCustomIcon')}</span>
              </button>
            </div>

            {/* Custom Icon Preview if active */}
            {customIconData && icon === 'custom' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'rgba(74, 158, 255, 0.1)',
                border: '1px solid var(--accent)',
                borderRadius: 8,
                marginBottom: 10
              }}>
                <img
                  src={customIconData}
                  alt="Custom icon"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    objectFit: 'cover',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-main)', fontWeight: 600 }}>
                  {t('instances.chooseCustomIcon')}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRemoveCustomIcon}
                  style={{ padding: '5px 8px', fontSize: 11, color: 'var(--danger)' }}
                  title={t('instances.removeCustomIcon')}
                >
                  <Icon d={ICONS.trash} size={12} />
                </button>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
              gap: 8,
              maxHeight: 140,
              overflowY: 'auto',
              padding: '6px',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              {/* If custom icon exists, render it as selectable first item */}
              {customIconData && (
                <button
                  type="button"
                  onClick={() => setIcon('custom')}
                  title="Custom Icon"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: icon === 'custom' ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                    background: icon === 'custom' ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    transition: 'all 0.1s ease',
                    boxShadow: icon === 'custom' ? '0 0 10px rgba(74, 158, 255, 0.35)' : 'none'
                  }}
                >
                  <img
                    src={customIconData}
                    alt="Custom"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 4,
                      objectFit: 'cover'
                    }}
                  />
                </button>
              )}
              {MINECRAFT_INSTANCE_ICONS.map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setIcon(item.id);
                  }}
                  title={item.name}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: icon === item.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                    background: icon === item.id ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 6,
                    transition: 'all 0.1s ease',
                    boxShadow: icon === item.id ? '0 0 10px rgba(74, 158, 255, 0.35)' : 'none'
                  }}
                >
                  <img
                    src={item.src}
                    alt={item.name}
                    style={{
                      width: 28,
                      height: 28,
                      imageRendering: 'pixelated',
                      objectFit: 'contain'
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Versión y Modloader */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="modal-field" style={{ margin: 0 }}>
              <label className="modal-label">
                <span>{t('instances.versionLabel')}</span>
              </label>
              {availableVersions.length > 0 ? (
                <select className="modal-select" value={version} onChange={e => handleVersionChange(e.target.value)}>
                  {availableVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.label || v.id}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="modal-input"
                  value={version}
                  onChange={e => handleVersionChange(e.target.value)}
                  placeholder="ej. 1.21.1"
                />
              )}
            </div>

            <div className="modal-field" style={{ margin: 0 }}>
              <label className="modal-label">
                <span>{t('instances.loaderLabel')}</span>
                {detectedFromVersion !== 'vanilla' && (
                  <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
                    {t('instances.autoDetected')}
                  </span>
                )}
              </label>
              <select
                className="modal-select"
                value={detectedFromVersion !== 'vanilla' ? detectedFromVersion : loader}
                onChange={e => setLoader(e.target.value)}
                disabled={detectedFromVersion !== 'vanilla'}
                style={{ opacity: detectedFromVersion !== 'vanilla' ? 0.75 : 1 }}
              >
                <option value="vanilla">Vanilla</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="quilt">Quilt</option>
              </select>
            </div>
          </div>

          {/* RAM Asignada */}
          <div className="modal-field" style={{ margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main)' }}>
                {t('instances.allocatedRam', { ram })}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {systemTotalRam ? t('instances.systemRam', { total: systemTotalRam }) : ''}
              </span>
            </div>
            <input
              type="range"
              min="2"
              max={systemTotalRam ? Math.max(8, systemTotalRam) : 16}
              step="1"
              value={ram}
              onChange={e => setRam(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>

          {/* Toggle de opciones avanzadas */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0
              }}
            >
              <Icon d={showAdvanced ? ICONS.chevronUp : ICONS.chevronDown} size={14} />
              <span>{showAdvanced ? t('instances.hideAdvanced') : t('instances.showAdvanced')}</span>
            </button>

            {showAdvanced && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="modal-field" style={{ margin: 0 }}>
                  <label className="modal-label">
                    <span>{t('instances.jvmArgs')}</span>
                  </label>
                  <input
                    className="modal-input"
                    value={jvmArguments}
                    onChange={e => setJvmArguments(e.target.value)}
                    placeholder={t('instances.jvmArgsPlaceholder')}
                  />
                </div>

                <div className="modal-field" style={{ margin: 0 }}>
                  <label className="modal-label">
                    <span>{t('instances.javaPath')}</span>
                  </label>
                  <input
                    className="modal-input"
                    value={javaPath}
                    onChange={e => setJavaPath(e.target.value)}
                    placeholder={t('instances.javaPathPlaceholder')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.cancel') || t('accountModal.close')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {mode === 'edit'
                ? t('common.save')
                : t('instances.createSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
