import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(process.env.SPORTS_TEST_SOURCE||path.join(root,'gas/integrated/Code.gs'),'utf8');

function system(){
  let email='owner@example.test',n=0,locked=false,onLock=null,failTable=null;
  const data={},reads=[],writes=[];
  function sheet(name){
    if(!data[name])return null;
    const api={getLastColumn:()=>data[name][0].length,getLastRow:()=>data[name].length,
      getRange:(row,col,height=1,width=1)=>({
        getValues(){reads.push({name,locked});return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>data[name][row-1+i]?.[col-1+j]??''));},
        getDisplayValues(){return this.getValues().map(r=>r.map(String));},
        setValues(rows){if(failTable===name){failTable=null;throw new Error('Injected sheet write failure');}writes.push({name,locked});rows.forEach((r,i)=>r.forEach((v,j)=>{data[name][row-1+i]??=[];data[name][row-1+i][col-1+j]=v;}));return this;},
        setValue(v){return this.setValues([[v]]);},setBackground(){return this;},setFontColor(){return this;},setFontWeight(){return this;},setWrap(){return this;}
      }),setFrozenRows(){}};return api;
  }
  const db={getSheetByName:sheet,insertSheet(name){data[name]=[['']];return sheet(name);}};
  const ctx=vm.createContext({console:{error(){}},Date,Math,Set,Map,
    Session:{getActiveUser:()=>({getEmail:()=>email})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>({SPREADSHEET_ID:'isolated-in-memory-db',ADMIN_EMAIL:'owner@example.test'}[k]||'')})},
    SpreadsheetApp:{openById:()=>db},ScriptApp:{getService:()=>({getUrl:()=>"https://script.google.com/macros/s/TEST-ONLY/exec"})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algorithm,text)=>Array.from(createHash(algorithm).update(text).digest()),getUuid:()=>String(++n),formatDate:v=>v.toISOString()},
    LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false,'nested lock');locked=true;if(onLock){const hook=onLock;onLock=null;hook();}},releaseLock(){locked=false;}})},
    HtmlService:{createHtmlOutputFromFile:file=>({file,setTitle(){return this;},setXFrameOptionsMode(){return this;}}),XFrameOptionsMode:{ALLOWALL:'ALLOWALL'}}});
  vm.runInContext(source,ctx);
  const schemas=vm.runInContext('SHEMAS',ctx);
  for(const [name,headers] of Object.entries(schemas))data[name]=[[...headers]];
  const add=(name,row)=>data[name].push(data[name][0].map(h=>row[h]??''));
  const rows=name=>data[name].slice(1).map(r=>Object.fromEntries(data[name][0].map((h,i)=>[h,r[i]])));
  const api=(name,...args)=>JSON.parse(JSON.stringify(ctx[name](...args)));
  const good=(name,...args)=>{const r=api(name,...args);assert.equal(r.ok,true,r.error?.message);return r.data;};
  const bad=(name,...args)=>{const r=api(name,...args);assert.equal(r.ok,false,`${name} unexpectedly allowed`);return r.error;};
  const login=v=>{email=v;};
  const event=(id='E1',extra={})=>add('Events',{eventId:id,name:'Synthetic competition',status:'OPEN',teamMin:1,teamMax:1,capacity:20,...extra});
  const role=(role,scopeType,scopeId)=>add('RoleAssignments',{assignmentId:'role-'+(++n),email,role,scopeType,scopeId,status:'ACTIVE'});
  const reg=(id='R1',eventId='E1',extra={})=>add('Registrations',{registrationId:id,eventId,registrantEmail:'student@example.test',className:'101',studentName:'Synthetic student',contactPhone:'PRIVATE_PHONE',requestId:'request-'+id,status:'APPROVED',...extra});
  const input=(extra={})=>({eventId:'E1',className:'101',requestId:'request-0001',members:[{studentName:'Synthetic student',studentId:'TEST001',className:'101'}],...extra});
  return {ctx,api,good,bad,login,event,role,reg,input,add,rows,reads,writes,data,failNext:name=>{failTable=name;},onLock:fn=>{onLock=fn;}};
}

test('full isolated API flow: create, submit, approve, check-in, draw, schedule, result, public read',()=>{
 const s=system();const ev=s.good('apiSaveEvent',{requestId:'create-event-0001',name:'Synthetic run',status:'OPEN',teamMin:1,teamMax:1});
 s.login('student@example.test');const r=s.good('apiSubmitRegistration',s.input({eventId:ev.eventId}));
 const boot=s.good('apiBootstrap');assert.equal(boot.registrations[0].registrationId,r.registrationId);assert.equal(boot.navigation.admin,'https://script.google.com/macros/s/TEST-ONLY/exec?view=admin');
 s.login('owner@example.test');s.good('apiUpdateRegistrationStatus',{registrationId:r.registrationId,status:'APPROVED'});
 const check=s.good('apiCheckIn',{registrationId:r.registrationId});
 assert.equal(s.good('apiCheckIn',{registrationId:r.registrationId}).checkInId,check.checkInId);
 assert.equal(s.good('apiGenerateDraw',{eventId:ev.eventId,groupSize:8}).length,1);
 s.good('apiSaveMatch',{requestId:'create-match-0001',eventId:ev.eventId,roundName:'Final',sideARegistrationId:r.registrationId,scheduledAt:'2026-11-26T09:00'});
 s.good('apiSaveResult',{eventId:ev.eventId,registrationId:r.registrationId,rank:1,score:'12.3',unit:'秒'});
 s.good('apiSaveResult',{eventId:ev.eventId,registrationId:r.registrationId,rank:1,score:'12.1',unit:'秒'});
 assert.equal(s.rows('Results').length,1);assert.equal(s.rows('CheckIns').length,1);
 s.login('other@example.test');const c=s.good('apiListCompetition',ev.eventId);
 assert.equal(c.results[0].score,'12.1');assert.equal(c.matches.length,1);
 assert.ok(s.rows('AuditLogs').some(a=>a.action==='RESULT_SAVED'));
});
test('public competition DTO omits private contact, email, student identity and request ID',()=>{
 const s=system();s.event();s.reg();s.login('other@example.test');
 const c=s.good('apiListCompetition','E1');
 assert.deepEqual(Object.keys(c.registrations[0]).sort(),['className','registrationId','teamName']);
 assert.ok(!JSON.stringify(c).includes('PRIVATE_PHONE'));
});
test('anonymous bootstrap never matches legacy records with blank owner',()=>{
 const s=system();s.event();s.reg('R1','E1',{registrantEmail:''});s.login('');
 assert.equal(s.good('apiBootstrap').registrations.length,0);s.bad('apiCancelRegistration','R1');
});
test('bootstrap limits settings and check-in rows to current user',()=>{
 const s=system();s.event();s.reg();s.add('Settings',{key:'internalSetting',value:'PRIVATE'});
 s.add('CheckIns',{registrationId:'R1',eventId:'E1',checkerEmail:'staff@example.test',status:'PRESENT'});
 s.login('other@example.test');const b=s.good('apiBootstrap');assert.deepEqual(b.checkIns,[]);assert.equal(b.settings.internalSetting,undefined);
});
test('scoped event manager cannot edit another event or create global events',()=>{
 const s=system();s.event('E1');s.event('E2');s.login('manager@example.test');s.role('EVENT_ADMIN','EVENT','E1');
 s.bad('apiSaveEvent',{eventId:'E2',name:'unauthorized'});s.bad('apiSaveEvent',{name:'global'});
 s.good('apiSaveEvent',{eventId:'E1',name:'allowed'});
});
test('scoped manager model filters registrations, members, audit and assignments',()=>{
 const s=system();s.event('E1');s.event('E2');s.reg('R1','E1');s.reg('R2','E2');
 s.add('RegistrationMembers',{memberId:'M1',registrationId:'R1'});s.add('RegistrationMembers',{memberId:'M2',registrationId:'R2'});
 s.add('AuditLogs',{action:'PRIVATE'});s.login('manager@example.test');s.role('EVENT_ADMIN','EVENT','E1');
 const m=s.good('apiAdminModel');assert.deepEqual(m.events.map(e=>e.eventId),['E1']);assert.deepEqual(m.registrations.map(r=>r.registrationId),['R1']);assert.equal(m.members.length,1);assert.deepEqual(m.roles,[]);assert.deepEqual(m.auditLogs,[]);
});
test('class manager sees only assigned class and cannot grant roles',()=>{
 const s=system();s.event();s.reg('R1','E1',{className:'101'});s.reg('R2','E1',{className:'102'});
 s.login('teacher@example.test');s.role('CLASS_ADMIN','CLASS','101');assert.equal(s.good('apiAdminModel').registrations.length,1);
 s.bad('apiSaveRole',{email:'attacker@example.test',role:'SYSTEM_ADMIN'});
});
test('unprivileged caller cannot run schema installer',()=>{
 const s=system();s.login('student@example.test');s.bad('installOrUpgradeSystem');assert.equal(s.writes.length,0);
});
test('registration idempotency is checked after acquiring the write lock',()=>{
 const s=system();s.event();s.login('student@example.test');
 s.onLock(()=>s.reg('R-race','E1',{requestId:'request-0001',status:'REGISTERED'}));
 assert.equal(s.good('apiSubmitRegistration',s.input()).registrationId,'R-race');assert.equal(s.rows('Registrations').length,1);
});
test('request ID collision cannot return another user registration',()=>{
 const s=system();s.event();s.reg('R1','E1',{requestId:'request-0001'});s.login('other@example.test');s.bad('apiSubmitRegistration',s.input());
});
test('retries reuse the original record and do not duplicate members',()=>{
 const s=system();s.event();s.login('student@example.test');const a=s.good('apiSubmitRegistration',s.input());
 assert.equal(s.good('apiSubmitRegistration',s.input()).registrationId,a.registrationId);assert.equal(s.rows('RegistrationMembers').length,1);
});
test('registration rejects closed, future, expired or malformed dates',()=>{
 for(const props of [{status:'CLOSED'},{registrationOpenAt:'2999-01-01T09:00'},{registrationCloseAt:'2000-01-01T09:00'},{registrationCloseAt:'invalid'}]){
  const s=system();s.event('E1',props);s.login('student@example.test');s.bad('apiSubmitRegistration',s.input());assert.equal(s.rows('Registrations').length,0);
 }
});
test('registration capacity and member limits are enforced',()=>{
 const s=system();s.event('E1',{capacity:1});s.reg();s.login('student@example.test');s.bad('apiSubmitRegistration',s.input());
 const t=system();t.event('E1',{teamMin:2,teamMax:3});t.login('student@example.test');t.bad('apiSubmitRegistration',t.input());
});
test('foreign or closed category is rejected',()=>{
 const s=system();s.event();s.add('Categories',{categoryId:'C2',eventId:'E2',status:'OPEN'});s.login('student@example.test');s.bad('apiSubmitRegistration',s.input({categoryId:'C2'}));
});
test('duplicate student IDs rejected within one team and across active entries',()=>{
 const s=system();s.event('E1',{teamMax:3});s.login('student@example.test');const m=s.input().members[0];s.bad('apiSubmitRegistration',s.input({members:[m,m]}));
 s.good('apiSubmitRegistration',s.input());s.bad('apiSubmitRegistration',s.input({requestId:'request-0002'}));
});
test('pending, cancelled and rejected registrations cannot check in or enter a draw',()=>{
 for(const status of ['REGISTERED','CANCELLED','REJECTED','DISQUALIFIED']){const s=system();s.event();s.reg('R1','E1',{status});s.bad('apiCheckIn',{registrationId:'R1'});s.bad('apiGenerateDraw',{eventId:'E1'});}
});
test('check-in role cannot check another event or save results',()=>{
 const s=system();s.event('E1');s.event('E2');s.reg('R1','E1');s.reg('R2','E2');s.login('checker@example.test');s.role('CHECKIN','EVENT','E1');
 s.good('apiCheckIn',{registrationId:'R1'});s.bad('apiCheckIn',{registrationId:'R2'});s.bad('apiSaveResult',{eventId:'E1',registrationId:'R1'});
});
test('draw locks writes and prevents regeneration',()=>{
 const s=system();s.event();s.reg();s.good('apiGenerateDraw',{eventId:'E1'});s.bad('apiGenerateDraw',{eventId:'E1'});assert.equal(s.rows('Draws').length,1);assert.ok(s.writes.filter(x=>x.name==='Draws').every(x=>x.locked));
});
test('draft competition, provisional results and private results metadata stay hidden',()=>{
 const s=system();s.event('E1',{status:'DRAFT'});s.bad('apiListCompetition','E1');
 const t=system();t.event();t.reg();t.add('Results',{eventId:'E1',registrationId:'R1',resultStatus:'PROVISIONAL',updatedBy:'PRIVATE'});assert.deepEqual(t.good('apiListCompetition','E1').results,[]);
});
test('match and result relations cannot refer to another event or same opponent',()=>{
 const s=system();s.event('E1');s.event('E2');s.reg('R2','E2');s.bad('apiSaveResult',{eventId:'E1',registrationId:'R2'});s.bad('apiSaveMatch',{eventId:'E1',roundName:'Final',sideARegistrationId:'R2'});
 s.reg('R1','E1');s.bad('apiSaveMatch',{eventId:'E1',roundName:'Final',sideARegistrationId:'R1',sideBRegistrationId:'R1'});
});
test('cannot reparent another managers existing category or match',()=>{
 const s=system();s.event('E1');s.event('E2');s.add('Categories',{categoryId:'C2',eventId:'E2'});s.add('Matches',{matchId:'M2',eventId:'E2'});
 s.login('manager@example.test');s.role('EVENT_ADMIN','EVENT','E1');s.bad('apiSaveCategory',{eventId:'E1',categoryId:'C2',name:'overwrite'});s.bad('apiSaveMatch',{eventId:'E1',matchId:'M2',roundName:'overwrite'});
});
test('event edit preserves capacity and scoring fields absent from the form',()=>{
 const s=system();s.event('E1',{capacity:3,scoringRule:'ascending'});const e=s.good('apiSaveEvent',{eventId:'E1',name:'changed'});assert.equal(e.capacity,3);assert.equal(e.scoringRule,'ascending');
});
test('invalid event IDs, roles, dates and ranges fail closed',()=>{
 const s=system();for(const x of [{eventId:"bad'",name:'x'},{name:'x',teamMin:4,teamMax:2},{name:'x',eventDate:'bad'}])s.bad('apiSaveEvent',x);
 s.bad('apiSaveRole',{email:'bad',role:'CHECKIN'});s.bad('apiSaveRole',{email:'a@example.test',role:'SYSTEM_ADMIN'});s.bad('apiSaveRole',{email:'a@example.test',role:'CLASS_ADMIN',scopeType:'SYSTEM',scopeId:'*'});
});
test('checked-in registrations cannot be cancelled or silently reset',()=>{
 const s=system();s.event();s.reg('R1','E1',{status:'CHECKED_IN'});s.bad('apiCancelRegistration','R1');s.bad('apiUpdateRegistrationStatus',{registrationId:'R1',status:'REGISTERED'});
});
test('Taipei datetime-local input is independent of test host timezone',()=>{
 const s=system();assert.equal(s.ctx.dateMs_('2026-11-26T09:00'),Date.parse('2026-11-26T01:00:00Z'));
});
test('frontends compile; every google.script.run API exists; navigation and print output render safely',()=>{
 for(const file of ['Index.html','Admin.html']){
  const html=fs.readFileSync(path.join(root,'gas/integrated',file),'utf8');const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(js,{filename:file});
  for(const [,name] of js.matchAll(/call\('([^']+)'/g))assert.match(source,new RegExp('function '+name+'\\('),name);
  if(file==='Index.html'){assert.ok(!html.includes('chart.googleapis.com'));assert.match(html,/requestId:S.requestId/);assert.match(html,/管理中心/);}
  else{
   const elements=new Map(),ctx=vm.createContext({document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);}},window:{print(){}},Date,console});
   vm.runInContext(js.replace(/reload\(\);\s*$/,''),ctx);
   vm.runInContext(`S.m={settings:{schoolName:'Test'},events:[{eventId:'E1',name:'Test event'}],registrations:[{registrationId:'R1',eventId:'E1',studentName:'<script>bad</script>',className:'101',status:'APPROVED'},{registrationId:'R2',eventId:'E1',status:'REGISTERED'}],draws:[{eventId:'E1',registrationId:'R1',groupNo:1,laneNo:1}],matches:[{eventId:'E1',roundName:'Final',sideARegistrationId:'R1',sideBRegistrationId:''}]}`,ctx);
   for(const type of ['checkin','draw','schedule','bib']){ctx.printDoc(type);const out=elements.get('printArea').innerHTML;assert.match(out,/<table>/);assert.ok(!out.includes('<script>bad'));if(type==='checkin'||type==='bib')assert.ok(!out.includes('R2'));}
   assert.match(html,/data-p="print"/);assert.match(html,/eventOpts\(\)\.replace\('請選擇','全部競賽'\)/);
  }
 }
});

test('event and match creation requests are idempotent without schema migration',()=>{
 const s=system();const input={requestId:'event-stable-0001',name:'Synthetic stable event',status:'OPEN'};
 const e=s.good('apiSaveEvent',input);assert.equal(s.good('apiSaveEvent',input).eventId,e.eventId);assert.equal(s.rows('Events').length,1);
 const m={requestId:'match-stable-0001',eventId:e.eventId,roundName:'Final'};
 assert.equal(s.good('apiSaveMatch',m).matchId,s.good('apiSaveMatch',m).matchId);assert.equal(s.rows('Matches').length,1);
});

test('registration retry repairs member-write failure before returning success',()=>{
 const s=system();s.event();s.login('student@example.test');s.failNext('RegistrationMembers');s.bad('apiSubmitRegistration',s.input());
 assert.equal(s.rows('Registrations')[0].status,'SUBMITTING');assert.equal(s.rows('RegistrationMembers').length,0);
 const r=s.good('apiSubmitRegistration',s.input());assert.equal(r.status,'REGISTERED');assert.equal(s.rows('Registrations').length,1);assert.equal(s.rows('RegistrationMembers').length,1);
});
test('registration recovery refuses changed request contents',()=>{
 const s=system();s.event();s.login('student@example.test');s.failNext('RegistrationMembers');s.bad('apiSubmitRegistration',s.input());
 s.bad('apiSubmitRegistration',s.input({teamName:'changed'}));assert.equal(s.rows('RegistrationMembers').length,0);
});
test('check-in retry reconciles parent after second-sheet failure',()=>{
 const s=system();s.event();s.reg();s.failNext('Registrations');s.bad('apiCheckIn',{registrationId:'R1'});
 assert.equal(s.rows('CheckIns').length,1);assert.equal(s.rows('Registrations')[0].status,'APPROVED');
 s.good('apiCheckIn',{registrationId:'R1'});assert.equal(s.rows('CheckIns').length,1);assert.equal(s.rows('Registrations')[0].status,'CHECKED_IN');
});
test('draw retry resumes persisted plan and keeps category groups separate',()=>{
 const s=system();s.event();s.reg('R1','E1',{categoryId:'C1'});s.reg('R2','E1',{categoryId:'C2'});s.failNext('Draws');s.bad('apiGenerateDraw',{eventId:'E1',groupSize:8});
 const d=s.good('apiGenerateDraw',{eventId:'E1',groupSize:8});assert.equal(d.length,2);assert.ok(d.every(r=>r.groupNo===1&&r.laneNo===1));assert.equal(s.rows('Draws').length,2);
});
test('blank student IDs are rejected and draft match/score fields stay private',()=>{
 const s=system();s.event();s.login('student@example.test');s.bad('apiSubmitRegistration',s.input({members:[{studentName:'x',className:'101',studentId:''}]}));
 s.login('owner@example.test');s.good('apiSaveMatch',{requestId:'draft-match-0001',eventId:'E1',roundName:'Draft',status:'DRAFT',scoreA:'PRIVATE_SCORE'});
 s.good('apiSaveMatch',{requestId:'open-match-0001',eventId:'E1',roundName:'Final',status:'SCHEDULED',scoreA:'PRIVATE_SCORE'});
 const c=s.good('apiListCompetition','E1');assert.equal(c.matches.length,1);assert.ok(!JSON.stringify(c).includes('PRIVATE_SCORE'));
});

test('incomplete registration cannot be approved or drawn before recovery',()=>{
 const s=system();s.event();s.login('student@example.test');s.failNext('RegistrationMembers');s.bad('apiSubmitRegistration',s.input());
 const id=s.rows('Registrations')[0].registrationId;s.login('owner@example.test');
 for(const status of ['APPROVED','REGISTERED','CHECKED_IN'])s.bad('apiUpdateRegistrationStatus',{registrationId:id,status});
 s.bad('apiGenerateDraw',{eventId:'E1'});s.bad('apiCheckIn',{registrationId:id});assert.equal(s.rows('Draws').length,0);
 s.login('student@example.test');s.good('apiSubmitRegistration',s.input());s.login('owner@example.test');s.good('apiUpdateRegistrationStatus',{registrationId:id,status:'APPROVED'});assert.equal(s.good('apiGenerateDraw',{eventId:'E1'}).length,1);
});
