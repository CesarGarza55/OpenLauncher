import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, EmptyState } from '../../common/CommonComponents';
import { NewsCard } from '../../cards/Cards';
import { useI18n } from '../../../context/I18nContext';

export function NewsTab({
  active,
  isOnline,
  newsItems,
  newsLoading,
  newsError,
  loadNews,
  handleOpenNewsSource,
  handleOpenNewsArticle,
}) {
  const { t } = useI18n();

  return (
    <div className="tab-panel" style={{ display: active ? 'flex' : 'none' }}>
      <div className="news-header">
        <div>
          <h2 className="news-title">{t('news.title')}</h2>
          <div className="news-subtitle">{t('news.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" type="button" onClick={loadNews} disabled={newsLoading}>
            <Icon d={ICONS.refresh} size={11} />
            {newsLoading ? t('news.loading') : t('news.refresh')}
          </button>
          <button className="btn-primary" type="button" onClick={handleOpenNewsSource} style={{ fontSize: 12, padding: '6px 12px' }}>
            <Icon d={ICONS.external} size={11} />
            {t('news.openSource')}
          </button>
        </div>
      </div>

      {!isOnline && newsItems.length === 0 ? (
        <EmptyState
          icon={ICONS.wifiOff}
          title={t('offline.newsTitle')}
          description={t('offline.newsDesc')}
          actionText={t('news.refresh')}
          actionIcon={ICONS.refresh}
          onAction={loadNews}
        />
      ) : newsError ? (
        <EmptyState
          icon={ICONS.news}
          title={t('news.errorTitle')}
          description={newsError}
          actionText={t('news.refresh')}
          actionIcon={ICONS.refresh}
          onAction={loadNews}
          secondaryText={t('news.openSource')}
          onSecondary={handleOpenNewsSource}
        />
      ) : newsLoading && newsItems.length === 0 ? (
        <div className="news-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="news-card-skeleton">
              <div className="skeleton-media" />
              <div className="skeleton-body">
                <div className="skeleton-line short" />
                <div className="skeleton-line" />
                <div className="skeleton-line sub" />
              </div>
            </div>
          ))}
        </div>
      ) : newsItems.length === 0 ? (
        <EmptyState
          icon={ICONS.news}
          title={t('news.emptyTitle')}
          description={t('news.emptyText')}
          actionText={t('news.refresh')}
          actionIcon={ICONS.refresh}
          onAction={loadNews}
          secondaryText={t('news.openSource')}
          onSecondary={handleOpenNewsSource}
        />
      ) : (
        <div className="news-grid">
          {newsItems.map((item, index) => (
            <NewsCard key={item.id || item.guid || `${item.url || 'news'}-${index}`} item={item} onOpen={handleOpenNewsArticle} />
          ))}
        </div>
      )}
    </div>
  );
}
