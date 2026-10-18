import { useState, useRef, useCallback } from 'react';
import { formatClock } from '../lib/minecraftLauncher';

export function useLauncherLogs() {
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);

  const logBufferRef = useRef([]);
  const logFlushTimeoutRef = useRef(null);

  const flushLogs = useCallback(() => {
    if (logFlushTimeoutRef.current) {
      clearTimeout(logFlushTimeoutRef.current);
      logFlushTimeoutRef.current = null;
    }
    if (logBufferRef.current.length === 0) return;
    const itemsToAdd = logBufferRef.current;
    logBufferRef.current = [];
    setLogs(prev => {
      const next = [...prev, ...itemsToAdd];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const addLog = useCallback((level, msg) => {
    logBufferRef.current.push({ level, msg, time: formatClock() });
    if (!logFlushTimeoutRef.current) {
      logFlushTimeoutRef.current = setTimeout(() => {
        flushLogs();
      }, 60);
    }
  }, [flushLogs]);

  const clearLogs = useCallback(() => {
    if (logFlushTimeoutRef.current) {
      clearTimeout(logFlushTimeoutRef.current);
      logFlushTimeoutRef.current = null;
    }
    logBufferRef.current = [];
    setLogs([]);
  }, []);

  return {
    logs,
    setLogs,
    addLog,
    clearLogs,
    flushLogs,
    logFilter,
    setLogFilter,
    autoScroll,
    setAutoScroll,
  };
}
