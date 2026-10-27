const projectLimit=require('../services/projectLimitService');
const reviewService = require('../services/proposalReviewService');
const Workspace = require('../models/workspace');
const Supervisor = require('../models/supervisor');
const supervision = require('../services/supervisionService');
const Student = require('../models/student');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const supervisorView = account => account && ({ id: account.id, name: account.name, email: account.email, designation: account.designation, isActive: account.isActive !== false && !account.deletedAt });
const missing = res => res.status(404).json({ message: 'Proposal workspace not found.' });
const stale = res => res.status(409).json({ message: 'The proposal or team changed. Reload the page before continuing.' });
async function ownWorkspace(req) {
  return validId(req.params.id) ? Workspace.findOne({ _id: req.params.id, department: req.student.department, members: req.student._id }) : null;
}
const revisionFilter = revision => revision === 0 ? { $or: [{ proposalRevision: 0 }, { proposalRevision: { $exists: false } }] } : { proposalRevision: revision };
function revisionMatches(req, workspace) {
  return Number.isSafeInteger(req.body?.revision) && req.body.revision === (workspace.proposalRevision || 0);
}
function validateDraft(body) {
  const fields = {};
  for (const [key, max] of [['title', 200], ['abstract', 4000], ['researchArea', 120]]) {
    if (typeof body?.[key] !== 'string' || body[key].trim().length > max) return { error: `Enter ${key === 'researchArea' ? 'a research area' : `a ${key}`} with up to ${max} characters.` };
    fields[key] = body[key].trim();
  }
  const preference = body.supervisorPreference;
  if (preference !== '' && preference !== null && !validId(preference)) return { error: 'Choose a valid supervisor preference.' };
  fields.supervisorPreference = preference || null;
  return { fields };
}
async function getProposal(req, res) {
  const workspace = await ownWorkspace(req);
  if (!workspace) return missing(res);
  const workflow = await reviewService.state(workspace);
  const period = require('../services/proposalPeriodService').publicPeriod(await require('../models/department').findById(req.student.department).select('proposalPeriod'));
  const canEditByRole = String(workspace.leader) === req.student.id && (workspace.status === 'draft' || workflow.canRevise) && workspace.isActive && workspace.status !== 'archived';
  const draft = workspace.proposalDraft?.toObject() || { title: '', abstract: '', researchArea: '', supervisorPreference: null };
  const rankedPreference = workspace.supervisorRequest?.choices?.[0]?.supervisor;
  if(rankedPreference)draft.supervisorPreference = rankedPreference;
  const [options, selected, members] = await Promise.all([
    Supervisor.find({ department: req.student.department, isActive: { $ne: false }, deletedAt: null }).sort({ name: 1 }),
    draft.supervisorPreference ? Supervisor.findOne({ _id: draft.supervisorPreference, department: req.student.department }) : null,
    Student.find({ _id: { $in: workspace.members }, department: req.student.department }),
  ]);
  res.json({ proposal: {
    workspaceId: workspace.id, workspaceName: workspace.name, workType: workspace.workType, ...workflow,
    isLeader: String(workspace.leader) === req.student.id, canEditByRole, canEdit: canEditByRole && period.accepting,
    assignment: await supervision.currentAssignment(req.student.department, workspace.id),
    rankedSupervisorChoices: !!rankedPreference, revision: workspace.proposalRevision || 0, draft, selectedSupervisor: supervisorView(selected),
    submission: workspace.proposalVersions.at(-1) || null,
    members: members.map(account => ({ id: account.id, name: account.name, studentId: account.studentId, isLeader: account.id === String(workspace.leader), isActive: account.isActive !== false && !account.deletedAt })),
    supervisors: options.map(supervisorView), pendingInvitations: workspace.invitations.filter(invite => invite.status === 'pending').length,
  } });
}
async function saveDraft(req, res) {
  const workspace = await ownWorkspace(req);
  if (!workspace) return missing(res);
  if (String(workspace.leader) !== req.student.id) return res.status(403).json({ message: 'Only the team leader can edit the proposal.' });
  const workflow = await reviewService.state(workspace);
  if (!(workspace.status === 'draft' || workflow.canRevise) || !workspace.isActive) return res.status(409).json({ message: 'This proposal is locked for editing.' });
  if (!revisionMatches(req, workspace)) return stale(res);
  if(req.body?.workType!==undefined){
    if(!['project','thesis','research'].includes(req.body.workType))return res.status(400).json({message:'Choose Project, Thesis or Research.'});
    if(workspace.proposalVersions.length && req.body.workType!==workspace.workType)return res.status(409).json({message:'The work type cannot change after the first proposal submission.'});
  }
  const { fields, error } = validateDraft(req.body);
  if (error) return res.status(400).json({ message: error });
  if(workspace.supervisorRequest?.choices?.length)fields.supervisorPreference=workspace.supervisorRequest.choices[0].supervisor;
  if (fields.supervisorPreference && !await Supervisor.exists({ _id: fields.supervisorPreference, department: req.student.department, isActive: { $ne: false }, deletedAt: null })) return res.status(400).json({ message: 'Choose an active supervisor from your department.' });
  const projectFields=await projectLimit.prepare(workspace);
  const updated = await Workspace.findOneAndUpdate({ _id: workspace._id, leader: req.student._id, status: workspace.status, isActive: true, ...revisionFilter(req.body.revision) }, { $set: { ...projectFields, ...(req.body?.workType?{workType:req.body.workType}:{}), proposalDraft: { ...fields, savedAt: new Date() } }, $inc: { proposalRevision: 1, __v: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!updated) return stale(res);
  res.json({ message: 'Proposal draft saved.', revision: updated.proposalRevision });
}
async function submitProposal(req, res) {
  const workspace = await ownWorkspace(req);
  if (!workspace) return missing(res);
  if (String(workspace.leader) !== req.student.id) return res.status(403).json({ message: 'Only the team leader can submit the proposal.' });
  const workflow = await reviewService.state(workspace);
  if (!(workspace.status === 'draft' || workflow.canRevise) || !workspace.isActive) return res.status(409).json({ message: 'This proposal has already been submitted or is no longer editable.' });
  if (!revisionMatches(req, workspace)) return stale(res);
  const draft = workspace.proposalDraft;
  if(workspace.supervisorRequest?.choices?.length)draft.supervisorPreference=workspace.supervisorRequest.choices[0].supervisor;
  if (!draft?.title?.trim() || !draft.abstract?.trim() || !draft.researchArea?.trim() || !draft.supervisorPreference) return res.status(400).json({ message: 'Save a title, abstract, research area and supervisor preference before submitting.' });
  if (workspace.invitations.some(invite => invite.status === 'pending')) return res.status(409).json({ message: 'Resolve or cancel pending team invitations before submitting.' });
  const [supervisor, members] = await Promise.all([
    Supervisor.findOne({ _id: draft.supervisorPreference, department: req.student.department, isActive: { $ne: false }, deletedAt: null }),
    Student.find({ _id: { $in: workspace.members }, department: req.student.department, isActive: { $ne: false }, deletedAt: null }),
  ]);
  if (!supervisor) return res.status(400).json({ message: 'Your preferred supervisor is unavailable. Update the preference before submitting.' });
  if (members.length !== workspace.members.length) return res.status(409).json({ message: 'Some team accounts are inactive. Update the draft team before submitting.' });
  const projectFields=await projectLimit.prepare(workspace);
  const submission = {
    version: workspace.proposalVersions.length + 1, title: draft.title, abstract: draft.abstract, researchArea: draft.researchArea,
    supervisorPreference: { id: supervisor._id, name: supervisor.name, email: supervisor.email, designation: supervisor.designation },
    members: members.map(account => ({ id: account._id, name: account.name, email: account.email, studentId: account.studentId })),
    submittedBy: req.student._id, submittedAt: new Date(),
  };
  const updated = await Workspace.findOneAndUpdate({ _id: workspace._id, leader: req.student._id, status: workspace.status, isActive: true, ...revisionFilter(req.body.revision), __v: workspace.__v, [`proposalVersions.${workspace.proposalVersions.length}`]: { $exists: false } }, { $set: { ...projectFields, status: workflow.approvedScope ? 'active' : 'submitted' }, $push: { proposalVersions: submission }, $inc: { proposalRevision: 1, __v: 1 } }, { returnDocument: 'after', runValidators: true });
  if (!updated) return stale(res);
  res.json({ message: 'Proposal submitted to your coordinator.', submission: updated.proposalVersions.at(-1) });
}
async function listSubmitted(req, res) {
  const workspaces = await Workspace.find({ department: req.session.departmentId, 'proposalVersions.0': { $exists: true } }).sort({ 'proposalVersions.submittedAt': -1 }).select('name workType status department leader proposalVersions');
  const ledger = await supervision.readLedger(req.session.departmentId);
  res.json({ proposals: workspaces.map(item => { const latest = item.proposalVersions.at(-1); return { workspaceId: item.id, workspaceName: item.name, workType: item.workType, status: reviewService.workflow(item, ledger).status, proposalStatus: reviewService.workflow(item, ledger).proposalStatus, title: latest.title, researchArea: latest.researchArea, submittedAt: latest.submittedAt, memberCount: latest.members.length, supervisorPreference: latest.supervisorPreference }; }) });
}
async function getSubmitted(req, res) {
  const workspace = validId(req.params.id) && await Workspace.findOne({ _id: req.params.id, department: req.session.departmentId, 'proposalVersions.0': { $exists: true } });
  if (!workspace) return missing(res);
  res.json({ proposal: { workspaceId: workspace.id, workspaceName: workspace.name, workType: workspace.workType, ...await reviewService.state(workspace), submission: workspace.proposalVersions.at(-1), assignment: await supervision.currentAssignment(req.session.departmentId, workspace.id) } });
}
const {guard}=require('../services/proposalPeriodService');
module.exports = { getProposal, saveDraft:guard(saveDraft), submitProposal:guard(submitProposal), listSubmitted, getSubmitted };
