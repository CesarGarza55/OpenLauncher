import { memo } from 'react';
import { useI18n } from '../../context/I18nContext';
import { ICONS } from '../../constants/icons';
import { Icon } from '../common/CommonComponents';

export const ConfirmModal = memo(function ConfirmModal({
  title,
  message,
  confirmText,
  cancelText,
  danger = true,
  onConfirm,
  onClose,
}) {
  const { t } = useI18n();

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: danger ? 'rgba(255, 123, 114, 0.15)' : 'rgba(74, 158, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: danger ? '#ff7b72' : 'var(--accent)',
            flexShrink: 0
          }}>
            <Icon d={danger ? ICONS.trash : ICONS.helpCircle} size={20} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
            {title || t('common.confirm') || 'Confirmar'}
          </div>
        </div>

        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: 20
        }}>
          {message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 16px' }}
          >
            {cancelText || t('common.cancel') || 'Cancelar'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: danger ? '#da3633' : undefined,
              borderColor: danger ? '#da3633' : undefined
            }}
          >
            {danger && <Icon d={ICONS.trash} size={14} />}
            <span>{confirmText || (danger ? t('common.delete') || 'Eliminar' : t('common.confirm') || 'Aceptar')}</span>
          </button>
        </div>
      </div>
    </div>
  );
});
