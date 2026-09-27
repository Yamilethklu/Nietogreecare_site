import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { addDays, futureVisits, nextSlot, texasToday } from './schedule';
import type { ServicePlan, WorkOrder } from './types';
export type OpsDB = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

/** Idempotent 12-week rolling window; each visit remains a separate accounting record. */
export async function extendPlans(db:OpsDB, plans:ServicePlan[]) {
 const today=texasToday(),horizon=addDays(today,84);
 const all:WorkOrder[]=[];
 for(let offset=0;offset<50000;offset+=500){
  const {data,error}=await db.from('work_orders').select('id,plan_id,lead_id,crew_member_id,service_date,start_time,duration_minutes,status,price,paid_amount').gte('service_date',today).order('service_date').range(offset,offset+499);
  if(error)throw Error(error.message);all.push(...((data??[]) as WorkOrder[]));if((data??[]).length<500)break;
 }
 const warnings:string[]=[];
 let created=0;
 for(const plan of plans.filter(item=>item.active)) {
  for(const date of futureVisits(plan,all,plan.id,plan.first_date>horizon?plan.first_date:horizon,today)) {
   try {
    const slot=nextSlot(date,plan.preferred_start,plan.duration_minutes,plan.crew_member_id,all);
    const order={plan_id:plan.id,lead_id:plan.lead_id,crew_member_id:plan.crew_member_id,...slot,status:'scheduled',price:Number(plan.price_per_visit),paid_amount:0};
    const {data,error:insertError}=await db.from('work_orders').upsert(order,{onConflict:'plan_id,service_date',ignoreDuplicates:true}).select().maybeSingle();
    if(insertError)throw Error(insertError.message);
    if(data){all.push(data as WorkOrder);created++;}
   }catch(e){warnings.push(`${date}: ${e instanceof Error?e.message:'No se pudo agendar'}`);}
  }
 }
 return {created,warnings};
}
