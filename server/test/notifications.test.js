const {test}=require('node:test');const assert=require('node:assert/strict');const {once}=require('node:events');const{randomBytes,randomUUID}=require('node:crypto');const mongoose=require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('notifications retain ownership, read state and chat while retired categories stay hidden',{timeout:60000},async()=>{
 process.env.SESSION_SECRET=randomBytes(48).toString('hex');let app,server;
 try{
  await mongoose.connect(process.env.MONGODB_URI,{dbName:`synoria_notices_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});const manifest=await require('../src/services/demoSeedService').seedDemo({password:'NotificationTest!2026'});
  app=require('../src');server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
  const req=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  const login=async(email,role)=>{const r=await req('login',null,{email,role,password:'NotificationTest!2026'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const student=await login(manifest.accounts.students[2],'student'),supervisor=await login(manifest.accounts.supervisors[0],'supervisor'),other=await login(manifest.accounts.students[1],'student');
  const list=async(cookie,query='')=>{const r=await req(`notifications?${query}`,cookie);assert.equal(r.status,200);return r.json();};
  const first=await list(student);assert.ok(first.notifications.some(item=>item.category==='chat'));assert.equal(first.categories.some(item=>['milestone','submission','feedback','final'].includes(item)),false);
  assert.ok(first.categories.includes('meeting'));assert.equal((await req('notifications?category=meeting',student)).status,200);
  const Notice=require('../src/models/notification'),Student=require('../src/models/student');const account=await Student.findOne({email:manifest.accounts.students[2]});
  await Notice.create({department:account.department,recipient:account._id,role:'student',eventKey:'legacy:meeting',category:'meeting',title:'Removed Meeting Feature',message:'Old notice',href:'/student/meetings',scope:'personal',occurredAt:new Date(),receivedAt:new Date()});
  assert.equal((await list(student)).notifications.some(item=>item.title==='Removed Meeting Feature'),false);
  const notice=first.notifications[0];assert.equal((await req(`notifications/${notice.id}/read`,other,{},'PATCH')).status,404);assert.equal((await req(`notifications/${notice.id}/read`,student,{},'PATCH')).status,200);assert.ok((await Notice.findById(notice.id)).readAt);
  const legacyWorkspace=manifest.projects.find(item=>item.stage==='active');
  const oldReminder=await Notice.create({department:account.department,recipient:account._id,role:'student',eventKey:'reminder:milestone:legacy',category:'reminder',title:'Removed Deadline',message:'Old reminder',href:'/student/milestones',scope:'workspace',workspace:legacyWorkspace.id,dynamic:true,occurredAt:new Date(),receivedAt:new Date()});
  await Notice.create({department:account.department,recipient:account._id,role:'student',eventKey:'legacy:proposal',category:'proposal',title:'Saved Proposal Decision',message:'Approved',href:`/student/archives/${legacyWorkspace.id}#proposal`,scope:'workspace',workspace:legacyWorkspace.id,occurredAt:new Date(),receivedAt:new Date()});
  assert.equal((await list(student)).notifications.find(item=>item.title==='Saved Proposal Decision').href,'/student/proposal');
  assert.equal((await req(`notifications/${oldReminder.id}/read`,student,{},'PATCH')).status,404);
  await Notice.create({department:account.department,recipient:account._id,role:'student',eventKey:'legacy:invite-link',category:'team',title:'Legacy Invitation',message:'Old invitation',href:'/student/invitations',scope:'personal',occurredAt:new Date(),receivedAt:new Date()});
  assert.equal((await list(student)).notifications.find(n=>n.title==='Legacy Invitation').href,'/student/team#teamInvitations');
  const count=await Notice.countDocuments();await Promise.all([list(student),list(student)]);assert.equal(await Notice.countDocuments(),count);
  const snapshot=await list(student);assert.equal((await req('notifications/readAll',student,{before:snapshot.serverNow})).status,200);assert.equal((await list(student)).unreadCount,0);
  for(const category of['milestone','submission','feedback','final'])assert.equal((await req(`notifications?category=${category}`,student)).status,400);
  const workspace=manifest.projects.find(item=>item.stage==='active');assert.equal((await req(`workspaces/${workspace.id}/chat`,student,{text:'A new question',requestKey:randomUUID()})).status,201);
  assert.ok((await list(supervisor,'category=chat')).notifications.some(item=>item.href===`/supervisor/chat/${workspace.id}`));
  const room=await(await req(`supervision/${workspace.id}/chat`,supervisor)).json();assert.equal((await req(`supervision/${workspace.id}/chat/read`,supervisor,{upToSeq:room.messages.at(-1).seq})).status,200);assert.equal((await list(supervisor,'category=chat')).notifications.length,0);
  const admin=await login(manifest.accounts.coordinator,'department');
  await Notice.create({department:account.department,recipient:account.department,role:'department',eventKey:'legacy:department-project',category:'proposal',title:'Old Project Link',message:'Old notification',href:`/department/projects/${workspace.id}#evaluationAssignment`,scope:'personal',occurredAt:new Date(),receivedAt:new Date()});
  assert.equal((await list(admin)).notifications.find(n=>n.title==='Old Project Link').href,`/department/proposals/${workspace.id}#evaluationAssignment`);
  assert.equal((await req('notifications')).status,401);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();if(app?.locals.sessionStore)await app.locals.sessionStore.close();await mongoose.disconnect();}
});
