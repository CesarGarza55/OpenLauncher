export const Icon = ({ d, size = 14, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d={d} />
  </svg>
);

export function MicrosoftLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function Toggle({ on, onToggle }) {
  return (
    <div
      className={`toggle-switch ${on ? 'on' : ''}`}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
    >
      <div className="toggle-thumb" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  secondaryText,
  onSecondary,
  children,
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state-icon">
          <Icon d={icon} size={26} />
        </div>
      )}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {children}
      {(actionText || secondaryText) && (
        <div className="empty-state-actions">
          {actionText && (
            <button className="btn-primary" onClick={onAction}>
              {actionIcon && <Icon d={actionIcon} size={13} />}
              <span>{actionText}</span>
            </button>
          )}
          {secondaryText && (
            <button className="btn-secondary" onClick={onSecondary}>
              <span>{secondaryText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LogLine({ entry }) {
  const typeClass = entry.type === 'stderr' ? 'log-err' : entry.type === 'game' ? 'log-game' : 'log-info';
  return (
    <div className={`log-line ${typeClass}`}>
      <span className="log-time">{entry.time}</span>
      <span className="log-msg">{entry.msg}</span>
    </div>
  );
}

export function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || 'info'}`}>
      <div className="toast-message">{toast.message}</div>
      <button className="toast-close" onClick={onClose} type="button" aria-label="Close notification">
        ×
      </button>
    </div>
  );
}
