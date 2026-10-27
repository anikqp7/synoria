const {test}=require('node:test');const assert=require('node:assert/strict');const{once}=require('node:events');const{randomBytes,randomUUID}=require('node:crypto');const mongoose=require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('assigned supervisors submit projects during department periods with shared notices and locked evaluations',{timeout:90000},async()=>{
 process.env.SESSION_SECRET=randomBytes(48).toString('hex');let app,server;
 try{
  await mongoose.connect(process.env.MONGODB_URI,{dbName:`synoria_assignment_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});
  const manifest=await require('../src/services/demoSeedService').seedDemo({password:'ExaminerAssignment!2026'});
  const Ledger=require('../src/models/supervisionLedger'),Examiner=require('../src/models/examiner'),Notice=require('../src/models/defenceNotice');
  const ledger=await Ledger.findOne();await Ledger.updateOne({_id:ledger._id},{$set:{rubricVersions:[]}});
  const examiners=await Examiner.find().sort({email:1});
  app=require('../src');server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
  const req=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  const json=async(path,cookie)=>{const response=await req(path,cookie);assert.equal(response.status,200,await response.clone().text());return response.json();};
  const login=async(email,role)=>{const r=await req('login',null,{email,role,password:'ExaminerAssignment!2026'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const admin=await login(manifest.accounts.coordinator,'department'),student=await login(manifest.accounts.students[4],'student'),supervisor=await login(manifest.accounts.supervisors[1],'supervisor'),examiner=await login(manifest.accounts.examiners[0],'examiner'),examiner2=await login(manifest.accounts.examiners[1],'examiner');
  const ready=manifest.projects.find(item=>item.stage==='ready'),active=manifest.projects.find(item=>item.stage==='active'),draft=manifest.projects.find(item=>item.stage==='draft');
  await req('evaluationPeriod',admin,{status:'open',notice:'Supervisors, submit projects for evaluation.',deadline:new Date(Date.now()+86400000).toISOString(),revision:0},'PUT');
  const path=`evaluationAssignments/${ready.id}`,options=await json(path,supervisor),notice=options.notices[0];assert.equal(options.current,null);assert.equal(options.canAssign,true);assert.equal(options.notices.length,1);
  const fields={requestKey:randomUUID(),proposalVersion:1,noticeId:notice.id,noticeRevision:notice.revision,examinerIds:[examiners[0].id],expectedDefenceId:null,revision:0,startsAt:'2099-01-01T00:00:00.000Z',venue:'CLIENT_SPOOFED_VENUE'};
  assert.equal((await req(path)).status,401);
  for(const cookie of[student,admin,examiner]){assert.equal((await req(path,cookie)).status,403);assert.equal((await req(path,cookie,fields,'PUT')).status,403);}
  for(const changes of[{examinerIds:[]},{examinerIds:[examiners[0].id,examiners[0].id]},{noticeRevision:999},{noticeId:new mongoose.Types.ObjectId().toString()},{proposalVersion:2}])assert.ok([400,409].includes((await req(path,supervisor,{...fields,...changes,requestKey:randomUUID()},'PUT')).status));
  assert.equal((await req(`evaluationAssignments/${draft.id}`,supervisor,fields,'PUT')).status,404);
  const race=await Promise.all([req(path,supervisor,fields,'PUT'),req(path,supervisor,fields,'PUT')]);assert.deepEqual(race.map(r=>r.status),[200,200]);
  let assignment=(await race[0].json()).current;assert.equal(assignment.startsAt,notice.startsAt);assert.equal(assignment.venue,notice.venue);assert.equal(assignment.noticeId,notice.id);assert.equal(assignment.batch,notice.batch);assert.equal(assignment.rubricName,'Default Evaluation Rubric');
  assert.equal((await Ledger.findOne()).defences.find(item=>String(item._id)===assignment.id).history.length,1);
  assert.equal((await req(path,supervisor,{...fields,examinerIds:[examiners[1].id]},'PUT')).status,409);
  const projects=await json('evaluationProjects',examiner);assert.equal(projects.projects.find(item=>item.id===ready.id).defenceId,assignment.id);
  assert.equal((await json('evaluationProjects',examiner2)).projects.some(item=>item.id===ready.id),false);assert.equal((await req(`defences/${assignment.id}`,examiner2)).status,404);
  assert.equal((await req(`defenceNotices/${notice.id}`,admin,{batch:notice.batch,stream:notice.stream,startsAt:notice.startsAt,venue:'Changed',revision:notice.revision},'PATCH')).status,409);
  assert.equal((await req(`defenceNotices/${notice.id}`,admin,{revision:notice.revision},'DELETE')).status,409);
  assert.equal((await req(`evaluationAssignments/${active.id}`,await login(manifest.accounts.supervisors[0],'supervisor'),{...fields,requestKey:randomUUID()},'PUT')).status,200);
  assert.ok((await json('defenceNotices',admin)).notices[0].assignmentCount>=3);
  const clashNotice=await Notice.create({department:ledger._id,batch:'43',stream:'Project',startsAt:notice.startsAt,venue:'Other Room',requestKey:randomUUID()});
  assert.equal((await req(path,supervisor,{...fields,noticeId:clashNotice.id,noticeRevision:0,expectedDefenceId:assignment.id,revision:assignment.revision,requestKey:randomUUID()},'PUT')).status,409);
  const otherNotice=await Notice.create({department:ledger._id,batch:'43',stream:'Project',startsAt:new Date(Date.now()+9*86400000),venue:'New Hall',requestKey:randomUUID()});
  assert.equal((await req(path,supervisor,{...fields,noticeId:otherNotice.id,noticeRevision:0,expectedDefenceId:assignment.id,revision:assignment.revision,examinerIds:[examiners[1].id],requestKey:randomUUID()},'PUT')).status,409);
  const evaluationPath=`defences/${assignment.id}/evaluation`,evaluation=await json(evaluationPath,examiner);assert.equal(evaluation.canEdit,true);assert.equal(evaluation.rubric.criteria.length,5);
  const grade={revision:0,requestKey:randomUUID(),rubricId:evaluation.rubric.id,scheduleRevision:assignment.revision,scores:evaluation.rubric.criteria.map(item=>({criterionId:item.id,marks:75,comment:''})),comment:'Evaluation complete'};
  assert.equal((await req(`${evaluationPath}/submit`,examiner,grade)).status,200);
  assert.equal((await req(path,supervisor,{...fields,noticeId:otherNotice.id,noticeRevision:0,expectedDefenceId:assignment.id,revision:assignment.revision,requestKey:randomUUID()},'PUT')).status,409);
  const publish=await json(evaluationPath,examiner);assert.equal(publish.canPublish,true);
  assert.equal((await req(`${evaluationPath}/publish`,examiner,{revision:publish.revision,requestKey:randomUUID(),confirmDefenceHeld:true,note:'Confirmed'})).status,200);
  assert.equal((await json(evaluationPath,student)).publication.weightedTotal,75);assert.equal((await json(path,supervisor)).canAssign,false);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();if(app?.locals.sessionStore)await app.locals.sessionStore.close();await mongoose.disconnect();}
});
