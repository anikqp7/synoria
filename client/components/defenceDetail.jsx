"use client";
import { Form, Textarea } from '@/components/validatedForm';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import EvaluationPanel from '@/components/evaluationPanel';
import Button from '@/components/button';
import Modal from '@/components/modal';
import { showActionAlert } from '@/lib/actionAlerts';
import { dateFor } from '@/lib/monitoringFormat';
const panel = 'rounded-panel border border-border bg-surface p-5 sm:p-6';
export default function DefenceDetail({ role, defenceId }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0), [cancel, setCancel] = useState(null), [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true; const controller = new AbortController();
    async function load() {
      try { const response = await fetch(`/api/defences/${defenceId}`, { cache: 'no-store', signal: controller.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Unable to load this defence.'); if (current) { setData(result); setError(''); } }
      catch (err) { if (current && err.name !== 'AbortError') { setError(err.message); setData(null); } }
      finally { if (current) setLoading(false); }
    }
    load(); const refresh = () => { if (document.visibilityState === 'visible') load(); }; const timer = setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { current = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [defenceId, tick]);
  async function cancelSchedule(event) {
    event.preventDefault(); setBusy(true);
    try {
      const body = { revision: cancel.revision, requestKey: cancel.key, reason: new FormData(event.currentTarget).get('reason') };
      const response = await fetch(`/api/defences/${defenceId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.message);
      setData(result); setCancel(null); await new Promise(resolve => requestAnimationFrame(resolve));
      await showActionAlert({ icon: 'success', titleText: 'Defence Cancelled', text: 'The slot has been released. The cancelled schedule is preserved in history.' });
    } catch (err) { await showActionAlert({ icon: 'error', titleText: 'Unable To Cancel Defence', text: err.message }); }
    finally { setBusy(false); }
  }
  const item = data?.schedule, proposal = data?.approvedProposal;
  return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><Link href={`/${role}/defences`} className="text-sm text-primary">← Defence Schedules</Link><Button size="small" appearance="outline" disabled={loading || busy} onClick={() => { setLoading(true); setTick(value => value + 1); }}>Refresh</Button></div>{error && <p role="alert" className="rounded-control border border-danger-border bg-danger-soft p-4 text-danger">{error}</p>}{loading && !data && <p role="status">Loading Defence…</p>}{data && <>
    <header><h1 className="mb-3 mt-0 text-3xl font-semibold [overflow-wrap:anywhere]">{item.workspaceName}</h1><p className="text-sm text-text-secondary [overflow-wrap:anywhere]">{item.title}</p></header>
    <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-xl font-semibold">Defence Schedule</h2><span className="rounded-control bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">{item.status === 'published' ? 'Result Published' : item.status === 'cancelled' ? 'Cancelled' : 'Scheduled'}</span></div><p className="text-base font-semibold">{dateFor(item.startsAt)}{!item.noticeId && <> → {dateFor(item.endsAt)}</>}</p><p className="text-sm text-text-secondary">{!item.noticeId && `${item.durationMinutes} Minutes · `}Bangladesh Time (Asia/Dhaka)</p><p className="text-sm text-text-secondary [overflow-wrap:anywhere]">Venue: {item.venue || 'Online Meeting'}</p>{item.meetingLink && item.status === 'scheduled' && <a className="text-sm text-primary [overflow-wrap:anywhere]" href={item.meetingLink} target="_blank" rel="noreferrer">Open Meeting Link ↗</a>}<h3 className="mb-2 mt-5 text-base font-semibold">Evaluation Board</h3><ul className="list-none space-y-2 p-0">{item.board.map(member => <li key={member.id} className="text-sm">{member.name}{member.designation ? ` · ${member.designation}` : ''}</li>)}</ul><h3 className="mb-2 mt-5 text-base font-semibold">Team</h3><ul className="list-none space-y-2 p-0">{item.team.map(member => <li key={member.id} className="text-sm">{member.name} · {member.studentId}</li>)}</ul>
      {data.canManage && <div className="mt-5 flex flex-wrap justify-end gap-3"><Button appearance="outline" disabled={busy} onClick={() => setCancel({ key: crypto.randomUUID(), revision: item.revision })}>Cancel Defence</Button>{data.canReschedule && <Link href={`/department/proposals/${item.workspaceId}#evaluationAssignment`} className="inline-flex items-center rounded-control border border-primary-border px-3 py-2 text-sm font-semibold text-primary">Change Examiners / Date</Link>}</div>}
      {role === 'department' && <Link href={`/department/proposals/${item.workspaceId}`} className="mt-4 inline-block text-sm text-primary">View Proposal</Link>}
    </section>
    {proposal && <section className={panel}><h2 className="text-xl font-semibold">Approved Proposal · Version {proposal.version}</h2><h3 className="text-base font-semibold">{proposal.title}</h3><p className="text-sm text-text-secondary">{proposal.researchArea}</p><p className="whitespace-pre-wrap text-sm text-text-secondary">{proposal.abstract}</p><p className="text-sm text-text-secondary">Approved By {proposal.approvedBy.name} · {dateFor(proposal.approvedAt)}</p></section>}
    <EvaluationPanel defenceId={defenceId} role={role} workspaceId={item.workspaceId} onChanged={async () => setTick(value => value + 1)} />
    <section className={panel}><h2 className="mt-0 text-xl font-semibold">Schedule History</h2><div className="space-y-4">{[...data.history].reverse().map(event => <details key={event.id} className="rounded-control border border-border p-4"><summary className="cursor-pointer text-sm font-semibold">Version {event.version} · {event.type === 'published' ? 'Result Published' : event.type === 'scheduled' ? 'Scheduled' : event.type === 'rescheduled' ? 'Rescheduled' : 'Cancelled'} · {dateFor(event.savedAt)}</summary><p className="text-sm text-text-secondary">{dateFor(event.startsAt)} → {dateFor(event.endsAt)} · {event.venue || 'Online Meeting'}</p>{event.meetingLink && <p className="text-sm text-text-secondary [overflow-wrap:anywhere]">Meeting Link: {event.meetingLink}</p>}<p className="text-sm text-text-secondary">Board: {event.board.map(member => member.name).join(', ')}</p><p className="text-sm text-text-secondary">Saved By {event.actor.name}</p>{event.reason && <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{event.reason}</p>}</details>)}</div></section>
    {role === 'examiner' && <Link className="inline-flex rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white" href={`/examiner/resources/${item.workspaceId}`}>View Project Resources</Link>}{data.supervisor?.supervisor&&<p className="text-sm text-text-secondary">Supervisor: {data.supervisor.supervisor.name}</p>}{role === 'examiner' && <p className="text-sm text-text-secondary">This view contains the approved proposal assigned to this defence.</p>}
  </>}
    {cancel && <Modal title="Cancel Defence" description="The old schedule and board history will be preserved." busy={busy} onClose={() => setCancel(null)}><Form onSubmit={cancelSchedule} className="space-y-5 p-6"><label className="grid gap-2 text-sm">Cancellation Reason *<Textarea name="reason" rows={3} maxLength={500} required disabled={busy} /></label><div className="flex justify-end gap-3"><Button appearance="outline" disabled={busy} onClick={() => setCancel(null)}>Keep Schedule</Button><Button type="submit" disabled={busy}>{busy ? 'Cancelling…' : 'Cancel Defence'}</Button></div></Form></Modal>}
  </div>;
}
