import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, EmptyState } from '../../common/CommonComponents';
import { ModrinthCard, ModrinthCardSkeleton } from '../../cards/Cards';
import { useI18n } from '../../../context/I18nContext';
import { launcher } from '../../../services/launcherClient';

export function ExploreTab({
  active,
  isOnline,
  exploreType,
  setExploreType,
  showBetaInfo,
  setShowBetaInfo,
  betaInfoRef,
  modrinthQuery,
  setModrinthQuery,
  modrinthSort,
  setModrinthSort,
  modrinthLoaderFilter,
  setModrinthLoaderFilter,
  currentLoader,
  modrinthVersionFilter,
  setModrinthVersionFilter,
  currentMcVer,
  modrinthCategory,
  setModrinthCategory,
  modrinthLoading,
  modrinthResults,
  isModInstalled,
  modrinthInstalling,
  handleInstallModrinthMod,
  handleOpenModDetails,
  modrinthSentinelRef,
  modrinthLoadingMore,
}) {
  const { t } = useI18n();

  return (
    <div
      className="tab-panel"
      style={{ display: active ? 'flex' : 'none', position: 'relative' }}
    >
      <div className="explore-header">
        <div>
          <h2 className="explore-title" style={{ display: 'flex', alignItems: 'center' }}>
            {t('explore.title')}
            <div className="explore-beta-wrapper" ref={betaInfoRef}>
              <button
                type="button"
                className={`explore-beta-tag ${showBetaInfo ? 'active' : ''}`}
                onClick={() => setShowBetaInfo(prev => !prev)}
                title={t('mods.modrinthBetaTitle')}
              >
                <span>BETA</span>
                <Icon d={ICONS.info} size={11} style={{ opacity: 0.85 }} />
              </button>
              {showBetaInfo && (
                <div className="explore-beta-popover">
                  <div className="explore-beta-popover-header">
                    <div className="explore-beta-popover-title">
                      <Icon d={ICONS.compass} size={14} style={{ color: 'var(--accent-light, #60a5fa)' }} />
                      <span>{t('mods.modrinthBetaTitle')}</span>
                    </div>
                    <button
                      type="button"
                      className="explore-beta-popover-close"
                      onClick={() => setShowBetaInfo(false)}
                    >
                      <Icon d={ICONS.x} size={10} />
                    </button>
                  </div>
                  <div className="explore-beta-popover-body">
                    {t('mods.modrinthBetaDescription')}
                  </div>
                  <div className="explore-beta-popover-footer">
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '4px 8px', height: 'auto', textDecoration: 'none' }}
                      onClick={() => {
                        launcher.openExternal?.('https://modrinth.com').catch(() => { });
                      }}
                    >
                      <Icon d={ICONS.external} size={11} />
                      <span>Modrinth.com</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </h2>
          <div className="explore-subtitle">{t('explore.subtitle')}</div>
        </div>
        <div className="explore-type-selector">
          <button
            type="button"
            className={`explore-type-pill ${exploreType === 'mods' ? 'active' : ''}`}
            onClick={() => setExploreType('mods')}
          >
            <Icon d={ICONS.cube} size={15} />
            <span>{t('explore.tabMods')}</span>
          </button>
          <button
            type="button"
            className={`explore-type-pill ${exploreType === 'shaders' ? 'active' : ''}`}
            onClick={() => setExploreType('shaders')}
          >
            <Icon d={ICONS.sun} size={15} />
            <span>{t('explore.tabShaders')}</span>
          </button>
          <button
            type="button"
            className={`explore-type-pill ${exploreType === 'resourcepacks' ? 'active' : ''}`}
            onClick={() => setExploreType('resourcepacks')}
          >
            <Icon d={ICONS.layers} size={15} />
            <span>{t('explore.tabResourcePacks')}</span>
          </button>
          <button
            type="button"
            className={`explore-type-pill ${exploreType === 'datapacks' ? 'active' : ''}`}
            onClick={() => setExploreType('datapacks')}
          >
            <Icon d={ICONS.datapack} size={15} />
            <span>{t('explore.tabDatapacks')}</span>
          </button>
        </div>
      </div>

      <div className="modrinth-browser">
        <div className="modrinth-controls-bar">
          <div className="mods-search-box modrinth-search-box">
            <Icon d={ICONS.search} size={14} />
            <input
              type="text"
              className="mods-search-input"
              placeholder={
                exploreType === 'shaders'
                  ? t('mods.searchModrinthShadersPlaceholder')
                  : exploreType === 'resourcepacks'
                    ? t('mods.searchModrinthResourcePacksPlaceholder')
                    : exploreType === 'datapacks'
                      ? t('mods.searchModrinthDatapacksPlaceholder')
                      : t('mods.searchModrinthPlaceholder')
              }
              value={modrinthQuery}
              onChange={e => setModrinthQuery(e.target.value)}
            />
            {modrinthQuery && (
              <button className="search-clear-btn" onClick={() => setModrinthQuery('')}>
                <Icon d={ICONS.x} size={11} />
              </button>
            )}
          </div>

          <div className="modrinth-filters-row">
            <div className="modrinth-filter-select-wrapper">
              <span className="modrinth-filter-label">{t('mods.filterSort')}:</span>
              <select
                className="select-input modrinth-filter-select"
                value={modrinthSort}
                onChange={e => setModrinthSort(e.target.value)}
              >
                <option value="relevance">{t('mods.sortRelevance')}</option>
                <option value="downloads">{t('mods.sortDownloads')}</option>
                <option value="follows">{t('mods.sortFollows')}</option>
                <option value="newest">{t('mods.sortNewest')}</option>
                <option value="updated">{t('mods.sortUpdated')}</option>
              </select>
            </div>

            {exploreType === 'mods' && (
              <div className="modrinth-filter-select-wrapper">
                <span className="modrinth-filter-label">{t('mods.filterLoader')}:</span>
                <select
                  className="select-input modrinth-filter-select"
                  value={modrinthLoaderFilter}
                  onChange={e => setModrinthLoaderFilter(e.target.value)}
                >
                  {currentLoader && (
                    <option value="auto">
                      Auto ({currentLoader.toUpperCase()})
                    </option>
                  )}
                  <option value="all">{t('mods.allLoaders')}</option>
                  <option value="fabric">Fabric</option>
                  <option value="forge">Forge</option>
                  <option value="neoforge">NeoForge</option>
                  <option value="quilt">Quilt</option>
                </select>
              </div>
            )}

            <div className="modrinth-filter-select-wrapper">
              <span className="modrinth-filter-label">{t('mods.filterVersion')}:</span>
              <select
                className="select-input modrinth-filter-select"
                value={modrinthVersionFilter}
                onChange={e => setModrinthVersionFilter(e.target.value)}
              >
                <option value="auto">
                  {currentMcVer ? `Auto (${currentMcVer})` : t('mods.allVersions')}
                </option>
                <option value="all">{t('mods.allVersions')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="modrinth-category-pills">
          {(exploreType === 'shaders' ? [
            { id: 'all', label: t('mods.allCategories') },
            { id: 'fantasy', label: 'Fantasy' },
            { id: 'realistic', label: 'Realistic' },
            { id: 'performance', label: 'Performance' },
            { id: 'semi-realistic', label: 'Semi-Realistic' },
            { id: 'cinematic', label: 'Cinematic' },
            { id: 'vanilla-like', label: 'Vanilla-like' },
          ] : exploreType === 'resourcepacks' ? [
            { id: 'all', label: t('mods.allCategories') },
            { id: '16x', label: '16x' },
            { id: '32x', label: '32x' },
            { id: '64x', label: '64x' },
            { id: '128x', label: '128x' },
            { id: '512x', label: '512x' },
            { id: 'realistic', label: 'Realistic' },
            { id: 'medieval', label: 'Medieval' },
            { id: 'vanilla-like', label: 'Vanilla-like' },
          ] : exploreType === 'datapacks' ? [
            { id: 'all', label: t('mods.allCategories') },
            { id: 'adventure', label: 'Adventure' },
            { id: 'magic', label: 'Magic' },
            { id: 'technology', label: 'Technology' },
            { id: 'worldgen', label: 'World Gen' },
            { id: 'survival', label: 'Survival' },
            { id: 'utility', label: 'Utility' },
            { id: 'minigames', label: 'Minigames' },
            { id: 'vanilla-like', label: 'Vanilla-like' },
          ] : [
            { id: 'all', label: t('mods.allCategories') },
            { id: 'optimization', label: 'Optimization' },
            { id: 'technology', label: 'Technology' },
            { id: 'adventure', label: 'Adventure' },
            { id: 'decoration', label: 'Decoration' },
            { id: 'utility', label: 'Utility' },
            { id: 'magic', label: 'Magic' },
            { id: 'worldgen', label: 'World Gen' },
          ]).map(cat => (
            <button
              key={cat.id}
              className={`category-pill ${modrinthCategory === cat.id ? 'active' : ''}`}
              onClick={() => setModrinthCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Modrinth Grid */}
        {!isOnline ? (
          <EmptyState
            icon={ICONS.wifiOff}
            title={t('offline.modrinthTitle')}
            description={t('offline.modrinthDesc')}
          />
        ) : modrinthLoading ? (
          <div className="modrinth-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
              <ModrinthCardSkeleton key={i} />
            ))}
          </div>
        ) : modrinthResults.length === 0 ? (
          <EmptyState
            icon={ICONS.search}
            title={
              exploreType === 'shaders'
                ? t('mods.noShadersMatchTitle')
                : exploreType === 'resourcepacks'
                  ? t('mods.noResourcePacksMatchTitle')
                  : exploreType === 'datapacks'
                    ? t('mods.noDatapacksMatchTitle')
                    : t('mods.noMatchTitle')
            }
            description={
              exploreType === 'shaders'
                ? t('mods.noModrinthShadersResults')
                : exploreType === 'resourcepacks'
                  ? t('mods.noModrinthResourcePacksResults')
                  : exploreType === 'datapacks'
                    ? t('mods.noModrinthDatapacksResults')
                    : t('mods.noModrinthResults')
            }
            actionText={t('common.clearSearch')}
            onAction={() => {
              setModrinthQuery('');
              setModrinthCategory('all');
              setModrinthLoaderFilter('auto');
              setModrinthVersionFilter('auto');
            }}
          />
        ) : (
          <>
            <div className="modrinth-grid">
              {modrinthResults.map(proj => (
                <ModrinthCard
                  key={proj.project_id || proj.slug}
                  project={proj}
                  installed={isModInstalled(proj)}
                  installing={Boolean(modrinthInstalling[proj.project_id || proj.slug])}
                  onInstall={handleInstallModrinthMod}
                  onOpenDetails={handleOpenModDetails}
                />
              ))}
            </div>
            <div ref={modrinthSentinelRef} className="modrinth-sentinel">
              {modrinthLoadingMore && (
                <div className="modrinth-load-more">
                  <span className="modrinth-spinner small" />
                  <span>{t('account.loading')}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
