import { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';
import { MINECRAFT_INSTANCE_ICONS } from '../../constants/instanceIcons';

export function MigrateInstanceModal({
  availableVersions = [],
  systemTotalRam = 8,
  onClose,
  onMigrate,
}) {
  const { t } = useI18n();

  const [scan, setScan] = useState(null);
  const [loadingScan, setLoadingScan] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  const [name, setName] = useState(t('migration.defaultName'));
  const [version, setVersion] = useState(availableVersions[0]?.id || '1.21.1');
  const [icon, setIcon] = useState('crafting_table');
  const [ram, setRam] = useState(4);
  const [moveMode, setMoveMode] = useState(false); // false = copy (default, safe), true = convert (move)

  // Included checkboxes
  const [includeMods, setIncludeMods] = useState(true);
  const [includeConfig, setIncludeConfig] = useState(true);
  const [includeShaders, setIncludeShaders] = useState(true);
  const [includeResourcepacks, setIncludeResourcepacks] = useState(true);
  const [includeSaves, setIncludeSaves] = useState(true);
  const [includeOptions, setIncludeOptions] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (typeof window !== 'undefined' && window.launcher?.scanBaseDirectory) {
          const res = await window.launcher.scanBaseDirectory();
          if (isMounted) setScan(res);
        }
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        if (isMounted) setLoadingScan(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const handleStartMigration = async (e) => {
    e.preventDefault();
    if (!name.trim() || isMigrating) return;

    const includeList = [];
    if (includeMods) includeList.push('mods');
    if (includeConfig) includeList.push('config');
    if (includeShaders) includeList.push('shaderpacks');
    if (includeResourcepacks) includeList.push('resourcepacks');
    if (includeSaves) includeList.push('saves');
    if (includeOptions) includeList.push('options');

    setIsMigrating(true);
    try {
      const lower = version.toLowerCase();
      const detectedLoader = lower.includes('fabric') ? 'fabric'
        : lower.includes('neoforge') ? 'neoforge'
        : lower.includes('forge') ? 'forge'
        : lower.includes('quilt') ? 'quilt'
        : 'vanilla';

      await onMigrate({
        name: name.trim(),
        version: version.trim(),
        loader: detectedLoader,
        icon,
        ram: Number(ram) || 4,
        move: moveMode,
        include: includeList,
      });
      onClose();
    } catch (err) {
      console.error('Migration failed:', err);
      setIsMigrating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !isMigrating && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <div className="modal-title">{t('migration.title')}</div>
        <div className="modal-subtitle">{t('migration.subtitle')}</div>

        {/* Scan Summary Banner */}
        <div style={{
          padding: 14,
          borderRadius: 10,
          background: 'rgba(74, 158, 255, 0.08)',
          border: '1px solid rgba(74, 158, 255, 0.25)',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            <Icon d={ICONS.folder} size={15} />
            <span>{t('migration.foundInMinecraft')}</span>
          </div>

          {loadingScan ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('common.loading') || 'Cargando...'}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
              <div style={{ color: 'var(--text-main)' }}>
                📦 <strong>{scan?.modsCount || 0}</strong> {t('migration.modsDetected')}
              </div>
              <div style={{ color: 'var(--text-main)' }}>
                🌄 <strong>{scan?.shaderpacksCount || 0}</strong> {t('migration.shadersDetected')}
              </div>
              <div style={{ color: 'var(--text-main)' }}>
                🎨 <strong>{scan?.resourcepacksCount || 0}</strong> {t('migration.resourcepacksDetected')}
              </div>
              <div style={{ color: 'var(--text-main)' }}>
                🌍 <strong>{scan?.savesCount || 0}</strong> {t('migration.savesDetected')}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleStartMigration} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mode Selector: Copiar vs Convertir */}
          <div className="modal-field" style={{ margin: 0 }}>
            <label className="modal-label">
              <span>{t('migration.modeLabel')}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => setMoveMode(false)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: !moveMode ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                  background: !moveMode ? 'rgba(74, 158, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: !moveMode ? 'var(--accent)' : 'var(--text-main)', marginBottom: 2 }}>
                  {t('migration.copyModeTitle')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('migration.copyModeDesc')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMoveMode(true)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: moveMode ? '2px solid #ff7b72' : '1px solid rgba(255,255,255,0.08)',
                  background: moveMode ? 'rgba(255, 123, 114, 0.15)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: moveMode ? '#ff7b72' : 'var(--text-main)', marginBottom: 2 }}>
                  {t('migration.convertModeTitle')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('migration.convertModeDesc')}
                </div>
              </button>
            </div>
          </div>

          {/* Name & Version */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
            <div className="modal-field" style={{ margin: 0 }}>
              <label className="modal-label">
                <span>{t('instances.nameLabel')}</span>
              </label>
              <input
                className="modal-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('migration.namePlaceholder')}
                required
              />
            </div>

            <div className="modal-field" style={{ margin: 0 }}>
              <label className="modal-label">
                <span>{t('instances.versionLabel')}</span>
              </label>
              {availableVersions.length > 0 ? (
                <select className="modal-select" value={version} onChange={e => setVersion(e.target.value)}>
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
                  onChange={e => setVersion(e.target.value)}
                />
              )}
            </div>
          </div>

          {/* What to include */}
          <div className="modal-field" style={{ margin: 0 }}>
            <label className="modal-label">
              <span>{t('migration.includeLabel')}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
                <input type="checkbox" checked={includeMods} onChange={e => setIncludeMods(e.target.checked)} />
                <span>{t('sidebar.mods')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
                <input type="checkbox" checked={includeConfig} onChange={e => setIncludeConfig(e.target.checked)} />
                <span>{t('migration.configs')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
                <input type="checkbox" checked={includeShaders} onChange={e => setIncludeShaders(e.target.checked)} />
                <span>{t('sidebar.shaders')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
                <input type="checkbox" checked={includeResourcepacks} onChange={e => setIncludeResourcepacks(e.target.checked)} />
                <span>{t('sidebar.resourcePacks')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
                <input type="checkbox" checked={includeSaves} onChange={e => setIncludeSaves(e.target.checked)} />
                <span>{t('migration.worlds')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-main)' }}>
                <input type="checkbox" checked={includeOptions} onChange={e => setIncludeOptions(e.target.checked)} />
                <span>{t('migration.gameOptions')}</span>
              </label>
            </div>
          </div>

          {/* Icon Picker Compact */}
          <div className="modal-field" style={{ margin: 0 }}>
            <label className="modal-label">
              <span>{t('instances.iconLabel')}</span>
            </label>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {MINECRAFT_INSTANCE_ICONS.slice(0, 10).map(item => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setIcon(item.id)}
                  title={item.name}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    border: icon === item.id ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.06)',
                    background: icon === item.id ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    flexShrink: 0
                  }}
                >
                  <img src={item.src} alt={item.name} style={{ width: 24, height: 24, imageRendering: 'pixelated' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isMigrating}
            >
              {t('common.cancel') || 'Cancelar'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isMigrating || !name.trim()}
              style={{
                background: moveMode ? '#da3633' : undefined,
                borderColor: moveMode ? '#da3633' : undefined
              }}
            >
              {isMigrating ? (
                <>
                  <Icon d={ICONS.spinner} size={15} className="spinning" />
                  <span>{t('migration.migrating')}</span>
                </>
              ) : (
                <>
                  <Icon d={moveMode ? ICONS.arrowRight : ICONS.copy} size={15} />
                  <span>{moveMode ? t('migration.startConvert') : t('migration.startCopy')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
