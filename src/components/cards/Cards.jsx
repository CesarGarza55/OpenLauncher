import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon, Toggle } from '../common/CommonComponents';
import { truncateText } from '../../utils/formatters';

export function ModCard({ mod, updateInfo, updating, onToggle, onDelete, onUpdate }) {
  const { t } = useI18n();
  const displayName = mod.name || mod.fileName || mod.id;
  const iconUrl = mod.iconUrl;
  const typeBadge = mod.type && mod.type !== 'jar' ? mod.type.toUpperCase() : null;

  return (
    <div className={`mod-card ${!mod.enabled ? 'mod-card-disabled' : ''} ${updateInfo ? 'has-update' : ''}`}>
      <div className="mod-card-header">
        <div className="mod-card-icon-box">
          {iconUrl ? (
            <img src={iconUrl} alt={displayName} className="mod-card-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="mod-card-icon-fallback"><Icon d={ICONS.cube} size={20} /></div>
          )}
        </div>
        <div className="mod-card-main-info">
          <div className="mod-card-title-row">
            <span className="mod-card-name" title={displayName}>{displayName}</span>
            {typeBadge && <span className="mod-loader-badge">{typeBadge}</span>}
            {updateInfo && (
              <span className="mod-update-badge" title={updateInfo.newVersionName || updateInfo.newVersionNumber}>
                <Icon d={ICONS.download} size={9} />
                v{updateInfo.newVersionNumber}
              </span>
            )}
          </div>
          <div className="mod-card-sub-info">
            {mod.version && mod.version !== 'installed' && (
              <span className="mod-card-version" title={`v${mod.version}`}>v{mod.version}</span>
            )}
            {mod.authors ? (
              <span className="mod-card-authors" title={mod.authors}>by {mod.authors}</span>
            ) : (
              <span className="mod-card-filename" title={mod.fileName}>{mod.fileName}</span>
            )}
          </div>
        </div>
      </div>

      {mod.description ? (
        <div className="mod-card-desc" title={mod.description}>{mod.description}</div>
      ) : null}

      <div className="mod-card-footer">
        <span className="mod-card-filename-pill" title={mod.fileName}>
          {mod.fileName}
        </span>
        <div className="mod-card-actions">
          {updateInfo && onUpdate && (
            <button
              className="btn-primary mod-card-update-action-btn"
              type="button"
              onClick={() => onUpdate(updateInfo)}
              disabled={updating}
              title={t('mods.updateAvailableBadge', { version: updateInfo.newVersionNumber })}
            >
              <Icon d={ICONS.download} size={11} className={updating ? 'spin-infinite' : ''} />
              <span>{updating ? t('mods.updating') : t('mods.updateMod')}</span>
            </button>
          )}
          <Toggle on={mod.enabled} onToggle={() => onToggle(mod.id)} />
          <button
            className="profile-action-btn delete"
            type="button"
            title={t('mods.deleteMod')}
            onClick={() => onDelete(mod.id)}
          >
            <Icon d={ICONS.trash} size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModrinthCard({ project, installed, installing, onInstall, onOpenDetails }) {
  const { t } = useI18n();
  const title = project.title || project.slug;
  const author = project.author;
  const description = project.description || '';
  const downloads = Number(project.downloads || 0).toLocaleString();
  const follows = Number(project.follows || 0).toLocaleString();
  const iconUrl = project.icon_url;

  const allCategories = project.categories || [];
  const loaders = allCategories.filter(c => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c.toLowerCase()));
  const tags = allCategories.filter(c => !['fabric', 'forge', 'neoforge', 'quilt'].includes(c.toLowerCase())).slice(0, 2);

  const clientSide = project.client_side;
  const serverSide = project.server_side;

  return (
    <div className="modrinth-card" onClick={() => onOpenDetails(project)} style={{ cursor: 'pointer' }}>
      <div className="modrinth-card-header">
        <div className="modrinth-icon-box">
          {iconUrl ? (
            <img src={iconUrl} alt={title} className="modrinth-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <div className="modrinth-icon-fallback"><Icon d={ICONS.cube} size={20} /></div>
          )}
        </div>
        <div className="modrinth-title-group">
          <div className="modrinth-title-row">
            <span className="modrinth-title" title={title}>{title}</span>
            {installed && <span className="modrinth-installed-badge">{t('mods.installed')}</span>}
          </div>
          <span className="modrinth-author">{t('mods.author', { author })}</span>
        </div>
      </div>

      <div className="modrinth-badges-row">
        {loaders.map(l => (
          <span key={l} className="modrinth-loader-pill">{l.toUpperCase()}</span>
        ))}
        {tags.map(tag => (
          <span key={tag} className="modrinth-tag-pill">{tag}</span>
        ))}
        {clientSide && serverSide && (
          <span className="modrinth-side-pill">
            {clientSide === 'required' && serverSide === 'required'
              ? t('mods.clientAndServer')
              : clientSide === 'required'
                ? t('mods.clientOnly')
                : t('mods.serverOnly')}
          </span>
        )}
      </div>

      <div className="modrinth-desc" title={description}>
        {description}
      </div>

      <div className="modrinth-card-footer">
        <div className="modrinth-stats">
          <span className="modrinth-stat" title={t('mods.downloads')}>
            <Icon d={ICONS.download} size={11} /> {downloads}
          </span>
          <span className="modrinth-stat" title={t('mods.follows')}>
            <Icon d={ICONS.star} size={11} /> {follows}
          </span>
        </div>

        <div className="modrinth-card-actions">
          {installed ? (
            <button
              className="btn-secondary modrinth-btn-installed"
              disabled
              onClick={(e) => e.stopPropagation()}
            >
              <Icon d={ICONS.check} size={12} /> {t('mods.installed')}
            </button>
          ) : (
            <button
              className="btn-primary modrinth-btn-install"
              disabled={installing}
              onClick={(e) => {
                e.stopPropagation();
                onInstall(project);
              }}
            >
              {installing ? (
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
    </div>
  );
}

export function NewsCard({ item, onOpen }) {
  const { t } = useI18n();
  const metaText = [item.author, item.published].filter(Boolean).join(' · ');
  const cardMeta = truncateText(metaText, 42);
  const cardTitle = truncateText(item.title, 58);
  const cardSummary = truncateText(item.summary, 132);

  return (
    <article className="news-card">
      <div className="news-card-media">
        {item.image ? (
          <img src={item.image} alt="" loading="lazy" />
        ) : (
          <div className="news-card-media-fallback">
            <Icon d={ICONS.news} size={24} />
          </div>
        )}
      </div>
      <div className="news-card-body">
        <div className="news-card-meta">
          <span>{t('news.officialLabel')}</span>
          {cardMeta ? <span>• {cardMeta}</span> : null}
        </div>
        <div className="news-card-title">{cardTitle}</div>
        {cardSummary ? <div className="news-card-summary">{cardSummary}</div> : null}
        <div className="news-card-actions">
          <button className="btn-secondary" type="button" onClick={() => onOpen(item.url)} style={{ fontSize: 11, padding: '4px 10px' }}>
            <Icon d={ICONS.external} size={11} />
            {t('news.openArticle')}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProfileCardActions({ active, name, disabled, onEdit, onDuplicate, onDelete }) {
  const { t } = useI18n();

  return (
    <div className="profile-actions" onClick={e => e.stopPropagation()}>
      <button
        className="profile-action-btn"
        title={t('profile.edit')}
        aria-label={`${t('profile.edit')} ${name}`}
        onClick={onEdit}
        disabled={disabled}
      >
        <Icon d={ICONS.edit} size={11} />
      </button>
      <button
        className="profile-action-btn"
        title={t('profile.duplicate')}
        aria-label={`${t('profile.duplicate')} ${name}`}
        onClick={onDuplicate}
        disabled={disabled}
      >
        <Icon d={ICONS.copy} size={11} />
      </button>
      <button
        className="profile-action-btn delete"
        title={t('profile.delete')}
        aria-label={`${t('profile.delete')} ${name}`}
        onClick={onDelete}
        disabled={disabled}
      >
        <Icon d={ICONS.trash} size={11} />
      </button>
    </div>
  );
}
