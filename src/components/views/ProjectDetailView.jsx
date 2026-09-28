import { useState, useEffect } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';
import { launcher } from '../../services/launcherClient';
import { getModrinthProject, getModrinthProjectVersions, searchModrinthProjects } from '../../lib/modrinth';
import { formatFileSize, formatRelativeTime, cleanMinecraftText } from '../../utils/formatters';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

export function ProjectDetailView({
  project,
  initialTab = 'overview',
  currentLoader,
  currentMcVer,
  mods = [],
  onBack,
  onInstallVersion,
  installingVersionId,
  parentTabTitle = '',
}) {
  const { t } = useI18n();
  const [currentProject, setCurrentProject] = useState(project);
  const [projectHistory, setProjectHistory] = useState([]);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const projectType = currentProject?.project_type || projectDetails?.project_type || 'mod';
  const isMod = projectType === 'mod';
  const initialLoader = (isMod && currentLoader && currentLoader !== 'vanilla') ? currentLoader : 'all';
  const [loaderFilter, setLoaderFilter] = useState(initialLoader);
  const [mcVersionFilter, setMcVersionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedChangelog, setExpandedChangelog] = useState({});
  const [activeGalleryImg, setActiveGalleryImg] = useState(null);

  const initialProjectId = project?.project_id || project?.slug || project?.modId || project?.id;

  useEffect(() => {
    setCurrentProject(project);
    setProjectHistory([]);
    setProjectDetails(null);
    setVersions([]);
    setLoadingDetails(true);
    setLoadingVersions(true);
  }, [initialProjectId]);

  const handleNavigateModrinth = ({ slug, projectType: pType }) => {
    if (!slug) return;
    setProjectHistory(prev => [...prev, currentProject]);
    setProjectDetails(null);
    setVersions([]);
    setLoadingDetails(true);
    setLoadingVersions(true);
    setCurrentProject({
      project_id: slug,
      slug,
      title: slug,
      project_type: pType || 'mod',
    });
    setActiveTab('overview');
  };

  const handleGoBack = () => {
    if (projectHistory.length > 0) {
      setProjectHistory(prev => {
        const next = [...prev];
        const prevProject = next.pop();
        if (prevProject) {
          setProjectDetails(null);
          setVersions([]);
          setLoadingDetails(true);
          setLoadingVersions(true);
          setCurrentProject(prevProject);
        }
        return next;
      });
    } else if (typeof onBack === 'function') {
      onBack();
    }
  };

  const projectId = currentProject?.project_id || currentProject?.slug || currentProject?.modId || currentProject?.id;
  const targetSlug = projectDetails?.slug || currentProject?.slug || projectId;
  const modrinthUrl = targetSlug
    ? `https://modrinth.com/${projectType === 'shader' ? 'shader' : projectType === 'resourcepack' ? 'resourcepack' : projectType === 'datapack' ? 'datapack' : 'mod'}/${targetSlug}`
    : 'https://modrinth.com';

  const handleOpenExternal = (url) => {
    if (!url) return;
    if (typeof launcher?.openExternal === 'function') {
      launcher.openExternal(url).catch(() => {});
    } else if (typeof launcher?.minecraftOpenFolder === 'function') {
      launcher.minecraftOpenFolder(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const title = projectDetails?.title || currentProject?.title || currentProject?.name || currentProject?.slug;
  const author = projectDetails?.team_members || currentProject?.author || currentProject?.authors || '';
  const description = projectDetails?.description || currentProject?.description || '';
  const iconUrl = projectDetails?.icon_url || currentProject?.iconUrl || currentProject?.icon_url;
  const downloads = Number(projectDetails?.downloads ?? currentProject?.downloads ?? 0).toLocaleString();
  const followers = Number(projectDetails?.followers ?? currentProject?.follows ?? 0).toLocaleString();
  const license = projectDetails?.license?.name || projectDetails?.license?.id || '';

  useEffect(() => {
    let isMounted = true;
    setLoadingDetails(true);
    const fetchDetails = async () => {
      try {
        let data = null;
        if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetProject) {
          try {
            data = await window.launcher.minecraftModrinthGetProject(projectId);
          } catch {}
        }
        if (!data) {
          try {
            data = await getModrinthProject(projectId);
          } catch {}
        }

        // Fallback: search Modrinth if direct lookup failed
        if (!data) {
          const rawQuery = String(currentProject?.title || currentProject?.name || currentProject?.slug || currentProject?.modId || currentProject?.id || '').trim();
          const cleanBase = rawQuery
            .replace(/\.(?:jar|zip|disabled|olpkg)$/i, '')
            .replace(/[-_]v?\d+.*$/i, '')
            .trim();

          const slugCandidates = [
            cleanBase.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
            cleanBase.toLowerCase().replace(/\s+/g, '-'),
            cleanBase.toLowerCase(),
          ];

          for (const cand of slugCandidates) {
            if (cand && cand !== projectId) {
              try {
                if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetProject) {
                  data = await window.launcher.minecraftModrinthGetProject(cand);
                } else {
                  data = await getModrinthProject(cand);
                }
                if (data?.id) break;
              } catch {}
            }
          }

          if (!data) {
            const queryCandidates = [
              cleanBase.replace(/([a-z])([A-Z])/g, '$1 $2'),
              cleanBase,
              cleanBase.replace(/[-_]/g, ' '),
            ].filter((q, idx, arr) => q && q.length >= 2 && arr.indexOf(q) === idx);

            for (const q of queryCandidates) {
              const searchRes = await searchModrinthProjects({
                projectType: projectType || 'mod',
                query: q,
                limit: 5,
              });
              if (searchRes?.hits && searchRes.hits.length > 0) {
                const targetAuthor = String(currentProject?.author || currentProject?.authors || '').toLowerCase().trim();
                const bestHit = targetAuthor
                  ? (searchRes.hits.find(h => String(h.author || '').toLowerCase().trim() === targetAuthor) || searchRes.hits[0])
                  : searchRes.hits[0];

                const resolvedId = bestHit.project_id || bestHit.slug || bestHit.id;
                try {
                  if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetProject) {
                    data = await window.launcher.minecraftModrinthGetProject(resolvedId);
                  } else {
                    data = await getModrinthProject(resolvedId);
                  }
                } catch {
                  data = bestHit;
                }
                if (data) break;
              }
            }
          }
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
  }, [projectId, currentProject?.title, currentProject?.name, projectType]);

  useEffect(() => {
    let isMounted = true;
    const targetId = projectDetails?.id || projectDetails?.project_id || projectDetails?.slug || projectId;
    if (!targetId) return;

    setLoadingVersions(true);
    const fetchVersions = async () => {
      try {
        let vers = [];
        if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthGetVersions) {
          try {
            vers = await window.launcher.minecraftModrinthGetVersions({ idOrSlug: targetId });
          } catch {}
        }
        if (!vers || vers.length === 0) {
          try {
            vers = await getModrinthProjectVersions({ idOrSlug: targetId });
          } catch {}
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
  }, [projectId, projectDetails?.id, projectDetails?.slug]);

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
    const slug = String(currentProject?.slug || '').toLowerCase().trim();
    const projId = String(currentProject?.id || currentProject?.project_id || '').toLowerCase().trim();

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

  const isProjectInstalled = () => {
    if (!Array.isArray(mods) || mods.length === 0) return false;
    const slug = String(currentProject?.slug || '').toLowerCase().trim();
    const projId = String(currentProject?.project_id || currentProject?.id || '').toLowerCase().trim();
    const cleanTitle = String(currentProject?.title || currentProject?.name || '').toLowerCase().trim();

    const matchedInList = mods.some(m => {
      const mModId = String(m.modId || '').toLowerCase().trim();
      const mName = String(m.name || '').toLowerCase().trim();
      const mFile = String(m.fileName || m.id || '').toLowerCase().trim();

      if (mModId && (mModId === slug || mModId === projId)) return true;
      if (cleanTitle && mName === cleanTitle) return true;
      if (slug) {
        if (slug === 'sodium' && (mFile.includes('extra') || mFile.includes('reeses') || mFile.includes('options'))) return false;
        if (slug === 'iris' && mFile.includes('flawless')) return false;
        if (mFile === `${slug}.jar` || mFile === `${slug}.zip` || mFile === `${slug}.olpkg`) return true;
        const slugPrefixRegex = new RegExp(`^${slug}(?:[-_+v0-9.mc]|fabric|neoforge|forge)`, 'i');
        if (slugPrefixRegex.test(mFile)) return true;
      }
      return false;
    });

    return matchedInList || versions.some(v => isVersionInstalled(v));
  };

  // Find recommended version matching currentLoader & currentMcVer
  const recommendedVersion = (() => {
    if (!versions || versions.length === 0) return null;

    let candidates = versions;

    // Filter by loader (if mod)
    if (isMod && currentLoader && currentLoader !== 'vanilla') {
      const loaderMatches = candidates.filter(v =>
        (v.loaders || []).map(l => l.toLowerCase()).includes(currentLoader.toLowerCase())
      );
      if (loaderMatches.length > 0) {
        candidates = loaderMatches;
      }
    }

    // Filter by Minecraft version
    if (currentMcVer) {
      const exactMcMatches = candidates.filter(v =>
        (v.game_versions || []).includes(currentMcVer)
      );
      if (exactMcMatches.length > 0) {
        candidates = exactMcMatches;
      } else {
        const prefix = currentMcVer.split('.').slice(0, 2).join('.');
        const prefixMatches = candidates.filter(v =>
          (v.game_versions || []).some(gv => gv.startsWith(prefix))
        );
        if (prefixMatches.length > 0) {
          candidates = prefixMatches;
        }
      }
    }

    // Prefer release > beta > alpha
    const releases = candidates.filter(v => v.version_type === 'release');
    if (releases.length > 0) return releases[0];
    const betas = candidates.filter(v => v.version_type === 'beta');
    if (betas.length > 0) return betas[0];

    return candidates[0] || versions[0];
  })();

  const installed = isProjectInstalled();
  const isInstallingRecommended = Boolean(installingVersionId && recommendedVersion && installingVersionId === recommendedVersion.id);

  const gallery = projectDetails?.gallery || [];

  const backButtonLabel = projectHistory.length > 0
    ? `${t('mods.backTo')} ${projectHistory[projectHistory.length - 1]?.title || projectHistory[projectHistory.length - 1]?.name || projectHistory[projectHistory.length - 1]?.slug || t('mods.back')}`
    : parentTabTitle
      ? `${t('mods.backTo')} ${parentTabTitle}`
      : t('mods.back');

  return (
    <div className="project-detail-view">
      {/* Top Navigation / Breadcrumbs Bar */}
      <div className="project-detail-nav-bar">
        <button className="project-detail-back-btn" onClick={handleGoBack} type="button">
          <Icon d={ICONS.arrowLeft} size={13} />
          <span>{backButtonLabel}</span>
        </button>

        <div className="project-detail-nav-breadcrumbs">
          <span className="breadcrumb-root">{parentTabTitle || t('sidebar.explore')}</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{title}</span>
        </div>
      </div>

      {/* Hero Header */}
      <div className="project-detail-hero">
        <div className="project-detail-hero-main">
          {loadingDetails && !projectDetails ? (
            <div className="mod-skeleton-box project-detail-hero-icon-skeleton" />
          ) : (
            <div className="project-detail-hero-icon-box">
              {iconUrl ? (
                <img src={iconUrl} alt={title} className="project-detail-hero-icon" onError={e => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="project-detail-icon-fallback"><Icon d={ICONS.cube} size={36} /></div>
              )}
            </div>
          )}

          <div className="project-detail-hero-info">
            {loadingDetails && !projectDetails ? (
              <>
                <div className="mod-skeleton-box" style={{ width: '280px', height: '28px', borderRadius: 'var(--radius-xs)' }} />
                <div className="mod-skeleton-box" style={{ width: '200px', height: '16px', borderRadius: 'var(--radius-xs)' }} />
                <div className="mod-skeleton-box" style={{ width: '85%', height: '14px', borderRadius: 'var(--radius-xs)', marginTop: '4px' }} />
              </>
            ) : (
              <>
                <div className="project-detail-title-row">
                  <h1 className="project-detail-title">{title}</h1>
                  {projectDetails?.client_side && projectDetails?.server_side && (
                    <span className="mod-env-badge">
                      {projectDetails.client_side === 'required' && projectDetails.server_side === 'required'
                        ? t('mods.clientAndServer')
                        : projectDetails.client_side === 'required'
                          ? t('mods.clientOnly')
                          : t('mods.serverOnly')}
                    </span>
                  )}
                  <span className="project-type-chip">{projectType.toUpperCase()}</span>
                </div>

                <div className="project-detail-meta-row">
                  {author && <span className="project-detail-author">{t('mods.author', { author })}</span>}
                  {license && <span className="project-detail-stat"><Icon d={ICONS.book} size={12} /> {license}</span>}
                  <span className="project-detail-stat"><Icon d={ICONS.download} size={12} /> {downloads}</span>
                  <span className="project-detail-stat"><Icon d={ICONS.star} size={12} /> {followers}</span>
                </div>

                <p className="project-detail-desc">{cleanMinecraftText(description)}</p>
              </>
            )}
          </div>
        </div>

        {/* Primary Action Button in Hero */}
        <div className="project-detail-hero-actions">
          <button
            className="btn-secondary hero-modrinth-btn"
            type="button"
            onClick={() => handleOpenExternal(modrinthUrl)}
            title={t('mods.openInModrinth')}
            style={{ gap: 6, padding: '8px 14px', fontSize: 13 }}
          >
            <Icon d={ICONS.external} size={13} />
            <span>Modrinth</span>
          </button>

          {recommendedVersion ? (
            installed ? (
              <button className="btn-secondary modrinth-btn-installed hero-install-btn" disabled>
                <Icon d={ICONS.check} size={14} />
                <span>{t('mods.installed')}</span>
              </button>
            ) : (
              <button
                className="btn-primary hero-install-btn"
                disabled={isInstallingRecommended || loadingVersions}
                onClick={() => onInstallVersion(currentProject, recommendedVersion)}
                title={recommendedVersion.version_number ? `${t('mods.recommendedVersion')}: v${recommendedVersion.version_number}` : t('mods.install')}
              >
                {isInstallingRecommended ? (
                  <>
                    <span className="btn-spinner" />
                    <span>{t('mods.installing')}</span>
                  </>
                ) : (
                  <>
                    <Icon d={ICONS.download} size={14} />
                    <span>{t('mods.install')}</span>
                    {recommendedVersion.version_number && (
                      <span className="mod-detail-rec-ver">v{recommendedVersion.version_number}</span>
                    )}
                  </>
                )}
              </button>
            )
          ) : loadingVersions ? (
            <div className="mod-skeleton-box" style={{ width: '130px', height: '38px', borderRadius: 'var(--radius-sm)' }} />
          ) : null}
        </div>
      </div>

      {/* External Links Bar */}
      <div className="project-detail-links-bar">
        <button
          className="mod-link-btn"
          type="button"
          onClick={() => handleOpenExternal(modrinthUrl)}
          title={t('mods.openInModrinth')}
        >
          <Icon d={ICONS.external} size={12} />
          <span>Modrinth</span>
        </button>
        {projectDetails?.source_url && (
          <button
            className="mod-link-btn"
            type="button"
            onClick={() => handleOpenExternal(projectDetails.source_url)}
          >
            <Icon d={ICONS.code} size={12} />
            <span>{t('mods.sourceCode')}</span>
          </button>
        )}
        {projectDetails?.issues_url && (
          <button
            className="mod-link-btn"
            type="button"
            onClick={() => handleOpenExternal(projectDetails.issues_url)}
          >
            <Icon d={ICONS.info} size={12} />
            <span>{t('mods.issues')}</span>
          </button>
        )}
        {projectDetails?.wiki_url && (
          <button
            className="mod-link-btn"
            type="button"
            onClick={() => handleOpenExternal(projectDetails.wiki_url)}
          >
            <Icon d={ICONS.book} size={12} />
            <span>{t('mods.wiki')}</span>
          </button>
        )}
        {projectDetails?.discord_url && (
          <button
            className="mod-link-btn"
            type="button"
            onClick={() => handleOpenExternal(projectDetails.discord_url)}
          >
            <Icon d={ICONS.globe} size={12} />
            <span>{t('mods.discord')}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="project-detail-tabs">
        <button
          className={`project-detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon d={ICONS.news} size={13} />
          <span>{t('mods.overview')}</span>
        </button>
        <button
          className={`project-detail-tab-btn ${activeTab === 'versions' ? 'active' : ''}`}
          onClick={() => setActiveTab('versions')}
        >
          <Icon d={ICONS.cube} size={13} />
          <span>{t('mods.versions')} ({versions.length})</span>
        </button>
        {gallery.length > 0 && (
          <button
            className={`project-detail-tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <Icon d={ICONS.copy} size={13} />
            <span>{t('mods.gallery')} ({gallery.length})</span>
          </button>
        )}
      </div>

      {/* Tab Content Body */}
      <div className="project-detail-content-body">
        {activeTab === 'overview' && (
          <div className="project-overview-content">
            {gallery.length > 0 && (
              <div className="project-gallery-preview">
                {gallery.slice(0, 5).map((img, i) => (
                  <div key={i} className="project-gallery-thumb" onClick={() => setActiveGalleryImg(img.url)}>
                    <img src={img.url} alt={img.title || `Screenshot ${i + 1}`} />
                    {img.title && <span className="project-gallery-thumb-title">{img.title}</span>}
                  </div>
                ))}
              </div>
            )}

            {loadingDetails ? (
              <div className="mod-skeleton-body">
                <div className="mod-skeleton-paragraphs">
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '100%', height: '16px' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '94%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '98%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '72%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '88%', marginTop: '14px', height: '18px' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '95%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '91%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '65%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '96%', marginTop: '14px' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '84%' }} />
                  <div className="mod-skeleton-box mod-skeleton-line" style={{ width: '50%' }} />
                </div>
              </div>
            ) : projectDetails?.body ? (
              <MarkdownRenderer
                content={projectDetails.body}
                className="project-detail-body-text"
                onNavigateModrinth={handleNavigateModrinth}
              />
            ) : (
              <MarkdownRenderer
                content={description}
                className="project-detail-body-text"
                onNavigateModrinth={handleNavigateModrinth}
              />
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
              <div className="mod-versions-list">
                <div className="mod-skeleton-box mod-skeleton-version-item" />
                <div className="mod-skeleton-box mod-skeleton-version-item" />
                <div className="mod-skeleton-box mod-skeleton-version-item" />
                <div className="mod-skeleton-box mod-skeleton-version-item" />
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
                              onClick={() => onInstallVersion(currentProject, ver)}
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
                              <MarkdownRenderer
                                content={ver.changelog}
                                onNavigateModrinth={handleNavigateModrinth}
                              />
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
  );
}
