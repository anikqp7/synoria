"use client";
import { Form, Textarea } from '@/components/validatedForm';
import Link from 'next/link';
import ChatActivity from '@/components/chatActivity';
import ChatMeetings from '@/components/chatMeetings';
import ChatAiSummary from '@/components/chatAiSummary';
import { useSearchParams } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/components/button';
import { notifyChatChanged } from '@/lib/chatEvents';
import { showActionAlert } from '@/lib/actionAlerts';
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
const day = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date(value));
const time = value => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }).format(new Date(value));
const date = value => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(value));
async function api(path, options) { const response = await fetch(path, { cache: 'no-store', ...options }); const data = await response.json().catch(() => ({ message: 'Unable to reach project chat.' })); if (!response.ok) { const error = new Error(data.message); error.status = response.status; throw error; } return data; }
export default function ProjectChat({ workspaceId, supervisor = false }) {
  const searchParams = useSearchParams();
  const [mobileMeetings,setMobileMeetings] = useState(false),[meetingSelection,setMeetingSelection] = useState(null);
  const queryMeeting = searchParams.get('meeting');
  const meetingId = meetingSelection?.query === queryMeeting ? meetingSelection.id : queryMeeting;
  const selectMeeting = value => setMeetingSelection({query:queryMeeting,id:value||''});
  const base = `/api/${supervisor ? 'supervision' : 'workspaces'}/${workspaceId}/chat`;
  const [room, setRoom] = useState(null), [messages, setMessages] = useState([]), [error, setError] = useState('');
  const [sending, setSending] = useState(false), [olderBusy, setOlderBusy] = useState(false), [hasOlder, setHasOlder] = useState(false);
  const [text, setText] = useState(''), [newMessages, setNewMessages] = useState(false);
  const newestCursor = useRef(null), oldestCursor = useRef(null), oldestTime = useRef(0), seenEntries = useRef(new Set());
  const composer = useRef(null), scroll = useRef(null), form = useRef(null), lastSeq = useRef(0), readSeq = useRef(0), nearBottom = useRef(true), reading = useRef(false), polling = useRef(false), active = useRef(true), retryKey = useRef('');
  const markVisible = useCallback(async () => {
    if (!active.current || reading.current || !nearBottom.current || document.visibilityState !== 'visible' || !document.hasFocus() || !lastSeq.current || lastSeq.current <= readSeq.current) return;
    reading.current = true;
    try { const result = await api(`${base}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ upToSeq: lastSeq.current }) }); if (active.current) { readSeq.current = Math.max(readSeq.current, result.lastReadSeq); setRoom(current => current && ({ ...current, unreadCount: result.unreadCount })); notifyChatChanged(); } }
    catch {} finally { reading.current = false; }
  }, [base]);
  const merge = useCallback(incoming => { const fresh = incoming.filter(item => !seenEntries.current.has(item.id)); if (!fresh.length) return false; fresh.forEach(item => seenEntries.current.add(item.id)); setMessages(current => [...new Map([...current, ...fresh].map(item => [item.id, item])).values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))); return true; }, []);
  const refresh = useCallback(async (initial = false) => {
    if (!active.current || polling.current || (!initial && document.visibilityState !== 'visible')) return;
    polling.current = true;
    try {
      let batch = 0, more;
      do {
        const firstPage = initial || !newestCursor.current;
        const result = await api(firstPage ? `${base}?timeline=true` : `${base}?timeline=true&timelineAfter=${encodeURIComponent(newestCursor.current)}`);
        if (!active.current) return;
        setRoom(result); readSeq.current = Math.max(readSeq.current, result.lastReadSeq); setError('');
        const timeline = result.timeline;
        lastSeq.current = Math.max(lastSeq.current, result.latestSeq);
        if (firstPage) { seenEntries.current = new Set(timeline.entries.map(entry => entry.id)); oldestTime.current = timeline.entries.length ? new Date(timeline.entries[0].createdAt).getTime() : 0; setMessages(timeline.entries); setHasOlder(timeline.hasOlder); oldestCursor.current = timeline.oldestCursor; initial = false; more = false; }
        else { const incoming = [...timeline.entries, ...(timeline.recentActivities || []).filter(entry => new Date(entry.createdAt).getTime() >= oldestTime.current)]; if (merge(incoming) && !nearBottom.current) setNewMessages(true); more = timeline.hasMore; }
        if (timeline.newestCursor) newestCursor.current = timeline.newestCursor;
        batch += 1;
      } while (more && batch < 4);
      requestAnimationFrame(() => { if (nearBottom.current && scroll.current) { scroll.current.scrollTop = scroll.current.scrollHeight; markVisible(); } });
    } catch (err) { if (active.current) { setError(err.message); if ([401, 403, 404].includes(err.status)) { setMessages([]); setRoom(null); } } }
    finally { polling.current = false; }
  }, [base, markVisible, merge]);
  useEffect(() => {
    active.current = true; seenEntries.current = new Set(); oldestTime.current = 0; newestCursor.current = null; oldestCursor.current = null; lastSeq.current = 0; readSeq.current = 0; nearBottom.current = true; retryKey.current = crypto.randomUUID();
    refresh(true); const timer = setInterval(() => refresh(), 3000);
    const focus = () => { if (document.visibilityState === 'visible') { refresh(); markVisible(); } };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { active.current = false; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [refresh, markVisible]);
  useEffect(() => { if (nearBottom.current && scroll.current) { scroll.current.scrollTop = scroll.current.scrollHeight; markVisible(); } }, [messages, room?.workspaceId, markVisible]);
  useEffect(() => {
    const node = composer.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(112, node.scrollHeight)}px`;
  }, [text, room?.workspaceId]);
  async function earlier() {
    if (!oldestCursor.current) return; setOlderBusy(true); nearBottom.current = false;
    const node = scroll.current, previousHeight = node?.scrollHeight || 0, previousTop = node?.scrollTop || 0;
    try { const result = await api(`${base}?timeline=true&timelineBefore=${encodeURIComponent(oldestCursor.current)}`); if (result.timeline.entries.length) oldestTime.current = new Date(result.timeline.entries[0].createdAt).getTime(); merge(result.timeline.entries); setHasOlder(result.timeline.hasOlder); if (result.timeline.oldestCursor) oldestCursor.current = result.timeline.oldestCursor; requestAnimationFrame(() => { if (node) node.scrollTop = previousTop + node.scrollHeight - previousHeight; }); }
    catch (err) { setError(err.message); } finally { setOlderBusy(false); }
  }
  async function send(event) {
    event.preventDefault(); if (!text.trim() || sending) return; setSending(true);
    try {
      await api(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, requestKey: retryKey.current }) });
      setText(''); retryKey.current = crypto.randomUUID(); nearBottom.current = true; setNewMessages(false); notifyChatChanged(); await refresh();
    } catch (err) { await showActionAlert({ icon: 'error', titleText: 'Message Not Sent', text: `${err.message} Your draft is kept for retry.` }); }
    finally { setSending(false); }
  }
  function onScroll() {
    const node = scroll.current; if (!node) return;
    nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    if (nearBottom.current) { setNewMessages(false); markVisible(); }
  }
  if (!room) return <section className="flex min-h-0 flex-1 items-center justify-center bg-surface p-6"><div className="text-center"><p role="status" className="text-sm text-text-secondary">{error || 'Loading project chat…'}</p>{error && <Button appearance="outline" onClick={() => refresh(true)}>Try Again</Button>}</div></section>;
  return <div className="flex min-h-0 flex-1 overflow-hidden"><section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface">
    <header className="shrink-0 border-b border-border px-4 py-2.5 pl-12 sm:px-6 sm:pl-12 min-[761px]:pl-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <div className="flex min-w-0 items-center gap-2.5"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-[13px] font-semibold text-primary">{initials(room.workspaceName)}</span><h2 className="m-0 text-base font-semibold leading-snug [overflow-wrap:anywhere]">{room.workspaceName}</h2><svg role="img" aria-label="Private to your team and supervisor" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-3.5 shrink-0 text-text-muted"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></div>
          <ul aria-label="Chat participants" className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0">{room.participants.map(item => <li key={`${item.role}-${item.id}`} className={`max-w-full text-[13px] [overflow-wrap:anywhere] ${item.role === 'supervisor' ? 'inline-flex items-center gap-1.5 rounded-md border border-primary-border bg-primary-soft px-2 py-0.5 font-semibold text-primary' : 'text-text-secondary'}`}>
            {item.role === 'supervisor' && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0"><circle cx="7" cy="7" r="3" /><path d="M2 21v-3a5 5 0 0 1 10 0v3M14 3h8v13h-7M17 7h2M17 11h2M7 12v5l3-2" /></svg>}
            <span>{item.name}<span className={`ml-1 ${item.role === 'supervisor' ? '' : 'text-text-muted'}`}>· {item.role === 'supervisor' ? 'Supervisor' : 'Student'}{!item.isActive ? ' (Inactive)' : ''}</span></span>
          </li>)}</ul>
        </div>
        <Button appearance="outline" size="small" className="shrink-0 xl:hidden" onClick={()=>setMobileMeetings(true)}>Meetings</Button>
        {supervisor && <Link href="/supervisor/chat" aria-label="All Project Chats" title="All Project Chats" className="inline-flex min-h-8 shrink-0 items-center gap-2 rounded-control border border-border px-2.5 text-[13px] font-medium text-text-secondary hover:border-primary-border hover:bg-primary-soft hover:text-primary"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="m10 6-6 6 6 6M4 12h16" /></svg><span className="hidden sm:inline">All Chats</span></Link>}
      </div>
      {!room.participants.some(item => item.role === 'supervisor') && <p className="mb-0 mt-2 text-[13px] text-text-muted">No supervisor assigned yet.</p>}
      {error && <div role="status" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-secondary"><span>{error}</span><Button appearance="outline" size="small" onClick={() => refresh()}>Retry Updates</Button></div>}
    </header>
    {hasOlder && <div className="shrink-0 border-b border-border p-2 text-center"><Button appearance="ghost" size="small" disabled={olderBusy} onClick={earlier}>{olderBusy ? 'Loading…' : 'Load Earlier Messages'}</Button></div>}
    <div ref={scroll} onScroll={onScroll} tabIndex={0} aria-label="Project message history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-soft px-4 py-3 sm:px-8 sm:py-4">
      <ol role="log" aria-live="polite" aria-relevant="additions" className="mx-auto my-0 max-w-[1040px] list-none space-y-3 p-0">{messages.map((message, index) => {
        const own = message.type !== 'system' && message.sender.id === room.viewer.id && message.sender.role === room.viewer.role;
        const previous = messages[index - 1];
        const sameSender = message.type !== 'system' && previous?.type !== 'system' && previous && previous.sender.id === message.sender.id && previous.sender.role === message.sender.role && day(previous.createdAt) === day(message.createdAt) && new Date(message.createdAt) - new Date(previous.createdAt) <= 300000;
        const newDay = index === 0 || day(messages[index - 1].createdAt) !== day(message.createdAt);
        return <Fragment key={message.id}>{newDay && <li className="flex justify-center py-2"><span className="rounded-full border border-border bg-surface px-3 py-1 text-[13px] text-text-muted">{day(message.createdAt)}</span></li>}{message.type === 'system' ? <ChatActivity entry={message} workspaceId={workspaceId} supervisor={supervisor} completed={!room.enabled} onOpenMeeting={selectMeeting} /> : <li data-chat-entry="message" className={`flex items-end gap-2.5 ${own ? 'justify-end' : 'justify-start'}`}>
          {!own && <span aria-hidden="true" className={`mb-6 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-primary ${sameSender ? '' : 'border border-border bg-surface'}`}>{!sameSender && initials(message.sender.name)}</span>}
          <article className="min-w-0 max-w-[85%] sm:max-w-[75%]">
            {!sameSender && <p className={`mb-1 mt-0 text-[13px] font-medium text-text-secondary ${own ? 'text-right' : ''}`}>{own ? 'You' : message.sender.name}<span className="ml-1.5 font-normal text-text-muted">· {message.sender.role === 'supervisor' ? 'Supervisor' : 'Student'}</span></p>}
            <div className={`rounded-xl px-3 py-2 ${own ? 'rounded-br-sm bg-primary text-white dark:text-background' : 'rounded-bl-sm border border-border bg-surface text-foreground'}`}><p className="m-0 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{message.text}</p></div>
            <p className={`mb-0 mt-1 text-[13px] text-text-muted ${own ? 'text-right' : ''}`}><time title={date(message.createdAt)} dateTime={message.createdAt}>{time(message.createdAt)}</time></p>
          </article>
        </li>}</Fragment>;
      })}</ol>
      {!messages.length && <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl border border-border bg-surface text-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-7"><path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8Z" /><path d="M7 9h9M7 13h6" /></svg></span><p className="m-0 font-semibold">Start Your Project Conversation</p><p className="m-0 max-w-xs text-sm text-text-muted">Share an update or ask your team and supervisor a question.</p></div>}
    </div>
    {newMessages && <div className="shrink-0 border-t border-border p-2 text-center"><Button size="small" onClick={() => { nearBottom.current = true; setNewMessages(false); if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; markVisible(); }}>New Messages ↓</Button></div>}
    <Form ref={form} onSubmit={send} className="shrink-0 border-t border-border bg-surface px-4 py-2 sm:px-8">
      <fieldset disabled={sending || !room.enabled} className="mx-auto max-w-[1040px]">
        <label htmlFor="chatMessage" className="sr-only">Message</label>
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-soft p-1.5 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-soft">
          <Textarea ref={composer} id="chatMessage" name="text" required className="min-h-10 min-w-0 flex-1 resize-none !border-0 !bg-transparent !px-2 !py-2 !shadow-none !outline-none !ring-0" rows={1} maxLength={2000} value={text} onChange={event => { setText(event.target.value); retryKey.current = crypto.randomUUID(); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (text.trim() && !sending) form.current?.requestSubmit(); } }} placeholder={room.enabled ? 'Write a message to your team…' : 'This project chat is read-only.'} />
          <Button type="submit" aria-label="Send Message" title="Send Message" className="!h-9 !min-h-9 !rounded-lg !px-3 !py-0" disabled={!text.trim() || sending}><span className="sr-only">{sending ? 'Sending…' : 'Send'}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="m22 2-7 20-4-9-9-4L22 2ZM11 13 22 2" /></svg></Button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-text-muted"><p className="m-0">{room.enabled ? <><span className="hidden sm:inline">Enter To Send · </span>Shift + Enter For A New Line</> : 'Completed Project · Read Only'}</p><span className="shrink-0 tabular-nums">{text.length}/2000</span></div>
      </fieldset>
    </Form>
  </section><ChatMeetings key={workspaceId} base={`${base}/meetings`} mobileOpen={mobileMeetings} onCloseMobile={()=>setMobileMeetings(false)} selectedId={meetingId} onSelect={selectMeeting} onChanged={()=>refresh()}/><ChatAiSummary/></div>;
}
