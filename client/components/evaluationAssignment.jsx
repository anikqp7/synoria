"use client";
import { Form, Input, Select } from '@/components/validatedForm';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Button from '@/components/button';
import Modal from '@/components/modal';
import { showActionAlert } from '@/lib/actionAlerts';
import { dateFor } from '@/lib/monitoringFormat';
function AssignmentForm({ data, onClose, onSaved }) {
  const [busy, setBusy] = useState(false), [requestKey] = useState(() => crypto.randomUUID());
  const [selected, setSelected] = useState(() => (data.current?.board || []).map(item => String(item.id)).filter(id => data.examiners.some(item => item.id === id)));
  async function save(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget), notice = data.notices.find(item => item.id === form.get('noticeId')); if (!notice) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/evaluationAssignments/${data.workspaceId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestKey, proposalVersion: data.proposalVersion, noticeId: notice.id, noticeRevision: notice.revision, examinerIds: selected, expectedDefenceId: data.current?.id || null, revision: data.current?.revision || 0 }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      onSaved(result); onClose(); await new Promise(resolve => requestAnimationFrame(resolve));
      await showActionAlert({ icon: 'success', titleText: 'Examiners Assigned', text: 'The selected examiners can now open this project from their Evaluation tab.' });
    } catch (error) { await showActionAlert({ icon: 'error', titleText: 'Assignment Not Saved', text: error.message }); }
    finally { setBusy(false); }
  }
  const currentNotice = data.notices.some(item => item.id === data.current?.noticeId) ? data.current.noticeId : '';
  return <Modal title="Assign Examiners" description={data.workspaceName} busy={busy} onClose={onClose}><Form onSubmit={save} className="space-y-5 p-6"><fieldset disabled={busy} className="space-y-5">
    <div className="grid gap-2 text-sm"><label htmlFor="assignmentNotice" className="m-0">Defence Schedule *</label><Select id="assignmentNotice" name="noticeId" required defaultValue={currentNotice}><option value="" disabled>Choose A Published Defence Date</option>{data.notices.map(item => <option key={item.id} value={item.id}>Batch {item.batch} · {item.stream} · {dateFor(item.startsAt)} · {item.venue}</option>)}</Select></div>
    <p className="m-0 text-[13px] text-text-muted">Date, time and venue come from the selected notice. Times use Bangladesh time.</p>
    <div><h3 className="mb-3 mt-0 text-sm font-semibold">Examiners * <span className="font-normal text-text-muted">({selected.length} Selected)</span></h3><div className="grid gap-2">{data.examiners.map(item => <label key={item.id} className="m-0 flex cursor-pointer items-start gap-3 rounded-control border border-border p-3 text-sm"><Input type="radio" name="examinerChoice" required value={item.id} className="mt-1" checked={selected.includes(item.id)} onChange={event => setSelected(current => event.target.checked ? [item.id] : current)} /><span>{item.name}{item.designation && <span className="mt-1 block text-[13px] font-normal text-text-muted">{item.designation}</span>}</span></label>)}</div></div>
    <p className="text-[13px] text-text-muted">Evaluation Rubric: {data.rubricName}. Evaluation criteria are applied automatically.</p>
    <div className="flex justify-end gap-3"><Button appearance="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !selected.length || selected.length !== 1}>{busy ? 'Saving…' : 'Assign Examiners'}</Button></div>
  </fieldset></Form></Modal>;
}
export default function EvaluationAssignment({ workspaceId, onChanged }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [open, setOpen] = useState(false), [tick, setTick] = useState(0);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    async function load() { try { const response = await fetch(`/api/evaluationAssignments/${workspaceId}`, { cache: 'no-store', signal: controller.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.message); if (current) { setData(result); setError(''); } } catch (error) { if (current && error.name !== 'AbortError') setError(error.message); } }
    load(); return () => { current = false; controller.abort(); };
  }, [workspaceId, tick]);
  return <section id="evaluationAssignment" className="scroll-mt-24 rounded-panel border border-border bg-surface p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-xl font-semibold">Evaluation Assignment</h2><Button appearance="outline" size="small" onClick={() => setTick(value => value + 1)}>Refresh Assignment</Button></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}{!data && !error && <p role="status" className="text-sm text-text-muted">Loading examiner assignment…</p>}
    {data && <>
      {data.current ? <div className="mt-5"><div className="flex flex-wrap gap-2">{data.current.board.map(item => <span key={String(item.id)} className="rounded-control border border-primary-border bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary">{item.name}</span>)}</div><p className="mb-0 mt-4 text-sm text-text-secondary">{dateFor(data.current.startsAt)} · {data.current.venue}</p>{data.current.batch && <p className="mb-0 mt-2 text-sm text-text-muted">Batch {data.current.batch} · {data.current.stream}</p>}<p className="mb-0 mt-2 text-[13px] text-text-muted">Rubric: {data.current.rubricName || 'Not Selected Yet'}</p></div> : <p className="text-sm text-text-secondary">Assign examiners and select a published defence date for this project.</p>}
      {!data.canAssign && <p className="text-sm text-text-muted">{data.current?.status === 'published' ? 'The result is published. This evaluation is complete.' : data.evaluationStarted ? 'Evaluation has started. The current examiner assignment is locked.' : 'Assignments require an approved proposal, an open assignment period and a project not already submitted for evaluation.'}</p>}
      {data.canAssign && !data.notices.length && <p className="text-sm text-text-secondary">Ask your department to publish an upcoming defence date. <Link href="/supervisor/defences" className="font-semibold text-primary">View Defence Notices</Link></p>}
      {data.canAssign && !data.examiners.length && <p className="text-sm text-text-secondary">Create an active examiner account first. <Link href="/supervisor/evaluationAssignments" className="font-semibold text-primary">Contact Your Department</Link></p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3">{data.current && <Link href={`/supervisor/defences/${data.current.id}`} className="inline-flex items-center rounded-control border border-border px-3 py-2 text-sm font-semibold text-primary">View Evaluation</Link>}{data.canAssign && <Button size="small" disabled={!data.notices.length || !data.examiners.length} onClick={() => setOpen(true)}>{data.current ? 'Change Examiners / Date' : 'Assign Examiners'}</Button>}</div>
    </>}
    {open && <AssignmentForm data={data} onClose={() => setOpen(false)} onSaved={result => { setData(result); onChanged?.(); }} />}
  </section>;
}
