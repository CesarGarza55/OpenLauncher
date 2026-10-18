import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, EmptyState } from '../../common/CommonComponents';
import { formatFileSize, cleanMinecraftText } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';

export function ResourcePacksTab({
  active,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  resourcePackSearch,
  setResourcePackSearch,
  resourcePacks,
  handleOpenContentFolder,
  handleAddContentClick,
  setExploreType,
  setActiveTab,
  handleOpenLocalResourcePackDetails,
  handleDeleteResourcePack,
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
            placeholder={t('mods.searchResourcePacksPlaceholder')}
            value={resourcePackSearch}
            onChange={e => setResourcePackSearch(e.target.value)}
          />
          {resourcePackSearch && (
            <button className="search-clear-btn" onClick={() => setResourcePackSearch('')}>
              <Icon d={ICONS.x} size={11} />
            </button>
          )}
        </div>

        {resourcePacks.length > 0 && (
          <span className="mods-count-badge">
            {resourcePacks.length} {t('sidebar.resourcePacks')}
          </span>
        )}

        <div className="mods-toolbar-actions">
          <button className="btn-secondary" onClick={() => handleOpenContentFolder('resourcepacks')} title={t('mods.openResourcePacksFolder')}>
            <Icon d={ICONS.folder} size={12} />
            <span>{t('mods.openFolder')}</span>
          </button>
          <button className="btn-primary" onClick={() => handleAddContentClick('resourcepacks')} style={{ fontSize: 12, padding: '6px 14px' }}>
            <Icon d={ICONS.plus} size={12} />
            {t('mods.addResourcePack')}
          </button>
        </div>
      </div>

      {resourcePacks.length === 0 ? (
        <EmptyState
          icon={ICONS.layers}
          title={t('mods.emptyResourcePacksTitle')}
          description={t('mods.emptyResourcePacksText')}
          actionText={t('explore.browseResourcePacks')}
          actionIcon={ICONS.compass}
          onAction={() => {
            setExploreType('resourcepacks');
            setActiveTab('explore');
          }}
          secondaryText={t('mods.openResourcePacksFolder')}
          onSecondary={() => handleOpenContentFolder('resourcepacks')}
        />
      ) : (() => {
        const filtered = resourcePacks.filter(p =>
          String(p.name || '').toLowerCase().includes(resourcePackSearch.toLowerCase()) ||
          String(p.fileName || '').toLowerCase().includes(resourcePackSearch.toLowerCase())
        );
        if (filtered.length === 0) {
          return (
            <EmptyState
              icon={ICONS.search}
              title={t('mods.noResourcePacksMatchTitle')}
              description={t('mods.noResourcePacksMatchText')}
              actionText={t('common.clearSearch')}
              onAction={() => setResourcePackSearch('')}
            />
          );
        }
        return (
          <div className="installed-packs-grid">
            {filtered.map(pack => (
              <div
                key={pack.id || pack.fileName}
                className="installed-pack-card"
                onClick={() => handleOpenLocalResourcePackDetails(pack)}
              >
                <div className="installed-pack-header">
                  <div className="installed-pack-icon">
                    {pack.iconUrl ? (
                      <img src={pack.iconUrl} alt={pack.name} className="installed-pack-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <Icon d={ICONS.layers} size={20} />
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
                        handleDeleteResourcePack(pack);
                      }}
                      title={t('mods.deleteResourcePack')}
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
