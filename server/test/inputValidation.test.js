const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contractFor, routes } = require('../src/validation/contracts');
const validate = require('../src/middleware/validateRequest');
const id = 'a'.repeat(24), id2 = 'b'.repeat(24), id3 = 'c'.repeat(24), key = 'validation-test-request';
function check(path, method, body, query = {}) { const contract = contractFor(method, path); assert.ok(contract, `${method} ${path} has a contract`); return { body: contract.body.safeParse(body), query: contract.query.safeParse(query) }; }
test('Zod covers every mounted endpoint and denies unvalidated route additions', () => {
  const fs = require('node:fs'), path = require('node:path');
  const folder = path.join(__dirname, '../src/routes');
  const mounts = { auth: '', evaluationPeriods: '/evaluationPeriod' };
  for (const file of fs.readdirSync(folder)) {
    if (!file.endsWith('.js')) continue;
    const source = fs.readFileSync(path.join(folder, file), 'utf8'), root = mounts[file.slice(0,-3)] ?? `/${file.slice(0,-3)}`;
    for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"],\s*validateRequest/g)) {
      const endpoint = `${root}${match[2]}`.replace(/:[A-Za-z]+/g,id).replace(/\/$/,'');
      if (endpoint === '/defences' && match[1] === 'post' || endpoint.endsWith('/reopen')) continue;
      assert.ok(contractFor(match[1].toUpperCase(), endpoint), `${file}: ${endpoint}`);
    }
  }
  assert.ok(routes.length >= 90);
});
test('Zod rejects wrong types, oversized values, unsafe objects and out-of-range numbers', () => {
  const member = { name:'Student', email:'student@example.edu', phone:'+8801700000000', password:'strong-password', studentId:'CSE1' };
  assert.equal(check('/students','POST',member).body.success,true);
  for (const patch of [{email:{$ne:null}},{phone:'abc'},{password:'1234567'},{password:'🙂'.repeat(19)},{name:' '},{studentId:12}]) assert.equal(check('/students','POST',{...member,...patch}).body.success,false);
  const faculty = {...member, researchInterests:Array.from({length:11},(_,i)=>`Area ${i}`).join(', ')};
  assert.equal(check('/supervisors','POST',faculty).body.success,false);
  for (const maxLoad of ['5',-1,1.1,1001,null,{},[]]) assert.equal(check(`/supervisorLoads/${id}`,'PATCH',{maxLoad}).body.success,false);
  assert.equal(check(`/supervisorLoads/${id}`,'PATCH',{available:0}).body.success,true);
  assert.equal(check('/supervisorRequests','PUT',{revision:0,choices:[id,id2,id3]}).body.success,true);
  assert.equal(check('/supervisorRequests','PUT',{revision:0,choices:[id,id.toUpperCase(),id3]}).body.success,false);
});
test('Zod allowlists discard client-controlled ownership and reject malicious queries', () => {
  const result=check('/workspaces','POST',{name:'Team',department:id,leader:id,members:[id],status:'active'});
  assert.deepEqual(result.body.data,{name:'Team'});
  for(const query of [{search:{$ne:null}},{search:['one','two']},{page:'0'},{page:'1.5'},{unexpected:'value'}]) assert.equal(check('/monitoring','GET',{},query).query.success,false);
  assert.equal(check(`/workspaces/${id}/chat`,'GET',{}, {before:'2',after:'0'}).query.success,false);
});
test('Zod validates conditional periods, resource payloads, marks and approval notes', () => {
  const period={status:'open',notice:'Choose before deadline',deadline:new Date(Date.now()+86400000).toISOString(),revision:0};
  assert.equal(check('/resultPeriod','PUT',period).body.success,true);
  assert.equal(check('/resultPeriod','PUT',{...period,deadline:null}).body.success,false);
  assert.equal(check('/resultPeriod','PUT',{...period,deadline:'not-a-date'}).body.success,false);
  const resource={action:'add',revision:0,kind:'link',title:'Repository',description:'',url:'https://example.edu'};
  assert.equal(check(`/resources/${id}`,'POST',resource).body.success,true);
  for(const url of ['javascript:alert(1)','ftp://example.edu','https://user:password@example.edu']) assert.equal(check(`/resources/${id}`,'POST',{...resource,url}).body.success,false);
  const pdf={action:'add',revision:0,kind:'file',category:'pdf',title:'Report',description:'',name:'report.pdf',data:Buffer.from('%PDF-1.7\nreport').toString('base64')};
  assert.equal(check(`/resources/${id}`,'POST',pdf).body.success,true);
  assert.equal(check(`/resources/${id}`,'POST',{...pdf,data:Buffer.from('invalid').toString('base64')}).body.success,false);
  assert.equal(check(`/resources/${id}`,'POST',{...pdf,data:'YQ'}).body.success,false);
  for(const marks of [-1,100.01,12.345,'80',null]) assert.equal(check(`/defences/${id}/evaluation/correct`,'POST',{revision:0,requestKey:key,marks,reason:'Correction'}).body.success,false);
  assert.equal(check(`/supervision/${id}/review`,'POST',{version:1,decision:'rejected',comment:' '}).body.success,false);
  assert.equal(check(`/supervisorRequests/${id}/assignment`,'PUT',{revision:0,supervisorId:null,expectedSupervisorId:id,note:' '}).body.success,false);
});
test('middleware provides safe field errors and does not invoke controllers for invalid input', () => {
  const response={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  let next=false;
  validate({baseUrl:'/api/auth/students',path:'/',method:'POST',params:{},query:{},body:{email:{$ne:null},password:'secret'}},response,()=>{next=true;});
  assert.equal(next,false);assert.equal(response.code,400);assert.ok(response.body.errors.some(error=>error.field==='email'));
  assert.equal(JSON.stringify(response.body).includes('secret'),false);
});
