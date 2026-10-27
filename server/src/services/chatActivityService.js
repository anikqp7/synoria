const same = (a, b) => String(a) === String(b);
function collector(existing = []) {
  const events = new Map(existing.map(event => [event.key, event]));
  const add = (key, workspace, category, title, text, createdAt, target, defenceId, meetingId) => {
    if (!workspace || !createdAt || !Number.isFinite(new Date(createdAt).getTime()) || events.has(key)) return;
    events.set(key, { key, workspace, category, title, text, createdAt, target, ...(defenceId ? { defenceId } : {}), ...(meetingId ? { meetingId } : {}) });
  };
  return { events, add };
}
function ledgerActivities(ledger) {
  const { events, add } = collector(ledger.chatActivities);
  for (const event of ledger.history || []) add(`assignment:${event._id}`, event.workspace, 'supervision', event.requestCancellation ? 'Supervisor Request Cancelled' : event.to?.id ? 'Supervisor Assigned' : 'Supervisor Removed', event.requestCancellation ? `${event.reason} Please submit a new supervisor request.` : event.to?.id ? `${event.to.name} is now the assigned supervisor.${event.reason ? ` ${event.reason}` : ''}` : `The assigned supervisor was removed.${event.reason ? ` ${event.reason}` : ''}`, event.createdAt, 'supervisor');
  for (const event of ledger.reviews || []) add(`review:${event._id}`, event.workspace, 'proposal', { approved: 'Proposal Approved', rejected: 'Proposal Rejected', revisionRequested: 'Proposal Revision Requested' }[event.decision], `Version ${event.version}${event.reviewer?.name ? ` · ${event.reviewer.name}` : ''}${event.comment ? `\n${event.comment}` : ''}`, event.createdAt, 'proposal');
  for (const event of ledger.scopeChanges || []) add(`scope:${event._id}`, event.workspace, 'proposal', 'Scope Change Requested', event.reason, event.createdAt, 'proposal');
  for (const entry of ledger.resources || []) for (const event of entry.events || []) add(`resource:${entry.workspace}:${event.id}`, entry.workspace, 'resources', 'Project Resources Updated', `${event.actor.name} ${{ add: 'added', edit: 'updated', remove: 'removed' }[event.action] || 'updated'} “${event.title}”.`, event.createdAt, 'resources');
  for (const meeting of ledger.chatMeetings || []) for (const event of meeting.history || []) {
    const title = { scheduled: 'Meeting Scheduled', rescheduled: 'Meeting Rescheduled', cancelled: 'Meeting Cancelled', summary: 'Meeting Summary Updated' }[event.type];
    const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(event.startsAt));
    const text = event.type === 'summary' ? `${event.title}\n${event.summary}${event.decisions ? `\nDecisions: ${event.decisions}` : ''}` : `${event.title} · ${when} (Bangladesh Time)${event.venue ? ` · ${event.venue}` : ''}${event.reason ? `\n${event.reason}` : ''}`;
    add(`meeting:${meeting._id}:${event._id}`, meeting.workspace, 'meeting', title, text, event.createdAt, 'meeting', undefined, meeting._id);
  }
  for (const defence of ledger.defences || []) {
    for (const event of defence.history || []) {
      if (event.type === 'published') continue;
      add(`defence:${event._id}`, defence.workspace, 'evaluation', event.type === 'cancelled' ? 'Defence Cancelled' : event.type === 'rescheduled' ? 'Defence Schedule Updated' : defence.submittedForEvaluationAt ? 'Project Submitted For Evaluation' : 'Defence Scheduled', event.type === 'cancelled' ? event.reason || 'The defence was cancelled.' : `${event.board.map(member => member.name).join(', ')}${event.venue ? ` · ${event.venue}` : ''}${defence.submittedForEvaluationAt ? '\nTeam changes and resource editing are now locked.' : ''}`, event.createdAt, 'evaluation', defence._id);
    }
    const first = defence.evaluation?.publicationVersions?.[0]?.publication || defence.evaluation?.publication;
    if (first) add(`result:${defence._id}`, defence.workspace, 'result', 'Result Published', `Final marks: ${first.weightedTotal.toFixed(2)} / 100.${first.note ? `\n${first.note}` : ''}`, first.publishedAt, 'evaluation', defence._id);
    for (const event of defence.evaluation?.history || []) if (event.type === 'correct') add(`resultUpdate:${event._id}`, defence.workspace, 'result', 'Result Updated', event.reason, event.createdAt, 'evaluation', defence._id);
    // Private examiner drafts, rubric scores and unpublished feedback never enter team chat.
  }
  return [...events.values()];
}
function workspaceActivities(workspace) {
  const { events, add } = collector(workspace.chatActivities);
  for (const version of workspace.proposalVersions || []) add(`proposal:${workspace._id}:${version.version}`, workspace._id, 'proposal', 'Proposal Submitted', `Version ${version.version} · ${version.title}`, version.submittedAt, 'proposal');
  for (const event of workspace.teamEvents || []) add(`team:${event._id}`, workspace._id, 'team', { memberAdded:'Team Member Added', memberRemoved:'Team Member Removed', memberLeft:'Team Member Left', roleUpdated:'Team Role Updated', workspaceUpdated:'Team Updated' }[event.type] || 'Team Updated', `${event.actor?.name || 'The team leader'} updated the team.`, event.createdAt, 'team');
  const request = workspace.supervisorRequest;
  if (request?.submittedAt) add(`supervisorRequest:${workspace._id}:${request.revision}`, workspace._id, 'supervision', 'Supervisor Request Submitted', 'The team submitted three ranked supervisor choices.', request.submittedAt, 'supervisor');
  return [...events.values()];
}
function forWorkspace(workspace, ledger) {
  const all = [...ledgerActivities(ledger).filter(event => same(event.workspace, workspace._id)), ...workspaceActivities(workspace)];
  return all.map(event => ({ id: `system:${event.key}`, type: 'system', category: event.category, title: event.title, text: event.text, target: event.target, meetingId: event.meetingId ? String(event.meetingId) : undefined, defenceId: event.defenceId ? String(event.defenceId) : undefined, createdAt: new Date(event.createdAt).toISOString() }));
}
module.exports = { ledgerActivities, workspaceActivities, forWorkspace };
