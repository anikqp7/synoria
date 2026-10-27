const reviewService = require('../services/proposalReviewService');
const Student=require('../models/student');
const {existingRole}=require('../utils/teamRoles');
const Workspace = require('../models/workspace');
const service = require('../services/supervisionService');
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const protectedAction = action => async (req, res) => { try { await action(req, res); } catch (error) { if (error.status) return res.status(error.status).json({ message: error.message }); throw error; } };
async function submittedWorkspace(departmentId, id) {
  return validId(id) ? Workspace.findOne({ _id: id, department: departmentId, 'proposalVersions.0': { $exists: true } }) : null;
}
const listLoads = protectedAction(async (req, res) => res.json({ supervisors: await service.loads(req.session.departmentId) }));
const updateCapacity = protectedAction(async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ message: 'Supervisor not found.' });
  const keys = Object.keys(req.body || {});
  if (keys.length !== 1 || !['maxLoad', 'available'].includes(keys[0])) return res.status(400).json({ message: 'Send either available places or maximum load.' });
  const mode = keys[0];
  await service.setCapacity(req.session.departmentId, req.params.id, req.body[mode], mode);
  res.json({ message: 'Supervisor capacity updated.' });
});
const getAssignment = protectedAction(async (req, res) => {
  const workspace = await submittedWorkspace(req.session.departmentId, req.params.id);
  if (!workspace) return res.status(404).json({ message: 'Submitted proposal not found.' });
  res.json(await service.context(req.session.departmentId, workspace.id));
});
const assignSupervisor = protectedAction(async (req, res) => {
  const workspace = await submittedWorkspace(req.session.departmentId, req.params.id);
  if (!workspace) return res.status(404).json({ message: 'Submitted proposal not found.' });
  if (!workspace.isActive || workspace.status === 'archived') return res.status(409).json({ message: 'Archived projects cannot be reassigned.' });
  const { supervisorId, expectedSupervisorId, reason = '' } = req.body || {};
  if ((supervisorId !== null && !validId(supervisorId)) || (expectedSupervisorId !== null && !validId(expectedSupervisorId)) || typeof reason !== 'string' || reason.trim().length > 500) return res.status(400).json({ message: 'Choose a valid supervisor and enter a reason with up to 500 characters.' });
  await service.assign(req.session.departmentId, workspace, supervisorId, expectedSupervisorId, reason.trim(), req.session.departmentId);
  res.json({ message: supervisorId ? 'Supervisor assigned.' : 'Supervisor assignment removed.' });
});
const listAssigned = protectedAction(async (req, res) => {
  const ledger = await service.readLedger(req.supervisor.department);
  const ids = ledger.assignments.filter(item => String(item.supervisor) === req.supervisor.id).map(item => item.workspace);
  const workspaces = await Workspace.find({ _id: { $in: ids }, department: req.supervisor.department, isActive: true, status: { $ne: 'archived' } }).sort({ updatedAt: -1 });
  res.json({ proposals: workspaces.map(item => { const latest = item.proposalVersions.at(-1); return { workspaceId: item.id, workspaceName: item.name, workType: item.workType, status: reviewService.workflow(item, ledger).status, proposalStatus: reviewService.workflow(item, ledger).proposalStatus, title: latest?.title || item.name, researchArea: latest?.researchArea || '', submittedAt: latest?.submittedAt || null, memberCount: item.members.length, supervisorPreference: latest?.supervisorPreference || null }; }) });
});
const getAssigned = protectedAction(async (req, res) => {
  const ledger = await service.readLedger(req.supervisor.department);
  if (!ledger.assignments.some(item => String(item.workspace) === req.params.id && String(item.supervisor) === req.supervisor.id)) return res.status(404).json({ message: 'Assigned project not found.' });
  const workspace = validId(req.params.id) && await Workspace.findOne({_id:req.params.id,department:req.supervisor.department});
  if (!workspace || !workspace.isActive || workspace.status === 'archived') return res.status(404).json({ message: 'Assigned project not found.' });
  const currentMembers=await Student.find({_id:{$in:workspace.members},department:req.supervisor.department}).select('name studentId');
  res.json({ proposal: { members:currentMembers.map(member=>({id:member.id,name:member.name,studentId:member.studentId,isLeader:String(workspace.leader)===member.id,role:existingRole(workspace.memberRoles?.find(r=>String(r.student)===member.id)?.role,String(workspace.leader)===member.id?'Team Lead':'Member')})),workspaceId: workspace.id, workspaceName: workspace.name, workType: workspace.workType, ...reviewService.workflow(workspace, ledger), submission: workspace.proposalVersions.at(-1), assignment: await service.currentAssignment(req.supervisor.department, workspace.id) } });
});
module.exports = { listLoads, updateCapacity, getAssignment, assignSupervisor, listAssigned, getAssigned };
