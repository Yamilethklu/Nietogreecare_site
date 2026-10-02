import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime='nodejs';
const schema=z.object({items:z.array(z.object({orderId:z.string().uuid(),price:z.number().finite().min(0).max(100000)})).min(1).max(50)});
export async function POST(request:Request){
  const gate=await requireAdmin(request);if(gate.response)return gate.response;
  const db=getSupabaseAdminClient();if(!db)return NextResponse.json({ok:false,error:'Base de datos no disponible.'},{status:503});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({ok:false,error:'Seleccione visitas y precios válidos.'},{status:422});
  const items=parsed.data.items,ids=items.map(item=>item.orderId);
  if(new Set(ids).size!==ids.length)return NextResponse.json({ok:false,error:'Hay visitas duplicadas.'},{status:422});
  const {data:orders,error}=await db.from('work_orders').select('*').in('id',ids);
  if(error||orders?.length!==ids.length)return NextResponse.json({ok:false,error:'No se pudieron consultar las visitas.'},{status:503});
  if(orders.some(order=>order.status!=='completed'||Number(order.paid_amount)>=Number(order.price)))return NextResponse.json({ok:false,error:'Seleccione únicamente trabajos terminados pendientes de pago.'},{status:422});
  const {data:leads,error:leadError}=await db.from('leads').select('id,customer_phone,customer_email,customer_name,address').in('id',[...new Set(orders.map(order=>order.lead_id))]);
  const phone=(value:string)=>value.replace(/\D/g,'').slice(-10);
  if(leadError||!leads?.length||new Set(leads.map(lead=>phone(lead.customer_phone))).size!==1)return NextResponse.json({ok:false,error:'Las visitas deben pertenecer al mismo cliente.'},{status:422});
  if(items.some(item=>item.price<Number(orders.find(order=>order.id===item.orderId)!.paid_amount)))return NextResponse.json({ok:false,error:'El precio no puede ser menor que el importe ya pagado.'},{status:422});
  const {data:existing,error:existingError}=await db.from('work_invoices').select('id').in('order_id',ids);
  if(existingError)return NextResponse.json({ok:false,error:'No se pudo verificar el historial de facturas.'},{status:503});
  if(existing?.length)return NextResponse.json({ok:false,error:'Una visita ya tiene factura. Consulte la factura existente para evitar cobros duplicados.'},{status:409});
  const key=`NGC-G-${crypto.randomUUID()}`;
  const {data,error:insertError}=await db.from('work_invoices').insert(items.map(item=>({order_id:item.orderId,invoice_number:`${key}/${item.orderId}`,total:item.price,customer_email:leads[0].customer_email}))).select();
  if(insertError)return NextResponse.json({ok:false,error:'No se pudo guardar la factura agrupada; ninguna visita se marcó pagada.'},{status:409});
  return NextResponse.json({ok:true,data:data?.[0]});
}
