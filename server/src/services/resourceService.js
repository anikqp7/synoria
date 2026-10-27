const Workspace=require('../models/workspace');
const File=require('../models/resourceFile');
const supervision=require('./supervisionService');
const {randomUUID}=require('node:crypto');
const periodService=require('./resourcePeriodService');
const Department=require('../models/department');
const same=(a,b)=>String(a)===String(b);
const locked=(ledger,id)=>(ledger.defences||[]).some(d=>same(d.workspace,id)&&(d.board?.length||d.history?.some(h=>h.board?.length)));
async function allowed(req){
 const ledger=await supervision.readLedger(req.defenceDepartment),role=req.defenceRole,account=req.defenceAccount;
 const filter={department:req.defenceDepartment};
 if(role==='student')filter.members=account._id;
 if(role==='supervisor')filter._id={$in:ledger.assignments.filter(a=>same(a.supervisor,account._id)).map(a=>a.workspace)};
 if(role==='examiner')filter._id={$in:(ledger.defences||[]).filter(d=>d.status!=='cancelled'&&d.board.some(b=>same(b.id,account._id))).map(d=>d.workspace)};
 const projects=await Workspace.find(filter).select('name workType members isActive').sort({createdAt:-1}).lean();
 return {ledger,projects};
}
async function list(req){const {projects}=await allowed(req);return {projects:projects.map(p=>({id:String(p._id),name:p.name,workType:p.workType}))};}
async function context(req){const state=await allowed(req);const project=state.projects.find(p=>same(p._id,req.params.id));if(!project)supervision.fail(404,'Project not found.');return {...state,project};}
function publicData(req,project,ledger,period){const entry=(ledger.resources||[]).find(e=>same(e.workspace,project._id));return {project:{id:String(project._id),name:project.name},locked:locked(ledger,project._id),canDelete:req.defenceRole==='department'&&!locked(ledger,project._id),canEditByRole:req.defenceRole==='student'&&project.isActive&&!locked(ledger,project._id),canEdit:req.defenceRole==='student'&&project.isActive&&!locked(ledger,project._id)&&period.accepting,revision:entry?.revision||0,items:entry?.items||[]};}
async function read(req){const {project,ledger}=await context(req);return publicData(req,project,ledger,periodService.publicPeriod(await Department.findById(req.defenceDepartment).select('resourcePeriod')));}
function url(value){if(typeof value!=='string'||value.length>2048)supervision.fail(400,'Enter a link up to 2048 characters.');try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error();return u.href;}catch{supervision.fail(400,'Enter a valid HTTP or HTTPS link.');}}
async function save(req,periodAccount){
 const {project}=await context(req);if(req.defenceRole!=='student'&&!(req.defenceRole==='department'&&req.body?.action==='remove'))supervision.fail(403,'Only project team members can edit resources.');
 const b=req.body||{};if(!Number.isSafeInteger(b.revision))supervision.fail(400,'Refresh resources before saving.');
 let added,file;
 if(b.action==='add'||b.action==='edit'){
  if(typeof b.title!=='string'||!b.title.trim()||b.title.length>150||typeof b.description!=='string'||b.description.length>500||!['repository','link','file'].includes(b.kind))supervision.fail(400,'Provide a title, resource type and a short description.');
  if(b.kind==='file'&&!['report','presentation','poster','dataset','pdf','other'].includes(b.category))supervision.fail(400,'Choose a file category.');
  added={category:b.kind==='file'?b.category:undefined,id:randomUUID(),kind:b.kind,title:b.title.trim(),description:b.description.trim(),createdAt:new Date(),addedBy:req.student.name};
  if(b.kind==='file'&&b.action==='add'){
   if(typeof b.data!=='string'||!b.data.length||b.data.length>7000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.data)||typeof b.name!=='string'||b.name.length>180)supervision.fail(400,'Choose a file up to 5 MB.');
   const data=Buffer.from(b.data,'base64');if(!data.length||data.length>5*1024*1024)supervision.fail(400,'Choose a file up to 5 MB.');
   const isPdf=data.subarray(0,5).toString()==='%PDF-';
   if(b.category==='pdf'&&!isPdf)supervision.fail(400,'Choose a valid PDF file.');
   added.isPdf=isPdf;
   file=await File.create({workspace:project._id,name:b.name,data});added.fileId=String(file._id);added.name=b.name;added.size=data.length;
  }else if(b.kind!=='file') added.url=url(b.url);
 }else if(b.action!=='remove')supervision.fail(400,'Invalid resource action.');
 try{await supervision.change(req.defenceDepartment,async ledger=>{
  if(req.defenceRole==='student')periodService.assertOpen(periodAccount);
  if(locked(ledger,project._id))supervision.fail(409,'Resources are locked because examiners have been assigned.');
  if(req.defenceRole==='student'&&!await Workspace.exists({_id:project._id,members:req.student._id,isActive:true}))supervision.fail(403,'Your team membership changed.');
  ledger.resources||=[];let entry=ledger.resources.find(e=>same(e.workspace,project._id));
  if((entry?.revision||0)!==b.revision)supervision.fail(409,'Resources changed. Refresh and try again.');
  if(!entry){entry={workspace:project._id,revision:0,items:[]};ledger.resources.push(entry);}
  const changedTitle=added?.title||entry.items.find(item=>item.id===b.itemId)?.title;
  if(b.action==='edit'){const item=entry.items.find(i=>i.id===b.itemId);if(!item||item.kind!==b.kind)supervision.fail(400,'Resource not found.');if(b.category==='pdf'&&!item.isPdf){const stored=await File.findById(item.fileId);if(!stored||stored.data.subarray(0,5).toString()!=='%PDF-')supervision.fail(400,'This file is not a PDF.');item.isPdf=true;}Object.assign(item,{title:added.title,description:added.description,category:added.category,...(added.url?{url:added.url}:{})});}
  else if(added){if(entry.items.length>=30)supervision.fail(400,'A project can contain up to 30 resources.');entry.items.push(added);}
  else {if(!entry.items.some(i=>i.id===b.itemId))supervision.fail(404,'Resource not found.');entry.items=entry.items.filter(i=>i.id!==b.itemId);}
  entry.revision++;
  const assignment=ledger.assignments.find(item=>same(item.workspace,project._id));
  if(req.defenceRole==='student'&&assignment){
   const now=new Date();entry.events=(entry.events||[]).filter(event=>new Date(event.createdAt)>=new Date(now.getTime()-30*86400000));
   entry.events.push({id:randomUUID(),revision:entry.revision,supervisorId:String(assignment.supervisor),action:b.action,title:changedTitle,actor:{id:req.student.id,name:req.student.name},createdAt:now});
  }
 });}catch(error){if(file)await File.deleteOne({_id:file._id});throw error;}
 return read(req);
}
async function download(req){const {ledger,project}=await context(req);const item=(ledger.resources||[]).find(e=>same(e.workspace,project._id))?.items.find(i=>i.id===req.params.itemId&&i.kind==='file');if(!item)supervision.fail(404,'File not found.');const file=await File.findOne({_id:item.fileId,workspace:project._id});if(!file)supervision.fail(404,'File not found.');return {name:file.name,mimeType:file.data.subarray(0,5).toString()==='%PDF-'?'application/pdf':'application/octet-stream',data:file.data.toString('base64')};}
module.exports={list,read,download,save:async req=>{if(req.defenceRole!=='student'&&!(req.defenceRole==='department'&&req.body?.action==='remove'))supervision.fail(403,'Only project team members can edit resources.');return require('./proposalPeriodService').withGate(req.defenceDepartment,account=>{if(req.defenceRole==='student')periodService.assertOpen(account);return save(req,account);});}};
