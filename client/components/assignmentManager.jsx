"use client";
import { Form, Select, Textarea } from '@/components/validatedForm';
import useInitialLoad from "@/lib/useInitialLoad";
import { useCallback, useState } from 'react';
import Button from '@/components/button';
import ActionMessage from '@/components/actionMessage';
import { showActionAlert } from '@/lib/actionAlerts';
import { proposalDate } from '@/components/proposalDetails';
export default function AssignmentManager({ workspaceId, preferredId, onAssigned }) {
  const [context, setContext] = useState(null);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const dismiss = useCallback(() => setFeedback(null), []);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/proposals/${workspaceId}/assignment`, { cache: 'no-store' });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      setContext(data); setSelected(data.assignment?.supervisor?.id || '');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [workspaceId]);
  useInitialLoad(load);
  const current = context?.assignment?.supervisor;
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try {
      const confirmation = await showActionAlert({ icon: 'question', titleText: selected ? current ? 'Reassign Supervisor?' : 'Assign Supervisor?' : 'Remove Assignment?', text: selected ? 'Supervisor access and active project loads will update immediately.' : 'The current supervisor will lose access and their slot will be released.', showCancelButton: true, confirmButtonText: selected ? 'Confirm Assignment' : 'Remove Assignment', cancelButtonText: 'Cancel', focusCancel: true });
      if (!confirmation.isConfirmed) return;
      const response = await fetch(`/api/proposals/${workspaceId}/assignment`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supervisorId: selected || null, expectedSupervisorId: current?.id || null, reason }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message);
      await load(); setReason('');
      await showActionAlert({ icon: 'success', titleText: 'Assignment Updated', text: result.message });
      await onAssigned?.();
    } catch (err) { setFeedback({ icon: 'error', title: 'Assignment Not Updated', text: err.message }); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 rounded-panel border border-border bg-surface p-6 shadow-panel"><ActionMessage message={feedback} onDismiss={dismiss} /><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-semibold">Supervisor Assignment</h2><Button appearance="outline" size="small" disabled={busy || loading} onClick={load}>Refresh Assignment</Button></div>
    {loading ? <p role="status" className="text-sm text-text-muted">Loading assignment…</p> : error ? <p role="alert" className="text-sm text-text-secondary">{error}</p> : context && <><p className="text-sm text-text-secondary">Current Supervisor: <strong>{current?.name || 'Not Assigned'}</strong>{current && !current.isActive ? ' · Inactive Account' : ''}</p><Form onSubmit={save}><fieldset disabled={busy}><label htmlFor="assignedSupervisor">Assign Supervisor</label><Select id="assignedSupervisor" value={selected} onChange={event => setSelected(event.target.value)}><option value="">No Supervisor Assigned</option>{current && !context.supervisors.some(item => item.id === current.id) && <option value={current.id} disabled>{current.name} (Unavailable)</option>}{context.supervisors.map(item => <option key={item.id} value={item.id} disabled={!item.isActive || (item.available === 0 && item.id !== current?.id)}>{item.name} · {item.currentLoad}/{item.maxLoad} Assigned{item.id === preferredId ? ' · Student Preference' : ''}{!item.isActive ? ' · Inactive' : item.available === 0 ? ' · Full' : ''}</option>)}</Select><label htmlFor="assignmentReason">{current&&!selected?"Cancellation Note *":"Assignment Note"}</label><Textarea id="assignmentReason" required={!!current&&!selected} rows={2} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Optional reason for the assignment or reassignment" /><div className="ml-auto mt-5 flex w-fit"><Button type="submit" disabled={selected === (current?.id || '')}>{busy ? 'Saving…' : current ? selected ? 'Reassign Supervisor' : 'Remove Assignment' : 'Assign Supervisor'}</Button></div></fieldset></Form><h3 className="mt-7 text-base font-semibold">Assignment History</h3>{context.history.length ? <ul className="m-0 list-none divide-y divide-border p-0">{[...context.history].reverse().map(item => <li key={item.id} className="py-3 text-sm"><p className="m-0 text-text-secondary">{item.from?.name || 'Unassigned'} → {item.to?.name || 'Unassigned'}</p><p className="mb-0 mt-1 text-[13px] text-text-muted">{proposalDate(item.createdAt)}</p>{item.reason && <p className="mb-0 mt-2 text-sm text-text-secondary [overflow-wrap:anywhere]">{item.reason}</p>}</li>)}</ul> : <p className="text-sm text-text-muted">No supervisor has been assigned yet.</p>}</>}
  </section>;
}
