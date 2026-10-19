import { useState, useMemo } from 'react';
import { useI18n } from '../../../context/I18nContext';
import { ICONS } from '../../../constants/icons';
import { Icon } from '../../common/CommonComponents';
import { getInstanceIconSrc } from '../../../constants/instanceIcons';

export function InstancesTab({
  active = false,
  instances = [],
  activeInstanceId = null,
  onSelectInstance,
  onPlayInstance,
  onCreateInstanceClick,
  onMigrateClick,
  onEditInstanceClick,
  onDeleteInstanceClick,
  onOpenFolderClick,
  runningInstanceId = null,
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');

  const filteredInstances = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return instances;
    return instances.filter(inst =>
      inst.name.toLowerCase().includes(q) ||
      inst.version.toLowerCase().includes(q) ||
      (inst.loader && inst.loader.toLowerCase().includes(q))
    );
  }, [instances, search]);

  const getLoaderBadgeClass = (loader) => {
    switch (loader) {
      case 'fabric': return 'loader-badge-fabric';
      case 'forge': return 'loader-badge-forge';
      case 'neoforge': return 'loader-badge-neoforge';
      case 'quilt': return 'loader-badge-quilt';
      default: return 'loader-badge-vanilla';
    }
  };

  return (
    <div className="tab-panel" style={{ display: active ? 'flex' : 'none', flexDirection: 'column', height: '100%', gap: 16 }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={onCreateInstanceClick}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600 }}
          >
            <Icon d={ICONS.plus} size={16} />
            <span>{t('instances.create')}</span>
          </button>
          <button
            className="btn btn-secondary"
            onClick={onMigrateClick}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px' }}
            title={t('migration.buttonTooltip')}
          >
            <Icon d={ICONS.folder} size={15} />
            <span>{t('migration.buttonLabel')}</span>
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {instances.length === 1
              ? t('instances.instancesCount_one')
              : t('instances.instancesCount_other', { count: instances.length })}
          </span>
        </div>

        <div style={{ position: 'relative', width: 260 }}>
          <input
            type="text"
            className="modal-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('instances.searchPlaceholder')}
            style={{ paddingLeft: 32, height: 36 }}
          />
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
            <Icon d={ICONS.search} size={14} />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <Icon d={ICONS.x} size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Instances */}
      {filteredInstances.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 40,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 12,
          border: '1px dashed rgba(255,255,255,0.1)'
        }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            <Icon d={ICONS.layers} size={28} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
              {instances.length === 0
                ? t('instances.noInstancesTitle')
                : t('instances.noResultsTitle')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
              {instances.length === 0
                ? t('instances.noInstancesDesc')
                : t('instances.noResultsDesc')}
            </div>
          </div>
          {instances.length === 0 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={onCreateInstanceClick}>
                <Icon d={ICONS.plus} size={16} />
                <span>{t('instances.createFirst')}</span>
              </button>
              <button className="btn btn-secondary" onClick={onMigrateClick}>
                <Icon d={ICONS.folder} size={16} />
                <span>{t('migration.buttonLabel')}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="instances-grid">
          {/* Card: Global Installation (.minecraft) */}
          {!search && (
            <div
              onClick={() => onSelectInstance(null)}
              className={`instance-card ${!activeInstanceId ? 'is-active' : ''}`}
            >
              <div className="instance-card-header">
                <div className="instance-card-icon-wrapper">
                  <Icon d={ICONS.folder} size={22} />
                </div>
                <div className="instance-card-title-col">
                  <div className="instance-card-name-row">
                    <div className="instance-card-name" title={t('instances.globalInstallation')}>
                      {t('instances.globalInstallation')}
                    </div>
                    {!activeInstanceId && (
                      <span className="instance-active-badge">
                        {t('instances.activeInstanceBadge')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {t('instances.globalInstallationDesc')}
                  </div>
                </div>
              </div>

              <div className="instance-card-actions">
                <button
                  className="btn btn-secondary btn-icon-only"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFolderClick(null);
                  }}
                  title={t('instances.openFolder')}
                >
                  <Icon d={ICONS.folder} size={13} />
                </button>
                <button
                  className={`btn btn-select ${!activeInstanceId ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectInstance(null);
                  }}
                >
                  <Icon d={!activeInstanceId ? ICONS.check : ICONS.folder} size={13} />
                  <span>{!activeInstanceId ? t('instances.activeInstanceBadge') : t('instances.useGlobal')}</span>
                </button>
              </div>
            </div>
          )}

          {filteredInstances.map(inst => {
            const isActive = inst.id === activeInstanceId;
            const isRunning = runningInstanceId === inst.id;

            return (
              <div
                key={inst.id}
                onClick={() => onSelectInstance(inst.id)}
                className={`instance-card ${isActive ? 'is-active' : ''}`}
              >
                {/* Header: Icon, Name & Status */}
                <div className="instance-card-header">
                  <div className="instance-card-icon-wrapper">
                    <img
                      src={getInstanceIconSrc(inst.icon)}
                      alt={inst.name}
                      className="instance-card-icon-img"
                    />
                  </div>

                  <div className="instance-card-title-col">
                    <div className="instance-card-name-row">
                      <div className="instance-card-name" title={inst.name}>
                        {inst.name}
                      </div>
                      {isActive && (
                        <span className="instance-active-badge">
                          {t('instances.activeInstanceBadge')}
                        </span>
                      )}
                    </div>
                    <div className="instance-card-tags">
                      <span className="instance-tag-version" title={inst.version}>
                        {inst.version}
                      </span>
                      <span className={`instance-tag-loader ${inst.loader ? String(inst.loader).toLowerCase() : 'vanilla'}`}>
                        {inst.loader || 'Vanilla'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info row */}
                <div className="instance-card-meta">
                  <div>
                    {inst.modsCount > 0
                      ? t('instances.modsCount', { count: inst.modsCount })
                      : t('instances.noMods')}
                  </div>
                  <div>
                    {t('instances.allocatedRam', { ram: inst.ram || 4 })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="instance-card-actions">
                  <button
                    className={`btn btn-select ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectInstance(inst.id);
                    }}
                  >
                    <Icon d={isActive ? ICONS.check : ICONS.layers} size={13} />
                    <span>{isActive ? t('instances.selectedInstance') : t('instances.selectInstance')}</span>
                  </button>

                  <button
                    className="btn btn-secondary btn-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayInstance(inst);
                    }}
                    disabled={isRunning}
                    title={t('instances.play')}
                  >
                    <Icon d={isRunning ? ICONS.stop : ICONS.play} size={13} />
                    <span>{isRunning ? t('instances.playing') : t('instances.play')}</span>
                  </button>

                  <button
                    className="btn btn-secondary btn-icon-only"
                    title={t('instances.openFolder')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFolderClick(inst.id);
                    }}
                  >
                    <Icon d={ICONS.folder} size={13} />
                  </button>

                  <button
                    className="btn btn-secondary btn-icon-only"
                    title={t('instances.settings')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditInstanceClick(inst);
                    }}
                  >
                    <Icon d={ICONS.settings} size={14} />
                  </button>

                  <button
                    className="btn btn-secondary btn-icon-only btn-delete"
                    title={t('instances.delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteInstanceClick(inst);
                    }}
                  >
                    <Icon d={ICONS.trash} size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
