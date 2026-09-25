import { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';
import { launcher } from '../../services/launcherClient';
import { getModrinthProject, getModrinthProjectVersions } from '../../lib/modrinth';
import { formatFileSize, formatRelativeTime } from '../../utils/formatters';

export function ModDetailModal({
  project,
  initialTab = 'overview',
  currentLoader,
  currentMcVer,
  mods = [],
  onClose,
  onInstallVersion,
  installingVersionId,
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const projectType = project?.project_type || projectDetails?.project_type || 'mod';
  const isMod = projectType === 'mod';
  const initialLoader = (isMod && currentLoader && currentLoader !== 'vanilla') ? currentLoader : 'all';
  const [loaderFilter, setLoaderFilter] = useState(initialLoader);
  const [mcVersionFilter, setMcVersionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedChangelog, setExpandedChangelog] = useState({});
  const [activeGalleryImg, setActiveGalleryImg] = useState(null);

  const projectId = project.project_id || project.slug || project.id;
  const title = projectDetails?.title || project.title || project.slug;
  const author = projectDetails?.team_members || project.author || '';
  const description = projectDetails?.description || project.description || '';
  const iconUrl = projectDetails?.icon_url || project.icon_url;
  const downloads = Number(projectDetails?.downloads ?? project.downloads ?? 0).toLocaleString();
  const followers = Number(projectDetails?.followers ?? project.follows ?? 0).toLocaleString();
  const license = projectDetails?.license?.name || projectDetails?.license?.id || '';

  useEffect(() => {
    let isMounted = true;
    setLoadingDetails(true);
    const fetchDetails = async () => {
      try {
        let data = null;
        if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetProject) {
          data = await window.launcher.minecraftModrinthGetProject(projectId);
        } else {
          data = await getModrinthProject(projectId);
        }
        if (isMounted && data) {
          setProjectDetails(data);
        }
      } catch (e) {
        console.warn('Failed to load project details:', e);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [projectId]);

  useEffect(() => {
    let isMounted = true;
    setLoadingVersions(true);
    const fetchVersions = async () => {
      try {
        let vers = [];
        if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetVersions) {
          vers = await window.launcher.minecraftModrinthGetVersions({ idOrSlug: projectId });
        } else {
          vers = await getModrinthProjectVersions({ idOrSlug: projectId });
        }
        if (isMounted && Array.isArray(vers)) {
          setVersions(vers);
          const allLoaders = Array.from(new Set(vers.flatMap(v => v.loaders || []).map(l => l.toLowerCase())));
          if (loaderFilter !== 'all' && !allLoaders.includes(loaderFilter.toLowerCase())) {
            setLoaderFilter('all');
          }
        }
      } catch (e) {
        console.warn('Failed to load project versions:', e);
      } finally {
        if (isMounted) setLoadingVersions(false);
      }
    };
    fetchVersions();
    return () => { isMounted = false; };
  }, [projectId]);

  const availableGameVersions = Array.from(
    new Set(versions.flatMap(v => v.game_versions || []))
  ).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const availableLoaders = Array.from(
    new Set(versions.flatMap(v => v.loaders || []))
  );

  const filteredVersions = versions.filter(v => {
    if (typeFilter !== 'all' && v.version_type !== typeFilter) return false;
    if (loaderFilter !== 'all' && !(v.loaders || []).includes(loaderFilter.toLowerCase())) return false;
    if (mcVersionFilter !== 'all' && !(v.game_versions || []).includes(mcVersionFilter)) return false;
    return true;
  });

  const toggleChangelog = (verId) => {
    setExpandedChangelog(prev => ({ ...prev, [verId]: !prev[verId] }));
  };

  const isVersionInstalled = (ver) => {
    if (!ver || !Array.isArray(mods)) return false;
    const file = ver.files?.find(f => f.primary) || ver.files?.[0];
    const fn = (file?.filename || '').toLowerCase().trim();
    const verNum = String(ver.version_number || '').toLowerCase().trim();
    const slug = String(project?.slug || '').toLowerCase().trim();
    const projId = String(project?.id || project?.project_id || '').toLowerCase().trim();

    return mods.some(m => {
      const mFn = String(m.fileName || '').toLowerCase().trim();
      const mVer = String(m.version || '').toLowerCase().trim();
      const mModId = String(m.modId || '').toLowerCase().trim();

      if (fn && mFn === fn) return true;

      const isSameMod = (mModId && (mModId === slug || mModId === projId)) ||
        (slug && !mFn.includes('extra') && !mFn.includes('options') && mFn.startsWith(`${slug}-`));

      if (isSameMod && mVer && verNum && (mVer === verNum || mVer.replace(/^v/i, '') === verNum.replace(/^v/i, ''))) {
        return true;
      }
      return false;
    });
  };

  const gallery = projectDetails?.gallery || [];

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal mod-detail-modal">
        {/* Header */}
        <div className="mod-detail-header">
          <div className="mod-detail-icon-box">
            {iconUrl ? (
              <img src={iconUrl} alt={title} className="mod-detail-icon-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="mod-detail-icon-fallback"><Icon d={ICONS.cube} size={32} /></div>
            )}
          </div>
          <div className="mod-detail-info">
            <div className="mod-detail-title-row">
              <h2 className="mod-detail-title">{title}</h2>
              {projectDetails?.client_side && projectDetails?.server_side && (
                <span className="mod-env-badge">
                  {projectDetails.client_side === 'required' && projectDetails.server_side === 'required'
                    ? t('mods.clientAndServer')
                    : projectDetails.client_side === 'required'
                      ? t('mods.clientOnly')
                      : t('mods.serverOnly')}
                </span>
              )}
            </div>
            <div className="mod-detail-meta-row">
              {author && <span className="mod-detail-author">{t('mods.author', { author })}</span>}
              {license && <span className="mod-detail-license"><Icon d={ICONS.book} size={11} /> {license}</span>}
              <span className="mod-detail-stat"><Icon d={ICONS.download} size={11} /> {downloads}</span>
              <span className="mod-detail-stat"><Icon d={ICONS.star} size={11} /> {followers}</span>
            </div>
            <p className="mod-detail-desc">{description}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} title={t('window.close')}>
            <Icon d={ICONS.x} size={14} />
          </button>
        </div>

        {/* Project Links */}
        {(projectDetails?.source_url || projectDetails?.issues_url || projectDetails?.wiki_url || projectDetails?.discord_url) && (
          <div className="mod-detail-links-bar">
            {projectDetails.source_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.source_url);
                  } else {
                    window.open(projectDetails.source_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.code} size={12} />
                <span>{t('mods.sourceCode')}</span>
              </button>
            )}
            {projectDetails.issues_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.issues_url);
                  } else {
                    window.open(projectDetails.issues_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.info} size={12} />
                <span>{t('mods.issues')}</span>
              </button>
            )}
            {projectDetails.wiki_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.wiki_url);
                  } else {
                    window.open(projectDetails.wiki_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.book} size={12} />
                <span>{t('mods.wiki')}</span>
              </button>
            )}
            {projectDetails.discord_url && (
              <button
                className="mod-link-btn"
                type="button"
                onClick={() => {
                  if (typeof launcher?.minecraftOpenFolder === 'function') {
                    launcher.minecraftOpenFolder(projectDetails.discord_url);
                  } else {
                    window.open(projectDetails.discord_url, '_blank');
                  }
                }}
              >
                <Icon d={ICONS.globe} size={12} />
                <span>{t('mods.discord')}</span>
              </button>
            )}
          </div>
        )}

        {/* Nav tabs */}
        <div className="mod-detail-tabs">
          <button
            className={`mod-detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Icon d={ICONS.news} size={12} />
            <span>{t('mods.overview')}</span>
          </button>
          <button
            className={`mod-detail-tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
            onClick={() => setActiveTab('versions')}
          >
            <Icon d={ICONS.cube} size={12} />
            <span>{t('mods.versions')} ({versions.length})</span>
          </button>
          {gallery.length > 0 && (
            <button
              className={`mod-detail-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
              onClick={() => setActiveTab('gallery')}
            >
              <Icon d={ICONS.copy} size={12} />
              <span>{t('mods.gallery')} ({gallery.length})</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="mod-detail-body">
          {activeTab === 'overview' && (
            <div className="mod-overview-content">
              {gallery.length > 0 && (
                <div className="mod-gallery-preview">
                  {gallery.slice(0, 4).map((img, i) => (
                    <div key={i} className="mod-gallery-thumb" onClick={() => setActiveGalleryImg(img.url)}>
                      <img src={img.url} alt={img.title || `Screenshot ${i + 1}`} />
                      {img.title && <span className="mod-gallery-thumb-title">{img.title}</span>}
                    </div>
                  ))}
                </div>
              )}

              {loadingDetails ? (
                <div className="mod-detail-spinner-box">
                  <span className="btn-spinner" />
                  <span>{t('account.loading')}</span>
                </div>
              ) : projectDetails?.body ? (
                <div className="mod-detail-body-text">
                  {projectDetails.body.split('\n\n').map((para, idx) => {
                    const cleanPara = para.replace(/#{1,6}\s*/g, '').replace(/\*\*/g, '').trim();
                    if (!cleanPara) return null;
                    if (para.startsWith('#')) {
                      return <h4 key={idx} className="mod-body-heading">{cleanPara}</h4>;
                    }
                    if (para.startsWith('- ') || para.startsWith('* ')) {
                      return (
                        <ul key={idx} className="mod-body-list">
                          {para.split('\n').map((li, lidx) => (
                            <li key={lidx}>{li.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={idx} className="mod-body-p">{cleanPara}</p>;
                  })}
                </div>
              ) : (
                <p className="mod-body-p">{description}</p>
              )}
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="mod-versions-content">
              {/* Version Filters */}
              <div className="mod-versions-filters">
                {(!['resourcepack'].includes(projectType) && availableLoaders.filter(l => l.toLowerCase() !== 'minecraft').length > 0) && (
                  <div className="modrinth-filter-select-wrapper">
                    <span className="modrinth-filter-label">{t('mods.filterLoader')}:</span>
                    <select
                      className="select-input modrinth-filter-select"
                      value={loaderFilter}
                      onChange={e => setLoaderFilter(e.target.value)}
                    >
                      <option value="all">{t('mods.allLoaders')}</option>
                      {availableLoaders.map(l => (
                        <option key={l} value={l}>{l.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="modrinth-filter-select-wrapper">
                  <span className="modrinth-filter-label">{t('mods.filterVersion')}:</span>
                  <select
                    className="select-input modrinth-filter-select"
                    value={mcVersionFilter}
                    onChange={e => setMcVersionFilter(e.target.value)}
                  >
                    <option value="all">{t('mods.allVersions')}</option>
                    {availableGameVersions.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="modrinth-filter-select-wrapper">
                  <span className="modrinth-filter-label">{t('mods.releaseType')}:</span>
                  <select
                    className="select-input modrinth-filter-select"
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                  >
                    <option value="all">{t('mods.allReleaseTypes')}</option>
                    <option value="release">{t('mods.release')}</option>
                    <option value="beta">{t('mods.beta')}</option>
                    <option value="alpha">{t('mods.alpha')}</option>
                  </select>
                </div>
              </div>

              {/* Version List */}
              {loadingVersions ? (
                <div className="mod-detail-spinner-box">
                  <span className="btn-spinner" />
                  <span>{t('account.loading')}</span>
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="mod-versions-empty">
                  <Icon d={ICONS.cube} size={24} />
                  <span>{t('mods.noVersionsFound')}</span>
                </div>
              ) : (
                <div className="mod-versions-list">
                  {filteredVersions.map(ver => {
                    const isInstalled = isVersionInstalled(ver);
                    const isInstalling = installingVersionId === ver.id;
                    const primaryFile = ver.files?.find(f => f.primary) || ver.files?.[0];
                    const fileSize = primaryFile?.size ? formatFileSize(primaryFile.size) : '';
                    const dateStr = formatRelativeTime(ver.date_published);
                    const isExpanded = Boolean(expandedChangelog[ver.id]);

                    return (
                      <div key={ver.id} className="mod-version-item">
                        <div className="mod-version-main-row">
                          <div className="mod-version-info">
                            <div className="mod-version-title-row">
                              <span className="mod-version-title" title={ver.name || ver.version_number}>
                                {ver.name || `v${ver.version_number}`}
                              </span>
                              <span className={`version-type-badge ${ver.version_type}`}>
                                {ver.version_type}
                              </span>
                              {isInstalled && (
                                <span className="modrinth-installed-badge">{t('mods.installed')}</span>
                              )}
                            </div>
                            <div className="mod-version-details-row">
                              <span className="mod-version-loaders">
                                {(ver.loaders || []).map(l => l.toUpperCase()).join(', ')}
                              </span>
                              <span>·</span>
                              <span className="mod-version-mcvers">
                                MC {(ver.game_versions || []).slice(0, 3).join(', ')}
                                {(ver.game_versions || []).length > 3 ? ` +${ver.game_versions.length - 3}` : ''}
                              </span>
                              {fileSize && (
                                <>
                                  <span>·</span>
                                  <span className="mod-version-size">{fileSize}</span>
                                </>
                              )}
                              {dateStr && (
                                <>
                                  <span>·</span>
                                  <span className="mod-version-date">{dateStr}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="mod-version-actions">
                            {ver.changelog && (
                              <button
                                className="btn-secondary mod-changelog-toggle-btn"
                                onClick={() => toggleChangelog(ver.id)}
                                title={t('mods.changelog')}
                              >
                                <Icon d={isExpanded ? ICONS.chevronUp : ICONS.chevronDown} size={11} />
                                <span>{t('mods.changelog')}</span>
                              </button>
                            )}

                            {isInstalled ? (
                              <button className="btn-secondary modrinth-btn-installed" disabled>
                                <Icon d={ICONS.check} size={12} />
                                <span>{t('mods.installed')}</span>
                              </button>
                            ) : (
                              <button
                                className="btn-primary mod-version-install-btn"
                                disabled={isInstalling}
                                onClick={() => onInstallVersion(project, ver)}
                              >
                                {isInstalling ? (
                                  <>
                                    <span className="btn-spinner" />
                                    <span>{t('mods.installing')}</span>
                                  </>
                                ) : (
                                  <>
                                    <Icon d={ICONS.download} size={12} />
                                    <span>{t('mods.install')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Changelog Accordion */}
                        {isExpanded && (
                          <div className="mod-version-changelog">
                            <div className="mod-changelog-header">{t('mods.changelog')}:</div>
                            <div className="mod-changelog-text">
                              {ver.changelog ? (
                                ver.changelog.split('\n').map((line, lidx) => (
                                  <div key={lidx}>{line.replace(/#{1,4}\s*/g, '').replace(/\*\*/g, '')}</div>
                                ))
                              ) : (
                                <em>{t('mods.noChangelog')}</em>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="mod-gallery-grid">
              {gallery.map((img, i) => (
                <div key={i} className="mod-gallery-card" onClick={() => setActiveGalleryImg(img.url)}>
                  <img src={img.url} alt={img.title || `Screenshot ${i + 1}`} />
                  {img.title && <div className="mod-gallery-caption">{img.title}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fullscreen Gallery Lightbox */}
        {activeGalleryImg && (
          <div className="gallery-lightbox" onClick={() => setActiveGalleryImg(null)}>
            <img src={activeGalleryImg} alt="Enlarged screenshot" />
            <button className="lightbox-close-btn" onClick={() => setActiveGalleryImg(null)}>
              <Icon d={ICONS.x} size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
