import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';
import { findModInList } from '../../utils/formatters';

export function ModConflictModal({
  conflict,
  mods = [],
  onClose,
  onResolveUpdate,
  onAutoFixAll,
  fixingAll,
  onOpenModsFolder,
}) {
  const { t } = useI18n();
  if (!conflict) return null;

  const autoFixes = conflict.compatFixes?.length > 0
    ? conflict.compatFixes
    : (conflict.suggestedUpdates || []).map(update => ({
      modId: update.modId,
      displayName: update.displayName,
      targetVersion: update.targetVersion,
      cascade: [],
    }));
  const hasAutoFixes = autoFixes.length > 0;

  const pendingUpdates = (conflict.suggestedUpdates || []).filter(rec => {
    const installedMod = findModInList(mods, rec.modId, rec.displayName);
    if (installedMod?.version && rec.targetVersion && String(installedMod.version).trim() === String(rec.targetVersion).trim()) {
      return false;
    }
    return true;
  });

  const plannedFixes = [];
  const seenModIds = new Set();

  if (hasAutoFixes) {
    for (const fix of autoFixes) {
      const fixModId = String(fix.modId || '').toLowerCase();
      const mainMod = findModInList(mods, fix.modId, fix.displayName);

      const currentRaw = String(mainMod?.version || '').trim();
      const currentClean = currentRaw.replace(/^v/i, '');
      const targetClean = String(fix.targetVersion || '').replace(/^v/i, '').trim();

      if (!seenModIds.has(fixModId) && (!currentClean || currentClean !== targetClean)) {
        seenModIds.add(fixModId);
        plannedFixes.push({
          modId: fix.modId,
          name: mainMod?.name || fix.displayName || fix.modId,
          currentVersion: currentRaw && currentRaw !== 'installed' ? `v${currentClean}` : null,
          targetVersion: `v${targetClean}`,
          isPrimary: true,
        });
      }

      if (Array.isArray(fix.cascade)) {
        for (const item of fix.cascade) {
          const itemModId = String(item.modId || '').toLowerCase();
          if (seenModIds.has(itemModId)) continue;

          const cascadeMod = findModInList(mods, item.modId, item.displayName);

          if (cascadeMod) {
            const cRaw = String(cascadeMod.version || '').trim();
            const cClean = cRaw.replace(/^v/i, '');
            const cTargetClean = String(item.targetVersion || '').replace(/^v/i, '').trim();

            if (!cClean || cClean !== cTargetClean) {
              seenModIds.add(itemModId);
              plannedFixes.push({
                modId: item.modId,
                name: cascadeMod.name || item.modId,
                currentVersion: cRaw && cRaw !== 'installed' ? `v${cClean}` : null,
                targetVersion: `v${cTargetClean}`,
                isPrimary: false,
              });
            }
          }
        }
      }
    }
  }

  const showAutoFixCard = plannedFixes.length > 0 && onAutoFixAll;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal mod-conflict-modal">
        <div className="mod-conflict-header">
          <div className="mod-conflict-title-icon-box">
            <Icon d={ICONS.alertTriangle} size={20} />
          </div>
          <div className="mod-conflict-title-text">
            <h3 className="modal-title">{t('mods.conflictTitle')}</h3>
            <p className="modal-subtitle">{t('mods.conflictSubtitle')}</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} title={t('window.close')}>
            <Icon d={ICONS.x} size={14} />
          </button>
        </div>

        <div className="mod-conflict-body">
          {showAutoFixCard && (
            <div className="mod-conflict-solution-card">
              <div className="mod-conflict-solution-header">
                <span className="mod-conflict-solution-tag">{t('mods.conflictRecommendation')}</span>
                <span className="mod-conflict-solution-hint">{t('mods.conflictFixAllDesc')}</span>
              </div>
              <div className="mod-conflict-fix-targets">
                {plannedFixes.map((item, idx) => (
                  <div key={idx} className="mod-conflict-target-row">
                    <span className="mod-conflict-target-name">{item.name}</span>
                    <div className="mod-conflict-version-diff">
                      {item.currentVersion && (
                        <>
                          <span className="mod-conflict-target-ver muted">{item.currentVersion}</span>
                          <span className="mod-conflict-target-arrow">&rarr;</span>
                        </>
                      )}
                      <span className="mod-conflict-target-ver">{item.targetVersion}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasAutoFixes && pendingUpdates.length > 0 && (
            <div className="mod-conflict-solution-card">
              <div className="mod-conflict-solution-header">
                <span className="mod-conflict-solution-tag">{t('mods.conflictRecommendation')}</span>
              </div>
              <div className="mod-conflict-rec-list">
                {pendingUpdates.map((rec, idx) => (
                  <div key={idx} className="mod-conflict-target-row">
                    <span className="mod-conflict-target-name">{rec.displayName || rec.modId}</span>
                    <span className="mod-conflict-target-ver">v{rec.targetVersion}</span>
                    {onResolveUpdate && (
                      <button
                        className="btn-secondary mod-conflict-mini-btn"
                        type="button"
                        onClick={() => onResolveUpdate(rec)}
                      >
                        <Icon d={ICONS.download} size={11} />
                        <span>{t('mods.conflictUpdateBtn', { version: rec.targetVersion })}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {conflict.conflictingMods && conflict.conflictingMods.length > 0 && !hasAutoFixes && (
            <div className="mod-conflict-incompatible-card">
              <span className="mod-conflict-solution-tag">{t('mods.conflictTitle')}</span>
              <div className="mod-conflict-rec-list">
                {conflict.conflictingMods.map((modItem, idx) => {
                  const targetMod = findModInList(mods, modItem.id, modItem.name);
                  return (
                    <div key={idx} className="mod-conflict-target-row">
                      <span className="mod-conflict-target-name">{targetMod?.name || modItem.name || modItem.id}</span>
                      {targetMod?.version && targetMod.version !== 'installed' && (
                        <span className="mod-conflict-target-ver muted">v{targetMod.version}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <details className="mod-conflict-details">
            <summary className="mod-conflict-details-summary">
              <Icon d={ICONS.chevronDown} size={12} />
              <span>{t('mods.conflictLoaderOutput')}</span>
            </summary>
            <pre className="mod-conflict-raw-text">
              {conflict.rawDescription || t('mods.conflictRawFallback')}
            </pre>
          </details>
        </div>

        <div className="modal-actions mod-conflict-actions">
          <button className="btn-secondary mod-conflict-folder-btn" type="button" onClick={onOpenModsFolder}>
            <Icon d={ICONS.folder} size={12} />
            <span>{t('mods.conflictOpenModsFolder')}</span>
          </button>
          <div className="mod-conflict-primary-actions">
            <button className="btn-secondary" type="button" onClick={onClose}>
              <span>{t('mods.conflictDismiss')}</span>
            </button>
            {hasAutoFixes && onAutoFixAll && (
              <button
                className="btn-primary"
                type="button"
                onClick={() => onAutoFixAll(autoFixes)}
                disabled={fixingAll}
              >
                <Icon d={fixingAll ? ICONS.spinner : ICONS.download} size={12} className={fixingAll ? 'spin-infinite' : ''} />
                <span>{fixingAll ? t('mods.conflictFixing') : t('mods.conflictFixAllBtn')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
