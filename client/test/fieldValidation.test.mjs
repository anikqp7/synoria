import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateFields} from '../lib/fieldValidation.js';
function field(name,options={}) { return {name,tagName:'INPUT',type:'text',required:false,minLength:-1,maxLength:-1,step:'',min:'',max:'',dataset:{},getAttribute:()=>null,labels:[],...options}; }
const errors=(fields,values)=>validateFields(fields,values);
test('frontend required, email, phone, password and confirmation validation',()=>{
 const fields=[field('name',{required:true,maxLength:120}),field('email',{type:'email',required:true}),field('phone',{type:'tel',required:true}),field('password',{minLength:8,required:true}),field('confirmPassword',{required:true})];
 assert.deepEqual(Object.keys(errors(fields,{name:' ',email:'bad',phone:'abc',password:'short',confirmPassword:'other'})).sort(),['confirmPassword','email','name','password','phone']);
 const valid={name:'Student',email:'student@example.edu',phone:'+8801700000000',password:'strong-password',confirmPassword:'strong-password'};assert.deepEqual(errors(fields,valid),{});
 assert.ok(errors(fields,{...valid,password:'🙂'.repeat(19)}).password);
});
test('frontend numeric, URL, selection, file and research interest validation',()=>{
 assert.ok(errors([field('capacity',{type:'number',min:'2',max:'1000',step:'1'})],{capacity:'1'}).capacity);
 assert.ok(errors([field('marks',{type:'number',min:'0',max:'100',step:'0.01'})],{marks:'90.123'}).marks);
 assert.deepEqual(errors([field('marks',{type:'number',min:'0',max:'100',step:'0.01'})],{marks:'0'}),{});
 assert.ok(errors([field('url',{type:'url'})],{url:'javascript:alert(1)'}).url);
 assert.ok(errors([field('choice',{tagName:'SELECT',options:[{value:'disabled',disabled:true}]})],{choice:'disabled'}).choice);
 assert.ok(errors([field('file',{type:'file',required:true})],{file:{size:6*1024*1024,name:'report.pdf'}}).file);
 assert.ok(errors([field('file',{type:'file',required:true})],{category:'pdf',file:{size:100,name:'report.txt'}}).file);
 assert.ok(errors([field('researchInterests')],{researchInterests:Array.from({length:11},(_,i)=>`Area ${i}`).join(',')}).researchInterests);
});
test('frontend conditional deadlines, defence dates and distinct supervisor choices',()=>{
 const period=[field('status'),field('deadline'),field('notice')];
 assert.ok(errors(period,{status:'open',deadline:'',notice:''}).deadline);
 assert.ok(errors(period,{status:'open',deadline:'',notice:''}).notice);
 assert.deepEqual(errors(period,{status:'closed',deadline:'',notice:''}),{});
 const choices=[0,1,2].map(i=>field(`supervisorChoice${i}`));assert.ok(errors(choices,{supervisorChoice0:'one',supervisorChoice1:'one',supervisorChoice2:'two'}).supervisorChoice1);
 assert.ok(errors([field('date'),field('time')],{date:'2020-01-01',time:'12:00'}).date);
});
test('frontend permits incomplete proposal/evaluation drafts but rejects invalid provided values',()=>{
 assert.deepEqual(errors([field('title',{maxLength:200}),field('marks',{type:'number',min:'0',max:'100',step:'0.01'})],{title:'',marks:''}),{});
 assert.ok(errors([field('marks',{type:'number',required:true,min:'0',max:'100',step:'0.01'})],{marks:''}).marks);
});
