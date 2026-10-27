const { Types } = require('mongoose');
const { createHash } = require('node:crypto');
const Workspace = require('../models/workspace');
const Supervisor = require('../models/supervisor');
const supervision = require('./supervisionService');
const same = (a, b) => String(a) === String(b);
const access = req => require('./chatService').access(req);
const isManager = ({ role, account, workspace }) => role === 'supervisor' || same(workspace.leader, account._id);
function view(meeting) {
  const { history, ...record } = meeting;
  return { ...record, id: String(meeting._id), workspace: String(meeting.workspace), history: history.map(({ requestKey, fingerprint, ...event }) => event) };
}
async function read(req) {
  const ctx = await access(req), assignment = ctx.ledger.assignments.find(item => same(item.workspace, ctx.workspace._id));
  const supervisor = assignment && await Supervisor.findOne({ _id: assignment.supervisor, department: ctx.workspace.department, isActive: { $ne: false }, deletedAt: null }).select('name');
  return { meetings: (ctx.ledger.chatMeetings || []).filter(meeting => same(meeting.workspace, ctx.workspace._id)).map(view), canManage: isManager(ctx) && ctx.enabled,
    canSchedule: isManager(ctx) && ctx.enabled && !!supervisor, supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null, serverNow: new Date() };
}
async function mutate(req) {
  const initial = await access(req);
  return require('./proposalPeriodService').withGate(initial.workspace.department, async () => {
    const ctx = await access(req), body = req.body, role = ctx.role, account = ctx.account;
    if (!isManager(ctx)) supervision.fail(403, 'Only the team leader and assigned supervisor can manage meetings.');
    const actor = { id: account._id, name: account.name, role }, fingerprint = createHash('sha256').update(JSON.stringify({ body, meetingId: req.params.meetingId || null, actor: account.id })).digest('hex');
    await supervision.change(ctx.workspace.department, async ledger => {
      if (role === 'supervisor' && !ledger.assignments.some(item => same(item.workspace, ctx.workspace._id) && same(item.supervisor, account._id))) supervision.fail(404, 'Project chat not found.');
      const workspace = await Workspace.findOne({ _id: ctx.workspace._id, department: ctx.workspace.department, ...(role === 'student' ? { members: account._id, leader: account._id } : {}) });
      if (!workspace) supervision.fail(403, 'Your team permissions changed. Refresh the conversation.');
      ledger.chatMeetings ||= [];
      const repeated = ledger.chatMeetings.flatMap(item => item.history).find(event => event.requestKey === body.requestKey);
      if (repeated) { if (repeated.fingerprint !== fingerprint) supervision.fail(409, 'This retry key belongs to another meeting change.'); return; }
      if (!workspace.isActive || workspace.status === 'archived' || require('../utils/evaluationState').publishedFor(ledger, workspace._id)) supervision.fail(409, 'Meetings for completed projects are read-only.');
      let meeting = req.params.meetingId && ledger.chatMeetings.find(item => same(item._id, req.params.meetingId) && same(item.workspace, workspace._id));
      if (req.params.meetingId && !meeting) supervision.fail(404, 'Meeting not found in this conversation.');
      if (meeting && meeting.revision !== body.revision) supervision.fail(409, 'This meeting changed. Refresh before saving.');
      const now = new Date(), type = !meeting ? 'scheduled' : body.action === 'summary' ? 'summary' : body.action === 'cancel' ? 'cancelled' : 'rescheduled';
      if (meeting?.status === 'cancelled') supervision.fail(409, 'Cancelled meetings are read-only. Schedule a new meeting instead.');
      if (type === 'scheduled' || type === 'rescheduled') {
        if (meeting?.status === 'completed') supervision.fail(409, 'This meeting already has a summary. Its schedule is preserved.');
        const startsAt = new Date(body.startsAt), endsAt = new Date(startsAt.getTime() + body.durationMinutes * 60000);
        if (startsAt <= now) supervision.fail(400, 'Choose a future meeting date and time.');
        const assignment = ledger.assignments.find(item => same(item.workspace, workspace._id));
        const supervisor = assignment && await Supervisor.findOne({ _id: assignment.supervisor, department: workspace.department, isActive: { $ne: false }, deletedAt: null }).select('name');
        if (!supervisor) supervision.fail(409, 'An active supervisor must be assigned before scheduling a meeting.');
        if (ledger.chatMeetings.some(item => !same(item._id, meeting?._id) && item.status === 'scheduled' && (same(item.workspace, workspace._id) || same(item.supervisorId, supervisor._id)) && new Date(item.startsAt) < endsAt && new Date(new Date(item.startsAt).getTime() + item.durationMinutes * 60000) > startsAt)) supervision.fail(409, 'This team or supervisor already has a meeting during that time.');
        const fields = { title: body.title.trim(), agenda: body.agenda.trim(), startsAt, durationMinutes: body.durationMinutes, venue: body.venue.trim(), meetingLink: body.meetingLink.trim(), supervisorId: supervisor._id, supervisorName: supervisor.name };
        if (!meeting) { meeting = { _id: new Types.ObjectId(), workspace: workspace._id, ...fields, status: 'scheduled', revision: 0, summary: '', decisions: '', history: [], createdAt: now, updatedAt: now }; ledger.chatMeetings.push(meeting); }
        else Object.assign(meeting, fields);
      } else if (type === 'summary') {
        if (new Date(meeting.startsAt) > now) supervision.fail(409, 'Add a meeting summary after the meeting has started.');
        meeting.summary = body.summary.trim(); meeting.decisions = body.decisions.trim(); meeting.status = 'completed';
      } else {
        if (meeting.status === 'completed') supervision.fail(409, 'Completed meetings cannot be cancelled. Update their summary instead.');
        meeting.status = 'cancelled';
      }
      meeting.revision++; meeting.updatedAt = now;
      meeting.history.push({ _id: new Types.ObjectId(), type, actor, createdAt: now, requestKey: body.requestKey, fingerprint,
        title: meeting.title, agenda: meeting.agenda, startsAt: meeting.startsAt, durationMinutes: meeting.durationMinutes, venue: meeting.venue, meetingLink: meeting.meetingLink,
        summary: type === 'summary' ? meeting.summary : '', decisions: type === 'summary' ? meeting.decisions : '', reason: body.reason || '' });
    });
    return read(req);
  });
}
module.exports = { read, mutate };
