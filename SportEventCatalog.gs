/** TEST-only event definitions; adds columns but never removes existing data. */
const SPORT_EVENT_EXTRA=['meetId','division','eventType','competitionDate','startTime','venue','perClassLimit','registrationDeadline'];
function setupSportEventColumns(){
 const book=sportP1Admin_(),lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const s=book.getSheetByName('Events');if(!s)throw Error('Events sheet missing');
  const h=s.getRange(1,1,1,s.getLastColumn()).getValues()[0].map(String);
  SPORT_EVENT_EXTRA.forEach(k=>{if(!h.includes(k)){h.push(k);s.getRange(1,h.length).setValue(k)}});
  return {ok:true,columns:h};
 }finally{lock.releaseLock()}
}
function listSportEvents(meetId){
 const b=sportP1Admin_(),s=b.getSheetByName('Events');if(!s)throw Error('Events missing');
 const h=s.getRange(1,1,1,s.getLastColumn()).getValues()[0].map(String);
 if(SPORT_EVENT_EXTRA.some(k=>!h.includes(k)))throw Error('Run setupSportEventColumns');
 if(s.getLastRow()<2)return [];
 return s.getRange(2,1,s.getLastRow()-1,h.length).getValues().map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]]))).filter(r=>!meetId||String(r.meetId)===String(meetId));
}
function createSportEvent(input){
 const b=sportP1Admin_(),lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const meet=sportP1Read_(sportP1Sheet_(b,false)).map(r=>r.values).find(x=>String(x.meetId)===String(input.meetId));
  if(!meet||meet.status!=='DRAFT')throw Error('Draft meet not found');
  const day=sportP1Date_(input.competitionDate);
  if(day<String(meet.startDate)||day>String(meet.endDate))throw Error('Competition date outside meet');
  const type=String(input.eventType);
  if(!['INDIVIDUAL','RELAY','TEAM'].includes(type))throw Error('Invalid event type');
  const clean=(x,n)=>{const v=String(x||'').trim();if(!v||v.length>n||/[<>]/.test(v))throw Error('Invalid field');return v};
  const integer=(x,max)=>{const v=Number(x);if(!Number.isInteger(v)||v<1||v>max)throw Error('Invalid capacity');return v};
  const capacity=integer(input.capacity,10000),perClassLimit=integer(input.perClassLimit,1000);
  if(perClassLimit>capacity)throw Error('Per-class limit exceeds capacity');
  const deadline=input.registrationDeadline?sportP1Date_(input.registrationDeadline):'';
  if(deadline&&deadline>day)throw Error('Deadline after event');
  const time=String(input.startTime||'');
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Invalid start time');
  const s=b.getSheetByName('Events'),h=s.getRange(1,1,1,s.getLastColumn()).getValues()[0].map(String);
  if(SPORT_EVENT_EXTRA.some(k=>!h.includes(k)))throw Error('Run setupSportEventColumns');
  const record={eventId:Utilities.getUuid(),meetId:String(meet.meetId),name:clean(input.name,100),category:clean(input.category,50),division:clean(input.division,60),eventType:type,competitionDate:day,startTime:time,venue:clean(input.venue,80),capacity,perClassLimit,registrationDeadline:deadline,status:'DRAFT',createdAt:new Date().toISOString()};
  s.appendRow(h.map(k=>Object.prototype.hasOwnProperty.call(record,k)?record[k]:''));return record;
 }finally{lock.releaseLock()}
}
