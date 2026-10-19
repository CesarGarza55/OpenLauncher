import { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon, MicrosoftLogo } from '../common/CommonComponents';

export function AccountModal({
  currentAccount = null,
  onClose,
  onSaveOfflineName,
  onLoginMicrosoft,
  onLogout,
  loginLoading = false,
}) {
  const { t } = useI18n();
  const [offlineName, setOfflineName] = useState(
    currentAccount?.session?.name || currentAccount?.name || 'Player'
  );

  const isMicrosoft = currentAccount?.loggedIn && currentAccount?.kind === 'microsoft';

  const handleSaveName = (e) => {
    e.preventDefault();
    if (!offlineName.trim()) return;
    onSaveOfflineName(offlineName.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-title">{t('accountModal.manageTitle')}</div>
        <div className="modal-subtitle">
          {t('accountModal.manageSubtitle')}
        </div>

        {/* Current Status Box */}
        <div style={{
          padding: 14,
          borderRadius: 10,
          background: isMicrosoft ? 'rgba(74, 158, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
          border: isMicrosoft ? '1px solid rgba(74, 158, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {isMicrosoft ? <MicrosoftLogo size={20} /> : <Icon d={ICONS.star} size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
              {currentAccount?.name || offlineName || 'Player'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {isMicrosoft
                ? t('accountModal.microsoftLinked')
                : t('accountModal.offlineMode')}
            </div>
          </div>
        </div>

        {/* Microsoft Login or Logout Action */}
        <div style={{ marginBottom: 20 }}>
          {isMicrosoft ? (
            <button
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', gap: 8, color: '#ff7b72' }}
              onClick={onLogout}
            >
              <Icon d={ICONS.logout} size={16} />
              <span>{t('accountModal.logoutMicrosoft')}</span>
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}
              onClick={onLoginMicrosoft}
              disabled={loginLoading}
            >
              <MicrosoftLogo size={16} />
              <span>{loginLoading ? t('accountModal.connecting') : t('accountModal.loginMicrosoft')}</span>
            </button>
          )}
        </div>

        {/* Local / Offline Name Setting */}
        {!isMicrosoft && (
          <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="modal-field" style={{ margin: 0 }}>
              <label className="modal-label">
                <span>{t('accountModal.offlinePlayerName')}</span>
                <span style={{ color: 'var(--accent)', fontSize: 10 }}>{t('common.required')}</span>
              </label>
              <input
                className="modal-input"
                value={offlineName}
                onChange={e => setOfflineName(e.target.value)}
                placeholder={t('accountModal.offlineNamePlaceholder')}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {t('accountModal.offlineNameHelp')}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('accountModal.close')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={!offlineName.trim()}>
                {t('accountModal.saveName')}
              </button>
            </div>
          </form>
        )}

        {isMicrosoft && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('accountModal.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
