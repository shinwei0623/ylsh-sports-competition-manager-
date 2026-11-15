const BUILD = 'INTEGRATED-2.0.0';
const DB_PROP = 'SPREADSHEET_ID';
const ADMIN_PROP = 'ADMIN_EMAIL';
const SHEMAS = {
  Settings:['key','value','updatedAt'],
  Events:['eventId','name','category','status','capacity','createdAt','dataOrigin','demoBatchId','schoolId','eventType','gender','gradeGroup','teamMin','teamMax','registrationOpenAt','registrationCloseAt','eventDate','venue','scoringRule','notes','updatedAt'],
  Categories:['categoryId','eventId','name','eventType','gender','gradeGroup','teamMin','teamMax','capacity','status','createdAt','updatedAt'],
  Registrations:['registrationId','eventId','className','seatNo','studentName','status','requestId','createdAt','dataOrigin','demoBatchId','schoolId','categoryId','registrantEmail','teamName','contactPhone','verifiedAt','updatedAt'],
  RegistrationMembers:['memberId','registrationId','playerId','studentId','className','seatNo','studentName','role','orderNo','createdAt'],
  CheckIns:['checkInId','registrationId','eventId','method','status','checkedInAt','checkerEmail','requestId','notes'],
  Draws:['drawId','eventId','categoryId','registrationId','seedNo','laneNo','groupNo','positionNo','createdAt','createdBy'],
  Matches:['matchId','eventId','categoryId','roundName','matchNo','scheduledAt','venue','sideARegistrationId','sideBRegistrationId','status','winnerRegistrationId','scoreA','scoreB','updatedAt'],
  Results:['resultId','eventId','categoryId','registrationId','rank','score','unit','resultStatus','notes','updatedAt','updatedBy'],
  RoleAssignments:['assignmentId','email','role','scopeType','scopeId','status','createdAt','updatedAt'],
  AuditLogs:['logId','action','recordId','at','details','actorEmail','role','requestId']
};

function doGet(e){
  const mode=clean_(e&&e.parameter&&(e.parameter.view||e.parameter.mode)).toLowerCase();
  const adminMode=mode==='admin'||mode==='manage';
  return HtmlService.createHtmlOutputFromFile(adminMode?'Admin':'Index')
    .setTitle(adminMode?'體育競賽管理中心｜宜蘭高中':'體育競賽報名系統｜宜蘭高中')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDb_(){
  const id=PropertiesService.getScriptProperties().getProperty(DB_PROP);
  if(!id) throw new Error('尚未設定資料庫');
  return SpreadsheetApp.openById(id);
}
function now_(){return new Date().toISOString();}
function uid_(prefix){return prefix+'-'+Utilities.getUuid();}
function clean_(v){return String(v===undefined||v===null?'':v).trim();}
function sheet_(name){
  const s=getDb_().getSheetByName(name); if(!s) throw new Error('缺少資料表：'+name); return s;
}
function table_(name){
  const s=sheet_(name), width=Math.max(s.getLastColumn(),SHEMAS[name]?SHEMAS[name].length:1);
  const h=s.getRange(1,1,1,width).getDisplayValues()[0].map(clean_);
  const last=s.getLastRow(); const values=last>1?s.getRange(2,1,last-1,width).getValues():[];
  return {sheet:s,headers:h,rows:values.map((r,i)=>rowObj_(h,r,i+2))};
}
function rowObj_(headers,row,rowNumber){
  const o={_row:rowNumber}; headers.forEach((h,i)=>{if(h)o[h]=serialize_(row[i]);}); return o;
}
function serialize_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Taipei',"yyyy-MM-dd'T'HH:mm:ssXXX"):v;}
function mapRow_(headers,obj){return headers.map(h=>obj[h]===undefined?'':obj[h]);}
function append_(name,obj){
  const t=table_(name); t.sheet.getRange(t.sheet.getLastRow()+1,1,1,t.headers.length).setValues([mapRow_(t.headers,obj)]); return obj;
}
function update_(name,idKey,id,obj){
  const t=table_(name), row=t.rows.find(r=>clean_(r[idKey])===clean_(id)); if(!row)throw new Error('找不到資料');
  const merged=Object.assign({},row,obj); delete merged._row;
  t.sheet.getRange(row._row,1,1,t.headers.length).setValues([mapRow_(t.headers,merged)]); return merged;
}
function upsert_(name,idKey,obj){
  const id=obj[idKey], t=table_(name), row=t.rows.find(r=>clean_(r[idKey])===clean_(id));
  return row?update_(name,idKey,id,obj):append_(name,obj);
}
function settingMap_(){
  const out={}; table_('Settings').rows.forEach(r=>{if(r.key)out[r.key]=r.value;}); return out;
}

function actor_(){
  const email=clean_(Session.getActiveUser().getEmail()).toLowerCase();
  const admin=clean_(PropertiesService.getScriptProperties().getProperty(ADMIN_PROP)).toLowerCase();
  const roles=[]; if(email&&email===admin)roles.push({role:'SYSTEM_ADMIN',scopeType:'SYSTEM',scopeId:'*'});
  if(email){
    table_('RoleAssignments').rows.filter(r=>clean_(r.email).toLowerCase()===email&&clean_(r.status||'ACTIVE')==='ACTIVE')
      .forEach(r=>roles.push({role:r.role,scopeType:r.scopeType,scopeId:r.scopeId}));
  }
  return {email:email,displayName:email?email.split('@')[0]:'訪客',roles:roles,isAdmin:roles.some(r=>r.role==='SYSTEM_ADMIN')};
}
function requireRole_(allowed,scopeId){
  const a=actor_(); const ok=a.roles.some(r=>allowed.includes(r.role)&&(r.scopeId==='*'||!scopeId||r.scopeId===scopeId));
  if(!ok)throw new Error('沒有執行此操作的權限'); return a;
}
function canManageEvent_(eventId){return requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN','CHECKIN'],eventId);}
function audit_(action,recordId,details,requestId,role){
  const a=actor_(); append_('AuditLogs',{logId:uid_('LOG'),action:action,recordId:recordId,at:now_(),details:JSON.stringify(details||{}),actorEmail:a.email,role:role||'',requestId:requestId||''});
}
function envelope_(fn){
  const requestId=uid_('REQ'),started=Date.now();
  try{return {ok:true,data:fn(requestId),error:null,meta:{requestId:requestId,build:BUILD,durationMs:Date.now()-started}};}
  catch(e){console.error(requestId,e&&e.stack||e);return {ok:false,data:null,error:{code:'APP_ERROR',message:e.message||String(e)},meta:{requestId:requestId,build:BUILD}};}
}

function installOrUpgradeSystem(){
  return envelope_(function(){
    const db=getDb_(); Object.keys(SHEMAS).forEach(name=>{
      let s=db.getSheetByName(name); if(!s)s=db.insertSheet(name);
      const expected=SHEMAS[name], width=Math.max(s.getLastColumn(),1); let headers=s.getRange(1,1,1,width).getDisplayValues()[0].map(clean_);
      expected.forEach(h=>{if(!headers.includes(h)){headers.push(h);s.getRange(1,headers.length).setValue(h);}});
      s.setFrozenRows(1); s.getRange(1,1,1,headers.length).setBackground('#004B97').setFontColor('#FFFFFF').setFontWeight('bold').setWrap(true);
    });
    const settings={schoolName:'國立宜蘭高級中學',themeColor:'#004B97',setupComplete:'TRUE',schemaVersion:'1.0.0'};
    Object.keys(settings).forEach(k=>{const row=table_('Settings').rows.find(r=>r.key===k); if(row)update_('Settings','key',k,{value:row.value||settings[k],updatedAt:now_()});else append_('Settings',{key:k,value:settings[k],updatedAt:now_()});});
    audit_('SYSTEM_UPGRADED','SYSTEM',{schemaVersion:'1.0.0'}); return {schemaVersion:'1.0.0'};
  });
}

function apiBootstrap(){
  return envelope_(function(){
    const a=actor_(), settings=settingMap_(), events=table_('Events').rows.filter(r=>!['DELETED','DRAFT'].includes(r.status)), categories=table_('Categories').rows.filter(r=>r.status!=='DELETED');
    const regs=table_('Registrations').rows.filter(r=>clean_(r.registrantEmail).toLowerCase()===a.email);
    const checkins=table_('CheckIns').rows, results=table_('Results').rows;
    return {actor:a,settings:settings,events:events,categories:categories,registrations:regs,checkIns:checkins,results:results,counts:{events:events.length,openEvents:events.filter(e=>e.status==='OPEN').length,registrations:table_('Registrations').rows.length,checkedIn:checkins.filter(c=>c.status==='PRESENT').length}};
  });
}

function apiSaveEvent(input){
  return envelope_(function(req){
    const a=requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN']); input=input||{};
    if(!clean_(input.name))throw new Error('請輸入競賽名稱');
    const id=clean_(input.eventId)||uid_('EVT'), old=table_('Events').rows.find(r=>r.eventId===id), stamp=now_();
    const rec={eventId:id,name:clean_(input.name),category:clean_(input.category||'綜合'),status:clean_(input.status||'DRAFT'),capacity:Number(input.capacity||0),createdAt:old?old.createdAt:stamp,dataOrigin:old?old.dataOrigin:'SYSTEM',demoBatchId:old?old.demoBatchId:'',schoolId:clean_(input.schoolId||'YLSH'),eventType:clean_(input.eventType||'INDIVIDUAL'),gender:clean_(input.gender||'OPEN'),gradeGroup:clean_(input.gradeGroup||'ALL'),teamMin:Number(input.teamMin||1),teamMax:Number(input.teamMax||1),registrationOpenAt:clean_(input.registrationOpenAt),registrationCloseAt:clean_(input.registrationCloseAt),eventDate:clean_(input.eventDate),venue:clean_(input.venue),scoringRule:clean_(input.scoringRule),notes:clean_(input.notes),updatedAt:stamp};
    old?update_('Events','eventId',id,rec):append_('Events',rec); audit_('EVENT_SAVED',id,rec,req,a.roles[0].role); return rec;
  });
}
function apiSaveCategory(input){
  return envelope_(function(req){
    requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN'],input.eventId); const stamp=now_(),id=clean_(input.categoryId)||uid_('CAT');
    const old=table_('Categories').rows.find(r=>r.categoryId===id); const rec={categoryId:id,eventId:clean_(input.eventId),name:clean_(input.name),eventType:clean_(input.eventType||'INDIVIDUAL'),gender:clean_(input.gender||'OPEN'),gradeGroup:clean_(input.gradeGroup||'ALL'),teamMin:Number(input.teamMin||1),teamMax:Number(input.teamMax||1),capacity:Number(input.capacity||0),status:clean_(input.status||'OPEN'),createdAt:old?old.createdAt:stamp,updatedAt:stamp};
    if(!rec.eventId||!rec.name)throw new Error('請選擇競賽並輸入組別名稱'); old?update_('Categories','categoryId',id,rec):append_('Categories',rec); audit_('CATEGORY_SAVED',id,rec,req); return rec;
  });
}

function apiSubmitRegistration(input){
  return envelope_(function(req){
    input=input||{}; const a=actor_(); if(!a.email)throw new Error('請使用學校 Google 帳號登入');
    const event=table_('Events').rows.find(e=>e.eventId===input.eventId); if(!event)throw new Error('找不到競賽'); if(event.status!=='OPEN')throw new Error('本競賽目前未開放報名');
    const close=clean_(event.registrationCloseAt); if(close&&new Date(close).getTime()<Date.now())throw new Error('報名已截止');
    if(!clean_(input.requestId))throw new Error('缺少請求識別碼'); const dup=table_('Registrations').rows.find(r=>r.requestId===input.requestId); if(dup)return dup;
    const members=Array.isArray(input.members)?input.members.filter(m=>clean_(m.studentName)):[];
    if(!members.length&&clean_(input.studentName))members.push({studentName:input.studentName,className:input.className,seatNo:input.seatNo,studentId:input.studentId});
    const min=Math.max(1,Number(event.teamMin||1)),max=Math.max(min,Number(event.teamMax||1)); if(members.length<min||members.length>max)throw new Error('參賽人數須為 '+min+'–'+max+' 人');
    const id=uid_('REG'),stamp=now_(),rec={registrationId:id,eventId:event.eventId,className:clean_(input.className||members[0].className),seatNo:clean_(input.seatNo||members[0].seatNo),studentName:clean_(input.studentName||members[0].studentName),status:'REGISTERED',requestId:input.requestId,createdAt:stamp,dataOrigin:'USER',demoBatchId:'',schoolId:clean_(input.schoolId||event.schoolId||'YLSH'),categoryId:clean_(input.categoryId),registrantEmail:a.email,teamName:clean_(input.teamName),contactPhone:clean_(input.contactPhone),verifiedAt:stamp,updatedAt:stamp};
    const lock=LockService.getScriptLock();lock.waitLock(20000);try{append_('Registrations',rec);members.forEach((m,i)=>append_('RegistrationMembers',{memberId:uid_('MEM'),registrationId:id,playerId:clean_(m.playerId),studentId:clean_(m.studentId),className:clean_(m.className||rec.className),seatNo:clean_(m.seatNo),studentName:clean_(m.studentName),role:i===0?'CAPTAIN':'MEMBER',orderNo:i+1,createdAt:stamp}));}finally{lock.releaseLock();}
    audit_('REGISTRATION_CREATED',id,{eventId:event.eventId,members:members.length},input.requestId,'USER'); return rec;
  });
}
function apiCancelRegistration(id){
  return envelope_(function(req){const a=actor_(),r=table_('Registrations').rows.find(x=>x.registrationId===id);if(!r)throw new Error('找不到報名資料');if(!a.isAdmin&&clean_(r.registrantEmail).toLowerCase()!==a.email)throw new Error('沒有取消權限');const out=update_('Registrations','registrationId',id,{status:'CANCELLED',updatedAt:now_()});audit_('REGISTRATION_CANCELLED',id,{},req);return out;});
}

function apiCheckIn(input){
  return envelope_(function(req){input=input||{};const r=table_('Registrations').rows.find(x=>x.registrationId===input.registrationId);if(!r)throw new Error('找不到報名資料');const a=canManageEvent_(r.eventId);const prior=table_('CheckIns').rows.find(c=>c.registrationId===r.registrationId&&c.status==='PRESENT');if(prior)return prior;const rec={checkInId:uid_('CHK'),registrationId:r.registrationId,eventId:r.eventId,method:clean_(input.method||'MANUAL'),status:'PRESENT',checkedInAt:now_(),checkerEmail:a.email,requestId:clean_(input.requestId||req),notes:clean_(input.notes)};append_('CheckIns',rec);update_('Registrations','registrationId',r.registrationId,{status:'CHECKED_IN',updatedAt:now_()});audit_('CHECKED_IN',r.registrationId,rec,rec.requestId,'CHECKIN');return rec;});
}

function shuffle_(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}
function apiGenerateDraw(input){
  return envelope_(function(req){input=input||{};const a=requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN'],input.eventId);const existing=table_('Draws').rows.filter(d=>d.eventId===input.eventId);if(existing.length)throw new Error('此競賽已有抽籤結果，為避免重複資料已停止操作');const regs=table_('Registrations').rows.filter(r=>r.eventId===input.eventId&&!['CANCELLED','REJECTED','DISQUALIFIED'].includes(r.status));if(!regs.length)throw new Error('沒有可抽籤的報名資料');const stamp=now_(),size=Math.max(2,Number(input.groupSize||8)),shuffled=shuffle_(regs.slice()),out=[];shuffled.forEach((r,i)=>{const d={drawId:uid_('DRW'),eventId:r.eventId,categoryId:r.categoryId,registrationId:r.registrationId,seedNo:i+1,laneNo:(i%size)+1,groupNo:Math.floor(i/size)+1,positionNo:i+1,createdAt:stamp,createdBy:a.email};append_('Draws',d);out.push(d);});audit_('DRAW_GENERATED',input.eventId,{count:out.length,groupSize:size},req);return out;});
}
function apiListCompetition(eventId){
  return envelope_(function(){const events=table_('Events').rows,regs=table_('Registrations').rows,draws=table_('Draws').rows,results=table_('Results').rows,matches=table_('Matches').rows;return {event:events.find(e=>e.eventId===eventId),registrations:regs.filter(r=>r.eventId===eventId),draws:draws.filter(d=>d.eventId===eventId),results:results.filter(r=>r.eventId===eventId),matches:matches.filter(m=>m.eventId===eventId)};});
}
function apiSaveResult(input){
  return envelope_(function(req){input=input||{};const a=requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN'],input.eventId);if(!input.registrationId)throw new Error('請選擇參賽者');const prior=table_('Results').rows.find(r=>r.eventId===input.eventId&&r.registrationId===input.registrationId);const rec={resultId:prior?prior.resultId:uid_('RES'),eventId:input.eventId,categoryId:clean_(input.categoryId),registrationId:input.registrationId,rank:Number(input.rank||0),score:clean_(input.score),unit:clean_(input.unit),resultStatus:clean_(input.resultStatus||'OFFICIAL'),notes:clean_(input.notes),updatedAt:now_(),updatedBy:a.email};prior?update_('Results','resultId',prior.resultId,rec):append_('Results',rec);audit_('RESULT_SAVED',rec.resultId,rec,req);return rec;});
}
function apiSaveRole(input){
  return envelope_(function(req){requireRole_(['SYSTEM_ADMIN']);input=input||{};if(!clean_(input.email)||!clean_(input.role))throw new Error('請填寫帳號與角色');const id=clean_(input.assignmentId)||uid_('ROLE'),old=table_('RoleAssignments').rows.find(r=>r.assignmentId===id),stamp=now_(),rec={assignmentId:id,email:clean_(input.email).toLowerCase(),role:clean_(input.role),scopeType:clean_(input.scopeType||'SYSTEM'),scopeId:clean_(input.scopeId||'*'),status:clean_(input.status||'ACTIVE'),createdAt:old?old.createdAt:stamp,updatedAt:stamp};old?update_('RoleAssignments','assignmentId',id,rec):append_('RoleAssignments',rec);audit_('ROLE_SAVED',id,rec,req);return rec;});
}
function apiUpdateRegistrationStatus(input){
  return envelope_(function(req){
    input=input||{};const r=table_('Registrations').rows.find(x=>x.registrationId===input.registrationId);if(!r)throw new Error('找不到報名資料');
    const a=requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN'],r.eventId),allowed=['REGISTERED','APPROVED','REJECTED','CANCELLED','CHECKED_IN','DISQUALIFIED'];
    const status=clean_(input.status).toUpperCase();if(!allowed.includes(status))throw new Error('不支援的報名狀態');
    const out=update_('Registrations','registrationId',r.registrationId,{status:status,verifiedAt:status==='APPROVED'?now_():r.verifiedAt,updatedAt:now_()});
    audit_('REGISTRATION_STATUS',r.registrationId,{from:r.status,to:status,note:clean_(input.note)},req,a.roles[0]&&a.roles[0].role);return out;
  });
}
function apiSaveSettings(input){
  return envelope_(function(req){
    requireRole_(['SYSTEM_ADMIN']);input=input||{};const values={schoolName:clean_(input.schoolName),themeColor:clean_(input.themeColor)};
    if(!values.schoolName)throw new Error('請輸入學校名稱');if(!/^#[0-9a-fA-F]{6}$/.test(values.themeColor))throw new Error('主題色格式不正確');
    Object.keys(values).forEach(k=>{const old=table_('Settings').rows.find(r=>r.key===k);old?update_('Settings','key',k,{value:values[k],updatedAt:now_()}):append_('Settings',{key:k,value:values[k],updatedAt:now_()});});
    audit_('SETTINGS_SAVED','SYSTEM',values,req,'SYSTEM_ADMIN');return values;
  });
}
function apiSaveMatch(input){
  return envelope_(function(req){
    input=input||{};const a=requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN'],input.eventId);if(!clean_(input.eventId)||!clean_(input.roundName))throw new Error('請選擇競賽並輸入賽程輪次');
    const id=clean_(input.matchId)||uid_('MAT'),old=table_('Matches').rows.find(r=>r.matchId===id),rec={matchId:id,eventId:clean_(input.eventId),categoryId:clean_(input.categoryId),roundName:clean_(input.roundName),matchNo:clean_(input.matchNo),scheduledAt:clean_(input.scheduledAt),venue:clean_(input.venue),sideARegistrationId:clean_(input.sideARegistrationId),sideBRegistrationId:clean_(input.sideBRegistrationId),status:clean_(input.status||'SCHEDULED'),winnerRegistrationId:clean_(input.winnerRegistrationId),scoreA:clean_(input.scoreA),scoreB:clean_(input.scoreB),updatedAt:now_()};
    old?update_('Matches','matchId',id,rec):append_('Matches',rec);audit_('MATCH_SAVED',id,rec,req,a.roles[0]&&a.roles[0].role);return rec;
  });
}
function apiAdminModel(){
  return envelope_(function(){const actor=requireRole_(['SYSTEM_ADMIN','EVENT_ADMIN','CHECKIN','CLASS_ADMIN']);return {build:BUILD,actor:actor,settings:settingMap_(),events:table_('Events').rows.filter(r=>r.status!=='DELETED'),categories:table_('Categories').rows.filter(r=>r.status!=='DELETED'),registrations:table_('Registrations').rows,members:table_('RegistrationMembers').rows,checkIns:table_('CheckIns').rows,draws:table_('Draws').rows,matches:table_('Matches').rows,results:table_('Results').rows,roles:table_('RoleAssignments').rows,auditLogs:table_('AuditLogs').rows.slice(-80).reverse()};});
}
