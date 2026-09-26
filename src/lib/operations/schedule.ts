import type { ServicePlan, WorkOrder } from './types';
export type Slot = {service_date:string;start_time:string;duration_minutes:number};
const DAY=86400000;
export function addDays(date:string,n:number){const d=new Date(`${date}T12:00:00Z`);if(Number.isNaN(d.getTime()))throw new Error('Fecha inválida');return new Date(d.getTime()+n*DAY).toISOString().slice(0,10);}
export function texasToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
const toMinutes=(time:string)=>{const match=/^(\d{2}):(\d{2})/.exec(time);return match?Number(match[1])*60+Number(match[2]):480;};
const toClock=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}:00`;
/** Pick the first non-overlapping slot for a worker on the requested local date. */
export function nextSlot(date:string,preferred:string,duration:number,worker:string|null,orders:Pick<WorkOrder,'service_date'|'start_time'|'duration_minutes'|'crew_member_id'|'status'>[]):Slot {
 if(duration<15||duration>480)throw new Error('La duración debe ser de 15 a 480 minutos.');
 let start=Math.max(480,toMinutes(preferred));
 if(worker){const busy=orders.filter(o=>o.service_date===date&&o.crew_member_id===worker&&o.status!=='cancelled').sort((a,b)=>toMinutes(a.start_time)-toMinutes(b.start_time));for(const order of busy){const occupiedStart=toMinutes(order.start_time),end=occupiedStart+order.duration_minutes;if(start+duration<=occupiedStart)break;if(start<end)start=end;}}
 if(start+duration>1080)throw new Error(`No queda tiempo para esta casa el ${date}; reduzca la duración o asigne otro trabajador.`);
 return {service_date:date,start_time:toClock(start),duration_minutes:duration};
}
export function futureVisits(plan:Pick<ServicePlan,'first_date'|'cadence'>, existing:Pick<WorkOrder,'service_date'|'plan_id'>[],planId:string,until:string,from=texasToday()):string[] {
 const interval=plan.cadence==='weekly'?7:plan.cadence==='bi_weekly'?14:0;
 const results:string[]=[];const visited=new Set(existing.filter(o=>o.plan_id===planId).map(o=>o.service_date));
 let date=plan.first_date;
 if(interval && date<from){const days=Math.max(0,Math.floor((Date.parse(`${from}T12:00:00Z`)-Date.parse(`${date}T12:00:00Z`))/DAY));date=addDays(date,Math.ceil(days/interval)*interval);}
 for(let i=0;i<60&&date<=until;i++) {if(date>=from&&!visited.has(date))results.push(date);if(!interval)break;date=addDays(date,interval);}
 return results;
}
