const Notice=require('../models/defenceNotice');
const {fail}=require('./supervisionService');
const {validKey}=require('../utils/requestValidation');
const validId=value=>typeof value==='string'&&/^[a-f0-9]{24}$/i.test(value);
const view=item=>({id:String(item._id),batch:item.batch,stream:item.stream,startsAt:item.startsAt,venue:item.venue,revision:item.revision,createdAt:item.createdAt,updatedAt:item.updatedAt});
function fields(body){
 const values={};
 for(const [key,max]of[['batch',50],['stream',80],['venue',200]]){
  if(typeof body[key]!=='string'||!body[key].trim()||body[key].trim().length>max)fail(400,`Enter ${key} using 1–${max} characters.`);
  values[key]=body[key].trim();
 }
 if(typeof body.startsAt!=='string'||!Number.isFinite(new Date(body.startsAt).getTime())||new Date(body.startsAt).toISOString()!==body.startsAt||new Date(body.startsAt)<=new Date())fail(400,'Choose a future defence date and time.');
 values.startsAt=new Date(body.startsAt);return values;
}
async function list(req){
 const notices=await Notice.find({department:req.defenceDepartment,startsAt:{$gte:new Date()}}).sort({startsAt:1,_id:1}).lean();
 const ledger=req.defenceRole==='department'?await require('./supervisionService').readLedger(req.defenceDepartment):null;
 return {notices:notices.map(item=>({...view(item),assignmentCount:ledger?(ledger.defences||[]).filter(entry=>entry.status==='scheduled'&&String(entry.noticeId)===String(item._id)).length:undefined})),canManage:req.defenceRole==='department',serverNow:new Date()};
}
async function assertUnassigned(department,id){
 const ledger=await require('./supervisionService').readLedger(department);
 if((ledger.defences||[]).some(item=>item.status==='scheduled'&&String(item.noticeId)===String(id)))fail(409,'This notice is used by project evaluations. Reassign or cancel those project assignments before changing or removing it.');
}
async function save(req){
 if(req.defenceRole!=='department')fail(403,'Only your department can publish or edit a defence notice.');
 const body=req.body||{},department=req.defenceDepartment;
 if(req.params.id){
  if(!validId(req.params.id))fail(404,'Defence notice not found.');
  if(!Number.isSafeInteger(body.revision)||body.revision<0)fail(400,'Send the current notice revision.');
  await assertUnassigned(department,req.params.id);
  const saved=await Notice.findOneAndUpdate({_id:req.params.id,department,revision:body.revision},{$set:fields(body),$inc:{revision:1}},{returnDocument:'after',runValidators:true});
  if(!saved){if(!await Notice.exists({_id:req.params.id,department}))fail(404,'Defence notice not found.');fail(409,'This notice changed. Refresh before editing.');}
  return {notice:view(saved)};
 }
 if(!validKey(body.requestKey))fail(400,'Send a valid notice retry key.');
 await Notice.init();
 const previous=await Notice.findOne({department,requestKey:body.requestKey});
 if(previous){if(['batch','stream','venue'].some(key=>previous[key]!==body[key]?.trim())||previous.startsAt.toISOString()!==body.startsAt)fail(409,'This retry key belongs to another notice.');return {notice:view(previous)};}
 try{return {notice:view(await Notice.create({department,...fields(body),requestKey:body.requestKey}))};}
 catch(error){if(error.code!==11000)throw error;return save(req);}
}
async function remove(req){
 if(req.defenceRole!=='department')fail(403,'Only your department can remove a defence notice.');
 if(!validId(req.params.id))fail(404,'Defence notice not found.');
 if(!Number.isSafeInteger(req.body?.revision)||req.body.revision<0)fail(400,'Send the current notice revision.');
 await assertUnassigned(req.defenceDepartment,req.params.id);
 const deleted=await Notice.deleteOne({_id:req.params.id,department:req.defenceDepartment,revision:req.body.revision});
 if(!deleted.deletedCount){if(!await Notice.exists({_id:req.params.id,department:req.defenceDepartment}))fail(404,'Defence notice not found.');fail(409,'This notice changed. Refresh before removing.');}
 return {message:'Defence notice removed.'};
}
module.exports={list,save,remove};
