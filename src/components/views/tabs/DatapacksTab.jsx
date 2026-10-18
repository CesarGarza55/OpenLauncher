import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, EmptyState } from '../../common/CommonComponents';
import { formatFileSize, cleanMinecraftText } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';

export function DatapacksTab({
  active,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  datapackSearch,
  setDatapackSearch,
  datapacks,
  handleOpenContentFolder,
  handleAddContentClick,
  setExploreType,
  setActiveTab,
  handleOpenLocalDatapackDetails,
  handleDeleteDatapack,
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
            placeholder={t('mods.searchDatapacksPlaceholder')}
            value={datapackSearch}
            onChange={e => setDatapackSearch(e.target.value)}
          />
          {datapackSearch && (
            <button className="search-clear-btn" onClick={() => setDatapackSearch('')}>
              <Icon d={ICONS.x} size={11} />
            </button>
          )}
        </div>

        {datapacks.length > 0 && (
          <span className="mods-count-badge">
            {datapacks.length} {t('sidebar.datapacks')}
          </span>
        )}

        <div className="mods-toolbar-actions">
          <button className="btn-secondary" onClick={() => handleOpenContentFolder('datapacks')} title={t('mods.openDatapacksFolder')}>
            <Icon d={ICONS.folder} size={12} />
            <span>{t('mods.openFolder')}</span>
          </button>
          <button className="btn-primary" onClick={() => handleAddContentClick('datapacks')} style={{ fontSize: 12, padding: '6px 14px' }}>
            <Icon d={ICONS.plus} size={12} />
            {t('mods.addDatapack')}
          </button>
        </div>
      </div>

      {datapacks.length === 0 ? (
        <EmptyState
          icon={ICONS.datapack}
          title={t('mods.emptyDatapacksTitle')}
          description={t('mods.emptyDatapacksText')}
          actionText={t('explore.browseDatapacks')}
          actionIcon={ICONS.compass}
          onAction={() => {
            setExploreType('datapacks');
            setActiveTab('explore');
          }}
          secondaryText={t('mods.openDatapacksFolder')}
          onSecondary={() => handleOpenContentFolder('datapacks')}
        />
      ) : (() => {
        const filtered = datapacks.filter(p =>
          String(p.name || '').toLowerCase().includes(datapackSearch.toLowerCase()) ||
          String(p.fileName || '').toLowerCase().includes(datapackSearch.toLowerCase())
        );
        if (filtered.length === 0) {
          return (
            <EmptyState
              icon={ICONS.search}
              title={t('mods.noDatapacksMatchTitle')}
              description={t('mods.noDatapacksMatchText')}
              actionText={t('common.clearSearch')}
              onAction={() => setDatapackSearch('')}
            />
          );
        }
        return (
          <div className="installed-packs-grid">
            {filtered.map(pack => (
              <div
                key={pack.id || pack.fileName}
                className="installed-pack-card"
                onClick={() => handleOpenLocalDatapackDetails(pack)}
              >
                <div className="installed-pack-header">
                  <div className="installed-pack-icon">
                    {pack.iconUrl ? (
                      <img src={pack.iconUrl} alt={pack.name} className="installed-pack-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <Icon d={ICONS.datapack} size={20} />
                    )}
                  </div>
                  <div className="installed-pack-meta">
                    <span className="installed-pack-title" title={pack.name}>{pack.name}</span>
                    <span className="installed-pack-file" title={pack.fileName}>{pack.fileName}</span>
                  </div>
                </div>
                {pack.description && (
                  <div className="installed-pack-desc" title={cleanMinecraftText(pack.description)}>
                    {cleanMinecraftText(pack.description)}
                  </div>
                )}
                <div className="installed-pack-footer">
                  <span className="installed-pack-size">
                    {pack.size ? formatFileSize(pack.size) : (pack.isDirectory ? 'Folder' : '')}
                  </span>
                  <div className="installed-pack-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="mod-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDatapack(pack);
                      }}
                      title={t('mods.deleteDatapack')}
                    >
                      <Icon d={ICONS.trash} size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
