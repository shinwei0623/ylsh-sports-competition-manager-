/**
 * TEST Phase 1: meet policy and event setup. No existing rows are deleted.
 * Requires Script Properties ENVIRONMENT=TEST, SPREADSHEET_ID, ADMIN_EMAIL.
 * Does not enable registration or public deployment.
 */
const SPORT_MEET_HEADERS=['meetId','name','startDate','endDate','status','dailyIndividualLimit','relayLimit','createdAt'];
function sportP1Admin_(){
 const p=PropertiesService.getScriptProperties();
 if(p.getProperty('ENVIRONMENT')!=='TEST')throw Error('TEST only');
 const email=(Session.getActiveUser().getEmail()||'').toLowerCase();
 if(!email||email!==(p.getProperty('ADMIN_EMAIL')||'').toLowerCase())throw Error('Admin verification required');
 const id=p.getProperty('SPREADSHEET_ID');if(!id)throw Error('SPREADSHEET_ID missing');
 return SpreadsheetApp.openById(id);
}
function sportP1Sheet_(book,create){
 let s=book.getSheetByName('Meets');
 if(!s&&create)s=book.insertSheet('Meets');
 if(!s)throw Error('Run setupSportPhase1 first');
 let h=s.getLastColumn()?s.getRange(1,1,1,s.getLastColumn()).getValues()[0].map(String):[];
 if(create)SPORT_MEET_HEADERS.forEach(k=>{if(!h.includes(k)){h.push(k);s.getRange(1,h.length).setValue(k)}});
 if(SPORT_MEET_HEADERS.some(k=>!h.includes(k)))throw Error('Meets schema incomplete');
 return {s,h};
}
function setupSportPhase1(){
 const b=sportP1Admin_(),lock=LockService.getScriptLock();lock.waitLock(20000);
 try{sportP1Sheet_(b,true);return {ok:true,table:'Meets',defaultDailyIndividualLimit:2};}
 finally{lock.releaseLock()}
}
function sportP1Read_(t){
 if(t.s.getLastRow()<2)return [];
 return t.s.getRange(2,1,t.s.getLastRow()-1,t.h.length).getValues().map((row,i)=>({row:i+2,values:Object.fromEntries(t.h.map((k,j)=>[k,row[j]]))}));
}
function listSportMeets(){return sportP1Read_(sportP1Sheet_(sportP1Admin_(),false)).map(r=>r.values)}
function sportP1Date_(x){const v=String(x||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw Error('Invalid date');return v}
function sportP1Limit_(x){const n=Number(x);if(!Number.isInteger(n)||n<1||n>20)throw Error('Individual daily limit must be 1-20');return n}
function createSportMeet(input){
 const b=sportP1Admin_(),lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const t=sportP1Sheet_(b,false),name=String(input.name||'').trim();
  if(!name||name.length>100)throw Error('Invalid meet name');
  const start=sportP1Date_(input.startDate),end=sportP1Date_(input.endDate);
  if(end<start)throw Error('Invalid date range');
  const limit=input.dailyIndividualLimit==null?2:sportP1Limit_(input.dailyIndividualLimit);
  const relay=input.relayLimit==null?'':Number(input.relayLimit);
  if(relay!==''&&(!Number.isInteger(relay)||relay<0||relay>20))throw Error('Invalid relay limit');
  const v={meetId:Utilities.getUuid(),name,startDate:start,endDate:end,status:'DRAFT',dailyIndividualLimit:limit,relayLimit:relay,createdAt:new Date().toISOString()};
  t.s.appendRow(t.h.map(k=>Object.prototype.hasOwnProperty.call(v,k)?v[k]:''));return v;
 }finally{lock.releaseLock()}
}
function updateSportMeetDailyLimit(meetId,newLimit){
 const b=sportP1Admin_(),lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const t=sportP1Sheet_(b,false),r=sportP1Read_(t).find(x=>String(x.values.meetId)===String(meetId));
  if(!r)throw Error('Meet not found');
  if(String(r.values.status)!=='DRAFT')throw Error('Only draft meets may change policy');
  const n=sportP1Limit_(newLimit);
  t.s.getRange(r.row,t.h.indexOf('dailyIndividualLimit')+1).setValue(n);
  return {meetId,dailyIndividualLimit:n};
 }finally{lock.releaseLock()}
}
