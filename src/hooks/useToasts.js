import { useState, useRef, useCallback } from 'react';

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const pushToast = useCallback(({ tone = 'info', title = '', message = '', duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, tone, title, message }]);
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);
      toastTimersRef.current.set(id, timer);
    }
    return id;
  }, [dismissToast]);

  return {
    toasts,
    pushToast,
    dismissToast,
  };
}
