"use client";
import { Form, Input, Select, Textarea } from '@/components/validatedForm';
import { useState } from 'react';
import Modal from '@/components/modal';
import Button from '@/components/button';
import { showActionAlert } from '@/lib/actionAlerts';
import { dhakaInput, utcFromDhaka } from '@/lib/defenceFormat';
export default function DefenceScheduleForm({ existing, projects = [], examiners = [], onClose, onSaved }) {
  const [busy, setBusy] = useState(false), [requestKey] = useState(() => crypto.randomUUID());
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    try {
      const project = existing ? { id: existing.workspaceId, proposalVersion: existing.proposalVersion } : projects.find(item => item.id === form.get('workspaceId'));
      if (!project) throw new Error('Choose a defence-ready project.');
      const body = { requestKey, workspaceId: project.id, proposalVersion: project.proposalVersion, startsAt: existing && form.get('startsAt') === dhakaInput(existing.startsAt) ? existing.startsAt : utcFromDhaka(form.get('startsAt')), durationMinutes: Number(form.get('durationMinutes')), venue: form.get('venue'), meetingLink: form.get('meetingLink'), examinerIds: form.getAll('examinerIds'), ...(existing ? { revision: existing.revision, reason: form.get('reason') } : {}) };
      const response = await fetch(`/api/defences${existing ? `/${existing.id}` : ''}`, { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await onSaved(data); onClose();
      await new Promise(resolve => requestAnimationFrame(resolve));
      await showActionAlert({ icon: 'success', titleText: existing ? 'Defence Rescheduled' : 'Defence Scheduled', text: 'The team, supervisor and assigned examiners can view the schedule in their accounts.' });
    } catch (err) { await showActionAlert({ icon: 'error', titleText: 'Unable To Save Schedule', text: err.message }); }
    finally { setBusy(false); }
  }
  return <Modal title={existing ? 'Reschedule Defence' : 'Schedule Defence'} description="Times use Bangladesh time (Asia/Dhaka)." busy={busy} onClose={onClose}><Form onSubmit={submit} className="p-6"><fieldset disabled={busy} className="space-y-5">
    {existing ? <p className="text-sm font-semibold">{existing.workspaceName} · Proposal Version {existing.proposalVersion}</p> : <label className="grid gap-2 text-sm">Defence-Ready Project *<Select name="workspaceId" required defaultValue=""><option value="" disabled>Choose A Project</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name} · Proposal Version {item.proposalVersion}</option>)}</Select></label>}
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">Date And Time (Bangladesh) *<Input type="datetime-local" data-future="true" name="startsAt" required defaultValue={dhakaInput(existing?.startsAt)} /></label><label className="grid gap-2 text-sm">Duration (Minutes) *<Input name="durationMinutes" type="number" min={15} max={480} step={1} defaultValue={existing?.durationMinutes || 30} required /></label></div>
    <label className="grid gap-2 text-sm">Venue<Input name="venue" maxLength={150} defaultValue={existing?.venue || ''} placeholder="e.g. CSE Seminar Room" /></label>
    <label className="grid gap-2 text-sm">Meeting Link<Input name="meetingLink" type="url" maxLength={1000} defaultValue={existing?.meetingLink || ''} placeholder="https://…" /></label><p className="text-sm text-text-secondary">Enter a venue, meeting link, or both. Use consistent venue names across your department.</p>
    <div><h3 className="mb-3 mt-0 text-sm font-semibold">Evaluation Board * (1–10 Examiners)</h3><div className="space-y-3">{examiners.map(member => <label key={member.id} className="flex items-start gap-3 text-sm"><Input type="checkbox" name="examinerIds" value={member.id} defaultChecked={existing?.board.some(item => item.id === member.id)} /><span>{member.name}{member.designation ? ` · ${member.designation}` : ''}</span></label>)}{existing?.board.filter(member => !examiners.some(item => item.id === member.id)).map(member => <p key={member.id} className="text-sm text-danger">{member.name} is unavailable. Select an active replacement.</p>)}</div>{!examiners.length && <p className="text-sm text-text-secondary">Create or activate an Examiner account before scheduling.</p>}</div>
    {existing && <label className="grid gap-2 text-sm">Reschedule Reason *<Textarea name="reason" rows={3} maxLength={500} required /></label>}
    <div className="flex flex-wrap justify-end gap-3"><Button appearance="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !examiners.length}>{busy ? 'Saving…' : existing ? 'Save Changes' : 'Schedule Defence'}</Button></div>
  </fieldset></Form></Modal>;
}
