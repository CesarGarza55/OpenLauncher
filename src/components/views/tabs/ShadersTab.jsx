import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, EmptyState } from '../../common/CommonComponents';
import { formatFileSize, cleanMinecraftText } from '../../../utils/formatters';
import { useI18n } from '../../../context/I18nContext';

export function ShadersTab({
  active,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  shaderSearch,
  setShaderSearch,
  shaders,
  handleOpenContentFolder,
  handleAddContentClick,
  setExploreType,
  setActiveTab,
  handleOpenLocalShaderDetails,
  handleDeleteShader,
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
            placeholder={t('mods.searchShadersPlaceholder')}
            value={shaderSearch}
            onChange={e => setShaderSearch(e.target.value)}
          />
          {shaderSearch && (
            <button className="search-clear-btn" onClick={() => setShaderSearch('')}>
              <Icon d={ICONS.x} size={11} />
            </button>
          )}
        </div>

        {shaders.length > 0 && (
          <span className="mods-count-badge">
            {shaders.length} {t('sidebar.shaders')}
          </span>
        )}

        <div className="mods-toolbar-actions">
          <button className="btn-secondary" onClick={() => handleOpenContentFolder('shaders')} title={t('mods.openShadersFolder')}>
            <Icon d={ICONS.folder} size={12} />
            <span>{t('mods.openFolder')}</span>
          </button>
          <button className="btn-primary" onClick={() => handleAddContentClick('shaders')} style={{ fontSize: 12, padding: '6px 14px' }}>
            <Icon d={ICONS.plus} size={12} />
            {t('mods.addShader')}
          </button>
        </div>
      </div>

      {shaders.length === 0 ? (
        <EmptyState
          icon={ICONS.sun}
          title={t('mods.emptyShadersTitle')}
          description={t('mods.emptyShadersText')}
          actionText={t('explore.browseShaders')}
          actionIcon={ICONS.compass}
          onAction={() => {
            setExploreType('shaders');
            setActiveTab('explore');
          }}
          secondaryText={t('mods.openShadersFolder')}
          onSecondary={() => handleOpenContentFolder('shaders')}
        />
      ) : (() => {
        const filtered = shaders.filter(s =>
          String(s.name || '').toLowerCase().includes(shaderSearch.toLowerCase()) ||
          String(s.fileName || '').toLowerCase().includes(shaderSearch.toLowerCase())
        );
        if (filtered.length === 0) {
          return (
            <EmptyState
              icon={ICONS.search}
              title={t('mods.noShadersMatchTitle')}
              description={t('mods.noShadersMatchText')}
              actionText={t('common.clearSearch')}
              onAction={() => setShaderSearch('')}
            />
          );
        }
        return (
          <div className="installed-packs-grid">
            {filtered.map(shader => (
              <div
                key={shader.id || shader.fileName}
                className="installed-pack-card"
                onClick={() => handleOpenLocalShaderDetails(shader)}
              >
                <div className="installed-pack-header">
                  <div className={`installed-pack-icon ${!shader.iconUrl ? 'shader-fallback-icon' : ''}`}>
                    {shader.iconUrl ? (
                      <img
                        src={shader.iconUrl}
                        alt={shader.name}
                        className="installed-pack-img"
                        onError={e => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.classList.add('shader-fallback-icon');
                        }}
                      />
                    ) : (
                      <Icon d={ICONS.sun} size={20} />
                    )}
                  </div>
                  <div className="installed-pack-meta">
                    <span className="installed-pack-title" title={shader.name}>{shader.name}</span>
                    <span className="installed-pack-file" title={shader.fileName}>{shader.fileName}</span>
                  </div>
                </div>
                {shader.description && (
                  <div className="installed-pack-desc" title={cleanMinecraftText(shader.description)}>
                    {cleanMinecraftText(shader.description)}
                  </div>
                )}
                <div className="installed-pack-footer">
                  <span className="installed-pack-size">
                    {shader.size ? formatFileSize(shader.size) : (shader.isDirectory ? 'Folder' : '')}
                  </span>
                  <div className="installed-pack-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="mod-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShader(shader);
                      }}
                      title={t('mods.deleteShader')}
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
