"use client";
import { Input, Select } from '@/components/validatedForm';
import { useEffect, useState } from 'react';
import Button from '@/components/button';
import { useNotifications } from '@/components/notificationProvider';
import NotificationItem from '@/components/notificationItem';
import { categoryLabels } from '@/lib/notificationEvents';
export default function NotificationCenter() {
  const inbox = useNotifications(), [unread, setUnread] = useState(false), [category, setCategory] = useState(''), [cursor, setCursor] = useState(''), [back, setBack] = useState([]), [result, setResult] = useState(null), [actionError, setActionError] = useState('');
  const specialized = !!(unread || category || cursor), key = `${unread}:${category}:${cursor}`;
  useEffect(() => {
    if (!specialized) return;
    const controller = new AbortController(); let current = true;
    async function load() {
      const params = new URLSearchParams({ limit: '20', ...(unread ? { unread: 'true' } : {}), ...(category ? { category } : {}), ...(cursor ? { cursor } : {}) });
      try { const response = await fetch(`/api/notifications?${params}`, { cache: 'no-store', signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.message); if (current) setResult({ key, data }); }
      catch (err) { if (current && err.name !== 'AbortError') setResult({ key, error: err.message }); }
    }
    load(); return () => { current = false; controller.abort(); };
  }, [specialized, key, unread, category, cursor, inbox.data?.serverNow]);
  const data = specialized ? result?.key === key ? result.data : null : inbox.data;
  const error = specialized ? result?.key === key ? result.error : '' : inbox.error;
  async function read(id) { try { const response = await inbox.markRead(id); setResult(current => current?.data ? { ...current, data: { ...current.data, notifications: current.data.notifications.map(item => item.id === id ? response.notification : item) } } : current); setActionError(''); } catch (err) { setActionError(err.message); } }
  async function all() { try { await inbox.markAll(data?.serverNow); setActionError(''); } catch (err) { setActionError(err.message); } }
  function reset() { setCursor(''); setBack([]); }
  return <section className="rounded-panel border border-border bg-surface shadow-panel"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5 sm:p-6"><div><h2 className="m-0 text-lg font-semibold">Your Notifications</h2><p className="mb-0 mt-2 text-sm text-text-secondary">{inbox.data?.unreadCount || 0} Unread · Updates While You Work</p></div><div className="flex flex-wrap justify-end gap-3"><Button appearance="outline" size="small" onClick={inbox.refresh}>Refresh List</Button><Button size="small" disabled={!inbox.data?.unreadCount || inbox.mutating || !data} onClick={all}>Mark All Read</Button></div></div><div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4"><label className="m-0 flex items-center gap-2 text-sm"><Input type="checkbox" checked={unread} onChange={event => { setUnread(event.target.checked); reset(); }} />Unread Only</label><label className="m-0 flex items-center gap-2 text-sm">Category<Select className="min-w-40" value={category} onChange={event => { setCategory(event.target.value); reset(); }}><option value="">All Categories</option>{Object.entries(categoryLabels).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</Select></label></div>{(error || actionError) && <p role="alert" className="px-5 text-sm text-danger">{actionError || error}</p>}{!data && !error && <p role="status" className="p-6 text-sm text-text-secondary">Loading notifications…</p>}{data && <><ul className="m-0 list-none p-0">{data.notifications.map(item => <NotificationItem key={item.id} item={item} onRead={read} />)}</ul>{!data.notifications.length && <p role="status" className="p-6 text-center text-sm text-text-secondary">{unread ? 'No Unread Notifications' : 'No Notifications In This View'}</p>}<div className="flex justify-between gap-3 border-t border-border p-5"><Button appearance="outline" size="small" disabled={!back.length} onClick={() => { setCursor(back.at(-1)); setBack(value => value.slice(0, -1)); }}>Newer</Button><Button appearance="outline" size="small" disabled={!data.nextCursor} onClick={() => { setBack(value => [...value, cursor]); setCursor(data.nextCursor); }}>Older</Button></div></>}</section>;
}
