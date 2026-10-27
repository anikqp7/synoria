"use client";
import { Form, Input } from '@/components/validatedForm';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/button';
import Modal from '@/components/modal';
import { showActionAlert } from '@/lib/actionAlerts';
import { dhakaInput, utcFromDhaka } from '@/lib/defenceFormat';

const dateLabel = value => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date(value)).replace(/ (\d{4})$/, ', $1');
const timeLabel = value => new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Dhaka' }).format(new Date(value));
function NoticeForm({ notice, onClose, onSaved }) {
  const [busy, setBusy] = useState(false), [requestKey] = useState(() => crypto.randomUUID());
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    try {
      const body = { batch: form.get('batch'), stream: form.get('stream'), venue: form.get('venue'), startsAt: utcFromDhaka(`${form.get('date')}T${form.get('time')}`), ...(notice ? { revision: notice.revision } : { requestKey }) };
      const response = await fetch(`/api/defenceNotices${notice ? `/${notice.id}` : ''}`, { method: notice ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      onSaved(); onClose(); await new Promise(resolve => requestAnimationFrame(resolve));
      await showActionAlert({ icon: 'success', titleText: notice ? 'Notice Updated' : 'Notice Published', text: 'The defence date is visible on your department’s notice board.' });
    } catch (error) { await showActionAlert({ icon: 'error', titleText: 'Notice Not Saved', text: error.message }); }
    finally { setBusy(false); }
  }
  const local = dhakaInput(notice?.startsAt);
  return <Modal title={notice ? 'Edit Defence Notice' : 'Publish Defence Notice'} description="Date and time use Bangladesh time (Asia/Dhaka)." busy={busy} onClose={onClose}><Form onSubmit={submit} className="p-6"><fieldset disabled={busy} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2"><label className="m-0 grid gap-2 text-sm">Batch *<Input name="batch" maxLength={50} required defaultValue={notice?.batch || ''} placeholder="e.g. 42" /></label><label className="m-0 grid gap-2 text-sm">Stream *<Input name="stream" maxLength={80} required defaultValue={notice?.stream || ''} placeholder="e.g. Project or Thesis" /></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="m-0 grid gap-2 text-sm">Date *<Input name="date" type="date" required defaultValue={local.split('T')[0]} /></label><label className="m-0 grid gap-2 text-sm">Time *<Input name="time" type="time" required defaultValue={local.split('T')[1]} /></label></div>
    <label className="m-0 grid gap-2 text-sm">Venue *<Input name="venue" maxLength={200} required defaultValue={notice?.venue || ''} placeholder="e.g. CSE Seminar Room" /></label>
    <div className="flex justify-end gap-3 pt-6"><Button appearance="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : notice ? 'Save Changes' : 'Publish Notice'}</Button></div>
  </fieldset></Form></Modal>;
}
export default function DefenceNoticeBoard({ role }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0), [editor, setEditor] = useState(null), [removing, setRemoving] = useState(false);
  useEffect(() => {
    let current = true, running = false; const controller = new AbortController();
    async function load() {
      if (running) return; running = true;
      try { const response = await fetch('/api/defenceNotices', { cache: 'no-store', signal: controller.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to load defence notices.'); if (current) { setData(result); setError(''); } }
      catch (error) { if (current && error.name !== 'AbortError') setError(error.message); }
      finally { running = false; if (current) setLoading(false); }
    }
    load(); const refresh = () => { if (document.visibilityState === 'visible') load(); }; const timer = setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { current = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [tick]);
  const refresh = () => { setLoading(true); setTick(value => value + 1); };
  async function remove(notice) {
    const confirmation = await showActionAlert({ icon: 'warning', titleText: 'Remove Defence Notice?', text: `Batch ${notice.batch} · ${notice.stream} will no longer appear on the notice board.`, showCancelButton: true, confirmButtonText: 'Remove Notice', cancelButtonText: 'Cancel', focusCancel: true });
    if (!confirmation.isConfirmed) return; setRemoving(true);
    try { const response = await fetch(`/api/defenceNotices/${notice.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: notice.revision }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); refresh(); }
    catch (error) { await showActionAlert({ icon: 'error', titleText: 'Notice Not Removed', text: error.message }); }
    finally { setRemoving(false); }
  }
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="m-0 text-lg font-semibold">Defence Notice Board</h2><p className="mb-0 mt-2 text-sm text-text-secondary">Upcoming defence dates for your department. All times are in Bangladesh time.</p></div><div className="flex flex-wrap justify-end gap-3"><Button appearance="outline" size="small" disabled={loading} onClick={refresh}>Refresh</Button>{role === 'department' && <Button size="small" disabled={loading} onClick={() => setEditor({ notice: null })}>Publish Notice</Button>}</div></div>
    {error && <p role="alert" className="rounded-control border border-danger-border bg-danger-soft p-4 text-sm text-danger">{error}{data && ' Showing the last available notices.'}</p>}
    {!data && !error && <p role="status" className="text-text-muted">Loading defence notices…</p>}
    {data && !data.notices.length && <section className="rounded-panel border border-dashed border-border bg-surface px-6 py-14 text-center"><h3 className="m-0 text-lg font-semibold">No Upcoming Defence Notice</h3><p className="mb-0 mt-3 text-sm text-text-muted">{role === 'department' ? 'Publish the next defence date with its batch, stream and venue.' : 'Your department will publish the next defence date here.'}</p></section>}
    {data?.notices.map((notice, index) => <article id={`notice-${notice.id}`} key={notice.id} className={`scroll-mt-24 overflow-hidden rounded-panel border bg-surface ${index === 0 ? 'border-primary-border' : 'border-border'}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6 ${index === 0 ? 'border-primary-border bg-primary-soft' : 'border-border bg-surface-soft'}`}><h3 className="m-0 text-base font-semibold">{index === 0 ? 'Next Defence' : 'Upcoming Defence'}</h3><span className="text-[13px] font-medium text-primary">Department Notice</span></div>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-6 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_1.5fr_1fr_1.5fr]">{[['Batch',notice.batch],['Stream',notice.stream],['Date',dateLabel(notice.startsAt)],['Time',timeLabel(notice.startsAt)],['Venue',notice.venue]].map(([label,value]) => <div key={label} className={`min-w-0 ${label === 'Venue' ? 'col-span-2 lg:col-span-1' : ''}`}><dt className="mb-2 text-[13px] text-text-muted">{label}</dt><dd className={`m-0 leading-relaxed [overflow-wrap:anywhere] ${label === 'Date' ? 'text-base font-semibold text-primary' : 'text-sm font-semibold'}`}>{value}</dd></div>)}</dl>
      {role === 'department' && data.canManage && <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-border px-5 py-3">{notice.assignmentCount > 0 ? <p className="m-0 text-[13px] text-text-muted">Assigned to {notice.assignmentCount} project(s). <Link href="/department/proposals" className="text-primary">Manage Assignments</Link></p> : <><Button appearance="ghost" size="small" disabled={removing} onClick={() => remove(notice)}>Remove</Button><Button appearance="outline" size="small" disabled={removing} onClick={() => setEditor({ notice })}>Edit Notice</Button></>}</footer>}
    </article>)}
    {editor && <NoticeForm key={editor.notice?.id || 'new'} notice={editor.notice} onClose={() => setEditor(null)} onSaved={refresh} />}
  </div>;
}
