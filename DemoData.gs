/**
 * Demo data administration. Only synthetic records tagged DEMO are removable.
 * Set Script Properties SPREADSHEET_ID and ADMIN_EMAIL before enabling actions.
 */
const DEMO_TABLES = {
  Events: ['eventId','name','category','status','capacity','createdAt','dataOrigin','demoBatchId'],
  Registrations: ['registrationId','eventId','className','seatNo','studentName','status','requestId','createdAt','dataOrigin','demoBatchId']
};
function demoConfig_() {
  const p=PropertiesService.getScriptProperties();
  const id=p.getProperty('SPREADSHEET_ID'), admin=(p.getProperty('ADMIN_EMAIL')||'').toLowerCase();
  if(!id || !admin) throw new Error('TEST 尚未完成資料庫及管理員設定');
  return {id,admin};
}
function demoAdmin_() {
  const c=demoConfig_();
  const email=(Session.getActiveUser().getEmail()||'').toLowerCase();
  if(!email || email!==c.admin) throw new Error('沒有管理員權限，或無法驗證 Google 身分');
  return c;
}
function demoSheet_(book,name) {
  const sheet=book.getSheetByName(name);
  if(!sheet) throw new Error('缺少工作表 '+name);
  const last=Math.max(sheet.getLastColumn(),1);
  const headers=sheet.getRange(1,1,1,last).getValues()[0].map(String);
  const expected=DEMO_TABLES[name];
  expected.forEach(h=>{if(!headers.includes(h)){headers.push(h);sheet.getRange(1,headers.length).setValue(h);}});
  return {sheet,headers};
}
function demoRows_(book,name) {
  const x=demoSheet_(book,name), last=x.sheet.getLastRow();
  const rows=last<2?[]:x.sheet.getRange(2,1,last-1,x.headers.length).getValues();
  return {sheet:x.sheet,headers:x.headers,rows};
}
function demoCell_(headers,row,key){return String(row[headers.indexOf(key)]||'');}
function getDemoDataPreview() {
  const c=demoAdmin_(),book=SpreadsheetApp.openById(c.id);
  const out={};
  Object.keys(DEMO_TABLES).forEach(name=>{
    const x=demoRows_(book,name);
    out[name]=x.rows.filter(r=>demoCell_(x.headers,r,'dataOrigin')==='DEMO').length;
  });
  return {counts:out,environment:'TEST',ready:true};
}
function createDemoData(requestId) {
  const c=demoAdmin_();
  if(!requestId || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) throw new Error('無效請求識別碼');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const book=SpreadsheetApp.openById(c.id);
    const existing=demoRows_(book,'Events');
    const batch='DEMO-'+Utilities.getUuid();
    const now=new Date().toISOString();
    const eventIds=[];
    const events=[];
    for(let i=0;i<5;i++){
      const id='DEMO-E-'+Utilities.getUuid();eventIds.push(id);
      events.push({eventId:id,name:'模擬競賽 '+(i+1),category:'DEMO',status:'OPEN',capacity:100,createdAt:now,dataOrigin:'DEMO',demoBatchId:batch});
    }
    const regs=[];
    for(let i=0;i<30;i++) regs.push({registrationId:'DEMO-R-'+Utilities.getUuid(),eventId:eventIds[i%5],className:'模擬班級',seatNo:(i%30)+1,studentName:'模擬學生'+(i+1),status:'REGISTERED',requestId:requestId+'-'+i,createdAt:now,dataOrigin:'DEMO',demoBatchId:batch});
    demoAppend_(existing,events);
    demoAppend_(demoRows_(book,'Registrations'),regs);
    demoAudit_(book,'DEMO_CREATED',batch,'events=5,registrations=30');
    return {batchId:batch,events:5,registrations:30};
  } finally {lock.releaseLock();}
}
function demoAppend_(table,objects){
  if(!objects.length)return;
  const values=objects.map(o=>table.headers.map(h=>o[h]===undefined?'':o[h]));
  table.sheet.getRange(table.sheet.getLastRow()+1,1,values.length,table.headers.length).setValues(values);
}
function clearDemoData(confirmation,requestId){
  const c=demoAdmin_();
  if(confirmation!=='CLEAR DEMO')throw new Error('確認文字不正確');
  if(!requestId || !/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))throw new Error('無效請求識別碼');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try {
    const book=SpreadsheetApp.openById(c.id);
    const events=demoRows_(book,'Events'),regs=demoRows_(book,'Registrations');
    const demoEventIds=new Set(events.rows.filter(r=>demoCell_(events.headers,r,'dataOrigin')==='DEMO').map(r=>demoCell_(events.headers,r,'eventId')));
    const realRefs=regs.rows.filter(r=>demoCell_(regs.headers,r,'dataOrigin')!=='DEMO' && demoEventIds.has(demoCell_(regs.headers,r,'eventId')));
    if(realRefs.length)throw new Error('正式報名資料引用模擬競賽，已中止清除');
    const backup=SpreadsheetApp.create('Sports Demo Backup '+new Date().toISOString());
    [events,regs].forEach((x,i)=>{
      const name=i===0?'Events':'Registrations';
      const dest=i===0?backup.getSheets()[0]:backup.insertSheet(name);
      dest.setName(name);
      const selected=x.rows.filter(r=>demoCell_(x.headers,r,'dataOrigin')==='DEMO');
      const values=[x.headers,...selected];
      dest.getRange(1,1,values.length,x.headers.length).setValues(values);
    });
    const deleted={};
    [['Registrations',regs],['Events',events]].forEach(([name,x])=>{
      const indices=x.rows.map((r,i)=>demoCell_(x.headers,r,'dataOrigin')==='DEMO'?i+2:null).filter(Boolean).reverse();
      indices.forEach(row=>x.sheet.deleteRow(row));
      deleted[name]=indices.length;
    });
    demoAudit_(book,'DEMO_CLEARED',requestId,JSON.stringify({deleted,backupId:backup.getId()}));
    return {deleted,backupUrl:backup.getUrl()};
  } finally {lock.releaseLock();}
}
function demoAudit_(book,action,id,details){
  const sheet=book.getSheetByName('AuditLogs');
  if(!sheet)return;
  sheet.appendRow([Utilities.getUuid(),action,id,new Date().toISOString(),details]);
}
