import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, EmptyState } from '../../common/CommonComponents';
import { ModCard } from '../../cards/Cards';
import { useI18n } from '../../../context/I18nContext';

export function ModsTab({
  active,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  modSearch,
  setModSearch,
  mods,
  handleSetAllModsEnabled,
  handleCheckModUpdates,
  checkingModUpdates,
  handleOpenContentFolder,
  handleAddContentClick,
  setExploreType,
  setActiveTab,
  modUpdates,
  updatingMods,
  handleModToggle,
  handleModDelete,
  handleUpdateMod,
  handleOpenLocalModDetails,
}) {
  const { t } = useI18n();

  return (
    <div
      className={`tab-panel ${isDragging ? 'dragging-over' : ''}`}
      style={{ display: active ? 'flex' : 'none', position: 'relative' }}
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

        {mods.length > 0 && (
          <span className="mods-count-badge">
            {mods.filter(m => m.enabled).length}/{mods.length} {t('mods.active')}
          </span>
        )}

        <div className="mods-toolbar-actions">
          {mods.length > 0 && (() => {
            const anyEnabled = mods.some(m => m.enabled);
            return (
              <button
                className="btn-secondary"
                onClick={() => handleSetAllModsEnabled(!anyEnabled)}
                title={anyEnabled ? t('mods.disableAll') : t('mods.enableAll')}
              >
                <Icon d={anyEnabled ? ICONS.stop : ICONS.check} size={12} />
                <span>{anyEnabled ? t('mods.disableAll') : t('mods.enableAll')}</span>
              </button>
            );
          })()}
          <button
            className="btn-secondary"
            onClick={() => handleCheckModUpdates({ silent: false })}
            disabled={checkingModUpdates}
            title={t('mods.checkUpdates')}
          >
            <Icon d={ICONS.refresh} size={12} className={checkingModUpdates ? 'spin-infinite' : ''} />
            <span>{t('mods.checkUpdates')}</span>
          </button>
          <button className="btn-secondary" onClick={() => handleOpenContentFolder('mods')} title={t('mods.openModsFolder')}>
            <Icon d={ICONS.folder} size={12} />
            <span>{t('mods.openFolder')}</span>
          </button>
          <button className="btn-primary" onClick={() => handleAddContentClick('mods')} style={{ fontSize: 12, padding: '6px 14px' }}>
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
          actionText={t('explore.browseMods')}
          actionIcon={ICONS.compass}
          onAction={() => {
            setExploreType('mods');
            setActiveTab('explore');
          }}
          secondaryText={t('mods.openModsFolder')}
          onSecondary={() => handleOpenContentFolder('mods')}
        />
      ) : (() => {
        const filtered = mods.filter(m =>
          String(m.name || '').toLowerCase().includes(modSearch.toLowerCase()) ||
          String(m.fileName || '').toLowerCase().includes(modSearch.toLowerCase())
        );
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
                  onOpenDetails={handleOpenLocalModDetails}
                />
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
