import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { extendPlans } from '@/lib/operations/server';
import { listAll } from '@/lib/operations/list';
import { nextSlot, texasToday } from '@/lib/operations/schedule';
import { manualLeadSchema, orderUpdateSchema, planSchema, workerSchema } from '@/lib/operations/validation';
import type { ServicePlan, WorkOrder } from '@/lib/operations/types';
export const runtime='nodejs';
const uuid=z.string().uuid();
const fail=(message:string,status=422)=>NextResponse.json({ok:false,error:message},{status});
async function authorized(request:Request){const gate=await requireAdmin(request);return {response:gate.response,db:getSupabaseAdminClient()};}
const isMissingOpsTable=(message?:string)=>Boolean(message&&(/schema cache/i.test(message)||/could not find the table/i.test(message)||/does not exist/i.test(message))&&/(crew_members|service_plans|work_orders|work_invoices)/i.test(message));
export async function GET(request:Request){const {response,db}=await authorized(request);if(response)return response;if(!db)return fail('Base de datos no configurada.',503);
 const {error:refreshError}=await db.rpc('refresh_recurring_visits');
 if(refreshError)return fail('No se pudo actualizar la agenda recurrente.',503);
 const [crew,plans,orders,invoices,leads]=await Promise.all([
  listAll(db,'crew_members','*','full_name'),
  listAll(db,'service_plans'),
  listAll(db,'work_orders','*','service_date'),
  listAll(db,'work_invoices'),
  listAll(db,'leads','id,customer_id,reference_code,customer_name,customer_phone,customer_email,address,city,zip_code,final_price,requested_date,details,additional_notes,has_gate_code,gate_code,selected_services')
 ]);
 const err=[crew,plans,orders,invoices,leads].find(x=>x.error)?.error;
 if(err&&isMissingOpsTable(err.message))return NextResponse.json({ok:true,data:{crew:[],plans:[],orders:[],invoices:[],leads:leads.data??[]},warning:'La agenda de casas y trabajos todavía no está activada en Supabase. El panel principal puede usarse normalmente.'},{headers:{'Cache-Control':'no-store'}});
 if(err)return fail('La agenda aún no está disponible en la base de datos: '+err.message,503);
 return NextResponse.json({ok:true,data:{crew:crew.data??[],plans:plans.data??[],orders:orders.data??[],invoices:invoices.data??[],leads:leads.data??[]}},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){const {response,db}=await authorized(request);if(response)return response;if(!db)return fail('Base de datos no configurada.',503);
 const body=await request.json().catch(()=>null);if(!body||typeof body.action!=='string')return fail('Acción inválida.');
 if(body.action==='worker'){
  const parsed=workerSchema.safeParse(body.worker);if(!parsed.success)return fail('Nombre y correo del trabajador inválidos.');
  const {data:existing,error:lookupError}=await db.from('crew_members').select('id').ilike('email',parsed.data.email).maybeSingle();if(lookupError)return fail(lookupError.message,503);
  if(existing){const {data,error}=await db.from('crew_members').update({...parsed.data,active:true}).eq('id',existing.id).select().single();return error?fail(error.message):NextResponse.json({ok:true,data});}
  const {data,error}=await db.from('crew_members').insert(parsed.data).select().single();return error?fail(error.message,409):NextResponse.json({ok:true,data});
 }
 if(body.action==='worker_update'){
  const id=uuid.safeParse(body.id),parsed=workerSchema.partial().safeParse(body.changes);
  if(!id.success||!parsed.success)return fail('Trabajador inválido.');
  const {data,error}=await db.from('crew_members').update(parsed.data).eq('id',id.data).select().single();return error?fail(error.message):NextResponse.json({ok:true,data});
 }
 if(body.action==='order_delete'){
  const id=uuid.safeParse(body.id);if(!id.success)return fail('Orden inválida.');
  const {data:order,error:orderError}=await db.from('work_orders').select('id,paid_amount').eq('id',id.data).maybeSingle();
  if(orderError)return fail('No se pudo verificar la orden.',503);
  if(!order)return fail('Orden no encontrada.',404);
  if(Number(order.paid_amount)>0)return fail('No se puede eliminar una orden con pagos registrados.',409);
  const {data:invoice,error:invoiceError}=await db.from('work_invoices').select('id').eq('order_id',id.data).maybeSingle();
  if(invoiceError)return fail('No se pudo verificar si la orden tiene factura.',503);
  if(invoice)return fail('Elimine primero la factura pendiente para liberar esta orden.',409);
  const {error}=await db.from('work_orders').delete().eq('id',id.data);
  return error?fail('No se pudo eliminar la orden: '+error.message,409):NextResponse.json({ok:true});
 }
 if(body.action==='worker_delete'){
  const id=uuid.safeParse(body.id);if(!id.success)return fail('Trabajador inválido.');
  const {error}=await db.from('crew_members').delete().eq('id',id.data);
  if(error)return fail('No se pudo eliminar el trabajador. Si ya tiene trabajos asignados, desactive su acceso: '+error.message,409);
  return NextResponse.json({ok:true});
 }
 if(body.action==='mobile_house'){
  const parsed=z.object({id:uuid.nullable(),house:manualLeadSchema,cadence:z.enum(['weekly','bi_weekly','one_time']),first_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),price:z.number().finite().min(0).max(100000),notes:z.string().max(2000).nullable()}).safeParse(body);
  if(!parsed.success)return fail('Revise nombre, teléfono, correo, dirección, ciudad, ZIP, frecuencia y precio.');
  const value=parsed.data;
  const {data,error}=await db.rpc('save_mobile_house',{p_id:value.id,p_house:value.house,p_cadence:value.cadence,p_date:value.first_date,p_price:value.price,p_notes:value.notes});
  return error?fail('No se pudo guardar la casa y su agenda: '+error.message):NextResponse.json({ok:true,data});
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
  const nextPrice=changes.price!==undefined?changes.price:Number(current.price);
  if(changes.paid_amount!==undefined&&changes.paid_amount>nextPrice)return fail('El pago no puede superar el precio de esta visita.');
  if((changes.paid_amount??Number(current.paid_amount))>0&&!(changes.payment_method??current.payment_method))return fail('Indique cómo pagó el cliente.');
  if(changes.status==='completed'&&current.status!=='completed')Object.assign(changes,{completed_at:new Date().toISOString()});
  if(changes.status&&changes.status!=='completed'&&current.status==='completed')Object.assign(changes,{completed_at:null});
  if(changes.paid_amount!==undefined)Object.assign(changes,{paid_at:changes.paid_amount===nextPrice?(changes.paid_at??new Date().toISOString()):null});
  const date=changes.service_date??current.service_date,worker=changes.crew_member_id===undefined?current.crew_member_id:changes.crew_member_id;
  const start=changes.start_time??current.start_time,duration=changes.duration_minutes??current.duration_minutes;
  if(changes.service_date||changes.start_time||changes.duration_minutes||changes.crew_member_id!==undefined){
   const {data:day,error:dayError}=await db.from('work_orders').select('id,service_date,start_time,duration_minutes,crew_member_id,status').eq('service_date',date);
   if(dayError)return fail(dayError.message,503);
   const conflicts=(day??[]).filter(row=>row.id!==id);
   try {const slot=nextSlot(date,start,duration,worker,conflicts as WorkOrder[]);if(slot.start_time.slice(0,5)!==start.slice(0,5))return fail('Este horario se superpone con otra casa asignada al trabajador.');}catch(e){return fail(e instanceof Error?e.message:'Horario inválido.');}
  }
  const {data,error}=await db.from('work_orders').update(changes).eq('id',id).select().single();if(error)return fail(error.message);
  if(changes.price!==undefined && changes.price!==Number(current.price)){await db.from('work_invoices').update({total:changes.price}).eq('order_id',id).is('sent_at',null);}
  return NextResponse.json({ok:true,data});
 }
 return fail('Acción no reconocida.');
}
