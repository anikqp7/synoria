const {test}=require('node:test');const assert=require('node:assert/strict');const {randomBytes}=require('node:crypto');const {once}=require('node:events');const mongoose=require('mongoose');
require('dotenv').config({path:require('node:path').join(__dirname,'../.env'),quiet:true});
test('resource update periods independently control writes, preserve downloads and publish department notices',{timeout:90000},async()=>{
 let server;process.env.SESSION_SECRET=randomBytes(40).toString('hex');
 try{
 await mongoose.connect(process.env.MONGODB_URI,{dbName:`resource_period_${randomBytes(6).toString('hex')}_demo`,serverSelectionTimeoutMS:5000});
 const manifest=await require('../src/services/demoSeedService').seedDemo({password:'ResourcePeriod!2026'});
 server=require('../src').listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/auth`;
 const request=(path,cookie,body,method)=>fetch(`${base}/${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 const login=async(email,role)=>{const r=await request('login',null,{email,role,password:'ResourcePeriod!2026'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const student=await login(manifest.accounts.students[4],'student'),admin=await login(manifest.accounts.coordinator,'department'),supervisor=await login(manifest.accounts.supervisors[0],'supervisor'),examiner=await login(manifest.accounts.examiners[0],'examiner');
 const ready=manifest.projects.find(p=>p.stage==='ready'),path=`resources/${ready.id}`,deadline=new Date(Date.now()+86400000).toISOString();
 let period=(await (await request('resourcePeriod',admin)).json()).period;
 const set=async(status,date=deadline)=>{const r=await request('resourcePeriod',admin,{status,deadline:date,notice:'Upload your final resources before the deadline.',revision:period.revision},'PUT');assert.equal(r.status,200,await r.clone().text());period=(await r.json()).period;};
 assert.equal((await request('resourcePeriod')).status,401);
 for(const cookie of[student,supervisor,examiner])assert.equal((await request('resourcePeriod',cookie,{status:'closed',deadline:null,notice:'',revision:period.revision},'PUT')).status,403);
 const body={action:'add',kind:'file',category:'pdf',title:'Report',description:'',name:'report.pdf',data:Buffer.from('%PDF-1.4\nReport').toString('base64'),revision:0};
 let state=await (await request(path,student,body)).json();const file=state.items[0];assert.ok(file);
 await set('closed');assert.equal((await (await request(path,student)).json()).canEdit,false);assert.equal((await (await request('proposalPeriod',student)).json()).period.accepting,true,'Proposal period stays independent');
 const File=require('../src/models/resourceFile'),count=await File.countDocuments();
 for(const action of['add','edit','remove'])assert.equal((await request(path,student,{...body,action,itemId:file.id,revision:state.revision})).status,409);
 assert.equal(await File.countDocuments(),count,'Closed uploads do not create orphan files');
 assert.equal((await request(`${path}/files/${file.id}`,student)).status,200);
 assert.equal((await request('resourcePeriod',admin,{status:'open',deadline:null,notice:'',revision:period.revision},'PUT')).status,400);
 await set('paused');assert.equal((await request(path,student,{...body,revision:state.revision})).status,409);
 await set('open');const edited=await request(path,student,{...body,action:'edit',itemId:file.id,title:'Final Report',revision:state.revision});assert.equal(edited.status,200);state=await edited.json();
 const Department=require('../src/models/department');await Department.updateOne({},{$set:{'resourcePeriod.deadline':new Date(Date.now()-1000)}});
 assert.equal((await (await request('resourcePeriod',student)).json()).period.expired,true);
 assert.equal((await request(path,student,{action:'remove',itemId:file.id,revision:state.revision})).status,409);
 assert.equal((await request(`${path}/files/${file.id}`,student)).status,200);
 await set('open');
 assert.equal((await request('resourcePeriod',admin,{status:'closed',deadline:null,notice:'stale',revision:0},'PUT')).status,409);
 for(const cookie of[student,supervisor,examiner,admin]){const r=await request('notifications?category=resources',cookie);assert.equal(r.status,200);assert.ok((await r.json()).notifications.some(n=>n.title==='New Resources Notice'&&n.href.endsWith('/resources#resourceNotice')));}
 const account=await Department.findOne().select('+passwordHash');await Department.create({name:'Other',university:'Other',email:'other@resource.test',passwordHash:account.passwordHash});const other=await login('other@resource.test','department');
 assert.equal((await (await request('resourcePeriod',other)).json()).period.status,'closed');assert.equal((await (await request('notifications?category=resources',other)).json()).notifications.length,0);
 }finally{if(server)await new Promise(resolve=>server.close(resolve));if(mongoose.connection.readyState===1)await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});
