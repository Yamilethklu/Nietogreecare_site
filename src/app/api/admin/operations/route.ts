import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { extendPlans } from '@/lib/operations/server';
import { nextSlot, texasToday } from '@/lib/operations/schedule';
import { manualLeadSchema, orderUpdateSchema, planSchema, workerSchema } from '@/lib/operations/validation';
import type { ServicePlan, WorkOrder } from '@/lib/operations/types';
export const runtime='nodejs';
const uuid=z.string().uuid();
const fail=(message:string,status=422)=>NextResponse.json({ok:false,error:message},{status});
async function authorized(){const gate=await requireAdmin();return {response:gate.response,db:getSupabaseAdminClient()};}
export async function GET(){const {response,db}=await authorized();if(response)return response;if(!db)return fail('Base de datos no configurada.',503);
 const [crew,plans,orders,invoices,leads]=await Promise.all([
  db.from('crew_members').select('*').order('full_name'),
  db.from('service_plans').select('*').order('created_at',{ascending:false}),
  db.from('work_orders').select('*').order('service_date',{ascending:false}).limit(1000),
  db.from('work_invoices').select('*').order('created_at',{ascending:false}).limit(1000),
  db.from('leads').select('id,reference_code,customer_name,customer_phone,customer_email,address,city,zip_code,final_price,requested_date,details,additional_notes,has_gate_code,gate_code').order('created_at',{ascending:false}).limit(1000)
 ]);
 const err=[crew,plans,orders,invoices,leads].find(x=>x.error)?.error;
 if(err)return fail('La agenda aún no está disponible en la base de datos: '+err.message,503);
 return NextResponse.json({ok:true,data:{crew:crew.data??[],plans:plans.data??[],orders:orders.data??[],invoices:invoices.data??[],leads:leads.data??[]}},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){const {response,db}=await authorized();if(response)return response;if(!db)return fail('Base de datos no configurada.',503);
 const body=await request.json().catch(()=>null);if(!body||typeof body.action!=='string')return fail('Acción inválida.');
 if(body.action==='worker'){
  const parsed=workerSchema.safeParse(body.worker);if(!parsed.success)return fail('Nombre y correo del trabajador inválidos.');
  const {data,error}=await db.from('crew_members').insert(parsed.data).select().single();return error?fail(error.message,409):NextResponse.json({ok:true,data});
 }
 if(body.action==='worker_update'){
  const id=uuid.safeParse(body.id),parsed=workerSchema.partial().safeParse(body.changes);
  if(!id.success||!parsed.success)return fail('Trabajador inválido.');
  const {data,error}=await db.from('crew_members').update(parsed.data).eq('id',id.data).select().single();return error?fail(error.message):NextResponse.json({ok:true,data});
 }
 if(body.action==='house'){
  const parsed=manualLeadSchema.safeParse(body.house);if(!parsed.success)return fail('Revise el nombre, teléfono, dirección, ciudad y ZIP.');
  const reference_code=`OPS-${Date.now()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const {data,error}=await db.from('leads').insert({...parsed.data,reference_code,source:'admin',selected_services:['weekly_biweekly_lawn_service'],service_count:1,requested_date:texasToday()}).select().single();
  return error?fail(error.message):NextResponse.json({ok:true,data});
 }
 if(body.action==='plan'){
  const parsed=planSchema.safeParse(body.plan);if(!parsed.success)return fail('Revise frecuencia, fecha, hora, duración, tarifa y trabajador.');
  const {data:lead}=await db.from('leads').select('id').eq('id',parsed.data.lead_id).maybeSingle();if(!lead)return fail('Casa no encontrada.',404);
  if(parsed.data.crew_member_id){const {data:member}=await db.from('crew_members').select('id').eq('id',parsed.data.crew_member_id).eq('active',true).maybeSingle();if(!member)return fail('Seleccione un trabajador activo.');}
  const {data:plan,error}=await db.from('service_plans').insert(parsed.data).select().single();if(error)return fail(error.message,409);
  const schedule=await extendPlans(db,[plan as ServicePlan]);return NextResponse.json({ok:true,data:{plan,...schedule}});
 }
 if(body.action==='plan_update'){
  const id=uuid.safeParse(body.id);const fields=z.object({active:z.boolean().optional(),notes:z.string().max(2000).nullable().optional()}).strict().safeParse(body.changes);
  if(!id.success||!fields.success)return fail('Plan inválido.');
  const {data,error}=await db.from('service_plans').update(fields.data).eq('id',id.data).select().single();if(error)return fail(error.message);
  if(fields.data.active===false){const {error:pauseError}=await db.from("work_orders").update({status:"cancelled"}).eq("plan_id",id.data).eq("status","scheduled").gte("service_date",texasToday());if(pauseError)return fail("Plan pausado, pero no se pudieron cancelar las visitas futuras: "+pauseError.message,503);}
  const schedule=data.active?await extendPlans(db,[data as ServicePlan]):{created:0,warnings:[]};return NextResponse.json({ok:true,data:{plan:data,...schedule}});
 }
 if(body.action==='extend'){
  const {data,error}=await db.from('service_plans').select('*').eq('active',true);if(error)return fail(error.message,503);
  return NextResponse.json({ok:true,data:await extendPlans(db,(data??[]) as ServicePlan[])});
 }
 if(body.action==='order'){
  const parsed=orderUpdateSchema.safeParse(body.order);if(!parsed.success)return fail('Datos de la orden inválidos.');
  const {id,...changes}=parsed.data;
  const {data:current,error:currentError}=await db.from('work_orders').select('*').eq('id',id).single();if(currentError||!current)return fail('Orden no encontrada.',404);
  if(current.status==='cancelled'&&changes.status&&changes.status!=='scheduled')return fail('Reabra la orden antes de cambiarla.');
  if(changes.paid_amount!==undefined&&changes.paid_amount>Number(current.price))return fail('El pago no puede superar el precio de esta visita.');
  if((changes.paid_amount??Number(current.paid_amount))>0&&!(changes.payment_method??current.payment_method))return fail('Indique cómo pagó el cliente.');
  if(changes.status==='completed'&&current.status!=='completed')Object.assign(changes,{completed_at:new Date().toISOString()});
  if(changes.status&&changes.status!=='completed'&&current.status==='completed')Object.assign(changes,{completed_at:null});
  if(changes.paid_amount!==undefined)Object.assign(changes,{paid_at:changes.paid_amount===Number(current.price)?new Date().toISOString():null});
  const date=changes.service_date??current.service_date,worker=changes.crew_member_id===undefined?current.crew_member_id:changes.crew_member_id;
  const start=changes.start_time??current.start_time,duration=changes.duration_minutes??current.duration_minutes;
  if(changes.service_date||changes.start_time||changes.duration_minutes||changes.crew_member_id!==undefined){
   const {data:day,error:dayError}=await db.from('work_orders').select('id,service_date,start_time,duration_minutes,crew_member_id,status').eq('service_date',date);
   if(dayError)return fail(dayError.message,503);
   const conflicts=(day??[]).filter(row=>row.id!==id);
   try {const slot=nextSlot(date,start,duration,worker,conflicts as WorkOrder[]);if(slot.start_time.slice(0,5)!==start.slice(0,5))return fail('Este horario se superpone con otra casa asignada al trabajador.');}catch(e){return fail(e instanceof Error?e.message:'Horario inválido.');}
  }
  const {data,error}=await db.from('work_orders').update(changes).eq('id',id).select().single();return error?fail(error.message):NextResponse.json({ok:true,data});
 }
 return fail('Acción no reconocida.');
}
