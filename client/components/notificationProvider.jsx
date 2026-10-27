"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notificationEvent, notificationsChanged } from '@/lib/notificationEvents';
const Context = createContext(null);
export const useNotifications = () => useContext(Context);
export default function NotificationProvider({ role, userId, children }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [mutating, setMutating] = useState(false);
  const alive = useRef(false), running = useRef(false), controller = useRef(null);
  const refresh = useCallback(async () => {
    if (running.current || !alive.current) return;
    running.current = true; const request = new AbortController(); controller.current = request;
    try {
      const response = await fetch('/api/notifications?limit=20', { cache: 'no-store', signal: request.signal }); const result = await response.json();
      if (!response.ok) { if (response.status === 401 || response.status === 403) setData(null); throw new Error(result.message || 'Unable to load notifications.'); }
      if (result.viewer?.id !== userId || result.viewer?.role !== role) { setData(null); throw new Error('Your session changed. Reload this page to continue.'); }
      if (alive.current) { setData(result); setError(''); }
    } catch (err) { if (alive.current && err.name !== 'AbortError') setError(err.message); }
    finally { running.current = false; if (alive.current) setLoading(false); }
  }, [role, userId]);
  useEffect(() => {
    let active = true; alive.current = true;
    const update = () => { if (active && document.visibilityState === 'visible') refresh(); };
    const storage = event => { if (event.key === notificationEvent || event.key === 'synoria.chatChanged') update(); };
    queueMicrotask(update); const timer = setInterval(update, 15000);
    window.addEventListener('focus', update); window.addEventListener(notificationEvent, update); window.addEventListener('synoria.chatChanged', update); window.addEventListener('storage', storage); document.addEventListener('visibilitychange', update);
    return () => { active = false; alive.current = false; controller.current?.abort(); clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener(notificationEvent, update); window.removeEventListener('synoria.chatChanged', update); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  async function markRead(id) {
    const response = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true });
    const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to mark this notification as read.');
    if (alive.current) setData(current => current ? { ...current, notifications: current.notifications.map(item => item.id === id ? result.notification : item), unreadCount: Math.max(0, current.unreadCount - Number(result.markedRead)) } : current);
    notificationsChanged(); return result;
  }
  async function markAll(before = data?.serverNow) {
    if (!before) return; setMutating(true);
    try { const response = await fetch('/api/notifications/readAll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ before }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to mark notifications as read.'); if (alive.current) setData(current => current ? { ...current, unreadCount: Math.max(0, current.unreadCount - result.markedRead), notifications: new Date(current.serverNow) <= new Date(before) ? current.notifications.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })) : current.notifications } : current); await refresh(); notificationsChanged(); return result; }
    finally { if (alive.current) setMutating(false); }
  }
  return <Context.Provider value={{ data, error, loading, mutating, refresh, markRead, markAll }}>{children}</Context.Provider>;
}
