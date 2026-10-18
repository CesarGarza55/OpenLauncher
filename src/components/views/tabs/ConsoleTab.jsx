import React from 'react';
import { ICONS } from '../../../constants/icons';
import { Icon, LogLine } from '../../common/CommonComponents';
import { useI18n } from '../../../context/I18nContext';

export function ConsoleTab({
  active,
  gameState,
  runPid,
  logFilter,
  setLogFilter,
  autoScroll,
  setAutoScroll,
  handleCopyConsole,
  handleClearConsole,
  consoleRef,
  logs,
}) {
  const { t } = useI18n();

  return (
    <div className="tab-panel" style={{ display: active ? 'flex' : 'none' }}>
      <div className="console-wrapper">
        <div className="console-header">
          <div className="console-title">
            <div className={`console-indicator ${gameState === 'running' ? 'running' : ''}`} />
            <span>{t('console.outputLog')}</span>
            {gameState === 'running' && (
              <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                • {t('console.runningWithPid', { pid: runPid })}
              </span>
            )}
          </div>
          <div className="console-actions">
            <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 6 }}>
              {['all', 'info', 'warn', 'error'].map(lvl => (
                <button
                  key={lvl}
                  className={`tab-btn ${logFilter === lvl ? 'active' : ''}`}
                  style={{ fontSize: 10, padding: '2px 8px', textTransform: 'uppercase' }}
                  onClick={() => setLogFilter(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={() => setAutoScroll(prev => !prev)} title={t('console.autoScroll')} style={{ padding: '4px 8px' }}>
              <Icon d={autoScroll ? ICONS.play : ICONS.stop} size={11} />
            </button>
            <button className="btn-secondary" onClick={handleCopyConsole} title={t('console.copy')} style={{ padding: '4px 8px' }}>
              <Icon d={ICONS.copy} size={11} />
            </button>
            <button className="btn-secondary" onClick={handleClearConsole} title={t('console.clear')} style={{ padding: '4px 8px' }}>
              <Icon d={ICONS.clear} size={11} />
            </button>
          </div>
        </div>
        <div className="console-body" ref={consoleRef}>
          {logs.length === 0 ? (
            <div className="console-empty-box">
              <Icon d={ICONS.console} size={28} />
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t('console.noLogsYet')}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{t('console.noLogsYetSub')}</span>
            </div>
          ) : (() => {
            const filteredLogs = logs.filter(entry => {
              if (logFilter === 'all') return true;
              const entryLevel = String(entry.level || '').toLowerCase();
              if (logFilter === 'warn') return entryLevel === 'warn' || String(entry.msg || '').includes('WARN');
              if (logFilter === 'error') return entryLevel === 'error' || String(entry.msg || '').includes('ERROR');
              if (logFilter === 'info') return entryLevel === 'info' && !String(entry.msg || '').includes('WARN') && !String(entry.msg || '').includes('ERROR');
              return true;
            });
            if (filteredLogs.length === 0) {
              return <span style={{ color: 'var(--text-faint)', padding: 12 }}>{t('console.noLogsWithFilter', { filter: logFilter })}</span>;
            }
            return filteredLogs.map((entry, i) => <LogLine key={i} entry={entry} />);
          })()}
        </div>
      </div>
    </div>
  );
}
