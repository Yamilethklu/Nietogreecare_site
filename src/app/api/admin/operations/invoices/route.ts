import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications/email';
import { invoiceEmail, invoicePDF } from '@/lib/operations/invoice';
import { loadInvoiceGroup } from '@/lib/operations/invoice-group';
import { texasToday } from '@/lib/operations/schedule';
export const runtime='nodejs';
const fail=(error:string,status=422)=>NextResponse.json({ok:false,error},{status});
export async function POST(request:Request){
 const gate=await requireAdmin(request);if(gate.response)return gate.response;
 const db=getSupabaseAdminClient();if(!db)return fail('Base de datos no configurada.',503);
 const parsed=z.object({action:z.enum(['create','send','pay','edit','delete']),order_id:z.string().uuid().optional(),invoice_id:z.string().uuid().optional(),payment_method:z.enum(['cash','cash_app','venmo','zelle']).optional(),confirm_sent_unpaid:z.boolean().optional(),items:z.array(z.object({orderId:z.string().uuid(),price:z.number().finite().min(0).max(100000)})).max(50).optional()}).safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return fail('Factura inválida.');
 const body=parsed.data;
 if(body.action==='create'){
  if(!body.order_id)return fail('Falta la orden.');
  const {data:order}=await db.from('work_orders').select('*').eq('id',body.order_id).single();
  if(!order)return fail('Orden no encontrada.',404);
  if(order.status!=='completed'||Number(order.price)<=0)return fail('La factura requiere un servicio terminado con precio.');
  const {data:existing,error:lookupError}=await db.from('work_invoices').select('*').eq('order_id',order.id).maybeSingle();
  if(lookupError)return fail('No se pudo verificar la factura.',503);
  if(existing)return NextResponse.json({ok:true,data:existing});
  const {data:lead}=await db.from('leads').select('customer_email').eq('id',order.lead_id).single();
  const {data,error}=await db.from('work_invoices').insert({order_id:order.id,invoice_number:`NGC-${order.service_date.replace(/-/g,'')}-${order.id.slice(0,8).toUpperCase()}`,total:order.price,customer_email:lead?.customer_email??null}).select().single();
  return error?fail('No se pudo crear la factura.',409):NextResponse.json({ok:true,data});
 }
 if(!body.invoice_id)return fail('Falta la factura.');
 const entry=await loadInvoiceGroup(db,body.invoice_id);if(!entry)return fail('Factura no encontrada.',404);
 const ids=entry.invoices.map(row=>row.id);
 if(body.action==='delete'){
  const sent=entry.invoices.some(row=>Boolean(row.sent_at));
  if(sent&&!body.confirm_sent_unpaid)return fail('Esta factura ya fue enviada. Confirme explícitamente que desea eliminarla; solo se permite si sigue impaga.',409);
  if(entry.orders.some(order=>Number(order.paid_amount)>0))return fail('No se puede eliminar una factura con pagos registrados.',409);
  const {error}=await db.from('work_invoices').delete().in('id',ids);
  return error?fail('No se pudo eliminar la factura.',503):NextResponse.json({ok:true,data:{deleted:ids.length,sentBeforeDeletion:sent}});
 }
 if(body.action==='edit'){
  if(entry.invoices.some(row=>row.sent_at))return fail('La factura enviada no se puede modificar.',409);
  if(!body.items||body.items.length!==entry.orders.length||new Set(body.items.map(item=>item.orderId)).size!==entry.orders.length)return fail('Incluya todas las visitas de la factura.');
  const rows=body.items.map(item=>{
   const order=entry.orders.find(row=>row.id===item.orderId),invoice=entry.invoices.find(row=>row.order_id===item.orderId);
   if(!order||!invoice||item.price<Number(order.paid_amount))return null;
   return {...invoice,total:item.price};
  });
  if(rows.some(row=>!row))return fail('Los precios deben cubrir los pagos recibidos.');
  const {error}=await db.rpc('edit_invoice_group',{p_invoice_id:body.invoice_id,p_items:body.items});
  return error?fail('No se pudo modificar la factura.',503):NextResponse.json({ok:true});
 }
 if(body.action==='pay'){
  if(!body.payment_method)return fail('Seleccione cómo pagó el cliente.');
  const paymentDate=typeof body.payment_date==='string'?body.payment_date:'';
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(paymentDate)||paymentDate>texasToday())return fail('Seleccione una fecha de pago válida, no futura.');
  const {error}=await db.rpc('pay_invoice_group',{p_invoice_id:body.invoice_id,p_method:body.payment_method,p_payment_date:paymentDate});
  return error?fail('No se pudo registrar el pago.',503):NextResponse.json({ok:true});
 }
 const target=entry.invoice.customer_email;
 if(!target)return fail('Agregue el correo del cliente antes de enviar la factura.');
 if(entry.invoices.some(row=>row.sent_at))return fail('Esta factura ya se envió.',409);
 const totalPaid=entry.orders.reduce((sum,order)=>sum+Number(order.paid_amount),0);
 const order={...entry.orders[0],paid_amount:totalPaid};
 const lines=entry.orders.map(item=>({date:item.service_date,description:item.notes?.includes('Bag Grass (+$10): Sí')?'Lawn service + Bag Grass':'Lawn / yard service',total:Number(entry.invoices.find(row=>row.order_id===item.id)!.total)}));
 const bytes=await invoicePDF(entry.invoice,order,entry.lead,lines);
 const result=await sendEmail({to:target,subject:`Invoice ${entry.invoice.invoice_number} · Nieto Green Care`,html:invoiceEmail(entry.invoice,order,entry.lead,lines),attachments:[{filename:`${entry.invoice.invoice_number}.pdf`,content:Buffer.from(bytes).toString('base64'),contentType:'application/pdf'}]});
 if(!result.ok){await db.from('work_invoices').update({email_error:result.error??'No se pudo enviar.'}).in('id',ids);return fail(result.error??'No se pudo enviar la factura.',503);}
 const {error}=await db.from('work_invoices').update({sent_at:new Date().toISOString(),sent_by:gate.user?.email??null,email_error:null}).in('id',ids);
 return error?fail('Correo enviado, pero no se pudo guardar su registro. No repita el envío.',503):NextResponse.json({ok:true});
}
