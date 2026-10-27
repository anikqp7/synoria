"use client";
import { Form, Select, Textarea } from '@/components/validatedForm';
import { useState } from 'react';
import Button from '@/components/button';
import Modal from '@/components/modal';
import { showActionAlert } from '@/lib/actionAlerts';
export default function ProposalReviewActions({ proposal, supervisor, onReload }) {
  const [decision, setDecision] = useState('revisionRequested');
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true);
    try {
      const confirmation = await showActionAlert({ icon: 'question', titleText: supervisor ? `Review Version ${proposal.submission.version}?` : 'Start A Scope Change?', text: supervisor ? 'This decision will be saved against this submitted version. Approval preserves the submitted scope.' : 'The approved scope stays in effect while you prepare and submit a new version for review.', showCancelButton: true, confirmButtonText: supervisor ? 'Save Review' : 'Start Scope Change', cancelButtonText: 'Cancel', focusCancel: true });
      if (!confirmation.isConfirmed) return;
      const response = await fetch(supervisor ? `/api/supervision/${proposal.workspaceId}/review` : `/api/workspaces/${proposal.workspaceId}/proposal/scopeChange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supervisor ? { version: proposal.submission.version, decision, comment } : { revision: proposal.revision, reason: comment }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message);
      await showActionAlert({ icon: 'success', titleText: supervisor ? 'Review Saved' : 'Scope Change Started', text: data.message });
      setOpen(false); await onReload();
    } catch (error) { await showActionAlert({ icon: 'error', titleText: 'Action Not Completed', text: error.message }); }
    finally { setBusy(false); }
  }
  if (['defenceScheduled', 'evaluated', 'archived'].includes(proposal.status)) return null;
  if (supervisor && proposal.proposalStatus !== 'submitted') return null;
  if (!supervisor && (!proposal.isLeader || proposal.proposalStatus !== 'approved')) return null;
  return <section className="mb-6 rounded-panel border border-border bg-surface p-6 shadow-panel">{supervisor ? <><h2 className="mt-0 text-lg font-semibold">Review Proposal · Version {proposal.submission.version}</h2><Form onSubmit={submit}><fieldset disabled={busy}><label htmlFor="proposalDecision">Decision *</label><Select id="proposalDecision" name="decision" value={decision} onChange={event => setDecision(event.target.value)}><option value="revisionRequested">Request Revision</option><option value="approved">Approve</option><option value="rejected">Reject</option></Select><label htmlFor="reviewComment">{decision === 'approved' ? 'Review Comment' : 'Reason / Revision Instructions *'}</label><Textarea id="reviewComment" name="comment" maxLength={2000} rows={4} required={decision !== 'approved'} value={comment} onChange={event => setComment(event.target.value)} /><div className="ml-auto mt-5 flex w-fit"><Button type="submit">{busy ? 'Saving…' : 'Save Review'}</Button></div></fieldset></Form></> : <><h2 className="mt-0 text-lg font-semibold">Proposal Approved</h2><p className="text-sm leading-relaxed text-text-secondary">Your project is active. Changes to the approved scope require a new proposal version and supervisor approval.</p><div className="ml-auto flex w-fit"><Button appearance="outline" disabled={busy} onClick={() => { setComment(''); setOpen(true); }}>Start Scope Change</Button></div>{open && <Modal title="Start Scope Change" busy={busy} onClose={() => setOpen(false)}><Form onSubmit={submit} className="px-6 pb-6"><fieldset disabled={busy}><label htmlFor="scopeChangeReason">Reason *</label><Textarea id="scopeChangeReason" maxLength={1000} rows={4} required value={comment} onChange={event => setComment(event.target.value)} placeholder="Explain what needs to change and why" /><div className="ml-auto mt-5 flex w-fit gap-3"><Button appearance="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">{busy ? 'Saving…' : 'Start Scope Change'}</Button></div></fieldset></Form></Modal>}</>}</section>;
}
