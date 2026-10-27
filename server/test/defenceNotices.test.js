const{test}=require('node:test');const assert=require('node:assert/strict');const{once}=require('node:events');const{randomBytes,randomUUID}=require('node:crypto');const mongoose=require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('defence notice board: department publication, dates, all-role visibility, isolation and revision checks',{timeout:60000},async()=>{
 process.env.SESSION_SECRET=randomBytes(48).toString('hex');let app,server;
 try{
  await mongoose.connect(process.env.MONGODB_URI,{dbName:`synoria_notices_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});const manifest=await require('../src/services/demoSeedService').seedDemo({password:'DefenceNoticeTest!2026'});
  app=require('../src');server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
  const req=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  const json=async(path,cookie)=>{const r=await req(path,cookie);assert.equal(r.status,200);return r.json();};
  const login=async(email,role)=>{const r=await req('login',null,{email,role,password:'DefenceNoticeTest!2026'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const admin=await login(manifest.accounts.coordinator,'department'),student=await login(manifest.accounts.students[0],'student'),supervisor=await login(manifest.accounts.supervisors[0],'supervisor'),examiner=await login(manifest.accounts.examiners[0],'examiner');
  const Department=require('../src/models/department');const original=await Department.findOne().select('+passwordHash');await Department.create({name:'Other Department',university:'Other University',email:'other@notice.test',passwordHash:original.passwordHash});const other=await login('other@notice.test','department');
  assert.equal((await req('defenceNotices')).status,401);
  const fields={batch:'55',stream:'Project',startsAt:new Date(Date.now()+2*86400000).toISOString(),venue:'CSE Room 12',requestKey:randomUUID()};
  for(const cookie of[student,supervisor,examiner])assert.equal((await req('defenceNotices',cookie,fields)).status,403);
  const results=await Promise.all([req('defenceNotices',admin,fields),req('defenceNotices',admin,fields)]);assert.ok(results.every(r=>r.status===200));const notice=(await results[0].json()).notice;assert.equal((await results[1].json()).notice.id,notice.id);
  assert.equal((await req('defenceNotices',admin,{...fields,venue:'Changed'})).status,409);
  for(const cookie of[admin,student,supervisor,examiner]){const board=await json('defenceNotices',cookie);assert.equal(board.notices.length,2);assert.equal(board.notices[0].id,notice.id);assert.equal(board.canManage,cookie===admin);assert.equal('board'in board.notices[0],false);assert.equal('workspaceId'in board.notices[0],false);}
  assert.equal((await json('defenceNotices',other)).notices.length,0);
  for(const patch of[{batch:''},{stream:{}},{venue:'x'.repeat(201)},{startsAt:'not-a-date'},{startsAt:new Date(Date.now()-1000).toISOString()}])assert.equal((await req('defenceNotices',admin,{...fields,...patch,requestKey:randomUUID()})).status,400);
  const path=`defenceNotices/${notice.id}`,edit={...fields,revision:0,venue:'Main Auditorium'};
  for(const cookie of[student,supervisor,examiner]){assert.equal((await req(path,cookie,edit,'PATCH')).status,403);assert.equal((await req(path,cookie,{revision:0},'DELETE')).status,403);}
  assert.equal((await req(path,other,edit,'PATCH')).status,404);assert.equal((await req(path,other,{revision:0},'DELETE')).status,404);
  assert.equal((await req(path,admin,edit,'PATCH')).status,200);assert.equal((await req(path,admin,edit,'PATCH')).status,409);assert.equal((await json('defenceNotices',student)).notices[0].venue,'Main Auditorium');
  let inbox=await json('notifications?category=defence',student);assert.ok(inbox.notifications.some(item=>item.title==='Defence Notice Updated'&&item.href===`/student/defences#notice-${notice.id}`));
  const dashboard=await json('monitoring/overview',admin);assert.equal(dashboard.summary.upcoming,2);assert.equal(dashboard.upcoming[0].batch,'55');
  assert.equal((await req(path,admin,{revision:0},'DELETE')).status,409);assert.equal((await req(path,admin,{revision:1},'DELETE')).status,200);assert.equal((await json('defenceNotices',student)).notices.length,1);
  inbox=await json('notifications?category=defence',student);assert.equal(inbox.notifications.some(item=>item.href.endsWith(`notice-${notice.id}`)),false);
  const Notice=require('../src/models/defenceNotice');await Notice.updateMany({},{$set:{startsAt:new Date(Date.now()-1000)}});assert.equal((await json('defenceNotices',student)).notices.length,0);assert.equal((await json('monitoring/overview',admin)).summary.upcoming,0);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();if(app?.locals.sessionStore)await app.locals.sessionStore.close();await mongoose.disconnect();}
});
