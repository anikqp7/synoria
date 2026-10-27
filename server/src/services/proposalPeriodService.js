const Department = require('../models/department');
const { randomUUID } = require('node:crypto');
const { fail } = require('./supervisionService');
function publicPeriod(account) {
 const p=account.proposalPeriod || {}, status=p.status || 'closed',deadline=p.deadline || null;
 const expired=!!deadline && new Date(deadline)<=new Date();
 return {status,notice:p.notice||'',deadline,revision:p.revision||0,updatedAt:p.updatedAt||null,accepting:status==='open'&&!expired,expired};
}
async function read(req) {
 const account=await Department.findById(req.defenceDepartment).select('proposalPeriod');
 if(!account)fail(404,'Department not found.');
 return {period:publicPeriod(account)};
}
async function withGate(department, operation) {
 const token=randomUUID();let account;
 for(let attempt=0;attempt<20;attempt++){
  account=await Department.findOneAndUpdate({_id:department,$or:[{'proposalGate.until':{$exists:false}},{'proposalGate.until':null},{'proposalGate.until':{$lte:new Date()}}]},{$set:{proposalGate:{token,until:new Date(Date.now()+60000)}}},{returnDocument:'after',timestamps:false});
  if(account)break;
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 if(!account)fail(409,'Another department action is in progress. Please try again.');
 try{return await operation(account);}finally{await Department.updateOne({_id:department,'proposalGate.token':token},{$unset:{proposalGate:1}},{timestamps:false});}
}
async function save(req) {
 if(req.defenceRole!=='department')fail(403,'Only your department can manage proposal periods.');
 const b=req.body||{};
 if(!['open','paused','closed'].includes(b.status)||typeof b.notice!=='string'||b.notice.length>2000||!Number.isSafeInteger(b.revision)||b.revision<0)fail(400,'Choose a proposal status and a notice up to 2000 characters.');
 const deadline=b.deadline?new Date(b.deadline):null;
 if(b.deadline!==null&&(typeof b.deadline!=='string'||!Number.isFinite(deadline?.getTime())))fail(400,'Choose a valid proposal deadline.');
 if(b.status==='open'&&(!deadline||deadline<=new Date()))fail(400,'Set a future deadline before opening proposals.');
 return withGate(req.defenceDepartment,async account=>{
  if((account.proposalPeriod?.revision||0)!==b.revision)fail(409,'The proposal period changed. Refresh and try again.');
  const previous=account.proposalPeriod, notice=b.notice.trim(), now=new Date();
  const changed=previous?.notice!==notice || previous?.status!==b.status || (previous?.deadline?.getTime()||null)!==(deadline?.getTime()||null);
  if(notice && changed){
   account.proposalNotices=(account.proposalNotices||[]).filter(event=>event.publishedAt>=new Date(now.getTime()-30*86400000));
   account.proposalNotices.push({revision:b.revision+1,notice,deadline,status:b.status,publishedAt:now});
  }
  account.proposalPeriod={status:b.status,notice,deadline,revision:b.revision+1,updatedAt:now};
  await account.save({timestamps:false});return {period:publicPeriod(account)};
 });
}
function guard(handler){return async(req,res)=>{
 try{return await withGate(req.student.department,async account=>{
  const period=publicPeriod(account);
  if(!period.accepting)fail(409,period.expired?'The proposal deadline has passed.':period.status==='paused'?'Proposal creation is paused by your department.':'Proposals are closed. Your department must open the proposal period.');
  return handler(req,res);
 });}catch(error){if(error.status)return res.status(error.status).json({message:error.message});throw error;}
};}
module.exports={read,save,guard,publicPeriod,withGate};
