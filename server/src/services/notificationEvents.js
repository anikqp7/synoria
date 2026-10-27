const same = (a, b) => String(a) === String(b);
const categories = ['account', 'team', 'proposal', 'resources', 'supervision', 'chat', 'meeting', 'defence', 'evaluation', 'result', 'reminder'];
function buildEvents({ viewer, workspaces, ledger, chats = [], notices = [], proposalNotices = [], resourceNotices = [], supervisorNotices = [], evaluationNotices = [], resultNotices = [], now = new Date(), account }) {
  const id = viewer.id, role = viewer.role, events = new Map(), cutoff = new Date(now.getTime() - 30 * 86400000);
  const assigned = new Set((ledger.assignments || []).filter(item => same(item.supervisor, id)).map(item => String(item.workspace)));
  const archived = new Set((ledger.defences || []).filter(item => item.evaluation?.publication).map(item => String(item.workspace)));
  const owns = workspace => role === 'department' || (role === 'student' ? workspace.members.some(member => same(member, id)) : role === 'supervisor' && assigned.has(String(workspace._id)));
  const allowed = workspaces.filter(owns), workspaceIds = allowed.map(item => String(item._id));
  const defenceIds = (ledger.defences || []).filter(item => role === 'department' || (role === 'examiner' ? item.board.some(member => same(member.id, id)) : workspaceIds.includes(String(item.workspace)))).map(item => String(item._id));
  const byId = new Map(workspaces.map(item => [String(item._id), item]));
  const isArchived = workspace => !workspace.isActive || workspace.status === 'archived' || archived.has(String(workspace._id));
  function link(workspace, section = '') {
    if (role === 'department') return `/department/proposals/${workspace._id}${section ? `#${section}` : ''}`;
    if (role === 'supervisor') return section==='proposal'?`/supervisor/proposals/${workspace._id}`:`/supervisor/projects/${workspace._id}${section?`/${section}`:''}`;
    return section === 'proposal' ? '/student/proposal' : `/student/project/${workspace._id}`;
  }
  function emit(key, data) {
    const at = new Date(data.at || now);
    if (!Number.isFinite(at.getTime()) || (!data.force && at < cutoff) || at > now || (data.actor?.id && same(data.actor.id, id))) return;
    events.set(key, { eventKey: key, category: data.category, title: data.title.slice(0, 180), message: data.message.slice(0, 500), href: data.href, scope: data.scope || 'workspace', workspace: data.workspace?._id || data.workspace, defence: data.defence, occurredAt: at, dynamic: !!data.dynamic });
  }
  function project(key, workspace, data) { if (workspace && owns(workspace)) emit(key, { ...data, workspace, href: data.href || link(workspace, data.section) }); }
  if (account?.createdAt) emit(`account:created:${id}`, { category: 'account', title: 'Welcome To Synoria', message: 'Your account is ready. View your account details and academic workspace.', scope: 'personal', href: `/${role}/account`, at: account.createdAt });
  if (account?.updatedAt && new Date(account.updatedAt) - new Date(account.createdAt) > 0) emit(`account:updated:${new Date(account.updatedAt).toISOString()}`, { category: 'account', title: 'Account Updated', message: 'Your account details or sign-in settings were updated by your department.', scope: 'personal', href: `/${role}/account`, at: account.updatedAt });
  for (const workspace of workspaces) {
    const wid = String(workspace._id);
    if(role==='department' && workspace.supervisorRequest?.submittedAt) project(`supervisorRequest:${wid}:${workspace.supervisorRequest.revision}`,workspace,{category:'supervision',title:'Supervisor Request Submitted',message:`${workspace.name} submitted three ranked supervisor choices.`,href:'/department/manageSupervision#supervisorRequests',at:workspace.supervisorRequest.submittedAt});
    for (const invite of workspace.invitations || []) {
      if (role === 'student' && same(invite.student, id) && invite.status === 'pending' && workspace.isActive && !(ledger.defences||[]).some(d=>same(d.workspace,workspace._id)&&d.board?.length)) emit(`invite:${invite._id}`, { category: 'team', title: 'Team Invitation', message: `You have been invited to ${workspace.name}.`, scope: 'personal', href: '/student/team#teamInvitations', at: invite.createdAt, dynamic: true, force: true });
      if (invite.status !== 'pending') {
        const actorId = invite.status === 'cancelled' ? workspace.leader : invite.student;
        if (role === 'student' && (same(workspace.leader, id) || same(invite.student, id))) emit(`invite:${invite._id}:${invite.status}`, { category: 'team', title: `Invitation ${invite.status === 'accepted' ? 'Accepted' : invite.status === 'declined' ? 'Declined' : 'Cancelled'}`, message: `A team invitation for ${workspace.name} was ${invite.status}.`, scope: 'personal', workspace, href: same(workspace.leader, id) && owns(workspace) ? '/student/team#sentInvitations' : '/student/team#teamInvitations', at: invite.respondedAt, actor: { id: actorId } });
      }
    }
    for (const request of workspace.joinRequests || []) {
      if(role==='student'&&same(workspace.leader,id)&&request.status==='pending'&&workspace.isActive&&!(ledger.defences||[]).some(d=>same(d.workspace,workspace._id)&&(d.board?.length||d.history?.some(h=>h.board?.length)))) emit(`joinRequest:${request._id}`,{category:'team',title:'Team Join Request',message:`A student requested to join ${workspace.name}. Review the request from your Team page.`,scope:'workspace',workspace,href:'/student/team',at:request.createdAt,dynamic:true,force:true});
      if(role==='student'&&same(request.student,id)&&['accepted','declined'].includes(request.status)) emit(`joinRequest:${request._id}:${request.status}`,{category:'team',title:request.status==='accepted'?'Join Request Accepted':'Join Request Declined',message:`Your request to join ${workspace.name} was ${request.status}.`,scope:'personal',href:'/student/team',at:request.respondedAt});
    }
    for (const event of workspace.teamEvents || []) if (role === 'student' && (owns(workspace) || same(event.member, id))) {
      if(event.type==='memberAdded') { if(owns(workspace)) emit(`team:${event._id}`,{category:'team',title:same(event.member,id)?'Added To Team':'Team Member Added',message:`The membership of ${workspace.name} changed.`,scope:'workspace',workspace,href:'/student/team',at:event.createdAt,actor:event.actor}); }
      else if(event.type==='roleUpdated') { if(same(event.member,id)&&owns(workspace)) emit(`team:${event._id}`,{category:'team',title:'Team Role Updated',message:`Your responsibility in ${workspace.name} has been updated.`,scope:'workspace',workspace,href:'/student/team',at:event.createdAt,actor:event.actor}); }
      else emit(`team:${event._id}`, { category: 'team', title: event.type === 'workspaceUpdated' ? 'Team Updated' : 'Team Membership Updated', message: event.type === 'workspaceUpdated' ? `${workspace.name}: the team details were updated.` : same(event.member, id) ? `You are no longer a member of ${workspace.name}.` : `The membership of ${workspace.name} changed.`, scope: same(event.member, id) ? 'personal' : 'workspace', workspace, href:'/student/team', at: event.createdAt, actor: event.actor });
    }
    for (const version of workspace.proposalVersions || []) if (role !== 'examiner') project(`proposal:${wid}:${version.version}`, workspace, { category: 'proposal', title: 'Proposal Submitted', message: `${workspace.name}: proposal Version ${version.version} was submitted.`, section: 'proposal', at: version.submittedAt, actor: { id: version.submittedBy } });
  }
  for (const event of ledger.history || []) {
    const workspace = byId.get(String(event.workspace)); if (!workspace) continue;
    if (role === 'supervisor' && (same(event.from?.id, id) || same(event.to?.id, id))) {
      const removed = same(event.from?.id, id), current = assigned.has(String(event.workspace));
      emit(`assignment:${event._id}`, { category: 'supervision', title: removed ? 'Supervision Assignment Removed' : 'New Supervision Assignment', message: `${workspace.name}: your supervision assignment changed.`, scope: current && !removed ? 'workspace' : 'personal', workspace, href: current && !removed && workspace.proposalVersions?.length ? link(workspace, 'proposal') : '/supervisor/projects', at: event.createdAt, actor: { id: event.actor } });
    } else if (role === 'student') project(`assignment:${event._id}`, workspace, { category: 'supervision', title: event.requestCancellation?'Supervisor Request Cancelled':'Supervisor Assignment Updated', message: event.requestCancellation?`${workspace.name}: ${event.reason} Submit a new supervisor request during the open choice period.`:`${workspace.name}: your department updated the assigned supervisor.`, href: '/student/supervisor', at: event.createdAt, actor: { id: event.actor } });
  }
  if(role==='supervisor')for(const entry of ledger.resources||[]){
    const workspace=byId.get(String(entry.workspace));
    if(!workspace||!assigned.has(String(entry.workspace)))continue;
    for(const event of entry.events||[])if(same(event.supervisorId,id))project(`resourceUpdate:${entry.workspace}:${event.id}`,workspace,{
      category:'resources',title:'Project Resources Updated',
      message:`${event.actor.name} ${{add:'added',edit:'updated',remove:'removed'}[event.action]||'updated'} “${event.title}” in ${workspace.name}.`,
      href:`/supervisor/resources/${workspace._id}`,at:event.createdAt,actor:event.actor,
    });
  }
  for (const event of ledger.capacityHistory || []) if (role === 'supervisor' && same(event.supervisor, id)) emit(`capacity:${event._id}`, { category: 'supervision', title: 'Supervision Capacity Updated', message: `Your maximum active project load changed from ${event.from} to ${event.to}.`, scope: 'personal', href: '/supervisor/dashboard', at: event.createdAt, actor: { id: event.actor } });
  for (const review of ledger.reviews || []) if (role !== 'examiner') project(`proposalReview:${review._id}`, byId.get(String(review.workspace)), { category: 'proposal', title: review.decision === 'approved' ? 'Proposal Approved' : review.decision === 'rejected' ? 'Proposal Rejected' : 'Proposal Revision Requested', message: `Proposal Version ${review.version} has a new supervisor decision. Open the proposal to read the feedback.`, section: 'proposal', at: review.createdAt, actor: review.reviewer });
  for (const event of ledger.scopeChanges || []) if (role !== 'examiner') project(`scope:${event._id}`, byId.get(String(event.workspace)), { category: 'proposal', title: 'Scope Change Requested', message: 'The project team requested a change to the approved proposal scope.', section: 'proposal', at: event.createdAt, actor: { id: event.requestedBy } });
  if (['student', 'supervisor'].includes(role)) for (const meeting of ledger.chatMeetings || []) {
    const workspace = byId.get(String(meeting.workspace));
    for (const event of meeting.history || []) project(`meeting:${meeting._id}:${event._id}`, workspace, { category: 'meeting', title: { scheduled:'Meeting Scheduled', rescheduled:'Meeting Rescheduled', cancelled:'Meeting Cancelled', summary:'Meeting Summary Updated' }[event.type], message: event.type === 'summary' ? `${event.title}: ${event.summary}` : `${event.title}${event.reason ? `: ${event.reason}` : ''}. Open your conversation for meeting details.`, href: `/${role}/chat/${meeting.workspace}?meeting=${meeting._id}`, at: event.createdAt, actor: event.actor });
  }
  for (const defence of ledger.defences || []) {
    const workspace = byId.get(String(defence.workspace)); if (!workspace) continue;
    const canSee = defenceIds.includes(String(defence._id)), href = `/${role}/defences/${defence._id}`;
    if(role==='student'&&defence.submittedForEvaluationAt&&owns(workspace))project(`evaluationSubmitted:${defence._id}`,workspace,{category:'evaluation',title:'Project Submitted For Evaluation',message:'Your project has been submitted to an examiner. Your team and project resources are now locked.',href:`/student/defences/${defence._id}`,at:defence.submittedForEvaluationAt});
    let previous = [];
    for (const event of defence.history || []) {
      const wasOnBoard = previous.some(member => same(member.id, id)), onBoard = event.board.some(member => same(member.id, id));
      if (role === 'examiner' && wasOnBoard && !onBoard) emit(`boardRemoved:${event._id}`, { category: 'defence', title: 'Defence Board Assignment Removed', message: `Your board assignment for ${workspace.name} was removed.`, scope: 'personal', href: '/examiner/results', at: event.createdAt, actor: event.actor });
      if (canSee && event.type !== 'published' && (role !== 'examiner' || onBoard)) emit(`defence:${event._id}`, { category: 'defence', title: event.type === 'cancelled' ? 'Defence Cancelled' : event.type === 'rescheduled' ? 'Defence Schedule Updated' : 'Defence Scheduled', message: `${workspace.name}: view the defence time, venue and board details.`, scope: 'defence', defence: defence._id, workspace, href, at: event.createdAt, actor: event.actor });
      previous = event.board;
    }
    if (!canSee) continue;
    for (const event of defence.evaluation?.history || []) {
      if(event.type==='correct'&&['student','supervisor'].includes(role)&&owns(workspace))project(`resultUpdate:${event._id}`,workspace,{category:'result',title:'Result Updated',message:`${workspace.name}: your published result was updated. ${event.reason}`,href:`${href}#evaluation`,at:event.createdAt,actor:event.actor});
      if (event.type === 'assign' && role === 'examiner') emit(`evaluation:${event._id}`, { category: 'evaluation', title: 'Defence Rubric Selected', message: `${workspace.name}: the evaluation rubric is available.`, scope: 'defence', defence: defence._id, href: `${href}#evaluation`, at: event.createdAt, actor: event.actor });
      if (event.type === 'submit' && role === 'department') emit(`evaluation:${event._id}`, { category: 'evaluation', title: 'Board Evaluation Submitted', message: `${workspace.name}: an examiner submitted an evaluation for your review.`, scope: 'defence', defence: defence._id, href: `${href}#evaluation`, at: event.createdAt, actor: event.actor });
      if (event.type === 'reopen' && role === 'examiner' && same(event.examinerId, id)) emit(`evaluation:${event._id}`, { category: 'evaluation', title: 'Your Evaluation Was Reopened', message: `${workspace.name}: the coordinator requested another review of your evaluation.`, scope: 'defence', defence: defence._id, href: `${href}#evaluation`, at: event.createdAt, actor: event.actor });
    }
    if (defence.evaluation?.publication) { const result = defence.evaluation.publication; emit(`result:${defence._id}`, { category: 'result', title: 'Result Published', message: `${workspace.name}: the final result is published and the project is complete.`, scope: 'defence', defence: defence._id, workspace, href: `${href}#evaluation`, at: result.publishedAt, actor: result.publishedBy }); }
    const until = new Date(defence.startsAt).getTime() - now.getTime();
    if (defence.status === 'scheduled' && until >= 0 && until <= 86400000) emit(`reminder:defence:${defence._id}:${new Date(defence.startsAt).toISOString()}`, { category: 'reminder', title: 'Defence Starts Within 24 Hours', message: `${workspace.name}: check your defence time and venue.`, scope: 'defence', defence: defence._id, workspace, href, at: now, dynamic: true, force: true });
  }
  if(role==='supervisor')for(const notice of evaluationNotices)emit(`evaluationNotice:${viewer.department}:${notice.revision}`,{category:'evaluation',title:'Examiner Assignment Notice',message:notice.notice,scope:'personal',href:'/supervisor/evaluationAssignments#evaluationNotice',at:notice.publishedAt});
  if(['supervisor','examiner'].includes(role))for(const notice of resultNotices)emit(`resultNotice:${viewer.department}:${notice.revision}`,{category:'result',title:'Result Update Notice',message:notice.notice,scope:'personal',href:`/${role}/results#resultNotice`,at:notice.publishedAt});
  for (const notice of supervisorNotices) emit(`supervisorNotice:${viewer.department}:${notice.revision}`, {
    category:'supervision',title:'New Supervisor Choice Notice',message:`A new supervisor choice notice has been published. ${notice.notice}`,
    scope:'personal',href:role==='department'?'/department/manageSupervision#supervisorNotice':role==='student'?'/student/supervisor#supervisorNotice':`/${role}/supervisorNotice#supervisorNotice`,at:notice.publishedAt,
  });
  for (const notice of resourceNotices) emit(`resourceNotice:${viewer.department}:${notice.revision}`, {category:'resources',title:'New Resources Notice',message:`A new project resources notice has been published. ${notice.notice}`,scope:'personal',href:`/${role}/resources#resourceNotice`,at:notice.publishedAt});
  for (const notice of proposalNotices) emit(`proposalNotice:${viewer.department}:${notice.revision}`, {
    category: 'proposal', title: 'New Proposal Notice', message: `A new proposal notice has been published. ${notice.notice}`,
    scope: 'personal', href: role === 'student' ? '/student/proposal#proposalNotice' : role === 'department' ? '/department/proposals#proposalNotice' : `/${role}/proposalNotice#proposalNotice`, at: notice.publishedAt,
  });
  for (const notice of notices) emit(`defenceNotice:${notice._id}:${notice.revision}`, { category: 'defence', title: notice.revision ? 'Defence Notice Updated' : 'New Defence Notice', message: `Batch ${notice.batch} · ${notice.stream} · ${notice.venue}. View the published date and time.`, href: `/${role}/defences#notice-${notice._id}`, scope: 'personal', at: notice.updatedAt, dynamic: true, force: true, actor: { id: viewer.department } });
  for (const chat of chats) { const workspace = byId.get(String(chat._id)); if (!workspace || !owns(workspace) || isArchived(workspace)) continue; project(`chat:${chat._id}:${chat.seq}`, workspace, { category: 'chat', title: 'New Project Message', message: `${chat.message.senderName || 'A participant'} sent a message in ${workspace.name}.`, href: `/${role}/chat/${workspace._id}`, at: chat.message.createdAt, dynamic: true, force: true, actor: { id: chat.message.senderId } }); }
  return { events: [...events.values()], workspaceIds, defenceIds };
}
module.exports = { buildEvents, categories };
