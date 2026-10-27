const Workspace = require('../models/workspace');
const {fail} = require('./supervisionService');
// All enrollment and proposal writes run under the department gate. Claims and
// participant history commit in the workspace document; leaving/completion never clears them.
const same = (a,b) => String(a) === String(b);
const createdFilter = {$or:[{projectCreatedAt:{$ne:null}},{'proposalDraft.savedAt':{$ne:null}},{'proposalVersions.0':{$exists:true}}]};
function hasProject(workspace){return !!(workspace.projectCreatedAt||workspace.proposalDraft?.savedAt||workspace.proposalVersions?.length);}
function participants(workspace,extra=[]){
 const ids=[...(workspace.projectParticipants||[]),...(workspace.members||[]),...extra,...(workspace.proposalVersions||[]).flatMap(v=>(v.members||[]).map(m=>m.id)),workspace.leader].filter(Boolean);
 return [...new Map(ids.map(id=>[String(id._id||id),id._id||id])).values()];
}
async function existing(department,studentIds,except){
 return Workspace.findOne({department,...(except?{_id:{$ne:except}}:{}),$or:[{projectParticipants:{$in:studentIds}},{$and:[createdFilter,{$or:[{members:{$in:studentIds}},{leader:{$in:studentIds}},{'proposalVersions.members.id':{$in:studentIds}}]}]}]}).select('name isActive status').sort({createdAt:1,_id:1}).lean();
}
async function assertAvailable(department,studentIds,target){
 if(await existing(department,studentIds,target))fail(409,'A student can have only one project and proposal. This student already has a project with another team.');
}
async function selection(department,studentId){const project=await existing(department,[studentId]);return project?{projectId:String(project._id),projectName:project.name,canCreateTeam:false}:null;}
async function prepare(workspace){await assertAvailable(workspace.department,workspace.members,workspace._id);return {projectCreatedAt:workspace.projectCreatedAt||workspace.proposalDraft?.savedAt||workspace.proposalVersions?.[0]?.submittedAt||new Date(),projectParticipants:participants(workspace)};}
async function membership(workspace,nextMembers){
 if(!hasProject(workspace))return {};
 const original=await Workspace.findById(workspace._id).select('members');
 const added=nextMembers.filter(id=>!original.members.some(old=>same(old,id)));
 if(added.length)await assertAvailable(workspace.department,added,workspace._id);
 return {projectCreatedAt:workspace.projectCreatedAt||workspace.proposalDraft?.savedAt||workspace.proposalVersions?.[0]?.submittedAt||new Date(),projectParticipants:participants(workspace,[...original.members,...nextMembers])};
}
module.exports={hasProject,assertAvailable,selection,prepare,membership};
