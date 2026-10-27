"use client";
import { useEffect, useState } from 'react';
export default function ChatUnreadBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true, busy = false;
    async function load() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try { const response = await fetch('/api/chat/unread', { cache: 'no-store' }); if (response.ok) { const data = await response.json(); if (active) setCount(data.totalUnread); } }
      catch {} finally { busy = false; }
    }
    const onStorage = event => { if (event.key === 'synoria.chatChanged') load(); };
    load(); const timer = setInterval(load, 10000);
    window.addEventListener('synoria.chatChanged', load); window.addEventListener('focus', load); window.addEventListener('storage', onStorage); document.addEventListener('visibilitychange', load);
    return () => { active = false; clearInterval(timer); window.removeEventListener('synoria.chatChanged', load); window.removeEventListener('focus', load); window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', load); };
  }, []);
  return count > 0 ? <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[13px] font-semibold text-white" aria-label={`${count} unread chat messages`}>{count > 99 ? '99+' : count}</span> : null;
}
