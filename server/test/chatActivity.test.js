const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ledgerActivities, workspaceActivities, forWorkspace } = require('../src/services/chatActivityService');
const { decode, encode } = require('../src/utils/chatCursor');
const wid='a'.repeat(24), other='b'.repeat(24), at=new Date().toISOString();
test('shared team activity retains important updates without exposing private grading or other teams',()=>{
 const publication={weightedTotal:80,note:'Final result',publishedAt:at};
 const ledger={history:[{_id:'assignment1',workspace:wid,to:{id:other,name:'Supervisor'},createdAt:at}],reviews:[{_id:'review1',workspace:wid,version:1,decision:'rejected',comment:'Revise the objectives.',reviewer:{name:'Supervisor'},createdAt:at}],resources:[{workspace:wid,events:[{id:'resource1',action:'add',title:'Report',actor:{name:'Student'},createdAt:at}]}],defences:[{_id:other,workspace:wid,history:[],evaluation:{records:[{comment:'PRIVATE DRAFT',scores:[{marks:20}]}],history:[{_id:'draft1',type:'save',createdAt:at}]}}]};
 let events=ledgerActivities(ledger);assert.equal(events.length,3);assert.equal(JSON.stringify(events).includes('PRIVATE DRAFT'),false);assert.equal(JSON.stringify(events).includes('scores'),false);
 ledger.chatActivities=events;ledger.resources[0].events=[];events=ledgerActivities(ledger);assert.ok(events.some(event=>event.key.includes('resource1')),'Older activity survives source pruning');
 ledger.defences[0].evaluation.publication=publication;ledger.chatActivities=ledgerActivities(ledger);
 ledger.defences[0].evaluation.publication={...publication,weightedTotal:90,note:'Corrected'};ledger.defences[0].evaluation.publicationVersions=[{publication}];ledger.defences[0].evaluation.history.push({_id:'correct1',type:'correct',reason:'Verified marks',createdAt:at});
 events=ledgerActivities(ledger);assert.equal(events.find(event=>event.title==='Result Published').text.includes('80.00'),true);assert.equal(events.filter(event=>event.title==='Result Updated').length,1);
 const room={_id:wid,proposalVersions:[],teamEvents:[]};assert.ok(forWorkspace(room,{...ledger,chatActivities:events}).some(event=>event.title==='Result Updated'));assert.equal(forWorkspace({...room,_id:'c'.repeat(24)},ledger).length,0);
});
test('new requests preserve earlier submissions and chat cursors reject malformed payloads',()=>{
 const room={_id:wid,supervisorRequest:{revision:1,submittedAt:at}};room.chatActivities=workspaceActivities(room);room.supervisorRequest={revision:2,submittedAt:at};assert.equal(workspaceActivities(room).length,2);
 const entry={id:`system:review:${other}`,createdAt:at};assert.deepEqual(decode(encode(entry)),{id:entry.id,at});assert.equal(decode('invalid'),null);assert.equal(decode(Buffer.from(JSON.stringify({at,id:'javascript:alert(1)'})).toString('base64url')),null);
});
