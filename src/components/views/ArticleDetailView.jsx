import { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';
import { launcher } from '../../services/launcherClient';
import { loadMinecraftArticle } from '../../lib/minecraftNews';

export function ArticleDetailView({ item, onBack }) {
  const { t } = useI18n();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const targetUrl = item?.url || 'https://www.minecraft.net/en-us/articles';

  const handleOpenInBrowser = (url) => {
    const finalUrl = url || targetUrl;
    if (typeof launcher?.openExternal === 'function') {
      launcher.openExternal(finalUrl).catch(() => {});
    } else if (typeof launcher?.minecraftOpenFolder === 'function') {
      launcher.minecraftOpenFolder(finalUrl);
    } else {
      window.open(finalUrl, '_blank');
    }
  };

  const fetchArticle = async () => {
    if (!targetUrl) return;
    setLoading(true);
    setError('');

    try {
      let data = null;
      if (typeof window !== 'undefined' && window.launcher?.minecraftGetArticle) {
        try {
          data = await window.launcher.minecraftGetArticle(targetUrl);
        } catch {}
      }
      if (!data || data.error) {
        data = await loadMinecraftArticle(targetUrl);
      }

      if (data && !data.error) {
        setArticle(data);
      } else {
        throw new Error(data?.error || t('news.errorLoadingArticle') || 'Failed to load article.');
      }
    } catch (err) {
      console.warn('Failed to load article content, using item fallback:', err);
      setError(err?.message || t('news.errorLoadingArticle') || 'Failed to load article.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticle();
  }, [targetUrl]);

  const displayTitle = article?.title || item?.title || 'Minecraft News';
  const displaySubheadline = article?.subheadline || item?.summary || '';
  const displayCategory = article?.category || (item?.author && item.author !== 'mojang' ? item.author : 'Official News');
  const displayAuthor = article?.author || (item?.author && item.author !== 'mojang' ? item.author : 'Minecraft Team');
  const displayDate = article?.date || item?.published || '';
  const displayHeroImage = article?.heroImage || item?.image || '';

  return (
    <div className="project-detail-view article-detail-view">
      {/* Top Navigation / Breadcrumbs Bar */}
      <div className="project-detail-nav-bar">
        <button className="project-detail-back-btn" onClick={onBack} type="button">
          <Icon d={ICONS.arrowLeft} size={13} />
          <span>{t('news.backToNews') || 'Volver a Noticias'}</span>
        </button>

        <div className="project-detail-nav-breadcrumbs">
          <span className="breadcrumb-root">{t('sidebar.news') || 'Noticias'}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current" title={displayTitle}>{displayTitle}</span>
        </div>
      </div>

      {/* Hero Header matching ProjectDetailView structure */}
      <div className="project-detail-hero article-detail-hero-card">
        <div className="project-detail-hero-main">
          <div className="project-detail-hero-icon-box article-hero-icon-box">
            <div className="project-detail-icon-fallback article-icon-fallback">
              <Icon d={ICONS.news} size={38} />
            </div>
          </div>

          <div className="project-detail-hero-info">
            <div className="project-detail-title-row">
              <h1 className="project-detail-title">{displayTitle}</h1>
              {displayCategory && (
                <span className="project-type-chip article-category-chip">{displayCategory}</span>
              )}
              <span className="article-official-chip">
                <Icon d={ICONS.check} size={11} />
                <span>Minecraft.net</span>
              </span>
            </div>

            <div className="project-detail-meta-row">
              {displayAuthor && (
                <span className="project-detail-author">
                  <Icon d={ICONS.user} size={12} /> {displayAuthor}
                </span>
              )}
              {displayDate && (
                <span className="project-detail-stat">
                  <Icon d={ICONS.clock} size={12} /> {displayDate}
                </span>
              )}
            </div>

            {displaySubheadline && (
              <p className="project-detail-desc article-hero-desc">{displaySubheadline}</p>
            )}
          </div>
        </div>

        {/* Primary Action Button in Hero */}
        <div className="project-detail-hero-actions">
          <button
            className="btn-secondary hero-modrinth-btn article-hero-btn"
            type="button"
            onClick={() => handleOpenInBrowser(targetUrl)}
            title={t('news.openInBrowser') || 'Abrir en navegador'}
            style={{ gap: 6, padding: '8px 16px', fontSize: 13 }}
          >
            <Icon d={ICONS.external} size={13} />
            <span>{t('news.openInBrowser') || 'Minecraft.net'}</span>
          </button>
        </div>
      </div>

      {/* Main Body Content Container */}
      <div className="project-detail-content-body article-detail-body">
        {/* Featured Banner at top of content flow */}
        {displayHeroImage && (
          <div className="article-featured-banner">
            <img
              src={displayHeroImage}
              alt={displayTitle}
              className="article-featured-img"
              onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
            />
          </div>
        )}
        {loading ? (
          <div className="article-loading-skeleton">
            <div className="mod-skeleton-box" style={{ width: '100%', height: '18px', borderRadius: 'var(--radius-xs)', marginBottom: '12px' }} />
            <div className="mod-skeleton-box" style={{ width: '92%', height: '18px', borderRadius: 'var(--radius-xs)', marginBottom: '12px' }} />
            <div className="mod-skeleton-box" style={{ width: '96%', height: '18px', borderRadius: 'var(--radius-xs)', marginBottom: '24px' }} />
            
            <div className="mod-skeleton-box" style={{ width: '45%', height: '26px', borderRadius: 'var(--radius-xs)', marginBottom: '16px' }} />
            
            <div className="mod-skeleton-box" style={{ width: '100%', height: '240px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }} />
            
            <div className="mod-skeleton-box" style={{ width: '98%', height: '18px', borderRadius: 'var(--radius-xs)', marginBottom: '12px' }} />
            <div className="mod-skeleton-box" style={{ width: '90%', height: '18px', borderRadius: 'var(--radius-xs)', marginBottom: '12px' }} />
            <div className="mod-skeleton-box" style={{ width: '85%', height: '18px', borderRadius: 'var(--radius-xs)', marginBottom: '12px' }} />
          </div>
        ) : error && (!article || !article.blocks || article.blocks.length === 0) ? (
          <div className="article-error-box">
            <p className="article-error-message">{error}</p>
            {item?.summary && (
              <div className="article-fallback-summary">
                <p>{item.summary}</p>
              </div>
            )}
            <div className="article-error-actions">
              <button className="btn-secondary" type="button" onClick={fetchArticle}>
                <Icon d={ICONS.refresh} size={12} />
                <span>{t('news.refresh') || 'Reintentar'}</span>
              </button>
              <button className="btn-primary" type="button" onClick={() => handleOpenInBrowser(targetUrl)}>
                <Icon d={ICONS.external} size={12} />
                <span>{t('news.openInBrowser') || 'Abrir en navegador'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="article-content-flow">
            {article?.blocks?.map((block, idx) => {
              if (block.type === 'heading') {
                if (block.level === 2) {
                  return <h2 key={idx} className="article-heading-2">{block.text}</h2>;
                }
                if (block.level === 3) {
                  return <h3 key={idx} className="article-heading-3">{block.text}</h3>;
                }
                return <h4 key={idx} className="article-heading-4">{block.text}</h4>;
              }

              if (block.type === 'paragraph') {
                return (
                  <p
                    key={idx}
                    className="article-paragraph"
                    dangerouslySetInnerHTML={{ __html: block.html || block.text }}
                  />
                );
              }

              if (block.type === 'video') {
                return (
                  <div key={idx} className="article-video-wrapper">
                    <iframe
                      src={block.embedUrl}
                      title={block.title || displayTitle}
                      className="article-video-iframe"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                );
              }

              if (block.type === 'image') {
                return (
                  <figure key={idx} className="article-figure">
                    <img
                      src={block.src}
                      alt={block.alt || displayTitle}
                      className="article-inline-img"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                    />
                    {block.alt && <figcaption className="article-figcaption">{block.alt}</figcaption>}
                  </figure>
                );
              }

              if (block.type === 'list') {
                return (
                  <ul key={idx} className="article-list">
                    {block.items.map((it, liIdx) => (
                      <li key={liIdx} className="article-list-item">{it}</li>
                    ))}
                  </ul>
                );
              }

              if (block.type === 'ordered-list') {
                return (
                  <ol key={idx} className="article-ordered-list">
                    {block.items.map((it, liIdx) => (
                      <li key={liIdx} className="article-list-item">{it}</li>
                    ))}
                  </ol>
                );
              }

              if (block.type === 'quote') {
                return (
                  <blockquote key={idx} className="article-blockquote">
                    <p>{block.text}</p>
                  </blockquote>
                );
              }

              return null;
            })}

            {/* End of article footer banner */}
            <div className="article-footer-cta">
              <div className="article-footer-info">
                <span className="article-footer-title">{displayTitle}</span>
                <span className="article-footer-subtitle">Publicado en Minecraft.net</span>
              </div>
              <div className="article-footer-buttons">
                <button className="btn-secondary" type="button" onClick={onBack}>
                  <Icon d={ICONS.arrowLeft} size={12} />
                  <span>{t('news.backToNews') || 'Volver a Noticias'}</span>
                </button>
                <button className="btn-primary" type="button" onClick={() => handleOpenInBrowser(targetUrl)}>
                  <Icon d={ICONS.external} size={12} />
                  <span>{t('news.openInBrowser') || 'Abrir en navegador'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
