const Department = require('../models/department');
const {fail} = require('./supervisionService');
const {withGate} = require('./proposalPeriodService');
function publicPeriod(account) {
 const p=account.resourcePeriod||{},status=p.status||'closed',deadline=p.deadline||null;
 const expired=!!deadline&&new Date(deadline)<=new Date();
 return {status,notice:p.notice||'',deadline,revision:p.revision||0,updatedAt:p.updatedAt||null,accepting:status==='open'&&!expired,expired};
}
function assertOpen(account) {
 const period=publicPeriod(account);
 if(!period.accepting)fail(409,period.expired?'The resource update deadline has passed.':period.status==='paused'?'Resource updates are paused by your department.':'Resource updates are closed. Your department must open the resource update period.');
}
async function read(req) {
 const account=await Department.findById(req.defenceDepartment).select('resourcePeriod');
 if(!account)fail(404,'Department not found.');return {period:publicPeriod(account)};
}
async function save(req) {
 if(req.defenceRole!=='department')fail(403,'Only your department can manage resource update periods.');
 const b=req.body||{};
 if(!['open','paused','closed'].includes(b.status)||typeof b.notice!=='string'||b.notice.length>2000||!Number.isSafeInteger(b.revision)||b.revision<0)fail(400,'Choose a resource update status and a notice up to 2000 characters.');
 const deadline=b.deadline?new Date(b.deadline):null;
 if(b.deadline!==null&&(typeof b.deadline!=='string'||!Number.isFinite(deadline?.getTime())))fail(400,'Choose a valid resource update deadline.');
 if(b.status==='open'&&(!deadline||deadline<=new Date()))fail(400,'Set a future deadline before opening resource updates.');
 return withGate(req.defenceDepartment,async account=>{
  if((account.resourcePeriod?.revision||0)!==b.revision)fail(409,'The resource update period changed. Refresh and try again.');
  const previous=account.resourcePeriod,notice=b.notice.trim(),now=new Date();
  const changed=previous?.notice!==notice||previous?.status!==b.status||(previous?.deadline?.getTime()||null)!==(deadline?.getTime()||null);
  if(notice&&changed){account.resourceNotices=(account.resourceNotices||[]).filter(event=>event.publishedAt>=new Date(now.getTime()-30*86400000));account.resourceNotices.push({revision:b.revision+1,notice,deadline,status:b.status,publishedAt:now});}
  account.resourcePeriod={status:b.status,notice,deadline,revision:b.revision+1,updatedAt:now};
  await account.save({timestamps:false});return {period:publicPeriod(account)};
 });
}
module.exports={read,save,publicPeriod,assertOpen};
