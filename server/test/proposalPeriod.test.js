const {test}=require('node:test');const assert=require('node:assert/strict');const {randomBytes}=require('node:crypto');const {once}=require('node:events');const mongoose=require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('department proposal period controls notices, deadlines and student writes while preserving drafts',{timeout:90000},async()=>{
 let server;process.env.SESSION_SECRET=randomBytes(40).toString('hex');
 try{
 await mongoose.connect(process.env.MONGODB_URI,{dbName:`proposal_period_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});
 const manifest=await require('../src/services/demoSeedService').seedDemo({password:'PeriodTest!2026'});
 server=require('../src').listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
 const request=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const login=async(email,role)=>{const r=await request('login',null,{email,role,password:'PeriodTest!2026'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const student=await login(manifest.accounts.students[0],'student'),admin=await login(manifest.accounts.coordinator,'department'),supervisor=await login(manifest.accounts.supervisors[0],'supervisor');
 const id=manifest.projects.find(p=>p.stage==='draft').id,path=`workspaces/${id}/proposal`;
 const draft=(await (await request(path,student)).json()).proposal;
 const fields={title:'Period Controlled Proposal',abstract:'Research abstract',researchArea:'Computing',supervisorPreference:draft.draft.supervisorPreference,revision:draft.revision};
 const deadline=new Date(Date.now()+86400000).toISOString();let period=(await (await request('proposalPeriod',admin)).json()).period;
 assert.equal((await request('proposalPeriod')).status,401);
 for(const cookie of[student,supervisor])assert.equal((await request('proposalPeriod',cookie,{status:'closed',deadline:null,notice:'',revision:period.revision},'PUT')).status,403);
 const set=async(status,date=deadline)=>{const r=await request('proposalPeriod',admin,{status,deadline:date,notice:'Complete your proposal before the deadline.',revision:period.revision},'PUT');assert.equal(r.status,200,await r.clone().text());period=(await r.json()).period;};
 await set('closed');assert.equal(period.accepting,false);
 assert.equal((await request(path,student,fields,'PATCH')).status,409);assert.equal((await request(`${path}/submit`,student,{revision:fields.revision})).status,409);
 assert.equal((await request('proposalPeriod',admin,{status:'open',deadline:null,notice:'',revision:period.revision},'PUT')).status,400);
 await set('open');assert.equal(period.accepting,true);
 assert.equal((await (await request('proposalPeriod',student)).json()).period.notice,'Complete your proposal before the deadline.');
 const saved=await request(path,student,fields,'PATCH');assert.equal(saved.status,200);fields.revision=(await saved.json()).revision;
 await set('paused');assert.equal((await request(path,student,fields,'PATCH')).status,409);
 assert.equal((await (await request(path,student)).json()).proposal.draft.title,fields.title);
 const Department=require('../src/models/department');await Department.updateOne({},{$set:{'proposalPeriod.status':'open','proposalPeriod.deadline':new Date(Date.now()-1000)}});
 const expired=(await (await request('proposalPeriod',student)).json()).period;assert.equal(expired.expired,true);assert.equal(expired.accepting,false);
 assert.equal((await request(path,student,fields,'PATCH')).status,409);
 await set('open');assert.equal((await request(path,student,fields,'PATCH')).status,200);
 assert.equal((await request('proposalPeriod',admin,{status:'paused',deadline,notice:'stale',revision:0},'PUT')).status,409);
 const department=await Department.findOne();await Department.create({name:'Other',university:'Other University',email:'other@period.test',passwordHash:await require('bcryptjs').hash('PeriodTest!2026',12)});
 const other=await login('other@period.test','department');assert.equal((await (await request('proposalPeriod',other)).json()).period.status,'closed');
 assert.equal((await (await request('proposalPeriod',admin)).json()).period.status,'open');assert.ok(department);
 const examiner=await login(manifest.accounts.examiners[0],'examiner');
 const Notice=require('../src/models/notification');
 for(const [role,cookie] of [['student',student],['supervisor',supervisor],['examiner',examiner],['department',admin]]){
  const response=await request('notifications?category=proposal&limit=50',cookie);assert.equal(response.status,200);
  const notifications=(await response.json()).notifications.filter(n=>n.title==='New Proposal Notice');assert.ok(notifications.length,`${role} receives the proposal notice`);
  assert.match(notifications[0].message,/A new proposal notice has been published/);
  assert.equal(notifications[0].href,role==='student'?'/student/proposal#proposalNotice':role==='department'?'/department/proposals#proposalNotice':`/${role}/proposalNotice#proposalNotice`);
 }
 const count=await Notice.countDocuments({eventKey:/^proposalNotice:/});
 await Promise.all([request('notifications',student),request('notifications',student),request('notifications',supervisor)]);
 assert.equal(await Notice.countDocuments({eventKey:/^proposalNotice:/}),count);
 assert.equal((await (await request('notifications?category=proposal',other)).json()).notifications.some(n=>n.title==='New Proposal Notice'),false);
 const beforeNoop=await Department.findById(department._id);const oldEvents=beforeNoop.proposalNotices.length;
 await set('open');assert.equal((await Department.findById(department._id)).proposalNotices.length,oldEvents,'Saving unchanged settings does not republish a notice');
 assert.equal((await Department.findById(department._id)).updatedAt.getTime(),beforeNoop.updatedAt.getTime(),'Proposal settings do not generate account update notifications');
 const own=(await (await request('notifications?category=proposal',student)).json()).notifications.find(n=>n.title==='New Proposal Notice');
 assert.equal((await request(`notifications/${own.id}/read`,student,{},'PATCH')).status,200);
 assert.ok((await (await request('notifications?category=proposal',student)).json()).notifications.find(n=>n.id===own.id).readAt);
 assert.equal(await Department.countDocuments({'proposalGate.token':{$exists:true}}),0);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
