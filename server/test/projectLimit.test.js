const {test}=require('node:test');const assert=require('node:assert/strict');const {randomBytes}=require('node:crypto');const {once}=require('node:events');const mongoose=require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('one project per student persists across completion, team changes, invitations and concurrent proposal creation',{timeout:90000},async()=>{
 let server;process.env.SESSION_SECRET=randomBytes(40).toString('hex');
 try{
 await mongoose.connect(process.env.MONGODB_URI,{dbName:`project_limit_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});
 const manifest=await require('../src/services/demoSeedService').seedDemo({password:'OneProject!2026'});
 const Student=require('../src/models/student'),Workspace=require('../src/models/workspace');const seed=await Student.findOne().select('+passwordHash');
 const free=await Student.create([0,1,2].map(i=>({name:`Free ${i}`,email:`free${i}@limit.test`,phone:'+8801700000000',studentId:`FREE${i}`,department:seed.department,passwordHash:seed.passwordHash})));
 server=require('../src').listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
 const request=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const login=async(email)=>{const r=await request('login',null,{email,role:'student',password:'OneProject!2026'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const cookies=[];for(const s of free)cookies.push(await login(s.email));
 const archived=await login(manifest.accounts.students[6]);assert.equal((await request('workspaces',archived,{name:'Second Project'})).status,409);
 const a=(await (await request('workspaces',cookies[0],{name:'First Team'})).json()).workspace,b=(await (await request('workspaces',cookies[1],{name:'Second Team'})).json()).workspace;
 assert.equal((await request(`workspaces/${a.id}/members`,cookies[0],{email:free[2].email,role:'Researcher'})).status,201);
 const proposal=async(id,cookie)=> (await (await request(`workspaces/${id}/proposal`,cookie)).json()).proposal;
 const draft=await proposal(a.id,cookies[0]);const fields={title:'One Project',abstract:'A single research project.',researchArea:'Computing',supervisorPreference:draft.supervisors[0].id,revision:draft.revision};
 const result=await Promise.all([request(`workspaces/${a.id}/proposal`,cookies[0],fields,'PATCH'),request(`workspaces/${a.id}/members/${free[2].id}`,cookies[2],{},'DELETE')]);for(const r of result)assert.equal(r.status,200,await r.clone().text());
 const claimedA=await Workspace.exists({_id:a.id,projectParticipants:free[2]._id});
 const addB=await request(`workspaces/${b.id}/members`,cookies[1],{email:free[2].email,role:'Data Analyst'});assert.equal(addB.status,claimedA?409:201);
 if(!claimedA){const next=await proposal(b.id,cookies[1]);assert.equal((await request(`workspaces/${b.id}/proposal`,cookies[1],{...fields,revision:next.revision},'PATCH')).status,200);}
 assert.equal(await Workspace.countDocuments({projectParticipants:free[2]._id}),1);
 await Workspace.updateOne({_id:a.id},{$set:{isActive:false,status:'archived'}});assert.equal((await request('workspaces',cookies[0],{name:'Try Again'})).status,409);
 assert.equal((await (await request('workspaces',cookies[0])).json()).projectLimit.projectId,a.id);
 const old=manifest.projects.find(p=>p.stage==='active'),member=await Student.findOne({email:manifest.accounts.students[3]}),memberCookie=await login(member.email),leaderCookie=await login(manifest.accounts.students[2]);
 assert.equal((await request(`workspaces/${old.id}/members/${member.id}`,memberCookie,{},'DELETE')).status,200);
 assert.equal((await request('workspaces',memberCookie,{name:'Different Project'})).status,409);
 assert.equal((await request(`workspaces/${b.id}/joinRequests`,memberCookie,{})).status,409);
 assert.equal((await request(`workspaces/${b.id}/members`,cookies[1],{email:member.email,role:'Member'})).status,409);
 assert.equal((await request(`workspaces/${b.id}/invitations`,cookies[1],{email:member.email,role:'Member'})).status,409);
 const invitationId=new mongoose.Types.ObjectId();await Workspace.collection.updateOne({_id:new mongoose.Types.ObjectId(b.id)},{$push:{invitations:{_id:invitationId,student:member._id,status:'pending',role:'Member'}}});
 assert.equal((await request(`workspaces/${b.id}/invitations/${invitationId}`,memberCookie,{action:'accept'},'PATCH')).status,409);
 assert.equal((await request(`workspaces/${old.id}/joinRequests`,memberCookie,{})).status,201);
 const own=(await (await request(`workspaces/${old.id}`,leaderCookie)).json()).workspace;const join=own.joinRequests.find(r=>r.student.id===member.id&&r.status==='pending');
 assert.equal((await request(`workspaces/${old.id}/joinRequests/${join.id}`,leaderCookie,{action:'accept',role:'Researcher'},'PATCH')).status,200,'Returning to the original project remains allowed');
 // Older data without participant metadata must still be checked via immutable proposal snapshots.
 await Workspace.collection.updateOne({_id:new mongoose.Types.ObjectId(old.id)},{$pull:{members:member._id},$unset:{projectParticipants:'',projectCreatedAt:''}});
 assert.equal((await request('workspaces',memberCookie,{name:'Bypass Legacy History'})).status,409);
 // Even forged legacy membership cannot create a second proposal through save or submit.
 await Workspace.collection.updateOne({_id:new mongoose.Types.ObjectId(b.id)},{$addToSet:{members:member._id}});
 const bd=await proposal(b.id,cookies[1]);assert.equal((await request(`workspaces/${b.id}/proposal`,cookies[1],{...fields,revision:bd.revision},'PATCH')).status,409);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
