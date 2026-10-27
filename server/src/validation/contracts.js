const { z } = require('zod');
const { ROLE_VALUES } = require('../utils/teamRoles');
const object = shape => z.object(shape);
const text = (max, required = false) => z.string().max(max).refine(value => !required || !!value.trim(), 'This field is required.');
const id = z.string().regex(/^[a-f0-9]{24}$/i, 'Choose a valid record.');
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = revision.refine(value => value > 0, 'Must be greater than zero.');
const requestKey = z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/, 'Send a valid retry key.');
const email = text(254, true).refine(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), 'Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Use at most 72 bytes.');
const phone = text(30, true).refine(value => /^[+\d() .-]{7,30}$/.test(value.trim()) && value.replace(/\D/g, '').length >= 7, 'Enter a valid phone number with at least 7 digits.');
const date = z.string().max(40).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'Use a valid UTC ISO date and time.');
const httpUrl = max => text(max, true).refine(value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }, 'Enter a valid HTTP or HTTPS link without credentials.');
const workType = z.enum(['project', 'thesis', 'research']);
const role = z.enum(ROLE_VALUES);
const distinct = values => new Set(values.map(value => value.toLowerCase())).size === values.length;
const ids = (min, max) => z.array(id).min(min).max(max).refine(distinct, 'Choose different accounts.');
const marks = z.number().min(0).max(1000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Use at most two decimal places.');
const empty = z.strictObject({});
const pagination = z.string().regex(/^[1-9]\d{0,5}$/, 'Choose a valid page.').optional();
const optionalEnum = values => z.enum(['', ...values]).optional();
const period = object({ status: z.enum(['open', 'paused', 'closed']), notice: text(2000), deadline: date.nullable(), revision }).superRefine((value, ctx) => {
  if (value.status === 'open' && (!value.deadline || Date.parse(value.deadline) <= Date.now())) ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Choose a future deadline before opening this period.' });
});
const assignment = object({ supervisorId: id.nullable(), expectedSupervisorId: id.nullable(), reason: text(500).optional() }).superRefine((value, ctx) => {
  if (!value.supervisorId && value.expectedSupervisorId && !value.reason?.trim()) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Enter a cancellation note.' });
});
function member(kind, partial = false) {
  const interests = text(500).refine(value => { const tags = value.split(/[,;\n]/).map(tag => tag.trim()).filter(Boolean); return tags.length <= 10 && tags.every(tag => tag.length <= 50); }, 'Use up to 10 research interests, each at most 50 characters.');
  const fields = { name: text(120, true), email, phone, password, ...(kind === 'students' ? { studentId: text(50, true), batch: text(50).optional(), academicSession: text(50).optional() } : { designation: text(100).optional(), researchInterests: interests.optional() }) };
  if (!partial) return object(fields);
  return object({ ...Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()])), password: z.union([password, z.literal('')]).optional(), isActive: z.boolean().optional() }).refine(value => Object.keys(value).length > 0, 'Send at least one field to update.');
}
const resource = z.discriminatedUnion('action', [
  object({ action: z.literal('remove'), revision, itemId: z.uuid() }),
  ...['add', 'edit'].map(action => object({ action: z.literal(action), revision, itemId: z.uuid().optional(), kind: z.enum(['repository', 'link', 'file']), title: text(150, true), description: text(500), category: z.enum(['report', 'presentation', 'poster', 'dataset', 'pdf', 'other']).optional(), url: httpUrl(2048).optional(), name: text(180, true).optional(), data: z.string().min(1).max(7000000).regex(/^[A-Za-z0-9+/]*={0,2}$/).optional() })),
]).superRefine((value, ctx) => {
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (value.action !== 'add' && !value.itemId) issue('itemId', 'Choose a resource.');
  if (value.action === 'remove') return;
  if (value.kind !== 'file' && !value.url) issue('url', 'Enter a resource link.');
  if (value.kind === 'file' && !value.category) issue('category', 'Choose a file category.');
  if (value.kind === 'file' && value.action === 'add') {
    if (!value.name) issue('name', 'Choose a file.');
    const bytes = value.data && Buffer.from(value.data, 'base64');
    if (!bytes?.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== value.data) issue('data', 'Choose a valid file up to 5 MB.');
    else if (value.category === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') issue('data', 'Choose a valid PDF file.');
  }
});
const schedule = { startsAt: date, durationMinutes: z.number().int().min(15).max(480), venue: text(150), meetingLink: z.union([httpUrl(1000), z.literal('')]), examinerIds: ids(1, 10), proposalVersion: positive, requestKey };
const scoring = object({ requestKey, revision, scheduleRevision: revision, rubricId: id, scores: z.array(object({ criterionId: id, marks: marks.nullable(), comment: text(1000) })).max(20).refine(values => distinct(values.map(value => value.criterionId)), 'Score each criterion once.'), comment: text(2000) });
// Explicit body allowlists strip unknown fields before controllers run.
// Query contracts reject unknown keys; nested values are never coerced.
const routes = [];
function add(method, pattern, body = empty, query = empty) { routes.push({ method, pattern: new RegExp(`^${pattern}/?$`), body, query: query.strict ? query.strict() : query }); }
add('POST', '/register', object({ name: text(120, true), university: text(160, true), email, password, role: z.literal('department').optional() }));
add('POST', '/login', object({ email, password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Use at most 72 bytes.'), role: z.enum(['department', 'student', 'supervisor', 'examiner']).optional() }));
add('GET', '');
add('GET', '/me'); add('POST', '/logout');
for (const kind of ['supervisors', 'students', 'examiners']) {
  add('GET', `/${kind}`); add('POST', `/${kind}`, member(kind)); add('GET', `/${kind}/[^/]+`); add('PATCH', `/${kind}/[^/]+`, member(kind, true)); add('DELETE', `/${kind}/[^/]+`);
}
for (const kind of ['proposalPeriod', 'resourcePeriod', 'supervisorPeriod', 'evaluationPeriod', 'resultPeriod']) { add('GET', `/${kind}`); add('PUT', `/${kind}`, period); }
add('GET', '/supervisorLoads');
add('PATCH', '/supervisorLoads/[^/]+', z.union([z.strictObject({ maxLoad: z.number().int().min(0).max(1000) }), z.strictObject({ available: z.number().int().min(0).max(1000) })]));
add('GET', '/supervisorRequests');
add('PUT', '/supervisorRequests', object({ choices: ids(3, 3), revision }));
add('PUT', '/supervisorRequests/[^/]+/assignment', object({ supervisorId: id.nullable(), expectedSupervisorId: id.nullable(), revision, note: text(500).optional() }).superRefine((value, ctx) => { if (!value.supervisorId && !value.note?.trim()) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Enter a cancellation note.' }); }));
add('GET', '/proposals'); add('GET', '/proposals/[^/]+'); add('GET', '/proposals/[^/]+/assignment'); add('PUT', '/proposals/[^/]+/assignment', assignment);
add('GET', '/workspaces'); add('POST', '/workspaces', object({ name: text(120, true), workType: workType.optional(), role: role.optional() }));
add('GET', '/workspaces/teams', empty, object({ search: text(120).optional(), page: z.string().regex(/^[1-9]\d{0,4}$/).refine(value => Number(value) <= 10000).optional() }));
add('GET', '/workspaces/[^/]+'); add('PATCH', '/workspaces/[^/]+', object({ name: text(120, true), workType: workType.optional() }));
for (const action of ['members', 'invitations']) add('POST', `/workspaces/[^/]+/${action}`, object({ email, role: role.optional() }));
add('PATCH', '/workspaces/[^/]+/members/[^/]+', object({ role })); add('DELETE', '/workspaces/[^/]+/members/[^/]+');
add('POST', '/workspaces/[^/]+/joinRequests');
for (const action of ['invitations', 'joinRequests']) add('PATCH', `/workspaces/[^/]+/${action}/[^/]+`, object({ action: z.enum(['accept', 'decline', 'cancel']), role: role.optional() }));
add('GET', '/workspaces/[^/]+/proposal');
add('PATCH', '/workspaces/[^/]+/proposal', object({ revision, title: text(200), abstract: text(4000), researchArea: text(120), supervisorPreference: z.union([id, z.literal(''), z.null()]), workType: workType.optional() }));
add('POST', '/workspaces/[^/]+/proposal/submit', object({ revision }));
add('POST', '/workspaces/[^/]+/proposal/scopeChange', object({ revision, reason: text(1000, true) }));
add('GET', '/supervision'); add('GET', '/supervision/[^/]+');
add('POST', '/supervision/[^/]+/review', object({ version: positive, decision: z.enum(['approved', 'rejected', 'revisionRequested']), comment: text(2000).optional() }).superRefine((value, ctx) => { if (value.decision !== 'approved' && !value.comment?.trim()) ctx.addIssue({ code: 'custom', path: ['comment'], message: 'Enter a reason or revision instructions.' }); }));
const meetingFields = { title: text(150, true), agenda: text(1000), startsAt: date, durationMinutes: z.number().int().min(15).max(240), venue: text(200), meetingLink: z.union([httpUrl(2048), z.literal('')]) };
const meetingPlace = value => !!value.venue.trim() || !!value.meetingLink;
const meetingCreate = object({ ...meetingFields, requestKey }).refine(meetingPlace, { path: ['venue'], message: 'Enter a venue or meeting link.' });
const meetingUpdate = z.discriminatedUnion('action', [object({ action: z.literal('reschedule'), ...meetingFields, revision, requestKey, reason: text(500, true) }), object({ action: z.literal('summary'), summary: text(2000, true), decisions: text(2000), revision, requestKey }), object({ action: z.literal('cancel'), reason: text(500, true), revision, requestKey })]).refine(value => value.action !== 'reschedule' || meetingPlace(value), { path: ['venue'], message: 'Enter a venue or meeting link.' });
for (const kind of ['workspaces', 'supervision']) {
  add('GET', `/${kind}/[^/]+/chat/meetings`); add('POST', `/${kind}/[^/]+/chat/meetings`, meetingCreate); add('PATCH', `/${kind}/[^/]+/chat/meetings/[^/]+`, meetingUpdate);
  add('GET', `/${kind}/[^/]+/chat`, empty, object({ before: z.string().regex(/^[1-9]\d{0,14}$/).optional(), after: z.string().regex(/^\d{1,15}$/).optional(), timeline: z.literal('true').optional(), timelineBefore: z.string().max(768).refine(value => !!require('../utils/chatCursor').decode(value), 'Invalid timeline cursor.').optional(), timelineAfter: z.string().max(768).refine(value => !!require('../utils/chatCursor').decode(value), 'Invalid timeline cursor.').optional() }).refine(value => !(value.before !== undefined && value.after !== undefined) && !(value.timelineBefore && value.timelineAfter) && !(value.timeline && (value.before !== undefined || value.after !== undefined)) && !((value.timelineBefore || value.timelineAfter) && !value.timeline), 'Choose one chat cursor at a time.'));
  add('POST', `/${kind}/[^/]+/chat`, object({ text: text(2000, true), requestKey })); add('POST', `/${kind}/[^/]+/chat/read`, object({ upToSeq: revision }));
}
add('GET', '/chat'); add('GET', '/chat/unread');
add('GET', '/resources'); add('GET', '/resources/[^/]+'); add('POST', '/resources/[^/]+', resource); add('GET', '/resources/[^/]+/files/[^/]+');
add('GET', '/evaluationAssignments/[^/]+');
add('PUT', '/evaluationAssignments/[^/]+', object({ requestKey, noticeId: id, noticeRevision: revision, proposalVersion: positive, revision, expectedDefenceId: id.nullable(), examinerIds: ids(1, 1) }));
add('GET', '/evaluationProjects');
add('GET', '/defenceNotices');
const notice = { batch: text(50, true), stream: text(80, true), venue: text(200, true), startsAt: date };
add('POST', '/defenceNotices', object({ ...notice, requestKey })); add('PATCH', '/defenceNotices/[^/]+', object({ ...notice, revision })); add('DELETE', '/defenceNotices/[^/]+', object({ revision }));
add('GET', '/defences', empty, object({ search: text(200).optional(), status: optionalEnum(['scheduled', 'cancelled', 'published']), page: pagination, sort: z.literal('latestPublished').optional() }).refine(value => !value.sort || value.status === 'published', 'Sort published results only.'));
add('GET', '/defences/[^/]+');
add('PATCH', '/defences/[^/]+', object({ ...schedule, revision, reason: text(500, true) }).refine(value => !!value.venue.trim() || !!value.meetingLink, { path: ['venue'], message: 'Enter a venue or meeting link.' }));
add('POST', '/defences/[^/]+/cancel', object({ revision, requestKey, reason: text(500, true) }));
add('GET', '/defences/[^/]+/evaluation');
add('PUT', '/defences/[^/]+/evaluation/rubric', object({ revision, requestKey, rubricId: id }));
add('PUT', '/defences/[^/]+/evaluation/draft', scoring);
add('POST', '/defences/[^/]+/evaluation/submit', scoring.refine(value => value.scores.length > 0 && value.scores.every(score => score.marks !== null), { path: ['scores'], message: 'Complete every criterion.' }));
add('POST', '/defences/[^/]+/evaluation/publish', object({ revision, requestKey, confirmDefenceHeld: z.literal(true, { error: 'Confirm the defence and evaluation are complete.' }), note: text(2000) }));
add('POST', '/defences/[^/]+/evaluation/correct', object({ revision, requestKey, marks: marks.refine(value => value <= 100, 'Use marks from 0 to 100.'), reason: text(500, true) }));
add('GET', '/rubrics');
add('POST', '/rubrics', object({ revision, requestKey, name: text(120, true), description: text(1000), criteria: z.array(object({ title: text(100, true), description: text(500), maxMarks: z.number().int().min(1).max(1000), weight: z.number().int().min(1).max(100) })).min(1).max(20) }).superRefine((value, ctx) => { if (value.criteria.reduce((sum, item) => sum + item.weight, 0) !== 100) ctx.addIssue({ code: 'custom', path: ['criteria'], message: 'Weights must total exactly 100%.' }); if (!distinct(value.criteria.map(item => item.title.trim()))) ctx.addIssue({ code: 'custom', path: ['criteria'], message: 'Criterion titles must be distinct.' }); }));
add('GET', '/monitoring', empty, object({ search: text(200).optional(), status: optionalEnum(['draft', 'submitted', 'active', 'defenceScheduled', 'evaluated', 'archived']), workType: optionalEnum(['project', 'thesis', 'research']), risk: optionalEnum(['atRisk', 'onTrack', 'defenceReady']), supervisorId: z.union([id, z.literal(''), z.literal('unassigned')]).optional(), page: pagination }));
add('GET', '/monitoring/overview'); add('GET', '/monitoring/[^/]+');
add('GET', '/notifications', empty, object({ cursor: z.string().max(200).regex(/^[A-Za-z0-9_-]+$/).optional(), unread: z.enum(['true', 'false']).optional(), category: z.enum(require('../services/notificationEvents').categories).optional(), limit: z.string().regex(/^(?:[1-9]|[1-4]\d|50)$/).optional() }));
add('PATCH', '/notifications/[^/]+/read'); add('POST', '/notifications/readAll', object({ before: date }));
function contractFor(method, path) { return routes.find(route => route.method === method && route.pattern.test(path)); }
module.exports = { contractFor, routes, id, revision };
