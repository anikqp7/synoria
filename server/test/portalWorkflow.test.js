const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes,randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('retained portal: approved proposal scheduling, private evaluation, results and retired API removal', {timeout:90000},async()=>{
  process.env.SESSION_SECRET=randomBytes(48).toString('hex');let app,server;
  try{
    await mongoose.connect(process.env.MONGODB_URI,{dbName:`synoria_portal_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});
    const manifest=await require('../src/services/demoSeedService').seedDemo({password:'PortalTestPassword!2026'});
    const Department=require('../src/models/department'),Supervisor=require('../src/models/supervisor'),Student=require('../src/models/student'),Examiner=require('../src/models/examiner'),Workspace=require('../src/models/workspace'),Ledger=require('../src/models/supervisionLedger');
    app=require('../src');server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
    const request=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    const json=async(path,cookie)=>{const response=await request(path,cookie);assert.equal(response.status,200,await response.clone().text());return response.json();};
    const login=async(email,role)=>{const response=await request('login',null,{email,role,password:'PortalTestPassword!2026'});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
    const admin=await login(manifest.accounts.coordinator,'department'),student=await login(manifest.accounts.students[4],'student'),unrelated=await login(manifest.accounts.students[1],'student'),supervisor=await login(manifest.accounts.supervisors[1],'supervisor'),examiner=await login(manifest.accounts.examiners[0],'examiner'),examiner2=await login(manifest.accounts.examiners[1],'examiner');
    const ready=manifest.projects.find(item=>item.stage==='ready'),draft=manifest.projects.find(item=>item.stage==='draft');
    const evaluationProjects=await json('evaluationProjects',examiner);
    assert.equal(evaluationProjects.projects.length,2);
    assert.equal(evaluationProjects.projects.some(item=>item.id===draft.id),false);
    assert.equal(evaluationProjects.projects.some(item=>item.id===ready.id),false);
    assert.ok(evaluationProjects.projects.some(item=>item.evaluationStatus==='published'&&item.defenceId));
    assert.doesNotMatch(JSON.stringify(evaluationProjects),/passwordHash|approvedScope|scores|email|abstract/);
    for(const cookie of[admin,student,supervisor])assert.equal((await request('evaluationProjects',cookie)).status,403);
    assert.equal((await request('evaluationProjects')).status,401);
    const overview=await json('monitoring/overview',admin);
    assert.deepEqual(overview.summary,{total:6,awaitingAssignment:1,active:3,upcoming:1});
    assert.equal(overview.attention[0].action,'Assign Supervisor');
    assert.equal(overview.attention[0].name,'Bangla Document Retrieval');
    assert.equal(overview.attention.some(item=>item.id===ready.id),false);
    assert.equal(overview.upcoming[0].batch,'42');assert.equal(overview.upcoming[0].stream,'Thesis');
    assert.equal(overview.availablePlaces,7);
    assert.ok(overview.upcoming.every(item=>new Date(item.startsAt)>=new Date(overview.generatedAt)));
    for(const cookie of[student,supervisor,examiner])assert.equal((await request('monitoring/overview',cookie)).status,403);
    const options=await json('defences',admin);assert.ok(options.projects.some(item=>item.id===ready.id));assert.equal(options.projects.some(item=>item.id===draft.id),false);assert.equal(options.projects.find(item=>item.id===ready.id).proposalVersion,1);
    await request('evaluationPeriod',admin,{status:'open',notice:'Supervisors, submit projects for evaluation.',deadline:new Date(Date.now()+86400000).toISOString(),revision:0},'PUT');
    const assignmentOptions=await json(`evaluationAssignments/${ready.id}`,supervisor),notice=assignmentOptions.notices[0];
    const examAccounts=await Examiner.find().sort({email:1});
    const fields={proposalVersion:1,noticeId:notice.id,noticeRevision:notice.revision,examinerIds:[examAccounts[0].id],expectedDefenceId:null,revision:0,requestKey:randomUUID()};
    for(const cookie of [student,supervisor,examiner,admin])assert.equal((await request('defences',cookie,fields)).status,403);
    const creation=await Promise.all([request(`evaluationAssignments/${ready.id}`,supervisor,fields,'PUT'),request(`evaluationAssignments/${ready.id}`,supervisor,{...fields,requestKey:randomUUID()},'PUT')]);assert.deepEqual(creation.map(item=>item.status).sort(),[200,409]);
    const schedule=(await creation.find(item=>item.status===200).json()).current;
    const detail=await json(`defences/${schedule.id}`,student);assert.equal(detail.approvedProposal.version,1);assert.equal(detail.approvedProposal.title,'Accessible Learning Platform');
    assert.equal((await request(`defences/${schedule.id}`,unrelated)).status,404);
    assert.equal((await request(`workspaces/${ready.id}/proposal/scopeChange`,student,{reason:'Locked during evaluation',revision:(await require('../src/models/workspace').findById(ready.id)).proposalRevision||0})).status,409);
    const rubric=await json('rubrics',admin);const rubricId=rubric.rubrics[0].id;let evaluation=await json(`defences/${schedule.id}/evaluation`,admin);
    assert.equal(evaluation.rubric.id,rubricId,'Legacy assignments receive scoring criteria automatically without Department rubric selection.');
    assert.equal((await request(`defences/${schedule.id}/evaluation/rubric`,admin,{revision:evaluation.revision,requestKey:randomUUID(),rubricId},'PUT')).status,200);
    const evaluationPath=`defences/${schedule.id}/evaluation`;
    for(const [cookie,marks]of[[examiner,80]]){
      const own=await json(evaluationPath,cookie);
      const grade={revision:0,requestKey:randomUUID(),rubricId:own.rubric.id,scheduleRevision:schedule.revision,scores:own.rubric.criteria.map(item=>({criterionId:item.id,marks,comment:`PRIVATE_GRADE_${marks}`})),comment:`PRIVATE_DRAFT_${marks}`};
      assert.equal((await request(`${evaluationPath}/draft`,cookie,grade,'PUT')).status,200);
      for(const viewer of [admin,student])assert.doesNotMatch(JSON.stringify(await json(evaluationPath,viewer)),new RegExp(`PRIVATE_DRAFT_${marks}|PRIVATE_GRADE_${marks}`));
      assert.equal((await request(`${evaluationPath}/submit`,cookie,{...grade,revision:1,requestKey:randomUUID()})).status,200);
    }
    evaluation=await json(evaluationPath,admin);assert.equal(evaluation.preview.weightedTotal,80);assert.equal(evaluation.canPublish,false);
    assert.equal((await request(`${evaluationPath}/publish`,student,{revision:evaluation.revision,requestKey:randomUUID(),confirmDefenceHeld:true,note:''})).status,403);
    const publication={revision:evaluation.revision,requestKey:randomUUID(),confirmDefenceHeld:true,note:'Board result confirmed'};assert.equal((await request(`${evaluationPath}/publish`,examiner,publication)).status,200);assert.equal((await request(`${evaluationPath}/publish`,examiner,publication)).status,200);
    assert.equal((await json(evaluationPath,student)).publication.weightedTotal,80);assert.equal((await Workspace.findById(ready.id)).isActive,false);
    const currentResults=await json('defences?status=published&sort=latestPublished',admin);
    assert.equal(currentResults.schedules[0].workspaceId,ready.id);
    assert.ok(currentResults.schedules.length>1);
    const ownResult=await json('defences?status=published&sort=latestPublished',student);
    assert.equal(ownResult.schedules.length,1);assert.equal(ownResult.schedules[0].workspaceId,ready.id);
    assert.equal((await json('defences?status=published&sort=latestPublished',unrelated)).schedules.length,0);
    assert.equal((await request('defences?status=scheduled&sort=latestPublished',admin)).status,400);
    const loads=await json('supervisorLoads',admin);assert.equal(loads.supervisors.find(item=>item.email===manifest.accounts.supervisors[1]).currentLoad,1);
    const monitor=await json(`monitoring/${ready.id}`,admin);assert.equal('milestones'in monitor,false);assert.equal('submissions'in monitor,false);assert.equal('meetings'in monitor,false);assert.equal('finalPackage'in monitor,false);
    assert.ok((await json('monitoring',admin)).summary.total>0);
    assert.equal((await request('monitoring',student)).status,403);
    for(const cookie of[student,supervisor,admin,examiner]){
      assert.equal((await request('archives',cookie)).status,404);
      for(const feature of['milestones','submissions','meetings','finalPackage','uploads','files']){
        for(const prefix of['workspaces','supervision'])for(const method of['GET','POST','PATCH'])assert.ok([403,404].includes((await request(`${prefix}/${ready.id}/${feature}`,cookie,method==='GET'?null:{},method)).status));
      }
    }
    const ledger=await Ledger.findOne();for(const field of['milestonePlans','finalPlans','submissionCommits'])assert.equal(field in ledger.toObject(),false);
    assert.equal(await mongoose.connection.db.collection('uploads').countDocuments(),0);
    assert.equal(await Department.countDocuments(),1);assert.equal(await Supervisor.countDocuments(),2);assert.equal(await Student.countDocuments(),8);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();if(app?.locals.sessionStore)await app.locals.sessionStore.close();await mongoose.disconnect();}
});
