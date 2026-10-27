"use client";
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/button';
export default function ChatInbox({ supervisor = false, compact = false }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const response = await fetch('/api/chat', { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setData(result); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => {
    let active = true, running = false;
    async function refresh() { if (!active || running || document.visibilityState !== 'visible') return; running = true; await load(); running = false; }
    const storage = event => { if (event.key === 'synoria.chatChanged') refresh(); };
    refresh(); const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh); window.addEventListener('synoria.chatChanged', refresh); window.addEventListener('storage', storage); document.addEventListener('visibilitychange', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('synoria.chatChanged', refresh); window.removeEventListener('storage', storage); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  return <div className={`${compact?'mt-7 ':''}space-y-5`}>
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface p-5"><p className="m-0 text-sm text-text-secondary"><span className="font-semibold text-foreground">{data?.rooms.length||0}</span> Conversations {data?.totalUnread>0&&<span className="ml-3 rounded-control bg-primary-soft px-2.5 py-1 text-sm font-medium text-primary">{data.totalUnread} Unread</span>}</p><Button appearance="outline" size="small" onClick={load}>Refresh Chats</Button></section>
    {error&&<p role="status" className="text-sm text-text-secondary">{error}</p>}
    {!data&&!error?<p role="status" className="text-sm text-text-muted">Loading chats…</p>:!data?.rooms.length?<section className="rounded-panel border border-dashed border-border bg-surface p-6"><p className="m-0 text-sm text-text-muted">{supervisor?'Your assigned project chats will appear here.':'Create or join a project team to start your private chat.'}</p></section>:<ul aria-label="Project conversations" className="m-0 grid list-none gap-5 p-0 lg:grid-cols-2">{data.rooms.map(room=><li key={room.workspaceId} className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-border bg-surface"><article className="flex-1 p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><Link href={`/${supervisor?'supervisor':'student'}/chat/${room.workspaceId}`} className="min-w-0 flex-1 text-lg font-semibold leading-relaxed text-foreground hover:text-primary [overflow-wrap:anywhere]">{room.workspaceName}</Link>{room.enabled===false&&<span className="text-[13px] text-text-muted">Read Only</span>}{room.unreadCount>0&&<span className="shrink-0 rounded-control bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">{room.unreadCount} Unread</span>}</div><p className="mb-0 mt-4 line-clamp-2 text-sm leading-relaxed text-text-secondary [overflow-wrap:anywhere]">{room.lastActivity?.type==='system'?`${room.lastActivity.title}: ${room.lastActivity.text.slice(0,120)}`:room.lastMessage?`${room.lastMessage.sender.name}: ${room.lastMessage.text.slice(0,120)}`:'No messages yet. Start your team conversation.'}</p></article><footer className="mt-auto border-t border-border px-5 py-4"><Link href={`/${supervisor?'supervisor':'student'}/chat/${room.workspaceId}`} className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-active">Open Chat</Link></footer></li>)}</ul>}
  </div>;
}
