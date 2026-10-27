"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useNotifications } from '@/components/notificationProvider';
import NotificationItem from '@/components/notificationItem';
export default function NotificationBell({ role }) {
  const inbox = useNotifications(), [open, setOpen] = useState(false), [actionError, setActionError] = useState('');
  const root = useRef(null), trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const pointer = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const key = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
  }, [open]);
  async function read(id) { try { await inbox.markRead(id); setActionError(''); } catch (err) { setActionError(err.message); } }
  async function all() { try { await inbox.markAll(); setActionError(''); } catch (err) { setActionError(err.message); } }
  const count = inbox.data?.unreadCount || 0;
  return <div ref={root} className="relative"><button ref={trigger} type="button" aria-label="Notifications" aria-expanded={open} aria-controls="notification-popover" aria-haspopup="dialog" onClick={() => { setOpen(value => !value); if (!open) inbox.refresh(); }} className="relative grid size-10 place-items-center rounded-panel border border-border bg-surface-soft text-text-secondary hover:border-primary-border hover:text-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{count > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-danger px-1 py-0.5 text-[13px] font-semibold text-white" aria-label={`${count} unread notifications`}>{count > 99 ? '99+' : count}</span>}</button>
    {open && <section id="notification-popover" role="dialog" aria-label="Notifications" className="fixed inset-x-4 top-[88px] z-50 flex max-h-[calc(100dvh-104px)] w-auto flex-col min-[640px]:absolute min-[640px]:inset-x-auto min-[640px]:right-0 min-[640px]:top-full min-[640px]:mt-3 min-[640px]:w-[380px] overflow-hidden rounded-panel border border-border bg-surface shadow-xl"><header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"><h2 className="m-0 text-base font-semibold">Notifications</h2><button type="button" disabled={!count || inbox.mutating} onClick={all} className="text-[13px] font-semibold text-primary disabled:text-disabled-text">Mark All Read</button></header>{(inbox.error || actionError) && <div className="px-4 py-3"><p role="alert" className="m-0 text-sm text-danger">{actionError || inbox.error}</p><button type="button" onClick={inbox.refresh} className="mt-2 text-sm font-semibold text-primary">Try Again</button></div>}<ul className="m-0 min-h-0 max-h-[min(60dvh,450px)] list-none overflow-y-auto overscroll-contain p-0">{inbox.data?.notifications.slice(0, 5).map(item => <NotificationItem key={item.id} item={item} compact onRead={read} onNavigate={() => setOpen(false)} />)}</ul>{!inbox.data?.notifications.length && !inbox.error && <p role="status" className="px-4 py-5 text-center text-sm text-text-secondary">{inbox.loading ? 'Loading notifications…' : 'You’re All Caught Up'}</p>}<footer className="shrink-0 border-t border-border p-3 text-center"><Link href={`/${role}/notifications`} onClick={() => setOpen(false)} className="inline-block rounded-control px-3 py-1 text-sm font-semibold text-primary">View All Notifications</Link></footer></section>}
  </div>;
}
