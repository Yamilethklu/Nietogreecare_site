import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/notifications/email';
import { invoiceEmail, invoicePDF } from '@/lib/operations/invoice';
import type { OpsLead,WorkInvoice,WorkOrder } from '@/lib/operations/types';
export const runtime='nodejs';
async function load(db:NonNullable<ReturnType<typeof getSupabaseAdminClient>>,id:string){const {data:invoice,error}=await db.from('work_invoices').select('*').eq('id',id).single();if(error||!invoice)return null;const {data:order}=await db.from('work_orders').select('*').eq('id',invoice.order_id).single();if(!order)return null;const {data:lead}=await db.from('leads').select('reference_code,customer_name,customer_phone,customer_email,address,city,zip_code').eq('id',order.lead_id).single();if(!lead)return null;return {invoice:invoice as WorkInvoice,order:order as WorkOrder,lead:lead as OpsLead};}
export async function POST(request:Request){const gate=await requireAdmin();if(gate.response)return gate.response;const db=getSupabaseAdminClient();if(!db)return NextResponse.json({ok:false,error:'Base de datos no configurada.'},{status:503});const body=await request.json().catch(()=>null);const parsed=z.object({action:z.enum(['create','send']),order_id:z.string().uuid().optional(),invoice_id:z.string().uuid().optional()}).safeParse(body);if(!parsed.success)return NextResponse.json({ok:false,error:'Factura inválida.'},{status:422});
 if(parsed.data.action==='create'){
  if(!parsed.data.order_id)return NextResponse.json({ok:false,error:'Falta la orden.'},{status:422});
  const {data:order}=await db.from('work_orders').select('*').eq('id',parsed.data.order_id).single();if(!order)return NextResponse.json({ok:false,error:'Orden no encontrada.'},{status:404});
  if(order.status!=='completed'||Number(order.price)<=0)return NextResponse.json({ok:false,error:'La factura requiere un servicio terminado con precio.'},{status:422});
  const {data:existing}=await db.from('work_invoices').select('*').eq('order_id',order.id).maybeSingle();if(existing)return NextResponse.json({ok:true,data:existing});
  const {data:lead}=await db.from('leads').select('customer_email').eq('id',order.lead_id).single();
  const {data,error}=await db.from('work_invoices').insert({order_id:order.id,invoice_number:`NGC-${order.service_date.replace(/-/g,'')}-${order.id.slice(0,8).toUpperCase()}`,total:order.price,customer_email:lead?.customer_email??null}).select().single();return error?NextResponse.json({ok:false,error:'No se pudo crear la factura.'},{status:503}):NextResponse.json({ok:true,data});
 }
 if(!parsed.data.invoice_id)return NextResponse.json({ok:false,error:'Falta la factura.'},{status:422});const entry=await load(db,parsed.data.invoice_id);if(!entry)return NextResponse.json({ok:false,error:'Factura no encontrada.'},{status:404});
 const target=entry.invoice.customer_email;if(!target)return NextResponse.json({ok:false,error:'Agregue el correo del cliente para enviar la factura; el PDF sigue disponible.'},{status:422});
 if(entry.invoice.sent_at)return NextResponse.json({ok:false,error:'Esta factura ya se envió. Consulte el historial antes de reenviarla.'},{status:409});
 const bytes=await invoicePDF(entry.invoice,entry.order,entry.lead);const result=await sendEmail({to:target,subject:`Invoice ${entry.invoice.invoice_number} · Nieto Green Care`,html:invoiceEmail(entry.invoice,entry.order,entry.lead),attachments:[{filename:`${entry.invoice.invoice_number}.pdf`,content:Buffer.from(bytes).toString('base64'),contentType:'application/pdf'}]});
 if(!result.ok){await db.from('work_invoices').update({email_error:result.error??'No se pudo enviar.'}).eq('id',entry.invoice.id);return NextResponse.json({ok:false,error:result.error??'No se pudo enviar la factura.'},{status:503});}
 const {data,error}=await db.from('work_invoices').update({sent_at:new Date().toISOString(),sent_by:gate.user?.email??null,email_error:null}).eq('id',entry.invoice.id).select().single();return error?NextResponse.json({ok:false,error:'Correo enviado, pero no se pudo guardar el registro. Consulte el estado antes de repetir el envío.'},{status:503}):NextResponse.json({ok:true,data});
}
